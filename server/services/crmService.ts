import crypto from 'node:crypto';
import { CrmRepository, CrmLeadRow, RoomTourRow } from '../db/repositories/crmRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { RentalRepository } from '../db/repositories/rentalRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { CompanyService } from './companyService.js';
import { TokenPayload } from './authService.js';
import { withTransaction } from '../db/connection.js';

export class CrmService {
  static getLeads(auth: TokenPayload, filter?: { status?: string; search?: string }) {
    const companyId = CompanyService.getUserCompanyId(auth);
    const leads = CrmRepository.findLeadsByCompanyId(companyId, filter);
    const funnel = CrmRepository.getFunnelCounts(companyId);

    return {
      leads,
      funnel
    };
  }

  static getLeadById(auth: TokenPayload, id: string) {
    const lead = CrmRepository.findLeadById(id);
    if (!lead) throw new Error('LEAD_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, lead.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    return lead;
  }

  static createLead(
    auth: TokenPayload,
    data: {
      fullName: string;
      phone: string;
      email?: string;
      source?: 'WEBSITE' | 'FACEBOOK' | 'REFERRAL' | 'WALK_IN' | 'ZALO' | 'HOTLINE' | 'OTHER';
      budgetMin?: number;
      budgetMax?: number;
      preferredRoomType?: string;
      moveInDate?: string;
      notes?: string;
      assignedStaffId?: string;
    }
  ): CrmLeadRow {
    const companyId = CompanyService.getUserCompanyId(auth);
    const now = new Date().toISOString();
    const id = 'lead_' + crypto.randomUUID().substring(0, 8);

    const lead: CrmLeadRow = {
      id,
      company_id: companyId,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email || null,
      source: data.source || 'WEBSITE',
      status: 'NEW',
      budget_min: data.budgetMin || null,
      budget_max: data.budgetMax || null,
      preferred_room_type: data.preferredRoomType || null,
      move_in_date: data.moveInDate || null,
      notes: data.notes || null,
      assigned_staff_id: data.assignedStaffId || null,
      created_at: now,
      updated_at: now
    };

    return CrmRepository.createLead(lead);
  }

  static updateLead(
    auth: TokenPayload,
    id: string,
    updates: Partial<{
      fullName: string;
      phone: string;
      email: string;
      source: any;
      status: any;
      budgetMin: number;
      budgetMax: number;
      preferredRoomType: string;
      moveInDate: string;
      notes: string;
      assignedStaffId: string;
    }>
  ): CrmLeadRow {
    const lead = CrmRepository.findLeadById(id);
    if (!lead) throw new Error('LEAD_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, lead.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const payload: Partial<CrmLeadRow> = {
      updated_at: new Date().toISOString()
    };

    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.source !== undefined) payload.source = updates.source;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.budgetMin !== undefined) payload.budget_min = updates.budgetMin;
    if (updates.budgetMax !== undefined) payload.budget_max = updates.budgetMax;
    if (updates.preferredRoomType !== undefined) payload.preferred_room_type = updates.preferredRoomType;
    if (updates.moveInDate !== undefined) payload.move_in_date = updates.moveInDate;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.assignedStaffId !== undefined) payload.assigned_staff_id = updates.assignedStaffId;

    return CrmRepository.updateLead(id, payload);
  }

  static getTours(auth: TokenPayload, filter?: { status?: string }) {
    const companyId = CompanyService.getUserCompanyId(auth);
    return CrmRepository.findToursByCompanyId(companyId, filter);
  }

  static scheduleTour(
    auth: TokenPayload,
    data: {
      leadId: string;
      roomId: string;
      scheduledAt: string;
      hostStaffId?: string;
    }
  ): RoomTourRow {
    const lead = CrmRepository.findLeadById(data.leadId);
    if (!lead) throw new Error('LEAD_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, lead.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const room = BuildingRepository.findRoomById(data.roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const now = new Date().toISOString();
    const tourId = 'tour_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      const tour = CrmRepository.createTour({
        id: tourId,
        lead_id: data.leadId,
        room_id: data.roomId,
        scheduled_at: data.scheduledAt,
        status: 'SCHEDULED',
        host_staff_id: data.hostStaffId || auth.userId,
        feedback: null,
        rating: null,
        created_at: now,
        updated_at: now
      });

      // Update lead status to TOUR_SCHEDULED
      CrmRepository.updateLead(lead.id, {
        status: 'TOUR_SCHEDULED',
        updated_at: now
      });

      return tour;
    });
  }

  static completeTour(
    auth: TokenPayload,
    tourId: string,
    data: {
      status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
      feedback?: string;
      rating?: number;
    }
  ): RoomTourRow {
    const tour = CrmRepository.findTourById(tourId);
    if (!tour) throw new Error('TOUR_NOT_FOUND');

    const lead = CrmRepository.findLeadById(tour.lead_id);
    if (!lead) throw new Error('LEAD_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, lead.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const now = new Date().toISOString();

    return withTransaction(() => {
      const updatedTour = CrmRepository.updateTour(tourId, {
        status: data.status,
        feedback: data.feedback || null,
        rating: data.rating || null,
        updated_at: now
      });

      // Update lead status accordingly
      if (data.status === 'COMPLETED') {
        CrmRepository.updateLead(lead.id, {
          status: 'TOUR_COMPLETED',
          updated_at: now
        });
      }

      return updatedTour;
    });
  }

  static convertLeadToApplication(
    auth: TokenPayload,
    leadId: string,
    data: {
      roomId: string;
      intendedStartDate: string;
      leaseDurationMonths?: number;
      occupantsCount?: number;
      notes?: string;
    }
  ) {
    const lead = CrmRepository.findLeadById(leadId);
    if (!lead) throw new Error('LEAD_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, lead.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const room = BuildingRepository.findRoomById(data.roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const now = new Date().toISOString();

    return withTransaction(() => {
      // Find or create tenant user for the lead
      let tenantUser = lead.email ? UserRepository.findByEmail(lead.email) : null;
      if (!tenantUser) {
        const tenantId = 'usr_tnt_' + crypto.randomUUID().substring(0, 8);
        tenantUser = UserRepository.create({
          id: tenantId,
          email: lead.email || `lead_${lead.id}@tenant.homtel.vn`,
          password_hash: '$2a$10$placeholderhashforconvertedleadtenant2026',
          full_name: lead.full_name,
          phone: lead.phone,
          role: 'TENANT',
          status: 'ACTIVE',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(lead.full_name)}`
        });
      }

      // Create rental application
      const appId = 'app_' + crypto.randomUUID().substring(0, 8);
      const application = RentalRepository.createApplication({
        id: appId,
        room_id: data.roomId,
        tenant_id: tenantUser.id,
        intended_start_date: data.intendedStartDate,
        lease_duration_months: data.leaseDurationMonths || 12,
        occupants_count: data.occupantsCount || 1,
        notes: data.notes || `Chuyển đổi từ khách tiềm năng CRM: ${lead.full_name} (${lead.phone})`,
        status: 'PENDING',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null
      });

      // Update lead to CONVERTED
      CrmRepository.updateLead(lead.id, {
        status: 'CONVERTED',
        notes: (lead.notes ? lead.notes + '\n' : '') + `[${now}] Đã chuyển đổi thành hồ sơ thuê: ${appId}`,
        updated_at: now
      });

      return {
        success: true,
        leadId: lead.id,
        application,
        tenantUser: {
          id: tenantUser.id,
          email: tenantUser.email,
          fullName: tenantUser.full_name,
          phone: tenantUser.phone
        }
      };
    });
  }
}
