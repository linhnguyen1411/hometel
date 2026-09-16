import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { Room360Data } from '../../types/index.js';
import {
  X,
  Home,
  User,
  Phone,
  Mail,
  Shield,
  FileText,
  Receipt,
  Zap,
  Droplets,
  Tv,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Sparkles,
  Calendar,
  Layers,
  Eye,
  EyeOff,
  Copy,
  Check,
  Info,
  Camera
} from 'lucide-react';

interface RoomDetailPanelProps {
  roomId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMeterModal?: (room: any) => void;
  onOpenOcrModal?: (room: any) => void;
  onRefresh?: () => void;
}

export const RoomDetailPanel: React.FC<RoomDetailPanelProps> = ({
  roomId,
  isOpen,
  onClose,
  onOpenMeterModal,
  onOpenOcrModal,
  onRefresh
}) => {
  const { t } = useLanguage();
  const [data, setData] = useState<Room360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'meters' | 'invoices' | 'equipment' | 'timeline'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !isOpen) {
      setData(null);
      return;
    }

    setLoading(true);
    api.getRoom360(roomId)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load Room 360 data in panel:', err))
      .finally(() => setLoading(false));
  }, [roomId, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !roomId) return null;

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleStatus = async (nextStatus: string) => {
    if (!data) return;
    setActionLoading(true);
    try {
      await api.updateRoom(data.room.id, { status: nextStatus });
      setData(prev => prev ? { ...prev, room: { ...prev.room, status: nextStatus as any } } : null);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật trạng thái');
    } finally {
      setActionLoading(false);
    }
  };

  const tenant = data?.tenant;
  const isTenantMasked = data?.isPrivileged === false || (tenant as any)?.isMasked === true;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              {data?.room?.room_number || '...'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Phòng {data?.room?.room_number || '...'}
                </h3>
                {data && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    data.room.status === 'OCCUPIED' ? 'bg-emerald-100 text-emerald-800' :
                    data.room.status === 'AVAILABLE' ? 'bg-blue-100 text-blue-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {data.room.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {data?.room?.building_name} • Tầng {data?.room?.floor_name || data?.room?.floor_number}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-white gap-1 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Tổng quan & Cư dân', icon: <Home className="w-3.5 h-3.5" /> },
            { id: 'meters', label: 'Điện & Nước IoT', icon: <Zap className="w-3.5 h-3.5" /> },
            { id: 'invoices', label: 'Hóa đơn', icon: <Receipt className="w-3.5 h-3.5" /> },
            { id: 'equipment', label: 'Tài sản', icon: <Tv className="w-3.5 h-3.5" /> },
            { id: 'timeline', label: 'Dòng thời gian', icon: <Clock className="w-3.5 h-3.5" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {loading && (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang tải hồ sơ chi tiết phòng...</span>
            </div>
          )}

          {!loading && data && (
            <>
              {/* TAB 1: OVERVIEW & RESIDENT */}
              {activeTab === 'overview' && (
                <div className="space-y-6 text-xs">
                  {/* Room Specs Bento */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-slate-400 font-semibold block">Giá thuê cơ bản</span>
                      <span className="text-base font-black text-blue-600 block mt-0.5">
                        {data.room.base_rent.toLocaleString()} đ
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-slate-400 font-semibold block">Diện tích</span>
                      <span className="text-base font-black text-slate-900 block mt-0.5">
                        {data.room.area} m²
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-slate-400 font-semibold block">Loại phòng</span>
                      <span className="text-xs font-bold text-slate-900 block mt-1 truncate">
                        {data.room.room_type}
                      </span>
                    </div>
                  </div>

                  {/* Resident Profile & Data Privacy Isolation */}
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>Hồ sơ Cư dân đang thuê</span>
                      </h4>

                      {/* Privacy Badge */}
                      {isTenantMasked ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <EyeOff className="w-3 h-3 text-amber-600" />
                          <span>PII Masked (Staff / Provider)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-600" />
                          <span>Quyền xem PII đầy đủ (Owner)</span>
                        </span>
                      )}
                    </div>

                    {tenant ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={tenant.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tenant.name}`}
                            alt={tenant.name}
                            className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50"
                          />
                          <div>
                            <h5 className="font-bold text-sm text-slate-900">{tenant.name}</h5>
                            <p className="text-[11px] text-slate-400">
                              Hợp đồng: <span className="font-mono font-bold text-slate-700">{tenant.contractNumber}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono text-[11px]">
                          {/* Phone */}
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-sans flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              Số điện thoại:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{tenant.phone || 'N/A'}</span>
                              {tenant.phone && !isTenantMasked && (
                                <button
                                  type="button"
                                  onClick={() => copyText(tenant.phone!, 'phone')}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                  title="Sao chép"
                                >
                                  {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Email */}
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-sans flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              Email liên hệ:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{tenant.email || 'N/A'}</span>
                              {tenant.email && !isTenantMasked && (
                                <button
                                  type="button"
                                  onClick={() => copyText(tenant.email!, 'email')}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                  title="Sao chép"
                                >
                                  {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Period */}
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 font-sans text-[11px]">
                            <span className="text-slate-500">Thời hạn thuê:</span>
                            <span className="font-bold text-slate-800">{tenant.startDate} → {tenant.endDate}</span>
                          </div>
                        </div>

                        {/* Masking explanation note */}
                        {isTenantMasked && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-1.5 leading-normal">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              Theo chính sách an toàn thông tin Homtel RBAC, số điện thoại và email của cư dân được che một phần đối với tài khoản Nhân viên / Đơn vị dịch vụ.
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 space-y-1">
                        <User className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">Phòng hiện đang để trống</p>
                        <p className="text-[11px]">Căn hộ đã sẵn sàng để khách thuê đăng ký.</p>
                      </div>
                    )}
                  </div>

                  {/* Amenities */}
                  {data.room.amenities && data.room.amenities.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-700 block">Tiện nghi có sẵn:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.room.amenities.map((am: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium text-[11px]">
                            {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: METERS */}
              {activeTab === 'meters' && (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Công tơ thông minh đã gắn</span>
                    <div className="flex items-center gap-2">
                      {onOpenOcrModal && (
                        <button
                          type="button"
                          onClick={() => onOpenOcrModal(data.room)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>AI OCR Quét ảnh</span>
                        </button>
                      )}
                      {onOpenMeterModal && (
                        <button
                          type="button"
                          onClick={() => onOpenMeterModal(data.room)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Ghi số thủ công</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {data.meters && data.meters.length > 0 ? (
                    data.meters.map((m) => (
                      <div key={m.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                              m.type === 'ELECTRICITY' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {m.type === 'ELECTRICITY' ? <Zap className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-900">
                                {m.type === 'ELECTRICITY' ? 'Công tơ điện' : 'Đồng hồ nước'}
                              </h5>
                              <p className="font-mono text-[10px] text-slate-400">{m.serial_number}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {m.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl font-mono text-[11px]">
                          <div>
                            <span className="text-slate-400 block font-sans">Chỉ số đầu kỳ</span>
                            <span className="font-bold text-slate-800 text-sm">{m.initial_reading}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">Chỉ số hiện tại</span>
                            <span className="font-bold text-blue-700 text-sm">{m.current_reading}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400">Chưa có công tơ nào được cài đặt.</div>
                  )}
                </div>
              )}

              {/* TAB 3: INVOICES */}
              {activeTab === 'invoices' && (
                <div className="space-y-3 text-xs">
                  {data.invoices && data.invoices.length > 0 ? (
                    data.invoices.map((inv) => (
                      <div key={inv.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              inv.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Kỳ: {inv.billing_month} • Hạn: {inv.due_date}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-slate-900 block font-mono">
                            {inv.total.toLocaleString()} đ
                          </span>
                          {inv.outstanding_amount > 0 && (
                            <span className="text-[11px] text-red-600 font-bold block">
                              Còn nợ: {inv.outstanding_amount.toLocaleString()} đ
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400">Chưa có hóa đơn nào cho phòng này.</div>
                  )}
                </div>
              )}

              {/* TAB 4: EQUIPMENT */}
              {activeTab === 'equipment' && (
                <div className="space-y-3 text-xs">
                  {data.equipment && data.equipment.length > 0 ? (
                    data.equipment.map((eq) => (
                      <div key={eq.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                            <Tv className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900">{eq.name}</h5>
                            <p className="font-mono text-[10px] text-slate-400">S/N: {eq.serial_number || 'N/A'}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          eq.condition === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800' :
                          eq.condition === 'GOOD' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {eq.condition}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400">Không có thiết bị bàn giao trong phòng.</div>
                  )}
                </div>
              )}

              {/* TAB 5: TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4 text-xs">
                  {data.timeline && data.timeline.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {data.timeline.map((item, i) => (
                        <div key={i} className="relative space-y-1">
                          <span className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${item.badgeColor || 'bg-blue-500'}`} />
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-slate-900 text-xs">{item.title}</h5>
                            <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">Chưa có sự kiện nào được ghi nhận.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        {data && (
          <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {data.room.status === 'AVAILABLE' ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleToggleStatus('MAINTENANCE')}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs"
                >
                  Chuyển sang bảo trì
                </button>
              ) : data.room.status === 'MAINTENANCE' ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleToggleStatus('AVAILABLE')}
                  className="px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs"
                >
                  Mở lại phòng trống
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
