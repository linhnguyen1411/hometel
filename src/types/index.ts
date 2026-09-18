export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'PROVIDER' | 'STAFF' | 'TENANT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type CompanyType = 'COMPANY' | 'HOUSEHOLD_BUSINESS';
export type CompanyMembershipRole = 'ADMIN' | 'STAFF';

export type RoomType = 'STUDIO' | 'ONE_BEDROOM' | 'TWO_BEDROOM' | 'PENTHOUSE' | 'DUPLEX';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'INACTIVE';
export type FurnishingStatus = 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';

export type ContractStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DepositStatus = 'HELD' | 'REFUNDED' | 'FORFEITED' | 'PARTIALLY_REFUNDED';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';

export type ServiceRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  memberships: { companyId: string; role: CompanyMembershipRole }[];
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  tax_code?: string | null;
  business_registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  created_at: string;
}

export interface Building {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description?: string | null;
  address: string;
  city: string;
  district?: string | null;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  status: string;
  created_at: string;
  floors?: Floor[];
  availableRooms?: Room[];
  configurations?: BuildingConfiguration[];
}

export interface Floor {
  id: string;
  buildingId: string;
  building_id?: string;
  floorNumber: number;
  floor_number?: number;
  name: string;
  description?: string | null;
  status: string;
}

export interface Room {
  id: string;
  floorId: string;
  floor_id?: string;
  buildingId: string;
  building_id?: string;
  roomNumber: string;
  room_number?: string;
  slug: string;
  roomType: RoomType;
  room_type?: RoomType;
  area: number;
  baseRent: number;
  base_rent?: number;
  capacity: number;
  status: RoomStatus;
  description?: string | null;
  amenities?: string[] | string;
  images?: string[] | string;
  furnishing: FurnishingStatus;
  buildingName?: string;
  building_name?: string;
  buildingSlug?: string;
  building_slug?: string;
  buildingAddress?: string;
  building_address?: string;
  buildingCity?: string;
  building_city?: string;
  floorNumber?: number;
  floor_number?: number;
  equipment?: Equipment[];
}

export interface Equipment {
  id: string;
  room_id: string;
  name: string;
  type: string;
  serial_number?: string | null;
  condition: string;
  status: string;
}

export interface BuildingConfiguration {
  id: string;
  building_id: string;
  version: number;
  effective_from: string;
  effective_to?: string | null;
  electricity_unit_price: number;
  water_unit_price: number;
  internet_price: number;
  garbage_price: number;
  parking_fee_motorbike: number;
  parking_fee_car: number;
  cleaning_fee: number;
  notes?: string | null;
}

export interface RentalApplication {
  id: string;
  room_id: string;
  tenant_id: string;
  intended_start_date: string;
  lease_duration_months: number;
  occupants_count: number;
  notes?: string | null;
  status: ApplicationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  room_number?: string;
  room_slug?: string;
  base_rent?: number;
  building_name?: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
}

export interface RentalContract {
  id: string;
  contract_number: string;
  application_id?: string | null;
  room_id: string;
  tenant_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  payment_frequency: string;
  payment_day_of_month: number;
  status: ContractStatus;
  terms?: string | null;
  created_at: string;
  room_number?: string;
  building_name?: string;
  tenant_name?: string;
  tenant_email?: string;
  signed_at?: string | null;
  signature_hash?: string | null;
  deposit?: Deposit;
}

export interface Deposit {
  id: string;
  contract_id: string;
  tenant_id: string;
  amount: number;
  received: number;
  received_date?: string | null;
  refunded: number;
  refund_amount?: number | null;
  refund_date?: string | null;
  status: DepositStatus;
  notes?: string | null;
}

export interface Meter {
  id: string;
  room_id: string;
  type: 'ELECTRICITY' | 'WATER' | 'GAS';
  serial_number: string;
  meter_serial?: string;
  unit?: string;
  initial_reading: number;
  current_reading: number;
  status: string;
  readings?: MeterReading[];
}

export interface MeterReading {
  id: string;
  meter_id: string;
  previous_reading: number;
  reading_value: number;
  consumption: number;
  reading_date: string;
  recorded_by?: string | null;
  notes?: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  tenant_id: string;
  contract_id: string;
  company_id: string;
  room_id: string;
  issue_date: string;
  due_date: string;
  billing_month: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  outstanding_amount: number;
  status: InvoiceStatus;
  notes?: string | null;
  items?: InvoiceItem[];
  payments?: Payment[];
  room_number?: string;
  tenant_name?: string;
  tenant_email?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  type: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  metadata?: string | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  tenant_id: string;
  company_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_reference?: string | null;
  paid_at: string;
  notes?: string | null;
  invoice_number?: string;
  tenant_name?: string;
}

export interface Service {
  id: string;
  company_id?: string;
  companyId?: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  price_type?: string;
  priceType?: string;
  base_price?: number;
  basePrice?: number;
  image_url?: string | null;
  imageUrl?: string | null;
  status: string;
  company_name?: string;
  companyName?: string;
}

export interface ServiceRequest {
  id: string;
  service_id: string;
  provider_company_id: string;
  tenant_id: string;
  room_id?: string | null;
  title: string;
  description: string;
  preferred_date?: string | null;
  urgency: UrgencyLevel;
  status: ServiceRequestStatus;
  estimated_cost?: number | null;
  final_cost?: number | null;
  rejection_reason?: string | null;
  created_at: string;
  service_name?: string;
  service_category?: string;
  tenant_name?: string;
  tenant_phone?: string;
  room_number?: string;
  staff_name?: string;
  staff_id?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
  actor_name?: string;
}

// Building Operating System Types
export interface ActionItem {
  id: string;
  actionKey: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'INVOICE' | 'MAINTENANCE' | 'CONTRACT' | 'APPLICATION' | 'EQUIPMENT';
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeColor?: string;
  amount?: number;
  dueDate?: string;
  daysRemaining?: number;
  entityType: string;
  entityId: string;
  roomNumber?: string;
  roomId?: string;
  buildingName?: string;
  buildingId?: string;
  tenantName?: string;
  tenantPhone?: string;
  quickAction?: {
    type: string;
    label: string;
    variant?: 'primary' | 'danger' | 'warning' | 'default';
  };
  createdAt: string;
}

export interface TodayCockpitData {
  critical: ActionItem[];
  attention: ActionItem[];
  upcoming: ActionItem[];
  healthySummary: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    occupancyRate: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    criticalCount: number;
    attentionCount: number;
  };
  timestamp: string;
}

export interface Building360Data {
  building: Building & { company_name?: string; company_phone?: string; company_email?: string };
  summary: {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    maintenanceRooms: number;
    reservedRooms: number;
    criticalRooms: number;
    occupancyRate: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    openWorkOrdersCount: number;
  };
  floors: (Floor & {
    rooms: (Room & {
      tenant_name?: string;
      tenant_phone?: string;
      active_contract_id?: string;
      contract_number?: string;
      contract_end_date?: string;
      overdue_count: number;
      critical_issues_count: number;
      healthStatus: 'CRITICAL' | 'ATTENTION' | 'AVAILABLE' | 'HEALTHY';
      healthReason: string;
    })[];
  })[];
  recentActivity: any[];
}

export interface Room360Data {
  room: Room & { floor_name?: string; floor_number?: number; building_name?: string; building_address?: string };
  isPrivileged?: boolean;
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatarUrl?: string;
    contractId: string;
    contractNumber: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    isMasked?: boolean;
  } | null;
  activeContract: RentalContract | null;
  deposit: Deposit | null;
  meters: (Meter & { last_consumption?: number; last_reading_date?: string })[];
  equipment: Equipment[];
  invoices: Invoice[];
  serviceRequests: ServiceRequest[];
  timeline: {
    type: string;
    date: string;
    title: string;
    description: string;
    badgeColor: string;
  }[];
}

export interface AiInsight {
  id: string;
  impactLevel: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
  title: string;
  reason: string;
  relevantData: string[];
  suggestedAction: string;
  actionType?: string;
  actionPayload?: any;
}

