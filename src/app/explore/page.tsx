'use client';

import React, { useState } from 'react';
import { PropertyExplorer } from '@/components/public/PropertyExplorer';
import { AuthModal } from '@/components/auth/AuthModal';

export default function ExplorePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Khám Phá Căn Hộ Cho Thuê
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Hệ thống căn hộ dịch vụ cao cấp, studio và 1-2PN sẵn sàng dọn vào ở ngay tại Đà Nẵng
        </p>
      </div>

      <PropertyExplorer onOpenAuthModal={() => setIsAuthOpen(true)} />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
