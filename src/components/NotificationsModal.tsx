import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Notification } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity?: (type: string, id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onSelectEntity }) => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (notif: Notification) => {
    if (!notif.read_at) {
      await api.markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
    }
    if (notif.entity_type && notif.entity_id && onSelectEntity) {
      onSelectEntity(notif.entity_type, notif.entity_id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{t('nav.notifications')}</h3>
              <p className="text-xs text-slate-500">{t('app.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t('btn.approve', 'Đánh dấu đã đọc')}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">{t('explorer.loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {t('tenant.no_requests')}
            </div>
          ) : (
            notifications.map(n => {
              const isUnread = !n.read_at;
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                    isUnread
                      ? 'bg-blue-50/60 border-blue-200 hover:bg-blue-50'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                      {n.title}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">{n.message}</p>
                  {n.entity_type && (
                    <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                      <span>{t('btn.view_details')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
