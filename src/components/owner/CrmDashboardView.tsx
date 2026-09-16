import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import {
  Users,
  Calendar,
  Phone,
  Mail,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Home,
  Check,
  X,
  Search,
  Filter,
  Plus,
  Sparkles,
  DollarSign,
  UserCheck,
  Star
} from 'lucide-react';

interface CrmDashboardViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const CrmDashboardView: React.FC<CrmDashboardViewProps> = ({ onNavigateTab }) => {
  const { t } = useLanguage();
  const [data, setData] = useState<{ leads: any[]; funnel: any }>({ leads: [], funnel: {} });
  const [tours, setTours] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'leads' | 'tours'>('leads');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    source: 'WEBSITE',
    budgetMin: 7000000,
    budgetMax: 12000000,
    preferredRoomType: 'STUDIO',
    notes: ''
  });

  const [tourModalLead, setTourModalLead] = useState<any | null>(null);
  const [tourForm, setTourForm] = useState({
    roomId: '',
    scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString().substring(0, 16)
  });

  const [convertModalLead, setConvertModalLead] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({
    roomId: '',
    intendedStartDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().substring(0, 10),
    leaseDurationMonths: 12
  });

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const [crmRes, tourRes, roomRes] = await Promise.all([
        api.getCrmLeads(`status=${filterStatus}&search=${encodeURIComponent(searchQuery)}`),
        api.getCrmTours(''),
        api.getRooms('')
      ]);
      setData(crmRes);
      setTours(tourRes);
      setRooms(roomRes);
      if (roomRes.length > 0 && !tourForm.roomId) {
        setTourForm(prev => ({ ...prev, roomId: roomRes[0].id }));
        setConvertForm(prev => ({ ...prev, roomId: roomRes[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, [filterStatus, searchQuery]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCrmLead(newLeadForm);
      setShowAddLeadModal(false);
      setNewLeadForm({
        fullName: '',
        phone: '',
        email: '',
        source: 'WEBSITE',
        budgetMin: 7000000,
        budgetMax: 12000000,
        preferredRoomType: 'STUDIO',
        notes: ''
      });
      fetchCrmData();
    } catch (err: any) {
      alert(err.message || 'Lỗi thêm khách hàng');
    }
  };

  const handleScheduleTour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourModalLead) return;
    try {
      await api.scheduleCrmTour({
        leadId: tourModalLead.id,
        roomId: tourForm.roomId,
        scheduledAt: tourForm.scheduledAt
      });
      setTourModalLead(null);
      fetchCrmData();
    } catch (err: any) {
      alert(err.message || 'Lỗi đặt lịch xem phòng');
    }
  };

  const handleCompleteTour = async (tourId: string, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      await api.completeCrmTour(tourId, {
        status,
        rating: status === 'COMPLETED' ? 5 : undefined,
        feedback: status === 'COMPLETED' ? 'Khách hàng đánh giá phòng ưng ý, đang cân nhắc cọc' : 'Khách bận đột xuất'
      });
      fetchCrmData();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật lịch xem phòng');
    }
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertModalLead) return;
    try {
      await api.convertCrmLead(convertModalLead.id, convertForm);
      alert('Chuyển đổi thành công! Hồ sơ đăng ký thuê đã được khởi tạo trong hệ thống.');
      setConvertModalLead(null);
      fetchCrmData();
      if (onNavigateTab) onNavigateTab('applications');
    } catch (err: any) {
      alert(err.message || 'Lỗi chuyển đổi khách hàng');
    }
  };

  const funnel = data.funnel || { TOTAL: 0, NEW: 0, TOUR_SCHEDULED: 0, TOUR_COMPLETED: 0, CONVERTED: 0 };

  return (
    <div className="space-y-6">
      {/* Funnel Bento Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Tổng khách tiềm năng</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{funnel.TOTAL || 0}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Tất cả các nguồn</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Khách mới (New)</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">{funnel.NEW || 0}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Cần gọi điện tư vấn</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Lịch hẹn xem phòng</span>
          <span className="text-2xl font-black text-purple-600 mt-1 block">{funnel.TOUR_SCHEDULED || 0}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Đang chờ đón tiếp</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Đã xem phòng</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{funnel.TOUR_COMPLETED || 0}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Chờ quyết định ký</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">Chốt hợp đồng</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{funnel.CONVERTED || 0}</span>
          <span className="text-[10px] text-slate-400 mt-1 block">Đã tạo đơn thuê</span>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        {/* Top bar controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSubTab('leads')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === 'leads'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Khách tiềm năng ({data.leads.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('tours')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeSubTab === 'tours'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Lịch hẹn xem phòng ({tours.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddLeadModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shadow-blue-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm khách mới</span>
            </button>
          </div>
        </div>

        {/* Filter pills & Search */}
        {activeSubTab === 'leads' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'NEW', label: 'Khách mới' },
                { id: 'TOUR_SCHEDULED', label: 'Có lịch hẹn' },
                { id: 'TOUR_COMPLETED', label: 'Đã xem phòng' },
                { id: 'CONVERTED', label: 'Đã ký hợp đồng' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterStatus === f.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, SĐT khách..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 text-slate-800"
              />
            </div>
          </div>
        )}

        {/* Tab 1: Leads Table */}
        {activeSubTab === 'leads' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Họ tên & Liên hệ</th>
                  <th className="p-3">Nguồn</th>
                  <th className="p-3">Nhu cầu & Ngân sách</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Ghi chú</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">{lead.full_name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>{lead.phone}</span>
                        {lead.email && <span>• {lead.email}</span>}
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                        {lead.source}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="font-semibold text-slate-800 block">{lead.preferred_room_type || 'Bất kỳ'}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {lead.budget_min ? `${(lead.budget_min / 1000000).toFixed(1)}M - ${(lead.budget_max / 1000000).toFixed(1)}M đ` : 'Chưa rõ'}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        lead.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-800' :
                        lead.status === 'TOUR_SCHEDULED' ? 'bg-purple-100 text-purple-800' :
                        lead.status === 'TOUR_COMPLETED' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {lead.status}
                      </span>
                    </td>

                    <td className="p-3 max-w-xs text-slate-500 truncate">
                      {lead.notes || '—'}
                    </td>

                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {lead.status !== 'CONVERTED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setTourModalLead(lead)}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-[11px]"
                          >
                            Hẹn xem
                          </button>

                          <button
                            type="button"
                            onClick={() => setConvertModalLead(lead)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px]"
                          >
                            Tạo đơn thuê
                          </button>
                        </>
                      )}
                      {lead.status === 'CONVERTED' && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> Đã chốt
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {data.leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Không có khách hàng tiềm năng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Tours Table */}
        {activeSubTab === 'tours' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Thời gian hẹn</th>
                  <th className="p-3">Khách xem phòng</th>
                  <th className="p-3">Căn hộ & Tòa nhà</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Phản hồi / Đánh giá</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tours.map(tour => (
                  <tr key={tour.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {tour.scheduled_at.replace('T', ' ')}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 block">{tour.lead_name}</span>
                      <span className="text-[11px] font-mono text-slate-400">{tour.lead_phone}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-blue-600 block">Phòng {tour.room_number}</span>
                      <span className="text-[11px] text-slate-400">{tour.building_name}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tour.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        tour.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {tour.status}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs text-slate-500">
                      {tour.feedback ? (
                        <div>
                          <p className="truncate">{tour.feedback}</p>
                          {tour.rating && (
                            <span className="text-amber-500 font-bold text-[10px] flex items-center gap-0.5">
                              ★ {tour.rating}/5
                            </span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {tour.status === 'SCHEDULED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCompleteTour(tour.id, 'COMPLETED')}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded hover:bg-emerald-100 text-[11px]"
                          >
                            Hoàn thành
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompleteTour(tour.id, 'CANCELLED')}
                            className="px-2.5 py-1 bg-red-50 text-red-700 font-bold rounded hover:bg-red-100 text-[11px]"
                          >
                            Hủy hẹn
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {tours.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Chưa có lịch hẹn xem phòng nào được tạo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Thêm khách mới */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900">Thêm khách hàng tiềm năng</h4>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={newLeadForm.fullName}
                  onChange={e => setNewLeadForm({ ...newLeadForm, fullName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Số điện thoại *</label>
                  <input
                    type="tel"
                    required
                    value={newLeadForm.phone}
                    onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    placeholder="+84 905..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    placeholder="email@gmail.com"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nguồn khách</label>
                  <select
                    value={newLeadForm.source}
                    onChange={e => setNewLeadForm({ ...newLeadForm, source: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                  >
                    <option value="WEBSITE">Website Homtel</option>
                    <option value="FACEBOOK">Facebook / Ads</option>
                    <option value="ZALO">Zalo OA</option>
                    <option value="HOTLINE">Hotline</option>
                    <option value="REFERRAL">Giới thiệu</option>
                    <option value="WALK_IN">Đến trực tiếp</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Loại căn tìm kiếm</label>
                  <select
                    value={newLeadForm.preferredRoomType}
                    onChange={e => setNewLeadForm({ ...newLeadForm, preferredRoomType: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                  >
                    <option value="STUDIO">Studio</option>
                    <option value="ONE_BEDROOM">1 Phòng ngủ</option>
                    <option value="TWO_BEDROOM">2 Phòng ngủ</option>
                    <option value="PENTHOUSE">Penthouse</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ghi chú nhu cầu</label>
                <textarea
                  rows={2}
                  value={newLeadForm.notes}
                  onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  placeholder="Cần vào ở đầu tháng, có nuôi mèo..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                >
                  Lưu khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Đặt lịch xem phòng */}
      {tourModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Đặt lịch hẹn xem phòng</h4>
                <p className="text-[11px] text-slate-500">Khách hàng: {tourModalLead.full_name} ({tourModalLead.phone})</p>
              </div>
              <button onClick={() => setTourModalLead(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleTour} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Chọn căn hộ xem phòng *</label>
                <select
                  required
                  value={tourForm.roomId}
                  onChange={e => setTourForm({ ...tourForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Phòng {r.room_number} • {r.room_type} ({r.base_rent?.toLocaleString()} đ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Thời gian xem phòng *</label>
                <input
                  type="datetime-local"
                  required
                  value={tourForm.scheduledAt}
                  onChange={e => setTourForm({ ...tourForm, scheduledAt: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTourModalLead(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
                >
                  Xác nhận lịch hẹn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Chuyển thành hồ sơ thuê phòng (Lead -> Application) */}
      {convertModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Chuyển thành hồ sơ thuê phòng</h4>
                <p className="text-[11px] text-slate-500">Khởi tạo hồ sơ cho: {convertModalLead.full_name}</p>
              </div>
              <button onClick={() => setConvertModalLead(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertLead} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Căn hộ đăng ký thuê *</label>
                <select
                  required
                  value={convertForm.roomId}
                  onChange={e => setConvertForm({ ...convertForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Phòng {r.room_number} • {r.room_type} ({r.base_rent?.toLocaleString()} đ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ngày bắt đầu thuê *</label>
                  <input
                    type="date"
                    required
                    value={convertForm.intendedStartDate}
                    onChange={e => setConvertForm({ ...convertForm, intendedStartDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Thời hạn (Tháng)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={convertForm.leaseDurationMonths}
                    onChange={e => setConvertForm({ ...convertForm, leaseDurationMonths: parseInt(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConvertModalLead(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                >
                  Tạo đơn đăng ký thuê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
