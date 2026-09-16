import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { PortalShell, PortalMenuItem } from '../layout/PortalShell.js';
import { Service, ServiceRequest } from '../../types/index.js';
import { SmartWorkOrderModal } from './SmartWorkOrderModal.js';
import { Wrench, Sparkles, Users, CheckCircle2, Clock, Plus, AlertTriangle, ArrowRight, Eye, ClipboardList } from 'lucide-react';

export const ProviderDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'requests' | 'services' | 'workload'>('requests');
  const [loading, setLoading] = useState(true);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffWorkload, setStaffWorkload] = useState<any[]>([]);

  // Smart Work Order modal
  const [smartOrderRequest, setSmartOrderRequest] = useState<ServiceRequest | null>(null);

  // Assign modal state
  const [assigningRequest, setAssigningRequest] = useState<ServiceRequest | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number>(200000);
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Add service modal state
  const [showAddService, setShowAddService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: 'CLEANING',
    base_price: 250000,
    price_type: 'FIXED',
    description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, svcRes, loadRes] = await Promise.all([
        api.getServiceRequests(),
        api.getServices(),
        api.getStaffWorkload()
      ]);
      setRequests(reqRes);
      setServices(svcRes);
      setStaffWorkload(loadRes);
      if (loadRes.length > 0) {
        setSelectedStaffId(loadRes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningRequest || !selectedStaffId) return;

    setAssignSubmitting(true);
    try {
      await api.assignServiceStaff(assigningRequest.id, {
        staffId: selectedStaffId,
        estimatedCost,
        notes: assignNotes
      });
      setAssigningRequest(null);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, nextStatus: 'IN_PROGRESS' | 'COMPLETED', finalCost?: number) => {
    try {
      await api.reviewServiceRequest(requestId, {
        decision: nextStatus as any,
        finalCost
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createService(serviceForm);
      setShowAddService(false);
      setServiceForm({ name: '', category: 'CLEANING', base_price: 250000, price_type: 'FIXED', description: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length;

  const menuItems: PortalMenuItem[] = [
    {
      id: 'requests',
      label: t('menu.provider_requests', 'Work Orders & Requests'),
      icon: <Wrench className="w-4 h-4" />,
      badge: pendingRequestsCount,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'services',
      label: t('menu.provider_services', 'Service Catalog'),
      icon: <Sparkles className="w-4 h-4" />,
      badge: services.length
    },
    {
      id: 'workload',
      label: t('menu.provider_workload', 'Staff Workload'),
      icon: <Users className="w-4 h-4" />,
      badge: staffWorkload.length
    }
  ];

  return (
    <PortalShell
      portalName={t('portal.provider_title', 'Homtel Provider Hub')}
      portalSubtitle={t('portal.provider_sub', 'Đối tác dịch vụ & Điều phối')}
      portalIcon={<Wrench className="w-5 h-5 text-amber-400" />}
      roleBadgeText={t('simulator.provider', 'ĐỐI TÁC / PROVIDER')}
      roleBadgeColor="bg-amber-500/20 text-amber-300 border-amber-400/30"
      menuItems={menuItems}
      activeTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as any)}
      quickAction={{
        label: t('provider.add_service', 'Add New Service'),
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowAddService(true),
        color: 'bg-amber-600 hover:bg-amber-500 text-white'
      }}
    >
      <div className="space-y-6 pb-16">
        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{t('portal.provider_title', 'Service Provider Dispatch & Management')}</h1>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded text-[11px] border border-amber-200">
                  {t('provider.portal_badge', 'PROVIDER PORTAL')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                CleanMaster Pro Services • {t('provider.banner_desc', 'Field technician dispatch, work orders, service catalog, and SLA tracking.')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddService(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('provider.add_service', 'Add New Service')}</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('provider.incoming_requests', 'Incoming Requests')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{requests.length}</span>
              <span className="text-xs text-amber-600 font-semibold">
                {requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length} {t('provider.pending_action', 'Pending Action')}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('provider.dispatched_techs', 'Dispatched Technicians')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-600">
                {requests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED').length}
              </span>
              <span className="text-xs text-slate-500 font-medium">{t('provider.in_field', 'In Field')}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('provider.completed_orders', 'Completed Orders')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">
                {requests.filter(r => r.status === 'COMPLETED').length}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">{t('provider.sla_metric', '100% SLA')}</span>
            </div>
          </div>
        </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('provider.th_order', 'Order / Title')}</th>
                  <th className="p-3">{t('provider.th_tenant_room', 'Tenant & Room')}</th>
                  <th className="p-3">{t('provider.th_category', 'Category')}</th>
                  <th className="p-3">{t('provider.th_urgency', 'Urgency')}</th>
                  <th className="p-3">{t('provider.th_assigned_tech', 'Assigned Tech')}</th>
                  <th className="p-3">{t('provider.th_status', 'Status')}</th>
                  <th className="p-3 text-right">{t('provider.th_actions', 'Workflow Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{req.title}</div>
                      <div className="text-[11px] text-slate-500 max-w-xs truncate">{req.description}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{req.tenant_name || 'Tenant'}</div>
                      <div className="text-[11px] text-slate-400">{t('owner.room', 'Room')} {req.room_number || '101'} • {req.tenant_phone}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {req.service_category || 'MAINTENANCE'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.urgency === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                        req.urgency === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">
                      {req.staff_name ? (
                        <span className="flex items-center gap-1 text-teal-700">
                          <Users className="w-3 h-3" /> {req.staff_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">{t('provider.unassigned', 'Unassigned')}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        req.status === 'ASSIGNED' ? 'bg-teal-100 text-teal-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSmartOrderRequest(req)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1"
                          title="Xem thông tin thiết bị phòng & bối cảnh thông minh"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                          <span>Chi tiết Smart</span>
                        </button>

                        {req.status === 'PENDING' || req.status === 'APPROVED' ? (
                          <button
                            onClick={() => {
                              setAssigningRequest(req);
                              setEstimatedCost(200000);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                          >
                            {t('provider.btn_assign_tech', 'Assign Technician')}
                          </button>
                        ) : req.status === 'ASSIGNED' ? (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'IN_PROGRESS')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                          >
                            {t('provider.btn_mark_in_progress', 'Mark In Progress')}
                          </button>
                        ) : req.status === 'IN_PROGRESS' ? (
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'COMPLETED', req.estimated_cost || 250000)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg"
                          >
                            {t('provider.btn_complete_order', 'Complete Order')}
                          </button>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('provider.btn_done', 'Done')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services Catalog Tab */}
      {activeTab === 'services' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                  {s.category}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {s.base_price.toLocaleString()} VND ({s.price_type.toLowerCase()})
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
              <p className="text-xs text-slate-500">{s.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staff Workload Tab */}
      {activeTab === 'workload' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">{t('provider.staff_distribution', 'Technician & Cleaner Staff Workload Distribution')}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {staffWorkload.map(st => (
              <div key={st.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                    <img src={st.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(st.full_name)}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{st.full_name}</div>
                    <div className="text-[11px] text-slate-500">{st.email} • {st.phone || 'N/A'}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('provider.active_tasks', 'Active Tasks')}</span>
                  <span className="text-base font-black text-amber-600">{st.active_tasks_count || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">{t('provider.assign_modal_title', 'Assign Technician to Work Order')}</h3>
            <p className="text-xs text-slate-500">{assigningRequest.title} • {t('owner.room', 'Room')} {assigningRequest.room_number || '101'}</p>

            <form onSubmit={handleAssignStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('provider.select_tech', 'Select Technician')}</label>
                <select
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {staffWorkload.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.active_tasks_count || 0} {t('provider.active_jobs', 'active orders')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('provider.estimated_quote', 'Estimated Cost (VND)')}</label>
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={e => setEstimatedCost(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('provider.dispatch_notes', 'Dispatch Notes')}</label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder={t('provider.dispatch_notes_ph', 'Instructions for technician or materials needed...')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningRequest(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  {t('btn.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
                >
                  {assignSubmitting ? t('provider.assigning', 'Assigning...') : t('provider.btn_dispatch', 'Dispatch Technician')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">{t('provider.add_service_title', 'Add New Service to Catalog')}</h3>

            <form onSubmit={handleAddService} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('provider.service_name', 'Service Name')}</label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g. Deep Mattress Sanitization"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('provider.service_cat', 'Category')}</label>
                  <select
                    value={serviceForm.category}
                    onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="CLEANING">{t('services.cat_cleaning', 'Cleaning')}</option>
                    <option value="PLUMBING">{t('services.cat_plumbing', 'Plumbing')}</option>
                    <option value="ELECTRICAL">{t('services.cat_electrical', 'Electrical')}</option>
                    <option value="HVAC">{t('services.cat_hvac', 'HVAC / Air-con')}</option>
                    <option value="LAUNDRY">{t('services.cat_laundry', 'Laundry')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('provider.base_price', 'Base Price (VND)')}</label>
                  <input
                    type="number"
                    value={serviceForm.base_price}
                    onChange={e => setServiceForm({ ...serviceForm, base_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('provider.description', 'Description')}</label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
                >
                  {t('btn.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                >
                  {t('provider.btn_save_service', 'Save Service')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Smart Work Order Modal */}
      <SmartWorkOrderModal
        request={smartOrderRequest}
        onClose={() => setSmartOrderRequest(null)}
        onUpdateStatus={async (id, status, actualCost) => {
          await handleUpdateStatus(id, status, actualCost);
          setSmartOrderRequest(null);
        }}
      />
      </div>
    </PortalShell>
  );
};
