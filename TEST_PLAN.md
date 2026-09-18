# KẾ HOẠCH & BỘ TEST CASE TOÀN DIỆN NỀN TẢNG HOMTEL (TEST PLAN)

> **Dự án**: Homtel — Nền tảng Quản trị Vận hành Bất động sản Cho thuê & Căn hộ Dịch vụ  
> **Kiến trúc**: FastAPI (Python 3.12+) Async + PostgreSQL 18 + Next.js 14 App Router  
> **Phiên bản tài liệu**: 1.1 (Phase 1 & P0/P1 Security Hardening Hoàn tất)  
> **Trạng thái thực thi tự động**: **100% Passed (79/79 tests)** trên cơ sở dữ liệu PostgreSQL thực.

---

## MỤC LỤC
1. [Giới thiệu & Quy ước](#1-giới-thiệu--quy-ước)
2. [Phân hệ A: Quản trị Vận hành Bất động sản (Owner & Staff Portal)](#phân-hệ-a-quản-trị-vận-hành-bất-động-sản)
   - [A1. Khai báo Tòa nhà, Tầng & Phòng](#a1-khai-báo-tòa-nhà-tầng--phòng)
   - [A2. Quản lý Khách hàng Tiềm năng (CRM Leads)](#a2-quản-lý-khách-hàng-tiềm-năng-crm-leads)
   - [A3. Lịch hẹn Xem phòng & Giữ chỗ (Tours & Applications)](#a3-lịch-hẹn-xem-phòng--giữ-chỗ-tours--applications)
   - [A4. Hợp đồng Thuê & Ký số Điện tử E-Sign](#a4-hợp-đồng-thuê--ký-số-điện-tử-e-sign)
   - [A5. Điện nước IoT, OCR & Lập Hóa đơn Tự động](#a5-điện-nước-iot-ocr--lập-hóa-đơn-tự-động)
   - [A6. Điều phối Sự cố & Đơn vị Cung ứng Dịch vụ](#a6-điều-phối-sự-cố--đơn-vị-cung-ứng-dịch-vụ)
   - [A7. Báo cáo Tài chính P&L & Dòng tiền Vận hành](#a7-báo-cáo-tài-chính-pl--dòng-tiền-vận-hành)
3. [Phân hệ B: Cổng Cư dân (Tenant Portal & PWA)](#phân-hệ-b-cổng-cư-dân-tenant-portal--pwa)
4. [Phân hệ C: Quản trị Hệ thống Đa Công ty (Super Admin Platform)](#phân-hệ-c-quản-trị-hệ-thống-đa-công-ty-super-admin-platform)
5. [Phân hệ D: Cổng Đối tác Cung cấp Dịch vụ (Provider Portal)](#phân-hệ-d-cổng-đối-tác-cung-cấp-dịch-vụ-provider-portal)
6. [Phân hệ E: Ma trận Phân quyền & Bảo mật Dữ liệu (RBAC & Privacy)](#phân-hệ-e-ma-trận-phân-quyền--bảo-mật-dữ-liệu-rbac--privacy)
7. [Phân hệ F: Kiểm thử Biên, Tải & Khả năng Phục hồi (Edge Cases & Resilience)](#phân-hệ-f-kiểm-thử-biên-tải--khả-năng-phục-hồi-edge-cases--resilience)
8. [Phân hệ G: Cô lập Dữ liệu Đa Khách thuê & Toàn vẹn Tài chính (Multi-Tenant & Financial Integrity)](#phân-hệ-g-cô-lập-dữ-liệu-đa-khách-thuê--toàn-vẹn-tài-chính)
9. [Nghiệp vụ thực tế chưa có API tương ứng trong Backend](#8-nghiệp-vụ-thực-tế-chưa-có-api-tương-ứng-trong-backend)
10. [Báo cáo Tổng kết Chạy Test Tự động (Pytest Execution Log)](#9-báo-cáo-tổng-kết-chạy-test-tự-động-pytest-execution-log)

---

## 1. Giới thiệu & Quy ước

Tài liệu này định nghĩa toàn bộ kịch bản kiểm thử nghiệp vụ cho hệ thống Homtel, phục vụ cả:
- **Kiểm thử viên thủ công / Chủ đầu tư**: Thao tác xác thực luồng nghiệp vụ trên giao diện người dùng Web/Mobile.
- **Kỹ sư phát triển phần mềm (QA/Dev)**: Đối soát 1:1 với mã kiểm thử tự động hóa bằng `pytest` trong thư mục `backend/tests/`.

### Quy ước Mức độ Ưu tiên:
- **Cao (High)**: Nghiệp vụ cốt lõi, bắt buộc phải chạy đúng. Bất kỳ lỗi nào ở mức này đều chặn việc bàn giao và vận hành thương mại. Toàn bộ test case mức này **100% có mã test tự động hóa** đi kèm.
- **Trung bình (Medium)**: Luồng nghiệp vụ phụ trợ hoặc các tính năng mở rộng năng suất.
- **Thấp (Low)**: Các định dạng phụ, kiểm tra hiển thị giao diện thứ cấp.

---

## Phân hệ A: Quản trị Vận hành Bất động sản

### A1. Khai báo Tòa nhà, Tầng & Phòng

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-BLD-01** | Tạo cây tài sản Tòa nhà -> Tầng -> Phòng | Owner / Staff | Đã đăng nhập tài khoản Owner/Staff hợp lệ | 1. Gọi `POST /api/v1/buildings` tạo tòa nhà mới.<br>2. Gọi `POST /api/v1/buildings/{id}/floors` tạo tầng 1.<br>3. Gọi `POST /api/v1/rooms` tạo phòng 101 thuộc tầng 1. | Trả về HTTP 201 Created cho cả 3 bước. Cấu trúc quan hệ Building -> Floor -> Room được liên kết chính xác, phòng có trạng thái `AVAILABLE`. | **Cao** | `test_buildings.py::test_tc_bld_01_create_building_floor_room` |
| **TC-BLD-02** | Chỉnh sửa thông tin Tòa nhà, Tầng, Phòng | Owner / Staff | Đã có sẵn tòa nhà, tầng, phòng trong hệ thống | 1. Gọi `PUT /api/v1/buildings/{id}` đổi tên và quận huyện.<br>2. Gọi `PUT /api/v1/floors/{id}` đổi tên tầng.<br>3. Gọi `PUT /api/v1/rooms/{id}` cập nhật giá thuê và diện tích. | Trả về HTTP 200 OK. Dữ liệu mới được cập nhật vào database và phản hồi đúng trong payload trả về (hỗ trợ cả camelCase và snake_case). | **Cao** | `test_buildings.py::test_tc_bld_02_edit_building_floor_room` |
| **TC-BLD-03** | Rào chắn xóa phòng (Room Deletion Guard) | Owner | Phòng đang có hợp đồng thuê trạng thái `ACTIVE` | 1. Tìm phòng đang có cư dân ở.<br>2. Gọi `DELETE /api/v1/rooms/{id}` để xóa phòng. | Bị từ chối với mã HTTP 400 Bad Request kèm thông báo: "Không thể xóa phòng đang có hợp đồng hoạt động". Phòng không bị xóa. | **Cao** | `test_buildings.py::test_tc_bld_03_delete_room_guards` |
| **TC-BLD-04** | Rào chắn xóa tầng (Floor Deletion Guard) | Owner | Tầng đang chứa ít nhất 1 phòng | 1. Chọn tầng đang có phòng bên trong.<br>2. Gọi `DELETE /api/v1/floors/{id}`. | Bị từ chối với mã HTTP 400 Bad Request kèm thông báo: "Không thể xóa tầng đang chứa phòng". | **Cao** | `test_buildings.py::test_tc_bld_04_delete_floor_guards` |
| **TC-BLD-05** | Rào chắn xóa tòa nhà (Building Deletion Guard) | Owner | Tòa nhà đang chứa tầng hoặc phòng | 1. Chọn tòa nhà đang chứa các tầng.<br>2. Gọi `DELETE /api/v1/buildings/{id}`. | Bị từ chối với mã HTTP 400 Bad Request kèm thông báo ràng buộc cấu trúc. Tòa nhà toàn vẹn. | **Cao** | `test_buildings.py::test_tc_bld_05_delete_building_guards` |
| **TC-BLD-06** | Chặn trùng lặp số tầng trong cùng tòa nhà | Owner / Staff | Tòa nhà đã có tầng số 1 | 1. Gọi `POST /api/v1/buildings/{id}/floors` với `floorNumber = 1`. | Bị từ chối với mã HTTP 400 Bad Request kèm thông báo tầng đã tồn tại trong tòa nhà. | **Cao** | `test_buildings.py::test_tc_bld_06_duplicate_floor_number_blocked` |
| **TC-BLD-07** | Quản lý cấu hình đơn giá dịch vụ & phiên bản (Versioning) | Owner / Admin | Tòa nhà đã được tạo | 1. Gọi `POST /api/v1/buildings/{id}/configurations` lưu bảng giá điện, nước, internet, rác.<br>2. Gọi tiếp lần 2 với đơn giá mới. | Trả về HTTP 201 Created. Hệ thống tự động tăng số phiên bản `version` (1 -> 2) để làm mốc tính hóa đơn theo từng mốc thời gian. | **Cao** | `test_buildings.py::test_tc_bld_07_building_config_versioning` |
| **TC-BLD-08** | Nhập danh sách phòng hàng loạt từ file Excel | Owner / Staff | Chuẩn bị file Excel chứa danh sách phòng (tòa nhà, số phòng, diện tích, giá) | 1. Tải template Excel mẫu từ hệ thống.<br>2. Đưa dữ liệu hợp lệ vào file và gọi `POST /api/v1/buildings/import-rooms`. | Trả về HTTP 200 OK. Toàn bộ phòng được tạo nguyên tử trong 1 transaction, tự động gắn vào đúng tầng tương ứng. | **Cao** | `test_buildings.py::test_tc_bld_08_building_excel_import_atomic` |

---

### A2. Quản lý Khách hàng Tiềm năng (CRM Leads)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-CRM-01** | Vòng đời Lead: Tiếp nhận -> Liên hệ -> Bàn giao | Owner / Staff | Khách hàng để lại thông tin quan tâm trên landing page | 1. Gọi `POST /api/v1/crm/leads` tạo lead mới (`NEW`).<br>2. Gọi `PATCH /api/v1/crm/leads/{id}` chuyển trạng thái sang `CONTACTED`.<br>3. Chuyển tiếp sang `QUALIFIED`. | Trả về HTTP 200/201. Lịch sử trạng thái và thông tin khách hàng tiềm năng được ghi nhận đầy đủ. | **Cao** | `test_crm_booking.py::test_tc_crm_01_lead_lifecycle` |
| **TC-CRM-05** | Chuyển đổi Lead thành Hồ sơ Đăng ký Thuê (Convert to Application) | Owner / Staff | Lead đã ở trạng thái `QUALIFIED` và ưng ý phòng cụ thể | 1. Gọi `POST /api/v1/crm/leads/{id}/convert-to-application` kèm `roomId`, ngày dự kiến vào ở. | Trả về HTTP 201 Created. Lead được đánh dấu `CONVERTED`, một bản ghi `RentalApplication` mới được tự động sinh ra. | **Cao** | `test_crm_booking.py::test_tc_crm_05_convert_lead_to_application` |

---

### A3. Lịch hẹn Xem phòng & Giữ chỗ (Tours & Applications)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-CRM-02** | Đặt lịch hẹn xem phòng (Schedule Tour) | Khách / Staff | Phòng đang trống `AVAILABLE` | 1. Gọi `POST /api/v1/crm/tours` chọn phòng, ngày giờ xem phòng, thông tin khách. | Trả về HTTP 201 Created. Bản ghi lịch hẹn lưu trạng thái `SCHEDULED`. Phòng vẫn giữ trạng thái `AVAILABLE` cho các khách khác xem. | **Cao** | `test_crm_booking.py::test_tc_crm_02_schedule_tour` |
| **TC-CRM-03** | Hoàn tất xem phòng & ghi nhận phản hồi | Staff | Lịch hẹn đang ở trạng thái `SCHEDULED` | 1. Gọi `POST /api/v1/crm/tours/{id}/complete` kèm đánh giá phản hồi của khách (ưng ý/chưa chốt). | Trả về HTTP 200 OK. Lịch hẹn cập nhật `COMPLETED`, lưu trữ phản hồi phục vụ chăm sóc tiếp theo. | **Cao** | `test_crm_booking.py::test_tc_crm_03_complete_tour_with_feedback` |
| **TC-CRM-04** | Hủy lịch hẹn xem phòng không ảnh hưởng trạng thái phòng | Khách / Staff | Lịch hẹn đang ở trạng thái `SCHEDULED` | 1. Gọi `POST /api/v1/crm/tours/{id}/cancel` kèm lý do hủy. | Trả về HTTP 200 OK. Lịch hẹn chuyển `CANCELLED`, trạng thái phòng vẫn là `AVAILABLE`. | **Cao** | `test_crm_booking.py::test_tc_crm_04_cancel_tour_room_status_unaffected` |
| **TC-APP-01** | Phê duyệt đơn thuê phòng -> Sinh hợp đồng nháp & chuyển phòng RESERVED | Owner / Staff | Khách nộp đơn đăng ký thuê phòng (`RentalApplication`) | 1. Quản lý duyệt đơn bằng `POST /api/v1/applications/{id}/review` với `action="APPROVE"`. | Trả về HTTP 200 OK. Đơn thuê chuyển `APPROVED`, phòng tự động chuyển sang trạng thái `RESERVED`, tự sinh hợp đồng thuê nháp (`DRAFT`). | **Cao** | `test_crm_booking.py::test_tc_app_01_approve_application_generates_draft_contract` |
| **TC-APP-02** | Từ chối đơn thuê phòng -> Giải phóng phòng về AVAILABLE | Owner / Staff | Đơn đăng ký thuê đang chờ duyệt | 1. Quản lý từ chối bằng `POST /api/v1/applications/{id}/review` với `action="REJECT"`. | Trả về HTTP 200 OK. Đơn thuê chuyển `REJECTED`, phòng duy trì hoặc trả về trạng thái `AVAILABLE` cho khách khác. | **Cao** | `test_crm_booking.py::test_tc_app_02_reject_application_room_remains_available` |

---

### A4. Hợp đồng Thuê & Ký số Điện tử E-Sign

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-CTR-01** | Tạo hợp đồng thuê trực tiếp (Direct Contract Creation) | Owner / Staff | Phòng đang `AVAILABLE`, có thông tin cư dân | 1. Gọi `POST /api/v1/contracts` cung cấp `roomId`, `tenantId`, đơn giá thuê, tiền cọc, ngày bắt đầu, ngày kết thúc. | Trả về HTTP 201 Created. Hợp đồng ở trạng thái `DRAFT` kèm mã hợp đồng duy nhất theo quy chuẩn (`HD-YYYYMM-...`). | **Cao** | `test_contracts.py::test_tc_ctr_01_create_direct_contract` |
| **TC-CTR-02** | Ký số điện tử bằng Canvas Drawing -> Kích hoạt hợp đồng & phòng OCCUPIED | Tenant | Hợp đồng đang `DRAFT` và cư dân đăng nhập tài khoản của mình | 1. Cư dân vẽ chữ ký trên canvas và gọi `POST /api/v1/contracts/{id}/sign` với `signingMethod="DRAW"`. | Trả về HTTP 200 OK. Hợp đồng chuyển sang `ACTIVE`, tự sinh mã hash chứng thư bảo mật SHA-256, phòng tự động chuyển sang `OCCUPIED`. | **Cao** | `test_contracts.py::test_tc_ctr_02_sign_contract_with_canvas_draw` |
| **TC-CTR-03** | Ký số xác thực bằng mã OTP | Tenant | Hợp đồng đang `DRAFT`, cư dân chọn xác thực OTP | 1. Gọi `POST /api/v1/contracts/{id}/send-otp` nhận OTP.<br>2. Gọi `POST /api/v1/contracts/{id}/sign` kèm mã OTP hợp lệ. | Trả về HTTP 200 OK. Xác thực thành công, hợp đồng kích hoạt `ACTIVE` hợp chuẩn pháp lý. | **Cao** | `test_contracts.py::test_tc_ctr_03_sign_contract_with_otp` |
| **TC-CTR-04** | Gia hạn hợp đồng định kỳ (Contract Renewal) | Owner / Staff | Hợp đồng đang `ACTIVE` sắp đến hạn kết thúc | 1. Quản lý gọi `POST /api/v1/contracts/{id}/renew` kèm ngày kết thúc mới và giá thuê mới. | Trả về HTTP 200 OK. Ngày kết thúc được gia hạn, điều khoản ghi nhận phụ lục gia hạn mới. | **Cao** | `test_contracts.py::test_tc_ctr_04_renew_contract_by_owner` |
| **TC-CTR-05** | Chặn cư dân tự ý gia hạn hợp đồng | Tenant | Cư dân có hợp đồng thuê đang active | 1. Cư dân tự gọi `POST /api/v1/contracts/{id}/renew`. | Bị từ chối với HTTP 403 Forbidden. Chỉ có Owner/Staff mới có thẩm quyền gia hạn hợp đồng. | **Cao** | `test_contracts.py::test_tc_ctr_05_renew_contract_forbidden_for_tenant` |
| **TC-CTR-06** | Chấm dứt hợp đồng bởi Owner -> Giải phóng phòng về AVAILABLE | Owner | Hợp đồng đang `ACTIVE` | 1. Gọi `POST /api/v1/contracts/{id}/terminate` kèm lý do kết thúc. | Trả về HTTP 200 OK. Hợp đồng chuyển `TERMINATED`, phòng ngay lập tức được giải phóng về `AVAILABLE` để đón khách mới. | **Cao** | `test_contracts.py::test_tc_ctr_06_terminate_contract_by_owner` |
| **TC-CTR-07** | Cư dân chủ động xin kết thúc hợp đồng thuê | Tenant | Cư dân đang có hợp đồng thuê active | 1. Cư dân gọi `POST /api/v1/contracts/{id}/terminate` với hợp đồng của chính mình. | Trả về HTTP 200 OK. Hợp đồng chuyển `TERMINATED`, phòng giải phóng về `AVAILABLE`. | **Cao** | `test_contracts.py::test_tc_ctr_07_terminate_contract_by_tenant_owner` |
| **TC-CTR-08** | Chặn cư dân khác chấm dứt hợp đồng không phải của mình | Tenant B | Hợp đồng thuộc về Tenant A | 1. Tenant B gọi `POST /api/v1/contracts/{id_cua_A}/terminate`. | Bị từ chối với HTTP 403 Forbidden ("Bạn không có quyền chấm dứt hợp đồng này"). | **Cao** | `test_contracts.py::test_tc_ctr_08_terminate_contract_forbidden_for_other_tenant` |
| **TC-CTR-09** | Toàn vẹn chứng thư số E-Sign & Bảo mật riêng tư | Tenant / Public | Hợp đồng đã được ký số | 1. Tenant sở hữu gọi `GET /api/v1/contracts/{id}/evidence` xem chứng thư.<br>2. Tenant lạ truy cập chứng thư của người khác. | Tenant sở hữu nhận chứng thư kèm dấu thời gian và hash SHA-256. Tenant lạ bị chặn ngay với HTTP 403 Forbidden. | **Cao** | `test_contracts.py::test_tc_ctr_09_evidence_certificate_tamper_and_privacy` |

---

### A5. Điện nước IoT, OCR & Lập Hóa đơn Tự động

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-BIL-01** | Nhận diện chỉ số công tơ bằng AI OCR Vision | Owner / Staff | Công tơ điện/nước đã được gán vào phòng | 1. Chụp ảnh mặt số công tơ.<br>2. Gọi `POST /api/v1/billing/meters/ocr-scan` gửi ảnh base64. | Trả về HTTP 200 OK kèm chỉ số bóc tách (`detectedReading`), độ tin cậy (`confidence > 0.8`) và cảnh báo bất thường nếu mức tiêu thụ tăng vọt >300%. | **Cao** | `test_billing.py::test_tc_bil_01_ocr_scan_meter` |
| **TC-BIL-02** | Chốt chỉ số công tơ thủ công (Manual Recording) | Staff | Nhân viên đi ghi số trực tiếp tại phòng | 1. Gọi `POST /api/v1/billing/meters/{id}/commit-ocr` với chỉ số mới và `ocrConfidence=None`. | Trả về HTTP 200 OK. Chỉ số mới được ghi đè, hệ thống tự động tính lượng tiêu thụ `consumption = mới - cũ`. | **Cao** | `test_billing.py::test_tc_bil_02_manual_meter_recording` |
| **TC-BIL-03** | Chặn ghi lùi chỉ số công tơ (Negative Consumption Guard) | Staff | Chỉ số hiện tại của công tơ là 100.0 | 1. Gọi chốt số với giá trị 80.0 (< 100.0). | Bị từ chối với HTTP 400 Bad Request kèm thông báo: "Chỉ số mới không thể nhỏ hơn chỉ số cũ". | **Cao** | `test_billing.py::test_tc_bil_03_meter_reading_backwards_rejected` |
| **TC-BIL-04** | Tự động sinh hóa đơn nháp khi chốt số điện nước | Staff | Phòng đang có hợp đồng hoạt động | 1. Gọi chốt số với tham số `autoDraftInvoice = True`. | Trả về HTTP 200 OK. Đồng thời tự sinh 1 hóa đơn nháp (`DRAFT`) gồm tiền thuê + tiền điện nước theo đúng đơn giá cấu hình. | **Cao** | `test_billing.py::test_tc_bil_04_auto_draft_invoice_on_reading` |
| **TC-BIL-05** | Sinh hóa đơn định kỳ hàng loạt đầu tháng (Idempotency) | Owner / Staff | Tòa nhà có nhiều hợp đồng đang active trong tháng | 1. Gọi `POST /api/v1/billing/invoices/generate-monthly` lần 1.<br>2. Gọi tiếp lần 2 với cùng kỳ hóa đơn. | Lần 1: Tạo đủ hóa đơn cho các phòng. Lần 2: Tính lũy kế idempotency, trả về 0 hóa đơn mới, tăng biến `invoices_skipped`, tuyệt đối không tạo trùng hóa đơn. | **Cao** | `test_billing.py::test_tc_bil_05_monthly_batch_invoicing_idempotent` |
| **TC-BIL-06** | Cách ly phạm vi sinh hóa đơn theo từng Tòa nhà | Owner / Staff | Có tòa nhà A và tòa nhà B cùng thuộc công ty | 1. Gọi sinh hóa đơn cho tòa nhà A kèm `buildingId`. | Hóa đơn chỉ được tạo cho các phòng thuộc tòa nhà A, không bị lẫn hợp đồng của tòa nhà B. | **Cao** | `test_billing.py::test_tc_bil_06_monthly_batch_invoicing_building_scoped` |
| **TC-BIL-07** | Ghi nhận thanh toán thủ công toàn phần (Full Payment) | Owner / Staff | Hóa đơn đang ở trạng thái `ISSUED` | 1. Cư dân thanh toán tiền mặt tại quầy.<br>2. Quản lý gọi `POST /api/v1/billing/payments` nhập đủ số tiền. | Trả về HTTP 201 Created. Hóa đơn chuyển trạng thái `PAID`, số nợ tồn `outstandingAmount = 0.0`. | **Cao** | `test_billing.py::test_tc_bil_07_manual_payment_full` |
| **TC-BIL-08** | Ghi nhận thanh toán từng phần (Partial Payment) | Owner / Staff | Hóa đơn tổng cộng 5.000.000 VND | 1. Cư dân trả trước 2.000.000 VND.<br>2. Quản lý gọi `POST /api/v1/billing/payments`. | Hóa đơn chuyển trạng thái `PARTIALLY_PAID`, nợ tồn cập nhật chính xác còn 3.000.000 VND. | **Cao** | `test_billing.py::test_tc_bil_08_manual_payment_partial` |
| **TC-BIL-09** | Cơ chế An toàn Feature Flag cổng thanh toán VietQR | Khách / Cư dân | `PAYMENT_GATEWAY_ENABLED = False` (chờ pháp nhân doanh nghiệp) | 1. Cư dân bấm lấy mã VietQR hoặc webhook ngân hàng bắn sang. | Trả về HTTP 503 Service Unavailable kèm thông điệp rõ ràng hướng dẫn cư dân chuyển khoản thủ công theo số tài khoản ban quản lý. | **Cao** | `test_billing.py::test_tc_bil_09_vietqr_endpoints_disabled_503` |
| **TC-BIL-10** | Nhập chỉ số công tơ hàng loạt từ file Excel | Staff | File Excel ghi chỉ số điện nước của toàn bộ các phòng trong tòa | 1. Upload file Excel qua `POST /api/v1/billing/meters/bulk-import`. | Trả về HTTP 200 OK. Toàn bộ chỉ số được cập nhật chính xác và tính tiêu thụ tự động. | **Cao** | `test_billing.py::test_tc_bil_10_meter_excel_bulk_import` |

---

### A6. Điều phối Sự cố & Đơn vị Cung ứng Dịch vụ

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-OPS-01** | Vòng đời Yêu cầu Dịch vụ: Cư dân gửi -> Quản lý tiếp nhận | Tenant -> Owner | Cư dân đang ở tại phòng gặp sự cố điều hòa/nước | 1. Cư dân chọn dịch vụ và gửi yêu cầu `POST /api/v1/service-requests`.<br>2. Quản lý xem danh sách tiếp nhận. | Trả về HTTP 201 Created. Quản lý tòa nhà và đơn vị cung ứng lập tức nhìn thấy yêu cầu với trạng thái `PENDING`. | **Cao** | `test_operations.py::test_tc_ops_01_service_request_lifecycle` |
| **TC-OPS-02** | Điều phối thợ kỹ thuật & Cập nhật tiến độ hoàn thành | Admin / Provider | Yêu cầu dịch vụ đang ở trạng thái `PENDING` | 1. Điều phối thợ qua `POST /service-requests/{id}/assign`.<br>2. Thợ nhận việc chuyển `IN_PROGRESS`.<br>3. Thợ hoàn thành chuyển `COMPLETED` kèm chi phí thực tế. | Trả về HTTP 200 OK cho từng bước chuyển đổi trạng thái, đồng bộ dữ liệu theo thời gian thực. | **Cao** | `test_operations.py::test_tc_ops_02_assign_and_update_work_order` |
| **TC-OPS-03** | Đánh giá chất lượng dịch vụ sau khi đóng Work Order | Tenant | Work Order đã hoàn thành `COMPLETED` | 1. Cư dân gửi đánh giá sao (1-5 sao) và nhận xét qua `POST /api/v1/reviews`. | Trả về HTTP 201 Created. Điểm đánh giá được cập nhật vào hồ sơ chất lượng của đơn vị cung ứng. | **Cao** | `test_operations.py::test_tc_ops_03_review_work_order` |
| **TC-OPS-04** | Bàn điều khiển Vận hành "Hôm nay" (Smart Cockpit Today) | Owner / Staff | Hệ thống đang vận hành có dữ liệu phòng, hợp đồng, hóa đơn | 1. Truy cập `GET /api/v1/operations/today`. | Trả về số liệu động: Việc cần xử lý khẩn cấp (`critical`), việc cần chú ý (`attention`), tỷ lệ lấp đầy, dòng tiền thu được trong ngày. | **Cao** | `test_operations.py::test_tc_ops_04_today_cockpit_dynamic_metrics` |

---

### A7. Báo cáo Tài chính P&L & Dòng tiền Vận hành

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-FIN-01** | Tính toán Báo cáo P&L Hợp nhất chính xác | Owner / Admin | Các tòa nhà đã phát sinh hóa đơn và chi phí vận hành | 1. Gọi `GET /api/v1/financial/pnl/consolidated`. | Tổng doanh thu và chi phí danh mục (portfolio) bằng đúng tổng số liệu từng tòa nhà thành viên cộng lại (`sum(buildings) == portfolio`). | **Cao** | `test_operations.py::test_tc_fin_01_consolidated_pnl_calculation` |
| **TC-FIN-02** | Cách ly báo cáo tài chính theo Công ty (Company Scoping) | Owner | Hệ thống có nhiều công ty bất động sản khác nhau | 1. Owner của công ty A xem báo cáo P&L. | Tuyệt đối không xuất hiện bất kỳ tòa nhà hay dòng doanh thu nào của công ty B. | **Cao** | `test_operations.py::test_tc_fin_02_pnl_company_scoping` |

---

## Phân hệ B: Cổng Cư dân (Tenant Portal & PWA)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-TNT-01** | Cách ly riêng tư dữ liệu cá nhân giữa các Cư dân | Tenant B | Tenant A đang có hợp đồng, hóa đơn và phòng đang ở | 1. Tenant B đăng nhập tài khoản của mình.<br>2. Cố tình gọi API lấy chi tiết hợp đồng, hóa đơn hoặc chứng thư ký số của Tenant A. | Hệ thống từ chối với HTTP 403 Forbidden hoặc 404 Not Found. Không làm lộ bất kỳ dữ liệu cá nhân nào của Tenant A. | **Cao** | `test_rbac_security.py::test_tc_tnt_01_tenant_cross_privacy_isolation` |
| **TC-TNT-02** | Xem và đánh dấu đã đọc thông báo In-App Cư dân | Tenant | Ban quản lý gửi thông báo nhắc nợ hoặc thông báo vận hành | 1. Cư dân gọi `GET /api/v1/notifications` xem danh sách thông báo.<br>2. Gọi `POST /api/v1/notifications/read-all` để đánh dấu đã đọc. | Trả về HTTP 200 OK, số lượng chưa đọc `unreadCount` tự động về 0. | **Cao** | `test_rbac_security.py::test_tc_tnt_02_tenant_notifications` |

---

## Phân hệ C: Quản trị Hệ thống Đa Công ty (Super Admin Platform)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-ADM-01** | Thống kê Tổng quan Toàn nền tảng (Platform Dashboard) | Super Admin | Hệ thống đã có nhiều công ty, tòa nhà, người dùng | 1. Gọi `GET /api/v1/admin/stats`. | Trả về tổng số người dùng, tổng công ty, tổng số tòa nhà và phòng đang vận hành trên toàn bộ nền tảng. | **Cao** | `test_operations.py::test_tc_adm_01_super_admin_stats` |
| **TC-ADM-02** | Khởi tạo Khách hàng Doanh nghiệp (Owner) & Nhà cung cấp (Provider) | Super Admin | Nhận được yêu cầu mở tài khoản từ đối tác | 1. Gọi `POST /api/v1/admin/owners` khởi tạo Owner + Công ty.<br>2. Gọi `POST /api/v1/admin/providers` khởi tạo Provider. | Trả về HTTP 201 Created. Tài khoản người dùng và công ty tương ứng được liên kết thành công ở trạng thái `ACTIVE`. | **Cao** | `test_operations.py::test_tc_adm_02_super_admin_create_owner_and_provider` |
| **TC-ADM-03** | Đặc quyền Truy cập Toàn cầu của Super Admin (Cross-Company Access) | Super Admin | Đăng nhập bằng tài khoản Super Admin | 1. Gọi xem danh sách tất cả các công ty `GET /api/v1/admin/companies`.<br>2. Xem báo cáo tài chính hợp nhất không bị giới hạn bởi `company_id`. | Trả về đầy đủ dữ liệu của tất cả các công ty trực thuộc nền tảng mà không bị chặn phân quyền. | **Cao** | `test_operations.py::test_tc_adm_03_super_admin_cross_company_access` |

---

## Phân hệ D: Cổng Đối tác Cung cấp Dịch vụ (Provider Portal)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-PRV-01** | Đăng ký Dịch vụ Tiện ích vào Danh mục (Catalog Management) | Provider | Đăng nhập tài khoản Đối tác dịch vụ | 1. Gọi `POST /api/v1/services` khai báo dịch vụ mới (vệ sinh, giặt là, sửa chữa) kèm bảng giá. | Trả về HTTP 201 Created. Dịch vụ hiển thị công khai trên ứng dụng cho cư dân lựa chọn. | **Cao** | `test_rbac_security.py::test_tc_sec_01_rbac_across_all_10_modules` |
| **TC-PRV-02** | Xem và cập nhật trạng thái đơn công việc được giao | Provider | Được điều phối xử lý một yêu cầu dịch vụ | 1. Nhận thông báo việc mới.<br>2. Cập nhật trạng thái thi công sang `IN_PROGRESS` và `COMPLETED`. | Trả về HTTP 200 OK. Cư dân và ban quản lý nhìn thấy trạng thái thời gian thực của công việc. | **Cao** | `test_operations.py::test_tc_ops_02_assign_and_update_work_order` |

---

## Phân hệ E: Ma trận Phân quyền & Bảo mật Dữ liệu (RBAC & Privacy)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-SEC-01** | Kiểm tra Ma trận Phân quyền RBAC trên 10 Phân hệ chính | Tenant | Đăng nhập tài khoản vai trò TENANT | 1. Thử gọi các endpoint quản trị: tạo tòa nhà, tạo tầng, tạo phòng, tạo hợp đồng, chốt số công tơ, sinh hóa đơn, xem PnL tài chính, quản trị công ty. | 100% các endpoint quản trị đều từ chối yêu cầu và trả về đúng mã HTTP 403 Forbidden. | **Cao** | `test_rbac_security.py::test_tc_sec_01_rbac_across_all_10_modules` |
| **TC-SEC-02** | Cơ chế Che giấu Thông tin Nhạy cảm (PII & Data Masking) | Khách / Cư dân | Xem thông tin chi tiết tòa nhà Cockpit 360 | 1. Người lạ / Provider xem: Không xem được thông tin tầng phòng cá nhân.<br>2. Cư dân khác xem: Số điện thoại, email của phòng khác bị ẩn hoàn toàn (`null` / masked).<br>3. Chỉ Owner/Staff mới thấy thông tin đầy đủ. | Trả về HTTP 200 OK nhưng dữ liệu nhạy cảm được che chắn triệt để theo đúng vai trò người gọi. | **Cao** | `test_rbac_security.py::test_tc_sec_02_building_360_data_masking` |
| **TC-SEC-03** | Xác thực Chữ ký Bí mật Webhook Ngân hàng (X-Webhook-Secret) | Webhook Client | Cổng thanh toán VietQR gửi biến động số dư | 1. Gửi webhook không kèm header `X-Webhook-Secret`.<br>2. Gửi webhook với secret giả mạo. | Bị từ chối với mã HTTP 401 Unauthorized, ngăn chặn hoàn toàn việc giả mạo giao dịch tài chính. | **Cao** | `test_rbac_security.py::test_tc_sec_03_vietqr_webhook_secret_auth` |
| **TC-SEC-04** | Chống Dò quét Tài khoản Đăng nhập (Anti-Account Enumeration) | Unauthenticated | Kẻ tấn công thử dò danh sách email người dùng | 1. Đăng nhập với email không tồn tại trong hệ thống.<br>2. Đăng nhập với email có thật nhưng sai mật khẩu. | Cả 2 trường hợp đều trả về cùng mã HTTP 401 và cùng thông điệp lỗi: `"INVALID_CREDENTIALS: Email hoặc mật khẩu không chính xác"`. Kẻ tấn công không thể phân biệt email có tồn tại hay không. | **Cao** | `test_rbac_security.py::test_tc_sec_04_login_security_anti_enumeration` |
| **TC-SEC-05** | Chặn Token Giả mạo, Can thiệp Payload hoặc Thiếu Định dạng | Unauthenticated | Sử dụng chuỗi Bearer token giả mạo | 1. Gửi token bị chỉnh sửa signature.<br>2. Gửi chuỗi ngẫu nhiên không phải JWT.<br>3. Gửi thiếu tiền tố `Bearer`. | Hệ thống từ chối ngay lập tức với mã HTTP 401 Unauthorized. | **Cao** | `test_rbac_security.py::test_tc_sec_05_token_tamper_and_expiration` |

---

## Phân hệ F: Kiểm thử Biên, Tải & Khả năng Phục hồi (Edge Cases & Resilience)

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-EDG-01** | Chặn gia hạn hợp đồng có ngày kết thúc vô lý | Owner | Hợp đồng bắt đầu từ ngày 01/06/2026 | 1. Gọi gia hạn hợp đồng với ngày kết thúc là 01/05/2026 (trước ngày bắt đầu). | Bị từ chối với HTTP 400 Bad Request kèm thông báo lỗi logic: "Ngày kết thúc gia hạn phải lớn hơn ngày bắt đầu hợp đồng". | **Cao** | `test_edge_cases.py::test_tc_edg_01_renew_end_date_before_start_date` |
| **TC-EDG-02** | Kiểm tra tính hợp lệ dữ liệu diện tích và giá thuê (Positive Numbers) | Owner | Khởi tạo phòng mới | 1. Nhập diện tích âm (`-15 m2`) hoặc bằng 0.<br>2. Nhập giá thuê âm (`-5.000.000 VND`). | Bị từ chối với HTTP 422 Unprocessable Entity, không cho phép lưu dữ liệu sai lệch vào hệ thống. | **Cao** | `test_edge_cases.py::test_tc_edg_02_negative_room_price_and_area_validation` |
| **TC-EDG-03** | Truy vấn thực thể không tồn tại trả về chuẩn JSON 404 | Owner | Sử dụng ID ngẫu nhiên không có trong cơ sở dữ liệu | 1. Gọi GET chi tiết tòa nhà, phòng, hợp đồng, hóa đơn với ID giả mạo. | Trả về mã HTTP 404 chuẩn với định dạng `application/json`, tuyệt đối không gây sập ứng dụng hoặc trả về plaintext 500. | **Cao** | `test_edge_cases.py::test_tc_edg_03_non_existent_entity_returns_404` |
| **TC-EDG-04** | Rollback nguyên tử khi nhập file Excel có dòng lỗi (Atomic Rollback) | Staff | File Excel có dòng 1 hợp lệ, dòng 2 chứa ký tự sai định dạng thay vì số | 1. Gọi API upload file Excel ghi chỉ số công tơ. | Trả về HTTP 422 Unprocessable Entity kèm số dòng bị lỗi. Toàn bộ transaction được rollback, dòng 1 không bị lưu một nửa vào database. | **Cao** | `test_edge_cases.py::test_tc_edg_04_excel_import_atomic_rollback_on_bad_row` |
| **TC-EDG-05** | Xử lý Ký hợp đồng Đồng thời (Concurrent E-Signing Conflict) | Tenant | Hợp đồng đang ở trạng thái `DRAFT` | 1. Gửi 2 request ký hợp đồng gần như cùng 1 thời điểm. | Request đầu tiên thành công (HTTP 200) chuyển hợp đồng thành `ACTIVE`. Request thứ hai bị chặn và trả về HTTP 409 Conflict với mã `ALREADY_ACTIVE`. | **Cao** | `test_edge_cases.py::test_tc_edg_05_concurrent_contract_signing` |

---

## Phân hệ G: Cô lập Dữ liệu Đa Khách thuê & Toàn vẹn Tài chính (Multi-Tenant & Financial Integrity)

Phân hệ này kiểm định nghiêm ngặt tính độc lập dữ liệu tuyệt đối giữa các đơn vị vận hành (Công ty A vs Công ty B), bảo vệ chống rò rỉ PII, chống tấn công thao tác chéo tòa nhà/phòng/hợp đồng/hóa đơn, và đảm bảo tính toàn vẹn số học tài chính ở tầng cơ sở dữ liệu.

| Mã TC | Nghiệp vụ / Module | Vai trò | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Mức độ | Automated Test Function |
|---|---|---|---|---|---|---|---|
| **TC-SEC-MT-01** | Cô lập Tòa nhà & Phòng giữa các Công ty | Owner A vs Owner B | Đã khởi tạo 2 công ty độc lập (Company A & Company B) với tài khoản Owner tương ứng | 1. Owner B tạo tòa nhà B và phòng B-101.<br>2. Owner A gửi request PATCH sửa tên Tòa nhà B.<br>3. Owner A gửi request thêm cấu hình giá điện cho Tòa nhà B.<br>4. Owner A gửi request tạo phòng mới bên trong Tòa nhà B.<br>5. Owner A gửi request sửa/xóa phòng B-101. | Toàn bộ 5 hành vi tấn công can thiệp chéo công ty đều bị chặn với mã HTTP 403 Forbidden. Dữ liệu của Công ty B được bảo vệ tuyệt đối. | **Cao** | `test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **TC-SEC-MT-02** | Cô lập Hợp đồng & Ký số Điện tử Chéo Công ty | Owner A & Tenant A vs Owner B & Tenant B | Công ty B đã có phòng B-201 và hợp đồng ký với Tenant B | 1. Owner A gửi request đọc hợp đồng của Công ty B.<br>2. Tenant A gửi request đọc hợp đồng của Tenant B.<br>3. Tenant A gửi request xin mã OTP để ký hợp đồng B.<br>4. Tenant A gửi chữ ký điện tử để kích hoạt hợp đồng B.<br>5. Owner A gửi request gia hạn hợp đồng B. | Cả 5 bước tấn công can thiệp và đánh cắp hợp đồng đều trả về HTTP 403 Forbidden. Quy trình ký số điện tử bảo vệ nguyên vẹn. | **Cao** | `test_multitenant_isolation.py::test_cross_company_contract_and_signing_isolation` |
| **TC-SEC-MT-03** | Bảo vệ Hóa đơn & Kênh Thanh toán VietQR Liên Công ty | Owner A & Tenant A vs Company B | Đã tạo hóa đơn định kỳ cho phòng thuộc Công ty B | 1. Owner A gọi endpoint sinh mã VietQR của hóa đơn Công ty B.<br>2. Owner A gửi lệnh ghi nhận thanh toán tiền mặt cho hóa đơn B.<br>3. Tenant A gửi lệnh thanh toán cho hóa đơn của cư dân B. | Toàn bộ các yêu cầu từ phía Công ty A đều bị từ chối với HTTP 403 Forbidden. Không thể can thiệp số dư hay gạch nợ chéo. | **Cao** | `test_multitenant_isolation.py::test_cross_company_invoice_and_financial_isolation` |
| **TC-SEC-MT-04** | Toàn vẹn Tài chính: Chống Bội chi & Chặn Thanh toán Âm | Owner B & Tenant B | Có hóa đơn nợ 5,000,000 VNĐ | 1. Gửi request thanh toán số tiền âm (-500,000 VNĐ).<br>2. Gửi request thanh toán vượt dư nợ (99,999,999 VNĐ).<br>3. Thanh toán một phần (2,000,000 VNĐ).<br>4. Thanh toán nốt số dư còn lại (3,000,000 VNĐ).<br>5. Chạy lại tiến trình tạo hóa đơn định kỳ của tháng. | 1. Bị chặn với HTTP 400 (`INVALID_AMOUNT`).<br>2. Bị chặn với HTTP 400 (`OVERPAYMENT_NOT_ALLOWED`).<br>3. Thành công 201 Created, dư nợ giảm chính xác còn 3,000,000 VNĐ (trạng thái `PARTIALLY_PAID`).<br>4. Thành công 201 Created, dư nợ về 0.00 VNĐ (trạng thái `PAID`).<br>5. Ràng buộc duy nhất `uq_invoice_contract_period` bỏ qua và không tạo trùng hóa đơn (`invoices_created: 0`). | **Cao** | `test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **TC-SEC-MT-05** | Cô lập Khách hàng CRM & Bảng Tổng quan 360 Độ | Owner A vs Owner B | Công ty B có khách hàng tiềm năng và phòng 360 | 1. Owner A tìm cách xem chi tiết khách hàng của Công ty B.<br>2. Owner A tìm cách cập nhật thông tin khách hàng B.<br>3. Owner A xem tổng quan 360 tòa nhà của Công ty B.<br>4. Owner A & Tenant A xem tổng quan 360 phòng của Công ty B. | Tất cả trả về HTTP 403 Forbidden. Thông tin liên hệ, ngân sách và lịch sử của khách hàng không bị rò rỉ cho đối thủ cạnh tranh. | **Cao** | `test_multitenant_isolation.py::test_crm_and_operations_cross_company_isolation` |
| **TC-SEC-MT-06** | Cô lập Đơn vị Dịch vụ & Rào chắn Phân công Kỹ thuật viên | Provider A & B, Tenant A & B | Provider B có dịch vụ; Staff A thuộc công ty A, Staff B thuộc công ty B | 1. Provider A cố xem đơn dịch vụ của Provider B.<br>2. Provider A cố duyệt/báo giá đơn của Provider B.<br>3. Provider B phân công Staff A (người không thuộc công ty B).<br>4. Provider B phân công Staff B (chính chủ).<br>5. Tenant A (người lạ) cố tình gửi đánh giá sao cho đơn của Tenant B. | 1-2. Bị chặn HTTP 403.<br>3. Bị chặn với HTTP 400 (`INVALID_STAFF_ASSIGNMENT`).<br>4. Thành công 201 Created.<br>5. Bị chặn HTTP 403 Forbidden do không phải cư dân tạo đơn. | **Cao** | `test_multitenant_isolation.py::test_services_and_staff_assignment_isolation` |

---

## 9. Nghiệp vụ thực tế chưa có API tương ứng trong Backend

Trong quá trình rà soát toàn diện giữa nghiệp vụ thực tế quản trị bất động sản cho thuê và mã nguồn hiện tại của backend Homtel, dưới đây là danh sách các nghiệp vụ thực tế **chưa có endpoint API tương ứng** (hoặc đang tạm tắt chờ pháp nhân doanh nghiệp). Cần đưa vào kế hoạch phát triển Phase 2:

1. **Mời nhân viên (Staff) vào công ty qua email/link mời**:
   - *Hiện trạng*: Trong backend hiện chỉ hỗ trợ Super Admin tạo tài khoản Owner/Provider (`POST /admin/owners`, `POST /admin/providers`), hoặc người dùng tự đăng ký vai trò Tenant (`POST /auth/register`). Chưa có endpoint `POST /companies/{id}/members/invite` hoặc `POST /admin/staff` để Chủ tòa nhà gửi link mời hoặc tạo trực tiếp nhân viên vận hành (Staff). Nhân viên hiện tại chỉ được nạp qua dữ liệu mẫu database (`seed.py`).
   - *Đề xuất Phase 2*: Bổ sung endpoint `POST /companies/{company_id}/invitations` cho phép Owner mời quản lý tòa nhà, kế toán, kỹ thuật viên kèm vai trò cụ thể.

2. **Cổng thanh toán tự động VietQR (SePay / Casso / PayOS)**:
   - *Hiện trạng*: Code xử lý biến động số dư và webhook đã có sẵn (`POST /api/v1/billing/invoices/webhook/vietqr`), nhưng đang được bảo vệ bởi cờ cấu hình `PAYMENT_GATEWAY_ENABLED = False` (trả về 503). Nguyên nhân do cần pháp nhân doanh nghiệp để ký hợp đồng chính thức với nhà cung cấp cổng thanh toán ngân hàng.
   - *Đề xuất Phase 2*: Sau khi hoàn tất đăng ký kinh doanh, bật cờ `PAYMENT_GATEWAY_ENABLED = True` và cấu hình webhook secret thật trên cổng ngân hàng.

3. **Gửi tin nhắn thông báo thương hiệu Zalo ZNS / SMS Brandname**:
   - *Hiện trạng*: Endpoint `POST /api/v1/notifications/send-zalo` đã có sẵn khung gọi Zalo OA nhưng được khóa bởi cờ `ZALO_ENABLED = False` (trả về 503), do yêu cầu giấy phép kinh doanh để xác minh Zalo Official Account cấp 3 (Doanh nghiệp).
   - *Đề xuất Phase 2*: Tích hợp Zalo Cloud API với App ID và Secret thật khi hoàn tất thủ tục pháp lý.

4. **Nghiệp vụ Trả phòng, Hoàn cọc & Bàn giao tài sản (Check-out & Deposit Refund)**:
   - *Hiện trạng*: Hiện tại hệ thống hỗ trợ Chấm dứt hợp đồng (`POST /contracts/{id}/terminate`) và tự động giải phóng phòng về `AVAILABLE`. Tuy nhiên, chưa có API chuyên biệt cho biên bản nghiệm thu hao mòn thiết bị (Inventory Checklist Check-out) và phiếu khấu trừ tiền cọc/hoàn tiền cọc cho cư dân.
   - *Đề xuất Phase 2*: Bổ sung model `CheckOutInspection` và endpoint `POST /contracts/{id}/settlement` tính toán hoàn cọc sau khi trừ tiền điện nước tồn đọng và hư hao tài sản.

5. **Xuất hóa đơn điện tử VAT (e-Invoice integration)**:
   - *Hiện trạng*: Hệ thống quản lý hóa đơn nội bộ Homtel (`Invoice`), chưa kết nối trực tiếp với các nhà cung cấp hóa đơn điện tử có mã của cơ quan thuế (như VNPT Invoice, Viettel S-Invoice, MISA meInvoice).

---

## 10. Báo cáo Tổng kết Chạy Test Tự động (Pytest Execution Log)

Toàn bộ 79 bài kiểm thử tự động trên nền tảng backend Homtel đã được thực thi trực tiếp trên cơ sở dữ liệu PostgreSQL thực tế:

```text
============================= test session starts =============================
platform win32 -- Python 3.14.5, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\workspace\homtel\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=function, asyncio_default_test_loop_scope=function
collected 79 items

tests\test_api.py ..........                                             [ 12%]
tests\test_billing.py ..........                                         [ 25%]
tests\test_buildings.py ........                                         [ 35%]
tests\test_contracts.py .........                                        [ 46%]
tests\test_crm_booking.py .......                                        [ 55%]
tests\test_edge_cases.py .....                                           [ 62%]
tests\test_multitenant_isolation.py ......                               [ 69%]
tests\test_operational_and_resilience.py ...                             [ 73%]
tests\test_operations.py .........                                       [ 84%]
tests\test_phase1_core.py .....                                          [ 91%]
tests\test_rbac_security.py .......                                      [100%]

======================= 79 passed in 128.71s (0:02:08) ========================
```

### Bảng Đối soát Số lượng Test Case (1:1 Verification):
| Module / Phân hệ | Số lượng TC Mức Cao trong TEST_PLAN.md | File Test Tự động Tương ứng | Số bài test tự động chạy Passed |
|---|---|---|---|
| **A1. Tòa nhà, Tầng, Phòng** | 8 | `backend/tests/test_buildings.py` | 8 / 8 (100%) |
| **A2 & A3. CRM, Leads & Đơn thuê** | 7 | `backend/tests/test_crm_booking.py` | 7 / 7 (100%) |
| **A4. Hợp đồng & Ký số E-Sign** | 9 | `backend/tests/test_contracts.py` | 9 / 9 (100%) |
| **A5. Điện nước & Hóa đơn tự động** | 10 | `backend/tests/test_billing.py` | 10 / 10 (100%) |
| **A6, A7, C, D. Vận hành, Tài chính, Admin** | 9 | `backend/tests/test_operations.py` | 9 / 9 (100%) |
| **E, B. Phân quyền RBAC & Bảo mật cư dân** | 7 | `backend/tests/test_rbac_security.py` | 7 / 7 (100%) |
| **F. Ca biên, Tải & Khả năng phục hồi** | 5 | `backend/tests/test_edge_cases.py` | 5 / 5 (100%) |
| **G. Cô lập Đa Khách thuê & Toàn vẹn Tài chính** | 6 | `backend/tests/test_multitenant_isolation.py` | 6 / 6 (100%) |
| **Hệ thống lõi & Regression tiền định** | 18 | `test_api.py`, `test_operational_and_resilience.py`, `test_phase1_core.py` | 18 / 18 (100%) |
| **TỔNG CỘNG** | **61 (Mức Cao)** + 18 (Regression) | **11 files** | **79 / 79 PASSED (100%)** |
