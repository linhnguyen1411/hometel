'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TenantDashboard } from '@/components/tenant/TenantDashboard';
import { Shield } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

export default function MyTenantPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
        Đang tải thông tin cư dân...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Cổng Dành Cho Cư Dân</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Vui lòng đăng nhập với tài khoản thuê phòng để xem hợp đồng, thanh toán hóa đơn VietQR và gửi yêu cầu sửa chữa.
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
        >
          Đăng nhập ngay
        </button>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <TenantDashboard onBrowseServices={() => router.push('/services')} />
    </div>
  );
}
