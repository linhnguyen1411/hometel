import io
import uuid
import pytest
import openpyxl
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import get_owner_headers, get_tenant_headers, create_isolated_building


@pytest.mark.asyncio
async def test_tc_bil_01_ocr_scan_meter():
    """TC-BIL-01: Quét ảnh công tơ qua AI OCR Vision (giả lập response OCR)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-01")

        meters = (await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)).json()["data"]
        assert len(meters) >= 1
        meter_id = meters[0]["id"]

        # Call OCR scan with simulated image containing reading
        res = await ac.post("/api/v1/billing/meters/ocr-scan", json={
            "meterId": meter_id,
            "imageBase64OrUrl": "data:image/jpeg;base64,mock?reading=150.5"
        }, headers=owner_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["detectedReading"] == 150.5
        assert data["confidence"] > 0.8
        assert "consumption" in data


@pytest.mark.asyncio
async def test_tc_bil_02_manual_meter_recording():
    """TC-BIL-02: Chốt số công tơ nhập tay (ocrConfidence: null) lưu vào DB thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-02")

        meters = (await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)).json()["data"]
        target_meter = meters[0]
        cur_val = target_meter.get("currentReading") or 0.0
        new_val = cur_val + 25.0

        commit_res = await ac.post(f"/api/v1/billing/meters/{target_meter['id']}/commit-ocr", json={
            "readingValue": new_val,
            "ocrConfidence": None,  # Manual reading
            "rawOcrText": "Ghi số trực tiếp bởi quản lý",
            "notes": "Kiểm tra định kỳ"
        }, headers=owner_headers)
        assert commit_res.status_code == 200
        c_data = commit_res.json()["data"]
        assert c_data["currentReading"] == new_val
        assert c_data["consumption"] == 25.0


@pytest.mark.asyncio
async def test_tc_bil_03_meter_reading_backwards_rejected():
    """TC-BIL-03: Chốt số công tơ với chỉ số MỚI nhỏ hơn chỉ số CŨ bị từ chối 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-03")

        meters = (await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)).json()["data"]
        target_meter = meters[0]

        # First commit 200
        await ac.post(f"/api/v1/billing/meters/{target_meter['id']}/commit-ocr", json={
            "readingValue": 200.0,
            "ocrConfidence": None
        }, headers=owner_headers)

        # Attempt to commit 150 (< 200) -> MUST FAIL (400)
        backwards_res = await ac.post(f"/api/v1/billing/meters/{target_meter['id']}/commit-ocr", json={
            "readingValue": 150.0,
            "ocrConfidence": None
        }, headers=owner_headers)
        assert backwards_res.status_code == 400
        assert "nhỏ hơn" in backwards_res.json()["error"]["message"]


@pytest.mark.asyncio
async def test_tc_bil_04_auto_draft_invoice_on_reading():
    """TC-BIL-04: Tự động tạo hóa đơn nháp khi chốt số (autoDraftInvoice=True) cho phòng đang active."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-04")

        # Create & sign active contract
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5000000,
            "depositAmount": 5000000
        }, headers=owner_headers)
        c_id = c_res.json()["data"]["id"]
        await ac.post(f"/api/v1/contracts/{c_id}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        meters = (await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)).json()["data"]
        target_meter = meters[0]

        # Commit reading with autoDraftInvoice = True
        res = await ac.post(f"/api/v1/billing/meters/{target_meter['id']}/commit-ocr", json={
            "readingValue": 50.0,
            "autoDraftInvoice": True
        }, headers=owner_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["autoDraftedInvoice"] is not None
        assert data["autoDraftedInvoice"]["status"] == "DRAFT"
        assert data["autoDraftedInvoice"]["total"] > 5000000


@pytest.mark.asyncio
async def test_tc_bil_05_monthly_batch_invoicing_idempotent():
    """TC-BIL-05: Sinh hóa đơn hàng loạt đầu tháng — idempotent: chạy lần 2 cùng tháng không tạo thêm."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-05")

        # Create & activate contract
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        c_id = c_res.json()["data"]["id"]
        await ac.post(f"/api/v1/contracts/{c_id}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        test_month = "2028-05"

        # Run 1: Should create invoice
        run1 = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": test_month,
            "buildingId": bld_data["building_id"]
        }, headers=owner_headers)
        assert run1.status_code in (200, 201)
        r1_data = run1.json()["data"]
        assert r1_data["invoices_created"] >= 1

        # Run 2: Same month -> Idempotent, 0 new invoices created, skipped incremented
        run2 = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": test_month,
            "buildingId": bld_data["building_id"]
        }, headers=owner_headers)
        assert run2.status_code == 200
        r2_data = run2.json()["data"]
        assert r2_data["invoices_created"] == 0
        assert r2_data["invoices_skipped"] >= 1


@pytest.mark.asyncio
async def test_tc_bil_06_monthly_batch_invoicing_building_scoped():
    """TC-BIL-06: Sinh hóa đơn hàng loạt cho tòa nhà A không được lẫn hợp đồng của tòa nhà B."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]

        # Create Building A and Building B
        bld_a = await create_isolated_building(ac, owner_headers, "TC-BIL-06-A")
        bld_b = await create_isolated_building(ac, owner_headers, "TC-BIL-06-B")

        # Activate contract in Bld A only
        cA_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_a["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5500000,
            "depositAmount": 5500000
        }, headers=owner_headers)
        await ac.post(f"/api/v1/contracts/{cA_res.json()['data']['id']}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        test_period = "2028-06"

        # Generate for Bld B (has NO active contracts) -> invoices_created = 0
        gen_b = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": test_period,
            "buildingId": bld_b["building_id"]
        }, headers=owner_headers)
        assert gen_b.status_code == 200
        assert gen_b.json()["data"]["invoices_created"] == 0

        # Generate for Bld A -> invoices_created >= 1
        gen_a = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": test_period,
            "buildingId": bld_a["building_id"]
        }, headers=owner_headers)
        assert gen_a.status_code in (200, 201)
        assert gen_a.json()["data"]["invoices_created"] >= 1


@pytest.mark.asyncio
async def test_tc_bil_07_manual_payment_full():
    """TC-BIL-07: Ghi nhận thanh toán thủ công đủ tiền — hóa đơn chuyển PAID, outstanding = 0."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-07")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5000000,
            "depositAmount": 5000000
        }, headers=owner_headers)
        await ac.post(f"/api/v1/contracts/{c_res.json()['data']['id']}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        # Generate invoice
        gen = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": "2028-07",
            "buildingId": bld_data["building_id"]
        }, headers=owner_headers)
        invoices = (await ac.get("/api/v1/billing/invoices", headers=owner_headers)).json()["data"]
        inv = invoices[0]

        # Record FULL payment
        pay_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv["id"],
            "amount": float(inv["total"]),
            "method": "CASH",
            "notes": "Thanh toán đầy đủ tiền mặt tại quầy lễ tân"
        }, headers=owner_headers)
        assert pay_res.status_code == 201
        pay_data = pay_res.json()["data"]
        assert pay_data["invoiceStatus"] == "PAID"
        assert pay_data["outstandingAmount"] == 0.0


@pytest.mark.asyncio
async def test_tc_bil_08_manual_payment_partial():
    """TC-BIL-08: Thanh toán một phần — hóa đơn chuyển PARTIALLY_PAID, số nợ còn lại tính đúng."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-08")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        await ac.post(f"/api/v1/contracts/{c_res.json()['data']['id']}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "billing_month": "2028-08",
            "buildingId": bld_data["building_id"]
        }, headers=owner_headers)
        invoices = (await ac.get("/api/v1/billing/invoices", headers=owner_headers)).json()["data"]
        inv = invoices[0]
        total = float(inv["total"])

        # Pay partial amount (e.g. 2,000,000)
        partial_amount = 2000000.0
        pay_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv["id"],
            "amount": partial_amount,
            "method": "BANK_TRANSFER",
            "notes": "Thanh toán đợt 1"
        }, headers=owner_headers)
        assert pay_res.status_code == 201
        pay_data = pay_res.json()["data"]
        assert pay_data["invoiceStatus"] == "PARTIALLY_PAID"
        assert pay_data["outstandingAmount"] == round(total - partial_amount, 2)


@pytest.mark.asyncio
async def test_tc_bil_09_vietqr_endpoints_disabled_503():
    """TC-BIL-09: Gọi endpoint VietQR (lấy mã QR, webhook) khi cờ tắt trả về 503 đúng thông báo."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        expected_msg = "Tính năng đang tạm ngưng, sẽ kích hoạt sau khi hoàn tất đăng ký doanh nghiệp"

        # 1. GET VietQR
        res1 = await ac.get("/api/v1/billing/invoices/inv_test_dummy/vietqr", headers=owner_headers)
        assert res1.status_code == 503
        assert expected_msg in res1.json()["error"]["message"]

        # 2. POST VietQR Webhook
        res2 = await ac.post("/api/v1/billing/invoices/webhook/vietqr", json={
            "transactionId": "tx_test_123",
            "amount": 5000000,
            "description": "INV-TEST-123"
        })
        assert res2.status_code == 503
        assert expected_msg in res2.json()["error"]["message"]


@pytest.mark.asyncio
async def test_tc_bil_10_meter_excel_bulk_import():
    """TC-BIL-10: Import chỉ số công tơ hàng loạt qua Excel: template tải về, import thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-BIL-10")

        # 1. Download template
        tpl_res = await ac.get("/api/v1/billing/meters/import-template")
        assert tpl_res.status_code == 200
        assert "spreadsheetml.sheet" in tpl_res.headers.get("content-type", "")

        # 2. Bulk import via Excel
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Tòa nhà (*)", "Số phòng (*)", "Loại công tơ (DIEN/NUOC) (*)", "Chỉ số mới (*)", "Ngày ghi (YYYY-MM-DD)", "Ghi chú"])
        ws.append([bld_data["building_name"], bld_data["room_number"], "DIEN", 280.5, "2026-09-17", "Ghi bulk định kỳ"])
        ws.append([bld_data["building_name"], bld_data["room_number"], "NUOC", 25.0, "2026-09-17", "Ghi bulk định kỳ"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        import_res = await ac.post(
            "/api/v1/billing/meters/bulk-import",
            files={"file": ("bulk_meters.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=owner_headers
        )
        assert import_res.status_code == 200
        assert import_res.json()["data"]["importedCount"] >= 2
