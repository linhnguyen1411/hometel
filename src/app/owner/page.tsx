'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { OwnerDashboard } from '@/components/owner/OwnerDashboard';
import { Shield } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

export default function OwnerPage() {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
        Đang tải trung tâm điều hành...
      </div>
    );
  }

  if (!user || (user.role !== 'OWNER' && user.role !== 'STAFF' && user.role !== 'SUPER_ADMIN')) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Cổng Vận Hành Tòa Nhà</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Khu vực bảo mật dành cho Chủ nhà (Owner) và Nhân viên kỹ thuật/quản lý (Staff).
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
        >
          Đăng nhập tài khoản quản lý
        </button>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      <OwnerDashboard />
    </div>
  );
}
