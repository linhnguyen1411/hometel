# Homtel - Nền Tảng Quản Lý Căn Hộ Dịch Vụ & Bất Động Sản Cho Thuê

Homtel là nền tảng quản trị và vận hành bất động sản cho thuê toàn diện (Full-Stack), tích hợp cổng thông tin 5 vai trò (Super Admin, Chủ nhà / Đơn vị quản lý, Nhân viên vận hành, Đối tác dịch vụ kỹ thuật, và Cư dân thuê phòng). Ứng dụng hỗ trợ giao diện song ngữ Tiếng Việt & Tiếng Anh với thiết kế chuẩn mực, hiện đại, tối ưu SEO và Mobile-First.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: **Python 3.12+** với **FastAPI** (Async API), **PostgreSQL 18** (kết nối trực tiếp qua `asyncpg`), **SQLAlchemy 2.0 (Async Engine)**, **Alembic** (Database Migrations), **Pydantic v2**.
- **Frontend**: **Next.js 16 (App Router)**, React 19, Tailwind CSS v4, Lucide React, Turbopack.
- **Xác thực & Phân quyền**: JWT (JSON Web Tokens), Bcrypt mã hóa mật khẩu an toàn, RBAC 5 vai trò, cơ chế Data Masking bảo vệ PII cư dân.
- **Tối ưu SEO**: Server-Side Rendering (SSR), Schema.org JSON-LD (`ApartmentComplex`, `HotelRoom`, `LodgingBusiness`), dynamic `/sitemap.xml`, `/robots.txt`, Web App Manifest.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

1. **Python**: Phiên bản **>= 3.12** cùng trình quản lý gói `uv`.
2. **PostgreSQL**: Phiên bản **>= 16** (đang chạy trên cổng 5432, database `homtel_db`).
3. **Node.js**: Phiên bản **>= 20.0.0** và `pnpm`.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Local

### 1. Khởi chạy Cơ sở dữ liệu & Backend (FastAPI)
```bash
cd backend

# Cài đặt thư viện bằng uv
uv sync

# Chạy migrations Alembic trên PostgreSQL
uv run alembic upgrade head

# Nạp dữ liệu mẫu ban đầu (Seed Data)
uv run python -m app.seed

# Khởi động Backend API
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs tương tác: **[http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)**
- Healthcheck: **[http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)**

### 2. Khởi chạy Frontend (Next.js)
```bash
# Tại thư mục gốc homtel
pnpm install

# Khởi chạy server Next.js (Turbopack)
pnpm dev
```
- Trang chủ: **[http://localhost:3000](http://localhost:3000)**
- Sitemap SEO: **[http://localhost:3000/sitemap.xml](http://localhost:3000/sitemap.xml)**
- Robots SEO: **[http://localhost:3000/robots.txt](http://localhost:3000/robots.txt)**

### 3. Chạy Kiểm Thử Tự Động (Automated Tests)
```bash
cd backend
uv run python -m pytest tests/ -v
```

---

## 🔑 Tài Khoản Thử Nghiệm (Demo Accounts)

| Vai trò | Email đăng nhập | Mật khẩu | Mô tả quyền hạn |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@homtel.vn` | `Admin@123` | Quản trị tối cao, thống kê toàn sàn, cấp phép chủ nhà. |
| **Chủ nhà (Owner)** | `owner@homtel.vn` | `Owner@123` | Quản trị tòa nhà, phòng, biểu phí, duyệt hợp đồng, tài chính P&L. |
| **Nhân viên (Staff)** | `staff@homtel.vn` | `Staff@123` | Vận hành tòa nhà, kiểm tra phòng, hỗ trợ cư dân. |
| **Đối tác (Provider)** | `provider@homtel.vn` | `Provider@123` | Nhận phiếu công tác dịch vụ (Smart Work Order), xem đánh giá uy tín. |
| **Cư dân (Tenant)** | `tenant@homtel.vn` | `Tenant@123` | Cổng cư dân `/my`, thanh toán hóa đơn VietQR, đặt dịch vụ phòng. |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
├── backend/                 # Backend Python FastAPI + PostgreSQL
│   ├── alembic/             # Lịch sử và kịch bản Alembic migrations
│   ├── app/
│   │   ├── common/          # Envelope chuẩn hóa response/error
│   │   ├── core/            # Config, bảo mật JWT, kết nối PostgreSQL
│   │   ├── modules/         # 10 modules nghiệp vụ (auth, properties, billing, ...)
│   │   └── seed.py          # Script nạp dữ liệu mẫu
│   └── tests/               # Pytest suite tự động
├── src/                     # Frontend Next.js 16 (App Router)
│   ├── app/                 # Các tuyến URL: /, /explore, /buildings/[slug], /my, ...
│   ├── components/          # Components theo vai trò và layout
│   ├── context/             # AuthContext, LanguageContext
│   ├── services/            # Client API kết nối FastAPI qua proxy Next.js
│   └── types/               # Type definitions TypeScript
├── public/                  # Static assets, PWA icons
└── next.config.mjs          # Cấu hình Next.js và API Rewrites
```

---

## ⚙️ Cờ Tính Năng (Feature Flags)

Để đảm bảo tuân thủ pháp lý khi chưa hoàn tất thành lập doanh nghiệp, các cổng tích hợp bên thứ ba được kiểm soát bằng biến môi trường và mặc định tắt:

| Tính năng | Backend Flag (`backend/.env`) | Frontend Flag (`.env`) | Trạng thái | Điều kiện kích hoạt lại |
| :--- | :--- | :--- | :--- | :--- |
| **Cổng VietQR NAPAS 247** | `PAYMENT_GATEWAY_ENABLED=False` | `NEXT_PUBLIC_PAYMENT_GATEWAY_ENABLED=false` | **TẮT** (API trả 503, UI chuyển về thanh toán chuyển khoản thủ công) | Đăng ký pháp nhân doanh nghiệp với ngân hàng/cổng thanh toán |
| **Zalo ZNS Thông Báo** | `ZALO_ENABLED=False` | `NEXT_PUBLIC_ZALO_ENABLED=false` | **TẮT** (API trả 503, UI chuyển sang SMS/Mã xác thực) | Hoàn tất xác thực Zalo Official Account (Zalo OA) doanh nghiệp |

