import React, { useState } from 'react';
import { Star, X, CheckCircle2, AlertCircle, ThumbsUp, Wrench, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';

interface WorkOrderReviewModalProps {
  isOpen: boolean;
  serviceRequest: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_TAGS = [
  { id: 'nhanh_chong', labelVi: 'Nhanh chóng', labelEn: 'Prompt & Speedy' },
  { id: 'chuyen_nghiep', labelVi: 'Chuyên nghiệp', labelEn: 'Professional' },
  { id: 'nhiet_tinh', labelVi: 'Nhiệt tình, chu đáo', labelEn: 'Friendly & Courteous' },
  { id: 'sach_se', labelVi: 'Gọn gàng, sạch sẽ', labelEn: 'Clean & Tidy' },
  { id: 'tay_nghe_tot', labelVi: 'Tay nghề cao', labelEn: 'Skilled Workmanship' },
  { id: 'gia_hop_ly', labelVi: 'Chi phí minh bạch', labelEn: 'Transparent Pricing' }
];

export const WorkOrderReviewModal: React.FC<WorkOrderReviewModalProps> = ({
  isOpen,
  serviceRequest,
  onClose,
  onSuccess
}) => {
  const { t, language } = useLanguage();
  const [rating, setRating] = useState<number>(5);
  const [punctualityRating, setPunctualityRating] = useState<number>(5);
  const [qualityRating, setQualityRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['nhanh_chong', 'chuyen_nghiep']);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !serviceRequest) return null;

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.submitProviderReview({
        serviceRequestId: serviceRequest.service_request_id || serviceRequest.id,
        rating,
        punctualityRating,
        qualityRating,
        comment: comment.trim(),
        tags: selectedTags
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (currentVal: number, setVal: (n: number) => void, label: string) => {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setVal(star)}
              className="p-1 hover:scale-110 active:scale-95 transition-transform"
              aria-label={`${star} sao cho ${label}`}
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  star <= currentVal
                    ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                    : 'text-slate-300 hover:text-amber-200'
                }`}
              />
            </button>
          ))}
          <span className="w-6 text-right text-xs font-bold text-amber-600 ml-1">
            {currentVal}/5
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
              <ThumbsUp className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {t('reviews.modalTitle') || 'Đánh giá chất lượng dịch vụ'}
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                {serviceRequest.title || serviceRequest.service_name || 'Dịch vụ đã hoàn tất'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              {t('reviews.thankYouTitle') || 'Cảm ơn phản hồi của bạn!'}
            </h4>
            <p className="text-sm text-slate-600">
              {t('reviews.thankYouDesc') || 'Đánh giá của bạn giúp Homtel không ngừng nâng cao chất lượng dịch vụ phục vụ cư dân.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Provider Info Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 font-medium block">
                  {t('reviews.provider') || 'Đơn vị thực hiện'}:
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {serviceRequest.provider_company_name || 'Đối tác kỹ thuật Homtel'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium block">
                  {t('reviews.serviceDate') || 'Ngày thực hiện'}:
                </span>
                <span className="font-medium text-slate-700">
                  {serviceRequest.preferred_date || serviceRequest.created_at?.slice(0, 10) || 'Gần đây'}
                </span>
              </div>
            </div>

            {/* Star Rating Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1">
              {renderStars(
                rating,
                setRating,
                t('reviews.overallScore') || 'Đánh giá chung'
              )}
              {renderStars(
                punctualityRating,
                setPunctualityRating,
                t('reviews.punctuality') || 'Đúng giờ & Tác phong'
              )}
              {renderStars(
                qualityRating,
                setQualityRating,
                t('reviews.workQuality') || 'Chất lượng xử lý'
              )}
            </div>

            {/* Quick Tag Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('reviews.highlightTags') || 'Điểm nổi bật'}
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  const label = language === 'en' ? tag.labelEn : tag.labelVi;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('reviews.commentLabel') || 'Ý kiến đóng góp (tùy chọn)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  t('reviews.commentPlaceholder') ||
                  'Chia sẻ thêm về trải nghiệm dịch vụ hoặc góp ý cho kỹ thuật viên...'
                }
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {t('common.cancel') || 'Để sau'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <span>{t('common.submitting') || 'Đang gửi...'}</span>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-white text-white" />
                    <span>{t('reviews.submitBtn') || 'Gửi đánh giá'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
