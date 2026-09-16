import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { Building360Data, Building } from '../../types/index.js';
import { BuildingFacadeView } from './BuildingFacadeView.js';
import { BuildingGridView } from './BuildingGridView.js';
import {
  Building2,
  Home,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  DollarSign,
  TrendingUp,
  Layers,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Zap,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';

interface Building360ViewProps {
  buildings: Building[];
  initialBuildingId?: string;
  onSelectRoom: (roomId: string) => void;
  onOpenMeterModal: (room: any) => void;
}

export const Building360View: React.FC<Building360ViewProps> = ({
  buildings,
  initialBuildingId,
  onSelectRoom,
  onOpenMeterModal
}) => {
  const { t } = useLanguage();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    initialBuildingId || (buildings.length > 0 ? buildings[0].id : '')
  );
  const [data, setData] = useState<Building360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'facade' | 'grid'>('facade');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialBuildingId) {
      setSelectedBuildingId(initialBuildingId);
    } else if (!selectedBuildingId && buildings.length > 0) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [initialBuildingId, buildings]);

  useEffect(() => {
    if (!selectedBuildingId) return;

    setLoading(true);
    api.getBuilding360(selectedBuildingId)
      .then(res => setData(res))
      .catch(err => console.error('Error fetching Building 360:', err))
      .finally(() => setLoading(false));
  }, [selectedBuildingId]);

  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);

  return (
    <div className="space-y-6">
      {/* Top Selector & Overview */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {data?.building?.name || activeBuilding?.name || 'Tòa nhà'}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase">
                BUILDING 360
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.building?.address}, {data?.building?.city} • Công ty: {data?.building?.company_name || 'Homtel Group'}
            </p>
          </div>
        </div>

        {/* Building Switcher Dropdown */}
        {buildings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Chọn tòa nhà:</span>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold outline-hidden focus:border-blue-500"
            >
              {buildings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Building Bento Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold block">Tỷ lệ lấp đầy</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{data.summary.occupancyRate}%</span>
              <span className="text-xs text-slate-500">
                ({data.summary.occupiedRooms}/{data.summary.totalRooms} căn)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${data.summary.occupancyRate}%` }}
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold block">Tiền thu phí tháng</span>
            <div className="mt-1">
              <span className="text-xl font-black text-emerald-600 block">
                {data.summary.totalCollected.toLocaleString()} VND
              </span>
              <span className="text-xs text-slate-400">
                Đã thu {data.summary.collectionRate}% (Nợ: {data.summary.totalOutstanding.toLocaleString()} VND)
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold block">Phòng có sự cố / Quá hạn</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${data.summary.criticalRooms > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {data.summary.criticalRooms}
              </span>
              <span className="text-xs text-slate-500">căn hộ</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">
              {data.summary.criticalRooms > 0 ? 'Cần xử lý nhắc nợ hoặc sửa chữa' : 'Toàn bộ phòng bình thường'}
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs font-semibold block">Phiếu bảo trì đang mở</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-600">
                {data.summary.openWorkOrdersCount}
              </span>
              <span className="text-xs text-slate-500">phiếu</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">Kỹ thuật viên đang xử lý</span>
          </div>
        </div>
      )}

      {/* View Switcher & Filter Controls Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Sơ đồ tổng quan tòa nhà (Building Digital Twin)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chuyển đổi linh hoạt giữa mặt đứng kiến trúc trực quan và sơ đồ lưới mặt bằng phân tầng.
            </p>
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('facade')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'facade'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Mặt đứng (Facade)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Sơ đồ lưới (Grid)</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'HEALTHY', label: '🟢 Ổn định' },
              { id: 'CRITICAL', label: '🔴 Cần xử lý' },
              { id: 'ATTENTION', label: '🟡 Bảo trì / Lưu ý' },
              { id: 'AVAILABLE', label: '🔵 Phòng trống' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterStatus === f.id
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/20'
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
              placeholder="Tìm số phòng hoặc cư dân..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:border-blue-500 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 bg-white rounded-3xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Đang tải thông tin tòa nhà...</span>
        </div>
      )}

      {/* Main Visual Display (Facade vs Grid) */}
      {!loading && data && (
        <div>
          {viewMode === 'facade' ? (
            <BuildingFacadeView
              data={data}
              onSelectRoom={onSelectRoom}
              filterStatus={filterStatus}
              searchQuery={searchQuery}
            />
          ) : (
            <BuildingGridView
              data={data}
              onSelectRoom={onSelectRoom}
              filterStatus={filterStatus}
              searchQuery={searchQuery}
              onOpenMeterModal={onOpenMeterModal}
            />
          )}
        </div>
      )}
    </div>
  );
};
