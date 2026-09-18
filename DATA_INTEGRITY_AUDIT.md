# HOMTEL — DATA INTEGRITY & FINANCIAL AUDIT

**Audit Date**: September 17, 2026  
**Status**: VERIFIED & PRODUCTION READY  
**Database**: PostgreSQL 16 (Alembic Migration: `3260353f94f7`)  
**ORM**: SQLAlchemy 2.0 Async / Asyncpg  
**Numeric Standard**: `Numeric(18, 2)` / Python `Decimal`  
**Timezone Standard**: `datetime.now(timezone.utc)` (ISO 8601 UTC)

---

## 1. Executive Summary

As part of the P0/P1 Security & Data Integrity Hardening phase, the Homtel backend has transitioned from early prototype data representations to enterprise-grade, deterministic financial storage and state transitions.

Key achievements:
1. **Zero Schema Mutations at Runtime**: Removed `Base.metadata.create_all` from FastAPI startup lifespan. Schema lifecycle is strictly managed via Alembic migrations.
2. **Deterministic Financial Arithmetic**: 100% of monetary and meter columns migrated from IEEE-754 binary floating-point (`Float`) to fixed-point `Numeric(18, 2)`. Python models calculate via `Decimal`, preventing cumulative rounding errors.
3. **Database-Enforced Integrity Constraints**: Hard constraints preventing double-billing, duplicate payment reconciliation, and negative debt manipulation.
4. **Strict Temporal Hygiene**: Zero instances of naive `datetime.utcnow()`. All timestamps are timezone-aware using `datetime.now(timezone.utc)`.
5. **Robust State Machines**: Contract lease lifecycles, service request dispatching, and room occupancy transitions protected against race conditions and invalid state jumps.

---

## 2. Monetary Precision & Currency Columns

Binary floating point representation (`float` / `REAL` / `DOUBLE PRECISION`) introduces inaccuracies such as `0.1 + 0.2 = 0.30000000000000004`, leading to reconciliation errors in banking, VietQR, and accounting ledgers.

Every financial column has been altered to `Numeric(18, 2)` in PostgreSQL and mapped to Python `Decimal`:

| Module | Model Table | Column Name | Previous Type | Hardened Type | Description |
|:---|:---|:---|:---:|:---:|:---|
| **Rentals** | `rental_contracts` | `rent_amount` | `Float` | `Numeric(18, 2)` | Monthly base rental rate |
| **Rentals** | `rental_contracts` | `deposit_amount` | `Float` | `Numeric(18, 2)` | Security deposit held in escrow |
| **Properties** | `building_configurations` | `electricity_unit_price` | `Float` | `Numeric(18, 2)` | Electricity tariff per kWh |
| **Properties** | `building_configurations` | `water_unit_price` | `Float` | `Numeric(18, 2)` | Water tariff per m³ |
| **Properties** | `building_configurations` | `garbage_fee_monthly` | `Float` | `Numeric(18, 2)` | Monthly sanitation service charge |
| **Properties** | `building_configurations` | `internet_fee_monthly` | `Float` | `Numeric(18, 2)` | High-speed internet service charge |
| **Billing** | `invoices` | `subtotal` | `Float` | `Numeric(18, 2)` | Sum of line items before tax |
| **Billing** | `invoices` | `tax` | `Float` | `Numeric(18, 2)` | Value-added tax (VAT) |
| **Billing** | `invoices` | `discount` | `Float` | `Numeric(18, 2)` | Promotional or lease discount |
| **Billing** | `invoices` | `total` | `Float` | `Numeric(18, 2)` | Net billable invoice balance |
| **Billing** | `invoices` | `paid_amount` | `Float` | `Numeric(18, 2)` | Cumulative settled balance |
| **Billing** | `invoices` | `outstanding_amount` | `Float` | `Numeric(18, 2)` | Remaining unpaid balance |
| **Billing** | `invoice_items` | `quantity` | `Float` | `Numeric(18, 2)` | Units consumed / billing cycles |
| **Billing** | `invoice_items` | `unit_price` | `Float` | `Numeric(18, 2)` | Rate per consumption unit |
| **Billing** | `invoice_items` | `amount` | `Float` | `Numeric(18, 2)` | Line item subtotal |
| **Billing** | `payments` | `amount` | `Float` | `Numeric(18, 2)` | Captured transaction amount |
| **Finance** | `building_expenses` | `amount` | `Float` | `Numeric(18, 2)` | Operating & capital expenditures |
| **Services** | `services` | `base_price` | `Float` | `Numeric(18, 2)` | Baseline catalog service price |
| **Services** | `service_requests` | `estimated_cost` | `Float` | `Numeric(18, 2)` | Quoted service estimate |
| **Services** | `service_requests` | `final_cost` | `Float` | `Numeric(18, 2)` | Actual billed service cost |

---

## 3. Database Constraints & Uniqueness Invariants

To prevent race conditions and concurrent double-execution, the following database constraints are active on PostgreSQL:

### 3.1. Monthly Billing Idempotency: `uq_invoice_contract_period`
```sql
ALTER TABLE invoices 
ADD CONSTRAINT uq_invoice_contract_period 
UNIQUE (contract_id, billing_month);
```
- **Guaranteed Invariant**: A lease contract can have at most ONE invoice for a given billing period (e.g. `2026-09`).
- **Protection**: Re-running `/api/v1/billing/invoices/generate-monthly` (e.g., automated cron, operator retry) skips existing invoices without double-billing tenants or crashing the pipeline.

### 3.2. Payment Transaction Uniqueness: `uq_payment_reference`
```sql
ALTER TABLE payments 
ADD CONSTRAINT uq_payment_reference 
UNIQUE (transaction_reference);
```
- **Guaranteed Invariant**: Banking transaction IDs (VietQR, NAPAS, MoMo, Bank Transfer) cannot be recorded more than once.
- **Protection**: Idempotency against network retries or duplicate webhook delivery from payment gateways.

### 3.3. Positive Payment Check: `chk_payment_positive_amount`
```sql
ALTER TABLE payments 
ADD CONSTRAINT chk_payment_positive_amount 
CHECK (amount > 0);
```
- **Guaranteed Invariant**: Payments must be strictly positive amounts (`amount > 0`).
- **Protection**: Precludes negative balance manipulation or balance injection attacks.

---

## 4. Timezone Hygiene & Standardization

In Python 3.12+, `datetime.utcnow()` is deprecated because naive datetime objects cause subtle timezone translation bugs and DST misalignment.

- **Standard Applied**: `datetime.now(timezone.utc)`
- **Audited Modules**:
  - `backend/app/main.py` (database ping & health checks)
  - `backend/app/core/security.py` (JWT expiration & token issuing)
  - `backend/app/modules/billing/router.py` (invoice creation, payment recording, VietQR timestamping)
  - `backend/app/modules/rentals/router.py` (OTP expiry, contract signature timestamp, evidence certificates)
  - `backend/app/modules/services/router.py` (work order assignment, status progression)
  - `backend/app/modules/properties/router.py` (configuration versioning)
  - `backend/app/modules/crm/router.py` (lead creation, tour scheduling)

---

## 5. State Machine Invariants & Validation

### 5.1. Rental Contract State Machine
```
   [DRAFT] 
      │ (Review & Tenant submission)
      ▼
  [PENDING] 
      │ (OTP request -> Electronic signature)
      ▼
  [ACTIVE] ──(Expiration / Notice)──► [EXPIRED] / [TERMINATED]
```
- A contract cannot be signed if it is already `ACTIVE` (returns `409 Conflict`).
- Creating a contract marks the room as `RESERVED`.
- Signing a contract transitions the room to `OCCUPIED`.
- Renewing a contract requires status `ACTIVE` or `EXPIRED`, and enforces `newEndDate > contract.start_date`.

### 5.2. Invoice Billing & Debt Settlement State Machine
```
   [PENDING]
      │
      ├─► Payment = total ──────────────► [PAID] (outstanding: 0.00)
      │
      └─► 0 < Payment < total ──────────► [PARTIALLY_PAID] (recalculated balance)
```
- Overpayments (`amount > outstanding_amount`) are blocked at router level with `400 Bad Request` (`OVERPAYMENT_NOT_ALLOWED`).
- Outstanding balance is computed deterministically: `outstanding = max(0.00, total - paid_amount)`.

### 5.3. Service Request Lifecycle
```
   [PENDING] ──► [APPROVED] ──► [ASSIGNED] ──► [IN_PROGRESS] ──► [COMPLETED]
         │            │
         └────────────┴──────► [REJECTED]
```
- Tenant can only review completed requests they personally initiated (`403 Forbidden` on outsider submissions).
- Provider can only assign personnel registered under their provider company (`assert_staff_assignment`).
