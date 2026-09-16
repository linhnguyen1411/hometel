import React, { useState, useRef } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import {
  X,
  Camera,
  Upload,
  Zap,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  Eye,
  Layers
} from 'lucide-react';

interface OcrMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
  room?: any;
  meter?: any;
  onSuccess?: () => void;
}

export const OcrMeterModal: React.FC<OcrMeterModalProps> = ({
  isOpen,
  onClose,
  room,
  meter: initialMeter,
  onSuccess
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [meters, setMeters] = useState<any[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(initialMeter?.id || '');
  const [meterType, setMeterType] = useState<'ELECTRICITY' | 'WATER'>(initialMeter?.type || 'ELECTRICITY');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [manualOverride, setManualOverride] = useState<string>('');
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [autoDraftInvoice, setAutoDraftInvoice] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load meters when room is provided
  React.useEffect(() => {
    if (room?.id) {
      api.getMetersByRoom(room.id)
        .then((res: any) => {
          setMeters(res);
          if (!selectedMeterId && res.length > 0) {
            setSelectedMeterId(res[0].id);
            setMeterType(res[0].type);
          }
        })
        .catch(err => console.error('Failed to load room meters:', err));
    }
  }, [room]);

  if (!isOpen) return null;

  const currentMeter = meters.find(m => m.id === selectedMeterId) || initialMeter || {
    id: selectedMeterId,
    type: meterType,
    current_reading: 100,
    serial_number: 'SN-DEMO-01'
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      triggerOcrScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const triggerOcrScan = async (imgData: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const prevReading = currentMeter?.current_reading || 0;
      const res = await api.scanMeterOcr({
        meterId: currentMeter?.id,
        imageBase64OrUrl: imgData,
        meterType: currentMeter?.type || meterType,
        previousReading: prevReading
      });
      setScanResult(res);
      setManualOverride(String(res.extractedReading));
    } catch (err: any) {
      alert(err.message || 'Lỗi quét hình ảnh công tơ');
    } finally {
      setScanning(false);
    }
  };

  const handleSimulateSampleScan = () => {
    // Generate realistic test reading based on meter type
    const prev = currentMeter?.current_reading || 120;
    const add = meterType === 'ELECTRICITY' ? 145 : 12.4;
    const simulatedReading = Math.round((prev + add) * 10) / 10;
    const sampleImg = `data:image/jpeg;base64,/simulated_reading=${simulatedReading}`;
    setImagePreview('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80');
    triggerOcrScan(sampleImg);
  };

  const handleCommitReading = async () => {
    if (!scanResult && !manualOverride) return;

    const finalReading = parseFloat(manualOverride || scanResult.extractedReading);
    const prevReading = currentMeter?.current_reading || 0;

    if (finalReading < prevReading) {
      alert(`Chỉ số mới (${finalReading}) không thể nhỏ hơn chỉ số trước (${prevReading})`);
      return;
    }

    setSubmitting(true);
    try {
      const readingDate = new Date().toISOString().substring(0, 10);
      const res = await api.commitMeterOcr(currentMeter.id, {
        readingValue: finalReading,
        readingDate,
        imageUrl: imagePreview,
        ocrConfidence: scanResult?.confidence || 0.95,
        ocrRawText: String(finalReading),
        autoDraftInvoice,
        notes: scanResult?.isAnomaly ? `LƯU Ý: ${scanResult.anomalyWarning}` : 'Ghi nhận tự động bằng AI OCR'
      });

      setSuccessMessage(
        res.generatedInvoice
          ? `Đã ghi nhận chỉ số ${finalReading} và tự động lập hóa đơn #${res.generatedInvoice.invoice_number}!`
          : `Đã ghi nhận chỉ số mới: ${finalReading} (Tiêu thụ: ${res.consumption})`
      );

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu chỉ số');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">AI OCR Ghi chỉ số công tơ</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                  SMART VISION
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {room ? `Phòng ${room.room_number}` : 'Quét trực tiếp'} • Tự động nhận diện số & phát hiện bất thường
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Meter selector if room has multiple meters */}
          {meters.length > 1 && (
            <div>
              <label className="font-bold text-slate-700 block mb-2">Chọn công tơ cần ghi:</label>
              <div className="grid grid-cols-2 gap-3">
                {meters.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMeterId(m.id);
                      setMeterType(m.type);
                      setScanResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      selectedMeterId === m.id
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {m.type === 'ELECTRICITY' ? <Zap className="w-4 h-4 text-amber-500" /> : <Droplets className="w-4 h-4 text-blue-500" />}
                    <div>
                      <span className="block font-sans">{m.type === 'ELECTRICITY' ? 'Công tơ điện' : 'Đồng hồ nước'}</span>
                      <span className="text-[10px] font-mono text-slate-400">Đầu kỳ: {m.current_reading}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current reading spec badge */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white border border-slate-200">
                {currentMeter?.type === 'ELECTRICITY' ? <Zap className="w-4 h-4 text-amber-500" /> : <Droplets className="w-4 h-4 text-blue-500" />}
              </span>
              <div>
                <h5 className="font-bold text-slate-900">
                  {currentMeter?.type === 'ELECTRICITY' ? 'Đồng hồ điện tử' : 'Đồng hồ nước sạch'} (S/N: {currentMeter?.serial_number || 'N/A'})
                </h5>
                <p className="text-[11px] text-slate-400">Chỉ số kỳ liền kề trước đó:</p>
              </div>
            </div>
            <span className="text-base font-black font-mono text-slate-900">
              {currentMeter?.current_reading || 0} {currentMeter?.type === 'ELECTRICITY' ? 'kWh' : 'm³'}
            </span>
          </div>

          {/* Camera Dropzone / Scan Area */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Bấm để chụp ảnh hoặc tải lên ảnh công tơ</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Hỗ trợ JPG, PNG, WebP (Camera góc rộng)</p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSimulateSampleScan();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-blue-600 font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Thử quét ảnh mẫu (Demo Scanner)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-black max-h-64 flex items-center justify-center group">
                <img
                  src={imagePreview}
                  alt="Meter Preview"
                  className="w-full h-64 object-cover opacity-90"
                />

                {/* Animated Laser Scanning Beam */}
                {scanning && (
                  <div className="absolute inset-0 bg-blue-500/10 pointer-events-none flex flex-col justify-center">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-lg shadow-cyan-500/50" />
                    <div className="absolute inset-x-0 bottom-4 text-center">
                      <span className="px-3 py-1 bg-slate-900/80 text-cyan-300 font-bold text-xs rounded-full border border-cyan-500/30">
                        Đang phân tích số đọc AI Vision...
                      </span>
                    </div>
                  </div>
                )}

                {/* Retake Button */}
                {!scanning && (
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-[11px] backdrop-blur-md flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Chụp lại</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OCR Result Card */}
          {scanResult && (
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">Kết quả nhận diện OCR</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span>Độ tin cậy: {Math.round(scanResult.confidence * 100)}%</span>
                </span>
              </div>

              {/* Numbers Comparison */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Kỳ trước</span>
                  <span className="text-sm font-black font-mono text-slate-700 mt-0.5 block">
                    {scanResult.previousReading}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-blue-300 shadow-xs shadow-blue-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600 font-bold block">Chỉ số mới (OCR)</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingManual(!isEditingManual)}
                      className="text-slate-400 hover:text-blue-600"
                      title="Sửa tay nếu sai góc chụp"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>

                  {isEditingManual ? (
                    <input
                      type="number"
                      step="0.1"
                      value={manualOverride}
                      onChange={(e) => setManualOverride(e.target.value)}
                      className="w-full mt-1 font-mono font-black text-sm border-b border-blue-600 outline-hidden bg-transparent"
                    />
                  ) : (
                    <span className="text-sm font-black font-mono text-blue-700 mt-0.5 block">
                      {manualOverride || scanResult.extractedReading}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block">Tiêu thụ</span>
                  <span className="text-sm font-black font-mono text-emerald-600 mt-0.5 block">
                    +{(parseFloat(manualOverride || scanResult.extractedReading) - scanResult.previousReading).toFixed(1)} {meterType === 'ELECTRICITY' ? 'kWh' : 'm³'}
                  </span>
                </div>
              </div>

              {/* Anomaly warning note if detected */}
              {scanResult.isAnomaly && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2 text-[11px] leading-normal">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Phát hiện bất thường:</span>
                    <span>{scanResult.anomalyWarning}</span>
                  </div>
                </div>
              )}

              {/* Option: Auto Draft Invoice */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkAutoDraft"
                  checked={autoDraftInvoice}
                  onChange={(e) => setAutoDraftInvoice(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="chkAutoDraft" className="text-slate-700 font-semibold cursor-pointer">
                  Tự động lập hóa đơn nháp (Draft Invoice) cho phòng này trong tháng hiện tại
                </label>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold text-xs"
          >
            Hủy bỏ
          </button>

          {scanResult && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleCommitReading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Đang lưu trữ...' : 'Xác nhận & Cập nhật chỉ số'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
