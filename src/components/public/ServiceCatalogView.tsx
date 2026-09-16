import React, { useState, useEffect } from 'react';
import { Service } from '../../types/index.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { Wrench, Sparkles, Droplets, Zap, Wind, Check, Send } from 'lucide-react';

interface ServiceCatalogViewProps {
  onOpenAuthModal: () => void;
  onOpenServiceRequest?: (serviceId: string) => void;
}

export const ServiceCatalogView: React.FC<ServiceCatalogViewProps> = ({ onOpenAuthModal }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Quick service request state
  const [requestingService, setRequestingService] = useState<Service | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getServices(`category=${categoryFilter}`)
      .then(res => setServices(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [categoryFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'CLEANING': return <Sparkles className="w-5 h-5 text-purple-600" />;
      case 'PLUMBING': return <Droplets className="w-5 h-5 text-blue-600" />;
      case 'ELECTRICAL': return <Zap className="w-5 h-5 text-amber-600" />;
      case 'HVAC': return <Wind className="w-5 h-5 text-cyan-600" />;
      default: return <Wrench className="w-5 h-5 text-slate-600" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'CLEANING': return t('services.cat_cleaning');
      case 'PLUMBING': return t('services.cat_plumbing');
      case 'ELECTRICAL': return t('services.cat_electrical');
      case 'HVAC': return t('services.cat_hvac');
      case 'LAUNDRY': return t('services.cat_laundry');
      default: return category || t('services.all_categories');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!requestingService) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.createServiceRequest({
        serviceId: requestingService.id,
        title,
        description,
        urgency
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setRequestingService(null);
        setTitle('');
        setDescription('');
      }, 2000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold mb-2 border border-amber-200">
            <Wrench className="w-3.5 h-3.5" />
            {t('services.badge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {t('services.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            {t('services.desc')}
          </p>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          {['', 'CLEANING', 'PLUMBING', 'ELECTRICAL', 'HVAC', 'LAUNDRY'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {getCategoryName(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">{t('explorer.loading')}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(svc => (
            <div
              key={svc.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    {getCategoryIcon(svc.category)}
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">
                    {getCategoryName(svc.category)}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{svc.name}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">By {svc.company_name}</p>

                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  {svc.description || t('services.desc')}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                    {svc.price_type === 'FIXED' ? t('services.price_fixed') : t('services.price_hourly')}
                  </span>
                  <span className="text-base font-extrabold text-slate-900">
                    {svc.base_price.toLocaleString()} <span className="text-xs font-normal text-slate-500">VND</span>
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      onOpenAuthModal();
                    } else {
                      setRequestingService(svc);
                      setTitle(svc.name);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('services.order_service')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Request Dialog Modal */}
      {requestingService && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t('services.request_modal_title')}</h3>
                <p className="text-xs text-slate-500">{requestingService.name} • {requestingService.company_name}</p>
              </div>
              <button
                onClick={() => setRequestingService(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <Check className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-emerald-900 text-sm">{t('services.request_success')}</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {t('services.request_modal_sub')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
                {submitError && (
                  <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200">
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('services.issue_title')}</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t('services.issue_placeholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('services.issue_desc')}</label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('services.issue_placeholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('services.urgency')}</label>
                  <select
                    value={urgency}
                    onChange={e => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="LOW">{t('services.urgency_low')}</option>
                    <option value="MEDIUM">{t('services.urgency_medium')}</option>
                    <option value="HIGH">{t('services.urgency_high')}</option>
                    <option value="EMERGENCY">{t('services.urgency_emergency')}</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestingService(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('btn.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    {submitting ? t('services.sending') : t('services.send_request')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
