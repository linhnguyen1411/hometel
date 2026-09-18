import React from 'react';
import { Building360Data } from '../../types/index';
import { useLanguage } from '../../context/LanguageContext';
import { User, Zap, Droplets, ArrowRight } from 'lucide-react';

interface BuildingGridViewProps {
  data: Building360Data;
  onSelectRoom: (roomId: string) => void;
  filterStatus?: string;
  searchQuery?: string;
  onOpenMeterModal?: (room: any) => void;
}

export const BuildingGridView: React.FC<BuildingGridViewProps> = ({
  data,
  onSelectRoom,
  filterStatus = 'ALL',
  searchQuery = '',
  onOpenMeterModal
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {data.floors.map((floor) => {
        const filteredRooms = floor.rooms.filter((r) => {
          const matchStatus = filterStatus === 'ALL' || r.healthStatus === filterStatus;
          const matchSearch =
            !searchQuery ||
            r.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.tenant_name && r.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchStatus && matchSearch;
        });

        if (filteredRooms.length === 0 && (filterStatus !== 'ALL' || searchQuery)) {
          return null;
        }

        const floorOccupied = floor.rooms.filter(r => r.status === 'OCCUPIED').length;
        const floorTotal = floor.rooms.length;
        const floorRate = floorTotal > 0 ? Math.round((floorOccupied / floorTotal) * 100) : 0;

        return (
          <div key={floor.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            {/* Floor Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-xs">
                  TẦNG {floor.floor_number}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{floor.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {floor.rooms.length} phòng • Đang ở: {floorOccupied}/{floorTotal} ({floorRate}%)
                  </p>
                </div>
              </div>

              <div className="w-44 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${floorRate}%` }}
                />
              </div>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const colorClasses =
                  room.healthStatus === 'CRITICAL'
                    ? 'border-red-300 bg-red-50/40 hover:bg-red-50/80 text-red-950 shadow-xs shadow-red-500/10'
                    : room.healthStatus === 'ATTENTION'
                    ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/80 text-amber-950'
                    : room.healthStatus === 'AVAILABLE'
                    ? 'border-sky-200 bg-sky-50/30 hover:bg-sky-50/70 text-sky-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900 shadow-xs';

                const dotColor =
                  room.healthStatus === 'CRITICAL'
                    ? 'bg-red-500'
                    : room.healthStatus === 'ATTENTION'
                    ? 'bg-amber-400'
                    : room.healthStatus === 'AVAILABLE'
                    ? 'bg-sky-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-150 relative group flex flex-col justify-between ${colorClasses}`}
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                          <span className="font-mono font-black text-sm">{room.room_number}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {room.area}m²
                        </span>
                      </div>

                      {/* Content */}
                      <div className="mt-2 text-[11px] leading-tight space-y-1">
                        {room.tenant_name ? (
                          <span className="font-bold text-slate-900 block truncate flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{room.tenant_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic block">Phòng trống</span>
                        )}

                        <span className="text-blue-600 font-bold font-mono block">
                          {(room.baseRent ?? room.base_rent)?.toLocaleString() ?? '—'} đ
                        </span>
                      </div>
                    </div>

                    {/* Bottom Health Tag */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 truncate flex items-center justify-between">
                      <span className="truncate">{room.healthReason}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
