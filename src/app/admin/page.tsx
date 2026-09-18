'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SuperAdminDashboard } from '@/components/admin/SuperAdminDashboard';
import { Shield } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
        Đang tải hệ thống quản trị tối cao...
      </div>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Cổng Quản Trị Hệ Thống</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Khu vực bảo mật tối cao dành riêng cho Super Admin. Vui lòng đăng nhập tài khoản có thẩm quyền.
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
        >
          Đăng nhập Super Admin
        </button>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
      <SuperAdminDashboard />
    </div>
  );
}
