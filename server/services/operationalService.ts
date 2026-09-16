import crypto from 'node:crypto';
import { withTransaction } from '../db/connection.js';
import { TokenPayload } from './authService.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';
import { OperationsRepository } from '../db/repositories/operationsRepository.js';
import { BillingRepository } from '../db/repositories/billingRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { RentalRepository } from '../db/repositories/rentalRepository.js';
import { ServiceRepository } from '../db/repositories/serviceRepository.js';

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

export class OperationalService {
  /**
   * Helper: Resolve company IDs for an authenticated user
   */
  private static getCompanyIdsForUser(auth: TokenPayload): string[] {
    return OperationsRepository.getUserCompanyIds(auth.userId, auth.role);
  }

  /**
   * 1. TODAY OPERATIONAL COCKPIT
   */
  static getTodayCockpit(auth: TokenPayload) {
    const companyIds = this.getCompanyIdsForUser(auth);
    if (companyIds.length === 0) {
      return {
        critical: [],
        attention: [],
        upcoming: [],
        healthySummary: { occupiedHealthy: 0, totalUnits: 0, collectionRate: 100, monthlyRevenue: 0 },
        timestamp: new Date().toISOString()
      };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check dismissed or snoozed actions
    const dismissedKeys = OperationsRepository.getActiveDismissals(todayStr);

    const criticalActions: ActionItem[] = [];
    const attentionActions: ActionItem[] = [];
    const upcomingActions: ActionItem[] = [];

    // --- A. INVOICES (Overdue & Due Soon) ---
    const invoices = OperationsRepository.getCockpitInvoices(companyIds);

    for (const inv of invoices) {
      const isOverdue = inv.status === 'OVERDUE' || inv.due_date < todayStr;
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 3600 * 24)));
      const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (isOverdue) {
        const actionKey = `overdue_inv_${inv.id}`;
        if (!dismissedKeys.has(actionKey)) {
          criticalActions.push({
            id: 'act_' + inv.id,
            actionKey,
            priority: 'CRITICAL',
            category: 'INVOICE',
            title: `Hóa đơn phòng ${inv.room_number} quá hạn ${daysOverdue > 0 ? daysOverdue + ' ngày' : 'hôm nay'}`,
            subtitle: `${inv.tenant_name} • Còn nợ ${(inv.outstanding_amount || inv.total).toLocaleString()} VND (${inv.building_name})`,
            badgeText: `${daysOverdue} ngày trễ`,
            badgeColor: 'bg-red-100 text-red-700 border-red-200',
            amount: inv.outstanding_amount || inv.total,
            dueDate: inv.due_date,
            entityType: 'INVOICE',
            entityId: inv.id,
            roomNumber: inv.room_number,
            roomId: inv.room_id,
            buildingName: inv.building_name,
            buildingId: inv.building_id,
            tenantName: inv.tenant_name,
            tenantPhone: inv.tenant_phone,
            quickAction: {
              type: 'remind_tenant',
              label: 'Nhắc cư dân',
              variant: 'primary'
            },
            createdAt: inv.created_at
          });
        }
      } else if (daysUntilDue <= 3 && daysUntilDue >= 0) {
        const actionKey = `due_soon_inv_${inv.id}`;
        if (!dismissedKeys.has(actionKey)) {
          attentionActions.push({
            id: 'act_' + inv.id,
            actionKey,
            priority: 'HIGH',
            category: 'INVOICE',
            title: `Hóa đơn phòng ${inv.room_number} đến hạn trong ${daysUntilDue} ngày`,
            subtitle: `${inv.tenant_name} • Số tiền: ${(inv.outstanding_amount || inv.total).toLocaleString()} VND (Hạn: ${inv.due_date})`,
            badgeText: `Còn ${daysUntilDue} ngày`,
            badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
            amount: inv.outstanding_amount || inv.total,
            dueDate: inv.due_date,
            daysRemaining: daysUntilDue,
            entityType: 'INVOICE',
            entityId: inv.id,
            roomNumber: inv.room_number,
            roomId: inv.room_id,
            buildingName: inv.building_name,
            buildingId: inv.building_id,
            tenantName: inv.tenant_name,
            tenantPhone: inv.tenant_phone,
            quickAction: {
              type: 'view_invoice',
              label: 'Xem chi tiết',
              variant: 'default'
            },
            createdAt: inv.created_at
          });
        }
      }
    }

    // --- B. SERVICE REQUESTS / MAINTENANCE ---
    const serviceRequests = OperationsRepository.getCockpitServiceRequests(companyIds);

    for (const sr of serviceRequests) {
      const isUrgent = sr.urgency === 'EMERGENCY' || sr.urgency === 'HIGH';
      const actionKey = `sr_${sr.id}`;
      if (dismissedKeys.has(actionKey)) continue;

      if (isUrgent) {
        criticalActions.push({
          id: 'act_' + sr.id,
          actionKey,
          priority: 'CRITICAL',
          category: 'MAINTENANCE',
          title: `Sự cố ${sr.urgency === 'EMERGENCY' ? 'khẩn cấp' : 'ưu tiên cao'}: ${sr.title}`,
          subtitle: `Phòng ${sr.room_number || 'Khu chung'} • ${sr.tenant_name || 'Cư dân'} • Trạng thái: ${sr.status}`,
          badgeText: sr.urgency,
          badgeColor: sr.urgency === 'EMERGENCY' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white',
          entityType: 'SERVICE_REQUEST',
          entityId: sr.id,
          roomNumber: sr.room_number,
          roomId: sr.room_id,
          buildingName: sr.building_name,
          buildingId: sr.building_id,
          tenantName: sr.tenant_name,
          tenantPhone: sr.tenant_phone,
          quickAction: {
            type: 'assign_technician',
            label: sr.status === 'PENDING' ? 'Giao kỹ thuật' : 'Điều phối xử lý',
            variant: 'danger'
          },
          createdAt: sr.created_at
        });
      } else {
        attentionActions.push({
          id: 'act_' + sr.id,
          actionKey,
          priority: 'MEDIUM',
          category: 'MAINTENANCE',
          title: `Yêu cầu bảo trì: ${sr.title}`,
          subtitle: `Phòng ${sr.room_number || 'N/A'} • ${sr.service_name || 'Dịch vụ'} (${sr.status})`,
          badgeText: sr.urgency,
          badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
          entityType: 'SERVICE_REQUEST',
          entityId: sr.id,
          roomNumber: sr.room_number,
          roomId: sr.room_id,
          buildingName: sr.building_name,
          buildingId: sr.building_id,
          tenantName: sr.tenant_name,
          tenantPhone: sr.tenant_phone,
          quickAction: {
            type: 'assign_technician',
            label: 'Xử lý yêu cầu',
            variant: 'default'
          },
          createdAt: sr.created_at
        });
      }
    }

    // --- C. CONTRACTS (Expiring within 30 days) ---
    const contracts = OperationsRepository.getCockpitContracts(companyIds);

    for (const ctr of contracts) {
      const daysLeft = Math.ceil((new Date(ctr.end_date).getTime() - now.getTime()) / (1000 * 3600 * 24));
      const actionKey = `exp_ctr_${ctr.id}`;
      if (dismissedKeys.has(actionKey)) continue;

      if (daysLeft <= 14 && daysLeft >= 0) {
        criticalActions.push({
          id: 'act_' + ctr.id,
          actionKey,
          priority: 'CRITICAL',
          category: 'CONTRACT',
          title: `Hợp đồng phòng ${ctr.room_number} hết hạn trong ${daysLeft} ngày`,
          subtitle: `${ctr.tenant_name} • HĐ #${ctr.contract_number} • Tiền thuê: ${ctr.rent_amount.toLocaleString()} VND`,
          badgeText: `${daysLeft} ngày`,
          badgeColor: 'bg-red-100 text-red-700 border-red-200',
          daysRemaining: daysLeft,
          entityType: 'CONTRACT',
          entityId: ctr.id,
          roomNumber: ctr.room_number,
          roomId: ctr.room_id,
          buildingName: ctr.building_name,
          buildingId: ctr.building_id,
          tenantName: ctr.tenant_name,
          tenantPhone: ctr.tenant_phone,
          quickAction: {
            type: 'renew_contract',
            label: 'Gia hạn hợp đồng',
            variant: 'primary'
          },
          createdAt: ctr.created_at
        });
      } else if (daysLeft > 14 && daysLeft <= 30) {
        upcomingActions.push({
          id: 'act_' + ctr.id,
          actionKey,
          priority: 'LOW',
          category: 'CONTRACT',
          title: `Hợp đồng phòng ${ctr.room_number} đến hạn tái ký (${daysLeft} ngày)`,
          subtitle: `${ctr.tenant_name} • Ngày kết thúc: ${ctr.end_date}`,
          badgeText: `Còn ${daysLeft} ngày`,
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
          daysRemaining: daysLeft,
          entityType: 'CONTRACT',
          entityId: ctr.id,
          roomNumber: ctr.room_number,
          roomId: ctr.room_id,
          buildingName: ctr.building_name,
          buildingId: ctr.building_id,
          tenantName: ctr.tenant_name,
          tenantPhone: ctr.tenant_phone,
          quickAction: {
            type: 'contact_tenant',
            label: 'Liên hệ tái ký',
            variant: 'default'
          },
          createdAt: ctr.created_at
        });
      }
    }

    // --- D. RENTAL APPLICATIONS (Pending) ---
    const pendingApps = OperationsRepository.getCockpitPendingApplications(companyIds);

    for (const app of pendingApps) {
      const actionKey = `pending_app_${app.id}`;
      if (dismissedKeys.has(actionKey)) continue;

      attentionActions.push({
        id: 'act_' + app.id,
        actionKey,
        priority: 'HIGH',
        category: 'APPLICATION',
        title: `Hồ sơ thuê mới: Phòng ${app.room_number}`,
        subtitle: `Ứng viên: ${app.tenant_name} • Thời hạn ${app.lease_duration_months} tháng (${app.building_name})`,
        badgeText: 'Chờ duyệt',
        badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        entityType: 'APPLICATION',
        entityId: app.id,
        roomNumber: app.room_number,
        roomId: app.room_id,
        buildingName: app.building_name,
        buildingId: app.building_id,
        tenantName: app.tenant_name,
        tenantPhone: app.tenant_phone,
        quickAction: {
          type: 'review_application',
          label: 'Duyệt hồ sơ',
          variant: 'primary'
        },
        createdAt: app.created_at
      });
    }

    // --- E. EQUIPMENT NEEDING REPAIR ---
    const faultyEquipment = OperationsRepository.getCockpitFaultyEquipment(companyIds);

    for (const eq of faultyEquipment) {
      const actionKey = `faulty_eq_${eq.id}`;
      if (dismissedKeys.has(actionKey)) continue;

      criticalActions.push({
        id: 'act_' + eq.id,
        actionKey,
        priority: 'HIGH',
        category: 'EQUIPMENT',
        title: `Thiết bị hỏng cần sửa chữa: ${eq.name}`,
        subtitle: `Phòng ${eq.room_number} • Số sê-ri: ${eq.serial_number || 'N/A'} (${eq.building_name})`,
        badgeText: 'Cần sửa',
        badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
        entityType: 'EQUIPMENT',
        entityId: eq.id,
        roomNumber: eq.room_number,
        roomId: eq.room_id,
        buildingName: eq.building_name,
        buildingId: eq.building_id,
        quickAction: {
          type: 'create_maintenance',
          label: 'Tạo bảo trì',
          variant: 'warning'
        },
        createdAt: eq.created_at
      });
    }

    // --- F. HEALTHY SUMMARY CALCULATION ---
    const allRooms = OperationsRepository.getCockpitRooms(companyIds);

    const totalUnits = allRooms.length;
    const occupiedUnits = allRooms.filter(r => r.status === 'OCCUPIED').length;
    const availableUnits = allRooms.filter(r => r.status === 'AVAILABLE').length;

    const invoiceStats = OperationsRepository.getCockpitInvoiceStats(companyIds);

    const totalBilled = invoiceStats?.total_billed || 0;
    const totalCollected = invoiceStats?.total_collected || 0;
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    return {
      critical: criticalActions,
      attention: attentionActions,
      upcoming: upcomingActions,
      healthySummary: {
        totalUnits,
        occupiedUnits,
        availableUnits,
        occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        collectionRate,
        monthlyRevenue: totalCollected,
        outstandingDebt: invoiceStats?.total_outstanding || 0
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 2. ACTION CENTER: Execute Quick Actions
   */
  static executeQuickAction(
    auth: TokenPayload,
    actionKey: string,
    actionType: string,
    payload: any = {}
  ) {
    const now = new Date().toISOString();

    return withTransaction(() => {
      if (actionType === 'remind_tenant') {
        const invId = payload.invoiceId || payload.entityId;
        const invoice = BillingRepository.findInvoiceById(invId);
        if (!invoice) throw new Error('INVOICE_NOT_FOUND');

        const room = BuildingRepository.findRoomById(invoice.room_id);
        const msg = `Kính gửi cư dân, hóa đơn phòng ${room?.room_number || ''} tháng ${invoice.billing_month} với số tiền ${(invoice.outstanding_amount || invoice.total).toLocaleString()} VND đã quá hạn. Vui lòng thanh toán sớm để đảm bảo quyền lợi dịch vụ.`;

        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: invoice.tenant_id,
          type: 'PAYMENT_REMINDER',
          title: `[Nhắc nhở] Thanh toán tiền phòng ${room?.room_number || ''}`,
          message: msg,
          entity_type: 'INVOICE',
          entity_id: invoice.id
        });

        AuditRepository.create({
          id: 'aud_' + crypto.randomUUID().substring(0, 8),
          actor_id: auth.userId,
          actor_email: auth.email,
          action: 'REMIND_TENANT_OVERDUE',
          entity_type: 'INVOICE',
          entity_id: invoice.id,
          new_value: JSON.stringify({ sentTo: invoice.tenant_id, amount: invoice.outstanding_amount })
        });

        return { success: true, message: 'Đã gửi thông báo nhắc nhở đến cư dân thành công.' };
      }

      if (actionType === 'renew_contract') {
        const contractId = payload.contractId || payload.entityId;
        const contract = RentalRepository.findContractById(contractId);
        if (!contract) throw new Error('CONTRACT_NOT_FOUND');

        // Extend by 12 months from end_date
        const currentEnd = new Date(contract.end_date);
        currentEnd.setFullYear(currentEnd.getFullYear() + 1);
        const newEndDate = currentEnd.toISOString().split('T')[0];

        RentalRepository.updateContract(contractId, {
          end_date: newEndDate,
          status: 'ACTIVE'
        });

        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: contract.tenant_id,
          type: 'CONTRACT_RENEWED',
          title: 'Hợp đồng thuê đã được gia hạn',
          message: `Hợp đồng #${contract.contract_number} của bạn đã được gia hạn thành công đến ngày ${newEndDate}.`,
          entity_type: 'RENTAL_CONTRACT',
          entity_id: contractId
        });

        AuditRepository.create({
          id: 'aud_' + crypto.randomUUID().substring(0, 8),
          actor_id: auth.userId,
          actor_email: auth.email,
          action: 'RENEW_CONTRACT',
          entity_type: 'RENTAL_CONTRACT',
          entity_id: contractId,
          old_value: JSON.stringify({ end_date: contract.end_date }),
          new_value: JSON.stringify({ end_date: newEndDate, status: 'ACTIVE' })
        });

        return { success: true, message: `Đã gia hạn hợp đồng thành công đến ${newEndDate}.` };
      }

      if (actionType === 'assign_technician') {
        const srId = payload.serviceRequestId || payload.entityId;
        const staffId = payload.staffId;
        const sr = ServiceRepository.findRequestById(srId);
        if (!sr) throw new Error('SERVICE_REQUEST_NOT_FOUND');

        let chosenStaffId = staffId;
        if (!chosenStaffId) {
          chosenStaffId = OperationsRepository.findAvailableStaff(sr.provider_company_id) || auth.userId;
        }

        const assignmentId = 'asg_' + crypto.randomUUID().substring(0, 8);
        OperationsRepository.assignServiceRequest(assignmentId, srId, chosenStaffId, now);

        // Notify staff and tenant
        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: chosenStaffId,
          type: 'DISPATCH_ASSIGNMENT',
          title: 'Phân công kỹ thuật viên mới',
          message: `Bạn được giao xử lý sự cố: ${sr.title}. Vui lòng kiểm tra và tiếp nhận.`,
          entity_type: 'SERVICE_REQUEST',
          entity_id: srId
        });

        NotificationRepository.create({
          id: 'notif_' + crypto.randomUUID().substring(0, 8),
          user_id: sr.tenant_id,
          type: 'STAFF_ASSIGNED',
          title: 'Kỹ thuật viên đã được điều phối',
          message: `Yêu cầu sửa chữa "${sr.title}" của bạn đã được giao kỹ thuật viên tiếp nhận xử lý.`,
          entity_type: 'SERVICE_REQUEST',
          entity_id: srId
        });

        return { success: true, message: 'Đã phân công kỹ thuật viên xử lý sự cố thành công.' };
      }

      if (actionType === 'snooze') {
        const days = payload.days || 1;
        const snoozeDate = new Date();
        snoozeDate.setDate(snoozeDate.getDate() + days);
        const untilStr = snoozeDate.toISOString().split('T')[0];

        OperationsRepository.upsertDismissal(
          'dsm_' + crypto.randomUUID().substring(0, 8),
          actionKey,
          untilStr,
          'Snoozed by user',
          now
        );

        return { success: true, message: `Đã tạm ẩn việc này đến ngày ${untilStr}.` };
      }

      if (actionType === 'dismiss') {
        OperationsRepository.upsertDismissal(
          'dsm_' + crypto.randomUUID().substring(0, 8),
          actionKey,
          null,
          'Dismissed permanently',
          now
        );

        return { success: true, message: 'Đã bỏ qua mục hành động này.' };
      }

      throw new Error('UNKNOWN_ACTION_TYPE');
    });
  }

  /**
   * Helpers: Privacy Masking for PII
   */
  private static maskPhone(phone?: string | null): string | null {
    if (!phone) return null;
    const clean = phone.trim();
    if (clean.length < 6) return '***';
    return clean.slice(0, 4) + ' ••• ' + clean.slice(-3);
  }

  private static maskEmail(email?: string | null): string | null {
    if (!email) return null;
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***.***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
    return `${maskedName}@${domain}`;
  }

  /**
   * 3. BUILDING 360 OPERATIONAL VIEW
   */
  static getBuilding360(buildingId: string, auth?: TokenPayload) {
    const building = OperationsRepository.getBuildingDetail(buildingId);
    if (!building) throw new Error('BUILDING_NOT_FOUND');

    const isPrivileged = !!(auth && (auth.role === 'OWNER' || auth.role === 'SUPER_ADMIN'));
    const floors = OperationsRepository.getFloorsByBuilding(buildingId);
    const todayStr = new Date().toISOString().split('T')[0];
    const rooms = OperationsRepository.getRoomsWithHealthData(buildingId, todayStr);

    // Compute Health Status for each room for Visual Room Map
    const mappedRooms = rooms.map(r => {
      let healthStatus: 'CRITICAL' | 'ATTENTION' | 'AVAILABLE' | 'HEALTHY' = 'HEALTHY';
      let healthReason = 'Hoạt động bình thường';

      if (r.overdue_count > 0) {
        healthStatus = 'CRITICAL';
        healthReason = 'Có hóa đơn quá hạn chưa thanh toán';
      } else if (r.critical_issues_count > 0) {
        healthStatus = 'CRITICAL';
        healthReason = 'Có sự cố khẩn cấp đang xử lý';
      } else if (r.status === 'MAINTENANCE') {
        healthStatus = 'ATTENTION';
        healthReason = 'Đang bảo trì phòng định kỳ';
      } else if (r.status === 'RESERVED') {
        healthStatus = 'ATTENTION';
        healthReason = 'Đã giữ chỗ, chờ ký hợp đồng';
      } else if (r.status === 'AVAILABLE') {
        healthStatus = 'AVAILABLE';
        healthReason = 'Phòng trống, sẵn sàng cho thuê';
      } else if (r.contract_end_date && (new Date(r.contract_end_date).getTime() - Date.now()) / (1000 * 3600 * 24) <= 30) {
        healthStatus = 'ATTENTION';
        healthReason = 'Hợp đồng sắp hết hạn trong 30 ngày';
      }

      return {
        ...r,
        tenant_phone: isPrivileged ? r.tenant_phone : this.maskPhone(r.tenant_phone),
        tenant_email: isPrivileged ? r.tenant_email : this.maskEmail(r.tenant_email),
        isTenantDataMasked: !isPrivileged,
        healthStatus,
        healthReason
      };
    });

    // Group rooms by floor
    const floorsWithRooms = floors.map(f => ({
      ...f,
      rooms: mappedRooms.filter(r => r.floor_id === f.id)
    }));

    // Financial Metrics for this building
    const financialStats = OperationsRepository.getBuildingFinancialStats(buildingId);

    const totalRooms = mappedRooms.length;
    const occupiedRooms = mappedRooms.filter(r => r.status === 'OCCUPIED').length;
    const availableRooms = mappedRooms.filter(r => r.status === 'AVAILABLE').length;
    const maintenanceRooms = mappedRooms.filter(r => r.status === 'MAINTENANCE').length;
    const reservedRooms = mappedRooms.filter(r => r.status === 'RESERVED').length;
    const criticalRooms = mappedRooms.filter(r => r.healthStatus === 'CRITICAL').length;

    // Open work orders
    const openWorkOrdersCount = OperationsRepository.getBuildingOpenWorkOrders(buildingId);

    // Recent activity feed for this building
    const recentActivity = OperationsRepository.getRecentActivity(10);

    return {
      building,
      summary: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        maintenanceRooms,
        reservedRooms,
        criticalRooms,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        totalBilled: financialStats?.total_billed || 0,
        totalCollected: financialStats?.total_collected || 0,
        totalOutstanding: financialStats?.total_outstanding || 0,
        collectionRate: financialStats?.total_billed > 0 ? Math.round((financialStats.total_collected / financialStats.total_billed) * 100) : 100,
        openWorkOrdersCount
      },
      floors: floorsWithRooms,
      recentActivity
    };
  }

  /**
   * 4. ROOM 360 OPERATIONAL VIEW
   */
  static getRoom360(roomId: string, auth?: TokenPayload) {
    const room = OperationsRepository.getRoomDetailWithContext(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const isPrivileged = !!(auth && (auth.role === 'OWNER' || auth.role === 'SUPER_ADMIN'));

    // Parse JSON
    try {
      room.amenities = room.amenities ? JSON.parse(room.amenities) : [];
      room.images = room.images ? JSON.parse(room.images) : [];
    } catch {
      room.amenities = [];
      room.images = [];
    }

    // Active Contract
    const activeContract = OperationsRepository.getRoomActiveContract(roomId);

    // Deposit for active contract
    let deposit = null;
    if (activeContract) {
      deposit = OperationsRepository.getDepositForContract(activeContract.id);
    }

    // Equipment
    const equipment = OperationsRepository.getEquipmentForRoom(roomId);

    // Meters & Latest Readings
    const meters = OperationsRepository.getMetersForRoom(roomId);

    // Invoices
    const invoices = OperationsRepository.getInvoicesForRoom(roomId, 12);

    // Service Requests
    const serviceRequests = OperationsRepository.getServiceRequestsForRoom(roomId);

    // Synthesize Chronological Room Timeline
    const timeline: any[] = [];

    if (activeContract) {
      timeline.push({
        type: 'MOVE_IN',
        date: activeContract.start_date,
        title: 'Cư dân dọn vào ở (Move-in)',
        description: `Cư dân ${activeContract.tenant_name} bắt đầu thời hạn thuê theo hợp đồng #${activeContract.contract_number}.`,
        badgeColor: 'bg-emerald-500'
      });
      timeline.push({
        type: 'CONTRACT_ACTIVE',
        date: activeContract.created_at.split('T')[0],
        title: `Ký kết hợp đồng #${activeContract.contract_number}`,
        description: `Giá thuê: ${activeContract.rent_amount.toLocaleString()} VND/tháng. Đặt cọc: ${activeContract.deposit_amount.toLocaleString()} VND.`,
        badgeColor: 'bg-blue-500'
      });
    }

    for (const inv of invoices) {
      timeline.push({
        type: 'INVOICE_ISSUED',
        date: inv.issue_date,
        title: `Phát hành hóa đơn ${inv.invoice_number}`,
        description: `Kỳ phí ${inv.billing_month} - Tổng cộng: ${inv.total.toLocaleString()} VND (Trạng thái: ${inv.status}).`,
        badgeColor: inv.status === 'PAID' ? 'bg-emerald-500' : inv.status === 'OVERDUE' ? 'bg-red-500' : 'bg-amber-500'
      });
    }

    for (const sr of serviceRequests) {
      timeline.push({
        type: 'SERVICE_REQUEST',
        date: sr.created_at.split('T')[0],
        title: `Yêu cầu dịch vụ: ${sr.title}`,
        description: `${sr.service_name || 'Bảo trì'} • Mức độ: ${sr.urgency} • Trạng thái: ${sr.status} ${sr.technician_name ? '• Kỹ thuật: ' + sr.technician_name : ''}.`,
        badgeColor: sr.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-purple-500'
      });
    }

    // Sort timeline descending by date
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      room,
      tenant: activeContract ? {
        id: activeContract.tenant_id,
        name: activeContract.tenant_name,
        email: isPrivileged ? activeContract.tenant_email : this.maskEmail(activeContract.tenant_email),
        phone: isPrivileged ? activeContract.tenant_phone : this.maskPhone(activeContract.tenant_phone),
        isMasked: !isPrivileged,
        avatarUrl: activeContract.tenant_avatar,
        contractId: activeContract.id,
        contractNumber: activeContract.contract_number,
        startDate: activeContract.start_date,
        endDate: activeContract.end_date,
        rentAmount: activeContract.rent_amount
      } : null,
      activeContract: activeContract ? {
        ...activeContract,
        tenant_email: isPrivileged ? activeContract.tenant_email : this.maskEmail(activeContract.tenant_email),
        tenant_phone: isPrivileged ? activeContract.tenant_phone : this.maskPhone(activeContract.tenant_phone)
      } : null,
      deposit,
      meters,
      equipment,
      invoices,
      serviceRequests,
      timeline,
      isPrivileged
    };
  }

  /**
   * 5. UNIVERSAL SEARCH (Global Search / Command Palette)
   */
  static globalSearch(query: string, auth: TokenPayload) {
    if (!query || query.trim().length === 0) {
      return { rooms: [], tenants: [], buildings: [], contracts: [], invoices: [], serviceRequests: [], equipment: [] };
    }

    const companyIds = this.getCompanyIdsForUser(auth);
    const trimmed = query.trim();

    return {
      rooms: OperationsRepository.searchRooms(trimmed, companyIds),
      tenants: OperationsRepository.searchTenants(trimmed),
      buildings: OperationsRepository.searchBuildings(trimmed, companyIds),
      contracts: OperationsRepository.searchContracts(trimmed, companyIds),
      invoices: OperationsRepository.searchInvoices(trimmed, companyIds),
      serviceRequests: OperationsRepository.searchServiceRequests(trimmed),
      equipment: OperationsRepository.searchEquipment(trimmed)
    };
  }

  /**
   * 6. AI INSIGHT LAYER
   */
  static getAiInsights(auth: TokenPayload) {
    const companyIds = this.getCompanyIdsForUser(auth);
    if (companyIds.length === 0) return { insights: [] };

    const insights: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Insight 1: Overdue Receivable Risk
    const overdueInvoices = OperationsRepository.getOverdueInvoicesForInsights(companyIds, todayStr, 3);

    if (overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.outstanding_amount || inv.total), 0);
      insights.push({
        id: 'ins_overdue',
        impactLevel: 'CRITICAL',
        title: `Phát hiện nợ đọng tồn đọng (${totalOverdue.toLocaleString()} VND)`,
        reason: `Có ${overdueInvoices.length} phòng đang chậm thanh toán tiền thuê, rủi ro ảnh hưởng dòng tiền tháng.`,
        relevantData: overdueInvoices.map(i => `Phòng ${i.room_number} (${i.tenant_name}): ${(i.outstanding_amount || i.total).toLocaleString()} VND`),
        suggestedAction: 'Gửi lời nhắc tự động đợt 2 cho các cư dân có nợ đọng',
        actionType: 'remind_tenant',
        actionPayload: { invoiceId: overdueInvoices[0].id }
      });
    }

    // Insight 2: Recurring Maintenance / Equipment Deterioration
    const repeatedMaintenance = OperationsRepository.getRepeatedMaintenance(2);

    if (repeatedMaintenance.length > 0) {
      const item = repeatedMaintenance[0];
      insights.push({
        id: 'ins_maintenance_loop',
        impactLevel: 'WARNING',
        title: `Phòng ${item.room_number} có tần suất sự cố cao (${item.req_count} lượt/tháng)`,
        reason: 'Thiết bị làm mát và hệ thống nước tại căn này đang có tần suất báo hỏng lặp lại, dấu hiệu linh kiện đã xuống cấp.',
        relevantData: [`Phòng ${item.room_number}: ${item.req_count} phiếu yêu cầu trong 30 ngày qua`],
        suggestedAction: 'Xem xét cử kỹ sư trưởng kiểm tra tổng thể hoặc thay mới máy nén',
        actionType: 'view_room_360',
        actionPayload: { roomId: item.room_id }
      });
    }

    // Insight 3: Lease Renewal Opportunity
    const expiringSoon = OperationsRepository.getContractsExpiringWithin30Days(companyIds, todayStr);

    if (expiringSoon.length > 0) {
      insights.push({
        id: 'ins_churn_prevention',
        impactLevel: 'OPPORTUNITY',
        title: `${expiringSoon.length} hợp đồng thuê sắp kết thúc trong 30 ngày`,
        reason: 'Liên hệ gia hạn trước 30 ngày giúp duy trì tỷ lệ lấp đầy 100% và giảm thiểu thời gian phòng chờ trống.',
        relevantData: expiringSoon.map(c => `HĐ #${c.contract_number} (Phòng ${c.room_number} - ${c.tenant_name}, hết hạn ${c.end_date})`),
        suggestedAction: 'Bắt đầu gửi đề xuất tái ký hợp đồng ưu đãi giữ chân cư dân',
        actionType: 'renew_contract',
        actionPayload: { contractId: expiringSoon[0].id }
      });
    }

    return { insights };
  }

  /**
   * 7. AI MAINTENANCE TRIAGE
   */
  static aiTriage(description: string, categoryHint?: string) {
    const text = (description + ' ' + (categoryHint || '')).toLowerCase();

    let category: 'HVAC' | 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'SECURITY' | 'OTHER' = 'OTHER';
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' = 'MEDIUM';
    let possibleIssues: string[] = [];
    let suggestedChecks: string[] = [];

    if (text.includes('máy lạnh') || text.includes('điều hòa') || text.includes('ac') || text.includes('lạnh') || text.includes('chảy nước')) {
      category = 'HVAC';
      urgency = text.includes('chảy nước') || text.includes('bốc mùi') ? 'HIGH' : 'MEDIUM';
      possibleIssues = [
        'Nghẹt đường ống xả thoát nước ngưng',
        'Lưới lọc bụi bẩn làm giảm lưu lượng gió',
        'Thiếu môi chất lạnh (Ga R32/R410A) hoặc rò rỉ van nạp'
      ];
      suggestedChecks = [
        'Vệ sinh tấm lọc gió dàn lạnh',
        'Thông ống thoát nước ngưng bằng khí nén',
        'Đo áp suất ga hút và kiểm tra rò rỉ bọt xà phòng'
      ];
    } else if (text.includes('nước') || text.includes('vòi') || text.includes('nghẹt') || text.includes('rò rỉ') || text.includes('bồn cầu') || text.includes('lavabo')) {
      category = 'PLUMBING';
      urgency = text.includes('ngập') || text.includes('vỡ') ? 'EMERGENCY' : 'HIGH';
      possibleIssues = [
        'Rò rỉ gioăng cao su khớp nối van cấp',
        'Tắc nghẽn bẫy chữ P (P-trap) do tóc hoặc cặn bã',
        'Hỏng phao cấp xả bồn cầu gây tràn liên tục'
      ];
      suggestedChecks = [
        'Khóa van chặn nhánh khẩn cấp',
        'Tháo vệ sinh bẫy chữ P dưới bồn rửa',
        'Kiểm tra áp lực đường cấp chính'
      ];
    } else if (text.includes('điện') || text.includes('chập') || text.includes('sập aptomat') || text.includes('nhấp nháy') || text.includes('ổ cắm')) {
      category = 'ELECTRICAL';
      urgency = text.includes('cháy') || text.includes('chập') || text.includes('khét') ? 'EMERGENCY' : 'HIGH';
      possibleIssues = [
        'Quá tải tức thời làm nhảy aptomat nhánh',
        'Lỏng ốc siết cọc tiếp xúc trong đế âm tường',
        'Chập vi mạch nguồn LED driver đèn trần'
      ];
      suggestedChecks = [
        'Dùng bút thử điện kiểm tra rò vỏ thiết bị',
        'Kiểm tra thông mạch CB chống giật RCBO',
        'Đo điện áp tải lúc bật thiết bị công suất lớn'
      ];
    } else if (text.includes('dọn') || text.includes('vệ sinh') || text.includes('bẩn') || text.includes('sofa') || text.includes('nệm')) {
      category = 'CLEANING';
      urgency = 'LOW';
      possibleIssues = ['Cần phun khử khuẩn và giặt sâu hơi nước'];
      suggestedChecks = ['Đánh giá chất liệu vải nỉ/da', 'Chọn dung dịch trung tính diệt khuẩn'];
    } else if (text.includes('khóa') || text.includes('mật khẩu') || text.includes('kẹt cửa') || text.includes('hết pin')) {
      category = 'SECURITY';
      urgency = 'HIGH';
      possibleIssues = ['Pin khóa thông minh dưới 10%', 'Kẹt lẫy chốt cơ học'];
      suggestedChecks = ['Kích nguồn khẩn cấp qua cổng Type-C/9V', 'Kiểm tra độ rơ của khe hở đố cửa'];
    }

    const recommendedService = OperationsRepository.getRecommendedService(category);

    return {
      category,
      urgency,
      possibleIssues,
      suggestedChecks,
      recommendedService: recommendedService || null
    };
  }
}
