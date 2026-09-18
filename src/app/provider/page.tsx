'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ProviderDashboard } from '@/components/provider/ProviderDashboard';
import { Wrench } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

export default function ProviderPage() {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
        Đang tải cổng đối tác dịch vụ...
      </div>
    );
  }

  if (!user || (user.role !== 'PROVIDER' && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Cổng Đối Tác Dịch Vụ</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Khu vực dành riêng cho các đơn vị đối tác kỹ thuật, sửa chữa điện nước, vệ sinh và bảo trì.
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
        >
          Đăng nhập tài khoản đối tác
        </button>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      <ProviderDashboard />
    </div>
  );
}
