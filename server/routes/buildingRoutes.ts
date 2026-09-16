import { Router } from 'express';
import crypto from 'node:crypto';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { sendSuccess, sendList, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CompanyService } from '../services/companyService.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';

export const buildingRouter = Router();

// ==========================================
// PUBLIC & TENANT BROWSING ENDPOINTS
// ==========================================

// GET /api/v1/buildings (Public listing)
buildingRouter.get('/', optionalAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string || 'ACTIVE';
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const buildings = BuildingRepository.findAllBuildings({
    companyId,
    status: companyId ? undefined : status, // if filtering by company, allow all statuses for owner
    search,
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  const total = BuildingRepository.countBuildings({ companyId, status: companyId ? undefined : status, search });

  return sendList(res, buildings, { page, pageSize, total });
});

// GET /api/v1/buildings/slug/:slug
buildingRouter.get('/slug/:slug', (req, res) => {
  const building = BuildingRepository.findBuildingBySlug(req.params.slug);
  if (!building) {
    return sendError(res, 'BUILDING_NOT_FOUND', 'Building not found', 404);
  }

  const floors = BuildingRepository.findFloorsByBuilding(building.id);
  const rooms = BuildingRepository.findAllRooms({ buildingId: building.id, status: 'AVAILABLE' });

  return sendSuccess(res, {
    ...building,
    floors,
    availableRooms: rooms
  });
});

// GET /api/v1/buildings/:id
buildingRouter.get('/:id', optionalAuth, (req: AuthenticatedRequest, res) => {
  const building = BuildingRepository.findBuildingById(req.params.id);
  if (!building) {
    return sendError(res, 'BUILDING_NOT_FOUND', 'Building not found', 404);
  }

  const floors = BuildingRepository.findFloorsByBuilding(building.id);
  const rooms = BuildingRepository.findAllRooms({ buildingId: building.id });
  const configs = BuildingRepository.findConfigurationsByBuilding(building.id);

  return sendSuccess(res, {
    ...building,
    floors,
    rooms,
    configurations: configs
  });
});

// POST /api/v1/buildings (Owner creates building)
buildingRouter.post('/', authenticate, requireRole('OWNER', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { companyId, name, slug, description, address, city, district, ward, latitude, longitude, imageUrl } = req.body;
    if (!companyId || !name || !slug || !address) {
      return sendError(res, 'VALIDATION_ERROR', 'companyId, name, slug, and address are required', 400);
    }

    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }

    const buildingId = 'bld_' + crypto.randomUUID().substring(0, 8);
    const building = BuildingRepository.createBuilding({
      id: buildingId,
      company_id: companyId,
      name,
      slug: slug.toLowerCase(),
      description: description || null,
      address,
      city: city || 'Da Nang',
      district: district || null,
      ward: ward || null,
      latitude: latitude || null,
      longitude: longitude || null,
      image_url: imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
      status: 'ACTIVE'
    });

    // Create default building configuration
    const configId = 'cfg_' + crypto.randomUUID().substring(0, 8);
    BuildingRepository.createConfiguration({
      id: configId,
      building_id: buildingId,
      version: 1,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: null,
      electricity_unit_price: 3500,
      water_unit_price: 15000,
      internet_price: 100000,
      garbage_price: 50000,
      parking_fee_motorbike: 100000,
      parking_fee_car: 800000,
      cleaning_fee: 150000,
      notes: 'Initial default property utility configuration'
    });

    AuditRepository.create({
      id: 'aud_' + crypto.randomUUID().substring(0, 8),
      actor_id: req.user!.userId,
      action: 'CREATE_BUILDING',
      entity_type: 'BUILDING',
      entity_id: buildingId,
      old_value: null,
      new_value: JSON.stringify({ name, slug, companyId, address })
    });

    return sendSuccess(res, building, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_BUILDING_FAILED', error.message, 500);
  }
});

// ==========================================
// ROOMS ROUTING
// ==========================================

// GET /api/v1/rooms (Public & Search room directory)
export const roomRouter = Router();

roomRouter.get('/', (req, res) => {
  const buildingId = req.query.buildingId as string;
  const floorId = req.query.floorId as string;
  const status = req.query.status as string;
  const roomType = req.query.roomType as string;
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
  const minArea = req.query.minArea ? parseFloat(req.query.minArea as string) : undefined;
  const maxArea = req.query.maxArea ? parseFloat(req.query.maxArea as string) : undefined;
  const capacity = req.query.capacity ? parseInt(req.query.capacity as string) : undefined;
  const furnishing = req.query.furnishing as string;
  const search = req.query.search as string;
  const sort = req.query.sort as string;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const rooms = BuildingRepository.findAllRooms({
    buildingId,
    floorId,
    status,
    roomType,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    capacity,
    furnishing,
    search,
    sort,
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  const total = BuildingRepository.countRooms({
    buildingId,
    floorId,
    status,
    roomType,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    capacity,
    furnishing,
    search
  });

  return sendList(res, rooms, { page, pageSize, total });
});

// GET /api/v1/rooms/slug/:slug
roomRouter.get('/slug/:slug', (req, res) => {
  const room = BuildingRepository.findRoomBySlug(req.params.slug);
  if (!room) {
    return sendError(res, 'ROOM_NOT_FOUND', 'Room not found', 404);
  }

  const equipment = BuildingRepository.findEquipmentByRoom(room.id);
  const building = BuildingRepository.findBuildingById(room.building_id);

  return sendSuccess(res, {
    ...room,
    amenities: typeof room.amenities === 'string' ? JSON.parse(room.amenities || '[]') : room.amenities,
    images: typeof room.images === 'string' ? JSON.parse(room.images || '[]') : room.images,
    equipment,
    building
  });
});

// GET /api/v1/rooms/:id
roomRouter.get('/:id', (req, res) => {
  const room = BuildingRepository.findRoomById(req.params.id);
  if (!room) {
    return sendError(res, 'ROOM_NOT_FOUND', 'Room not found', 404);
  }

  const equipment = BuildingRepository.findEquipmentByRoom(room.id);
  return sendSuccess(res, {
    ...room,
    amenities: typeof room.amenities === 'string' ? JSON.parse(room.amenities || '[]') : room.amenities,
    images: typeof room.images === 'string' ? JSON.parse(room.images || '[]') : room.images,
    equipment
  });
});

// POST /api/v1/rooms (Owner/Staff creates room)
roomRouter.post('/', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { floorId, buildingId, roomNumber, slug, roomType, area, baseRent, capacity, status, description, amenities, images, furnishing } = req.body;
    if (!floorId || !buildingId || !roomNumber || !slug || !roomType || !area || baseRent === undefined) {
      return sendError(res, 'VALIDATION_ERROR', 'floorId, buildingId, roomNumber, slug, roomType, area, and baseRent are required', 400);
    }

    const building = BuildingRepository.findBuildingById(buildingId);
    if (!building) return sendError(res, 'BUILDING_NOT_FOUND', 'Building not found', 404);

    if (!CompanyService.verifyCompanyAccess(req.user!, building.company_id)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }

    const roomId = 'rm_' + crypto.randomUUID().substring(0, 8);
    const room = BuildingRepository.createRoom({
      id: roomId,
      floor_id: floorId,
      building_id: buildingId,
      room_number: roomNumber,
      slug: slug.toLowerCase(),
      room_type: roomType,
      area: parseFloat(area),
      base_rent: parseFloat(baseRent),
      capacity: parseInt(capacity) || 2,
      status: status || 'AVAILABLE',
      description: description || null,
      amenities: JSON.stringify(amenities || []),
      images: JSON.stringify(images || []),
      furnishing: furnishing || 'FULLY_FURNISHED'
    });

    AuditRepository.create({
      id: 'aud_' + crypto.randomUUID().substring(0, 8),
      actor_id: req.user!.userId,
      action: 'CREATE_ROOM',
      entity_type: 'ROOM',
      entity_id: roomId,
      old_value: null,
      new_value: JSON.stringify({ roomNumber, slug, buildingId, baseRent })
    });

    return sendSuccess(res, room, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_ROOM_FAILED', error.message, 500);
  }
});

// PATCH /api/v1/rooms/:id (Owner/Staff updates room status, rent, etc.)
roomRouter.patch('/:id', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  const room = BuildingRepository.findRoomById(req.params.id);
  if (!room) return sendError(res, 'ROOM_NOT_FOUND', 'Room not found', 404);

  const building = BuildingRepository.findBuildingById(room.building_id);
  if (!building || !CompanyService.verifyCompanyAccess(req.user!, building.company_id)) {
    return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
  }

  const updated = BuildingRepository.updateRoom(req.params.id, req.body);
  AuditRepository.create({
    id: 'aud_' + crypto.randomUUID().substring(0, 8),
    actor_id: req.user!.userId,
    action: 'UPDATE_ROOM',
    entity_type: 'ROOM',
    entity_id: req.params.id,
    old_value: JSON.stringify({ status: room.status, base_rent: room.base_rent }),
    new_value: JSON.stringify(req.body)
  });

  return sendSuccess(res, updated);
});

// POST /api/v1/buildings/:id/configurations (Versioned configuration with effective dates)
buildingRouter.post('/:id/configurations', authenticate, requireRole('OWNER', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  const building = BuildingRepository.findBuildingById(req.params.id);
  if (!building) return sendError(res, 'BUILDING_NOT_FOUND', 'Building not found', 404);

  if (!CompanyService.verifyCompanyAccess(req.user!, building.company_id)) {
    return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
  }

  const { effectiveFrom, electricityUnitPrice, waterUnitPrice, internetPrice, garbagePrice, parkingFeeMotorbike, parkingFeeCar, cleaningFee, notes } = req.body;
  if (!effectiveFrom) return sendError(res, 'VALIDATION_ERROR', 'effectiveFrom date is required', 400);

  const existingConfigs = BuildingRepository.findConfigurationsByBuilding(req.params.id);
  const nextVersion = existingConfigs.length + 1;

  const configId = 'cfg_' + crypto.randomUUID().substring(0, 8);
  const config = BuildingRepository.createConfiguration({
    id: configId,
    building_id: req.params.id,
    version: nextVersion,
    effective_from: effectiveFrom,
    effective_to: null,
    electricity_unit_price: electricityUnitPrice !== undefined ? electricityUnitPrice : 3500,
    water_unit_price: waterUnitPrice !== undefined ? waterUnitPrice : 15000,
    internet_price: internetPrice !== undefined ? internetPrice : 100000,
    garbage_price: garbagePrice !== undefined ? garbagePrice : 50000,
    parking_fee_motorbike: parkingFeeMotorbike !== undefined ? parkingFeeMotorbike : 100000,
    parking_fee_car: parkingFeeCar !== undefined ? parkingFeeCar : 800000,
    cleaning_fee: cleaningFee !== undefined ? cleaningFee : 150000,
    notes: notes || `Version ${nextVersion} effective from ${effectiveFrom}`
  });

  AuditRepository.create({
    id: 'aud_' + crypto.randomUUID().substring(0, 8),
    actor_id: req.user!.userId,
    action: 'UPDATE_BUILDING_CONFIGURATION',
    entity_type: 'BUILDING_CONFIGURATION',
    entity_id: configId,
    old_value: null,
    new_value: JSON.stringify({ version: nextVersion, effectiveFrom, electricityUnitPrice, waterUnitPrice })
  });

  return sendSuccess(res, config, 201);
});
