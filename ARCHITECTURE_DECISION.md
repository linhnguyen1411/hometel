# BÁO CÁO QUYẾT ĐỊNH KIẾN TRÚC (ARCHITECTURE DECISION RECORD - ADR)

**Ngày ban hành**: 16/09/2026  
**Trạng thái**: ĐÃ DUYỆT (ACCEPTED)  
**Quyết định**: Giữ nguyên `server/` (Node.js/Express) làm Nguồn Sự Thật Duy Nhất (Single Source of Truth). Đóng băng phát triển tại `backend/` (FastAPI).

---

## 1. BỐI CẢNH (CONTEXT)
Trong quá trình thử nghiệm thiết kế, repo tồn tại song song hai thư mục backend:
1. `server/` — Viết bằng **Node.js/Express + TypeScript + node:sqlite (WAL) + JWT/bcrypt**. Đã triển khai đầy đủ 10 route modules (`auth`, `superAdmin`, `company`, `building`, `rental`, `billing`, `service`, `notification`, `operations`, `docs`), các service nghiệp vụ và repository layer. Đây là backend phục vụ toàn bộ tính năng thực tế cho frontend React 19.
2. `backend/` — Viết bằng **FastAPI + SQLAlchemy async + PostgreSQL/Alembic**, mới chỉ có 3 modules ở mức cơ bản (`auth`, `properties`, `operations`).

Việc duy trì hai backend song song gây ra rủi ro phân mảnh mã nguồn, trùng lặp công sức và tiềm ẩn xung đột logic nghiệp vụ.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC (DECISION)
1. **Nguồn sự thật duy nhất (Single Source of Truth)**:
   - Toàn bộ tính năng từ **Phase 1 trở đi sẽ chỉ được phát triển, sửa lỗi và kiểm thử trên `server/` (Express + TypeScript)**.
   - Tuyệt đối không viết cùng một tính năng vào cả hai backend.
2. **Định vị thư mục `backend/` (FastAPI)**:
   - Dừng toàn bộ việc phát triển tính năng mới trên `backend/`.
   - Giữ nguyên `backend/` trong repo như tài liệu thiết kế tham khảo kỹ thuật (Reference Architecture) cho việc migrate cơ sở dữ liệu sang PostgreSQL (Postgres schema, 3NF models) khi hệ thống đạt quy mô cần tách microservices. Không xóa file ngay.

---

## 3. KẾT QUẢ VÀ HÀNH ĐỘNG (CONSEQUENCES)
- Mọi API endpoint, WebSocket, tích hợp ngân hàng (VietQR/Webhook), Zalo ZNS/OA, và hợp đồng điện tử sẽ tập trung 100% trong `server/`.
- Mọi truy vấn cơ sở dữ liệu trong `server/` sẽ được chuẩn hóa đi qua `server/db/repositories/*` (Repository Pattern). Khi đổi từ SQLite WAL sang PostgreSQL trong tương lai, chỉ cần thay thế driver DB trong repository mà không phải thay đổi business logic ở controller và service.

---

## 4. KẾT QUẢ AUDIT PHÂN QUYỀN RBAC (AUTH ROUTE AUDIT)

Đã hoàn thành rà soát toàn bộ các route trong `server/routes/*.ts`:
- `superAdminRoutes.ts`: Toàn bộ route đều được khóa bằng `authenticate` và `requireRole('SUPER_ADMIN')`.
- `billingRoutes.ts`:
  - Đã bổ sung `requireRole('OWNER', 'STAFF', 'SUPER_ADMIN')` và `verifyCompanyAccess` vào `meterRouter.post('/readings')` để ngăn ngừa Tenant hoặc người ngoài ghi đè chỉ số công tơ.
  - Đã kiểm tra quyền sở hữu phòng đối với `meterRouter.get('/room/:roomId')`.
  - Đã bổ sung kiểm tra vai trò cho `invoiceRouter.post('/generate')`.
- `buildingRoutes.ts`:
  - Bổ sung `requireRole('OWNER', 'SUPER_ADMIN')` khi tạo tòa nhà mới và cấu hình biểu phí.
  - Bổ sung `requireRole('OWNER', 'STAFF', 'SUPER_ADMIN')` khi tạo và chỉnh sửa phòng.
- `rentalRoutes.ts`:
  - Bổ sung `requireRole('OWNER', 'STAFF', 'SUPER_ADMIN')` cho việc duyệt đơn thuê (`/applications/:id/review`) và tạo hợp đồng trực tiếp (`/contracts`).
- `serviceRoutes.ts`:
  - Bổ sung `requireRole('PROVIDER', 'SUPER_ADMIN')` khi tạo dịch vụ mới.
  - Bổ sung `requireRole('PROVIDER', 'STAFF', 'SUPER_ADMIN')` khi duyệt yêu cầu và phân công kỹ thuật viên.
- `operationsRoutes.ts`:
  - Bổ sung `requireRole('OWNER', 'STAFF', 'SUPER_ADMIN')` cho các endpoint Cockpit, Action Center, Quick Actions và AI Insights để ngăn lộ dữ liệu vận hành cho người ngoài.
