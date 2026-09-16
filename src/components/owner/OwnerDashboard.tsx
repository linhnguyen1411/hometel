import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { PortalShell, PortalMenuItem } from '../layout/PortalShell.js';
import { Room, Building, RentalApplication, RentalContract, Invoice } from '../../types/index.js';
import { MeterAndInvoiceModal } from './MeterAndInvoiceModal.js';
import { TodayCockpit } from './TodayCockpit.js';
import { Building360View } from './Building360View.js';
import { ActionCenterView } from './ActionCenterView.js';
import { RoomDetailPanel } from './RoomDetailPanel.js';
import { CommandPalette } from '../common/CommandPalette.js';
import {
  Building2,
  Home,
  Users,
  FileText,
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  Settings,
  Wrench,
  Shield,
  Zap,
  DollarSign,
  Clock,
  AlertCircle,
  Layers,
  Sparkles,
  Search
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'today' | 'actions' | 'building360' | 'rooms' | 'applications' | 'contracts' | 'invoices' | 'configs' | 'staff'>('today');
  const [loading, setLoading] = useState(true);

  // Building OS Dialogs
  const [activeRoom360Id, setActiveRoom360Id] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Selected room for meter modal
  const [selectedRoomForBilling, setSelectedRoomForBilling] = useState<Room | null>(null);

  // Application Review state
  const [reviewingApp, setReviewingApp] = useState<RentalApplication | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingSubmitting, setReviewingSubmitting] = useState(false);

  // Create Staff state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', password: 'Staff@123', phone: '' });
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffSuccess, setStaffSuccess] = useState(false);

  // Add Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [configForm, setConfigForm] = useState({
    effective_from: new Date().toISOString().split('T')[0],
    electricity_unit_price: 3800,
    water_unit_price: 18000,
    internet_price: 250000,
    garbage_price: 60000,
    parking_fee_motorbike: 120000,
    parking_fee_car: 1200000,
    cleaning_fee: 100000,
    notes: 'Standard utility schedule Q4 2026'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, rRes, aRes, cRes, iRes] = await Promise.all([
        api.getBuildings(),
        api.getRooms(''),
        api.getApplications(),
        api.getContracts(),
        api.getInvoices()
      ]);
      setBuildings(bRes);
      setRooms(rRes);
      setApplications(aRes);
      setContracts(cRes);
      setInvoices(iRes);

      if (bRes.length > 0) {
        setSelectedBuildingId(bRes[0].id);
        const compId = bRes[0].company_id;
        if (compId) {
          api.getCompanyStaff(compId).then(s => setStaffList(s)).catch(() => {});
        }
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

  const handleReviewApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingApp) return;

    setReviewingSubmitting(true);
    try {
      await api.reviewApplication(reviewingApp.id, {
        decision: reviewDecision,
        reviewNotes: reviewNotes || (reviewDecision === 'APPROVED' ? 'Application approved. Contract created.' : 'Declined.')
      });
      setReviewingApp(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setReviewingSubmitting(false);
    }
  };

  const handleToggleRoomStatus = async (room: Room, nextStatus: any) => {
    try {
      await api.updateRoom(room.id, { status: nextStatus });
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, status: nextStatus } : r));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const compId = buildings[0]?.company_id;
    if (!compId) return;

    setStaffSubmitting(true);
    try {
      await api.createStaff(compId, staffForm);
      setStaffSuccess(true);
      setTimeout(() => {
        setStaffSuccess(false);
        setShowStaffModal(false);
        setStaffForm({ fullName: '', email: '', password: 'Staff@123', phone: '' });
        api.getCompanyStaff(compId).then(s => setStaffList(s));
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;

    try {
      await api.addBuildingConfig(selectedBuildingId, configForm);
      setShowConfigModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics
  const totalUnits = rooms.length;
  const occupiedUnits = rooms.filter(r => r.status === 'OCCUPIED').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const pendingApps = applications.filter(a => a.status === 'PENDING').length;
  const totalPaidRevenue = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + i.total, 0);

  const menuItems: PortalMenuItem[] = [
    {
      id: 'today',
      label: 'Hôm nay (Today Cockpit)',
      icon: <Clock className="w-4 h-4 text-blue-400" />
    },
    {
      id: 'actions',
      label: 'Trung tâm hành động (Action Center)',
      icon: <AlertCircle className="w-4 h-4 text-amber-400" />
    },
    {
      id: 'building360',
      label: 'Bản đồ phòng & Tòa nhà (Building 360)',
      icon: <Building2 className="w-4 h-4 text-emerald-400" />
    },
    {
      id: 'rooms',
      label: t('menu.owner_rooms', 'Rooms & Units'),
      icon: <Home className="w-4 h-4" />,
      badge: rooms.length
    },
    {
      id: 'applications',
      label: t('menu.owner_applications', 'Rental Applications'),
      icon: <FileText className="w-4 h-4" />,
      badge: pendingApps,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'contracts',
      label: t('menu.owner_contracts', 'Contracts & Leases'),
      icon: <Shield className="w-4 h-4" />,
      badge: contracts.length
    },
    {
      id: 'invoices',
      label: t('menu.owner_meter_billing', 'Invoices & Meters'),
      icon: <Receipt className="w-4 h-4" />,
      badge: invoices.length
    },
    {
      id: 'configs',
      label: t('menu.owner_configs', 'Utility Tariffs'),
      icon: <Settings className="w-4 h-4" />
    },
    {
      id: 'staff',
      label: t('menu.owner_staff', 'Company Staff'),
      icon: <Users className="w-4 h-4" />,
      badge: staffList.length
    }
  ];

  return (
    <PortalShell
      portalName={t('portal.owner_title', 'Homtel Landlord ERP')}
      portalSubtitle={t('portal.owner_sub', 'Quản lý vận hành bất động sản')}
      portalIcon={<Building2 className="w-5 h-5 text-blue-400" />}
      roleBadgeText="BUILDING OS"
      roleBadgeColor="bg-blue-500/20 text-blue-300 border-blue-400/30"
      menuItems={menuItems}
      activeTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as any)}
      onOpenSearch={() => setIsCommandPaletteOpen(true)}
      quickAction={{
        label: t('owner.invite_staff', 'Thêm nhân viên'),
        icon: <Plus className="w-4 h-4" />,
        onClick: () => setShowStaffModal(true),
        color: 'bg-blue-600 hover:bg-blue-500 text-white'
      }}
    >
      <div className="space-y-6 pb-16">
        {/* Top Banner */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{t('portal.owner_title', 'Cổng quản lý bất động sản')}</h1>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded text-[11px] border border-blue-200">
                  LANDLORD ERP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Green Living Real Estate • {t('owner.portfolio_occupancy', 'Danh mục tòa nhà, hợp đồng thuê và hóa đơn')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>{t('menu.owner_configs', 'Cấu hình giá điện nước')}</span>
            </button>
            <button
              onClick={() => setShowStaffModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('owner.invite_staff', 'Thêm nhân viên')}</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.portfolio_occupancy', 'Tỷ lệ lấp đầy')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{occupancyRate}%</span>
              <span className="text-xs text-emerald-600 font-semibold">{occupiedUnits} / {totalUnits} {t('owner.occupied', 'Đang ở')}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${occupancyRate}%` }} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.pending_apps', 'Hồ sơ chờ duyệt')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">{pendingApps}</span>
              <span className="text-xs text-slate-500 font-medium">{applications.length} {t('owner.total_apps', 'Tổng')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{t('owner.requires_review', 'Cần duyệt & kích hoạt hợp đồng')}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.active_leases', 'Hợp đồng & Tiền cọc')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-indigo-600">{contracts.filter(c => c.status === 'ACTIVE').length}</span>
              <span className="text-xs text-slate-500 font-medium">{contracts.length} {t('owner.total_contracts', 'Hợp đồng')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{t('owner.held_in_escrow', 'Tiền cọc giữ an toàn')}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.collected_revenue', 'Doanh thu thu về')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-600">
                {(totalPaidRevenue / 1000000).toFixed(1)}M <span className="text-xs font-normal">VND</span>
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">{t('owner.settled', 'Đã quyết toán')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{invoices.length} {t('owner.invoices_generated', 'hóa đơn đã tạo')}</div>
          </div>
        </div>

        {/* TAB 0: TODAY COCKPIT */}
        {activeTab === 'today' && (
          <TodayCockpit
            onSelectRoom={(roomId) => setActiveRoom360Id(roomId)}
            onOpenMeterModal={(r) => setSelectedRoomForBilling(r)}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* TAB 0.1: ACTION CENTER */}
        {activeTab === 'actions' && (
          <ActionCenterView
            onSelectRoom={(roomId) => setActiveRoom360Id(roomId)}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* TAB 0.2: BUILDING 360 */}
        {activeTab === 'building360' && (
          <Building360View
            buildings={buildings}
            initialBuildingId={selectedBuildingId}
            onSelectRoom={(roomId) => setActiveRoom360Id(roomId)}
            onOpenMeterModal={(r) => setSelectedRoomForBilling(r)}
          />
        )}

        {/* TAB 1: Rooms & Meter Billing Trigger */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">{t('owner.inventory_title', 'Danh sách Căn hộ & Trạng thái')}</h3>
              <p className="text-xs text-slate-500">{t('owner.inventory_sub', 'Ghi chỉ số công tơ và xuất hóa đơn hàng tháng cho từng phòng')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('owner.room', 'Căn hộ')}</th>
                  <th className="p-3">{t('owner.building', 'Tòa nhà')}</th>
                  <th className="p-3">{t('owner.type_area', 'Loại & Diện tích')}</th>
                  <th className="p-3">{t('owner.base_rent', 'Giá thuê gốc')}</th>
                  <th className="p-3">{t('status.status', 'Trạng thái')}</th>
                  <th className="p-3 text-right">{t('common.actions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <button
                        onClick={() => setActiveRoom360Id(r.id)}
                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                        title="Mở hồ sơ Room 360"
                      >
                        <span>{t('explorer.room_number', 'Phòng')} {r.room_number}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-600 rounded border border-blue-200">360</span>
                      </button>
                    </td>
                    <td className="p-3 text-slate-600">{r.building_name} ({t('explorer.floor', 'Tầng')} {r.floor_number})</td>
                    <td className="p-3 capitalize">{r.room_type.replace('_', ' ').toLowerCase()} • {r.area}m²</td>
                    <td className="p-3 font-bold text-slate-800">{r.base_rent.toLocaleString()} VND</td>
                    <td className="p-3">
                      <select
                        value={r.status}
                        onChange={e => handleToggleRoomStatus(r, e.target.value)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                          r.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                          r.status === 'OCCUPIED' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                          'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        <option value="AVAILABLE">{t('status.available', 'Còn trống')}</option>
                        <option value="OCCUPIED">{t('status.occupied', 'Đang có khách')}</option>
                        <option value="RESERVED">{t('status.reserved', 'Đã đặt cọc')}</option>
                        <option value="MAINTENANCE">{t('status.maintenance', 'Đang bảo trì')}</option>
                      </select>
                    </td>
                    <td className="p-3 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => setActiveRoom360Id(r.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                      >
                        Room 360
                      </button>
                      <button
                        onClick={() => setSelectedRoomForBilling(r)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg border border-blue-200 inline-flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        {t('owner.meter_invoice', 'Ghi số & Hóa đơn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Applications Review */}
      {activeTab === 'applications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">{t('owner.applications_title', 'Hồ sơ đăng ký thuê căn hộ')}</h3>
            <p className="text-xs text-slate-500">{t('owner.applications_sub', 'Duyệt hồ sơ sẽ tự động chuyển trạng thái phòng và tạo hợp đồng thuê')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('owner.applicant_name', 'Khách đăng ký')}</th>
                  <th className="p-3">{t('owner.target_room', 'Phòng thuê')}</th>
                  <th className="p-3">{t('owner.start_date', 'Ngày bắt đầu')}</th>
                  <th className="p-3">{t('owner.duration', 'Thời hạn')}</th>
                  <th className="p-3">{t('status.status', 'Trạng thái')}</th>
                  <th className="p-3 text-right">{t('common.review', 'Xét duyệt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{a.tenant_name || 'Applicant'}</div>
                      <div className="text-[11px] text-slate-400">{a.tenant_email} • {a.tenant_phone}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-blue-600">{t('explorer.room_number', 'Phòng')} {a.room_number}</span>
                      <div className="text-[11px] text-slate-400">{a.building_name}</div>
                    </td>
                    <td className="p-3">{a.intended_start_date}</td>
                    <td className="p-3 font-semibold">{a.lease_duration_months} {t('common.months', 'Tháng')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {a.status === 'APPROVED' ? t('status.approved', 'Đã duyệt') :
                         a.status === 'PENDING' ? t('status.pending', 'Chờ xử lý') :
                         t('status.rejected', 'Từ chối')}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {a.status === 'PENDING' ? (
                        <button
                          onClick={() => {
                            setReviewingApp(a);
                            setReviewDecision('APPROVED');
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                        >
                          {t('owner.review_decide', 'Xem xét & Quyết định')}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{t('owner.reviewed', 'Đã duyệt')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Contracts & Leases */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">{t('owner.contracts_title', 'Hợp đồng hiệu lực & Tiền cọc ký quỹ')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('owner.contract_no', 'Mã HĐ')}</th>
                  <th className="p-3">{t('owner.tenant', 'Khách thuê')}</th>
                  <th className="p-3">{t('owner.room', 'Căn hộ')} & {t('owner.building', 'Tòa nhà')}</th>
                  <th className="p-3">{t('owner.term_dates', 'Thời hạn HĐ')}</th>
                  <th className="p-3">{t('owner.rent_mo', 'Giá thuê / tháng')}</th>
                  <th className="p-3">{t('owner.deposit_held', 'Tiền cọc giữ')}</th>
                  <th className="p-3">{t('status.status', 'Trạng thái')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-blue-600">{c.contract_number}</td>
                    <td className="p-3 font-semibold text-slate-900">{c.tenant_name}</td>
                    <td className="p-3">{t('explorer.room_number', 'Phòng')} {c.room_number} • {c.building_name}</td>
                    <td className="p-3 text-slate-600">{c.start_date} → {c.end_date}</td>
                    <td className="p-3 font-bold">{c.rent_amount.toLocaleString()} VND</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{c.deposit_amount.toLocaleString()} VND</span>
                      <span className="ml-1 text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{t('owner.held', 'ĐÃ GIỮ')}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.status === 'ACTIVE' ? t('status.active', 'Đang hiệu lực') : c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Invoices & Billing */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">{t('owner.invoices_title', 'Sổ cái hóa đơn & Thu tiền')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('owner.invoice_no', 'Số hóa đơn')}</th>
                  <th className="p-3">{t('owner.month', 'Kỳ thu')}</th>
                  <th className="p-3">{t('owner.tenant', 'Khách')} & {t('owner.room', 'Phòng')}</th>
                  <th className="p-3">{t('owner.total_amount', 'Tổng tiền')}</th>
                  <th className="p-3">{t('owner.paid_amount', 'Đã thu')}</th>
                  <th className="p-3">{t('owner.outstanding', 'Còn nợ')}</th>
                  <th className="p-3">{t('status.status', 'Trạng thái')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{i.invoice_number}</td>
                    <td className="p-3 font-semibold">{i.billing_month}</td>
                    <td className="p-3">
                      <div>{i.tenant_name}</div>
                      <div className="text-[11px] text-slate-400">{t('explorer.room_number', 'Phòng')} {i.room_number}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-900">{i.total.toLocaleString()} VND</td>
                    <td className="p-3 text-emerald-600 font-semibold">{i.paid_amount.toLocaleString()} VND</td>
                    <td className="p-3 text-amber-600 font-semibold">{i.outstanding_amount.toLocaleString()} VND</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        i.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                        i.status === 'ISSUED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {i.status === 'PAID' ? t('status.paid', 'Đã thanh toán') :
                         i.status === 'ISSUED' ? t('status.issued', 'Đã xuất HĐ') :
                         t('status.unpaid', 'Chưa thanh toán')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Versioned Configs */}
      {activeTab === 'configs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">{t('owner.configs_title', 'Biểu giá dịch vụ điện nước theo phiên bản')}</h3>
              <p className="text-xs text-slate-500">
                {t('owner.configs_sub', 'Mỗi hóa đơn tạo ra sẽ tự động áp dụng bảng giá có hiệu lực trong tháng lập hóa đơn.')}
              </p>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('owner.add_version', 'Thêm phiên bản giá')}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {buildings.map(b => (
              <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('owner.active_schedule', 'Đang áp dụng')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">{t('owner.electricity_rate', 'Giá điện')}</span>
                    <span className="font-bold text-slate-800">3,800 VND / kWh</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">{t('owner.water_rate', 'Giá nước')}</span>
                    <span className="font-bold text-slate-800">18,000 VND / m³</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">{t('owner.internet_service', 'Phí Internet')}</span>
                    <span className="font-bold text-slate-800">250,000 VND / mo</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">{t('owner.motorbike_parking', 'Gửi xe máy')}</span>
                    <span className="font-bold text-slate-800">120,000 VND / mo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Staff Management */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">{t('owner.staff_title', 'Đội ngũ nhân viên tòa nhà')}</h3>
              <p className="text-xs text-slate-500">{t('owner.staff_sub', 'Nhân viên có quyền ghi số điện nước, giao nhận chìa khóa và kiểm tra sự cố')}</p>
            </div>
            <button
              onClick={() => setShowStaffModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('owner.invite_staff', 'Thêm nhân viên')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t('owner.staff_name', 'Họ tên nhân viên')}</th>
                  <th className="p-3">{t('owner.email', 'Email')}</th>
                  <th className="p-3">{t('owner.phone', 'Điện thoại')}</th>
                  <th className="p-3">{t('owner.role', 'Vai trò')}</th>
                  <th className="p-3">{t('status.status', 'Trạng thái')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{s.full_name}</td>
                    <td className="p-3 text-slate-600">{s.email}</td>
                    <td className="p-3 text-slate-600">{s.phone || 'N/A'}</td>
                    <td className="p-3 font-semibold text-teal-600">{s.membership_role || 'STAFF'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {t('status.active', 'Đang hoạt động')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meter & Invoice Modal */}
      {selectedRoomForBilling && (
        <MeterAndInvoiceModal
          room={selectedRoomForBilling}
          onClose={() => setSelectedRoomForBilling(null)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {/* Review Application Modal */}
      {reviewingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">{t('owner.review_modal_title', 'Xét duyệt hồ sơ thuê phòng')}</h3>
            <p className="text-xs text-slate-500">
              {t('explorer.room_number', 'Phòng')} {reviewingApp.room_number} • {reviewingApp.tenant_name} ({reviewingApp.lease_duration_months} {t('common.months', 'Tháng')})
            </p>

            <form onSubmit={handleReviewApplication} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('owner.decision', 'Quyết định')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('APPROVED')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      reviewDecision === 'APPROVED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('owner.approve_btn', 'Duyệt hồ sơ')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('REJECTED')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      reviewDecision === 'REJECTED' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('owner.decline_btn', 'Từ chối')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('owner.review_notes', 'Ghi chú / Lý do phản hồi')}</label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={t('owner.notes_placeholder', 'Ý kiến phản hồi chính thức cho khách thuê...')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingApp(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  {t('btn.cancel', 'Hủy bỏ')}
                </button>
                <button
                  type="submit"
                  disabled={reviewingSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
                >
                  {reviewingSubmitting ? t('common.saving', 'Đang lưu...') : t('owner.confirm_decision', 'Xác nhận quyết định')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">{t('owner.add_staff_title', 'Thêm nhân viên vận hành')}</h3>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            {staffSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-sm">{t('owner.staff_added', 'Đã tạo nhân viên thành công!')}</h4>
              </div>
            ) : (
              <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.full_name', 'Họ và tên')}</label>
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.email', 'Email')}</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.initial_pwd', 'Mật khẩu ban đầu')}</label>
                  <input
                    type="password"
                    required
                    value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.phone_num', 'Số điện thoại')}</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStaffModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
                  >
                    {t('btn.cancel', 'Hủy bỏ')}
                  </button>
                  <button
                    type="submit"
                    disabled={staffSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                  >
                    {staffSubmitting ? t('common.creating', 'Đang tạo...') : t('owner.create_staff_btn', 'Tạo tài khoản nhân viên')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">{t('owner.add_config_title', 'Thêm biểu giá dịch vụ điện nước mới')}</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('owner.target_bldg', 'Tòa nhà áp dụng')}</label>
                <select
                  value={selectedBuildingId}
                  onChange={e => setSelectedBuildingId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.effective_from', 'Ngày bắt đầu áp dụng')}</label>
                  <input
                    type="date"
                    required
                    value={configForm.effective_from}
                    onChange={e => setConfigForm({ ...configForm, effective_from: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.electricity_price', 'Đơn giá điện (VND/kWh)')}</label>
                  <input
                    type="number"
                    value={configForm.electricity_unit_price}
                    onChange={e => setConfigForm({ ...configForm, electricity_unit_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.water_price', 'Đơn giá nước (VND/m³)')}</label>
                  <input
                    type="number"
                    value={configForm.water_unit_price}
                    onChange={e => setConfigForm({ ...configForm, water_unit_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.internet_price', 'Phí Internet (VND/tháng)')}</label>
                  <input
                    type="number"
                    value={configForm.internet_price}
                    onChange={e => setConfigForm({ ...configForm, internet_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
                >
                  {t('btn.cancel', 'Hủy bỏ')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  {t('owner.save_schedule', 'Lưu phiên bản biểu giá')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room 360 Full Profile Slide-over Drawer */}
      <RoomDetailPanel
        roomId={activeRoom360Id}
        isOpen={!!activeRoom360Id}
        onClose={() => setActiveRoom360Id(null)}
        onOpenMeterModal={(r) => {
          setActiveRoom360Id(null);
          setSelectedRoomForBilling(r);
        }}
        onRefresh={fetchData}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectRoom={(id) => setActiveRoom360Id(id)}
        onSelectBuilding={(bid) => {
          setSelectedBuildingId(bid);
          setActiveTab('building360');
        }}
        onNavigateTab={(tab) => setActiveTab(tab as any)}
      />
      </div>
    </PortalShell>
  );
};
