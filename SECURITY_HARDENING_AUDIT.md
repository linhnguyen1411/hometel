# HOMTEL — SECURITY & DATA INTEGRITY HARDENING AUDIT

**Audit Date**: September 17, 2026  
**Auditor**: Antigravity Autonomous Security Engineer  
**Scope**: Backend (FastAPI, SQLAlchemy 2 Async, PostgreSQL, Alembic), Frontend (Next.js 16, TypeScript), and Multi-Tenant Boundaries.  
**Target Architecture**: Modular Monolith with zero cross-tenant leakage, strict state-machine transitions, and database-level financial integrity.

---

## 1. Executive Summary

| Priority | Count | Description | Risk Impact |
|:---|:---:|:---|:---|
| **P0 (Critical)** | 8 | Cross-tenant data leakage, unvalidated company assignment, missing multi-tenant scoping in aggregations & 360 views, arbitrary cross-tenant room/expense modifications. | Total compromise of tenant data privacy, unauthorized financial manipulation, cross-company data leakage. |
| **P1 (High)** | 7 | Floating-point currency calculations, missing database unique constraints on invoices & payments, startup DDL execution (`create_all`), client-controlled company ID injection, negative/overpayments. | Financial reconciliation failure, double-billing race conditions, schema desynchronization. |
| **P2 (Medium)** | 5 | Deprecated `datetime.utcnow()` usage across 8+ modules, lack of non-overlapping building configuration version validation, room reservation concurrency race conditions. | Date-time skew bugs, configuration ambiguity, double-booking under concurrent load. |
| **P3 (Low)** | 4 | Obsolete dependencies in `package.json` (Express, Vite), unignored cache directories in `.gitignore`, hardcoded proxy URLs in Next.js rewrites, loose `any` types in frontend service API. | Developer hygiene, deployment friction, bundle bloat. |

---

## 2. Vulnerability Catalog

### Finding SEC-01: Today Cockpit Aggregates Entire Database Without Company Scoping
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/operations/router.py`
- **Location**: `GET /operations/today` (lines 53–60)
- **Attack Scenario**: An authenticated Owner or Staff from Company A calls `GET /api/v1/operations/today`. The underlying query selects all overdue invoices, pending bookings, and rooms without filtering by `company_id`. The Owner of Company A views tenant names, phone numbers, debt amounts, and room numbers belonging to Company B and Company C.
- **Required Fix**: Scope all invoice, contract, and room subqueries by `current_user`'s authorized company memberships (`WHERE Invoice.company_id.in_(user_company_ids)`).
- **Test Case**: `test_multitenant_isolation.py::test_company_a_owner_cannot_see_company_b_in_cockpit`

---

### Finding SEC-02: Building 360 View Leaks PII Across Companies to Privileged Roles
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/operations/router.py`
- **Location**: `GET /operations/buildings/{building_id}/360` (lines 312–320, 428–434)
- **Attack Scenario**: The check `is_privileged = bool(current_user and current_user.role in ["OWNER", "STAFF", "SUPER_ADMIN"])` checks role globally without asserting that the user belongs to the building's company. An Owner from Company B queries Company A's building ID and receives unmasked tenant names, phone numbers, emails, contract dates, and rental amounts.
- **Required Fix**: Enforce `assert_building_access(db, current_user, building_id)`. If the user is an Owner/Staff but does not own the building, return `403 Forbidden` or non-disclosing `404 Not Found`.
- **Test Case**: `test_multitenant_isolation.py::test_company_b_owner_denied_access_to_company_a_building_360`

---

### Finding SEC-03: Room 360 View Accessible Across Companies & Unscoped Tenants
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/operations/router.py`
- **Location**: `GET /operations/rooms/{room_id}/360` (lines 480–522)
- **Attack Scenario**: Any authenticated Owner or Staff can view the full financial timeline, meters, active contracts, and unmasked tenant contact information of any room in the database. Furthermore, a Tenant from another apartment can inspect arbitrary room details.
- **Required Fix**: Enforce `assert_room_access(db, current_user, room_id)`. For tenants, verify `tenant_id == current_user.userId`. For Owners/Staff, verify `room.company_id in user_companies`.
- **Test Case**: `test_multitenant_isolation.py::test_room_360_cross_tenant_and_cross_company_isolation`

---

### Finding SEC-04: Cross-Tenant Lead Data Exposure in CRM
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/crm/router.py`
- **Location**: `GET /crm/leads/{lead_id}` (lines 84–95)
- **Attack Scenario**: `GET /crm/leads/{lead_id}` fetches `Lead` solely by `lead_id` without verifying the owner's company membership. An attacker enumerates lead IDs to scrape prospects, phone numbers, budgets, and email addresses of competing property operators.
- **Required Fix**: Check `lead.company_id in get_user_company_ids(current_user)` (or allow `SUPER_ADMIN`). Return `404 Not Found` or `403 Forbidden`.
- **Test Case**: `test_multitenant_isolation.py::test_cross_company_lead_inspection_rejected`

---

### Finding SEC-05: Cross-Company Expense Leakage and Forgery
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/finance/router.py`
- **Location**: `GET /financial/expenses` (lines 188–196) and `POST /financial/expenses` (lines 225–248)
- **Attack Scenario**: In `GET /financial/expenses`, if `buildingId` is passed, the company filter is bypassed entirely. An attacker reads all vendor names, amounts, and receipt URLs for any building. In `POST /financial/expenses`, an attacker submits expenses against any building ID without company ownership checks, corrupting the victim company's PnL.
- **Required Fix**: Enforce `assert_building_access` for both listing and creating expenses.
- **Test Case**: `test_multitenant_isolation.py::test_cannot_read_or_create_expenses_for_foreign_building`

---

### Finding SEC-06: Unrestricted Cross-Tenant Service Request Access & Review Hijacking
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/services/router.py`
- **Location**: `GET /service-requests/{request_id}` (lines 282–292), `POST /service-requests/{request_id}/review` (lines 311–320), `POST /reviews` (lines 420–445)
- **Attack Scenario**: `GET /service-requests/{request_id}` returns sensitive maintenance records without authorization. `POST /service-requests/{request_id}/review` allows any Provider to approve or reject other providers' work orders. In `POST /reviews`, any tenant can submit reviews on requests they never created.
- **Required Fix**: Enforce `assert_service_request_access`. Verify tenant ownership for review submission.
- **Test Case**: `test_multitenant_isolation.py::test_service_request_and_review_tenant_ownership`

---

### Finding SEC-07: Cross-Provider Staff Assignment Vulnerability
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/services/router.py`
- **Location**: `POST /service-requests/{request_id}/assign` (lines 341–365)
- **Attack Scenario**: A provider assigns a staff member from a competing provider company to a service request. The system does not verify that `payload.staffId` is an active employee of `r.provider_company_id`.
- **Required Fix**: Add `assert_staff_assignment`: Verify that `staff_id` has an active `CompanyMembership` with role `STAFF` belonging to the specific `provider_company_id`.
- **Test Case**: `test_multitenant_isolation.py::test_cross_provider_staff_assignment_forbidden`

---

### Finding SEC-08: Untrusted Client `companyId` & Fallback to Hardcoded `"comp_homtel"`
- **Classification**: **P0 (Critical)**
- **File**: `backend/app/modules/rentals/router.py` (line 299), `backend/app/modules/properties/router.py` (lines 274, 533)
- **Attack Scenario**: When creating contracts or importing buildings, if `payload.companyId` is supplied, it is trusted directly without verifying that `current_user` belongs to that company. If absent, it silently falls back to `"comp_homtel"`. An attacker can forge contracts under any victim company.
- **Required Fix**: Derive `company_id` strictly from authenticated memberships; if the client provides a `companyId`, verify it exists in `user.memberships`; reject with `403 Forbidden` if mismatched; remove all `"comp_homtel"` fallbacks.
- **Test Case**: `test_multitenant_isolation.py::test_reject_mismatched_client_company_id`

---

### Finding SEC-09: Currency Fields Stored as Floating Point (`Float`)
- **Classification**: **P1 (High)**
- **File**: `backend/app/modules/billing/models.py`, `rentals/models.py`, `finance/models.py`, `services/models.py`
- **Location**: `Invoice.subtotal`, `Invoice.total`, `Invoice.paid_amount`, `Invoice.outstanding_amount`, `InvoiceItem.unit_price`, `InvoiceItem.amount`, `Payment.amount`, `RentalContract.rent_amount`, `BuildingExpense.amount`, `Service.base_price`
- **Attack Scenario / Integrity Risk**: Floating-point representation causes fractional cent rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`), leading to calculation drift where `paid_amount != total` even when fully paid, or negative penny remainders.
- **Required Fix**: Convert columns in SQLAlchemy models to `Numeric(18, 2)`. Compute financial amounts using Python `decimal.Decimal`.
- **Test Case**: `test_billing.py::test_financial_numeric_precision`

---

### Finding SEC-10: Lack of Database Unique Constraint on Invoice Billing Month
- **Classification**: **P1 (High)**
- **File**: `backend/app/modules/billing/models.py`
- **Location**: `Invoice` table schema
- **Attack Scenario**: If two staff members trigger `generate-monthly` simultaneously, or if a meter reading is recorded concurrently with batch invoice generation, both check if an invoice exists, find none, and insert two identical invoices for the same room and billing month. The tenant receives duplicate bills.
- **Required Fix**: Add `UniqueConstraint("contract_id", "billing_month", name="uq_invoice_contract_period")` in `Invoice.__table_args__` and enforce it in PostgreSQL.
- **Test Case**: `test_billing.py::test_concurrent_invoice_generation_idempotency`

---

### Finding SEC-11: Payment Overpayment and Negative Amount Bypass
- **Classification**: **P1 (High)**
- **File**: `backend/app/modules/billing/router.py`
- **Location**: `POST /payments` (lines 703–742)
- **Attack Scenario**: A client submits a payment with `amount: -500000` or `amount: 999999999` exceeding `inv.outstanding_amount`. Negative amounts reduce paid balance, while excessive amounts cause negative debt (`outstanding_amount` capped at 0 while `paid_amount` balloons).
- **Required Fix**: Validate `payload.amount > 0`. Assert `payload.amount <= inv.outstanding_amount`. Reject with `400 Bad Request` if violated. Add `CheckConstraint("amount > 0", name="chk_payment_amount_positive")` to `Payment` table.
- **Test Case**: `test_billing.py::test_payment_rejects_negative_or_overpayment`

---

### Finding SEC-12: Concurrency Race Condition on Duplicate Payment Webhook
- **Classification**: **P1 (High)**
- **File**: `backend/app/modules/billing/models.py` & `router.py`
- **Location**: `Payment.transaction_reference`
- **Attack Scenario**: Network retries from VietQR send duplicate webhook requests within milliseconds. The in-memory check `select(Payment).where(...)` passes simultaneously on two async workers before either commits, inserting two payments for the same transaction reference and double-crediting the tenant.
- **Required Fix**: Add `UniqueConstraint("transaction_reference", name="uq_payment_reference")` on the `payments` table.
- **Test Case**: `test_billing.py::test_webhook_payment_idempotency_database_constraint`

---

### Finding SEC-13: Lifespan Schema Generation via `Base.metadata.create_all()`
- **Classification**: **P1 (High)**
- **File**: `backend/app/main.py`
- **Location**: `lifespan` function (lines 38–41)
- **Attack Scenario / Operational Risk**: `Base.metadata.create_all()` runs on every application startup. In clustered or multi-pod deployments, concurrent DDL execution causes database deadlocks and table-level locks. Moreover, it bypasses Alembic migration history, leaving schema state untracked.
- **Required Fix**: Replace `Base.metadata.create_all` with a lightweight connectivity check (`await conn.execute(text("SELECT 1"))`). All DDL must be managed solely via Alembic migrations.
- **Test Case**: Verified by clean application startup without executing DDL statements.

---

### Finding SEC-14: Insecure Secret Fallback in Configuration
- **Classification**: **P1 (High)**
- **File**: `backend/app/core/config.py`
- **Location**: `Settings.VIETQR_WEBHOOK_SECRET` (line 21)
- **Attack Scenario**: If `VIETQR_WEBHOOK_SECRET` defaults to `"vqr_secret_homtel_dev_2026"` in production, an attacker who reads the source code can forge valid payment webhook requests and credit arbitrary invoices without paying.
- **Required Fix**: Add a Pydantic validator ensuring `VIETQR_WEBHOOK_SECRET` is not the default value when `ENVIRONMENT == "production"`.
- **Test Case**: Configuration unit test verifying validation error on default secret in production.

---

### Finding SEC-15: Room Reservation & State Transition Race Condition
- **Classification**: **P2 (Medium)**
- **File**: `backend/app/modules/properties/router.py` & `rentals/router.py`
- **Location**: Room reservation and contract activation
- **Attack Scenario**: Two prospective tenants submit rental applications or sign contracts for the same `AVAILABLE` room at the same time. Both requests inspect `room.status == "AVAILABLE"` and proceed, creating two active contracts for a single room.
- **Required Fix**: Implement atomic status transition: `UPDATE rooms SET status = 'OCCUPIED' WHERE id = :id AND status = 'AVAILABLE' RETURNING id` (or `select(Room).where(...).with_for_update()`). If 0 rows updated, return `409 Conflict`.
- **Test Case**: `test_contracts.py::test_concurrent_room_booking_conflict`

---

### Finding SEC-16: Overlapping Building Configuration Versions
- **Classification**: **P2 (Medium)**
- **File**: `backend/app/modules/properties/router.py`
- **Location**: `POST /buildings/{id}/configurations` (lines 584–618)
- **Attack Scenario**: Adding new utility rate configurations allows arbitrary `effective_from` dates without updating the previous configuration's `effective_to` date. Overlapping configurations create indeterminate utility billing rates for electricity/water meters.
- **Required Fix**: When inserting configuration `version = N+1`, atomically set the previous configuration's `effective_to = new_effective_from - 1 day` and validate that `effective_from > previous.effective_from`.
- **Test Case**: `test_buildings.py::test_building_config_non_overlapping_dates`

---

### Finding SEC-17: Deprecated `datetime.utcnow()` Usage Across 8 Modules
- **Classification**: **P2 (Medium)**
- **File**: `main.py`, `auth/service.py`, `rentals/router.py`, `billing/router.py`, `operations/router.py`, `finance/router.py`, `services/router.py`, `common/schemas.py`
- **Location**: Multiple occurrences causing 833+ pytest deprecation warnings.
- **Integrity Risk**: In Python 3.12+, `datetime.utcnow()` is officially deprecated and produces naive datetime objects without UTC offset, creating subtle timezone bugs when compared with timezone-aware PostgreSQL timestamps.
- **Required Fix**: Replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`.
- **Test Case**: Pytest run with zero deprecation warnings for `datetime.utcnow`.

---

### Finding SEC-18: Frontend Security & Repo Hygiene
- **Classification**: **P3 (Low)**
- **File**: `package.json`, `.gitignore`, `next.config.mjs`, `src/services/api.ts`
- **Findings**:
  1. `package.json` retains unused legacy dependencies (`express`, `cors`, `cookie-parser`, `jsonwebtoken`, `vite`, etc.).
  2. `.gitignore` fails to exclude `.next/`, `__pycache__/`, `.pytest_cache/`, `*.pyc`, `*.tsbuildinfo`.
  3. `next.config.mjs` hardcodes backend destination `http://127.0.0.1:8000` instead of reading `process.env.INTERNAL_API_URL`.
  4. `src/services/api.ts` uses untyped `request<any>`.
- **Required Fix**: Clean `package.json`, update `.gitignore`, use `INTERNAL_API_URL`, and type API methods with domain DTOs.
