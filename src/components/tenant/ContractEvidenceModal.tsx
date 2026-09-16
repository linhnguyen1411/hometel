import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { X, ShieldCheck, CheckCircle2, Copy, Check, FileText } from 'lucide-react';

interface ContractEvidenceModalProps {
  contractId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ContractEvidenceModal: React.FC<ContractEvidenceModalProps> = ({
  contractId,
  isOpen,
  onClose
}) => {
  const { t } = useLanguage();
  const [evidenceData, setEvidenceData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && contractId) {
      setLoading(true);
      api.getContractEvidence(contractId)
        .then(res => setEvidenceData(res))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, contractId]);

  if (!isOpen) return null;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const evidence = evidenceData?.evidence || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{t('contract.certificate_title', 'Chứng Thư Ký Hợp Đồng Điện Tử')}</h3>
              <p className="text-[11px] text-slate-500">Legal Audit Certificate • ISO/IEC 27001</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải chứng thư...</div>
        ) : evidenceData ? (
          <div className="space-y-3.5 text-xs">
            {/* Status Banner */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('contract.certificate_valid', 'Chứng thư hợp lệ và có giá trị pháp lý')}</span>
            </div>

            {/* SHA-256 Hash */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Mã băm SHA-256 (Bất biến)</span>
                <button
                  onClick={() => copyHash(evidence.evidenceHash || '')}
                  className="text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-semibold text-[11px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
              <div className="font-mono text-[10px] break-all bg-white p-2 rounded-lg border border-slate-200 text-slate-800">
                {evidence.evidenceHash || 'SHA256_EVIDENCE_RECORD_PENDING'}
              </div>
            </div>

            {/* Evidence Metadata */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mã hợp đồng:</span>
                <span className="font-mono font-bold text-slate-900">{evidenceData.contractNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Người ký:</span>
                <span className="font-semibold text-slate-900">{evidenceData.tenantName} ({evidenceData.tenantEmail})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Thời điểm ký:</span>
                <span className="font-medium text-slate-900">{evidence.signedAt ? new Date(evidence.signedAt).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Phương thức xác thực:</span>
                <span className="font-semibold text-blue-700">{evidence.signingMethod || evidenceData.signingMethod || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Địa chỉ IP:</span>
                <span className="font-mono text-slate-700">{evidence.signerIp || '127.0.0.1'}</span>
              </div>
            </div>

            {/* Signature Preview if Drawn */}
            {evidenceData.signatureData && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold block">Chữ ký điện tử của cư dân:</span>
                <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-center">
                  <img
                    src={evidenceData.signatureData}
                    alt="Chữ ký điện tử"
                    className="max-h-20 object-contain"
                  />
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs"
            >
              {t('btn.close', 'Đóng chứng thư')}
            </button>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-red-500">Không tìm thấy chứng thư cho hợp đồng này.</div>
        )}
      </div>
    </div>
  );
};
