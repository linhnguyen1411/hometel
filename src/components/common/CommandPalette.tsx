import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { Search, Home, Building2, User, FileText, Receipt, Wrench, Shield, ArrowRight, X, Sparkles, Clock, AlertCircle } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom?: (roomId: string) => void;
  onSelectBuilding?: (buildingId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
  onSelectBuilding,
  onNavigateTab
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({
    rooms: [],
    tenants: [],
    buildings: [],
    contracts: [],
    invoices: [],
    serviceRequests: [],
    equipment: []
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({
        rooms: [],
        tenants: [],
        buildings: [],
        contracts: [],
        invoices: [],
        serviceRequests: [],
        equipment: []
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({
        rooms: [],
        tenants: [],
        buildings: [],
        contracts: [],
        invoices: [],
        serviceRequests: [],
        equipment: []
      });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.globalSearch(query);
        setResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const hasResults =
    results.rooms.length > 0 ||
    results.tenants.length > 0 ||
    results.buildings.length > 0 ||
    results.contracts.length > 0 ||
    results.invoices.length > 0 ||
    results.serviceRequests.length > 0 ||
    results.equipment.length > 0;

  const quickShortcuts = [
    { label: 'Việc cần làm hôm nay (Today Cockpit)', tab: 'today', icon: <Clock className="w-4 h-4 text-blue-500" /> },
    { label: 'Trung tâm hành động (Action Center)', tab: 'actions', icon: <AlertCircle className="w-4 h-4 text-amber-500" /> },
    { label: 'Bản đồ phòng & Tòa nhà (Building 360)', tab: 'building360', icon: <Building2 className="w-4 h-4 text-emerald-500" /> },
    { label: 'Lập hóa đơn & Ghi điện nước', tab: 'invoices', icon: <Receipt className="w-4 h-4 text-purple-500" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm phòng, cư dân, tòa nhà, hóa đơn, sự cố... (Ctrl + K)"
            className="w-full text-sm sm:text-base text-slate-900 placeholder-slate-400 bg-transparent outline-hidden"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </span>
        </div>

        {/* Results / Suggestions Container */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang tìm kiếm thông tin...</span>
            </div>
          )}

          {!query && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block px-2">
                Thao tác nhanh
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickShortcuts.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onNavigateTab?.(sc.tab);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-left border border-slate-100 transition-colors"
                  >
                    {sc.icon}
                    <span className="text-xs font-semibold text-slate-700">{sc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && !loading && !hasResults && (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Không tìm thấy kết quả phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">Thử tìm theo số phòng (vd: 101), tên cư dân hoặc số điện thoại</p>
            </div>
          )}

          {/* Rooms Group */}
          {results.rooms?.length > 0 && (
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block px-2 mb-1.5">
                Phòng / Căn hộ
              </span>
              <div className="space-y-1">
                {results.rooms.map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onSelectRoom?.(r.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {r.room_number}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                          Phòng {r.room_number} • {r.building_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {r.base_rent.toLocaleString()} VND/tháng • Trạng thái: {r.status}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Mở Room 360 <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tenants Group */}
          {results.tenants?.length > 0 && (
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block px-2 mb-1.5">
                Cư dân & Người thuê
              </span>
              <div className="space-y-1">
                {results.tenants.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      onNavigateTab?.('contracts');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                          {t.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.phone || 'Chưa có SĐT'} • {t.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Xem hợp đồng <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buildings Group */}
          {results.buildings?.length > 0 && (
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block px-2 mb-1.5">
                Tòa nhà
              </span>
              <div className="space-y-1">
                {results.buildings.map((b: any) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      onSelectBuilding?.(b.id);
                      onNavigateTab?.('building360');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{b.name}</div>
                        <div className="text-[11px] text-slate-400">{b.address}, {b.city}</div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Mở Building 360 <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices Group */}
          {results.invoices?.length > 0 && (
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block px-2 mb-1.5">
                Hóa đơn tiền phòng
              </span>
              <div className="space-y-1">
                {results.invoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onNavigateTab?.('invoices');
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {inv.invoice_number} • Phòng {inv.room_number}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Kỳ {inv.billing_month} • {inv.total.toLocaleString()} VND • {inv.status}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-purple-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Homtel Building OS — Bấm phím Enter để chọn hoặc nhấp chuột</span>
          </div>
          <span className="font-mono">ESC để đóng</span>
        </div>
      </div>
    </div>
  );
};
