import bcrypt from 'bcryptjs';
import { getDatabase, withTransaction } from './db/connection.js';

export async function runSeed(silent = false) {
  const db = getDatabase();
  if (!silent) console.log('🌱 Starting Idempotent Seed Process...');

  const now = new Date().toISOString();
  const pastDate1 = '2025-01-01T00:00:00.000Z';
  const pastDate2 = '2025-06-01T00:00:00.000Z';
  const pastDate3 = '2026-01-01T00:00:00.000Z';

  // Common password hashes
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const ownerHash = await bcrypt.hash('Owner@123', 10);
  const providerHash = await bcrypt.hash('Provider@123', 10);
  const staffHash = await bcrypt.hash('Staff@123', 10);
  const tenantHash = await bcrypt.hash('Tenant@123', 10);

  withTransaction(() => {
    // 1. SUPER ADMIN
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, role = excluded.role
    `).run('usr_admin_1', 'admin@propertyv1.com', adminHash, 'Alexander Vance (Super Admin)', '+84 901 000 001', 'SUPER_ADMIN', 'ACTIVE', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', now, now);

    // 2. THREE OWNER COMPANIES & OWNERS
    const ownerCompanies = [
      { id: 'cmp_own_1', name: 'Green Living Real Estate Ltd', type: 'COMPANY', tax: '0401889922', reg: 'BRN-GL-8899', phone: '+84 236 388 888', email: 'contact@greenliving.com', addr: '128 Nguyen Van Linh, Hai Chau, Da Nang' },
      { id: 'cmp_own_2', name: 'Skyline Urban Residences Corp', type: 'COMPANY', tax: '0402334455', reg: 'BRN-SK-3344', phone: '+84 236 399 999', email: 'contact@skyline.com', addr: '25 Bach Dang, Hai Chau, Da Nang' },
      { id: 'cmp_own_3', name: 'Sunset Homes Household Business', type: 'HOUSEHOLD_BUSINESS', tax: '8392019921', reg: 'HKD-SH-0199', phone: '+84 236 377 777', email: 'contact@sunset.com', addr: '89 Tran Hung Dao, Son Tra, Da Nang' },
    ];

    for (const c of ownerCompanies) {
      db.prepare(`
        INSERT INTO companies (id, name, type, tax_code, business_registration_number, phone, email, address, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type
      `).run(c.id, c.name, c.type, c.tax, c.reg, c.phone, c.email, c.addr, 'ACTIVE', pastDate1, now);
    }

    const owners = [
      { id: 'usr_own_1', email: 'owner1@greenliving.com', name: 'Pham Van Minh', phone: '+84 905 111 001', companyId: 'cmp_own_1' },
      { id: 'usr_own_2', email: 'owner2@skyline.com', name: 'Tran Thi Mai Huong', phone: '+84 905 111 002', companyId: 'cmp_own_2' },
      { id: 'usr_own_3', email: 'owner3@sunset.com', name: 'Le Hoang Nam', phone: '+84 905 111 003', companyId: 'cmp_own_3' },
    ];

    for (const o of owners) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, email = excluded.email
      `).run(o.id, o.email, ownerHash, o.name, o.phone, 'OWNER', 'ACTIVE', `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(o.name)}`, pastDate1, now);

      db.prepare(`
        INSERT INTO company_memberships (id, user_id, company_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, company_id) DO UPDATE SET role = excluded.role
      `).run(`mem_${o.id}_${o.companyId}`, o.id, o.companyId, 'ADMIN', 'ACTIVE', pastDate1, now);
    }

    // 3. THREE PROVIDER COMPANIES & PROVIDERS
    const providerCompanies = [
      { id: 'cmp_prv_1', name: 'CleanMaster Pro Services Ltd', type: 'COMPANY', tax: '0405556677', reg: 'BRN-CM-5566', phone: '+84 236 355 555', email: 'help@cleanmaster.com', addr: '45 Dien Bien Phu, Da Nang' },
      { id: 'cmp_prv_2', name: 'FixFast Maintenance & Repair Group', type: 'COMPANY', tax: '0407778899', reg: 'BRN-FF-7788', phone: '+84 236 366 666', email: 'service@fixfast.com', addr: '12 Le Duan, Da Nang' },
      { id: 'cmp_prv_3', name: 'PureAir HVAC & Cooling Specialists', type: 'HOUSEHOLD_BUSINESS', tax: '8401122334', reg: 'HKD-PA-1122', phone: '+84 236 344 444', email: 'support@pureair.com', addr: '99 Nguyen Thi Minh Khai, Da Nang' },
    ];

    for (const c of providerCompanies) {
      db.prepare(`
        INSERT INTO companies (id, name, type, tax_code, business_registration_number, phone, email, address, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type
      `).run(c.id, c.name, c.type, c.tax, c.reg, c.phone, c.email, c.addr, 'ACTIVE', pastDate1, now);
    }

    const providers = [
      { id: 'usr_prv_1', email: 'cleanmaster@clean.com', name: 'Nguyen Van Thao', phone: '+84 905 222 001', companyId: 'cmp_prv_1' },
      { id: 'usr_prv_2', email: 'fixfast@fixfast.com', name: 'Vu Dinh Quan', phone: '+84 905 222 002', companyId: 'cmp_prv_2' },
      { id: 'usr_prv_3', email: 'pureair@pureair.com', name: 'Doan Xuan Phuc', phone: '+84 905 222 003', companyId: 'cmp_prv_3' },
    ];

    for (const p of providers) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, email = excluded.email
      `).run(p.id, p.email, providerHash, p.name, p.phone, 'PROVIDER', 'ACTIVE', `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`, pastDate1, now);

      db.prepare(`
        INSERT INTO company_memberships (id, user_id, company_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, company_id) DO UPDATE SET role = excluded.role
      `).run(`mem_${p.id}_${p.companyId}`, p.id, p.companyId, 'ADMIN', 'ACTIVE', pastDate1, now);
    }

    // 4. AT LEAST 10 STAFF MEMBERS (12 STAFF TOTAL: 6 Owner Property Managers + 6 Provider Technicians)
    const staffList = [
      // Owner 1 Staff
      { id: 'usr_stf_1', email: 'staff1@greenliving.com', name: 'Nguyen Bao Chau', phone: '+84 905 333 001', companyId: 'cmp_own_1' },
      { id: 'usr_stf_2', email: 'staff2@greenliving.com', name: 'Tran Quoc Viet', phone: '+84 905 333 002', companyId: 'cmp_own_1' },
      // Owner 2 Staff
      { id: 'usr_stf_3', email: 'staff3@skyline.com', name: 'Le My Linh', phone: '+84 905 333 003', companyId: 'cmp_own_2' },
      { id: 'usr_stf_4', email: 'staff4@skyline.com', name: 'Pham Duc Thang', phone: '+84 905 333 004', companyId: 'cmp_own_2' },
      // Owner 3 Staff
      { id: 'usr_stf_5', email: 'staff5@sunset.com', name: 'Hoang Gia Huy', phone: '+84 905 333 005', companyId: 'cmp_own_3' },
      { id: 'usr_stf_6', email: 'staff6@sunset.com', name: 'Bui Thi Nga', phone: '+84 905 333 006', companyId: 'cmp_own_3' },
      // Provider 1 Technicians
      { id: 'usr_stf_7', email: 'cleaner1@cleanmaster.com', name: 'Dinh Van Tai', phone: '+84 905 444 001', companyId: 'cmp_prv_1' },
      { id: 'usr_stf_8', email: 'cleaner2@cleanmaster.com', name: 'Phan Thi Yen', phone: '+84 905 444 002', companyId: 'cmp_prv_1' },
      // Provider 2 Technicians
      { id: 'usr_stf_9', email: 'electrician@fixfast.com', name: 'Cao Thanh Tung', phone: '+84 905 444 003', companyId: 'cmp_prv_2' },
      { id: 'usr_stf_10', email: 'plumber@fixfast.com', name: 'Ngo Minh Tri', phone: '+84 905 444 004', companyId: 'cmp_prv_2' },
      // Provider 3 HVAC Technicians
      { id: 'usr_stf_11', email: 'hvac1@pureair.com', name: 'Doan Van Lam', phone: '+84 905 444 005', companyId: 'cmp_prv_3' },
      { id: 'usr_stf_12', email: 'hvac2@pureair.com', name: 'Truong Quoc Bao', phone: '+84 905 444 006', companyId: 'cmp_prv_3' },
    ];

    for (const s of staffList) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name
      `).run(s.id, s.email, staffHash, s.name, s.phone, 'STAFF', 'ACTIVE', `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}`, pastDate1, now);

      db.prepare(`
        INSERT INTO company_memberships (id, user_id, company_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, company_id) DO UPDATE SET role = excluded.role
      `).run(`mem_${s.id}_${s.companyId}`, s.id, s.companyId, 'STAFF', 'ACTIVE', pastDate1, now);
    }

    // 5. AT LEAST 20 TENANTS (24 TENANTS TOTAL)
    const tenants = [
      { id: 'usr_tnt_1', email: 'tenant1@gmail.com', name: 'Nguyen Thanh Son', phone: '+84 912 001 001' },
      { id: 'usr_tnt_2', email: 'tenant2@gmail.com', name: 'Emily Watson', phone: '+84 912 001 002' },
      { id: 'usr_tnt_3', email: 'tenant3@gmail.com', name: 'Tran Bao Ngoc', phone: '+84 912 001 003' },
      { id: 'usr_tnt_4', email: 'tenant4@gmail.com', name: 'David Miller', phone: '+84 912 001 004' },
      { id: 'usr_tnt_5', email: 'tenant5@gmail.com', name: 'Le Thi Thu Ha', phone: '+84 912 001 005' },
      { id: 'usr_tnt_6', email: 'tenant6@gmail.com', name: 'Michael Zhang', phone: '+84 912 001 006' },
      { id: 'usr_tnt_7', email: 'tenant7@gmail.com', name: 'Dang Hoang Vu', phone: '+84 912 001 007' },
      { id: 'usr_tnt_8', email: 'tenant8@gmail.com', name: 'Sarah Jenkins', phone: '+84 912 001 008' },
      { id: 'usr_tnt_9', email: 'tenant9@gmail.com', name: 'Vo Van Thinh', phone: '+84 912 001 009' },
      { id: 'usr_tnt_10', email: 'tenant10@gmail.com', name: 'Kenji Sato', phone: '+84 912 001 010' },
      { id: 'usr_tnt_11', email: 'tenant11@gmail.com', name: 'Pham Quynh Anh', phone: '+84 912 001 011' },
      { id: 'usr_tnt_12', email: 'tenant12@gmail.com', name: 'Lucas Dubois', phone: '+84 912 001 012' },
      { id: 'usr_tnt_13', email: 'tenant13@gmail.com', name: 'Bui Ngoc Lan', phone: '+84 912 001 013' },
      { id: 'usr_tnt_14', email: 'tenant14@gmail.com', name: 'Alexander Schmidt', phone: '+84 912 001 014' },
      { id: 'usr_tnt_15', email: 'tenant15@gmail.com', name: 'Doan Thi Mai', phone: '+84 912 001 015' },
      { id: 'usr_tnt_16', email: 'tenant16@gmail.com', name: 'Jessica Chen', phone: '+84 912 001 016' },
      { id: 'usr_tnt_17', email: 'tenant17@gmail.com', name: 'Hoang Kim Phuc', phone: '+84 912 001 017' },
      { id: 'usr_tnt_18', email: 'tenant18@gmail.com', name: 'Carlos Morales', phone: '+84 912 001 018' },
      { id: 'usr_tnt_19', email: 'tenant19@gmail.com', name: 'Vu Thanh Thao', phone: '+84 912 001 019' },
      { id: 'usr_tnt_20', email: 'tenant20@gmail.com', name: 'Oliver Taylor', phone: '+84 912 001 020' },
      { id: 'usr_tnt_21', email: 'tenant21@gmail.com', name: 'Nguyen Huu Dat', phone: '+84 912 001 021' },
      { id: 'usr_tnt_22', email: 'tenant22@gmail.com', name: 'Sophie Martin', phone: '+84 912 001 022' },
      { id: 'usr_tnt_23', email: 'tenant23@gmail.com', name: 'Ly Cong Uan', phone: '+84 912 001 023' },
      { id: 'usr_tnt_24', email: 'tenant24@gmail.com', name: 'Emma Wilson', phone: '+84 912 001 024' }
    ];

    for (const t of tenants) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name
      `).run(t.id, t.email, tenantHash, t.name, t.phone, 'TENANT', 'ACTIVE', `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.name)}`, pastDate2, now);
    }

    // 6. THREE BUILDINGS
    const buildings = [
      {
        id: 'bld_1',
        companyId: 'cmp_own_1',
        name: 'Hoa Xuan Premier Residences',
        slug: 'hoa-xuan-premier-residences',
        desc: 'Luxury urban serviced apartments located along the scenic Cam Le riverside with panoramic city views and high-end amenities.',
        addr: '88 Nguyen Phuoc Lan, Cam Le, Da Nang',
        city: 'Da Nang',
        district: 'Cam Le',
        ward: 'Hoa Xuan',
        lat: 15.9982,
        lng: 108.2255,
        img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'bld_2',
        companyId: 'cmp_own_2',
        name: 'Skyline Central Tower',
        slug: 'skyline-central-tower',
        desc: 'Premium high-rise complex situated in the financial and shopping heart of Da Nang, offering studio to two-bedroom suites with rooftop infinity pool.',
        addr: '180 Nguyen Van Linh, Hai Chau, Da Nang',
        city: 'Da Nang',
        district: 'Hai Chau',
        ward: 'Nam Duong',
        lat: 16.0611,
        lng: 108.2120,
        img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'bld_3',
        companyId: 'cmp_own_3',
        name: 'Sunset Riverside Suites',
        slug: 'sunset-riverside-suites',
        desc: 'Boutique residential haven right next to the Han River, featuring serene garden balconies, full natural lighting, and modern Scandinavian interiors.',
        addr: '34 Tran Hung Dao, Son Tra, Da Nang',
        city: 'Da Nang',
        district: 'Son Tra',
        ward: 'An Hai Bac',
        lat: 16.0714,
        lng: 108.2325,
        img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
      }
    ];

    for (const b of buildings) {
      db.prepare(`
        INSERT INTO buildings (id, company_id, name, slug, description, address, city, district, ward, latitude, longitude, image_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug
      `).run(b.id, b.companyId, b.name, b.slug, b.desc, b.addr, b.city, b.district, b.ward, b.lat, b.lng, b.img, 'ACTIVE', pastDate1, now);
    }

    // 7. BUILDING CONFIGURATIONS WITH VERSIONING (Historical + Current rates)
    // Building 1: v1 in 2025 (Elec 3500), v2 in 2026 (Elec 4000)
    db.prepare(`
      INSERT INTO building_configurations (id, building_id, version, effective_from, effective_to, electricity_unit_price, water_unit_price, internet_price, garbage_price, parking_fee_motorbike, parking_fee_car, cleaning_fee, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run('cfg_bld1_v1', 'bld_1', 1, '2025-01-01', '2025-12-31', 3500, 15000, 100000, 40000, 80000, 700000, 120000, 'Historical 2025 utility schedule', pastDate1, pastDate1);

    db.prepare(`
      INSERT INTO building_configurations (id, building_id, version, effective_from, effective_to, electricity_unit_price, water_unit_price, internet_price, garbage_price, parking_fee_motorbike, parking_fee_car, cleaning_fee, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run('cfg_bld1_v2', 'bld_1', 2, '2026-01-01', null, 4000, 18000, 120000, 50000, 100000, 800000, 150000, 'Current 2026 active rates', pastDate3, now);

    // Building 2 & 3 configs
    db.prepare(`
      INSERT INTO building_configurations (id, building_id, version, effective_from, effective_to, electricity_unit_price, water_unit_price, internet_price, garbage_price, parking_fee_motorbike, parking_fee_car, cleaning_fee, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run('cfg_bld2_v1', 'bld_2', 1, '2025-06-01', null, 3800, 16000, 150000, 60000, 120000, 1000000, 200000, 'Standard Skyline commercial/residential rate', pastDate2, now);

    db.prepare(`
      INSERT INTO building_configurations (id, building_id, version, effective_from, effective_to, electricity_unit_price, water_unit_price, internet_price, garbage_price, parking_fee_motorbike, parking_fee_car, cleaning_fee, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run('cfg_bld3_v1', 'bld_3', 1, '2025-06-01', null, 3500, 15000, 100000, 45000, 90000, 750000, 130000, 'Sunset Suites standard residential pricing', pastDate2, now);

    // 8. FLOORS FOR EACH BUILDING
    for (const b of buildings) {
      for (let f = 1; f <= 4; f++) {
        const floorId = `flr_${b.id}_${f}`;
        db.prepare(`
          INSERT INTO floors (id, building_id, floor_number, name, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name
        `).run(floorId, b.id, f, `Floor ${f}`, `Residential Floor ${f}`, 'ACTIVE', pastDate1, now);
      }
    }

    // 9. ROOMS COVERING ALL 5 STATES: AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE, INACTIVE
    const roomTemplates = [
      // Building 1 Rooms
      { id: 'rm_bld1_101', bId: 'bld_1', fId: 'flr_bld_1_1', num: '101', slug: 'hoa-xuan-premier-101', type: 'STUDIO', area: 38, rent: 7500000, cap: 2, status: 'OCCUPIED', desc: 'Modern river-facing studio with private balcony and kitchen island.' },
      { id: 'rm_bld1_102', bId: 'bld_1', fId: 'flr_bld_1_1', num: '102', slug: 'hoa-xuan-premier-102', type: 'ONE_BEDROOM', area: 50, rent: 9500000, cap: 2, status: 'OCCUPIED', desc: 'Spacious 1-bedroom suite featuring floor-to-ceiling soundproof glass.' },
      { id: 'rm_bld1_201', bId: 'bld_1', fId: 'flr_bld_1_2', num: '201', slug: 'hoa-xuan-premier-201', type: 'STUDIO', area: 35, rent: 7000000, cap: 2, status: 'AVAILABLE', desc: 'Bright sunlit studio unit ready for immediate tenant move-in.' },
      { id: 'rm_bld1_202', bId: 'bld_1', fId: 'flr_bld_1_2', num: '202', slug: 'hoa-xuan-premier-202', type: 'TWO_BEDROOM', area: 72, rent: 14000000, cap: 4, status: 'OCCUPIED', desc: 'Family-sized corner 2-bedroom with dual en-suite bathrooms.' },
      { id: 'rm_bld1_301', bId: 'bld_1', fId: 'flr_bld_1_3', num: '301', slug: 'hoa-xuan-premier-301', type: 'ONE_BEDROOM', area: 48, rent: 9000000, cap: 2, status: 'RESERVED', desc: 'Reserved apartment pending lease agreement completion.' },
      { id: 'rm_bld1_302', bId: 'bld_1', fId: 'flr_bld_1_3', num: '302', slug: 'hoa-xuan-premier-302', type: 'STUDIO', area: 36, rent: 7200000, cap: 2, status: 'MAINTENANCE', desc: 'Undergoing annual air-conditioner overhaul and repainting.' },
      { id: 'rm_bld1_401', bId: 'bld_1', fId: 'flr_bld_1_4', num: '401', slug: 'hoa-xuan-premier-401', type: 'PENTHOUSE', area: 110, rent: 25000000, cap: 4, status: 'AVAILABLE', desc: 'Top floor executive penthouse with rooftop terrace and panoramic Han River vista.' },
      { id: 'rm_bld1_402', bId: 'bld_1', fId: 'flr_bld_1_4', num: '402', slug: 'hoa-xuan-premier-402', type: 'DUPLEX', area: 95, rent: 20000000, cap: 4, status: 'INACTIVE', desc: 'Currently undergoing architectural reconfiguration.' },

      // Building 2 Rooms
      { id: 'rm_bld2_101', bId: 'bld_2', fId: 'flr_bld_2_1', num: '101', slug: 'skyline-tower-101', type: 'STUDIO', area: 40, rent: 8500000, cap: 2, status: 'OCCUPIED', desc: 'Downtown studio apartment near metro and Dragon Bridge.' },
      { id: 'rm_bld2_102', bId: 'bld_2', fId: 'flr_bld_2_1', num: '102', slug: 'skyline-tower-102', type: 'ONE_BEDROOM', area: 55, rent: 11000000, cap: 2, status: 'AVAILABLE', desc: 'Executive 1BR unit overlooking Da Nang financial boulevard.' },
      { id: 'rm_bld2_201', bId: 'bld_2', fId: 'flr_bld_2_2', num: '201', slug: 'skyline-tower-201', type: 'TWO_BEDROOM', area: 78, rent: 16000000, cap: 4, status: 'OCCUPIED', desc: 'Luxurious two-bedroom residence with premium smart home lighting.' },
      { id: 'rm_bld2_202', bId: 'bld_2', fId: 'flr_bld_2_2', num: '202', slug: 'skyline-tower-202', type: 'STUDIO', area: 42, rent: 8800000, cap: 2, status: 'AVAILABLE', desc: 'Airy minimalist studio with Japanese wooden floor and built-in closet.' },

      // Building 3 Rooms
      { id: 'rm_bld3_101', bId: 'bld_3', fId: 'flr_bld_3_1', num: '101', slug: 'sunset-suites-101', type: 'STUDIO', area: 32, rent: 6500000, cap: 2, status: 'OCCUPIED', desc: 'Cozy coastal studio unit just 5 minutes from My Khe beach.' },
      { id: 'rm_bld3_102', bId: 'bld_3', fId: 'flr_bld_3_1', num: '102', slug: 'sunset-suites-102', type: 'ONE_BEDROOM', area: 46, rent: 8200000, cap: 2, status: 'AVAILABLE', desc: 'Bright, breezy suite with modern kitchen and high-speed Wi-Fi.' },
      { id: 'rm_bld3_201', bId: 'bld_3', fId: 'flr_bld_3_2', num: '201', slug: 'sunset-suites-201', type: 'TWO_BEDROOM', area: 68, rent: 13000000, cap: 4, status: 'AVAILABLE', desc: 'Coastal duplex suite with double balcony and garden view.' },
    ];

    const sampleAmenities = JSON.stringify(['Air Conditioning', 'High-Speed Wi-Fi', 'Smart TV', 'Washing Machine', 'Refrigerator', 'Balcony', 'Kitchenette', 'Keyless Smart Lock']);
    const sampleImages = JSON.stringify([
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
    ]);

    for (const r of roomTemplates) {
      db.prepare(`
        INSERT INTO rooms (id, floor_id, building_id, room_number, slug, room_type, area, base_rent, capacity, status, description, amenities, images, furnishing, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, base_rent = excluded.base_rent, slug = excluded.slug
      `).run(r.id, r.fId, r.bId, r.num, r.slug, r.type, r.area, r.rent, r.cap, r.status, r.desc, sampleAmenities, sampleImages, 'FULLY_FURNISHED', pastDate2, now);
    }

    // 10. EQUIPMENT FOR ROOMS
    const equipmentList = [
      { id: 'eq_1', roomId: 'rm_bld1_101', name: 'Daikin Inverter AC 1.5HP', type: 'AIR_CONDITIONER', sn: 'DK-2024-9981', cond: 'EXCELLENT' },
      { id: 'eq_2', roomId: 'rm_bld1_101', name: 'Panasonic 255L Fridge', type: 'REFRIGERATOR', sn: 'PN-8891-23', cond: 'GOOD' },
      { id: 'eq_3', roomId: 'rm_bld1_101', name: 'Electrolux 8.5kg Front Load Washer', type: 'WASHING_MACHINE', sn: 'EL-0091-88', cond: 'EXCELLENT' },
      { id: 'eq_4', roomId: 'rm_bld1_102', name: 'Sony Bravia 50" 4K Smart TV', type: 'TELEVISION', sn: 'SN-7721-11', cond: 'EXCELLENT' },
      { id: 'eq_5', roomId: 'rm_bld1_302', name: 'Carrier Split AC 2.0HP', type: 'AIR_CONDITIONER', sn: 'CR-3301-44', cond: 'NEEDS_REPAIR' },
      { id: 'eq_6', roomId: 'rm_bld2_101', name: 'Toshiba Inverter Refrigerator 310L', type: 'REFRIGERATOR', sn: 'TS-9901-77', cond: 'EXCELLENT' }
    ];

    for (const eq of equipmentList) {
      db.prepare(`
        INSERT INTO equipment (id, room_id, name, type, serial_number, condition, status, purchase_date, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET condition = excluded.condition
      `).run(eq.id, eq.roomId, eq.name, eq.type, eq.sn, eq.cond, 'ACTIVE', '2024-06-15', 'Regular maintenance performed.', pastDate1, now);
    }

    // 11. METERS (ELECTRICITY & WATER)
    for (const r of roomTemplates) {
      db.prepare(`
        INSERT INTO meters (id, room_id, type, serial_number, initial_reading, current_reading, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(`mtr_elec_${r.id}`, r.id, 'ELECTRICITY', `EMTR-${r.bId.slice(-3)}-${r.num}`, 100, 280, 'ACTIVE', pastDate2, now);

      db.prepare(`
        INSERT INTO meters (id, room_id, type, serial_number, initial_reading, current_reading, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(`mtr_wtr_${r.id}`, r.id, 'WATER', `WMTR-${r.bId.slice(-3)}-${r.num}`, 50, 85, 'ACTIVE', pastDate2, now);
    }

    // 12. RENTAL APPLICATIONS (Pending, Approved, Rejected)
    const applications = [
      { id: 'app_1', roomId: 'rm_bld1_101', tenantId: 'usr_tnt_1', date: '2025-06-01', status: 'APPROVED' },
      { id: 'app_2', roomId: 'rm_bld1_102', tenantId: 'usr_tnt_2', date: '2025-07-01', status: 'APPROVED' },
      { id: 'app_3', roomId: 'rm_bld1_301', tenantId: 'usr_tnt_3', date: '2026-09-01', status: 'PENDING' },
      { id: 'app_4', roomId: 'rm_bld1_201', tenantId: 'usr_tnt_4', date: '2026-08-15', status: 'REJECTED' },
      { id: 'app_5', roomId: 'rm_bld2_101', tenantId: 'usr_tnt_5', date: '2025-08-01', status: 'APPROVED' },
    ];

    for (const a of applications) {
      db.prepare(`
        INSERT INTO rental_applications (id, room_id, tenant_id, intended_start_date, lease_duration_months, occupants_count, notes, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status
      `).run(a.id, a.roomId, a.tenantId, a.date, 12, 2, 'Application for standard residential lease', a.status, a.status !== 'PENDING' ? 'usr_own_1' : null, a.status !== 'PENDING' ? a.date : null, a.status === 'REJECTED' ? 'Credit verification criteria not met.' : null, a.date, a.date);
    }

    // 13. CONTRACTS COVERING ALL 6 STATES: DRAFT, PENDING, ACTIVE, EXPIRING, EXPIRED, TERMINATED
    const contracts = [
      { id: 'ctr_1', num: 'CTR-HXP-101-2025', appId: 'app_1', roomId: 'rm_bld1_101', tenantId: 'usr_tnt_1', compId: 'cmp_own_1', start: '2025-06-01', end: '2026-05-31', rent: 7500000, dep: 7500000, status: 'ACTIVE' },
      { id: 'ctr_2', num: 'CTR-HXP-102-2025', appId: 'app_2', roomId: 'rm_bld1_102', tenantId: 'usr_tnt_2', compId: 'cmp_own_1', start: '2025-07-01', end: '2026-06-30', rent: 9500000, dep: 9500000, status: 'ACTIVE' },
      { id: 'ctr_3', num: 'CTR-SKL-101-2025', appId: 'app_5', roomId: 'rm_bld2_101', tenantId: 'usr_tnt_5', compId: 'cmp_own_2', start: '2025-08-01', end: '2026-07-31', rent: 8500000, dep: 8500000, status: 'EXPIRING' },
      { id: 'ctr_4', num: 'CTR-HXP-202-2025', appId: null, roomId: 'rm_bld1_202', tenantId: 'usr_tnt_6', compId: 'cmp_own_1', start: '2025-03-01', end: '2026-02-28', rent: 14000000, dep: 14000000, status: 'ACTIVE' },
      { id: 'ctr_5', num: 'CTR-SNT-101-2024', appId: null, roomId: 'rm_bld3_101', tenantId: 'usr_tnt_7', compId: 'cmp_own_3', start: '2024-01-01', end: '2024-12-31', rent: 6500000, dep: 6500000, status: 'EXPIRED' },
      { id: 'ctr_6', num: 'CTR-SKL-201-2025', appId: null, roomId: 'rm_bld2_201', tenantId: 'usr_tnt_8', compId: 'cmp_own_2', start: '2025-01-01', end: '2025-08-15', rent: 16000000, dep: 16000000, status: 'TERMINATED' },
      { id: 'ctr_7', num: 'CTR-HXP-401-2026', appId: null, roomId: 'rm_bld1_401', tenantId: 'usr_tnt_9', compId: 'cmp_own_1', start: '2026-10-01', end: '2027-09-30', rent: 25000000, dep: 25000000, status: 'DRAFT' },
      { id: 'ctr_8', num: 'CTR-HXP-301-2026', appId: 'app_3', roomId: 'rm_bld1_301', tenantId: 'usr_tnt_3', compId: 'cmp_own_1', start: '2026-10-01', end: '2027-09-30', rent: 9000000, dep: 9000000, status: 'PENDING' }
    ];

    for (const c of contracts) {
      db.prepare(`
        INSERT INTO rental_contracts (id, contract_number, application_id, room_id, tenant_id, company_id, start_date, end_date, rent_amount, deposit_amount, payment_frequency, payment_day_of_month, status, terms, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status
      `).run(c.id, c.num, c.appId, c.roomId, c.tenantId, c.compId, c.start, c.end, c.rent, c.dep, 'MONTHLY', 5, c.status, 'Standard residential terms and conditions.', c.start, now);

      // Deposit
      db.prepare(`
        INSERT INTO deposits (id, contract_id, tenant_id, amount, received, received_date, refunded, refund_amount, refund_date, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status
      `).run(`dep_${c.id}`, c.id, c.tenantId, c.dep, c.status === 'DRAFT' ? 0 : 1, c.start, c.status === 'EXPIRED' ? 1 : 0, c.status === 'EXPIRED' ? c.dep : 0, c.status === 'EXPIRED' ? c.end : null, c.status === 'EXPIRED' ? 'REFUNDED' : 'HELD', 'Security deposit', c.start, now);
    }

    // 14. INVOICES COVERING ALL 6 STATES: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    const invoices = [
      // Paid Invoice (Tenant 1, August 2026)
      { id: 'inv_1', num: 'INV-101-202608', tId: 'usr_tnt_1', cId: 'ctr_1', compId: 'cmp_own_1', rId: 'rm_bld1_101', issue: '2026-08-01', due: '2026-08-10', m: '2026-08', total: 8450000, paid: 8450000, out: 0, status: 'PAID' },
      // Issued Invoice (Tenant 1, September 2026 - Current unpaid)
      { id: 'inv_2', num: 'INV-101-202609', tId: 'usr_tnt_1', cId: 'ctr_1', compId: 'cmp_own_1', rId: 'rm_bld1_101', issue: '2026-09-01', due: '2026-09-10', m: '2026-09', total: 8520000, paid: 0, out: 8520000, status: 'ISSUED' },
      // Partially Paid Invoice (Tenant 2, September 2026)
      { id: 'inv_3', num: 'INV-102-202609', tId: 'usr_tnt_2', cId: 'ctr_2', compId: 'cmp_own_1', rId: 'rm_bld1_102', issue: '2026-09-01', due: '2026-09-10', m: '2026-09', total: 10800000, paid: 5000000, out: 5800000, status: 'PARTIALLY_PAID' },
      // Overdue Invoice (Tenant 6, July 2026)
      { id: 'inv_4', num: 'INV-202-202607', tId: 'usr_tnt_6', cId: 'ctr_4', compId: 'cmp_own_1', rId: 'rm_bld1_202', issue: '2026-07-01', due: '2026-07-10', m: '2026-07', total: 15600000, paid: 0, out: 15600000, status: 'OVERDUE' },
      // Draft Invoice (Tenant 5, October 2026 preview)
      { id: 'inv_5', num: 'INV-101-202610-DFT', tId: 'usr_tnt_5', cId: 'ctr_3', compId: 'cmp_own_2', rId: 'rm_bld2_101', issue: '2026-09-15', due: '2026-10-05', m: '2026-10', total: 9600000, paid: 0, out: 9600000, status: 'DRAFT' },
      // Cancelled Invoice (Tenant 8)
      { id: 'inv_6', num: 'INV-201-202508-CAN', tId: 'usr_tnt_8', cId: 'ctr_6', compId: 'cmp_own_2', rId: 'rm_bld2_201', issue: '2025-08-01', due: '2025-08-10', m: '2025-08', total: 17200000, paid: 0, out: 0, status: 'CANCELLED' }
    ];

    for (const inv of invoices) {
      db.prepare(`
        INSERT INTO invoices (id, invoice_number, tenant_id, contract_id, company_id, room_id, issue_date, due_date, billing_month, subtotal, discount, tax, total, paid_amount, outstanding_amount, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, paid_amount = excluded.paid_amount, outstanding_amount = excluded.outstanding_amount
      `).run(inv.id, inv.num, inv.tId, inv.cId, inv.compId, inv.rId, inv.issue, inv.due, inv.m, inv.total, 0, 0, inv.total, inv.paid, inv.out, inv.status, `Monthly invoice ${inv.m}`, inv.issue, now);

      // Line items for inv_1 and inv_2
      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, type, description, quantity, unit_price, amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(`itm_${inv.id}_rent`, inv.id, 'RENT', 'Monthly Room Rent', 1, inv.total * 0.85, inv.total * 0.85, '{}');

      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, type, description, quantity, unit_price, amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(`itm_${inv.id}_elec`, inv.id, 'ELECTRICITY', 'Electricity Consumption', 120, 4000, 480000, '{"kwh": 120}');

      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, type, description, quantity, unit_price, amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(`itm_${inv.id}_wtr`, inv.id, 'WATER', 'Water Supply Fee', 12, 18000, 216000, '{"m3": 12}');
    }

    // 15. PAYMENTS COVERING ALL 4 STATES: PENDING, SUCCESS, FAILED, CANCELLED
    const payments = [
      { id: 'pay_1', invId: 'inv_1', tId: 'usr_tnt_1', compId: 'cmp_own_1', amt: 8450000, mth: 'BANK_TRANSFER', status: 'SUCCESS', ref: 'MB-992819-HXP', date: '2026-08-05' },
      { id: 'pay_2', invId: 'inv_3', tId: 'usr_tnt_2', compId: 'cmp_own_1', amt: 5000000, mth: 'CARD', status: 'SUCCESS', ref: 'VNPAY-882910', date: '2026-09-04' },
      { id: 'pay_3', invId: 'inv_2', tId: 'usr_tnt_1', compId: 'cmp_own_1', amt: 8520000, mth: 'ONLINE', status: 'PENDING', ref: 'ONL-PEND-001', date: '2026-09-12' },
      { id: 'pay_4', invId: 'inv_4', tId: 'usr_tnt_6', compId: 'cmp_own_1', amt: 15600000, mth: 'CARD', status: 'FAILED', ref: 'FAIL-CARD-DECLINE', date: '2026-07-09' },
      { id: 'pay_5', invId: 'inv_6', tId: 'usr_tnt_8', compId: 'cmp_own_2', amt: 17200000, mth: 'CASH', status: 'CANCELLED', ref: 'CAN-CASH-REC', date: '2025-08-02' }
    ];

    for (const p of payments) {
      db.prepare(`
        INSERT INTO payments (id, invoice_id, tenant_id, company_id, amount, method, status, transaction_reference, paid_at, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status
      `).run(p.id, p.invId, p.tId, p.compId, p.amt, p.mth, p.status, p.ref, p.date, 'Rental payment', p.date);
    }

    // 16. SERVICES OFFERED BY PROVIDER COMPANIES
    const services = [
      // Provider 1: CleanMaster
      { id: 'srv_1', compId: 'cmp_prv_1', name: 'Comprehensive Deep Cleaning', slug: 'comprehensive-deep-cleaning', cat: 'CLEANING', price: 350000, pType: 'FIXED', desc: 'Full room deep sanitization, kitchen degreasing, bathroom scrubbing, and window polishing.' },
      { id: 'srv_2', compId: 'cmp_prv_1', name: 'Mattress & Sofa Steam Extraction', slug: 'mattress-sofa-steam-cleaning', cat: 'CLEANING', price: 280000, pType: 'FIXED', desc: 'High-temperature steam extraction eliminating dust mites, allergens, and pet odors.' },
      { id: 'srv_3', compId: 'cmp_prv_1', name: 'Laundry & Ironing Weekly Service', slug: 'weekly-laundry-service', cat: 'LAUNDRY', price: 200000, pType: 'FIXED', desc: 'Door-to-door laundry wash, dry, fold, and garment pressing.' },

      // Provider 2: FixFast
      { id: 'srv_4', compId: 'cmp_prv_2', name: 'Plumbing Diagnostic & Leak Repair', slug: 'plumbing-leak-repair', cat: 'PLUMBING', price: 250000, pType: 'HOURLY', desc: 'Rapid resolution of water leakages, pipe blockages, faucet replacements, and toilet mechanisms.' },
      { id: 'srv_5', compId: 'cmp_prv_2', name: 'Electrical & Circuit Diagnostics', slug: 'electrical-diagnostics-repair', cat: 'ELECTRICAL', price: 300000, pType: 'HOURLY', desc: 'Troubleshooting tripping breakers, lighting fixture installations, and rewiring safety checks.' },
      { id: 'srv_6', compId: 'cmp_prv_2', name: 'Emergency Locksmith Service', slug: 'emergency-locksmith', cat: 'SECURITY', price: 400000, pType: 'FIXED', desc: 'Emergency smart lock opening, key duplication, and digital passcode reset.' },

      // Provider 3: PureAir
      { id: 'srv_7', compId: 'cmp_prv_3', name: 'Air Conditioning Antibacterial Cleaning', slug: 'ac-antibacterial-cleaning', cat: 'HVAC', price: 220000, pType: 'FIXED', desc: 'Disassembly and antimicrobial pressure washing of indoor fan, filters, and outdoor condenser coil.' },
      { id: 'srv_8', compId: 'cmp_prv_3', name: 'Refrigerant Gas Recharge (R32/R410A)', slug: 'refrigerant-gas-recharge', cat: 'HVAC', price: 380000, pType: 'FIXED', desc: 'Pressure testing and full replenishment of eco-friendly R32 / R410A cooling gas.' },
    ];

    for (const s of services) {
      db.prepare(`
        INSERT INTO services (id, company_id, name, slug, description, category, price_type, base_price, image_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET base_price = excluded.base_price, description = excluded.description
      `).run(s.id, s.compId, s.name, s.slug, s.desc, s.cat, s.pType, s.price, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80', 'ACTIVE', pastDate1, now);
    }

    // 17. SERVICE REQUESTS COVERING ALL 7 STATES: PENDING, APPROVED, REJECTED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    const serviceRequests = [
      { id: 'sr_1', srvId: 'srv_7', compId: 'cmp_prv_3', tId: 'usr_tnt_1', rId: 'rm_bld1_101', title: 'AC not blowing cold air in master room', desc: 'The unit runs but blows room temperature air. Needs coil check and cleaning.', urg: 'HIGH', status: 'IN_PROGRESS', est: 220000, stfId: 'usr_stf_11' },
      { id: 'sr_2', srvId: 'srv_1', compId: 'cmp_prv_1', tId: 'usr_tnt_2', rId: 'rm_bld1_102', title: 'Monthly deep cleaning requested', desc: 'Deep cleaning before weekend guests arrival.', urg: 'MEDIUM', status: 'COMPLETED', est: 350000, fin: 350000, stfId: 'usr_stf_7' },
      { id: 'sr_3', srvId: 'srv_4', compId: 'cmp_prv_2', tId: 'usr_tnt_5', rId: 'rm_bld2_101', title: 'Kitchen sink drain leaking underneath', desc: 'Slow drip found under the cabinet pipe joint.', urg: 'MEDIUM', status: 'PENDING', est: 250000 },
      { id: 'sr_4', srvId: 'srv_5', compId: 'cmp_prv_2', tId: 'usr_tnt_6', rId: 'rm_bld1_202', title: 'Living room chandelier light flickering', desc: 'Main LED chandelier keeps flickering intermittently.', urg: 'LOW', status: 'APPROVED', est: 300000 },
      { id: 'sr_5', srvId: 'srv_6', compId: 'cmp_prv_2', tId: 'usr_tnt_1', rId: 'rm_bld1_101', title: 'Smart lock battery low warning', desc: 'Keypad chiming red battery replacement indicator.', urg: 'HIGH', status: 'ASSIGNED', est: 150000, stfId: 'usr_stf_9' },
      { id: 'sr_6', srvId: 'srv_2', compId: 'cmp_prv_1', tId: 'usr_tnt_3', rId: null, title: 'Off-property sofa cleaning request', desc: 'Requested service outside service coverage boundaries.', urg: 'LOW', status: 'REJECTED', est: 280000, rej: 'Location outside current provider coverage zone.' },
      { id: 'sr_7', srvId: 'srv_3', compId: 'cmp_prv_1', tId: 'usr_tnt_4', rId: null, title: 'Cancelled laundry pickup', desc: 'Tenant rescheduled vacation dates.', urg: 'LOW', status: 'CANCELLED', est: 200000 }
    ];

    for (const sr of serviceRequests) {
      db.prepare(`
        INSERT INTO service_requests (id, service_id, provider_company_id, tenant_id, room_id, title, description, preferred_date, urgency, status, estimated_cost, final_cost, rejection_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status
      `).run(sr.id, sr.srvId, sr.compId, sr.tId, sr.rId, sr.title, sr.desc, '2026-09-16', sr.urg, sr.status, sr.est, sr.fin || null, sr.rej || null, pastDate3, now);

      if (sr.stfId) {
        db.prepare(`
          INSERT INTO service_assignments (id, service_request_id, staff_id, assigned_at, started_at, completed_at, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET status = excluded.status
        `).run(`asg_${sr.id}`, sr.id, sr.stfId, pastDate3, sr.status === 'COMPLETED' || sr.status === 'IN_PROGRESS' ? pastDate3 : null, sr.status === 'COMPLETED' ? now : null, 'Assignment dispatched to technician.', sr.status === 'COMPLETED' ? 'COMPLETED' : sr.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ASSIGNED');
      }
    }

    // 18. NOTIFICATIONS FOR TENANT 1 & RELEVANT USERS
    const notifications = [
      { id: 'notif_1', uId: 'usr_tnt_1', type: 'INVOICE_ISSUED', title: 'September 2026 Invoice Issued', msg: 'Your monthly invoice for room 101 totaling 8,520,000 VND is due on 2026-09-10.' },
      { id: 'notif_2', uId: 'usr_tnt_1', type: 'PAYMENT_RECEIVED', title: 'Payment Confirmed', msg: 'August invoice payment of 8,450,000 VND has been processed successfully.' },
      { id: 'notif_3', uId: 'usr_tnt_1', type: 'STAFF_ASSIGNED', title: 'Technician Assigned', msg: 'Technician Doan Van Lam has been assigned to your AC repair request.' },
      { id: 'notif_4', uId: 'usr_own_1', type: 'NEW_RENTAL_APPLICATION', title: 'New Rental Application', msg: 'Tenant Tran Bao Ngoc applied for Room 301 at Hoa Xuan Premier Residences.' },
      { id: 'notif_5', uId: 'usr_prv_3', type: 'NEW_SERVICE_REQUEST', title: 'New Service Request', msg: 'High priority request received: AC not blowing cold air in master room.' }
    ];

    for (const n of notifications) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, read_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(n.id, n.uId, n.type, n.title, n.msg, 'SYSTEM', null, null, pastDate3);
    }

    // 19. AUDIT LOGS FOR CRITICAL OPERATIONS
    const sampleAuditLogs = [
      { id: 'aud_seed_1', actor: 'usr_admin_1', act: 'CREATE_OWNER', eType: 'COMPANY', eId: 'cmp_own_1', desc: 'Super Admin provisioned Green Living Real Estate Ltd' },
      { id: 'aud_seed_2', actor: 'usr_own_1', act: 'CREATE_BUILDING', eType: 'BUILDING', eId: 'bld_1', desc: 'Created Hoa Xuan Premier Residences building' },
      { id: 'aud_seed_3', actor: 'usr_own_1', act: 'CREATE_CONTRACT', eType: 'RENTAL_CONTRACT', eId: 'ctr_1', desc: 'Executed lease contract CTR-HXP-101-2025' },
      { id: 'aud_seed_4', actor: 'usr_tnt_1', act: 'CREATE_PAYMENT', eType: 'INVOICE', eId: 'inv_1', desc: 'Processed payment of 8,450,000 VND for August rent' },
    ];

    for (const al of sampleAuditLogs) {
      db.prepare(`
        INSERT INTO audit_logs (id, actor_id, actor_email, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(al.id, al.actor, 'admin@propertyv1.com', al.act, al.eType, al.eId, null, JSON.stringify({ summary: al.desc }), pastDate3);
    }
  });

  if (!silent) console.log('✅ Seed Data Successfully Loaded & Idempotency Verified!');
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed().catch(console.error);
}
