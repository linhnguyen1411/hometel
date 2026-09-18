import React, { useState, useEffect } from 'react';
import { Room, Building } from '../../types/index';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { RoomDetailModal } from './RoomDetailModal';
import { 
  Search, Building2, MapPin, Maximize2, Users, ArrowRight, Sparkles, 
  CheckCircle2, ShieldCheck, Zap, HelpCircle, PhoneCall, ChevronDown
} from 'lucide-react';

interface PropertyExplorerProps {
  onOpenAuthModal: () => void;
}

export const PropertyExplorer: React.FC<PropertyExplorerProps> = ({ onOpenAuthModal }) => {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('AVAILABLE');
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number>(30000000);

  // Selected room for modal
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bldRes] = await Promise.all([
        api.getRooms(`status=${statusFilter}&search=${encodeURIComponent(searchTerm)}&buildingId=${selectedBuilding}&roomType=${selectedRoomType}&maxPrice=${selectedMaxPrice}`),
        api.getBuildings()
      ]);
      setRooms(roomsRes);
      setBuildings(bldRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, selectedBuilding, selectedRoomType, statusFilter, selectedMaxPrice]);

  const formatRoomType = (type: string) => {
    if (!type) return '';
    const key = `room_type.${type.toLowerCase()}`;
    return t(key, type.replace('_', ' '));
  };

  const formatStatus = (status: string) => {
    if (!status) return '';
    const key = `status.${status.toLowerCase()}`;
    return t(key, status);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Showcase with H1 SEO */}
      <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-xl" aria-label="Giới thiệu Hệ thống Căn hộ Homtel Đà Nẵng">
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
          <img
            src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80"
            alt="Toàn cảnh tòa nhà căn hộ Homtel Đà Nẵng view biển Mỹ Khê"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="relative z-10 p-8 sm:p-14 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-4 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            Hệ sinh thái Bất động sản Cho thuê Thế hệ Mới
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Thuê Căn Hộ Dịch Vụ & Phòng Studio Thông Minh Tại Đà Nẵng
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Không gian sống tiện nghi, pháp lý rõ ràng, công tơ điện tử minh bạch theo thời gian thực và đội ngũ kỹ thuật chăm sóc tận tâm 24/7.
          </p>

          <div className="mt-8 flex flex-wrap gap-5 text-xs text-slate-200">
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Hình ảnh & Giá thuê xác thực 100%
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15">
              <Zap className="w-4 h-4 text-amber-400" />
              Chỉ số điện nước minh bạch điện tử
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Hợp đồng số hóa & Hỗ trợ dọn vào
            </span>
          </div>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4" aria-label="Bộ lọc tìm kiếm phòng">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo số phòng, tên tòa nhà, địa chỉ tại Đà Nẵng..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              aria-label="Tìm kiếm căn hộ"
            />
          </div>

          {/* Building Selector */}
          <div className="w-full md:w-56">
            <select
              value={selectedBuilding}
              onChange={e => setSelectedBuilding(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              aria-label="Chọn tòa nhà"
            >
              <option value="">Tất cả tòa nhà tại Đà Nẵng</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Room Type */}
          <div className="w-full md:w-48">
            <select
              value={selectedRoomType}
              onChange={e => setSelectedRoomType(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              aria-label="Chọn loại phòng"
            >
              <option value="">Tất cả loại phòng</option>
              <option value="STUDIO">Studio ban công</option>
              <option value="ONE_BEDROOM">1 Phòng ngủ (1PN)</option>
              <option value="TWO_BEDROOM">2 Phòng ngủ (2PN)</option>
              <option value="DUPLEX">Duplex gác lửng</option>
              <option value="PENTHOUSE">Penthouse cao cấp</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
              aria-label="Trạng thái phòng"
            >
              <option value="AVAILABLE">Chỉ phòng còn trống</option>
              <option value="">Tất cả trạng thái</option>
              <option value="OCCUPIED">Đang có người ở</option>
              <option value="MAINTENANCE">Đang bảo trì định kỳ</option>
            </select>
          </div>
        </div>

        {/* Max Price Range Slider */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Ngân sách tối đa:</span>
            <span className="font-bold text-blue-600 text-sm">
              {selectedMaxPrice.toLocaleString()} VND / tháng
            </span>
          </div>
          <input
            type="range"
            min={5000000}
            max={30000000}
            step={1000000}
            value={selectedMaxPrice}
            onChange={e => setSelectedMaxPrice(parseInt(e.target.value))}
            className="w-full sm:w-64 accent-blue-600 cursor-pointer"
            aria-label="Kéo chọn khoảng giá"
          />
        </div>
      </section>

      {/* Featured Buildings Showcase */}
      <section className="space-y-4" aria-label="Hệ thống tòa nhà nổi bật">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Hệ Thống Tòa Nhà Nổi Bật Tại Đà Nẵng
          </h2>
          <span className="text-xs text-slate-500">Bấm vào tòa nhà để lọc nhanh phòng</span>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {buildings.map(b => (
            <div
              key={b.id}
              onClick={() => setSelectedBuilding(selectedBuilding === b.id ? '' : b.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedBuilding === b.id
                  ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="h-36 rounded-xl overflow-hidden mb-3 bg-slate-100">
                <img 
                  src={b.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80'} 
                  alt={`Tòa nhà ${b.name} tại ${b.address}, ${b.city}`} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{b.address}</span>
              </p>
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600">
                <span className="font-medium text-slate-500">{b.city}</span>
                <span className="text-blue-600 font-semibold">{selectedBuilding === b.id ? 'Đang chọn lọc' : 'Xem các phòng'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Room Listing Grid with SEO Structured Microdata */}
      <section className="space-y-4" aria-label="Danh sách căn hộ cho thuê">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Danh Sách Căn Hộ Sẵn Sàng Cho Thuê ({rooms.length})
            </h2>
            <p className="text-xs text-slate-500">Thông tin cập nhật thực tế, sẵn sàng bàn giao chìa khóa</p>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-slate-400">Đang tải danh sách căn hộ...</div>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm">
            Không tìm thấy căn hộ phù hợp với tiêu chí lọc của bạn. Vui lòng thay đổi khoảng giá hoặc loại phòng.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(room => {
              const images: string[] = typeof room.images === 'string' ? JSON.parse(room.images || '[]') : (room.images || []);
              const mainImg = images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80';

              return (
                <article
                  key={room.id}
                  itemScope
                  itemType="https://schema.org/Apartment"
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col group"
                >
                  <div className="relative h-52 overflow-hidden bg-slate-100">
                    <img
                      src={mainImg}
                      alt={`Căn hộ phòng ${room.roomNumber} ${room.buildingName} - ${formatRoomType(room.roomType)} Đà Nẵng`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold rounded-lg">
                        Phòng {room.roomNumber}
                      </span>
                      <span className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-semibold rounded-lg">
                        {formatRoomType(room.roomType)}
                      </span>
                    </div>

                    <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs ${
                      room.status === 'AVAILABLE'
                        ? 'bg-emerald-500 text-white'
                        : room.status === 'OCCUPIED'
                        ? 'bg-slate-700 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {formatStatus(room.status)}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 itemProp="name" className="font-bold text-slate-900 text-base leading-snug">
                        {room.buildingName} - Căn #{room.roomNumber}
                      </h3>
                      <p itemProp="address" className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{room.buildingAddress}</span>
                      </p>

                      <div className="mt-3.5 flex items-center gap-4 text-xs text-slate-600 pb-3 border-b border-slate-100">
                        <span className="flex items-center gap-1" title="Diện tích sử dụng">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                          <span itemProp="floorSize">{room.area} m²</span>
                        </span>
                        <span className="flex items-center gap-1" title="Số lượng người ở tiêu chuẩn">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{room.capacity} Người</span>
                        </span>
                        <span className="text-slate-500 font-medium">
                          Tầng {room.floorNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Giá thuê niêm yết:</span>
                        <span className="text-lg font-extrabold text-blue-600" itemProp="price">
                          {(room.baseRent ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">VND/tháng</span>
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedRoom(room)}
                        className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        aria-label={`Xem chi tiết phòng ${room.roomNumber}`}
                      >
                        <span>Chi tiết phòng</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SEO Content Section: Why Choose Homtel & FAQ */}
      <section className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xs space-y-8" aria-label="Lợi ích và Câu hỏi thường gặp">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Tại Sao Nên Thuê Căn Hộ Qua Hệ Thống Homtel?
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Homtel giải quyết triệt để những bất cập cố hữu khi thuê phòng trọ và căn hộ truyền thống: không minh bạch tiền điện nước, chủ nhà chậm sửa chữa, hợp đồng thiếu căn cứ pháp lý.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-2">
          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Chỉ số Điện Nước Tự Động</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mỗi phòng được trang bị công tơ điện tử tiêu chuẩn. Cư dân theo dõi số kWh và khối nước trực tuyến trên điện thoại, không còn tranh cãi cuối tháng.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Sự Cố Kỹ Thuật Cam Kết 24/7</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Báo hỏng điều hòa, nghẹt lavabo, chập điện chỉ bằng 1 chạm trên ứng dụng. Hệ thống tự động điều phối thợ kỹ thuật trong vòng 30 phút.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Cọc Giữ Chỗ & Hoàn Cọc Rõ Ràng</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hợp đồng thuê căn hộ số hóa, tài khoản ký quỹ tiền cọc tách bạch và biên bản bàn giao đầy đủ đảm bảo quyền lợi cư dân khi hoàn cọc lúc chuyển đi.
            </p>
          </div>
        </div>
      </section>

      {/* Room Detail Modal */}
      <RoomDetailModal
        room={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onApplicationSubmitted={() => {
          fetchData();
        }}
        onOpenAuthModal={onOpenAuthModal}
      />
    </div>
  );
};
