import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { withTransaction, getDatabase } from '../db/connection.js';
import { UserRepository, UserRow } from '../db/repositories/userRepository.js';
import { CompanyRepository, CompanyRow, CompanyMembershipRow } from '../db/repositories/companyRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';

export interface CreateOwnerDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  companyName: string;
  companyType: 'COMPANY' | 'HOUSEHOLD_BUSINESS';
  taxCode?: string;
  businessRegistrationNumber?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
}

export interface CreateProviderDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  companyName: string;
  companyType: 'COMPANY' | 'HOUSEHOLD_BUSINESS';
  taxCode?: string;
  businessRegistrationNumber?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
}

export class SuperAdminService {
  /**
   * Atomic Owner Creation:
   * 1. Create Owner User
   * 2. Create Company
   * 3. Create CompanyMembership with role = ADMIN
   * 4. Record Audit Log
   * Rollback entire transaction if any step fails.
   */
  static async createOwnerAtomic(dto: CreateOwnerDto, actorId: string): Promise<{ user: UserRow; company: CompanyRow; membership: CompanyMembershipRow }> {
    const existing = UserRepository.findByEmail(dto.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = 'usr_owner_' + crypto.randomUUID().substring(0, 8);
    const companyId = 'cmp_owner_' + crypto.randomUUID().substring(0, 8);
    const membershipId = 'mem_' + crypto.randomUUID().substring(0, 8);
    const auditId = 'aud_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      // Step 1: Create Owner User
      const user = UserRepository.create({
        id: userId,
        email: dto.email,
        password_hash: passwordHash,
        full_name: dto.fullName,
        phone: dto.phone || null,
        role: 'OWNER',
        status: 'ACTIVE',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(dto.fullName)}`
      });

      // Step 2: Create Company
      const company = CompanyRepository.create({
        id: companyId,
        name: dto.companyName,
        type: dto.companyType,
        tax_code: dto.taxCode || null,
        business_registration_number: dto.businessRegistrationNumber || null,
        phone: dto.companyPhone || dto.phone || null,
        email: dto.companyEmail || dto.email,
        address: dto.companyAddress || null,
        status: 'ACTIVE'
      });

      // Step 3: Create CompanyMembership (Owner is ADMIN of this company)
      const membership = CompanyRepository.createMembership({
        id: membershipId,
        user_id: userId,
        company_id: companyId,
        role: 'ADMIN',
        status: 'ACTIVE'
      });

      // Step 4: Audit record
      AuditRepository.create({
        id: auditId,
        actor_id: actorId,
        action: 'CREATE_OWNER',
        entity_type: 'COMPANY',
        entity_id: companyId,
        old_value: null,
        new_value: JSON.stringify({ userId, email: dto.email, companyId, companyName: dto.companyName })
      });

      return { user, company, membership };
    });
  }

  /**
   * Atomic Provider Creation:
   * 1. Create Provider User
   * 2. Create Company
   * 3. Create CompanyMembership with role = ADMIN
   * 4. Record Audit Log
   * Rollback entire transaction if any step fails.
   */
  static async createProviderAtomic(dto: CreateProviderDto, actorId: string): Promise<{ user: UserRow; company: CompanyRow; membership: CompanyMembershipRow }> {
    const existing = UserRepository.findByEmail(dto.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = 'usr_prov_' + crypto.randomUUID().substring(0, 8);
    const companyId = 'cmp_prov_' + crypto.randomUUID().substring(0, 8);
    const membershipId = 'mem_' + crypto.randomUUID().substring(0, 8);
    const auditId = 'aud_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      // Step 1: Create Provider User
      const user = UserRepository.create({
        id: userId,
        email: dto.email,
        password_hash: passwordHash,
        full_name: dto.fullName,
        phone: dto.phone || null,
        role: 'PROVIDER',
        status: 'ACTIVE',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(dto.fullName)}`
      });

      // Step 2: Create Company
      const company = CompanyRepository.create({
        id: companyId,
        name: dto.companyName,
        type: dto.companyType,
        tax_code: dto.taxCode || null,
        business_registration_number: dto.businessRegistrationNumber || null,
        phone: dto.companyPhone || dto.phone || null,
        email: dto.companyEmail || dto.email,
        address: dto.companyAddress || null,
        status: 'ACTIVE'
      });

      // Step 3: Create CompanyMembership (Provider is ADMIN of this company)
      const membership = CompanyRepository.createMembership({
        id: membershipId,
        user_id: userId,
        company_id: companyId,
        role: 'ADMIN',
        status: 'ACTIVE'
      });

      // Step 4: Audit record
      AuditRepository.create({
        id: auditId,
        actor_id: actorId,
        action: 'CREATE_PROVIDER',
        entity_type: 'COMPANY',
        entity_id: companyId,
        old_value: null,
        new_value: JSON.stringify({ userId, email: dto.email, companyId, companyName: dto.companyName })
      });

      return { user, company, membership };
    });
  }

  static getSystemStats() {
    const db = getDatabase();

    const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const ownersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'").get() as any).count;
    const providersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'PROVIDER'").get() as any).count;
    const tenantsCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'TENANT'").get() as any).count;
    const companiesCount = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count;
    const buildingsCount = (db.prepare('SELECT COUNT(*) as count FROM buildings').get() as any).count;
    const roomsCount = (db.prepare('SELECT COUNT(*) as count FROM rooms').get() as any).count;
    const activeContractsCount = (db.prepare("SELECT COUNT(*) as count FROM rental_contracts WHERE status = 'ACTIVE'").get() as any).count;

    const revenueResult = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'SUCCESS'").get() as any;
    const totalRevenue = revenueResult.total;

    const outstandingResult = db.prepare("SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM invoices WHERE status != 'CANCELLED'").get() as any;
    const totalOutstanding = outstandingResult.total;

    const auditCount = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any).count;

    return {
      totalUsers: usersCount,
      totalOwners: ownersCount,
      totalProviders: providersCount,
      totalTenants: tenantsCount,
      totalCompanies: companiesCount,
      totalBuildings: buildingsCount,
      totalRooms: roomsCount,
      activeContracts: activeContractsCount,
      totalRevenue,
      totalOutstanding,
      auditCount
    };
  }
}
