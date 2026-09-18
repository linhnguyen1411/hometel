import React, { useState } from 'react';
import { api } from '@/services/api';
import { X, Plus, Trash2, Building, Layers } from 'lucide-react';

interface RoomDraft {
  room_number: string;
  room_type: string;
  base_price_monthly: number;
  area_sqm: number;
  max_occupants: number;
}

interface FloorDraft {
  floor_number: number;
  name: string;
  rooms: RoomDraft[];
}

interface CreateBuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBuildingId: string) => void;
}

export const CreateBuildingModal: React.FC<CreateBuildingModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Building basics
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Hồ Chí Minh');
  const [district, setDistrict] = useState('');
  const [totalFloors, setTotalFloors] = useState<number>(3);

  // Step 2 & 3: Floors and Rooms setup
  const [floors, setFloors] = useState<FloorDraft[]>([]);

  if (!isOpen) return null;

  const initFloors = () => {
    if (!name.trim() || !address.trim()) {
      setError('Vui lòng nhập tên tòa nhà và địa chỉ.');
      return;
    }
    setError(null);
    const generatedFloors: FloorDraft[] = [];
    for (let f = 1; f <= totalFloors; f++) {
      generatedFloors.push({
        floor_number: f,
        name: `Tầng ${f}`,
        rooms: [
          {
            room_number: `${f}01`,
            room_type: 'STUDIO',
            base_price_monthly: 5000000,
            area_sqm: 25,
            max_occupants: 2,
          },
          {
            room_number: `${f}02`,
            room_type: 'STUDIO',
            base_price_monthly: 5000000,
            area_sqm: 25,
            max_occupants: 2,
          },
        ],
      });
    }
    setFloors(generatedFloors);
    setStep(2);
  };

  const addFloor = () => {
    const nextNum = floors.length > 0 ? Math.max(...floors.map((f) => f.floor_number)) + 1 : 1;
    setFloors([
      ...floors,
      {
        floor_number: nextNum,
        name: `Tầng ${nextNum}`,
        rooms: [],
      },
    ]);
  };

  const removeFloor = (index: number) => {
    setFloors(floors.filter((_, i) => i !== index));
  };

  const updateFloorName = (index: number, val: string) => {
    const next = [...floors];
    next[index].name = val;
    setFloors(next);
  };

  const addRoom = (floorIndex: number) => {
    const next = [...floors];
    const floor = next[floorIndex];
    const nextRoomIdx = floor.rooms.length + 1;
    const roomNum = `${floor.floor_number}${nextRoomIdx < 10 ? '0' : ''}${nextRoomIdx}`;
    floor.rooms.push({
      room_number: roomNum,
      room_type: 'STUDIO',
      base_price_monthly: 5000000,
      area_sqm: 25,
      max_occupants: 2,
    });
    setFloors(next);
  };

  const removeRoom = (floorIndex: number, roomIndex: number) => {
    const next = [...floors];
    next[floorIndex].rooms = next[floorIndex].rooms.filter((_, i) => i !== roomIndex);
    setFloors(next);
  };

  const updateRoom = (
    floorIndex: number,
    roomIndex: number,
    field: keyof RoomDraft,
    value: string | number
  ) => {
    const next = [...floors];
    next[floorIndex].rooms[roomIndex] = {
      ...next[floorIndex].rooms[roomIndex],
      [field]: value,
    };
    setFloors(next);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Building
      const newBuilding = await api.createBuilding({
        name,
        address,
        city,
        district,
        total_floors: floors.length,
      });

      const buildingId = (newBuilding as any).id;

      // 2. Create Floors and Rooms
      for (const f of floors) {
        const floorRes = await api.createFloor(buildingId, {
          floorNumber: f.floor_number,
          name: f.name,
        });
        const floorId = (floorRes as any).id;

        for (const r of f.rooms) {
          await api.createRoom({
            building_id: buildingId,
            floor_id: floorId,
            room_number: r.room_number,
            room_type: r.room_type,
            base_price_monthly: Number(r.base_price_monthly),
            area_sqm: Number(r.area_sqm),
            max_occupants: Number(r.max_occupants),
            status: 'AVAILABLE',
          });
        }
      }

      onSuccess(buildingId);
      onClose();
    } catch (err: any) {
      console.error('Failed to create building tree:', err);
      setError(err.message || 'Có lỗi xảy ra khi tạo tòa nhà và phòng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Thêm Tòa Nhà Mới</h3>
              <p className="text-xs text-slate-400">Thiết lập cấu trúc tòa nhà, số tầng và phân bổ phòng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-6 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs font-medium">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 ${step === 1 ? 'text-indigo-400 font-semibold' : 'text-slate-400'}`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
            Thông tin tòa nhà
          </button>
          <span className="text-slate-600">/</span>
          <button
            type="button"
            onClick={() => floors.length > 0 && setStep(2)}
            disabled={floors.length === 0}
            className={`flex items-center gap-2 ${step === 2 ? 'text-indigo-400 font-semibold' : 'text-slate-400'} disabled:opacity-40`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
            Cấu hình các tầng
          </button>
          <span className="text-slate-600">/</span>
          <button
            type="button"
            onClick={() => floors.length > 0 && setStep(3)}
            disabled={floors.length === 0}
            className={`flex items-center gap-2 ${step === 3 ? 'text-indigo-400 font-semibold' : 'text-slate-400'} disabled:opacity-40`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>3</span>
            Danh sách phòng & Hoàn tất
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tên tòa nhà <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Homtel Central Landmark"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Địa chỉ chi tiết <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 123 Nguyễn Huệ, Phường Bến Nghé"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Quận / Huyện</label>
                  <input
                    type="text"
                    placeholder="Quận 1"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tỉnh / Thành phố</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Số lượng tầng ban đầu
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(parseInt(e.target.value) || 1)}
                  className="w-32 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Hệ thống sẽ tự động khởi tạo danh sách tầng và phòng mẫu theo số tầng này. Bạn có thể chỉnh sửa ở bước kế tiếp.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">Danh sách các tầng ({floors.length})</h4>
                <button
                  type="button"
                  onClick={addFloor}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm tầng
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {floors.map((fl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                      {fl.floor_number}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={fl.name}
                        onChange={(e) => updateFloorName(idx, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-indigo-500"
                        placeholder={`Tầng ${fl.floor_number}`}
                      />
                    </div>
                    <div className="text-xs text-slate-400">
                      {fl.rooms.length} phòng
                    </div>
                    {floors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFloor(idx)}
                        className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">Phân bổ phòng cho từng tầng</h4>
              </div>

              <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
                {floors.map((fl, fIdx) => (
                  <div key={fIdx} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                      <span className="font-semibold text-sm text-indigo-300 flex items-center gap-2">
                        <Layers className="w-4 h-4" /> {fl.name} (Tầng {fl.floor_number})
                      </span>
                      <button
                        type="button"
                        onClick={() => addRoom(fIdx)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm phòng
                      </button>
                    </div>

                    {fl.rooms.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Chưa có phòng nào trên tầng này.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {fl.rooms.map((rm, rIdx) => (
                          <div
                            key={rIdx}
                            className="grid grid-cols-12 gap-2 items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs"
                          >
                            <div className="col-span-3">
                              <label className="text-[10px] text-slate-500 block mb-0.5">Số phòng</label>
                              <input
                                type="text"
                                value={rm.room_number}
                                onChange={(e) => updateRoom(fIdx, rIdx, 'room_number', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] text-slate-500 block mb-0.5">Loại phòng</label>
                              <select
                                value={rm.room_type}
                                onChange={(e) => updateRoom(fIdx, rIdx, 'room_type', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                              >
                                <option value="STUDIO">Studio</option>
                                <option value="ONE_BEDROOM">1 PN</option>
                                <option value="TWO_BEDROOM">2 PN</option>
                                <option value="SHARED">Phòng ghép</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] text-slate-500 block mb-0.5">Giá thuê (VNĐ)</label>
                              <input
                                type="number"
                                step={500000}
                                value={rm.base_price_monthly}
                                onChange={(e) =>
                                  updateRoom(fIdx, rIdx, 'base_price_monthly', Number(e.target.value))
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-slate-500 block mb-0.5">Diện tích (m²)</label>
                              <input
                                type="number"
                                value={rm.area_sqm}
                                onChange={(e) => updateRoom(fIdx, rIdx, 'area_sqm', Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end items-end pt-3">
                              <button
                                type="button"
                                onClick={() => removeRoom(fIdx, rIdx)}
                                className="text-slate-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Quay lại
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Hủy
            </button>
            {step === 1 && (
              <button
                type="button"
                onClick={initFloors}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
              >
                Tiếp tục
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
              >
                Tiếp tục thiết lập phòng
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={loading}
                className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? 'Đang tạo...' : 'Xác nhận tạo tòa nhà'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
