import React, { useState } from 'react';
import { Building360Data } from '../../types/index.js';
import { useLanguage } from '../../context/LanguageContext.js';
import {
  Building2,
  Home,
  Zap,
  Droplets,
  Wrench,
  AlertTriangle,
  User,
  Shield,
  Layers,
  Sparkles,
  Info,
  Car,
  ChevronRight
} from 'lucide-react';

interface BuildingFacadeViewProps {
  data: Building360Data;
  onSelectRoom: (roomId: string) => void;
  filterStatus?: string;
  searchQuery?: string;
}

export const BuildingFacadeView: React.FC<BuildingFacadeViewProps> = ({
  data,
  onSelectRoom,
  filterStatus = 'ALL',
  searchQuery = ''
}) => {
  const { t } = useLanguage();
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Reverse floors array so highest floor is at the top of the architectural facade
  const sortedFloors = [...data.floors].sort((a, b) => b.floor_number - a.floor_number);
  const maxFloorNumber = data.floors.length > 0 ? Math.max(...data.floors.map(f => f.floor_number)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Facade Architectural Canvas */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl text-white relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Facade Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                ARCHITECTURAL FACADE
              </span>
              <span className="text-xs text-slate-400">Mặt đứng trực quan</span>
            </div>
            <h3 className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span>{data.building.name}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.floors.length} tầng nổi • {data.summary.totalRooms} căn hộ • Tỷ lệ lấp đầy: {data.summary.occupancyRate}%
            </p>
          </div>

          {/* Color Indicators */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span className="text-slate-300 text-[11px] font-medium">Đang ở</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
              <span className="text-slate-300 text-[11px] font-medium">Sự cố / Nợ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
              <span className="text-slate-300 text-[11px] font-medium">Bảo trì / Sắp hết hạn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
              <span className="text-slate-300 text-[11px] font-medium">Phòng trống</span>
            </div>
          </div>
        </div>

        {/* Building Architectural Silhouette */}
        <div className="mt-8 max-w-5xl mx-auto relative z-10">
          {/* ROOFTOP / CROWN */}
          <div className="relative mx-auto w-11/12 border-b-2 border-slate-700/80 pb-3 flex items-center justify-between px-6 bg-slate-800/30 rounded-t-3xl border-t border-x border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                ROOFTOP & SKY GARDEN TERRACE
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-700/60 font-mono">Bể bơi vô cực</span>
              <span className="px-2 py-0.5 rounded bg-slate-700/60 font-mono">Hệ thống pin mặt trời</span>
            </div>
          </div>

          {/* FACADE FLOORS (Top to Bottom) */}
          <div className="bg-slate-950/70 border-x-2 border-slate-700/80 p-4 sm:p-6 space-y-4 shadow-inner">
            {sortedFloors.map((floor) => {
              const rooms = floor.rooms.filter(r => {
                const matchStatus = filterStatus === 'ALL' || r.healthStatus === filterStatus;
                const matchSearch =
                  !searchQuery ||
                  r.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (r.tenant_name && r.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()));
                return matchStatus && matchSearch;
              });

              return (
                <div
                  key={floor.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 transition-all hover:border-slate-700 flex flex-col md:flex-row md:items-center gap-3"
                >
                  {/* Floor Spine Badge */}
                  <div className="w-full md:w-32 shrink-0 flex items-center justify-between md:flex-col md:items-start border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0 md:pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-blue-900/50 border border-blue-700/50 text-blue-300 font-mono font-black text-xs">
                        TẦNG {floor.floor_number}
                      </span>
                      {floor.floor_number === maxFloorNumber && maxFloorNumber > 1 && (
                        <span className="text-[10px] font-bold text-amber-400 uppercase">Top Floor</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 truncate">
                      {floor.name}
                    </span>
                  </div>

                  {/* Rooms on this floor (Window Bays) */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {floor.rooms.map((room) => {
                      const isMatch =
                        (filterStatus === 'ALL' || room.healthStatus === filterStatus) &&
                        (!searchQuery ||
                          room.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (room.tenant_name && room.tenant_name.toLowerCase().includes(searchQuery.toLowerCase())));

                      const isOccupied = room.status === 'OCCUPIED';

                      // Architectural styling by healthStatus
                      let borderColor = 'border-slate-700/80';
                      let bgColor = 'bg-slate-800/50';
                      let glowColor = '';
                      let statusText = 'Ổn định';
                      let dotColor = 'bg-emerald-400';

                      if (room.healthStatus === 'CRITICAL') {
                        borderColor = 'border-red-500/80';
                        bgColor = 'bg-red-950/40 hover:bg-red-900/40';
                        glowColor = 'shadow-md shadow-red-500/20';
                        statusText = 'Sự cố / Nợ';
                        dotColor = 'bg-red-500';
                      } else if (room.healthStatus === 'ATTENTION') {
                        borderColor = 'border-amber-500/80';
                        bgColor = 'bg-amber-950/40 hover:bg-amber-900/40';
                        glowColor = 'shadow-md shadow-amber-500/20';
                        statusText = 'Lưu ý';
                        dotColor = 'bg-amber-400';
                      } else if (room.healthStatus === 'AVAILABLE') {
                        borderColor = 'border-sky-500/60';
                        bgColor = 'bg-sky-950/30 hover:bg-sky-900/30';
                        statusText = 'Trống';
                        dotColor = 'bg-sky-400';
                      } else {
                        // Healthy occupied
                        borderColor = 'border-emerald-500/60';
                        bgColor = 'bg-emerald-950/30 hover:bg-emerald-900/30';
                        glowColor = 'shadow-xs shadow-emerald-500/10';
                        dotColor = 'bg-emerald-400';
                      }

                      return (
                        <div
                          key={room.id}
                          onClick={() => onSelectRoom(room.id)}
                          onMouseEnter={() => setHoveredRoomId(room.id)}
                          onMouseLeave={() => setHoveredRoomId(null)}
                          className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${borderColor} ${bgColor} ${glowColor} ${
                            !isMatch ? 'opacity-30 grayscale' : 'opacity-100'
                          }`}
                        >
                          {/* Facade Window Top Bar */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${dotColor} ${room.healthStatus === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                              <span className="font-mono font-black text-sm text-white group-hover:text-blue-300 transition-colors">
                                {room.room_number}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {room.area}m²
                            </span>
                          </div>

                          {/* Architectural Balcony / Bay Preview */}
                          <div className="mt-2 text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-slate-300">
                              <span className="truncate font-semibold max-w-[100px]">
                                {room.tenant_name || <span className="text-slate-500 italic">Trống</span>}
                              </span>
                              {isOccupied && <User className="w-3 h-3 text-slate-400 shrink-0" />}
                            </div>

                            <div className="text-[10px] text-blue-400 font-mono font-bold">
                              {room.base_rent.toLocaleString()} đ
                            </div>
                          </div>

                          {/* Mini Window Frame bottom line */}
                          <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between text-[9px] text-slate-400">
                            <span className="truncate">{room.room_type}</span>
                            <span className="font-semibold">{statusText}</span>
                          </div>

                          {/* Floating Hover Card */}
                          {hoveredRoomId === room.id && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-slate-900/95 text-white text-[11px] rounded-xl border border-slate-700 shadow-xl pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                              <p className="font-semibold text-blue-300">Phòng {room.room_number} • {room.healthReason}</p>
                              <p className="text-[10px] text-slate-400">Bấm để mở Room 360 Side Panel →</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* GROUND FLOOR & ENTRANCE SILHOUETTE */}
          <div className="border-x-2 border-b-2 border-slate-700/80 rounded-b-3xl bg-slate-900/90 p-5 px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-xs">
                SẢNH
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Sảnh lễ tân & Cổng an ninh Smart Keyless</h4>
                <p className="text-[11px] text-slate-400">Bảo vệ 24/7 • Camera AI FaceID • Hòm thư cư dân</p>
              </div>
            </div>

            {/* Basement Parking Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <Car className="w-4 h-4 text-emerald-400" />
              <span>Hầm đỗ xe B1/B2 (Sức chứa 120 xe máy, 18 ô tô)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
