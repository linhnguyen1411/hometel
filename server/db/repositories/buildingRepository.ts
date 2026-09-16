import { getDatabase } from '../connection.js';

export interface BuildingRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  district: string | null;
  ward: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface FloorRow {
  id: string;
  building_id: string;
  floor_number: number;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: string;
  floor_id: string;
  building_id: string;
  room_number: string;
  slug: string;
  room_type: 'STUDIO' | 'ONE_BEDROOM' | 'TWO_BEDROOM' | 'PENTHOUSE' | 'DUPLEX';
  area: number;
  base_rent: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'INACTIVE';
  description: string | null;
  amenities: string | null; // JSON string
  images: string | null; // JSON string
  furnishing: 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';
  created_at: string;
  updated_at: string;
}

export interface EquipmentRow {
  id: string;
  room_id: string;
  name: string;
  type: string;
  serial_number: string | null;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR';
  status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildingConfigRow {
  id: string;
  building_id: string;
  version: number;
  effective_from: string;
  effective_to: string | null;
  electricity_unit_price: number;
  water_unit_price: number;
  internet_price: number;
  garbage_price: number;
  parking_fee_motorbike: number;
  parking_fee_car: number;
  cleaning_fee: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class BuildingRepository {
  // Buildings
  static findBuildingById(id: string): BuildingRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM buildings WHERE id = ?');
    return (stmt.get(id) as BuildingRow) || null;
  }

  static findBuildingBySlug(slug: string): BuildingRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM buildings WHERE slug = ?');
    return (stmt.get(slug) as BuildingRow) || null;
  }

  static findAllBuildings(options?: { companyId?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = `
      SELECT b.*, c.name as company_name,
        (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id) as total_rooms,
        (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.status = 'AVAILABLE') as available_rooms,
        (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.status = 'OCCUPIED') as occupied_rooms
      FROM buildings b
      JOIN companies c ON b.company_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.companyId) {
      query += ' AND b.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.status) {
      query += ' AND b.status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (b.name LIKE ? OR b.address LIKE ? OR b.city LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY b.created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as (BuildingRow & { company_name: string; total_rooms: number; available_rooms: number; occupied_rooms: number })[];
  }

  static countBuildings(options?: { companyId?: string; status?: string; search?: string }): number {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM buildings WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.companyId) {
      query += ' AND company_id = ?';
      params.push(options.companyId);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (name LIKE ? OR address LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term);
    }

    const stmt = db.prepare(query);
    const res = stmt.get(...params) as { count: number };
    return res.count;
  }

  static createBuilding(b: Omit<BuildingRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): BuildingRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = b.created_at || now;
    const updatedAt = b.updated_at || now;

    const stmt = db.prepare(`
      INSERT INTO buildings (id, company_id, name, slug, description, address, city, district, ward, latitude, longitude, image_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      b.id,
      b.company_id,
      b.name,
      b.slug,
      b.description || null,
      b.address,
      b.city || 'Da Nang',
      b.district || null,
      b.ward || null,
      b.latitude || null,
      b.longitude || null,
      b.image_url || null,
      b.status || 'ACTIVE',
      createdAt,
      updatedAt
    );

    return { ...b, created_at: createdAt, updated_at: updatedAt };
  }

  static updateBuilding(id: string, updates: Partial<Omit<BuildingRow, 'id' | 'created_at' | 'updated_at'>>): BuildingRow | null {
    const db = getDatabase();
    const existing = this.findBuildingById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return existing;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE buildings SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findBuildingById(id);
  }

  // Floors
  static findFloorsByBuilding(buildingId: string): FloorRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC');
    return stmt.all(buildingId) as FloorRow[];
  }

  static findFloorById(id: string): FloorRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM floors WHERE id = ?');
    return (stmt.get(id) as FloorRow) || null;
  }

  static createFloor(f: Omit<FloorRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): FloorRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO floors (id, building_id, floor_number, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(f.id, f.building_id, f.floor_number, f.name, f.description || null, f.status || 'ACTIVE', f.created_at || now, f.updated_at || now);
    return { ...f, created_at: f.created_at || now, updated_at: f.updated_at || now };
  }

  // Rooms
  static findRoomById(id: string): (RoomRow & { building_name?: string; building_address?: string; floor_number?: number }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, b.name as building_name, b.address as building_address, f.floor_number
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      JOIN floors f ON r.floor_id = f.id
      WHERE r.id = ?
    `);
    return (stmt.get(id) as (RoomRow & { building_name: string; building_address: string; floor_number: number })) || null;
  }

  static findRoomBySlug(slug: string): (RoomRow & { building_name: string; building_address: string; building_slug: string; floor_number: number }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*, b.name as building_name, b.address as building_address, b.slug as building_slug, f.floor_number
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      JOIN floors f ON r.floor_id = f.id
      WHERE r.slug = ?
    `);
    return (stmt.get(slug) as (RoomRow & { building_name: string; building_address: string; building_slug: string; floor_number: number })) || null;
  }

  static findAllRooms(options?: {
    buildingId?: string;
    floorId?: string;
    status?: string;
    roomType?: string;
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    capacity?: number;
    furnishing?: string;
    search?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();
    let query = `
      SELECT r.*, b.name as building_name, b.slug as building_slug, b.address as building_address, b.city as building_city, f.floor_number
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      JOIN floors f ON r.floor_id = f.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.buildingId) {
      query += ' AND r.building_id = ?';
      params.push(options.buildingId);
    }
    if (options?.floorId) {
      query += ' AND r.floor_id = ?';
      params.push(options.floorId);
    }
    if (options?.status) {
      query += ' AND r.status = ?';
      params.push(options.status);
    }
    if (options?.roomType) {
      query += ' AND r.room_type = ?';
      params.push(options.roomType);
    }
    if (options?.furnishing) {
      query += ' AND r.furnishing = ?';
      params.push(options.furnishing);
    }
    if (options?.minPrice !== undefined) {
      query += ' AND r.base_rent >= ?';
      params.push(options.minPrice);
    }
    if (options?.maxPrice !== undefined) {
      query += ' AND r.base_rent <= ?';
      params.push(options.maxPrice);
    }
    if (options?.minArea !== undefined) {
      query += ' AND r.area >= ?';
      params.push(options.minArea);
    }
    if (options?.maxArea !== undefined) {
      query += ' AND r.area <= ?';
      params.push(options.maxArea);
    }
    if (options?.capacity !== undefined) {
      query += ' AND r.capacity >= ?';
      params.push(options.capacity);
    }
    if (options?.search) {
      query += ' AND (r.room_number LIKE ? OR r.description LIKE ? OR b.name LIKE ? OR b.address LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term, term);
    }

    if (options?.sort === 'price_asc') {
      query += ' ORDER BY r.base_rent ASC';
    } else if (options?.sort === 'price_desc') {
      query += ' ORDER BY r.base_rent DESC';
    } else if (options?.sort === 'area_asc') {
      query += ' ORDER BY r.area ASC';
    } else if (options?.sort === 'area_desc') {
      query += ' ORDER BY r.area DESC';
    } else {
      query += ' ORDER BY r.created_at DESC';
    }

    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as (RoomRow & { building_name: string; building_slug: string; building_address: string; building_city: string; floor_number: number })[];
  }

  static countRooms(options?: {
    buildingId?: string;
    floorId?: string;
    status?: string;
    roomType?: string;
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    capacity?: number;
    furnishing?: string;
    search?: string;
  }): number {
    const db = getDatabase();
    let query = `
      SELECT COUNT(*) as count
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.buildingId) {
      query += ' AND r.building_id = ?';
      params.push(options.buildingId);
    }
    if (options?.floorId) {
      query += ' AND r.floor_id = ?';
      params.push(options.floorId);
    }
    if (options?.status) {
      query += ' AND r.status = ?';
      params.push(options.status);
    }
    if (options?.roomType) {
      query += ' AND r.room_type = ?';
      params.push(options.roomType);
    }
    if (options?.furnishing) {
      query += ' AND r.furnishing = ?';
      params.push(options.furnishing);
    }
    if (options?.minPrice !== undefined) {
      query += ' AND r.base_rent >= ?';
      params.push(options.minPrice);
    }
    if (options?.maxPrice !== undefined) {
      query += ' AND r.base_rent <= ?';
      params.push(options.maxPrice);
    }
    if (options?.capacity !== undefined) {
      query += ' AND r.capacity >= ?';
      params.push(options.capacity);
    }
    if (options?.search) {
      query += ' AND (r.room_number LIKE ? OR r.description LIKE ? OR b.name LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    const stmt = db.prepare(query);
    const res = stmt.get(...params) as { count: number };
    return res.count;
  }

  static createRoom(r: Omit<RoomRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): RoomRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO rooms (id, floor_id, building_id, room_number, slug, room_type, area, base_rent, capacity, status, description, amenities, images, furnishing, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      r.id,
      r.floor_id,
      r.building_id,
      r.room_number,
      r.slug,
      r.room_type,
      r.area,
      r.base_rent,
      r.capacity || 2,
      r.status || 'AVAILABLE',
      r.description || null,
      r.amenities || '[]',
      r.images || '[]',
      r.furnishing || 'FULLY_FURNISHED',
      r.created_at || now,
      r.updated_at || now
    );
    return { ...r, created_at: r.created_at || now, updated_at: r.updated_at || now };
  }

  static updateRoom(id: string, updates: Partial<Omit<RoomRow, 'id' | 'created_at' | 'updated_at'>>): RoomRow | null {
    const db = getDatabase();
    const existing = this.findRoomById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return existing;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findRoomById(id);
  }

  // Equipment
  static findEquipmentByRoom(roomId: string): EquipmentRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM equipment WHERE room_id = ? ORDER BY created_at DESC');
    return stmt.all(roomId) as EquipmentRow[];
  }

  static createEquipment(e: Omit<EquipmentRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): EquipmentRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO equipment (id, room_id, name, type, serial_number, condition, status, purchase_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(e.id, e.room_id, e.name, e.type, e.serial_number || null, e.condition || 'EXCELLENT', e.status || 'ACTIVE', e.purchase_date || null, e.notes || null, e.created_at || now, e.updated_at || now);
    return { ...e, created_at: e.created_at || now, updated_at: e.updated_at || now };
  }

  // Building Configurations (Versioned with Effective Dates)
  static findConfigurationsByBuilding(buildingId: string): BuildingConfigRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM building_configurations WHERE building_id = ? ORDER BY effective_from DESC');
    return stmt.all(buildingId) as BuildingConfigRow[];
  }

  static getActiveConfigurationForDate(buildingId: string, targetDate: string): BuildingConfigRow | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM building_configurations
      WHERE building_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC, version DESC
      LIMIT 1
    `);
    return (stmt.get(buildingId, targetDate, targetDate) as unknown as BuildingConfigRow) || null;
  }

  static createConfiguration(c: Omit<BuildingConfigRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): BuildingConfigRow {
    const db = getDatabase();
    const now = new Date().toISOString();

    // If new configuration has effective_from, expire any previous open configuration
    const expireStmt = db.prepare(`
      UPDATE building_configurations
      SET effective_to = ?, updated_at = ?
      WHERE building_id = ? AND effective_to IS NULL AND effective_from < ?
    `);
    expireStmt.run(c.effective_from, now, c.building_id, c.effective_from);

    const stmt = db.prepare(`
      INSERT INTO building_configurations (id, building_id, version, effective_from, effective_to, electricity_unit_price, water_unit_price, internet_price, garbage_price, parking_fee_motorbike, parking_fee_car, cleaning_fee, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      c.id,
      c.building_id,
      c.version,
      c.effective_from,
      c.effective_to || null,
      c.electricity_unit_price,
      c.water_unit_price,
      c.internet_price,
      c.garbage_price,
      c.parking_fee_motorbike,
      c.parking_fee_car,
      c.cleaning_fee,
      c.notes || null,
      c.created_at || now,
      c.updated_at || now
    );
    return { ...c, created_at: c.created_at || now, updated_at: c.updated_at || now };
  }
}
