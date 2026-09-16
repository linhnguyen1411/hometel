import crypto from 'node:crypto';
import { withTransaction } from '../db/connection.js';
import { RentalRepository, RentalApplicationRow, RentalContractRow } from '../db/repositories/rentalRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';
import { TokenPayload } from './authService.js';
import { CompanyService } from './companyService.js';

export class RentalService {
  /**
   * Tenant applies for a room
   */
  static applyForRoom(
    tenantId: string,
    data: { roomId: string; intendedStartDate: string; leaseDurationMonths: number; occupantsCount: number; notes?: string }
  ): RentalApplicationRow {
    const room = BuildingRepository.findRoomById(data.roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.status !== 'AVAILABLE') throw new Error('ROOM_NOT_AVAILABLE');

    const appId = 'app_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      const application = RentalRepository.createApplication({
        id: appId,
        room_id: data.roomId,
        tenant_id: tenantId,
        intended_start_date: data.intendedStartDate,
        lease_duration_months: data.leaseDurationMonths || 12,
        occupants_count: data.occupantsCount || 1,
        notes: data.notes || null,
        status: 'PENDING',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null
      });

      // Update room to RESERVED if not already
      BuildingRepository.updateRoom(data.roomId, { status: 'RESERVED' });

      // Notify building owner company admin
      const building = BuildingRepository.findBuildingById(room.building_id);
      if (building) {
        const notifId = 'notif_' + crypto.randomUUID().substring(0, 8);
        NotificationRepository.create({
          id: notifId,
          user_id: building.company_id, // can query company owner admin or broad
          type: 'NEW_RENTAL_APPLICATION',
          title: 'New Rental Application',
          message: `Application submitted for Room ${room.room_number} at ${building.name}`,
          entity_type: 'RENTAL_APPLICATION',
          entity_id: appId
        });
      }

      return application;
    });
  }

  /**
   * Owner reviews application (Approve / Reject)
   */
  static reviewApplication(
    auth: TokenPayload,
    applicationId: string,
    action: 'APPROVE' | 'REJECT',
    options?: { rejectionReason?: string; autoCreateContract?: boolean; startDate?: string; endDate?: string; rentAmount?: number; depositAmount?: number }
  ) {
    const app = RentalRepository.findApplicationById(applicationId);
    if (!app) throw new Error('APPLICATION_NOT_FOUND');
    if (app.status !== 'PENDING') throw new Error('APPLICATION_ALREADY_REVIEWED');

    // Verify company authorization
    const room = BuildingRepository.findRoomById(app.room_id);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const building = BuildingRepository.findBuildingById(room.building_id);
    if (!building) throw new Error('BUILDING_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, building.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const now = new Date().toISOString();

    return withTransaction(() => {
      let contract: RentalContractRow | null = null;

      if (action === 'APPROVE') {
        RentalRepository.updateApplication(applicationId, {
          status: 'APPROVED',
          reviewed_by: auth.userId,
          reviewed_at: now
        });

        // If requested, generate active rental contract
        if (options?.autoCreateContract) {
          const contractId = 'ctr_' + crypto.randomUUID().substring(0, 8);
          const contractNumber = `CTR-${building.name.substring(0, 3).toUpperCase()}-${room.room_number}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const startDate = options.startDate || app.intended_start_date;
          const duration = app.lease_duration_months || 12;
          const endObj = new Date(startDate);
          endObj.setMonth(endObj.getMonth() + duration);
          const endDate = options.endDate || endObj.toISOString().split('T')[0];

          const rentAmount = options.rentAmount !== undefined ? options.rentAmount : room.base_rent;
          const depositAmount = options.depositAmount !== undefined ? options.depositAmount : room.base_rent; // 1 month deposit standard

          contract = RentalRepository.createContract({
            id: contractId,
            contract_number: contractNumber,
            application_id: applicationId,
            room_id: room.id,
            tenant_id: app.tenant_id,
            company_id: building.company_id,
            start_date: startDate,
            end_date: endDate,
            rent_amount: rentAmount,
            deposit_amount: depositAmount,
            payment_frequency: 'MONTHLY',
            payment_day_of_month: 5,
            status: 'ACTIVE',
            terms: 'Standard residential lease agreement. Rent due on 5th of each month.'
          });

          // Create Deposit tracking record
          const depositId = 'dep_' + crypto.randomUUID().substring(0, 8);
          RentalRepository.createDeposit({
            id: depositId,
            contract_id: contractId,
            tenant_id: app.tenant_id,
            amount: depositAmount,
            received: 1,
            received_date: now.split('T')[0],
            status: 'HELD',
            notes: 'Initial lease security deposit received.'
          });

          // Mark room as OCCUPIED
          BuildingRepository.updateRoom(room.id, { status: 'OCCUPIED' });
        }

        // Notify tenant
        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: app.tenant_id,
          type: 'APPLICATION_APPROVED',
          title: 'Rental Application Approved!',
          message: `Your application for Room ${room.room_number} has been approved.`,
          entity_type: 'RENTAL_APPLICATION',
          entity_id: applicationId
        });

      } else {
        // REJECT
        RentalRepository.updateApplication(applicationId, {
          status: 'REJECTED',
          reviewed_by: auth.userId,
          reviewed_at: now,
          rejection_reason: options?.rejectionReason || 'Application declined by property management.'
        });

        // Release room back to AVAILABLE if it was reserved
        BuildingRepository.updateRoom(room.id, { status: 'AVAILABLE' });

        // Notify tenant
        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: app.tenant_id,
          type: 'APPLICATION_REJECTED',
          title: 'Rental Application Status Update',
          message: `Your application for Room ${room.room_number} was not approved. ${options?.rejectionReason || ''}`,
          entity_type: 'RENTAL_APPLICATION',
          entity_id: applicationId
        });
      }

      // Record Audit Log
      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: action === 'APPROVE' ? 'APPROVE_APPLICATION' : 'REJECT_APPLICATION',
        entity_type: 'RENTAL_APPLICATION',
        entity_id: applicationId,
        old_value: JSON.stringify({ status: 'PENDING' }),
        new_value: JSON.stringify({ status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', contractId: contract?.id })
      });

      return {
        applicationId,
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        contract
      };
    });
  }

  /**
   * Direct Contract Creation by Owner
   */
  static createContractDirect(
    auth: TokenPayload,
    data: {
      roomId: string;
      tenantId: string;
      startDate: string;
      endDate: string;
      rentAmount: number;
      depositAmount: number;
      paymentFrequency?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
      paymentDayOfMonth?: number;
      status?: 'DRAFT' | 'PENDING' | 'ACTIVE';
      terms?: string;
    }
  ): RentalContractRow {
    const room = BuildingRepository.findRoomById(data.roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const building = BuildingRepository.findBuildingById(room.building_id);
    if (!building) throw new Error('BUILDING_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, building.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const contractId = 'ctr_' + crypto.randomUUID().substring(0, 8);
    const contractNumber = `CTR-${building.name.substring(0, 3).toUpperCase()}-${room.room_number}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const status = data.status || 'ACTIVE';

    return withTransaction(() => {
      const contract = RentalRepository.createContract({
        id: contractId,
        contract_number: contractNumber,
        application_id: null,
        room_id: data.roomId,
        tenant_id: data.tenantId,
        company_id: building.company_id,
        start_date: data.startDate,
        end_date: data.endDate,
        rent_amount: data.rentAmount,
        deposit_amount: data.depositAmount,
        payment_frequency: data.paymentFrequency || 'MONTHLY',
        payment_day_of_month: data.paymentDayOfMonth || 5,
        status,
        terms: data.terms || 'Standard rental lease agreement.'
      });

      if (status === 'ACTIVE') {
        BuildingRepository.updateRoom(data.roomId, { status: 'OCCUPIED' });
      }

      // Record deposit
      if (data.depositAmount > 0) {
        RentalRepository.createDeposit({
          id: 'dep_' + crypto.randomUUID().substring(0, 8),
          contract_id: contractId,
          tenant_id: data.tenantId,
          amount: data.depositAmount,
          received: 1,
          received_date: data.startDate,
          status: 'HELD',
          notes: 'Security deposit for lease contract ' + contractNumber
        });
      }

      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: 'CREATE_CONTRACT',
        entity_type: 'RENTAL_CONTRACT',
        entity_id: contractId,
        old_value: null,
        new_value: JSON.stringify({ contractNumber, roomId: data.roomId, tenantId: data.tenantId, rentAmount: data.rentAmount, status })
      });

      return contract;
    });
  }
}
