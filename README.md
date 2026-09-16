# Homtel - Nền Tảng Quản Lý Căn Hộ Dịch Vụ & Bất Động Sản Cho Thuê

Homtel là nền tảng quản trị và vận hành bất động sản cho thuê toàn diện (Full-Stack), tích hợp cổng thông tin đa vai trò (Super Admin, Chủ nhà / Đơn vị quản lý, Đối tác dịch vụ kỹ thuật, và Cư dân thuê phòng). Ứng dụng hỗ trợ giao diện song ngữ Tiếng Việt & Tiếng Anh với thiết kế chuẩn mực, hiện đại.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Node.js & Express.js, tích hợp cơ sở dữ liệu SQLite hiệu năng cao qua module gốc `node:sqlite` (`DatabaseSync`) với chế độ WAL (Write-Ahead Logging) và kiểm soát giao dịch nguyên tử (ACID Transactions).
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (Framer Motion), Lucide React.
- **Bundler & Dev Server**: Vite 6 tích hợp trực tiếp làm Middleware trong Express.
- **Xác thực & Phân quyền**: JWT (JSON Web Tokens), Bcrypt mã hóa mật khẩu, RBAC đa tầng.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

Trước khi bắt đầu cài đặt, đảm bảo máy tính của bạn đã cài đặt:

1. **Node.js**: Phiên bản **>= 22.5.0** *(Bắt buộc vì hệ thống sử dụng module SQLite đồng bộ gốc `node:sqlite` có sẵn từ Node v22.5+)*.
   - Kiểm tra phiên bản hiện tại:
     ```bash
     node -v
     ```
   - Nếu phiên bản thấp hơn, bạn có thể tải bản mới nhất tại [nodejs.org](https://nodejs.org) hoặc sử dụng `nvm`:
     ```bash
     nvm install 22
     nvm use 22
     ```
2. **Package Manager**: `npm` (đi kèm Node.js) hoặc `yarn`, `pnpm`, `bun`.
3. **Git**: Dùng để quản lý và clone mã nguồn.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Local Từng Bước

### Bước 1: Mở thư mục dự án
Mở terminal tại thư mục chứa mã nguồn của dự án:
```bash
cd <duong-dan-den-thu-muc-du-an>
```

### Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
Chạy lệnh sau để cài đặt toàn bộ thư viện cần thiết:
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```

Nội dung file `.env` tham khảo:
```env
# JWT Secret dùng để ký và xác thực token đăng nhập
JWT_SECRET="rental-system-super-secure-jwt-secret-key-2026"

# URL của ứng dụng khi chạy local
APP_URL="http://localhost:3000"

# (Tùy chọn) Khóa Gemini API nếu sử dụng các tính năng trợ lý AI
GEMINI_API_KEY=""
```

### Bước 4: Khởi tạo dữ liệu mẫu (Seed Data)
Hệ thống đi kèm bộ dữ liệu mẫu phong phú (các tòa nhà, căn hộ, chủ nhà, đối tác dịch vụ, hợp đồng, chỉ số điện nước, hóa đơn và cư dân). 

Khởi tạo cơ sở dữ liệu SQLite (`data/rental.db`) và nạp dữ liệu bằng lệnh:
```bash
npm run seed
```
*(Lưu ý: Khi khởi động server lần đầu, nếu cơ sở dữ liệu chưa có dữ liệu, server cũng sẽ tự động thực hiện nạp dữ liệu ban đầu).*

---

## 💻 Khởi Chạy Ứng Dụng

### 1. Chế độ Phát triển (Development Mode)
Chạy cả backend Express và frontend Vite trên cùng một tiến trình:
```bash
npm run dev
```

- Mở trình duyệt và truy cập: **[http://localhost:3000](http://localhost:3000)**
- Tài liệu API Swagger / OpenAPI tương tác: **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**
- Kiểm tra trạng thái máy chủ (Healthcheck): **[http://localhost:3000/api/health](http://localhost:3000/api/health)**

### 2. Kiểm tra lỗi kiểu dữ liệu (Type-check / Lint)
Để kiểm tra tính hợp lệ của toàn bộ mã nguồn TypeScript:
```bash
npm run lint
```

### 3. Chạy kiểm thử tự động (Automated Tests)
Hệ thống có sẵn các bài kiểm thử tích hợp (Integration Tests) cho luồng xác thực, hóa đơn và hợp đồng:
```bash
npm run test
```

### 4. Đóng gói và Chạy Bản Production (Production Build)
Để xây dựng bản phân phối tối ưu cho môi trường triển khai thực tế:
```bash
# Biên dịch Frontend (Vite) và Backend Bundle (esbuild)
npm run build

# Khởi chạy server production
npm run start
```

---

## 🔑 Tài Khoản Thử Nghiệm (Demo Accounts)

Hệ thống cung cấp sẵn thanh **Live Role Simulator** ở thanh đầu trang giúp bạn chuyển đổi nhanh giữa các vai trò mà không cần đăng xuất. Bạn cũng có thể đăng nhập thủ công bằng các tài khoản sau:

| Vai trò | Email đăng nhập | Mật khẩu | Mô tả quyền hạn |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@propertyv1.com` | `Admin@123` | Quản trị toàn hệ thống, cấp phép chủ nhà, nhật ký kiểm toán. |
| **Chủ nhà (Owner 1)** | `owner1@greenliving.com` | `Owner@123` | Quản lý tòa Green Living, chốt số điện nước, duyệt hồ sơ. |
| **Chủ nhà (Owner 2)** | `owner2@skyline.com` | `Owner@123` | Quản lý căn hộ tòa Skyline Urban Residences. |
| **Chủ nhà (Owner 3)** | `owner3@sunset.com` | `Owner@123` | Quản lý chuỗi nhà trọ hộ kinh doanh Sunset Homes. |
| **Đối tác (Dịch vụ)** | `cleanmaster@clean.com` | `Provider@123` | CleanMaster Pro: Điều phối thợ dọn dẹp, bảo trì, báo giá. |
| **Nhân viên (Staff)** | `staff1@greenliving.com` | `Staff@123` | Quản lý vận hành tòa nhà trực thuộc Green Living. |
| **Cư dân (Tenant)** | `tenant1@gmail.com` | `Tenant@123` | Cổng cư dân `/my`, thanh toán tiền phòng, báo hỏng hóc. |
| **Cư dân (Tenant khác)** | `tenant2@gmail.com` đến `tenant24@gmail.com` | `Tenant@123` | Danh sách các khách thuê với các trạng thái hợp đồng khác nhau. |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
├── data/                    # Thư mục chứa tệp cơ sở dữ liệu SQLite (rental.db)
├── public/                  # Tài nguyên tĩnh (Favicon, hình ảnh, tài liệu)
├── server/                  # Mã nguồn Backend (Express.js)
│   ├── db/                  # Kết nối SQLite (node:sqlite) & Schema SQL
│   ├── middlewares/         # Middleware bảo mật, xác thực JWT, RBAC
│   ├── routes/              # Các Endpoint REST API (/api/v1/...)
│   └── seed.ts              # Script nạp dữ liệu mẫu Idempotent
├── src/                     # Mã nguồn Frontend (React 19 + TypeScript)
│   ├── components/
│   │   ├── admin/           # Giao diện Cổng Quản trị Tối cao (Super Admin)
│   │   ├── auth/            # Hộp thoại Đăng nhập / Đăng ký tài khoản
│   │   ├── owner/           # Giao diện Cổng Chủ nhà / Đơn vị cho thuê
│   │   ├── provider/        # Giao diện Cổng Đối tác dịch vụ kỹ thuật
│   │   ├── public/          # Trang chủ công khai, bộ lọc phòng, chi tiết phòng
│   │   └── tenant/          # Giao diện Cổng Cư dân (/my), thanh toán & dịch vụ
│   ├── context/             # React Context (LanguageContext, AuthContext)
│   ├── i18n/                # Bộ từ điển song ngữ (Tiếng Việt / English)
│   ├── App.tsx              # Component trung tâm và điều hướng giao diện
│   └── main.tsx             # Điểm vào chính của ứng dụng
├── tests/                   # Kịch bản kiểm thử API tự động
├── server.ts                # File khởi chạy máy chủ tích hợp Express & Vite
├── vite.config.ts           # Cấu hình Vite & Tailwind CSS
├── tsconfig.json            # Cấu hình TypeScript
└── package.json             # Danh sách dependencies và npm scripts
```

---

## ❓ Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Lỗi `Cannot find module 'node:sqlite'` hoặc `DatabaseSync is not a constructor`
- **Nguyên nhân**: Bạn đang chạy Node.js phiên bản cũ (dưới v22.5.0).
- **Cách khắc phục**: Nâng cấp Node.js lên phiên bản **22.5.0** trở lên bằng `nvm use 22` hoặc cài lại từ trang chủ Node.js.

### 2. Lỗi cổng `Port 3000 is already in use` (`EADDRINUSE`)
- **Nguyên nhân**: Đang có ứng dụng khác chiếm dụng cổng 3000.
- **Cách khắc phục**:
  - Trên macOS / Linux:
    ```bash
    lsof -i :3000
    kill -9 <PID>
    ```
  - Trên Windows (PowerShell):
    ```powershell
    Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
    ```

### 3. Cần làm mới (Reset) lại toàn bộ dữ liệu cơ sở dữ liệu
- Nếu bạn muốn đưa hệ thống về trạng thái ban đầu:
  1. Dừng server (`Ctrl + C`).
  2. Xóa file database: `rm data/rental.db data/rental.db-wal data/rental.db-shm` (hoặc xóa trong thư mục `data`).
  3. Chạy lại lệnh seed: `npm run seed`.
  4. Chạy lại server: `npm run dev`.
