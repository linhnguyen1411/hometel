import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Sparkles,
  Zap,
  Droplets,
  Wind,
  Shield,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Send
} from 'lucide-react';

interface QuickServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  onSuccess: () => void;
}

export const QuickServiceModal: React.FC<QuickServiceModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [category, setCategory] = useState<string>('HVAC');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const categories = [
    { id: 'HVAC', label: 'Máy lạnh / Điều hòa', icon: <Wind className="w-4 h-4 text-blue-500" />, defaultTitle: 'Sự cố máy lạnh' },
    { id: 'PLUMBING', label: 'Đường ống nước / Lavabo', icon: <Droplets className="w-4 h-4 text-cyan-500" />, defaultTitle: 'Sự cố đường nước' },
    { id: 'ELECTRICAL', label: 'Hệ thống điện / Đèn', icon: <Zap className="w-4 h-4 text-amber-500" />, defaultTitle: 'Sự cố nguồn điện' },
    { id: 'SECURITY', label: 'Khóa cửa / An ninh', icon: <Shield className="w-4 h-4 text-purple-500" />, defaultTitle: 'Sự cố khóa thông minh' },
    { id: 'CLEANING', label: 'Vệ sinh / Dọn phòng', icon: <Trash2 className="w-4 h-4 text-emerald-500" />, defaultTitle: 'Dịch vụ dọn dẹp vệ sinh' }
  ];

  const quickIssueSnippets = {
    HVAC: ['Máy lạnh không lạnh và chảy nước', 'Dàn lạnh kêu to và có mùi ẩm', 'Remote không nhận tín hiệu'],
    PLUMBING: ['Lavabo bị nghẹt thoát nước chậm', 'Vòi xịt toilet bị rò rỉ nước', 'Áp lực nước vòi sen quá yếu'],
    ELECTRICAL: ['Bật bình nóng lạnh bị nhảy aptomat', 'Ổ cắm phòng khách bị mất điện', 'Đèn trần bị nhấp nháy liên tục'],
    SECURITY: ['Khóa cửa báo pin yếu', 'Không nhập được mật khẩu số', 'Kẹt then chốt cơ học'],
    CLEANING: ['Cần dọn dẹp tổng vệ sinh phòng', 'Cần giặt đệm và sofa hơi nước', 'Khử khuẩn phòng sau chuyển vào']
  };

  useEffect(() => {
    if (!description.trim()) {
      setAiResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingAi(true);
      try {
        const triage = await api.aiTriage(description, category);
        setAiResult(triage);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAi(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [description, category]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      // Find service
      const services = await api.getServices();
      const matched = services.find((s: any) => s.category === (aiResult?.category || category)) || services[0];

      await api.createServiceRequest({
        serviceId: matched?.id,
        title: title || `${categories.find(c => c.id === category)?.defaultTitle || 'Yêu cầu dịch vụ'}`,
        description,
        urgency: aiResult?.urgency || 'MEDIUM',
        roomId
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        setTitle('');
        setAiResult(null);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi yêu cầu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Báo sự cố & Đặt dịch vụ nhanh</h3>
              <p className="text-xs text-slate-500">Hệ thống AI tự động chẩn đoán và điều phối kỹ thuật viên phù hợp</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Yêu cầu đã được tiếp nhận và giao kỹ thuật viên thành công!</span>
            </div>
          )}

          {/* 1-Tap Category Pills */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Chọn nhóm sự cố:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => {
                    setCategory(cat.id);
                    setTitle(cat.defaultTitle);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    category === cat.id
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  {cat.icon}
                  <span className="text-xs truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Issue Snippets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">Gợi ý nhanh:</span>
            <div className="flex flex-wrap gap-1.5">
              {((quickIssueSnippets as any)[category] || []).map((snippet: string, i: number) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setDescription(snippet)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
                >
                  {snippet}
                </button>
              ))}
            </div>
          </div>

          {/* Description textarea */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Mô tả chi tiết tình trạng:</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vd: Máy lạnh phòng ngủ chảy nước nhỏ giọt xuống sàn gỗ từ đêm qua..."
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 outline-hidden focus:border-emerald-500 focus:bg-white leading-relaxed resize-none"
            />
          </div>

          {/* AI Diagnostic Preview */}
          {aiResult && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Homtel AI Triage Chẩn đoán
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    aiResult.urgency === 'EMERGENCY'
                      ? 'bg-red-600 text-white'
                      : aiResult.urgency === 'HIGH'
                      ? 'bg-amber-500 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  Ưu tiên: {aiResult.urgency}
                </span>
              </div>

              {aiResult.possibleIssues?.length > 0 && (
                <div className="text-xs text-slate-700 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 block">Dự đoán nguyên nhân khả dĩ:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                    {aiResult.possibleIssues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiResult.recommendedService && (
                <div className="pt-2 border-t border-blue-100 flex items-center justify-between text-xs text-blue-900 font-semibold">
                  <span>Đơn vị tiếp nhận: {aiResult.recommendedService.name}</span>
                  <span className="text-blue-700 font-bold">
                    {(aiResult.recommendedService.base_price || 0).toLocaleString()} VND
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              {submitting ? (
                <span>Đang gửi...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi yêu cầu tức thì</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
