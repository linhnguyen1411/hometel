import React, { useState, useEffect, useRef } from 'react';
import { Invoice } from '../../types/index';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { CreditCard, QrCode, Check, X, ShieldCheck, Copy, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface PaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onPaymentSuccess }) => {
  const { t } = useLanguage();
  const isPaymentGatewayEnabled = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ENABLED === 'true';
  const [method, setMethod] = useState<'ONLINE' | 'CARD'>('ONLINE');
  const [vietQrInfo, setVietQrInfo] = useState<any | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<any>(null);

  // Bank transfer info for direct transfer (active when VietQR gateway is not configured)
  const defaultBankInfo = invoice ? {
    bankName: 'MB Bank (Ngân hàng TMCP Quân Đội)',
    accountNo: '0905111001',
    accountName: 'HOMTEL DA NANG MANAGEMENT',
    amount: invoice.outstanding_amount,
    transferContent: `HOMTEL ${invoice.invoice_number}`
  } : null;

  // Fetch VietQR info only when payment gateway is enabled
  useEffect(() => {
    if (isPaymentGatewayEnabled && invoice && invoice.id) {
      setLoadingQr(true);
      api.getVietQRInfo(invoice.id)
        .then(res => setVietQrInfo(res))
        .catch(err => console.warn('Could not fetch VietQR info:', err))
        .finally(() => setLoadingQr(false));
    }
  }, [isPaymentGatewayEnabled, invoice?.id]);

  // Auto-polling for VietQR webhook payment settlement only when payment gateway is enabled
  useEffect(() => {
    if (!isPaymentGatewayEnabled || !invoice || success) return;

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await api.getInvoiceById(invoice.id);
        if (updated && (updated.status === 'PAID' || updated.outstanding_amount <= 0)) {
          clearInterval(pollingRef.current);
          setSuccess(true);
          setTimeout(() => {
            onPaymentSuccess();
            onClose();
          }, 2000);
        }
      } catch (err) {
        // quiet fail on polling
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isPaymentGatewayEnabled, invoice?.id, success, onPaymentSuccess, onClose]);

  if (!invoice) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fallback direct confirmation
  const handleManualConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.processPayment({
        invoiceId: invoice.id,
        amount: invoice.outstanding_amount,
        method: method === 'ONLINE' ? 'BANK_TRANSFER' : 'CARD',
        transactionReference: `MANUAL-${Date.now()}`,
        notes: `Thanh toán hóa đơn ${invoice.invoice_number}`
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onPaymentSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Xử lý thanh toán thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t('payment.title', 'Thanh toán hóa đơn')}</h3>
            <p className="text-xs text-slate-500">
              {t('payment.invoice_number', 'Hóa đơn')}: {invoice.invoice_number} • {invoice.billing_month}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 text-emerald-800 rounded-2xl text-center space-y-3 border border-emerald-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <h4 className="font-bold text-lg text-emerald-950">{t('payment.success', 'Thanh toán thành công!')}</h4>
            <p className="text-xs text-emerald-700">
              Hệ thống VietQR đã tự động gạch nợ thành công cho hóa đơn {invoice.invoice_number}.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Total Due Banner */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('payment.total_amount', 'Số tiền cần thanh toán')}</span>
                <span className="text-xl font-black text-slate-900 block mt-0.5">
                  {((invoice as any).outstandingAmount ?? invoice.outstanding_amount ?? 0).toLocaleString()} VND
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {t(`status.${invoice.status.toLowerCase()}`, invoice.status)}
              </span>
            </div>

            {/* Method Tabs - Only shown when Payment Gateway is enabled */}
            {isPaymentGatewayEnabled && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">{t('payment.select_method', 'Chọn phương thức')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('ONLINE')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      method === 'ONLINE'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span className="text-[11px]">{t('payment.method_qr', 'Mã VietQR 24/7')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('CARD')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      method === 'CARD'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span className="text-[11px]">{t('payment.method_card', 'Thẻ / Tiền mặt')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bank Transfer View */}
            <div className="space-y-3">
              {isPaymentGatewayEnabled && method === 'ONLINE' && (
                loadingQr ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    <p className="text-xs">Đang sinh mã VietQR NAPAS 247...</p>
                  </div>
                ) : vietQrInfo?.qrImageUrl ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col items-center shadow-xs">
                    <img
                      src={vietQrInfo.qrImageUrl}
                      alt="VietQR NAPAS 247"
                      className="w-52 h-52 object-contain rounded-xl"
                    />
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span>{t('payment.waiting_for_payment', 'Đang đợi chuyển khoản (tự động nhận diện sau 3s)...')}</span>
                    </div>
                  </div>
                ) : null
              )}

              {!isPaymentGatewayEnabled && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-xs leading-relaxed">
                  <span className="font-bold block mb-1">Chuyển khoản trực tiếp tới Ban Quản Lý Tòa Nhà:</span>
                  Vui lòng chuyển khoản theo thông tin dưới đây và nhấn <strong>Xác nhận đã chuyển</strong> để gửi xác nhận thanh toán.
                </div>
              )}

              {/* Bank Transfer Details with Copy Buttons */}
              {(() => {
                const info = (isPaymentGatewayEnabled && vietQrInfo) ? vietQrInfo : defaultBankInfo;
                if (!info) return null;
                return (
                  <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px]">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 font-sans">Ngân hàng:</span>
                      <span className="font-sans font-bold text-slate-900">{info.bankName}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 font-sans">Số tài khoản:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{info.accountNo}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(info.accountNo, 'acc')}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          title="Sao chép"
                        >
                          {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 font-sans">Chủ tài khoản:</span>
                      <span className="font-sans font-semibold text-slate-800">{info.accountName}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 font-sans">Số tiền:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-blue-700">{info.amount.toLocaleString()} VND</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(info.amount), 'amt')}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          title="Sao chép"
                        >
                          {copiedField === 'amt' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-0.5 bg-amber-50/80 px-2 py-1 rounded border border-amber-200">
                      <span className="text-amber-900 font-sans font-semibold">Nội dung CK:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-950">{info.transferContent}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(info.transferContent, 'content')}
                          className="p-1 hover:bg-amber-200 rounded text-amber-800"
                          title="Sao chép"
                        >
                          {copiedField === 'content' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {isPaymentGatewayEnabled && (
                <p className="text-[11px] text-slate-400 text-center leading-normal">
                  {t('payment.auto_detect', 'Quét mã VietQR bằng app ngân hàng (Vietcombank, MB, Techcombank, VPBank,...) để hệ thống tự động gạch nợ tức thì.')}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('btn.cancel', 'Hủy / Đóng')}
              </button>

              <button
                type="button"
                onClick={handleManualConfirm}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? t('payment.processing', 'Đang xử lý...') : t('payment.confirm', 'Xác nhận đã chuyển')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
