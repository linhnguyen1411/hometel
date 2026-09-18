import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { X, ShieldAlert, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, switchDemoRole } = useAuth();
  const { t } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) {
        await register({ email, password, fullName, phone });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickRole = async (roleKey: keyof typeof DEMO_USERS) => {
    setError(null);
    setSubmitting(true);
    try {
      await switchDemoRole(roleKey);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Role switch failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {isRegister ? t('auth.register_title') : t('auth.signin_title')}
            </h3>
            <p className="text-xs text-slate-500">{t('auth.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-1.5 border border-red-200">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {isRegister && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('auth.fullname')}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Tran Van An"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('auth.phone')}</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+84 905 123 456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@propertyv1.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition-colors mt-2"
          >
            {submitting ? '...' : isRegister ? t('auth.register_btn') : t('auth.signin_btn')}
          </button>
        </form>

        {/* Quick Demo Selector */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t('auth.quick_roles')}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickRole('SUPER_ADMIN')}
              className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-left font-medium border border-purple-200"
            >
              👑 {t('simulator.super_admin')}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole('OWNER')}
              className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-left font-medium border border-blue-200"
            >
              🏢 {t('simulator.owner')}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole('PROVIDER')}
              className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-left font-medium border border-amber-200"
            >
              🔧 {t('simulator.provider')}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRole('TENANT')}
              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-left font-medium border border-emerald-200"
            >
              🏠 {t('simulator.tenant')}
            </button>
          </div>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            {isRegister ? t('auth.have_account') : t('auth.need_account')}
          </button>
        </div>
      </div>
    </div>
  );
};
