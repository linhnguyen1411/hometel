-- Property Rental Management System V1
-- Production Relational Schema

PRAGMA foreign_keys = ON;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'OWNER', 'PROVIDER', 'TENANT', 'STAFF')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    revoked INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- COMPANIES (Company or Household Business)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('COMPANY', 'HOUSEHOLD_BUSINESS')),
    tax_code TEXT,
    business_registration_number TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);

-- COMPANY MEMBERSHIPS (User <-> Company M:N)
CREATE TABLE IF NOT EXISTS company_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF', 'MANAGER')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);

-- BUILDINGS
CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Da Nang',
    district TEXT,
    ward TEXT,
    latitude REAL,
    longitude REAL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buildings_company ON buildings(company_id);
CREATE INDEX IF NOT EXISTS idx_buildings_slug ON buildings(slug);

-- FLOORS
CREATE TABLE IF NOT EXISTS floors (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(building_id, floor_number)
);

CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);

-- ROOMS
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    room_type TEXT NOT NULL CHECK(room_type IN ('STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'PENTHOUSE', 'DUPLEX')),
    area REAL NOT NULL,
    base_rent REAL NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 2,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'INACTIVE')),
    description TEXT,
    amenities TEXT, -- JSON string array
    images TEXT, -- JSON string array
    furnishing TEXT NOT NULL DEFAULT 'FULLY_FURNISHED' CHECK(furnishing IN ('UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(building_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);

-- EQUIPMENT
CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    serial_number TEXT,
    condition TEXT NOT NULL DEFAULT 'EXCELLENT' CHECK(condition IN ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
    purchase_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_equipment_room ON equipment(room_id);

-- BUILDING CONFIGURATIONS (Versioned recurring charges with effective dates)
CREATE TABLE IF NOT EXISTS building_configurations (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    effective_from TEXT NOT NULL,
    effective_to TEXT, -- NULL means currently active
    electricity_unit_price REAL NOT NULL DEFAULT 3500,
    water_unit_price REAL NOT NULL DEFAULT 15000,
    internet_price REAL NOT NULL DEFAULT 100000,
    garbage_price REAL NOT NULL DEFAULT 50000,
    parking_fee_motorbike REAL NOT NULL DEFAULT 100000,
    parking_fee_car REAL NOT NULL DEFAULT 800000,
    cleaning_fee REAL NOT NULL DEFAULT 150000,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bldg_config ON building_configurations(building_id, effective_from);

-- RENTAL APPLICATIONS
CREATE TABLE IF NOT EXISTS rental_applications (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intended_start_date TEXT NOT NULL,
    lease_duration_months INTEGER NOT NULL DEFAULT 12,
    occupants_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_tenant ON rental_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_room ON rental_applications(room_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON rental_applications(status);

-- RENTAL CONTRACTS
CREATE TABLE IF NOT EXISTS rental_contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT UNIQUE NOT NULL,
    application_id TEXT REFERENCES rental_applications(id),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    rent_amount REAL NOT NULL,
    deposit_amount REAL NOT NULL,
    payment_frequency TEXT NOT NULL DEFAULT 'MONTHLY' CHECK(payment_frequency IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
    payment_day_of_month INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('DRAFT', 'PENDING', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED')),
    terms TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON rental_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_room ON rental_contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON rental_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON rental_contracts(status);

-- DEPOSITS
CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES rental_contracts(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES users(id),
    amount REAL NOT NULL,
    received INTEGER NOT NULL DEFAULT 0, -- 0 or 1
    received_date TEXT,
    refunded INTEGER NOT NULL DEFAULT 0, -- 0 or 1
    refund_amount REAL DEFAULT 0,
    refund_date TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FORFEITED')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deposits_contract ON deposits(contract_id);

-- METERS (Electricity, Water)
CREATE TABLE IF NOT EXISTS meters (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('ELECTRICITY', 'WATER')),
    serial_number TEXT NOT NULL,
    initial_reading REAL NOT NULL DEFAULT 0,
    current_reading REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'FAULTY', 'REPLACED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(room_id, type)
);

CREATE INDEX IF NOT EXISTS idx_meters_room ON meters(room_id);

-- METER READINGS
CREATE TABLE IF NOT EXISTS meter_readings (
    id TEXT PRIMARY KEY,
    meter_id TEXT NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    previous_reading REAL NOT NULL,
    reading_value REAL NOT NULL,
    consumption REAL NOT NULL,
    reading_date TEXT NOT NULL,
    recorded_by TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meter_readings_meter ON meter_readings(meter_id);

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contract_id TEXT NOT NULL REFERENCES rental_contracts(id) ON DELETE RESTRICT,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    billing_month TEXT NOT NULL, -- e.g. '2026-09'
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    outstanding_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- INVOICE ITEMS (Immutable historical breakdown)
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('RENT', 'ELECTRICITY', 'WATER', 'INTERNET', 'GARBAGE', 'PARKING', 'CLEANING', 'OTHER')),
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    metadata TEXT -- JSON string with reading details, rates etc.
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- PAYMENTS (Financial transaction records)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE', 'OTHER')),
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
    transaction_reference TEXT,
    paid_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);

-- SERVICES (Offered by Provider Companies)
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK(category IN ('CLEANING', 'MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HVAC', 'LAUNDRY', 'SECURITY', 'MOVING')),
    price_type TEXT NOT NULL CHECK(price_type IN ('FIXED', 'QUOTATION', 'HOURLY', 'OTHER')),
    base_price REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_company ON services(company_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- SERVICE REQUESTS (Submitted by Tenant)
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    provider_company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    preferred_date TEXT,
    urgency TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(urgency IN ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    estimated_cost REAL,
    final_cost REAL,
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_requests_provider ON service_requests(provider_company_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_tenant ON service_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

-- SERVICE ASSIGNMENTS (Provider staff assigned to request)
CREATE TABLE IF NOT EXISTS service_assignments (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_service_assignments_request ON service_assignments(service_request_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_staff ON service_assignments(staff_id);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value TEXT, -- JSON string
    new_value TEXT, -- JSON string
    ip_address TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
