'use client';

import React, { useState } from 'react';
import { ServiceCatalogView } from '@/components/public/ServiceCatalogView';
import { AuthModal } from '@/components/auth/AuthModal';

export default function ServicesPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dịch Vụ Tiện Ích & Sửa Chữa Căn Hộ</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Đội ngũ kỹ thuật viên chuyên nghiệp, linh kiện chính hãng, báo giá minh bạch và bảo hành rõ ràng
        </p>
      </div>

      <ServiceCatalogView onOpenAuthModal={() => setIsAuthOpen(true)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
