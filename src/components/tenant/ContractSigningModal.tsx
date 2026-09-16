import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { X, PenTool, KeyRound, ShieldCheck, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface ContractSigningModalProps {
  contract: any;
  isOpen: boolean;
  onClose: () => void;
  onSignSuccess: () => void;
}

export const ContractSigningModal: React.FC<ContractSigningModalProps> = ({
  contract,
  isOpen,
  onClose,
  onSignSuccess
}) => {
  const { t } = useLanguage();
  const [method, setMethod] = useState<'CANVAS_DRAW' | 'OTP'>('CANVAS_DRAW');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEvidence, setSuccessEvidence] = useState<any | null>(null);

  // Canvas Drawing State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Canvas initialization
  useEffect(() => {
    if (isOpen && method === 'CANVAS_DRAW') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }
  }, [isOpen, method]);

  // OTP Countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  if (!isOpen || !contract) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    setError(null);
    try {
      const res = await api.sendContractOtp(contract.id, 'ZALO');
      setOtpSent(true);
      setOtpCountdown(60);
      if (res.otpCode) {
        setOtpCode(res.otpCode);
      }
    } catch (err: any) {
      setError(err.message || 'Could not send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSign = async () => {
    setError(null);
    setSubmitting(true);

    try {
      let signatureData: string | undefined;

      if (method === 'CANVAS_DRAW') {
        if (!hasDrawn || !canvasRef.current) {
          throw new Error('Vui lòng vẽ chữ ký của bạn vào khung trước khi xác nhận');
        }
        signatureData = canvasRef.current.toDataURL('image/png');
      } else {
        if (!otpCode || otpCode.trim().length !== 6) {
          throw new Error('Vui lòng nhập đủ 6 chữ số mã OTP xác thực');
        }
      }

      const res = await api.signContract(contract.id, {
        signingMethod: method,
        signatureData,
        otpCode: method === 'OTP' ? otpCode.trim() : undefined
      });

      setSuccessEvidence(res.evidence);
      setTimeout(() => {
        onSignSuccess();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Ký hợp đồng không thành công');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              {t('contract.sign_title', 'Ký Hợp Đồng Điện Tử')}
            </h3>
            <p className="text-xs text-slate-500">
              {contract.contract_number} • Phòng {contract.room_number || contract.room_id}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State with Tamper-Proof Evidence */}
        {successEvidence ? (
          <div className="p-6 bg-emerald-50 text-emerald-900 rounded-2xl text-center space-y-3 border border-emerald-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <h4 className="font-black text-lg text-emerald-950">
              {t('contract.signed_success', 'Hợp đồng đã ký kết thành công!')}
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Hợp đồng thuê đã chính thức có hiệu lực pháp lý. Chứng thực mã băm SHA-256 đã được lưu vết bất biến.
            </p>

            <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 text-left font-mono text-[11px] space-y-1 text-slate-700">
              <div><strong className="text-slate-900">Hash SHA-256:</strong> {successEvidence.evidenceHash?.substring(0, 24)}...</div>
              <div><strong className="text-slate-900">Thời gian:</strong> {new Date(successEvidence.signedAt).toLocaleString()}</div>
              <div><strong className="text-slate-900">Phương thức:</strong> {successEvidence.signingMethod}</div>
              <div><strong className="text-slate-900">IP người ký:</strong> {successEvidence.signerIp}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Contract Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">{t('tenant.rent_amount', 'Tiền thuê tháng')}:</span>
                <span className="font-bold text-slate-900 text-sm">{contract.rent_amount?.toLocaleString()} VND</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">{t('tenant.deposit', 'Tiền đặt cọc')}:</span>
                <span className="font-bold text-slate-900">{contract.deposit_amount?.toLocaleString()} VND</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">{t('tenant.lease_period', 'Thời hạn thuê')}:</span>
                <span className="font-medium text-slate-800">{contract.start_date} → {contract.end_date}</span>
              </div>
            </div>

            {/* Method Tabs */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                {t('contract.select_method', 'Chọn phương thức ký điện tử')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('CANVAS_DRAW')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    method === 'CANVAS_DRAW'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <PenTool className="w-4 h-4 text-emerald-600" />
                  <span>{t('contract.method_draw', 'Vẽ chữ ký tay')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('OTP')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    method === 'OTP'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>{t('contract.method_otp', 'Xác thực mã OTP')}</span>
                </button>
              </div>
            </div>

            {/* Method 1: Canvas Signature */}
            {method === 'CANVAS_DRAW' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">
                    {t('contract.draw_instruction', 'Dùng chuột hoặc ngón tay để vẽ chữ ký:')}
                  </span>
                  {hasDrawn && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-slate-500 hover:text-red-600 flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('contract.clear_signature', 'Xóa & Vẽ lại')}
                    </button>
                  )}
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-1 relative overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-40 bg-white rounded-lg cursor-crosshair touch-none"
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 font-medium italic text-xs">
                      {t('contract.sign_here', 'Ký tên tại đây')}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Method 2: OTP Verification */
              <div className="space-y-3 p-4 bg-blue-50/60 rounded-xl border border-blue-100">
                <p className="text-slate-600 leading-relaxed">
                  {t('contract.otp_desc', 'Mã xác thực bảo mật một lần (OTP) 6 chữ số sẽ được gửi qua Zalo Notification Service / SMS đến số điện thoại của bạn.')}
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="••••••"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-36 tracking-widest text-center text-lg font-mono font-bold px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpCountdown > 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    {sendingOtp ? 'Đang gửi...' : otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : t('contract.send_otp', 'Gửi mã OTP')}
                  </button>
                </div>

                {otpSent && (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {t('contract.otp_sent_success', 'Mã xác thực OTP đã được gửi thành công!')}
                  </p>
                )}
              </div>
            )}

            {/* Legal Consent Notice */}
            <p className="text-[11px] text-slate-400 leading-normal pt-1">
              {t('contract.legal_notice', 'Bằng việc xác nhận, bạn đồng ý với toàn bộ điều khoản hợp đồng thuê phòng và xác thực chữ ký điện tử có giá trị pháp lý ràng buộc theo Luật Giao dịch Điện tử Việt Nam.')}
            </p>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('btn.cancel', 'Hủy')}
              </button>
              <button
                type="button"
                onClick={handleSign}
                disabled={submitting || (method === 'CANVAS_DRAW' && !hasDrawn) || (method === 'OTP' && otpCode.length !== 6)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? t('contract.signing', 'Đang chứng thực...') : t('contract.confirm_sign', 'Xác nhận Ký kết')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
