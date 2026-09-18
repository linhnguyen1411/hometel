'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Wrench, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MobileNavProps {
  onOpenAuthModal?: () => void;
}

export function MobileNav({ onOpenAuthModal }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const getPortalLink = () => {
    if (!user) return null;
    switch (user.role) {
      case 'SUPER_ADMIN':
        return { href: '/admin', label: 'Quản trị' };
      case 'OWNER':
      case 'STAFF':
        return { href: '/owner', label: 'Vận hành' };
      case 'PROVIDER':
        return { href: '/provider', label: 'Đối tác' };
      case 'TENANT':
      default:
        return { href: '/my', label: 'Của tôi' };
    }
  };

  const portal = getPortalLink();

  const navItems = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/explore', label: 'Khám phá', icon: Compass },
    { href: '/services', label: 'Dịch vụ', icon: Wrench },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-lg"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-blue-600 font-semibold scale-105'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {portal ? (
          <Link
            href={portal.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
              pathname.startsWith(portal.href)
                ? 'text-blue-600 font-semibold scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{portal.label}</span>
          </Link>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 hover:text-blue-600 transition-all cursor-pointer"
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Đăng nhập</span>
          </button>
        )}
      </div>
    </nav>
  );
}
