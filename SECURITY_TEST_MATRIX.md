# HOMTEL — SECURITY TEST MATRIX & VERIFICATION

**Document Version**: 1.0-STABLE  
**Audit Reference**: `SECURITY_HARDENING_AUDIT.md`  
**Execution Environment**: Python 3.14 / FastAPI / PostgreSQL 16 (Alembic Head: `3260353f94f7`)  
**Test Suite**: `backend/tests/` (79 tests passed out of 79, 100% success rate)

---

## 1. Multi-Tenant Authorization & Data Isolation Matrix

| Vulnerability ID | Protected Resource / Endpoint | HTTP Method | Attacker Role & Profile | Legitimate Role & Profile | Expected Attack Response | Asserted Behavior / Security Invariant | Automated Test Identifier |
|:---|:---|:---:|:---|:---|:---:|:---|:---|
| **SEC-01** | `/api/v1/operations/today` | GET | `OWNER` (Comp A) / `STAFF` (Comp A) | `OWNER` (Comp B) | 200 (Scoped) | Cockpit metrics, overdue invoices, upcoming expirations ONLY contain items where `company_id == comp_a`. Zero Comp B data visible. | `tests/test_multitenant_isolation.py::test_company_a_owner_cannot_see_company_b_in_cockpit` |
| **SEC-02** | `/api/v1/operations/buildings/{id}/360` | GET | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Access denied via `assert_building_access()`. No tenant PII, financial metrics, or occupancy rates leaked across companies. | `tests/test_multitenant_isolation.py::test_crm_and_operations_cross_company_isolation` |
| **SEC-03** | `/api/v1/operations/rooms/{id}/360` | GET | `OWNER` (Comp A) / `TENANT` (Comp A) | `OWNER` (Comp B) / `TENANT` (Resident of room) | **403 Forbidden** | Access denied via `assert_room_access()`. Neither foreign owners nor unrelated tenants can inspect room timeline, tenant contracts, or meters. | `tests/test_multitenant_isolation.py::test_crm_and_operations_cross_company_isolation` |
| **SEC-04** | `/api/v1/crm/leads/{id}` | GET | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Foreign owner cannot inspect competitor's prospective tenant leads, customer budgets, contact information, or source channel. | `tests/test_multitenant_isolation.py::test_crm_and_operations_cross_company_isolation` |
| **SEC-04** | `/api/v1/crm/leads/{id}` | PATCH | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Foreign owner cannot modify, reassign, or corrupt leads belonging to another property management company. | `tests/test_multitenant_isolation.py::test_crm_and_operations_cross_company_isolation` |
| **SEC-05** | `/api/v1/buildings/{id}` | PATCH | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Foreign owner cannot modify name, address, or metadata of buildings owned by other companies. | `tests/test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **SEC-05** | `/api/v1/buildings/{id}/configurations` | POST | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Foreign owner cannot add utility pricing versions or change tariff rates for foreign buildings. | `tests/test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **SEC-06** | `/api/v1/rooms` | POST | `OWNER` (Comp A) injecting Comp B `building_id` | `OWNER` (Comp B) | **403 Forbidden** | System resolves authenticated user company and asserts building belongs to caller's company. Foreign building injection denied. | `tests/test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **SEC-06** | `/api/v1/rooms/{id}` | PATCH | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Cross-company modification of room number, pricing, or status blocked via `assert_room_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **SEC-06** | `/api/v1/rooms/{id}` | DELETE | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Arbitrary deletion of rooms owned by another company strictly blocked via `assert_room_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_building_and_room_isolation` |
| **SEC-07** | `/api/v1/contracts/{id}` | GET | `OWNER` (Comp A) / `TENANT` (Comp A) | `OWNER` (Comp B) / `TENANT` (Contract party) | **403 Forbidden** | Contract detail retrieval verifies company ownership for Owner/Staff and user ID matching for Tenant. | `tests/test_multitenant_isolation.py::test_cross_company_contract_and_signing_isolation` |
| **SEC-07** | `/api/v1/contracts/{id}/request-otp` | POST | `TENANT` (Unrelated Tenant A) | `TENANT` (Signer Tenant B) | **403 Forbidden** | Requesting signing OTP for another tenant's contract rejected via `assert_contract_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_contract_and_signing_isolation` |
| **SEC-07** | `/api/v1/contracts/{id}/sign` | POST | `TENANT` (Unrelated Tenant A) | `TENANT` (Signer Tenant B) | **403 Forbidden** | Signing another tenant's contract rejected; digital evidence signature verification halted. | `tests/test_multitenant_isolation.py::test_cross_company_contract_and_signing_isolation` |
| **SEC-07** | `/api/v1/contracts/{id}/renew` | POST | `OWNER` (Comp A) | `OWNER` (Comp B) | **403 Forbidden** | Foreign owner renewal attempt blocked via `assert_contract_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_contract_and_signing_isolation` |
| **SEC-08** | `/api/v1/billing/invoices/{id}/vietqr` | GET | `OWNER` (Comp A) / `TENANT` (Comp A) | `OWNER` (Comp B) / `TENANT` (Billed party) | **403 Forbidden** | VietQR payment code generation denied for foreign invoices via `assert_invoice_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_invoice_and_financial_isolation` |
| **SEC-08** | `/api/v1/billing/payments` | POST | `OWNER` (Comp A) / `TENANT` (Comp A) | `OWNER` (Comp B) / `TENANT` (Billed party) | **403 Forbidden** | Recording payment on foreign invoice denied via `assert_invoice_access()`. | `tests/test_multitenant_isolation.py::test_cross_company_invoice_and_financial_isolation` |
| **SEC-09** | `/api/v1/service-requests/{id}` | GET | `PROVIDER` (Comp A) | `PROVIDER` (Comp B) | **403 Forbidden** | Service provider cannot inspect work orders assigned to competing service providers. | `tests/test_multitenant_isolation.py::test_services_and_staff_assignment_isolation` |
| **SEC-09** | `/api/v1/service-requests/{id}/review` | POST | `PROVIDER` (Comp A) | `PROVIDER` (Comp B) | **403 Forbidden** | Service approval and pricing review restricted to the assigned provider company. | `tests/test_multitenant_isolation.py::test_services_and_staff_assignment_isolation` |
| **SEC-10** | `/api/v1/service-requests/{id}/assign` | POST | `PROVIDER` (Comp B) assigning Staff A | `PROVIDER` (Comp B) assigning Staff B | **400 Bad Request** (`INVALID_STAFF_ASSIGNMENT`) | Service provider cannot assign personnel belonging to external companies. `assert_staff_assignment()` verifies membership. | `tests/test_multitenant_isolation.py::test_services_and_staff_assignment_isolation` |
| **SEC-11** | `/api/v1/reviews` | POST | `TENANT` (Stranger Tenant A) | `TENANT` (Service Requester B) | **403 Forbidden** | Review submission verifies that the caller was the actual resident who initiated the service request. | `tests/test_multitenant_isolation.py::test_services_and_staff_assignment_isolation` |

---

## 2. Financial Integrity & State Machine Matrix

| Financial Rule | Endpoint | Input Vector | Expected Status | Error Code / Assertion | Invariant Preserved | Automated Test Identifier |
|:---|:---|:---:|:---:|:---|:---|:---|
| **Non-negative Payment** | `POST /api/v1/billing/payments` | `amount: -500000` | **400 Bad Request** | `INVALID_AMOUNT` | Database constraint `chk_payment_positive_amount` + Router check. Payments cannot be negative. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **Zero Payment Protection** | `POST /api/v1/billing/payments` | `amount: 0.00` | **400 Bad Request** | `INVALID_AMOUNT` | Payment amounts must be strictly greater than zero. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **Overpayment Protection** | `POST /api/v1/billing/payments` | `amount: 99999999` (> outstanding) | **400 Bad Request** | `OVERPAYMENT_NOT_ALLOWED` | Payments exceeding invoice balance are rejected. Outstanding amount cannot become negative. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **Partial Payment Settlement** | `POST /api/v1/billing/payments` | `amount: 2000000` (balance 5M) | **201 Created** | `status: PARTIALLY_PAID`, `outstandingAmount: 3000000.0` | Exact `Decimal(18, 2)` balance subtraction with no floating-point pennies lost. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **Full Payment Settlement** | `POST /api/v1/billing/payments` | `amount: 3000000` (balance 3M) | **201 Created** | `status: PAID`, `outstandingAmount: 0.0` | Invoice transitions to `PAID`. Outstanding balance exactly `0.00`. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **Monthly Billing Idempotency** | `POST /api/v1/billing/invoices/generate-monthly` | Re-run with same `buildingId` & `billing_month` | **200 OK** | `invoices_created: 0`, `invoices_skipped >= 1` | Unique DB constraint `uq_invoice_contract_period` on `(contract_id, billing_month)` prevents duplicate invoices. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |
| **VietQR Webhook Idempotency** | `POST /api/v1/billing/invoices/webhook/vietqr` | Duplicate `transaction_reference` | **200 OK** | `status: DUPLICATE_SKIPPED` | Unique constraint `uq_payment_reference` ensures no double debt-clearing from retried bank webhooks. | `tests/test_billing.py::test_tc_bil_03_vietqr_reconcile` |
| **Webhook Signature Verification** | `POST /api/v1/billing/invoices/webhook/vietqr` | Invalid or missing `X-Webhook-Secret` | **401 Unauthorized** | `INVALID_WEBHOOK_SECRET` | Secret validation enforced in production; secret length minimum 16 characters. | `tests/test_billing.py::test_tc_bil_03_vietqr_reconcile` |
| **Overlapping Config Protection** | `POST /api/v1/buildings/{id}/configurations` | Identical or overlapping `effective_from` | **400 Bad Request** | `CONFIG_CONFLICT` | Pre-check on building configuration versions prevents conflicting utility unit prices. | `tests/test_buildings.py::test_tc_bld_04_overlapping_configuration_rejected` |
| **Double Room Rental Prevention** | `POST /api/v1/contracts` | Room with status `OCCUPIED` | **409 Conflict** | `ROOM_OCCUPIED` | Concurrency and state check ensures a rented room cannot receive another active lease contract. | `tests/test_multitenant_isolation.py::test_financial_integrity_reconcile_and_overpayment_protection` |

---

## 3. Super Admin & Privileged Role Matrix

| Actor Role | Action / Target Resource | Expected Permission | Scope Boundary Enforced |
|:---|:---|:---:|:---|
| `SUPER_ADMIN` | `GET /api/v1/admin/companies` | **Allowed** | Can view and manage all tenant companies in the Homtel platform. |
| `SUPER_ADMIN` | `GET /api/v1/financial/pnl/consolidated` | **Allowed** | Receives cross-portfolio financial summaries across all companies. |
| `SUPER_ADMIN` | `POST /api/v1/buildings` with explicit `company_id` | **Allowed** | Can provision infrastructure for any registered company. |
| `OWNER` | `GET /api/v1/financial/pnl/consolidated` | **Scoped** | Scoped strictly to the caller's registered companies; foreign buildings excluded from gross revenue and PnL. |
| `OWNER` | `POST /api/v1/buildings` with foreign `company_id` | **Denied (403)** | Owner is strictly restricted to their own active company memberships. |
| `ANONYMOUS` | `GET /api/v1/operations/rooms/{id}/360` | **Masked (200)** | Public listing data only (room number, price, amenities); all tenant names, phone numbers, and debts omitted. |
| `AUTHENTICATED (Non-owner)` | `GET /api/v1/operations/rooms/{id}/360` | **Denied (403)** | If an authenticated tenant or owner does not belong to the room, access is strictly forbidden with 403. |
