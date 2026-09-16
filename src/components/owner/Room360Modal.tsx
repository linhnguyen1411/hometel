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
  Layers
} from 'lucide-react';

interface Room360ModalProps {
  roomId: string | null;
  onClose: () => void;
  onOpenMeterModal?: (room: any) => void;
  onRefresh?: () => void;
}

export const Room360Modal: React.FC<Room360ModalProps> = ({
  roomId,
  onClose,
  onOpenMeterModal,
  onRefresh
}) => {
  const { t } = useLanguage();
  const [data, setData] = useState<Room360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'contract' | 'invoices' | 'meters' | 'equipment' | 'timeline'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setData(null);
      return;
    }

    setLoading(true);
    api.getRoom360(roomId)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load Room 360 data:', err))
      .finally(() => setLoading(false));
  }, [roomId]);

  if (!roomId) return null;

  const handleRemindTenant = async (invoiceId: string) => {
    setActionLoading(true);
    try {
      await api.executeQuickAction(`inv_${invoiceId}`, 'remind_tenant', { invoiceId });
      setActionSuccessMsg('Đã gửi thông báo nhắc nhở thanh toán đến cư dân!');
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Thao tác không thành công');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (nextStatus: any) => {
    if (!data) return;
    setActionLoading(true);
    try {
      await api.updateRoom(data.room.id, { status: nextStatus });
      setData(prev => prev ? { ...prev, room: { ...prev.room, status: nextStatus } } : null);
      setActionSuccessMsg(`Đã chuyển trạng thái phòng sang: ${nextStatus}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              {data?.room?.room_number || '...'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Phòng {data?.room?.room_number}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                  {data?.room?.status || 'ĐANG TẢI'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600">
                  ROOM 360
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {data?.room?.building_name || 'Tòa nhà'} • Tầng {data?.room?.floor_number} • Diện tích: {data?.room?.area} m² • Loại: {data?.room?.room_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenMeterModal && data && (
              <button
                onClick={() => onOpenMeterModal(data.room)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <Receipt className="w-4 h-4" />
                <span>Ghi chỉ số & Lập hóa đơn</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {actionSuccessMsg && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-100 flex gap-4 overflow-x-auto bg-white text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Cư dân & Tổng quan</span>
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'contract'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Hợp đồng & Cọc</span>
            {data?.activeContract && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Hóa đơn tiền phòng</span>
            {data?.invoices && data.invoices.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600">
                {data.invoices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('meters')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'meters'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Đồng hồ Điện/Nước</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'equipment'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tv className="w-4 h-4 text-purple-500" />
            <span>Thiết bị ({data?.equipment?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Nhật ký phòng</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang tải hồ sơ Room 360...</span>
            </div>
          )}

          {!loading && data && (
            <>
              {/* TAB 1: Overview & Tenant */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Tenant Card */}
                  {data.tenant ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/10">
                          {data.tenant.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Cư dân hiện tại</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              ĐANG CƯ TRÚ
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mt-0.5">{data.tenant.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                            <a href={`tel:${data.tenant.phone}`} className="flex items-center gap-1 hover:text-blue-600 font-medium">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {data.tenant.phone || 'Chưa cập nhật SĐT'}
                            </a>
                            <a href={`mailto:${data.tenant.email}`} className="flex items-center gap-1 hover:text-blue-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {data.tenant.email}
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
                        <span className="text-xs text-slate-400 font-medium">Giá thuê hàng tháng</span>
                        <span className="text-base font-black text-blue-700">
                          {data.tenant.rentAmount.toLocaleString()} <span className="text-xs font-normal text-slate-500">VND</span>
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">Hợp đồng #{data.tenant.contractNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tình trạng phòng</span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">Phòng hiện đang trống (Vacant)</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Căn hộ này chưa có hợp đồng thuê hoạt động. Bạn có thể duyệt hồ sơ đăng ký hoặc bàn giao phòng.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(data.room.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE')}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
                        >
                          {data.room.status === 'AVAILABLE' ? 'Chuyển bảo trì' : 'Chuyển sẵn sàng cho thuê'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Room Quick Facts Bento */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 text-[11px] font-semibold block">Giá niêm yết</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        {data.room.base_rent.toLocaleString()} VND
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 text-[11px] font-semibold block">Diện tích</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        {data.room.area} m² ({data.room.room_type})
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 text-[11px] font-semibold block">Nội thất</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        {data.room.furnishing}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 text-[11px] font-semibold block">Sức chứa tối đa</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                        {data.room.capacity} người
                      </span>
                    </div>
                  </div>

                  {/* Amenities */}
                  {data.room.amenities && data.room.amenities.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 block mb-2">Tiện ích trong phòng</span>
                      <div className="flex flex-wrap gap-2">
                        {data.room.amenities.map((am: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium">
                            {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Contract & Deposit */}
              {activeTab === 'contract' && (
                <div className="space-y-6">
                  {data.activeContract ? (
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hợp đồng thuê căn hộ</span>
                            <h4 className="text-base font-bold text-slate-900 font-mono mt-0.5">
                              #{data.activeContract.contract_number}
                            </h4>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {data.activeContract.status}
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block font-semibold">Thời hạn thuê</span>
                            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                              {data.activeContract.start_date} → {data.activeContract.end_date}
                            </span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block font-semibold">Tiền thuê hàng tháng</span>
                            <span className="font-bold text-blue-600 text-sm mt-0.5 block">
                              {data.activeContract.rent_amount.toLocaleString()} VND
                            </span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block font-semibold">Ngày chốt hóa đơn</span>
                            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                              Ngày {data.activeContract.payment_day_of_month} hàng tháng
                            </span>
                          </div>
                        </div>

                        {/* Deposit Status */}
                        {data.deposit && (
                          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Shield className="w-5 h-5 text-emerald-600" />
                              <div>
                                <span className="text-xs font-bold text-emerald-900">
                                  Tiền ký quỹ (Đặt cọc an ninh): {data.deposit.amount.toLocaleString()} VND
                                </span>
                                <span className="text-[11px] text-emerald-700 block">
                                  Trạng thái: {data.deposit.status} • Ngày nhận: {data.deposit.received_date || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded">
                              ĐÃ GIỮ CỌC
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">Chưa có hợp đồng thuê hoạt động</p>
                      <p className="text-xs text-slate-400 mt-1">Khi khách thuê được duyệt hồ sơ, hợp đồng sẽ xuất hiện tại đây.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Invoices */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Lịch sử hóa đơn phòng ({data.invoices.length})
                    </span>
                    {onOpenMeterModal && (
                      <button
                        onClick={() => onOpenMeterModal(data.room)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tạo hóa đơn mới</span>
                      </button>
                    )}
                  </div>

                  {data.invoices.length > 0 ? (
                    <div className="space-y-2">
                      {data.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">{inv.invoice_number}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  inv.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.status === 'OVERDUE'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Kỳ phí tháng {inv.billing_month} • Ngày phát hành: {inv.issue_date} • Hạn nộp: {inv.due_date}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-900 block">
                                {inv.total.toLocaleString()} VND
                              </span>
                              {inv.outstanding_amount && inv.outstanding_amount > 0 ? (
                                <span className="text-[11px] text-red-600 font-semibold">
                                  Còn nợ: {inv.outstanding_amount.toLocaleString()} VND
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-semibold">Đã thanh toán đủ</span>
                              )}
                            </div>

                            {inv.status !== 'PAID' && (
                              <button
                                onClick={() => handleRemindTenant(inv.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                              >
                                Nhắc nợ
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">Chưa có hóa đơn nào cho phòng này</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Meters */}
              {activeTab === 'meters' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Đồng hồ đo điện và nước
                    </span>
                    {onOpenMeterModal && (
                      <button
                        onClick={() => onOpenMeterModal(data.room)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ghi chỉ số mới</span>
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {data.meters.map((m) => (
                      <div key={m.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            {m.type === 'ELECTRICITY' ? (
                              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                                <Zap className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                <Droplets className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <h5 className="font-bold text-xs text-slate-900">
                                Đồng hồ {m.type === 'ELECTRICITY' ? 'Điện tử' : 'Nước'}
                              </h5>
                              <span className="text-[11px] font-mono text-slate-400">S/N: {m.meter_serial}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {m.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block font-semibold">Chỉ số hiện tại</span>
                            <span className="text-base font-mono font-black text-slate-900 mt-0.5 block">
                              {m.current_reading} <span className="text-[11px] font-normal text-slate-500">{m.unit}</span>
                            </span>
                          </div>
                          <div className="p-2.5 bg-slate-50 rounded-xl">
                            <span className="text-slate-400 block font-semibold">Tiêu thụ kỳ trước</span>
                            <span className="text-base font-mono font-bold text-blue-600 mt-0.5 block">
                              {m.last_consumption || 0} <span className="text-[11px] font-normal text-slate-500">{m.unit}</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Lần ghi gần nhất: {m.last_reading_date || 'Chưa ghi chỉ số'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: Equipment */}
              {activeTab === 'equipment' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Danh mục thiết bị tài sản gắn liền phòng ({data.equipment.length})
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {data.equipment.map((eq) => (
                      <div key={eq.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                            <Tv className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-slate-900">{eq.name}</h5>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              S/N: {eq.serial_number || 'N/A'} • Loại: {eq.type}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-1 rounded text-[11px] font-bold ${
                            eq.condition === 'EXCELLENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : eq.condition === 'GOOD'
                              ? 'bg-blue-100 text-blue-800'
                              : eq.condition === 'FAIR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {eq.condition}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: Room Timeline */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Nhật ký sự kiện phòng theo thời gian
                  </span>

                  <div className="relative pl-6 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-slate-200">
                    {data.timeline.map((event, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${event.badgeColor}`} />
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{event.title}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{event.date}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Quick Action Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Homtel Room 360 Engine • Dữ liệu đồng bộ thời gian thực</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
