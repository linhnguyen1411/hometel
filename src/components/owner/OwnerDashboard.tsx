import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PortalShell, PortalMenuItem } from '../layout/PortalShell';
import { Room, Building, RentalApplication, RentalContract, Invoice } from '../../types/index';
import { MeterAndInvoiceModal } from './MeterAndInvoiceModal';
import { TodayCockpit } from './TodayCockpit';
import { Building360View } from './Building360View';
import { ActionCenterView } from './ActionCenterView';
import { RoomDetailPanel } from './RoomDetailPanel';
import { CrmDashboardView } from './CrmDashboardView';
import { ConsolidatedPnlView } from './ConsolidatedPnlView';
import { OcrMeterModal } from './OcrMeterModal';
import { CreateBuildingModal } from './CreateBuildingModal';
import { CommandPalette } from '../common/CommandPalette';
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
  Search,
  PieChart,
  Camera,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'today' | 'actions' | 'building360' | 'crm' | 'finance' | 'rooms' | 'applications' | 'contracts' | 'invoices' | 'configs' | 'staff'>('today');
  const [loading, setLoading] = useState(true);

  // Building OS Dialogs & OCR
  const [activeRoom360Id, setActiveRoom360Id] = useState<string | null>(null);
  const [ocrRoom, setOcrRoom] = useState<Room | null>(null);
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

  // New building wizard state
  const [showCreateBuildingModal, setShowCreateBuildingModal] = useState(false);

  // Batch Invoicing state
  const [showBatchInvoiceModal, setShowBatchInvoiceModal] = useState(false);
  const [batchMonth, setBatchMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Contract Renew & Terminate state
  const [renewingContract, setRenewingContract] = useState<RentalContract | null>(null);
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewRentAmount, setRenewRentAmount] = useState<number | undefined>(undefined);
  const [renewLoading, setRenewLoading] = useState(false);

  const [terminatingContract, setTerminatingContract] = useState<RentalContract | null>(null);
  const [terminateReason, setTerminateReason] = useState('Hết hạn hợp đồng');
  const [terminateLoading, setTerminateLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [bRes, rRes, aRes, cRes, iRes] = await Promise.allSettled([
      api.getBuildings(),
      api.getRooms(''),
      api.getApplications(),
      api.getContracts(),
      api.getInvoices()
    ]);
    const buildings = bRes.status === 'fulfilled' ? (Array.isArray(bRes.value) ? bRes.value : []) : [];
    const rooms     = rRes.status === 'fulfilled' ? (Array.isArray(rRes.value) ? rRes.value : []) : [];
    const apps      = aRes.status === 'fulfilled' ? (Array.isArray(aRes.value) ? aRes.value : []) : [];
    const contracts = cRes.status === 'fulfilled' ? (Array.isArray(cRes.value) ? cRes.value : []) : [];
    const invoices  = iRes.status === 'fulfilled' ? (Array.isArray(iRes.value) ? iRes.value : []) : [];
    if (bRes.status === 'rejected') console.warn('buildings:', bRes.reason);
    if (cRes.status === 'rejected') console.warn('contracts:', cRes.reason);
    if (iRes.status === 'rejected') console.warn('invoices:', iRes.reason);
    setBuildings(buildings);
    setRooms(rooms);
    setApplications(apps);
    setContracts(contracts);
    setInvoices(invoices);
    if (buildings.length > 0) {
      setSelectedBuildingId(buildings[0].id);
      const compId = buildings[0].company_id;
      if (compId) {
        api.getCompanyStaff(compId).then(s => setStaffList(Array.isArray(s) ? s : [])).catch(() => {});
      }
    }
    setLoading(false);
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
        api.getCompanyStaff(compId).then(s => setStaffList(Array.isArray(s) ? s : [])).catch(() => {});
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

  const handleGenerateMonthlyInvoices = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await api.generateMonthlyInvoices({ billing_month: batchMonth });
      setBatchResult(`Đã tạo ${(res as any).invoices_created} hóa đơn, bỏ qua ${(res as any).invoices_skipped} phòng đã có hóa đơn.`);
      fetchData();
    } catch (err: any) {
      setBatchResult(err.message || 'Lỗi khi xuất hóa đơn hàng loạt');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleRenewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingContract) return;
    setRenewLoading(true);
    try {
      await api.renewContract(renewingContract.id, {
        newEndDate: renewEndDate,
        newRentAmount: renewRentAmount
      });
      setRenewingContract(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gia hạn hợp đồng');
    } finally {
      setRenewLoading(false);
    }
  };

  const handleTerminateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminatingContract) return;
    setTerminateLoading(true);
    try {
      await api.terminateContract(terminatingContract.id, {
        terminationDate: new Date().toISOString().split('T')[0],
        reason: terminateReason
      });
      setTerminatingContract(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi chấm dứt hợp đồng');
    } finally {
      setTerminateLoading(false);
    }
  };

  // Bulk Excel import building & rooms state
  const [showImportBuildingModal, setShowImportBuildingModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadBuildingTemplate();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải template Excel');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImportLoading(true);
    setImportError(null);
    setImportSuccessMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.importBuildings(formData);
      setImportSuccessMsg(res.message || 'Import tòa nhà thành công!');
      fetchData();
      setTimeout(() => {
        setShowImportBuildingModal(false);
        setImportFile(null);
        setImportSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi import file Excel');
    } finally {
      setImportLoading(false);
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
      id: 'crm',
      label: 'CRM Khách & Lịch hẹn (Leads)',
      icon: <Users className="w-4 h-4 text-purple-400" />
    },
    {
      id: 'finance',
      label: 'Tài chính & P&L (Consolidated P&L)',
      icon: <PieChart className="w-4 h-4 text-emerald-400" />
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              title="Tải file mẫu Excel để nhập hàng loạt"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Tải template Excel</span>
            </button>
            <button
              onClick={() => {
                setShowImportBuildingModal(true);
                setImportError(null);
                setImportSuccessMsg(null);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Import từ Excel</span>
            </button>
            <button
              onClick={() => setShowCreateBuildingModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              <span>Thêm tòa nhà mới</span>
            </button>
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.portfolio_occupancy', 'T? l? l?p d?y')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{occupancyRate}%</span>
              <span className="text-xs text-emerald-600 font-semibold">{occupiedUnits} / {totalUnits} {t('owner.occupied', 'Đang ở')}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${occupancyRate}%` }} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.pending_apps', 'H? so ch? duy?t')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">{pendingApps}</span>
              <span className="text-xs text-slate-500 font-medium">{applications.length} {t('owner.total_apps', 'T?ng')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{t('owner.requires_review', 'Cần duyệt & kích hoạt hợp đồng')}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.active_leases', 'H?p d?ng & Ti?n c?c')}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-indigo-600">{contracts.filter(c => c.status === 'ACTIVE').length}</span>
              <span className="text-xs text-slate-500 font-medium">{contracts.length} {t('owner.total_contracts', 'H?p d?ng')}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{t('owner.held_in_escrow', 'Tiền cọc giữ an toàn')}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">{t('owner.collected_revenue', 'Doanh thu thu v?')}</span>
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

        {/* TAB 0.3: CRM LEADS & ROOM TOURS */}
        {activeTab === 'crm' && (
          <CrmDashboardView onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {/* TAB 0.4: CONSOLIDATED P&L MULTI-BUILDING */}
        {activeTab === 'finance' && (
          <ConsolidatedPnlView buildings={buildings} />
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
                  <th className="p-3">{t('owner.room', 'Can h?')}</th>
                  <th className="p-3">{t('owner.building', 'Tòa nhà')}</th>
                  <th className="p-3">{t('owner.type_area', 'Loại & Diện tích')}</th>
                  <th className="p-3">{t('owner.baseRent', 'Giá thuê gốc')}</th>
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
                        title="M? h? so Room 360"
                      >
                        <span>{t('explorer.roomNumber', 'Phòng')} {r.roomNumber}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-600 rounded border border-blue-200">360</span>
                      </button>
                    </td>
                    <td className="p-3 text-slate-600">{r.buildingName} ({t('explorer.floor', 'T?ng')} {r.floorNumber})</td>
                    <td className="p-3 capitalize">{r.roomType.replace('_', ' ').toLowerCase()} • {r.area}m²</td>
                    <td className="p-3 font-bold text-slate-800">{(r.baseRent ?? (r as any).base_rent)?.toLocaleString() ?? '—'} VND</td>
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
                        onClick={() => setOcrRoom(r)}
                        className="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold rounded-lg border border-purple-200 inline-flex items-center gap-1"
                        title="AI Vision OCR Quét chỉ số"
                      >
                        <Camera className="w-3 h-3 text-purple-600" />
                        <span>AI OCR</span>
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
                  <th className="p-3">{t('owner.duration', 'Th?i h?n')}</th>
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
                      <span className="font-semibold text-blue-600">{t('explorer.roomNumber', 'Phòng')} {a.room_number}</span>
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
                         t('status.rejected', 'T? ch?i')}
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
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-blue-600">{c.contract_number}</td>
                    <td className="p-3 font-semibold text-slate-900">{c.tenant_name}</td>
                    <td className="p-3">{t('explorer.roomNumber', 'Phòng')} {c.room_number} • {c.building_name}</td>
                    <td className="p-3 text-slate-600">{c.start_date} → {c.end_date}</td>
                    <td className="p-3 font-bold">{(c.rent_amount ?? (c as any).rentAmount)?.toLocaleString() ?? '—'} VND</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{(c.deposit_amount ?? (c as any).depositAmount)?.toLocaleString() ?? '—'} VND</span>
                      <span className="ml-1 text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">{t('owner.held', 'ĐÃ GIỮ')}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.status === 'ACTIVE' ? t('status.active', 'Đang hiệu lực') : c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {c.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setRenewingContract(c);
                              setRenewEndDate(c.end_date || '');
                              setRenewRentAmount(c.rent_amount);
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded text-[11px]"
                          >
                            Gia hạn
                          </button>
                          <button
                            onClick={() => {
                              setTerminatingContract(c);
                              setTerminateReason('Hết hạn hợp đồng');
                            }}
                            className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-semibold rounded text-[11px]"
                          >
                            Chấm dứt
                          </button>
                        </div>
                      )}
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
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">{t('owner.invoices_title', 'Sổ cái hóa đơn & Thu tiền')}</h3>
            <button
              onClick={() => {
                setShowBatchInvoiceModal(true);
                setBatchResult(null);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xuất hóa đơn hàng loạt</span>
            </button>
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
                      <div className="text-[11px] text-slate-400">{t('explorer.roomNumber', 'Phòng')} {i.room_number}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-900">{(i.total ?? (i as any).totalAmount)?.toLocaleString() ?? '—'} VND</td>
                    <td className="p-3 text-emerald-600 font-semibold">{(i.paid_amount ?? (i as any).paidAmount)?.toLocaleString() ?? '—'} VND</td>
                    <td className="p-3 text-amber-600 font-semibold">{(i.outstanding_amount ?? (i as any).outstandingAmount)?.toLocaleString() ?? '—'} VND</td>
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
              {t('explorer.roomNumber', 'Phòng')} {reviewingApp.room_number} • {reviewingApp.tenant_name} ({reviewingApp.lease_duration_months} {t('common.months', 'Tháng')})
            </p>

            <form onSubmit={handleReviewApplication} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('owner.decision', 'Quy?t d?nh')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('APPROVED')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      reviewDecision === 'APPROVED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('owner.approve_btn', 'Duy?t h? so')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('REJECTED')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      reviewDecision === 'REJECTED' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {t('owner.decline_btn', 'T? ch?i')}
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
                  {t('btn.cancel', 'H?y b?')}
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
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.initial_pwd', 'M?t kh?u ban d?u')}</label>
                  <input
                    type="password"
                    required
                    value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('owner.phone_num', 'S? di?n tho?i')}</label>
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
                    {t('btn.cancel', 'H?y b?')}
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
                  {t('btn.cancel', 'H?y b?')}
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
        onOpenOcrModal={(r) => {
          setActiveRoom360Id(null);
          setOcrRoom(r);
        }}
        onRefresh={fetchData}
      />

      {/* AI OCR Meter Reading Modal */}
      <OcrMeterModal
        isOpen={!!ocrRoom}
        onClose={() => setOcrRoom(null)}
        room={ocrRoom}
        onSuccess={fetchData}
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

      {/* Create Building Wizard Modal */}
      <CreateBuildingModal
        isOpen={showCreateBuildingModal}
        onClose={() => setShowCreateBuildingModal(false)}
        onSuccess={(newBuildingId) => {
          setSelectedBuildingId(newBuildingId);
          fetchData();
        }}
      />

      {/* Batch Invoicing Modal */}
      {showBatchInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Xuất hóa đơn tự động hàng loạt</h3>
              <button onClick={() => setShowBatchInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <p className="text-xs text-slate-500">
              Hệ thống sẽ quét toàn bộ hợp đồng đang ACTIVE và tự động sinh hóa đơn nháp (DRAFT) kèm tiền phòng và biểu phí dịch vụ cho tháng được chọn.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kỳ hóa đơn (YYYY-MM)</label>
                <input
                  type="month"
                  value={batchMonth}
                  onChange={e => setBatchMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {batchResult && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-medium">
                  {batchResult}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchInvoiceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={handleGenerateMonthlyInvoices}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {batchLoading ? 'Đang xuất hóa đơn...' : 'Xác nhận tạo hóa đơn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Contract Modal */}
      {renewingContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Gia hạn hợp đồng thuê</h3>
              <button onClick={() => setRenewingContract(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <p className="text-xs text-slate-500">
              Hợp đồng #{renewingContract.contract_number} - Khách: {renewingContract.tenant_name}
            </p>

            <form onSubmit={handleRenewContract} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày kết thúc mới (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={renewEndDate}
                  onChange={e => setRenewEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giá thuê mới (VND) (Để trống nếu giữ nguyên)</label>
                <input
                  type="number"
                  step={100000}
                  value={renewRentAmount || ''}
                  onChange={e => setRenewRentAmount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  placeholder={renewingContract.rent_amount.toString()}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewingContract(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={renewLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {renewLoading ? 'Đang lưu...' : 'Xác nhận gia hạn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminate Contract Modal */}
      {terminatingContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Chấm dứt hợp đồng thuê</h3>
              <button onClick={() => setTerminatingContract(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <p className="text-xs text-red-500">
              Cảnh báo: Khi chấm dứt hợp đồng, trạng thái phòng sẽ được tự động chuyển về AVAILABLE (Còn trống) để tiếp tục cho thuê.
            </p>

            <form onSubmit={handleTerminateContract} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do chấm dứt</label>
                <textarea
                  rows={2}
                  required
                  value={terminateReason}
                  onChange={e => setTerminateReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTerminatingContract(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={terminateLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {terminateLoading ? 'Đang xử lý...' : 'Xác nhận chấm dứt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Building & Rooms Modal */}
      {showImportBuildingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Import Tòa nhà & Phòng từ Excel</h3>
                  <p className="text-xs text-slate-500">Tạo tự động Tòa nhà → Tầng → Phòng & Đồng hồ đo</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportBuildingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {importError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div className="p-4 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl text-center space-y-2 bg-slate-50/50 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-semibold text-slate-700">Chọn file dữ liệu Excel (.xlsx)</p>
                <p className="text-[11px] text-slate-400">Nếu chưa có định dạng, hãy tải template mẫu trước.</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file Excel mẫu (.xlsx)</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportBuildingModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={importLoading || !importFile}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {importLoading ? 'Đang kiểm tra & import...' : 'Tiến hành Import'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PortalShell>
  );
};
