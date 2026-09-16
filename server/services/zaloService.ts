import crypto from 'node:crypto';
import { NotificationRepository, NotificationRow } from '../db/repositories/notificationRepository.js';
import { UserRepository } from '../db/repositories/userRepository.js';

export interface ZnsPayload {
  recipientPhone: string;
  templateId: string;
  templateData: Record<string, any>;
  trackingId?: string;
}

export class ZaloService {
  private static isConfigured(): boolean {
    return !!(process.env.ZALO_ACCESS_TOKEN && process.env.ZALO_APP_ID);
  }

  /**
   * Send Zalo Notification Service (ZNS) message
   */
  static async sendZns(
    userId: string,
    type: 'INVOICE_ISSUED' | 'PAYMENT_REMINDER' | 'CONTRACT_EXPIRING' | 'PAYMENT_RECEIVED' | 'CUSTOM',
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
    extraData: Record<string, any> = {}
  ): Promise<NotificationRow> {
    const user = UserRepository.findById(userId);
    const phone = user?.phone || extraData.phone || null;
    const notifId = 'notif_zns_' + crypto.randomUUID().substring(0, 8);
    const trackingId = 'zns_tr_' + Date.now();

    let deliveryStatus: 'DELIVERED' | 'SENT' | 'FAILED' = 'DELIVERED';

    if (this.isConfigured() && phone) {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '84');
        const res = await fetch('https://business.openapi.zalo.me/message/template', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: process.env.ZALO_ACCESS_TOKEN!
          },
          body: JSON.stringify({
            phone: cleanPhone,
            template_id: extraData.templateId || 'default_template',
            template_data: {
              customer_name: user?.full_name || 'Quý khách',
              title,
              message,
              ...extraData
            },
            tracking_id: trackingId
          })
        });
        const data = (await res.json()) as any;
        if (data?.error !== 0) {
          console.warn('Zalo ZNS API error:', data);
          deliveryStatus = 'FAILED';
        }
      } catch (err) {
        console.error('Failed to send real Zalo ZNS:', err);
        deliveryStatus = 'FAILED';
      }
    }

    // Persist notification record with channel ZALO_ZNS
    const row = NotificationRepository.create({
      id: notifId,
      user_id: userId,
      type,
      title: `[Zalo ZNS] ${title}`,
      message,
      entity_type: entityType || null,
      entity_id: entityId || null,
      channel: 'ZALO_ZNS',
      delivery_status: deliveryStatus,
      recipient_phone: phone,
      metadata: JSON.stringify({
        trackingId,
        extraData,
        sentAt: new Date().toISOString(),
        mode: this.isConfigured() ? 'LIVE_ZALO_API' : 'SANDBOX_SIMULATED'
      })
    });

    return row;
  }
}
