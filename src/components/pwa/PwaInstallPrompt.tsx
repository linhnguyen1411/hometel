'use client';

import React, { useState, useEffect } from 'react';
import { Download, WifiOff, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Check localStorage dismissal
    const dismissed = localStorage.getItem('homtel_pwa_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 86400000 * 3) {
      // Dismissed within last 3 days
      setIsDismissed(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('homtel_pwa_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Offline Status Floating Alert */}
      {isOffline && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-md sticky top-0 z-50 animate-pulse">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{t('pwa.offlineModeNotice') || 'Bạn đang ngoại tuyến. Dữ liệu phòng & hóa đơn vẫn được lưu an toàn trên máy.'}</span>
          </div>
        </div>
      )}

      {/* PWA Install Banner */}
      {!isInstalled && !isDismissed && deferredPrompt && (
        <aside aria-label="Cài đặt ứng dụng Homtel" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md bg-slate-900/95 backdrop-blur text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 z-50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                {t('pwa.installTitle') || 'Cài đặt Homtel App'}
                <span className="text-[10px] bg-blue-500/30 text-blue-300 font-semibold px-1.5 py-0.5 rounded">PWA</span>
              </h2>
              <p className="text-xs text-slate-300">
                {t('pwa.installDesc') || 'Mở nhanh không cần tải App Store, nhận thông báo đẩy tức thì.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('pwa.installBtn') || 'Cài ngay'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Đóng"
              aria-label="Đóng thông báo cài đặt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
