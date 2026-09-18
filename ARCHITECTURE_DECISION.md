# BÁO CÁO QUYẾT ĐỊNH KIẾN TRÚC (ARCHITECTURE DECISION RECORD - ADR)

**Ngày cập nhật**: 16/09/2026  
**Trạng thái**: ĐÃ DUYỆT (SUPERSEDED & RE-ARCHITECTED)  
**Quyết định chính thức**: Hợp nhất và chuẩn hóa toàn bộ nền tảng sang **FastAPI (Python 3.12+) + PostgreSQL 18 + SQLAlchemy 2.0 Async + Next.js 16 (App Router)**. **Xóa vĩnh viễn `server/` (Express + SQLite) và các tệp dữ liệu SQLite mồ côi**.

---

## 1. BỐI CẢNH VÀ LÝ DO PIVOT (CONTEXT & RATIONALE)

Ban đầu dự án thử nghiệm song song hai backend: `server/` (Node/Express/SQLite) và `backend/` (FastAPI). Sau khi xem xét toàn diện các yêu cầu nghiệp vụ thực tế của một hệ thống Quản lý Bất động sản và Vận hành Tòa nhà Cho thuê (Homtel Platform) phục vụ 5 vai trò (Super Admin, Chủ nhà, Nhân viên, Đối tác, Cư dân), ban kiến trúc đã quyết định thực hiện bước chuyển đổi mang tính quyết định (Pivot):

1. **Yêu cầu SEO & Khả năng hiển thị công khai (Public Discoverability)**:
   - Nền tảng cần tiếp cận khách thuê qua các công cụ tìm kiếm (Google, Bing). Khách hàng tìm kiếm căn hộ tại Đà Nẵng cần các trang chi tiết tòa nhà, phòng có đầy đủ **Server-Side Rendering (SSR)**, thẻ OpenGraph, sitemap động, robots.txt và dữ liệu có cấu trúc **Schema.org JSON-LD** (`ApartmentComplex`, `HotelRoom`, `LodgingBusiness`).
   - Kiến trúc cũ (Vite React SPA thuần) phụ thuộc render ở client, gây bất lợi lớn cho SEO. Frontend đã được nâng cấp toàn diện sang **Next.js 16 App Router** với Turbopack.
2. **Tính toàn vẹn dữ liệu doanh nghiệp (Enterprise Relational Integrity)**:
   - Hệ thống vận hành tài chính, chỉ số công tơ, hóa đơn hàng tháng, hợp đồng điện tử và nhiều công ty (multi-tenancy) đòi hỏi cơ sở dữ liệu quan hệ mạnh mẽ, giao dịch ACID nghiêm ngặt, cơ chế migration chuẩn mực (`Alembic`) và kết nối bất đồng bộ hiệu năng cao (`asyncpg`).
   - SQLite cũ (`data/rental.db`) chỉ phù hợp prototype cục bộ, tiềm ẩn xung đột khóa ghi (database lock) khi vận hành đa luồng và không đảm bảo khả năng mở rộng.
3. **Loại bỏ phân mảnh mã nguồn (Single Source of Truth)**:
   - Quyết định trước đây (ADR cũ) từng giữ tạm `server/` do lo ngại chi phí chuyển đổi. Tuy nhiên, việc duy trì hai backend gây rủi ro kỹ thuật cực lớn. Do đó, toàn bộ nghiệp vụ 10 module đã được chuyển đổi hoàn chỉnh sang `backend/` (FastAPI), sau đó **xóa vĩnh viễn thư mục `server/` và file `server.ts`** để loại bỏ hoàn toàn mã thừa.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC CHI TIẾT (ARCHITECTURE SPECIFICATIONS)

### A. Backend: Python FastAPI Async (`backend/`)
- **Ngôn ngữ & Runtime**: Python 3.12+, quản lý gói qua `uv`.
- **Framework**: FastAPI (Async API), Pydantic v2 (Data Validation & Schemas).
- **Cơ sở dữ liệu**: **PostgreSQL 18** (kết nối trực tiếp qua `postgresql+asyncpg://`, cổng 5432).
  - *Quy định nghiêm ngặt*: Loại bỏ hoàn toàn SQLite fallback trong môi trường phát triển lẫn sản xuất.
  - *Quản lý lược đồ*: **Alembic** phiên bản async thực thi migration (`alembic upgrade head`).
- **Bảo mật & Phân quyền**:
  - Hashing mật khẩu bằng `bcrypt` trực tiếp (chống lỗi tràn chuỗi 72 bytes của passlib).
  - JWT tokens với hạn dùng tính toán bằng thời gian chuẩn UTC có timezone (`datetime.now(timezone.utc)`).
  - Phân quyền RBAC chặt chẽ cho 5 vai trò: `SUPER_ADMIN`, `OWNER`, `STAFF`, `PROVIDER`, `TENANT`.
  - **Bảo vệ PII & Giá thuê (Privacy-First)**: Endpoint Building 360 (`/operations/buildings/{id}/360`) và Room 360 (`/operations/rooms/{id}/360`) tự động che giấu thông tin cư dân và giá thuê đối với người gọi ẩn danh, đối tác dịch vụ hoặc cư dân phòng khác; chỉ hiển thị dữ liệu đầy đủ cho cấp quản lý (`OWNER`, `STAFF`, `SUPER_ADMIN`) hoặc chính cư dân sở hữu hợp đồng.
  - **Xác thực Webhook tài chính (VietQR)**: Endpoint `/billing/invoices/webhook/vietqr` bắt buộc xác thực khóa bí mật qua header `X-Webhook-Secret`, ghi log cảnh báo an ninh cho các truy cập trái phép.

### B. Frontend: Next.js 16 App Router (`src/app/`)
- **Công nghệ**: Next.js 16, React 19, Tailwind CSS v4, Turbopack.
- **Chuyển trang chuẩn URL (URL-based Navigation)**: Chuyển trang thực qua router Next.js (`/`, `/explore`, `/buildings/[slug]`, `/rooms/[id]`, `/services`, `/owner`, `/my`, `/provider`, `/admin`), không sử dụng state giả lập trong RAM.
- **Tối ưu hóa SEO**:
  - SSR cho toàn bộ trang công khai (`/`, `/explore`, `/buildings/[slug]`, `/rooms/[id]`, `/services`).
  - Chèn tự động Schema.org JSON-LD (`Organization`, `LodgingBusiness`, `ApartmentComplex`, `HotelRoom`).
  - Sinh động sitemap (`/sitemap.xml`), robots (`/robots.txt`), và PWA manifest (`/manifest.webmanifest`).
- **Trải nghiệm Mobile-first**:
  - Thanh điều hướng đáy màn hình (`MobileNav.tsx`) cố định chuẩn ứng dụng native.
  - Khung tìm kiếm, lưới hiển thị responsive linh hoạt.

---

## 3. TÌNH TRẠNG CÁC TÀI NGUYÊN BỊ LOẠI BỎ (DECOMMISSIONED ASSETS)

| Tài nguyên | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| `server/` (Express codebase) | **ĐÃ XÓA VĨNH VIỄN** | Toàn bộ tính năng đã được tái hiện trong `backend/` |
| `server.ts` | **ĐÃ XÓA VĨNH VIỄN** | Thay thế bằng `next.config.mjs` API rewrites |
| `data/rental.db*` (SQLite cũ) | **ĐÃ XÓA VĨNH VIỄN** | Đã chuyển sang PostgreSQL 18 (`homtel_db`) |
| `backend/data/homtel_dev.db*` | **ĐÃ XÓA VĨNH VIỄN** | Không còn sử dụng SQLite fallback |

---

## 4. MA TRẬN BẢO MẬT & PHÂN QUYỀN (ACCESS CONTROL MATRIX)

| Module / Endpoint | Quyền hạn truy cập | Cơ chế bảo vệ & Che giấu dữ liệu |
| :--- | :--- | :--- |
| `POST /auth/login`, `POST /auth/register` | Public | Rate limit, bcrypt verification |
| `GET /auth/me` | Mọi user đã đăng nhập | JWT Bearer Authentication |
| `GET /buildings`, `GET /rooms` | Public | Danh mục niêm yết công khai phục vụ SEO |
| `GET /operations/buildings/{id}/360` | Phân cấp theo vai trò | Anonymous/Provider: Chỉ xem summary; Tenant: Xem phòng mình, mask phòng khác; Owner/Staff/Admin: Xem đầy đủ |
| `GET /operations/rooms/{id}/360` | Phân cấp theo vai trò | Chỉ Owner/Staff/Admin hoặc Tenant chính chủ mới xem được hợp đồng, hóa đơn, PII cư dân |
| `POST /billing/invoices/webhook/vietqr` | Cổng thanh toán (SePay/Casso/Bank) | Bắt buộc `X-Webhook-Secret`, từ chối 401 nếu thiếu/sai secret |
| `POST /buildings`, `POST /rooms` | OWNER, SUPER_ADMIN | `require_role` middleware (403 nếu sai vai trò) |
| `GET /admin/*` | SUPER_ADMIN | `require_role("SUPER_ADMIN")` (403 cho tất cả vai trò khác) |

---

## 5. TÍNH NĂNG CHỜ ĐĂNG KÝ PHÁP NHÂN (FEATURE-FLAGGED OFF)

Nhằm đảm bảo tuân thủ pháp lý và tính khả thi trong giai đoạn chưa thành lập pháp nhân doanh nghiệp, hai tính năng tích hợp nhà cung cấp bên thứ ba đã được **hoàn thiện khung mã nguồn nhưng đang tạm tắt qua Feature Flags**:

1. **Cổng thanh toán VietQR / NAPAS 247 & Webhook ngân hàng**:
   - **Cờ cấu hình**: `PAYMENT_GATEWAY_ENABLED=False` (backend), `NEXT_PUBLIC_PAYMENT_GATEWAY_ENABLED=false` (frontend).
   - **Hành vi**:
     - Endpoint `GET /billing/invoices/{id}/vietqr` và `POST /billing/invoices/webhook/vietqr` trả về **HTTP 503 Service Unavailable** kèm thông báo `"Tính năng đang tạm ngưng, sẽ kích hoạt sau khi hoàn tất đăng ký doanh nghiệp"`.
     - Giao diện `PaymentModal`: Ẩn hoàn toàn mã QR VietQR và tab QR; hiển thị thông tin tài khoản ngân hàng của tòa nhà và kích hoạt luồng xác nhận chuyển khoản thủ công (`POST /billing/payments`).
   - **Điều kiện bật lại**: Khi thành lập doanh nghiệp và ký hợp đồng mở cổng thanh toán (SePay/Casso/PayOS/Ngân hàng), đổi cờ thành `True`.

2. **Dịch vụ thông báo Zalo ZNS (Zalo Notification Service)**:
   - **Cờ cấu hình**: `ZALO_ENABLED=False` (backend), `NEXT_PUBLIC_ZALO_ENABLED=false` (frontend).
   - **Hành vi**:
     - Endpoint `POST /notifications/send-zalo` trả về **HTTP 503 Service Unavailable**.
     - Giao diện ký hợp đồng `ContractSigningModal` chuyển sang phương thức gửi mã xác thực SMS/hệ thống, ẩn tùy chọn Zalo.
   - **Điều kiện bật lại**: Khi hoàn tất xác thực Zalo Official Account (Zalo OA) doanh nghiệp, đổi cờ thành `True`.
