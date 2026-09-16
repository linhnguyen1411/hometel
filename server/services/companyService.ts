import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { withTransaction } from '../db/connection.js';
import { UserRepository, UserRow } from '../db/repositories/userRepository.js';
import { CompanyRepository, CompanyMembershipRow } from '../db/repositories/companyRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';
import { TokenPayload } from './authService.js';

export class CompanyService {
  /**
   * Verify server-side company isolation.
   * SUPER_ADMIN has access to everything.
   * Other roles must have an active membership in the target company.
   */
  static verifyCompanyAccess(auth: TokenPayload, targetCompanyId: string): boolean {
    if (auth.role === 'SUPER_ADMIN') {
      return true;
    }
    const hasMembership = auth.memberships.some(m => m.companyId === targetCompanyId);
    return hasMembership;
  }

  static getUserCompanyId(auth: TokenPayload): string {
    if (auth.memberships && auth.memberships.length > 0) {
      return auth.memberships[0].companyId;
    }
    return 'cmp_own_1';
  }

  /**
   * Company Admin creates staff member for their company.
   * Atomic operation creating User (role: STAFF) and CompanyMembership (role: STAFF).
   */
  static async createStaff(
    auth: TokenPayload,
    companyId: string,
    data: { email: string; password: string; fullName: string; phone?: string }
  ): Promise<{ user: UserRow; membership: CompanyMembershipRow }> {
    // 1. Authorization: user must be Super Admin or Company Admin
    if (auth.role !== 'SUPER_ADMIN') {
      const mem = auth.memberships.find(m => m.companyId === companyId);
      if (!mem || mem.role !== 'ADMIN') {
        throw new Error('FORBIDDEN_NOT_COMPANY_ADMIN');
      }
    }

    // 2. Check email uniqueness
    const existing = UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = 'usr_staff_' + crypto.randomUUID().substring(0, 8);
    const membershipId = 'mem_' + crypto.randomUUID().substring(0, 8);
    const auditId = 'aud_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      const user = UserRepository.create({
        id: userId,
        email: data.email,
        password_hash: passwordHash,
        full_name: data.fullName,
        phone: data.phone || null,
        role: 'STAFF',
        status: 'ACTIVE',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.fullName)}`
      });

      const membership = CompanyRepository.createMembership({
        id: membershipId,
        user_id: userId,
        company_id: companyId,
        role: 'STAFF',
        status: 'ACTIVE'
      });

      AuditRepository.create({
        id: auditId,
        actor_id: auth.userId,
        action: 'CREATE_STAFF',
        entity_type: 'COMPANY_STAFF',
        entity_id: userId,
        old_value: null,
        new_value: JSON.stringify({ companyId, staffId: userId, email: data.email, fullName: data.fullName })
      });

      return { user, membership };
    });
  }

  static getCompanyStaff(auth: TokenPayload, companyId: string) {
    if (!this.verifyCompanyAccess(auth, companyId)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }
    return CompanyRepository.findCompanyMembers(companyId);
  }
}
