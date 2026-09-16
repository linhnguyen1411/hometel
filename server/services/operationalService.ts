import crypto from 'node:crypto';
import { getDatabase, withTransaction } from '../db/connection.js';
import { TokenPayload } from './authService.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';

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
    const db = getDatabase();
    if (auth.role === 'SUPER_ADMIN') {
      const all = db.prepare('SELECT id FROM companies WHERE status = "ACTIVE"').all() as any[];
      return all.map(c => c.id);
    }
    const mems = db.prepare('SELECT company_id FROM company_memberships WHERE user_id = ? AND status = "ACTIVE"').all(auth.userId) as any[];
    return mems.map(m => m.company_id);
  }

  /**
   * 1. TODAY OPERATIONAL COCKPIT
   */
  static getTodayCockpit(auth: TokenPayload) {
    const db = getDatabase();
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

    const compPlaceholders = companyIds.map(() => '?').join(',');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check dismissed or snoozed actions
    const dismissedRows = db.prepare(`
      SELECT action_key FROM action_dismissals 
      WHERE dismissed_until IS NULL OR dismissed_until > ?
    `).all(todayStr) as { action_key: string }[];
    const dismissedKeys = new Set(dismissedRows.map(r => r.action_key));

    const criticalActions: ActionItem[] = [];
    const attentionActions: ActionItem[] = [];
    const upcomingActions: ActionItem[] = [];

    // --- A. INVOICES (Overdue & Due Soon) ---
    const invoices = db.prepare(`
      SELECT i.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON i.tenant_id = u.id
      WHERE i.company_id IN (${compPlaceholders})
      AND i.status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
    `).all(...companyIds) as any[];

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
    const serviceRequests = db.prepare(`
      SELECT sr.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone,
             s.name as service_name
      FROM service_requests sr
      LEFT JOIN rooms r ON sr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN users u ON sr.tenant_id = u.id
      LEFT JOIN services s ON sr.service_id = s.id
      WHERE (sr.provider_company_id IN (${compPlaceholders}) OR r.building_id IN (SELECT id FROM buildings WHERE company_id IN (${compPlaceholders})))
      AND sr.status IN ('PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS')
    `).all(...companyIds, ...companyIds) as any[];

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
    const contracts = db.prepare(`
      SELECT c.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.company_id IN (${compPlaceholders})
      AND c.status IN ('ACTIVE', 'EXPIRING')
    `).all(...companyIds) as any[];

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
    const pendingApps = db.prepare(`
      SELECT a.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM rental_applications a
      JOIN rooms r ON a.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON a.tenant_id = u.id
      WHERE b.company_id IN (${compPlaceholders})
      AND a.status = 'PENDING'
    `).all(...companyIds) as any[];

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
    const faultyEquipment = db.prepare(`
      SELECT eq.*, r.room_number, b.name as building_name, b.id as building_id
      FROM equipment eq
      JOIN rooms r ON eq.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      WHERE b.company_id IN (${compPlaceholders})
      AND eq.condition = 'NEEDS_REPAIR'
    `).all(...companyIds) as any[];

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
    const allRooms = db.prepare(`
      SELECT r.id, r.status, b.company_id
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      WHERE b.company_id IN (${compPlaceholders})
    `).all(...companyIds) as any[];

    const totalUnits = allRooms.length;
    const occupiedUnits = allRooms.filter(r => r.status === 'OCCUPIED').length;
    const availableUnits = allRooms.filter(r => r.status === 'AVAILABLE').length;

    const invoiceStats = db.prepare(`
      SELECT 
        SUM(total) as total_billed,
        SUM(paid_amount) as total_collected,
        SUM(outstanding_amount) as total_outstanding
      FROM invoices
      WHERE company_id IN (${compPlaceholders})
    `).get(...companyIds) as any;

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
        totalBilled,
        totalCollected,
        totalOutstanding: invoiceStats?.total_outstanding || 0,
        collectionRate,
        criticalCount: criticalActions.length,
        attentionCount: attentionActions.length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 2. EXECUTE QUICK ACTION
   */
  static executeQuickAction(
    auth: TokenPayload,
    actionKey: string,
    actionType: string,
    payload: any = {}
  ) {
    const db = getDatabase();
    const now = new Date().toISOString();

    return withTransaction(() => {
      if (actionType === 'remind_tenant') {
        // Find invoice or tenant
        const invId = payload.invoiceId || payload.entityId;
        const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
        if (!invoice) throw new Error('INVOICE_NOT_FOUND');

        const room = db.prepare('SELECT room_number FROM rooms WHERE id = ?').get(invoice.room_id) as any;
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
        const contract = db.prepare('SELECT * FROM rental_contracts WHERE id = ?').get(contractId) as any;
        if (!contract) throw new Error('CONTRACT_NOT_FOUND');

        // Extend by 12 months from end_date
        const currentEnd = new Date(contract.end_date);
        currentEnd.setFullYear(currentEnd.getFullYear() + 1);
        const newEndDate = currentEnd.toISOString().split('T')[0];

        db.prepare(`
          UPDATE rental_contracts 
          SET end_date = ?, status = 'ACTIVE', updated_at = ?
          WHERE id = ?
        `).run(newEndDate, now, contractId);

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
        const sr = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(srId) as any;
        if (!sr) throw new Error('SERVICE_REQUEST_NOT_FOUND');

        // Pick staff if not specified
        let chosenStaffId = staffId;
        if (!chosenStaffId) {
          const availableStaff = db.prepare(`
            SELECT user_id FROM company_memberships 
            WHERE role = 'STAFF' AND status = 'ACTIVE'
            LIMIT 1
          `).get() as any;
          chosenStaffId = availableStaff?.user_id || auth.userId;
        }

        db.prepare(`
          UPDATE service_requests
          SET status = 'ASSIGNED', updated_at = ?
          WHERE id = ?
        `).run(now, srId);

        const assignmentId = 'asg_' + crypto.randomUUID().substring(0, 8);
        db.prepare(`
          INSERT INTO service_assignments (id, service_request_id, staff_id, assigned_at, status)
          VALUES (?, ?, ?, ?, 'ASSIGNED')
          ON CONFLICT(id) DO UPDATE SET staff_id = excluded.staff_id, status = 'ASSIGNED'
        `).run(assignmentId, srId, chosenStaffId, now);

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

        db.prepare(`
          INSERT INTO action_dismissals (id, action_key, dismissed_until, reason, created_at)
          VALUES (?, ?, ?, 'Snoozed by user', ?)
          ON CONFLICT(action_key) DO UPDATE SET dismissed_until = excluded.dismissed_until
        `).run('dsm_' + crypto.randomUUID().substring(0, 8), actionKey, untilStr, now);

        return { success: true, message: `Đã tạm ẩn việc này đến ngày ${untilStr}.` };
      }

      if (actionType === 'dismiss') {
        db.prepare(`
          INSERT INTO action_dismissals (id, action_key, dismissed_until, reason, created_at)
          VALUES (?, ?, NULL, 'Dismissed permanently', ?)
          ON CONFLICT(action_key) DO UPDATE SET dismissed_until = NULL
        `).run('dsm_' + crypto.randomUUID().substring(0, 8), actionKey, now);

        return { success: true, message: 'Đã bỏ qua mục hành động này.' };
      }

      throw new Error('UNKNOWN_ACTION_TYPE');
    });
  }

  /**
   * 3. BUILDING 360 OPERATIONAL VIEW
   */
  static getBuilding360(buildingId: string) {
    const db = getDatabase();

    const building = db.prepare(`
      SELECT b.*, c.name as company_name, c.phone as company_phone, c.email as company_email
      FROM buildings b
      JOIN companies c ON b.company_id = c.id
      WHERE b.id = ?
    `).get(buildingId) as any;
    if (!building) throw new Error('BUILDING_NOT_FOUND');

    const floors = db.prepare(`
      SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC
    `).all(buildingId) as any[];

    const todayStr = new Date().toISOString().split('T')[0];

    const rooms = db.prepare(`
      SELECT r.*, f.floor_number,
             (SELECT u.full_name FROM rental_contracts c JOIN users u ON c.tenant_id = u.id WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as tenant_name,
             (SELECT u.phone FROM rental_contracts c JOIN users u ON c.tenant_id = u.id WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as tenant_phone,
             (SELECT c.id FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as active_contract_id,
             (SELECT c.contract_number FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as contract_number,
             (SELECT c.end_date FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as contract_end_date,
             (SELECT COUNT(*) FROM invoices i WHERE i.room_id = r.id AND (i.status = 'OVERDUE' OR (i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.due_date < '${todayStr}'))) as overdue_count,
             (SELECT COUNT(*) FROM service_requests sr WHERE sr.room_id = r.id AND sr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') AND sr.urgency IN ('HIGH', 'EMERGENCY')) as critical_issues_count
      FROM rooms r
      JOIN floors f ON r.floor_id = f.id
      WHERE r.building_id = ?
      ORDER BY f.floor_number ASC, r.room_number ASC
    `).all(buildingId) as any[];

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
    const financialStats = db.prepare(`
      SELECT 
        SUM(total) as total_billed,
        SUM(paid_amount) as total_collected,
        SUM(outstanding_amount) as total_outstanding
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      WHERE r.building_id = ?
    `).get(buildingId) as any;

    const totalRooms = mappedRooms.length;
    const occupiedRooms = mappedRooms.filter(r => r.status === 'OCCUPIED').length;
    const availableRooms = mappedRooms.filter(r => r.status === 'AVAILABLE').length;
    const maintenanceRooms = mappedRooms.filter(r => r.status === 'MAINTENANCE').length;
    const reservedRooms = mappedRooms.filter(r => r.status === 'RESERVED').length;
    const criticalRooms = mappedRooms.filter(r => r.healthStatus === 'CRITICAL').length;

    // Open work orders
    const openWorkOrders = db.prepare(`
      SELECT COUNT(*) as count 
      FROM service_requests sr
      JOIN rooms r ON sr.room_id = r.id
      WHERE r.building_id = ? AND sr.status IN ('PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS')
    `).get(buildingId) as any;

    // Recent activity feed for this building
    const recentActivity = db.prepare(`
      SELECT al.*, u.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 10
    `).all() as any[];

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
        openWorkOrdersCount: openWorkOrders?.count || 0
      },
      floors: floorsWithRooms,
      recentActivity
    };
  }

  /**
   * 4. ROOM 360 OPERATIONAL VIEW
   */
  static getRoom360(roomId: string) {
    const db = getDatabase();

    const room = db.prepare(`
      SELECT r.*, f.floor_number, f.name as floor_name, b.name as building_name, b.address as building_address, b.city as building_city
      FROM rooms r
      JOIN floors f ON r.floor_id = f.id
      JOIN buildings b ON r.building_id = b.id
      WHERE r.id = ?
    `).get(roomId) as any;
    if (!room) throw new Error('ROOM_NOT_FOUND');

    // Parse JSON
    try {
      room.amenities = room.amenities ? JSON.parse(room.amenities) : [];
      room.images = room.images ? JSON.parse(room.images) : [];
    } catch {
      room.amenities = [];
      room.images = [];
    }

    // Active Contract
    const activeContract = db.prepare(`
      SELECT c.*, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, u.avatar_url as tenant_avatar
      FROM rental_contracts c
      JOIN users u ON c.tenant_id = u.id
      WHERE c.room_id = ? AND c.status IN ('ACTIVE', 'EXPIRING', 'PENDING')
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(roomId) as any;

    // Deposit for active contract
    let deposit = null;
    if (activeContract) {
      deposit = db.prepare('SELECT * FROM deposits WHERE contract_id = ?').get(activeContract.id) as any;
    }

    // Equipment
    const equipment = db.prepare(`
      SELECT * FROM equipment WHERE room_id = ? ORDER BY name ASC
    `).all(roomId) as any[];

    // Meters & Latest Readings
    const meters = db.prepare(`
      SELECT m.*,
             (SELECT consumption FROM meter_readings mr WHERE mr.meter_id = m.id ORDER BY mr.created_at DESC LIMIT 1) as last_consumption,
             (SELECT reading_date FROM meter_readings mr WHERE mr.meter_id = m.id ORDER BY mr.created_at DESC LIMIT 1) as last_reading_date
      FROM meters m
      WHERE m.room_id = ?
    `).all(roomId) as any[];

    // Invoices
    const invoices = db.prepare(`
      SELECT i.*, 
             (SELECT COUNT(*) FROM invoice_items itm WHERE itm.invoice_id = i.id) as item_count
      FROM invoices i
      WHERE i.room_id = ?
      ORDER BY i.issue_date DESC
      LIMIT 12
    `).all(roomId) as any[];

    // Service Requests
    const serviceRequests = db.prepare(`
      SELECT sr.*, s.name as service_name, s.category as service_category,
             sa.staff_id, u.full_name as technician_name
      FROM service_requests sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id
      LEFT JOIN users u ON sa.staff_id = u.id
      WHERE sr.room_id = ?
      ORDER BY sr.created_at DESC
    `).all(roomId) as any[];

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
        email: activeContract.tenant_email,
        phone: activeContract.tenant_phone,
        avatarUrl: activeContract.tenant_avatar,
        contractId: activeContract.id,
        contractNumber: activeContract.contract_number,
        startDate: activeContract.start_date,
        endDate: activeContract.end_date,
        rentAmount: activeContract.rent_amount
      } : null,
      activeContract,
      deposit,
      meters,
      equipment,
      invoices,
      serviceRequests,
      timeline
    };
  }

  /**
   * 5. UNIVERSAL SEARCH (Global Search / Command Palette)
   */
  static globalSearch(query: string, auth: TokenPayload) {
    if (!query || query.trim().length === 0) {
      return { rooms: [], tenants: [], buildings: [], contracts: [], invoices: [], serviceRequests: [], equipment: [] };
    }

    const db = getDatabase();
    const q = `%${query.trim()}%`;
    const companyIds = this.getCompanyIdsForUser(auth);
    const compPlaceholders = companyIds.map(() => '?').join(',');

    // Rooms
    const rooms = db.prepare(`
      SELECT r.id, r.room_number, r.status, r.base_rent, b.name as building_name, b.id as building_id
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      WHERE (r.room_number LIKE ? OR r.description LIKE ?)
      ${companyIds.length > 0 ? `AND b.company_id IN (${compPlaceholders})` : ''}
      LIMIT 5
    `).all(q, q, ...(companyIds.length > 0 ? companyIds : [])) as any[];

    // Tenants
    const tenants = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url
      FROM users u
      WHERE u.role = 'TENANT'
      AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
      LIMIT 5
    `).all(q, q, q) as any[];

    // Buildings
    const buildings = db.prepare(`
      SELECT b.id, b.name, b.address, b.city, b.status
      FROM buildings b
      WHERE (b.name LIKE ? OR b.address LIKE ?)
      ${companyIds.length > 0 ? `AND b.company_id IN (${compPlaceholders})` : ''}
      LIMIT 5
    `).all(q, q, ...(companyIds.length > 0 ? companyIds : [])) as any[];

    // Contracts
    const contracts = db.prepare(`
      SELECT c.id, c.contract_number, c.rent_amount, c.status, r.room_number, u.full_name as tenant_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.contract_number LIKE ?
      ${companyIds.length > 0 ? `AND c.company_id IN (${compPlaceholders})` : ''}
      LIMIT 5
    `).all(q, ...(companyIds.length > 0 ? companyIds : [])) as any[];

    // Invoices
    const invoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.total, i.status, i.billing_month, r.room_number
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      WHERE i.invoice_number LIKE ?
      ${companyIds.length > 0 ? `AND i.company_id IN (${compPlaceholders})` : ''}
      LIMIT 5
    `).all(q, ...(companyIds.length > 0 ? companyIds : [])) as any[];

    // Service Requests
    const serviceRequests = db.prepare(`
      SELECT sr.id, sr.title, sr.status, sr.urgency, r.room_number
      FROM service_requests sr
      LEFT JOIN rooms r ON sr.room_id = r.id
      WHERE (sr.title LIKE ? OR sr.description LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];

    // Equipment
    const equipment = db.prepare(`
      SELECT eq.id, eq.name, eq.serial_number, eq.condition, r.room_number
      FROM equipment eq
      JOIN rooms r ON eq.room_id = r.id
      WHERE (eq.name LIKE ? OR eq.serial_number LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];

    return {
      rooms,
      tenants,
      buildings,
      contracts,
      invoices,
      serviceRequests,
      equipment
    };
  }

  /**
   * 6. AI INSIGHT LAYER
   */
  static getAiInsights(auth: TokenPayload) {
    const db = getDatabase();
    const companyIds = this.getCompanyIdsForUser(auth);
    if (companyIds.length === 0) return { insights: [] };

    const compPlaceholders = companyIds.map(() => '?').join(',');
    const insights: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Insight 1: Overdue Receivable Risk
    const overdueInvoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.total, i.outstanding_amount, i.due_date, r.room_number, u.full_name as tenant_name
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN users u ON i.tenant_id = u.id
      WHERE i.company_id IN (${compPlaceholders})
      AND (i.status = 'OVERDUE' OR (i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.due_date < '${todayStr}'))
      ORDER BY i.due_date ASC
      LIMIT 3
    `).all(...companyIds) as any[];

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
    const repeatedMaintenance = db.prepare(`
      SELECT r.room_number, r.id as room_id, COUNT(*) as req_count
      FROM service_requests sr
      JOIN rooms r ON sr.room_id = r.id
      GROUP BY r.id
      HAVING req_count >= 2
      LIMIT 2
    `).all() as any[];

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
    const expiringSoon = db.prepare(`
      SELECT c.id, c.contract_number, c.end_date, r.room_number, u.full_name as tenant_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.company_id IN (${compPlaceholders})
      AND c.status IN ('ACTIVE', 'EXPIRING')
      AND c.end_date BETWEEN '${todayStr}' AND date('${todayStr}', '+30 days')
    `).all(...companyIds) as any[];

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
    const db = getDatabase();

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

    // Match recommended service & provider
    const recommendedService = db.prepare(`
      SELECT s.*, c.name as provider_company_name, c.phone as provider_phone
      FROM services s
      JOIN companies c ON s.company_id = c.id
      WHERE s.category = ? AND s.status = 'ACTIVE'
      ORDER BY s.base_price ASC
      LIMIT 1
    `).get(category) as any;

    return {
      category,
      urgency,
      possibleIssues,
      suggestedChecks,
      recommendedService: recommendedService || null
    };
  }
}
