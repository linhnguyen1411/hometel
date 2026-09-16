import React, { useState } from 'react';
import { Invoice } from '../../types/index.js';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { CreditCard, Landmark, DollarSign, Check, X, ShieldCheck, QrCode } from 'lucide-react';

interface PaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onPaymentSuccess }) => {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(invoice?.outstanding_amount || 0);
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'CARD' | 'CASH' | 'ONLINE'>('ONLINE');
  const [reference, setReference] = useState<string>(`TRANS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [notes, setNotes] = useState<string>('Monthly rental & utility settlement');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.processPayment({
        invoiceId: invoice.id,
        amount,
        method,
        transactionReference: reference,
        notes
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onPaymentSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t('payment.title')}</h3>
            <p className="text-xs text-slate-500">{t('payment.invoice_number')}: {invoice.invoice_number} • {invoice.billing_month}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 text-emerald-800 rounded-xl text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base">{t('payment.success')}</h4>
            <p className="text-xs text-emerald-700">
              Ref: {reference}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-2 bg-red-50 text-red-700 rounded border border-red-200">
                {error}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold">{t('payment.total_amount')}</span>
                <span className="text-lg font-black text-slate-900 block">
                  {invoice.outstanding_amount.toLocaleString()} VND
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                {t(`status.${invoice.status.toLowerCase()}`, invoice.status)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('payment.total_amount')} (VND)</label>
              <input
                type="number"
                required
                min={1000}
                max={invoice.outstanding_amount}
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm bg-white"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">{t('payment.select_method')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('ONLINE')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 ${
                    method === 'ONLINE'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span className="text-[11px]">{t('payment.method_qr')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 ${
                    method === 'CARD'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span className="text-[11px]">{t('payment.method_card')}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('payment.invoice_number')}</label>
              <input
                type="text"
                readOnly
                value={reference}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-mono"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('btn.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? t('payment.processing') : t('payment.confirm')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
