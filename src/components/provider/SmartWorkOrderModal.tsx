import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { ServiceRequest } from '../../types/index';
import {
  X,
  Wrench,
  User,
  Phone,
  Building2,
  Tv,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Sparkles,
  ClipboardList
} from 'lucide-react';

interface SmartWorkOrderModalProps {
  request: ServiceRequest | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export const SmartWorkOrderModal: React.FC<SmartWorkOrderModalProps> = ({
  request,
  onClose,
  onStatusUpdated
}) => {
  const { t } = useLanguage();
  const [roomData, setRoomData] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (request?.room_id) {
      setLoadingContext(true);
      api.getRoom360(request.room_id)
        .then(res => setRoomData(res))
        .catch(err => console.error(err))
        .finally(() => setLoadingContext(false));
    }
  }, [request]);

  if (!request) return null;

  const checklistItems = [
    'Khảo sát hiện trạng thiết bị và đo thông số kỹ thuật',
    'Vệ sinh và kiểm tra đường ống/mối nối điện an toàn',
    'Thay thế phụ tùng hoặc xử lý tắc nghẽn/rò rỉ',
    'Vận hành thử tải 15 phút và bàn giao cho cư dân xác nhận'
  ];

  const handleToggleChecklist = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleUpdateStatus = async (nextStatus: any) => {
    setUpdating(true);
    try {
      await api.reviewServiceRequest(request.id, {
        status: nextStatus,
        notes: `Kỹ thuật viên cập nhật trạng thái: ${nextStatus}`
      });
      onStatusUpdated();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Chi tiết phiếu công tác (Smart Work Order)</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  request.urgency === 'EMERGENCY' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {request.urgency}
                </span>
              </div>
              <p className="text-xs text-slate-500">Mã phiếu #{request.id} • Dịch vụ: {request.service_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Context */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Issue Statement */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Yêu cầu từ cư dân:</span>
            <h4 className="text-sm font-bold text-slate-900">{request.title}</h4>
            <p className="text-slate-600 leading-relaxed pt-1">{request.description}</p>
          </div>

          {/* Tenant Contact & Room Bento */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-400 text-[11px] font-semibold block">Địa điểm sửa chữa:</span>
              <span className="font-bold text-slate-900 text-sm block">
                Phòng {request.room_number || 'N/A'} • {roomData?.room?.building_name || 'Tòa nhà'}
              </span>
              <span className="text-slate-500 text-[11px] block">{roomData?.room?.building_address || ''}</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-slate-400 text-[11px] font-semibold block">Thông tin liên hệ cư dân:</span>
              <span className="font-bold text-slate-900 text-sm block">{request.tenant_name || 'Cư dân'}</span>
              {request.tenant_phone && (
                <a
                  href={`tel:${request.tenant_phone}`}
                  className="text-blue-600 font-bold flex items-center gap-1 hover:underline text-[11px]"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Gọi cư dân: {request.tenant_phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Equipment Context */}
          {roomData?.equipment && roomData.equipment.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-purple-600" />
                <span>Thiết bị đã bàn giao trong phòng này:</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                {roomData.equipment.map((eq: any) => (
                  <div key={eq.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">{eq.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">S/N: {eq.serial_number || 'N/A'}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-700">
                      {eq.condition}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technician Operational Checklist */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span>Quy trình kỹ thuật tiêu chuẩn (Checklist):</span>
            </span>
            <div className="space-y-1.5">
              {checklistItems.map((item, idx) => (
                <label
                  key={idx}
                  onClick={() => handleToggleChecklist(idx)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                    checkedItems[idx]
                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checkedItems[idx]}
                    readOnly
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Trạng thái hiện tại: <strong className="text-slate-800">{request.status}</strong>
          </span>

          <div className="flex items-center gap-2">
            {request.status === 'ASSIGNED' && (
              <button
                onClick={() => handleUpdateStatus('IN_PROGRESS')}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Bắt đầu thực hiện
              </button>
            )}

            {request.status === 'IN_PROGRESS' && (
              <button
                onClick={() => handleUpdateStatus('COMPLETED')}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn thành công tác</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
