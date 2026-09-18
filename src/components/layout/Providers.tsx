'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/public/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { AuthModal } from '@/components/auth/AuthModal';

export function Providers({ children }: { children: React.ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Automatically unregister legacy Service Workers and purge old caches to prevent reload loops
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      }).catch(() => {});

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        }).catch(() => {});
      }
    }
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
          <Header onOpenAuthModal={() => setIsAuthModalOpen(true)} />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
          <MobileNav onOpenAuthModal={() => setIsAuthModalOpen(true)} />
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
          />
        </div>
      </AuthProvider>
    </LanguageProvider>
  );
}
