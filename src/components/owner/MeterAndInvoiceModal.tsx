import React, { useState, useEffect } from 'react';
import { Room, Meter } from '../../types/index';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { Zap, Receipt, Check, AlertCircle, X, Download, Upload, FileSpreadsheet } from 'lucide-react';

interface MeterAndInvoiceModalProps {
  room: Room | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MeterAndInvoiceModal: React.FC<MeterAndInvoiceModalProps> = ({ room, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(false);

  // Meter Reading Input state
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [readingValue, setReadingValue] = useState<number>(0);
  const [readingDate, setReadingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [savingReading, setSavingReading] = useState(false);
  const [readingSuccess, setReadingSuccess] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  // Bulk Excel import meter state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importingMeters, setImportingMeters] = useState(false);
  const [meterImportMsg, setMeterImportMsg] = useState<string | null>(null);

  // Generate Invoice state
  const [billingMonth, setBillingMonth] = useState<string>('2026-09');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    setLoading(true);
    api.getRoomMeters(room.id)
      .then(res => {
        setMeters(res);
        if (res.length > 0) {
          setSelectedMeterId(res[0].id);
          setReadingValue(res[0].current_reading);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [room]);

  if (!room) return null;

  const currentMeter = meters.find(m => m.id === selectedMeterId);

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMeter) return;

    setSavingReading(true);
    setReadingError(null);
    try {
      await api.recordMeterReading(currentMeter.id, {
        readingValue,
        readingDate,
        notes: 'Ghi số thủ công',
        ocrConfidence: null
      });
      setReadingSuccess(true);
      const res = await api.getRoomMeters(room.id);
      setMeters(res);
      setTimeout(() => setReadingSuccess(false), 2000);
    } catch (err: any) {
      setReadingError(err.message || 'Failed to record meter reading');
    } finally {
      setSavingReading(false);
    }
  };

  const handleDownloadMeterTemplate = async () => {
    try {
      await api.downloadMeterTemplate();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải template Excel');
    }
  };

  const handleBulkImportMeters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingMeters(true);
    setMeterImportMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.importMeters(formData);
      setMeterImportMsg(res.message || 'Import thành công!');
      const updatedMeters = await api.getRoomMeters(room.id);
      setMeters(updatedMeters);
      setTimeout(() => setMeterImportMsg(null), 3000);
    } catch (err: any) {
      setMeterImportMsg(err.message || 'Lỗi khi import file Excel');
    } finally {
      setImportingMeters(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingInvoice(true);
    setInvoiceError(null);
    try {
      await api.generateInvoice({
        roomId: room.id,
        billingMonth,
        items: []
      });
      setInvoiceSuccess(true);
      setTimeout(() => {
        setInvoiceSuccess(false);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setInvoiceError(err.message || 'Failed to generate monthly invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {t('explorer.room_number')} {room.room_number} • {t('meter.title')}
            </h3>
            <p className="text-xs text-slate-500">{room.building_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Record Meter Reading */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              {t('btn.record_meter', 'Ghi số công tơ thủ công')}
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleDownloadMeterTemplate}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold flex items-center gap-1"
                title="Tải file Excel mẫu để ghi số hàng loạt"
              >
                <Download className="w-3 h-3" />
                <span>Mẫu Excel</span>
              </button>
              <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>{importingMeters ? 'Đang import...' : 'Import Excel'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  disabled={importingMeters}
                  onChange={handleBulkImportMeters}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {meterImportMsg && (
            <div className="p-2 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-xs font-semibold">
              {meterImportMsg}
            </div>
          )}

          {meters.length === 0 ? (
            <p className="text-xs text-slate-500">{t('tenant.no_requests')}</p>
          ) : (
            <form onSubmit={handleSaveReading} className="space-y-3 text-xs">
              {readingError && (
                <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {readingError}
                </div>
              )}
              {readingSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {t('payment.success')}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('services.all_categories')}</label>
                  <select
                    value={selectedMeterId}
                    onChange={e => {
                      setSelectedMeterId(e.target.value);
                      const m = meters.find(item => item.id === e.target.value);
                      if (m) setReadingValue(m.current_reading);
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {meters.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.type} (S/N: {m.serial_number}) - Current: {m.current_reading}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('meter.electric_curr')}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={currentMeter?.current_reading || 0}
                    value={readingValue}
                    onChange={e => setReadingValue(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  {t('meter.electric_prev')}: {currentMeter?.current_reading || 0} → Δ {Math.max(0, readingValue - (currentMeter?.current_reading || 0)).toFixed(1)}
                </span>
                <button
                  type="submit"
                  disabled={savingReading}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs"
                >
                  {savingReading ? '...' : t('btn.save')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Section 2: Generate Monthly Invoice */}
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-blue-600" />
            {t('meter.generate_invoice')}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t('modal.meter_desc')}
          </p>

          <form onSubmit={handleGenerateInvoice} className="space-y-3 text-xs">
            {invoiceError && (
              <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200">
                {invoiceError}
              </div>
            )}
            {invoiceSuccess && (
              <div className="p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {t('payment.success')}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-48">
                <label className="block font-semibold text-slate-700 mb-1">{t('tenant.invoices_desc')}</label>
                <input
                  type="month"
                  required
                  value={billingMonth}
                  onChange={e => setBillingMonth(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="flex-1 pt-4 text-right">
                <button
                  type="submit"
                  disabled={generatingInvoice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs"
                >
                  {generatingInvoice ? '...' : t('meter.generate_invoice')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
