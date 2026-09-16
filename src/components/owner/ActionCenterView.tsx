import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { ActionItem } from '../../types/index.js';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  Eye,
  RefreshCw,
  Receipt,
  Wrench,
  FileText,
  Shield,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ActionCenterViewProps {
  onSelectRoom: (roomId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ActionCenterView: React.FC<ActionCenterViewProps> = ({
  onSelectRoom,
  onNavigateTab
}) => {
  const { t } = useLanguage();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const res = await api.getActionCenter();
      setActions(res.actions || []);
    } catch (err) {
      console.error('Failed to load actions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const handleExecute = async (action: ActionItem, actionType?: string) => {
    const type = actionType || action.quickAction?.type;
    if (!type) return;

    setActionLoadingId(action.id);
    try {
      const res = await api.executeQuickAction(action.actionKey, type, {
        entityId: action.entityId,
        invoiceId: action.entityType === 'INVOICE' ? action.entityId : undefined,
        contractId: action.entityType === 'CONTRACT' ? action.entityId : undefined,
        serviceRequestId: action.entityType === 'SERVICE_REQUEST' ? action.entityId : undefined,
        roomId: action.roomId
      });
      setToastMsg(res.message || 'Thao tác thành công!');
      setTimeout(() => setToastMsg(null), 3000);
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Lỗi thực thi');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSnooze = async (action: ActionItem) => {
    setActionLoadingId(action.id);
    try {
      await api.executeQuickAction(action.actionKey, 'snooze', { days: 1 });
      setToastMsg(`Đã tạm ẩn "${action.title}" trong 24 giờ.`);
      setTimeout(() => setToastMsg(null), 3000);
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Lỗi tạm ẩn');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismiss = async (action: ActionItem) => {
    setActionLoadingId(action.id);
    try {
      await api.executeQuickAction(action.actionKey, 'dismiss');
      setToastMsg(`Đã bỏ qua tác vụ này.`);
      setTimeout(() => setToastMsg(null), 3000);
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Lỗi bỏ qua');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = actions.filter((a) => {
    const matchPriority = selectedPriority === 'ALL' || a.priority === selectedPriority;
    const matchCategory = selectedCategory === 'ALL' || a.category === selectedCategory;
    return matchPriority && matchCategory;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl flex items-center justify-between shadow-lg text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              Trung tâm hành động (Action Center)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {filtered.length} VIỆC CẦN XỬ LÝ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp các quyết định và hành động cần thiết từ tất cả tòa nhà, hóa đơn và hợp đồng.
          </p>
        </div>

        <button
          onClick={fetchActions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Priority Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold mr-1">Mức ưu tiên:</span>
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'CRITICAL', label: '🚨 Khẩn cấp' },
            { id: 'HIGH', label: '⚠️ Cao' },
            { id: 'MEDIUM', label: '🔵 Trung bình' },
            { id: 'LOW', label: '🟢 Thấp' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPriority(p.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                selectedPriority === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold mr-1">Danh mục:</span>
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'INVOICE', label: 'Hóa đơn' },
            { id: 'MAINTENANCE', label: 'Bảo trì' },
            { id: 'CONTRACT', label: 'Hợp đồng' },
            { id: 'APPLICATION', label: 'Hồ sơ thuê' }
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                selectedCategory === c.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Items List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Đang tổng hợp các tác vụ cần xử lý...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((act) => (
            <div
              key={act.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    act.priority === 'CRITICAL'
                      ? 'bg-red-100 text-red-700'
                      : act.priority === 'HIGH'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {act.category === 'INVOICE' && <Receipt className="w-5 h-5" />}
                  {act.category === 'MAINTENANCE' && <Wrench className="w-5 h-5" />}
                  {act.category === 'CONTRACT' && <Shield className="w-5 h-5" />}
                  {act.category === 'APPLICATION' && <FileText className="w-5 h-5" />}
                  {act.category === 'EQUIPMENT' && <Layers className="w-5 h-5" />}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor || 'bg-slate-100 text-slate-700'}`}
                    >
                      {act.priority}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{act.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500">{act.subtitle}</p>
                  {act.amount && (
                    <span className="text-xs font-black text-blue-700 block">
                      Số tiền liên quan: {act.amount.toLocaleString()} VND
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                {act.roomId && (
                  <button
                    onClick={() => onSelectRoom(act.roomId!)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                    title="Mở Room 360"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Room 360</span>
                  </button>
                )}

                <button
                  onClick={() => handleSnooze(act)}
                  disabled={actionLoadingId === act.id}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors"
                >
                  Tạm ẩn 24h
                </button>

                {act.quickAction && (
                  <button
                    onClick={() => {
                      if (act.category === 'APPLICATION') {
                        onNavigateTab('applications');
                      } else {
                        handleExecute(act);
                      }
                    }}
                    disabled={actionLoadingId === act.id}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 ${
                      act.quickAction.variant === 'danger'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {actionLoadingId === act.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>{act.quickAction.label}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">Không có công việc nào cần xử lý</h4>
          <p className="text-xs text-slate-500 mt-1">
            Tất cả nợ đọng, sự cố và hợp đồng trong bộ lọc hiện tại đều ở trạng thái hoàn thành.
          </p>
        </div>
      )}
    </div>
  );
};
