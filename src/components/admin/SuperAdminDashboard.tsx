import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { PortalShell, PortalMenuItem } from '../layout/PortalShell';
import { Shield, Building, Wrench, Users, DollarSign, Activity, Plus, Search, CheckCircle2, History, AlertCircle, Sparkles } from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'owners' | 'providers' | 'companies' | 'users' | 'audit'>('overview');
  const [loading, setLoading] = useState(true);

  // Lists
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Create Owner Modal Form
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    fullName: '',
    email: '',
    password: 'Owner@123',
    phone: '',
    companyName: '',
    companyType: 'COMPANY' as 'COMPANY' | 'HOUSEHOLD_BUSINESS',
    taxCode: '',
    businessRegistrationNumber: '',
    companyAddress: 'Da Nang, Vietnam'
  });
  const [submittingOwner, setSubmittingOwner] = useState(false);
  const [ownerSuccess, setOwnerSuccess] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  // Create Provider Modal Form
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerForm, setProviderForm] = useState({
    fullName: '',
    email: '',
    password: 'Provider@123',
    phone: '',
    companyName: '',
    companyType: 'COMPANY' as 'COMPANY' | 'HOUSEHOLD_BUSINESS',
    taxCode: '',
    businessRegistrationNumber: '',
    companyAddress: 'Da Nang, Vietnam'
  });
  const [submittingProvider, setSubmittingProvider] = useState(false);
  const [providerSuccess, setProviderSuccess] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [s, c, u, a] = await Promise.all([
        api.getSystemStats(),
        api.getCompanies(),
        api.getUsers(),
        api.getAuditLogs()
      ]);
      setStats(s);
      setCompanies(c);
      setUsers(u);
      setAuditLogs(a);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOwner(true);
    setOwnerError(null);
    try {
      await api.createOwner(ownerForm);
      setOwnerSuccess(true);
      setTimeout(() => {
        setOwnerSuccess(false);
        setShowOwnerModal(false);
        setOwnerForm({
          fullName: '',
          email: '',
          password: 'Owner@123',
          phone: '',
          companyName: '',
          companyType: 'COMPANY',
          taxCode: '',
          businessRegistrationNumber: '',
          companyAddress: 'Da Nang, Vietnam'
        });
        fetchStats();
      }, 1500);
    } catch (err: any) {
      setOwnerError(err.message || 'Failed to create owner');
    } finally {
      setSubmittingOwner(false);
    }
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProvider(true);
    setProviderError(null);
    try {
      await api.createProvider(providerForm);
      setProviderSuccess(true);
      setTimeout(() => {
        setProviderSuccess(false);
        setShowProviderModal(false);
        setProviderForm({
          fullName: '',
          email: '',
          password: 'Provider@123',
          phone: '',
          companyName: '',
          companyType: 'COMPANY',
          taxCode: '',
          businessRegistrationNumber: '',
          companyAddress: 'Da Nang, Vietnam'
        });
        fetchStats();
      }, 1500);
    } catch (err: any) {
      setProviderError(err.message || 'Failed to create provider');
    } finally {
      setSubmittingProvider(false);
    }
  };

  const menuItems: PortalMenuItem[] = [
    {
      id: 'overview',
      label: t('menu.admin_overview', 'System Overview'),
      icon: <Activity className="w-4 h-4" />
    },
    {
      id: 'companies',
      label: t('menu.admin_companies', 'Companies & Owners'),
      icon: <Building className="w-4 h-4" />,
      badge: companies.length
    },
    {
      id: 'users',
      label: t('menu.admin_users', 'User Accounts'),
      icon: <Users className="w-4 h-4" />,
      badge: users.length
    },
    {
      id: 'audit',
      label: t('menu.admin_audit', 'Audit Trail'),
      icon: <History className="w-4 h-4" />,
      badge: auditLogs.length
    }
  ];

  return (
    <PortalShell
      portalName={t('portal.admin_title', 'Homtel Super Admin')}
      portalSubtitle={t('portal.admin_sub', 'Quản trị hệ thống')}
      portalIcon={<Shield className="w-5 h-5 text-purple-400" />}
      roleBadgeText={t('simulator.admin', 'SUPER ADMIN')}
      roleBadgeColor="bg-purple-500/20 text-purple-300 border-purple-400/30"
      menuItems={menuItems}
      activeTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as any)}
      quickAction={{
        label: t('admin.provision_owner', 'Provision Owner'),
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowOwnerModal(true),
        color: 'bg-purple-600 hover:bg-purple-500 text-white'
      }}
    >
      <div className="space-y-6 pb-16">
        {/* Top actions banner */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{t('portal.admin_title', 'Homtel Platform Command Center')}</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-semibold rounded text-[10px] border border-purple-200">
                {t('admin.root_isolation', 'ROOT ISOLATION')}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('admin.banner_desc', 'System-wide monitoring, atomic owner provisioning, company isolation, and audit trail.')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOwnerModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('admin.provision_owner', 'Provision Owner')}</span>
            </button>

            <button
              onClick={() => setShowProviderModal(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('admin.provision_provider', 'Provision Provider')}</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('admin.total_users', 'Total Platform Users')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{stats.totalUsers}</span>
              <span className="text-xs text-slate-500 font-medium">{stats.totalTenants} {t('admin.total_tenants', 'Tenants')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex gap-2">
              <span>{stats.totalOwners} {t('admin.total_owners', 'Owners')}</span> • <span>{stats.totalProviders} {t('admin.total_providers', 'Providers')}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('admin.managed_buildings', 'Managed Buildings')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-600">{stats.totalBuildings}</span>
              <span className="text-xs text-slate-500 font-medium">{stats.totalRooms} {t('admin.total_rooms', 'Rooms')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex gap-2">
              <span>{stats.totalCompanies} {t('admin.registered_companies', 'Registered Companies')}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('admin.total_revenue', 'Total Revenue Processed')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-600">
                {(stats.totalRevenue / 1000000).toFixed(1)}M <span className="text-xs font-normal">VND</span>
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">{t('status.settled', 'Settled')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {t('admin.outstanding', 'Outstanding')}: {(stats.totalOutstanding / 1000000).toFixed(1)}M VND
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('admin.active_contracts', 'Active Lease Contracts')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-indigo-600">{stats.activeContracts}</span>
              <span className="text-xs text-slate-500 font-medium">{stats.auditCount} {t('admin.audits', 'Audits')}</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-600 font-medium">
              {t('admin.audited_tx', '100% Transactions Audited')}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Audit Actions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              {t('admin.recent_audit_events', 'Latest System Events & State Changes')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {auditLogs.slice(0, 6).map(log => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600 font-mono text-[11px] truncate">
                    {log.entity_type} #{log.entity_id}
                  </p>
                  {log.new_value && (
                    <div className="mt-1 text-[11px] text-slate-500 truncate bg-white p-1.5 rounded border border-slate-200">
                      {log.new_value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Companies Quick List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              {t('admin.org_list', 'Tenant Landlords & Provider Organizations')}
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {companies.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{c.name}</span>
                    <span className="text-[11px] text-slate-500">{c.email} • {t('admin.th_tax', 'Tax')}: {c.tax_code || 'N/A'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.type === 'COMPANY' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {c.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'companies' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
            {t('admin.companies_title', 'Registered Real Estate Companies & Service Providers')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('admin.th_company', 'Company Name')}</th>
                  <th className="p-3">{t('admin.th_type', 'Type')}</th>
                  <th className="p-3">{t('admin.th_tax', 'Tax Code')}</th>
                  <th className="p-3">{t('admin.th_contact', 'Email & Phone')}</th>
                  <th className="p-3">{t('admin.th_reg_address', 'Registered Address')}</th>
                  <th className="p-3">{t('admin.th_status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{c.tax_code || 'N/A'}</td>
                    <td className="p-3">
                      <div>{c.email}</div>
                      <div className="text-slate-400 text-[11px]">{c.phone}</div>
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{c.address || 'N/A'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
            {t('admin.users_title', 'System Users Directory')} ({users.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('admin.th_user', 'User')}</th>
                  <th className="p-3">{t('admin.th_email', 'Email')}</th>
                  <th className="p-3">{t('admin.th_role', 'Role')}</th>
                  <th className="p-3">{t('admin.th_phone', 'Phone')}</th>
                  <th className="p-3">{t('admin.th_status', 'Status')}</th>
                  <th className="p-3">{t('admin.th_registered', 'Registered')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                        <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.full_name)}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      {u.full_name}
                    </td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{u.phone || 'N/A'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            {t('admin.audit_title', 'Immutable Audit Trail')} ({auditLogs.length} {t('admin.records', 'Records')})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('admin.th_timestamp', 'Timestamp')}</th>
                  <th className="p-3">{t('admin.th_action', 'Action')}</th>
                  <th className="p-3">{t('admin.th_entity', 'Entity Type & ID')}</th>
                  <th className="p-3">{t('admin.th_actor', 'Actor')}</th>
                  <th className="p-3">{t('admin.th_payload', 'Payload Diff / Record')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                        {a.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-700">
                      {a.entity_type} <span className="text-slate-400">#{a.entity_id}</span>
                    </td>
                    <td className="p-3 text-slate-600">{a.actor_name || a.actor_email || a.actor_id || 'SYSTEM'}</td>
                    <td className="p-3 max-w-md font-mono text-[10px] text-slate-600 truncate bg-slate-50/50 rounded">
                      {a.new_value || a.old_value || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Atomic Owner Provisioning Modal */}
      {showOwnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t('admin.modal_owner_title', 'Atomic Owner & Company Provisioning')}</h3>
                <p className="text-xs text-slate-500">{t('admin.modal_owner_sub', 'Atomically creates Owner User + Company + Admin Membership in 1 transaction')}</p>
              </div>
              <button onClick={() => setShowOwnerModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>

            {ownerSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-sm">{t('admin.provision_success_owner', 'Owner & Company Provisioned Successfully!')}</h4>
                <p className="text-xs mt-0.5">{t('admin.tx_committed', 'Database transaction committed cleanly.')}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateOwner} className="space-y-3 text-xs">
                {ownerError && (
                  <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200">
                    {ownerError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.owner_name', 'Owner Full Name')}</label>
                    <input
                      type="text"
                      required
                      value={ownerForm.fullName}
                      onChange={e => setOwnerForm({ ...ownerForm, fullName: e.target.value })}
                      placeholder="e.g. Vo Quoc Tuan"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.owner_email', 'Owner Email')}</label>
                    <input
                      type="email"
                      required
                      value={ownerForm.email}
                      onChange={e => setOwnerForm({ ...ownerForm, email: e.target.value })}
                      placeholder="owner@company.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.company_name', 'Company Name')}</label>
                    <input
                      type="text"
                      required
                      value={ownerForm.companyName}
                      onChange={e => setOwnerForm({ ...ownerForm, companyName: e.target.value })}
                      placeholder="e.g. Dragon River Properties Ltd"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.company_type', 'Company Type')}</label>
                    <select
                      value={ownerForm.companyType}
                      onChange={e => setOwnerForm({ ...ownerForm, companyType: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="COMPANY">{t('admin.enterprise', 'Enterprise Company')}</option>
                      <option value="HOUSEHOLD_BUSINESS">{t('admin.household', 'Household Business')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.th_tax', 'Tax Code')}</label>
                    <input
                      type="text"
                      value={ownerForm.taxCode}
                      onChange={e => setOwnerForm({ ...ownerForm, taxCode: e.target.value })}
                      placeholder="0408991122"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.initial_pwd', 'Initial Password')}</label>
                    <input
                      type="password"
                      required
                      value={ownerForm.password}
                      onChange={e => setOwnerForm({ ...ownerForm, password: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOwnerModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold"
                  >
                    {t('btn.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOwner}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                  >
                    {submittingOwner ? t('status.pending', 'Creating...') : t('admin.btn_create_owner', 'Provision Owner & Company')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Atomic Provider Provisioning Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t('admin.modal_provider_title', 'Atomic Provider & Company Provisioning')}</h3>
                <p className="text-xs text-slate-500">{t('admin.modal_provider_sub', 'Atomically creates Provider User + Service Company + Admin Membership')}</p>
              </div>
              <button onClick={() => setShowProviderModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>

            {providerSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-sm">{t('admin.provision_success_provider', 'Service Provider Provisioned Successfully!')}</h4>
                <p className="text-xs mt-0.5">{t('admin.tx_committed', 'Database transaction committed cleanly.')}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateProvider} className="space-y-3 text-xs">
                {providerError && (
                  <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200">
                    {providerError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.provider_name', 'Provider Director Name')}</label>
                    <input
                      type="text"
                      required
                      value={providerForm.fullName}
                      onChange={e => setProviderForm({ ...providerForm, fullName: e.target.value })}
                      placeholder="e.g. Phan Hoang Nam"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.provider_email', 'Provider Email')}</label>
                    <input
                      type="email"
                      required
                      value={providerForm.email}
                      onChange={e => setProviderForm({ ...providerForm, email: e.target.value })}
                      placeholder="director@service.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.provider_biz_name', 'Company / Business Name')}</label>
                    <input
                      type="text"
                      required
                      value={providerForm.companyName}
                      onChange={e => setProviderForm({ ...providerForm, companyName: e.target.value })}
                      placeholder="e.g. RapidFix Services Group"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.company_type', 'Company Type')}</label>
                    <select
                      value={providerForm.companyType}
                      onChange={e => setProviderForm({ ...providerForm, companyType: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="COMPANY">{t('admin.enterprise', 'Enterprise Company')}</option>
                      <option value="HOUSEHOLD_BUSINESS">{t('admin.household', 'Household Business')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.th_tax', 'Tax Code')}</label>
                    <input
                      type="text"
                      value={providerForm.taxCode}
                      onChange={e => setProviderForm({ ...providerForm, taxCode: e.target.value })}
                      placeholder="0407722118"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('admin.initial_pwd', 'Initial Password')}</label>
                    <input
                      type="password"
                      required
                      value={providerForm.password}
                      onChange={e => setProviderForm({ ...providerForm, password: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProviderModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold"
                  >
                    {t('btn.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProvider}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                  >
                    {submittingProvider ? t('status.pending', 'Creating...') : t('admin.btn_create_provider', 'Provision Provider & Company')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </PortalShell>
  );
};
