import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { RentalContract, Invoice, ServiceRequest, RentalApplication } from '../../types/index.js';
import { PaymentModal } from './PaymentModal.js';
import { QuickServiceModal } from './QuickServiceModal.js';
import { ContractSigningModal } from './ContractSigningModal.js';
import { ContractEvidenceModal } from './ContractEvidenceModal.js';
import { WorkOrderReviewModal } from './WorkOrderReviewModal.js';
import { PwaInstallPrompt } from '../pwa/PwaInstallPrompt.js';
import { PortalShell, PortalMenuItem } from '../layout/PortalShell.js';
import { Home, Receipt, Wrench, Shield, CheckCircle2, Plus, FileText, Sparkles, PenTool, ShieldCheck, Star, Bell, BellOff, WifiOff } from 'lucide-react';

interface TenantDashboardProps {
  onBrowseServices?: () => void;
}

export const TenantDashboard: React.FC<TenantDashboardProps> = ({ onBrowseServices }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'lease' | 'invoices' | 'services' | 'applications'>('lease');
  const [loading, setLoading] = useState(true);

  const [activeContract, setActiveContract] = useState<RentalContract | null>(null);
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [applications, setApplications] = useState<RentalApplication[]>([]);

  // Payment modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  // E-Sign modal
  const [signingContract, setSigningContract] = useState<RentalContract | null>(null);
  const [viewingEvidenceContractId, setViewingEvidenceContractId] = useState<string | null>(null);

  // New service request quick modal
  const [showReqModal, setShowReqModal] = useState(false);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [reqServiceId, setReqServiceId] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqUrgency, setReqUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'>('MEDIUM');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Phase 5: Provider Reviews & Ratings
  const [reviewingRequest, setReviewingRequest] = useState<any | null>(null);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  // Phase 5: Push Notifications & Offline Mode
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, iRes, sRes, aRes, svcs, allContracts, pReviews, pStatus] = await Promise.all([
        api.getActiveContract().catch(() => null),
        api.getInvoices().catch(() => []),
        api.getServiceRequests().catch(() => []),
        api.getApplications().catch(() => []),
        api.getServices().catch(() => []),
        api.getContracts().catch(() => []),
        api.getPendingReviews().catch(() => []),
        api.getPushStatus().catch(() => ({ subscribed: false, count: 0 }))
      ]);

      setActiveContract(cRes);
      setContracts(allContracts || []);
      setInvoices(iRes);
      setServiceRequests(sRes);
      setApplications(aRes);
      setServicesList(svcs);
      setPendingReviews(pReviews || []);
      setPushSubscribed(Boolean(pStatus?.subscribed));
      if (svcs.length > 0) setReqServiceId(svcs[0].id);

      // Offline Cache storage
      if (cRes) {
        localStorage.setItem('homtel_cached_contract', JSON.stringify(cRes));
      }
      if (iRes && iRes.length > 0) {
        localStorage.setItem('homtel_cached_invoices', JSON.stringify(iRes));
      }
    } catch (err) {
      console.warn('Network fetch failed, attempting offline cache recovery:', err);
      // Fallback from localStorage cache if offline
      const cachedC = localStorage.getItem('homtel_cached_contract');
      const cachedI = localStorage.getItem('homtel_cached_invoices');
      if (cachedC) {
        try { setActiveContract(JSON.parse(cachedC)); } catch {}
      }
      if (cachedI) {
        try { setInvoices(JSON.parse(cachedI)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleOnline = () => { setIsOffline(false); fetchData(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await api.unsubscribePushNotification({ endpoint: 'browser_push_default' });
        setPushSubscribed(false);
      } else {
        // Request Notification permission if supported
        if ('Notification' in window && Notification.permission !== 'granted') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            alert('Vui lòng cấp quyền thông báo trên trình duyệt của bạn.');
            setPushLoading(false);
            return;
          }
        }
        await api.subscribePushNotification({
          endpoint: `browser_push_${Date.now()}`,
          userAgent: navigator.userAgent
        });
        setPushSubscribed(true);
        // Dispatch test notification
        await api.testPushNotification({
          title: 'Homtel Resident',
          body: 'Thông báo đẩy đã được kích hoạt thành công trên thiết bị của bạn!'
        });
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi thiết lập thông báo đẩy');
    } finally {
      setPushLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReq(true);
    try {
      await api.createServiceRequest({
        serviceId: reqServiceId,
        title: reqTitle,
        description: reqDesc,
        urgency: reqUrgency,
        roomId: activeContract?.room_id
      });
      setShowReqModal(false);
      setReqTitle('');
      setReqDesc('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReq(false);
    }
  };

  const unpaidCount = invoices.filter(i => i.status !== 'PAID').length;
  const pendingRequestsCount = serviceRequests.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELLED').length;
  const pendingContract = contracts.find(c => c.status === 'PENDING' || c.status === 'DRAFT');

  const menuItems: PortalMenuItem[] = [
    {
      id: 'lease',
      label: t('menu.my_lease'),
      icon: <Home className="w-4 h-4" />
    },
    {
      id: 'invoices',
      label: t('menu.my_invoices'),
      icon: <Receipt className="w-4 h-4" />,
      badge: unpaidCount,
      badgeColor: 'bg-red-500 text-white'
    },
    {
      id: 'services',
      label: t('menu.my_services'),
      icon: <Wrench className="w-4 h-4" />,
      badge: pendingRequestsCount,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'applications',
      label: t('menu.my_applications'),
      icon: <FileText className="w-4 h-4" />,
      badge: applications.length
    }
  ];

  return (
    <PortalShell
      portalName={t('portal.tenant_title')}
      portalSubtitle={t('portal.tenant_sub')}
      portalIcon={<Home className="w-5 h-5" />}
      roleBadgeText={t('simulator.tenant')}
      roleBadgeColor="bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
      menuItems={menuItems}
      activeTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as any)}
      onBackToPublic={onBrowseServices}
      quickAction={{
        label: t('tenant.new_request'),
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowReqModal(true),
        color: 'bg-emerald-600 hover:bg-emerald-500 text-white'
      }}
    >
      <div className="space-y-6 pb-16">
        {/* PWA Mobile & Web Push Strip */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOffline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide uppercase text-slate-300">
                  {isOffline ? (t('pwa.offlineModeNotice') || 'Chế độ ngoại tuyến') : 'Homtel Resident PWA'}
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                  v1.0-PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOffline 
                  ? 'Dữ liệu căn hộ & hóa đơn đang được đồng bộ từ bộ nhớ đệm cục bộ.' 
                  : 'Hệ thống kết nối trực tiếp đến ban quản lý tòa nhà và tổng đài dịch vụ.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                pushSubscribed
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {pushSubscribed ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('pwa.pushSubscribed') || 'Đã bật thông báo'}</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('pwa.pushEnable') || 'Bật thông báo đẩy'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Phase 5: Pending Work Order Reviews Banner */}
        {pendingReviews.length > 0 && (
          <div className="p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/15 rounded-2xl border border-amber-300/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 text-white uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  {t('reviews.pendingAlert') || 'Dịch vụ cần đánh giá'}
                </span>
                <span className="text-xs font-semibold text-amber-800">
                  {pendingReviews.length} {t('reviews.pendingCount', 'yêu cầu hoàn tất')}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {pendingReviews[0]?.service_name || 'Dịch vụ tiện ích'} — {pendingReviews[0]?.provider_company_name || 'Đối tác kỹ thuật'}
              </h3>
              <p className="text-xs text-slate-600">
                {t('reviews.pendingAlertDesc') || 'Bạn có dịch vụ đã hoàn tất. Hãy chia sẻ đánh giá để giúp nâng cao chất lượng dịch vụ!'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReviewingRequest(pendingReviews[0])}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 shrink-0 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Star className="w-4 h-4 fill-white text-white" />
              <span>{t('reviews.reviewNow') || 'Đánh giá ngay'}</span>
            </button>
          </div>
        )}

        {/* Pending Contract E-Signing Alert */}
        {pendingContract && (
          <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-2xl border border-emerald-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                  {t('contract.pending_signature', 'Chờ ký kết điện tử')}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">{pendingContract.contract_number}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {t('contract.ready_to_sign', 'Hợp đồng thuê căn hộ của bạn đã sẵn sàng ký kết')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('contract.ready_desc', 'Vui lòng hoàn tất ký kết điện tử (chữ ký tay hoặc OTP bảo mật) để kích hoạt quyền lợi cư dân và nhận bàn giao căn hộ.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSigningContract(pendingContract)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 shrink-0 transition-all cursor-pointer"
            >
              <PenTool className="w-4 h-4" />
              <span>{t('contract.sign_now', 'Ký hợp đồng điện tử ngay')}</span>
            </button>
          </div>
        )}

        {/* TAB 1: Active Lease */}
        {activeTab === 'lease' && (
          <div className="space-y-6">
            {activeContract ? (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Unit Card */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">
                        {t('tenant.active_lease')}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                        {t('explorer.room_number')} {activeContract.room_number} • {activeContract.building_name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeContract.signed_at && (
                        <button
                          type="button"
                          onClick={() => setViewingEvidenceContractId(activeContract.id)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('contract.view_certificate', 'Chứng thư SHA-256')}</span>
                        </button>
                      )}
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        {t(`status.${activeContract.status.toLowerCase()}`, activeContract.status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-semibold">{t('tenant.contracts_title')}</span>
                      <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">{activeContract.contract_number}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-semibold">{t('tenant.rent_amount')}</span>
                      <span className="font-bold text-blue-600 text-sm mt-0.5 block">{activeContract.rent_amount.toLocaleString()} VND</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block font-semibold">{t('tenant.lease_period')}</span>
                      <span className="font-bold text-slate-800 mt-0.5 block">{activeContract.start_date} → {activeContract.end_date}</span>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-600 leading-relaxed">
                    {t('tenant.billing_day')}: {activeContract.payment_day_of_month} {t('tenant.day_every_month')}. {t('explorer.feature_meters')}.
                  </div>
                </div>

                {/* Security Deposit Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-700 font-semibold text-xs">
                      <Shield className="w-4 h-4" />
                      {t('tenant.deposit')}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {activeContract.deposit_amount.toLocaleString()} <span className="text-xs font-normal text-slate-500">VND</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('modal.apply_desc')}
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('status.paid')}
                    </span>
                    <span className="text-[11px] text-emerald-700 block mt-0.5">{t('status.status', 'Trạng thái')}: {t('status.held', 'Đang giữ ký quỹ')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                <Home className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">{t('tenant.no_lease')}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t('explorer.units_desc')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                {t('tenant.no_invoices')}
              </div>
            ) : (
              invoices.map(inv => (
                <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{inv.invoice_number}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {inv.billing_month}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                          inv.status === 'ISSUED' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{inv.due_date}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold">{t('payment.total_amount')}</span>
                        <span className="text-base font-black text-slate-900">{inv.total.toLocaleString()} VND</span>
                      </div>

                      {inv.status !== 'PAID' && (
                        <button
                          onClick={() => setPayingInvoice(inv)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs"
                        >
                          {t('tenant.pay_now')} ({inv.outstanding_amount.toLocaleString()} VND)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Line items breakdown */}
                  {inv.items && inv.items.length > 0 && (
                    <div className="pt-1">
                      <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tenant.view_invoice')}</h5>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                        {inv.items.map(item => (
                          <div key={item.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-800 block">{item.description}</span>
                              <span className="text-[11px] text-slate-400">× {item.quantity}</span>
                            </div>
                            <span className="font-bold text-slate-900">{item.amount.toLocaleString()} VND</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: Maintenance Requests */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowReqModal(true)}
                className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {t('tenant.new_request')}
              </button>
            </div>

            {serviceRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                {t('tenant.no_requests')}
              </div>
            ) : (
              serviceRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{req.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.urgency === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                          req.urgency === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {t(`services.urgency_${req.urgency.toLowerCase()}`, req.urgency)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{req.description}</p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      req.status === 'ASSIGNED' ? 'bg-teal-100 text-teal-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {t(`status.${req.status.toLowerCase()}`, req.status)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      {req.staff_name ? (
                        <span className="text-teal-700 font-semibold">{req.staff_name}</span>
                      ) : (
                        <span>{t('status.pending')}</span>
                      )}

                      {req.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => setReviewingRequest(req)}
                          className="px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        >
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{t('reviews.reviewNow') || 'Đánh giá'}</span>
                        </button>
                      )}
                    </div>
                    <div>{new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: Applications */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                {t('explorer.no_rooms')}
              </div>
            ) : (
              applications.map(a => (
                <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-600">{t('explorer.room_number')} {a.room_number} • {a.building_name}</span>
                    <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{t('modal.apply_title')} ({a.lease_duration_months} {t('modal.duration')})</h4>
                    <p className="text-xs text-slate-500">{t('modal.start_date')}: {a.intended_start_date}</p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    a.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {t(`status.${a.status.toLowerCase()}`, a.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Payment Modal */}
        {payingInvoice && (
          <PaymentModal
            invoice={payingInvoice}
            onClose={() => setPayingInvoice(null)}
            onPaymentSuccess={() => {
              fetchData();
            }}
          />
        )}

        {/* AI-Powered Quick Service Modal */}
        <QuickServiceModal
          isOpen={showReqModal}
          onClose={() => setShowReqModal(false)}
          roomId={activeContract?.room_id}
          onSuccess={fetchData}
        />

        {/* E-Signature Modal */}
        <ContractSigningModal
          contract={signingContract}
          isOpen={!!signingContract}
          onClose={() => setSigningContract(null)}
          onSignSuccess={() => {
            setSigningContract(null);
            fetchData();
          }}
        />

        {/* Evidence Certificate Modal */}
        <ContractEvidenceModal
          contractId={viewingEvidenceContractId || ''}
          isOpen={!!viewingEvidenceContractId}
          onClose={() => setViewingEvidenceContractId(null)}
        />

        {/* Phase 5: Work Order Review Modal */}
        <WorkOrderReviewModal
          isOpen={!!reviewingRequest}
          serviceRequest={reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          onSuccess={fetchData}
        />

        {/* Phase 5: PWA Install Prompt Banner */}
        <PwaInstallPrompt />
      </div>
    </PortalShell>
  );
};
