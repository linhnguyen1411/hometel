import crypto from 'node:crypto';
import { withTransaction } from '../db/connection.js';
import { ServiceRepository, ServiceRequestRow } from '../db/repositories/serviceRepository.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';
import { TokenPayload } from './authService.js';
import { CompanyService } from './companyService.js';

export class ServiceRequestService {
  static createRequest(
    tenantId: string,
    data: {
      serviceId: string;
      roomId?: string;
      title: string;
      description: string;
      preferredDate?: string;
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
    }
  ): ServiceRequestRow {
    const service = ServiceRepository.findServiceById(data.serviceId);
    if (!service) throw new Error('SERVICE_NOT_FOUND');

    const reqId = 'sr_' + crypto.randomUUID().substring(0, 8);

    return withTransaction(() => {
      const request = ServiceRepository.createRequest({
        id: reqId,
        service_id: data.serviceId,
        provider_company_id: service.company_id,
        tenant_id: tenantId,
        room_id: data.roomId || null,
        title: data.title,
        description: data.description,
        preferredDate: data.preferredDate || null,
        urgency: data.urgency || 'MEDIUM',
        status: 'PENDING',
        estimated_cost: service.base_price,
        final_cost: null,
        rejection_reason: null
      } as any);

      // Notify provider company
      NotificationRepository.create({
        id: 'notif_' + crypto.randomUUID().substring(0, 8),
        user_id: service.company_id,
        type: 'NEW_SERVICE_REQUEST',
        title: `New Service Request: ${service.name}`,
        message: `Tenant submitted a ${data.urgency || 'MEDIUM'} priority request: "${data.title}"`,
        entity_type: 'SERVICE_REQUEST',
        entity_id: reqId
      });

      return request;
    });
  }

  static reviewRequest(
    auth: TokenPayload,
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    options?: { rejectionReason?: string; estimatedCost?: number }
  ) {
    const req = ServiceRepository.findRequestById(requestId);
    if (!req) throw new Error('SERVICE_REQUEST_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, req.provider_company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    if (req.status !== 'PENDING') {
      throw new Error('REQUEST_ALREADY_REVIEWED');
    }

    return withTransaction(() => {
      const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = ServiceRepository.updateRequest(requestId, {
        status: newStatus,
        rejection_reason: action === 'REJECT' ? options?.rejectionReason || 'Declined by provider' : null,
        estimated_cost: options?.estimatedCost !== undefined ? options.estimatedCost : req.estimated_cost
      });

      // Notify tenant
      NotificationRepository.create({
        id: 'notif_' + crypto.randomUUID().substring(0, 8),
        user_id: req.tenant_id,
        type: action === 'APPROVE' ? 'SERVICE_REQUEST_APPROVED' : 'SERVICE_REQUEST_REJECTED',
        title: `Service Request ${action === 'APPROVE' ? 'Approved' : 'Declined'}`,
        message: `Your request "${req.title}" has been ${action.toLowerCase()}d.`,
        entity_type: 'SERVICE_REQUEST',
        entity_id: requestId
      });

      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: action === 'APPROVE' ? 'APPROVE_SERVICE_REQUEST' : 'REJECT_SERVICE_REQUEST',
        entity_type: 'SERVICE_REQUEST',
        entity_id: requestId,
        old_value: JSON.stringify({ status: req.status }),
        new_value: JSON.stringify({ status: newStatus })
      });

      return updated;
    });
  }

  static assignStaff(
    auth: TokenPayload,
    requestId: string,
    staffId: string,
    notes?: string
  ) {
    const req = ServiceRepository.findRequestById(requestId);
    if (!req) throw new Error('SERVICE_REQUEST_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, req.provider_company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const assignId = 'sa_' + crypto.randomUUID().substring(0, 8);
    const now = new Date().toISOString();

    return withTransaction(() => {
      const assignment = ServiceRepository.assignStaff({
        id: assignId,
        service_request_id: requestId,
        staff_id: staffId,
        assigned_at: now,
        started_at: null,
        completed_at: null,
        notes: notes || null,
        status: 'ASSIGNED'
      });

      // Notify assigned staff member
      NotificationRepository.create({
        id: 'notif_' + crypto.randomUUID().substring(0, 8),
        user_id: staffId,
        type: 'STAFF_ASSIGNED',
        title: 'New Service Assignment',
        message: `You have been assigned to service request: "${req.title}"`,
        entity_type: 'SERVICE_REQUEST',
        entity_id: requestId
      });

      // Notify tenant
      NotificationRepository.create({
        id: 'notif_' + crypto.randomUUID().substring(0, 8),
        user_id: req.tenant_id,
        type: 'STAFF_ASSIGNED',
        title: 'Technician Assigned',
        message: `A staff technician has been assigned to your request "${req.title}".`,
        entity_type: 'SERVICE_REQUEST',
        entity_id: requestId
      });

      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: 'ASSIGN_SERVICE_STAFF',
        entity_type: 'SERVICE_REQUEST',
        entity_id: requestId,
        old_value: JSON.stringify({ status: req.status }),
        new_value: JSON.stringify({ status: 'ASSIGNED', staffId })
      });

      return assignment;
    });
  }

  static updateExecutionStatus(
    auth: TokenPayload,
    assignmentId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    options?: { finalCost?: number; notes?: string }
  ) {
    return withTransaction(() => {
      const assignment = ServiceRepository.updateAssignmentStatus(assignmentId, status, options?.notes);

      if (options?.finalCost !== undefined) {
        ServiceRepository.updateRequest(assignment.service_request_id, {
          final_cost: options.finalCost
        });
      }

      // Notify tenant
      const req = ServiceRepository.findRequestById(assignment.service_request_id);
      if (req) {
        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: req.tenant_id,
          type: status === 'COMPLETED' ? 'SERVICE_COMPLETED' : 'SERVICE_IN_PROGRESS',
          title: status === 'COMPLETED' ? 'Service Completed!' : 'Service In Progress',
          message: status === 'COMPLETED' ? `Service "${req.title}" has been successfully completed.` : `Technician has started work on "${req.title}".`,
          entity_type: 'SERVICE_REQUEST',
          entity_id: req.id
        });
      }

      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: 'UPDATE_SERVICE_EXECUTION',
        entity_type: 'SERVICE_ASSIGNMENT',
        entity_id: assignmentId,
        old_value: null,
        new_value: JSON.stringify({ status, finalCost: options?.finalCost })
      });

      return assignment;
    });
  }
}
