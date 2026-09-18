import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { TodayCockpitData, ActionItem, AiInsight } from '../../types/index';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Receipt,
  Wrench,
  Shield,
  UserCheck,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Bell,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface TodayCockpitProps {
  onSelectRoom: (roomId: string) => void;
  onOpenMeterModal: (room: any) => void;
  onNavigateTab: (tab: string) => void;
}

export const TodayCockpit: React.FC<TodayCockpitProps> = ({
  onSelectRoom,
  onOpenMeterModal,
  onNavigateTab
}) => {
  const { t } = useLanguage();
  const [data, setData] = useState<TodayCockpitData | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const fetchCockpit = async () => {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        api.getTodayCockpit(),
        api.getAiInsights().catch(() => ({ insights: [] }))
      ]);
      setData(cRes);
      setInsights(iRes?.insights || []);
    } catch (err) {
      console.error('Error loading Today Cockpit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCockpit();
  }, []);

  const handleExecuteQuickAction = async (action: ActionItem, customType?: string) => {
    const type = customType || action.quickAction?.type;
    if (!type) return;

    setActionLoading(action.id);
    try {
      const res = await api.executeQuickAction(action.actionKey, type, {
        entityId: action.entityId,
        invoiceId: action.entityType === 'INVOICE' ? action.entityId : undefined,
        contractId: action.entityType === 'CONTRACT' ? action.entityId : undefined,
        serviceRequestId: action.entityType === 'SERVICE_REQUEST' ? action.entityId : undefined,
        roomId: action.roomId
      });
      setFeedbackMsg({ text: res.message || 'Thao tác thành công!', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3500);
      fetchCockpit();
    } catch (err: any) {
      alert(err.message || 'Lỗi thực thi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async (action: ActionItem) => {
    setActionLoading(action.id);
    try {
      await api.executeQuickAction(action.actionKey, 'snooze', { days: 1 });
      setFeedbackMsg({ text: `Đã tạm ẩn "${action.title}" trong 24 giờ.`, type: 'info' });
      setTimeout(() => setFeedbackMsg(null), 3000);
      fetchCockpit();
    } catch (err: any) {
      alert(err.message || 'Lỗi tạm ẩn');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-md transition-all ${
          feedbackMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-white/80 hover:text-white text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Hero Operational Cockpit Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-bold text-slate-900">
                Bảng điều khiển vận hành hôm nay (Today Cockpit)
              </h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-md uppercase">
                Building OS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống tự động rà soát sự cố, hạn hợp đồng và nợ đọng trên toàn bộ danh mục tòa nhà.
            </p>
          </div>

          <button
            onClick={fetchCockpit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>

        {/* Bento Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-red-50/60 border border-red-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">
                Cần xử lý khẩn cấp
              </span>
              <span className="text-2xl font-black text-red-700 mt-1 block">
                {data?.healthySummary.criticalCount || 0}
              </span>
              <span className="text-[11px] text-red-500">Quá hạn hoặc sự cố gấp</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Cần chú ý theo dõi
              </span>
              <span className="text-2xl font-black text-amber-800 mt-1 block">
                {data?.healthySummary.attentionCount || 0}
              </span>
              <span className="text-[11px] text-amber-600">Hồ sơ chờ & hóa đơn sắp tới</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                Tỷ lệ lấp đầy phòng
              </span>
              <span className="text-2xl font-black text-blue-800 mt-1 block">
                {data?.healthySummary.occupancyRate || 0}%
              </span>
              <span className="text-[11px] text-blue-600">
                {data?.healthySummary.occupiedUnits || 0}/{data?.healthySummary.totalUnits || 0} căn hộ
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Tỷ lệ thu phí tháng
              </span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">
                {data?.healthySummary.collectionRate || 0}%
              </span>
              <span className="text-[11px] text-emerald-600">
                {(data?.healthySummary.totalCollected || 0).toLocaleString()} VND
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Homtel AI Insights Banner */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-100">HOMTEL AI INSIGHTS</h3>
                <p className="text-[11px] text-blue-300">Phân tích vận hành tự động dựa trên dữ liệu thực tế</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white/10 rounded-full text-[10px] font-mono tracking-wider">
              {insights.length} KHUYẾN NGHỊ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/10 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      ins.impactLevel === 'CRITICAL'
                        ? 'bg-red-500/30 text-red-200 border border-red-400/30'
                        : ins.impactLevel === 'WARNING'
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/30'
                        : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30'
                    }`}
                  >
                    {ins.impactLevel}
                  </span>
                  <h4 className="text-xs font-bold text-white mt-2 line-clamp-2">{ins.title}</h4>
                  <p className="text-[11px] text-blue-200/80 mt-1 line-clamp-3 leading-relaxed">{ins.reason}</p>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <span className="text-[10px] text-blue-300 font-semibold block mb-1.5">Đề xuất xử lý:</span>
                  <p className="text-[11px] text-white font-medium mb-2">{ins.suggestedAction}</p>
                  {ins.actionType === 'view_room_360' && ins.actionPayload?.roomId ? (
                    <button
                      onClick={() => onSelectRoom(ins.actionPayload.roomId)}
                      className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                    >
                      <span>Kiểm tra phòng 360</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 OPERATIONAL TIERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TIER 1: CRITICAL (Cần xử lý ngay) */}
        <div className="bg-white rounded-3xl p-6 border border-red-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Cần xử lý khẩn cấp ({data?.critical?.length || 0})
              </h3>
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
              Ưu tiên cao nhất
            </span>
          </div>

          <div className="space-y-3">
            {data?.critical && data.critical.length > 0 ? (
              data.critical.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-red-300 shadow-2xs transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                          {act.badgeText || act.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{act.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{act.subtitle}</p>
                    </div>

                    {act.roomId && (
                      <button
                        onClick={() => onSelectRoom(act.roomId!)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                        title="Mở Room 360"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* 1-Click Action Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => handleSnooze(act)}
                      disabled={actionLoading === act.id}
                      className="text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                    >
                      Tạm ẩn 24h
                    </button>

                    <div className="flex items-center gap-2">
                      {act.quickAction && (
                        <button
                          onClick={() => handleExecuteQuickAction(act)}
                          disabled={actionLoading === act.id}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-colors shadow-2xs flex items-center gap-1 ${
                            act.quickAction.variant === 'danger'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {actionLoading === act.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>{act.quickAction.label}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Tuyệt vời! Không có sự cố khẩn cấp nào</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tất cả nợ đọng và sự cố đều đã được giải quyết ổn thỏa.</p>
              </div>
            )}
          </div>
        </div>

        {/* TIER 2: ATTENTION (Cần chú ý) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Cần chú ý ({data?.attention?.length || 0})
              </h3>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Hồ sơ & Lịch phí
            </span>
          </div>

          <div className="space-y-3">
            {data?.attention && data.attention.length > 0 ? (
              data.attention.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 shadow-2xs transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                          {act.badgeText || act.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{act.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{act.subtitle}</p>
                    </div>

                    {act.roomId && (
                      <button
                        onClick={() => onSelectRoom(act.roomId!)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                        title="Mở Room 360"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => handleSnooze(act)}
                      disabled={actionLoading === act.id}
                      className="text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
                    >
                      Bỏ qua
                    </button>

                    {act.quickAction && (
                      <button
                        onClick={() => {
                          if (act.category === 'APPLICATION') {
                            onNavigateTab('applications');
                          } else {
                            handleExecuteQuickAction(act);
                          }
                        }}
                        disabled={actionLoading === act.id}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition-colors text-xs"
                      >
                        {act.quickAction.label}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Mọi hồ sơ và hóa đơn đều đang ổn thỏa</p>
              </div>
            )}
          </div>
        </div>

        {/* TIER 3: UPCOMING (Sắp tới trong 30 ngày) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                3. Sắp diễn ra ({data?.upcoming?.length || 0})
              </h3>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              Kế hoạch tái ký
            </span>
          </div>

          <div className="space-y-3">
            {data?.upcoming && data.upcoming.length > 0 ? (
              data.upcoming.map((act) => (
                <div key={act.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{act.title}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{act.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {act.badgeText}
                    </span>
                    {act.roomId && (
                      <button
                        onClick={() => onSelectRoom(act.roomId!)}
                        className="p-1.5 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Không có hợp đồng nào sắp hết hạn trong 30 ngày tới</p>
              </div>
            )}
          </div>
        </div>

        {/* TIER 4: HEALTHY STATUS SUMMARY */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                4. Vận hành ổn định (Healthy)
              </h3>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Trạng thái tốt
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900">
                    {data?.healthySummary.occupiedUnits || 0} căn hộ đã thanh toán đầy đủ
                  </h5>
                  <p className="text-slate-500 mt-0.5">Không có nợ phát sinh hoặc sự cố chưa xử lý.</p>
                </div>
              </div>
              <span className="font-bold text-emerald-700">100% ỔN ĐỊNH</span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900">Đồng hồ điện nước đã đồng bộ</h5>
                  <p className="text-slate-500 mt-0.5">Biểu giá dịch vụ tháng hiện tại đã được áp dụng.</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('invoices')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-lg text-xs"
              >
                Kiểm tra
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
