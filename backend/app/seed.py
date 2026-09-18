import asyncio
import uuid
import json
from datetime import datetime, date, timedelta, timezone

from app.core.database import engine, AsyncSessionLocal, Base
from app.core.security import hash_password
from app.modules.auth.models import User, Company, CompanyMembership
from app.modules.properties.models import Building, Floor, Room, BuildingConfiguration
from app.modules.billing.models import Meter, MeterReading, Invoice, InvoiceItem, Payment
from app.modules.rentals.models import RentalApplication, RentalContract, ContractESignature
from app.modules.services.models import Service, ServiceRequest, ServiceAssignment, ProviderReview
from app.modules.crm.models import Lead, Tour
from app.modules.finance.models import BuildingExpense
from app.modules.notifications.models import Notification, PushSubscription, AuditLog


async def seed_database():
    print("Initializing tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import select
        existing_users = await session.execute(select(User))
        if existing_users.scalars().first():
            print("Database already contains data, skipping initial seed.")
            return

        print("Seeding initial data...")

        # 1. Companies
        comp_homtel = Company(
            id="comp_homtel",
            name="Homtel Property Group",
            type="OWNER_OPERATOR",
            tax_code="0401928374",
            phone="0905123456",
            email="contact@homtel.vn",
            address="123 Tran Phu, Hai Chau, Da Nang",
            status="ACTIVE"
        )
        comp_services = Company(
            id="comp_services",
            name="Danang Smart Facility Solutions",
            type="SERVICE_PARTNER",
            tax_code="0408899123",
            phone="0905987654",
            email="support@danangsmart.vn",
            address="88 Nguyen Thi Minh Khai, Hai Chau, Da Nang",
            status="ACTIVE"
        )
        session.add_all([comp_homtel, comp_services])
        await session.flush()

        # 2. Users for all 5 roles
        admin_user = User(
            id="usr_admin",
            email="admin@homtel.vn",
            password_hash=hash_password("Admin@123"),
            full_name="Nguyễn Văn Quản Trị",
            phone="0905000001",
            role="SUPER_ADMIN",
            status="ACTIVE"
        )
        owner_user = User(
            id="usr_owner",
            email="owner@homtel.vn",
            password_hash=hash_password("Owner@123"),
            full_name="Trần Thị Chủ Nhà",
            phone="0905000002",
            role="OWNER",
            status="ACTIVE"
        )
        staff_user = User(
            id="usr_staff",
            email="staff@homtel.vn",
            password_hash=hash_password("Staff@123"),
            full_name="Lê Văn Kỹ Thuật",
            phone="0905000003",
            role="STAFF",
            status="ACTIVE"
        )
        provider_user = User(
            id="usr_provider",
            email="provider@homtel.vn",
            password_hash=hash_password("Provider@123"),
            full_name="Phạm Minh Đối Tác",
            phone="0905000004",
            role="PROVIDER",
            status="ACTIVE"
        )
        tenant_user = User(
            id="usr_tenant",
            email="tenant@homtel.vn",
            password_hash=hash_password("Tenant@123"),
            full_name="Hoàng Anh Cư Dân",
            phone="0905000005",
            role="TENANT",
            status="ACTIVE"
        )
        session.add_all([admin_user, owner_user, staff_user, provider_user, tenant_user])
        await session.flush()

        # 3. Memberships
        m_admin = CompanyMembership(user_id=admin_user.id, company_id=comp_homtel.id, role="SUPER_ADMIN", status="ACTIVE")
        m_owner = CompanyMembership(user_id=owner_user.id, company_id=comp_homtel.id, role="OWNER", status="ACTIVE")
        m_staff = CompanyMembership(user_id=staff_user.id, company_id=comp_homtel.id, role="STAFF", status="ACTIVE")
        m_provider = CompanyMembership(user_id=provider_user.id, company_id=comp_services.id, role="PROVIDER_ADMIN", status="ACTIVE")
        m_staff_prov = CompanyMembership(user_id=staff_user.id, company_id=comp_services.id, role="STAFF", status="ACTIVE")
        session.add_all([m_admin, m_owner, m_staff, m_provider, m_staff_prov])

        # 4. Buildings
        bld1 = Building(
            id="bld_riverside",
            company_id=comp_homtel.id,
            name="Homtel Riverside Central",
            slug="homtel-riverside-central",
            description="Tòa nhà căn hộ dịch vụ cao cấp ven sông Hàn, Đà Nẵng với đầy đủ tiện ích thông minh, an ninh 24/7.",
            address="123 Tran Phu, Hai Chau, Da Nang",
            city="Da Nang",
            district="Hai Chau",
            ward="Thach Thang",
            latitude=16.0748,
            longitude=108.2235,
            image_url="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80",
            status="ACTIVE"
        )
        bld2 = Building(
            id="bld_oceanview",
            company_id=comp_homtel.id,
            name="Homtel Ocean View Beachfront",
            slug="homtel-ocean-view",
            description="Căn hộ nghỉ dưỡng biển Mỹ Khê, view trọn đại dương, phong cách Japandi tối giản hiện đại.",
            address="456 Vo Nguyen Giap, Son Tra, Da Nang",
            city="Da Nang",
            district="Son Tra",
            ward="Phuoc My",
            latitude=16.0624,
            longitude=108.2468,
            image_url="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80",
            status="ACTIVE"
        )
        session.add_all([bld1, bld2])
        await session.flush()

        # 5. Configurations
        cfg1 = BuildingConfiguration(
            id="cfg_riverside_v1",
            building_id=bld1.id,
            version=1,
            effective_from=date(2025, 1, 1),
            electricity_unit_price=3500,
            water_unit_price=15000,
            internet_price=100000,
            garbage_price=50000,
            parking_fee_motorbike=100000,
            parking_fee_car=800000,
            cleaning_fee=150000,
            notes="Cấu hình biểu phí vận hành tiêu chuẩn 2025"
        )
        cfg2 = BuildingConfiguration(
            id="cfg_oceanview_v1",
            building_id=bld2.id,
            version=1,
            effective_from=date(2025, 1, 1),
            electricity_unit_price=3800,
            water_unit_price=16000,
            internet_price=120000,
            garbage_price=60000,
            parking_fee_motorbike=120000,
            parking_fee_car=1000000,
            cleaning_fee=200000,
            notes="Cấu hình biểu phí khu nghỉ dưỡng ven biển"
        )
        session.add_all([cfg1, cfg2])

        # 6. Floors
        flr1 = Floor(id="flr_r1", building_id=bld1.id, floor_number=1, name="Tầng 1 - Sảnh & Studio")
        flr2 = Floor(id="flr_r2", building_id=bld1.id, floor_number=2, name="Tầng 2 - Căn hộ 1PN")
        flr3 = Floor(id="flr_r3", building_id=bld1.id, floor_number=3, name="Tầng 3 - Căn hộ 2PN View Sông")
        session.add_all([flr1, flr2, flr3])
        await session.flush()

        # 7. Rooms
        common_amenities = ["Wifi 6 Tốc độ cao", "Khóa thông minh vân tay", "Điều hòa Inverter", "Bếp từ âm", "Máy giặt riêng", "Ban công thoáng"]
        common_images = [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80"
        ]

        r101 = Room(
            id="rom_101",
            company_id=comp_homtel.id,
            building_id=bld1.id,
            floor_id=flr1.id,
            room_number="101",
            slug="phong-101-riverside-studio",
            room_type="STUDIO",
            area=35.0,
            base_rent=6500000.0,
            capacity=2,
            status="OCCUPIED",
            furnishing="FULLY_FURNISHED",
            description="Studio hiện đại tầng 1, ban công đón nắng sớm, đầy đủ nội thất cao cấp.",
            amenities=common_amenities,
            images=common_images
        )
        r102 = Room(
            id="rom_102",
            company_id=comp_homtel.id,
            building_id=bld1.id,
            floor_id=flr1.id,
            room_number="102",
            slug="phong-102-riverside-studio",
            room_type="STUDIO",
            area=32.0,
            base_rent=6000000.0,
            capacity=2,
            status="AVAILABLE",
            furnishing="FULLY_FURNISHED",
            description="Studio ấm cúng, thiết kế thông minh, sẵn sàng dọn vào ở ngay.",
            amenities=common_amenities,
            images=common_images
        )
        r201 = Room(
            id="rom_201",
            company_id=comp_homtel.id,
            building_id=bld1.id,
            floor_id=flr2.id,
            room_number="201",
            slug="phong-201-riverside-1pn",
            room_type="ONE_BEDROOM",
            area=48.0,
            base_rent=8500000.0,
            capacity=2,
            status="AVAILABLE",
            furnishing="FULLY_FURNISHED",
            description="Căn hộ 1 phòng ngủ tách biệt, phòng khách rộng rãi, tầm nhìn sông Hàn.",
            amenities=common_amenities,
            images=common_images
        )
        r301 = Room(
            id="rom_301",
            company_id=comp_homtel.id,
            building_id=bld1.id,
            floor_id=flr3.id,
            room_number="301",
            slug="phong-301-riverside-2pn",
            room_type="TWO_BEDROOM",
            area=72.0,
            base_rent=12500000.0,
            capacity=4,
            status="MAINTENANCE",
            furnishing="FULLY_FURNISHED",
            description="Căn góc 2 phòng ngủ cao cấp, bồn tắm nằm view toàn cảnh cầu Rồng.",
            amenities=common_amenities,
            images=common_images
        )
        session.add_all([r101, r102, r201, r301])
        await session.flush()

        # 8. Meters
        m_elec_101 = Meter(id="mtr_e101", room_id=r101.id, type="ELECTRICITY", serial_number="EM-RS-101", initial_reading=300.0, current_reading=450.0, status="ACTIVE")
        m_water_101 = Meter(id="mtr_w101", room_id=r101.id, type="WATER", serial_number="WM-RS-101", initial_reading=5.0, current_reading=18.0, status="ACTIVE")
        session.add_all([m_elec_101, m_water_101])

        # 9. Active Contract for Room 101
        contract_101 = RentalContract(
            id="ctr_101",
            room_id=r101.id,
            tenant_id=tenant_user.id,
            company_id=comp_homtel.id,
            contract_number="HD-2025-001",
            start_date="2025-01-01",
            end_date="2025-12-31",
            rent_amount=6500000.0,
            deposit_amount=13000000.0,
            payment_day_of_month=5,
            status="ACTIVE",
            signed_at="2025-01-01T10:00:00Z",
            signature_hash="a6c5f70b93836d1b248a3138b321a5cf8be8a6557a2c262d1c686e0da8202d08",
        )
        session.add(contract_101)
        await session.flush()

        # 10. Invoices (Current month + previous month)
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        inv_curr = Invoice(
            id="inv_2026_09",
            room_id=r101.id,
            tenant_id=tenant_user.id,
            contract_id=contract_101.id,
            company_id=comp_homtel.id,
            invoice_number=f"INV-{current_month.replace('-', '')}-001",
            billing_month=current_month,
            issue_date=f"{current_month}-01",
            due_date=f"{current_month}-05",
            subtotal=7350000.0,
            total=7350000.0,
            paid_amount=7350000.0,
            outstanding_amount=0.0,
            status="PAID",
        )
        item1 = InvoiceItem(invoice_id=inv_curr.id, description="Tiền thuê phòng tháng 09/2026", amount=6500000.0, unit_price=6500000.0, quantity=1.0, type="RENT")
        item2 = InvoiceItem(invoice_id=inv_curr.id, description="Tiền điện (150 kWh x 3,500đ)", amount=525000.0, unit_price=3500.0, quantity=150.0, type="ELECTRICITY")
        item3 = InvoiceItem(invoice_id=inv_curr.id, description="Tiền nước (15 m3 x 15,000đ)", amount=225000.0, unit_price=15000.0, quantity=15.0, type="WATER")
        item4 = InvoiceItem(invoice_id=inv_curr.id, description="Internet cáp quang", amount=100000.0, unit_price=100000.0, quantity=1.0, type="SERVICE")
        session.add_all([inv_curr, item1, item2, item3, item4])

        # 11. Services Catalog
        srv_ac = Service(
            id="srv_ac_clean",
            company_id=comp_services.id,
            name="Vệ sinh & Bơm ga máy lạnh Inverter",
            slug="ve-sinh-may-lanh-inverter",
            description="Bảo dưỡng xịt rửa dàn lạnh, dàn nóng, đo áp suất ga và khử khuẩn bằng dung dịch nano bạc.",
            category="HVAC",
            price_type="FIXED",
            base_price=250000.0,
            image_url="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80",
            status="ACTIVE"
        )
        srv_plumb = Service(
            id="srv_plumbing",
            company_id=comp_services.id,
            name="Sửa chữa điện nước & Thông tắc khẩn cấp",
            slug="sua-chua-dien-nuoc-khan-cap",
            description="Có mặt trong vòng 30 phút xử lý rò rỉ van nước, nghẹt lavabo, sập aptomat.",
            category="PLUMBING",
            price_type="VARIABLE",
            base_price=150000.0,
            image_url="https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=600&q=80",
            status="ACTIVE"
        )
        srv_clean = Service(
            id="srv_deep_clean",
            company_id=comp_services.id,
            name="Dịch vụ giặt nệm sofa & Tổng vệ sinh phòng",
            slug="giat-sofa-tong-ve-sinh",
            description="Giặt hơi nước nóng 140 độ C diệt ve bụi, làm sạch sâu khử mùi toàn diện.",
            category="CLEANING",
            price_type="FIXED",
            base_price=350000.0,
            image_url="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
            status="ACTIVE"
        )
        session.add_all([srv_ac, srv_plumb, srv_clean])
        await session.flush()

        # 12. Completed Service Request + Review
        sr_completed = ServiceRequest(
            id="sr_comp_001",
            service_id=srv_ac.id,
            provider_company_id=comp_services.id,
            tenant_id=tenant_user.id,
            room_id=r101.id,
            title="Bảo dưỡng máy lạnh phòng 101 định kỳ 6 tháng",
            description="Máy lạnh làm mát hơi yếu, cần vệ sinh dàn lạnh và kiểm tra ga.",
            urgency="MEDIUM",
            status="COMPLETED",
            estimated_cost=250000.0,
            final_cost=250000.0
        )
        session.add(sr_completed)
        await session.flush()

        rev_001 = ProviderReview(
            id="rev_001",
            service_request_id=sr_completed.id,
            provider_company_id=comp_services.id,
            tenant_id=tenant_user.id,
            rating=5,
            punctuality_rating=5,
            quality_rating=5,
            comment="Kỹ thuật viên đến đúng hẹn, làm việc rất cẩn thận, có bọc nilong chống bẩn tường. Rất hài lòng!",
            tags=json.dumps(["Đúng giờ", "Chuyên nghiệp", "Sạch sẽ"])
        )
        session.add(rev_001)

        # 13. CRM Leads & Tours
        lead1 = Lead(
            id="lead_001",
            company_id=comp_homtel.id,
            full_name="Nguyễn Thùy Linh",
            phone="0988776655",
            email="thuylinh@gmail.com",
            source="WEBSITE",
            status="TOURED",
            budget_min=6000000.0,
            budget_max=8500000.0,
            preferred_room_type="STUDIO",
            move_in_date="2026-10-01",
            notes="Khách thích tầng cao, view thoáng, cần wifi ổn định làm việc remote."
        )
        session.add(lead1)
        await session.flush()

        tour1 = Tour(
            id="tour_001",
            company_id=comp_homtel.id,
            lead_id=lead1.id,
            room_id=r201.id,
            host_staff_id=staff_user.id,
            scheduled_at="2026-09-18T15:00:00Z",
            status="SCHEDULED"
        )
        session.add(tour1)

        # 14. Operating Expenses
        exp1 = BuildingExpense(
            id="exp_001",
            building_id=bld1.id,
            category="SECURITY",
            description="Chi phí đội bảo vệ an ninh ca đêm tháng 09/2026",
            amount=8000000.0,
            expense_date=f"{current_month}-01",
            period_month=current_month,
            vendor_name="Công ty Bảo vệ Đại Lục",
            created_by=owner_user.id
        )
        exp2 = BuildingExpense(
            id="exp_002",
            building_id=bld1.id,
            category="MAINTENANCE_REPAIR",
            description="Bảo trì hệ thống thang máy Mitshubishi định kỳ",
            amount=3500000.0,
            expense_date=f"{current_month}-10",
            period_month=current_month,
            vendor_name="Thang máy Việt Nhật",
            created_by=owner_user.id
        )
        session.add_all([exp1, exp2])

        # Commit all
        await session.commit()
        print("Database seeded successfully with all 5 roles, buildings, rooms, contracts, invoices, services, CRM leads, and operating expenses!")


if __name__ == "__main__":
    asyncio.run(seed_database())
