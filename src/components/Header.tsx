import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { api } from '../services/api.js';
import { 
  Building, Bell, LogOut, LogIn, FileCode, Layers, ShieldCheck, 
  User as UserIcon, ChevronDown, Home, Wrench, Receipt, FileText, Settings
} from 'lucide-react';
import { NotificationsModal } from './NotificationsModal.js';
import { LanguageSelector } from './LanguageSelector.js';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab, onOpenAuthModal }) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifsOpen, setIsNotifsOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.getNotifications()
        .then(res => setUnreadCount(res.unreadCount || 0))
        .catch(() => {});
    }
  }, [user, isNotifsOpen]);

  // Handle outside click to close user dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Quản trị viên Hệ thống', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'OWNER':
        return { label: 'Chủ sở hữu Bất động sản', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'PROVIDER':
        return { label: 'Đối tác Dịch vụ', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'STAFF':
        return { label: 'Quản lý Tòa nhà', color: 'bg-teal-100 text-teal-700 border-teal-200' };
      case 'TENANT':
        return { label: 'Cư dân Homtel', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      default:
        return { label: 'Thành viên', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const getPortalTitle = (role: string) => {
    if (role === 'TENANT') {
      return 'Cổng Cư Dân Của Tôi';
    }
    if (role === 'PROVIDER') {
      return 'Cổng Điều Phối Dịch Vụ';
    }
    if (role === 'SUPER_ADMIN') {
      return 'Trung Tâm Quản Trị Hệ Thống';
    }
    return 'Cổng Quản Trị Vận Hành (BOS)';
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => onSelectTab('explore')}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-hidden"
              aria-label="Về trang chủ Homtel"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-lg leading-tight flex items-center gap-1.5">
                  Homtel
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold border border-blue-200">
                    Đà Nẵng
                  </span>
                </span>
                <span className="block text-[11px] text-slate-500 font-medium">Hệ Thống Căn Hộ Cho Thuê & Vận Hành</span>
              </div>
            </button>

            {/* Main Public Navigation Menu (Không còn Cổng Quản Trị trực tiếp ở đây) */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Điều hướng chính">
              <button
                onClick={() => onSelectTab('explore')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentTab === 'explore'
                    ? 'text-blue-600 bg-blue-50/90 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Khám phá Căn hộ
              </button>

              <button
                onClick={() => onSelectTab('services')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentTab === 'services'
                    ? 'text-blue-600 bg-blue-50/90 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Dịch vụ Cư dân
              </button>

              <a
                href="#footer"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Về Chúng Tôi
              </a>
            </nav>
          </div>

          {/* User actions (Right section) */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSelector />

            {user ? (
              <>
                {/* Notifications Bell */}
                <button
                  onClick={() => setIsNotifsOpen(true)}
                  className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Thông báo"
                  aria-label="Thông báo"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu ngay sau Icon/Avatar Login */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                    className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer focus:outline-hidden"
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                      <img
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.fullName)}`}
                        alt={user.fullName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="hidden sm:block text-left pr-1">
                      <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1">
                        {user.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{user.email}</div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Content */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="text-xs font-bold text-slate-900">{user.fullName}</div>
                        <div className="text-[11px] text-slate-500 mb-2 truncate">{user.email}</div>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getRoleLabel(user.role).color}`}>
                          {getRoleLabel(user.role).label}
                        </span>
                      </div>

                      {/* Portal & Management Navigation Links */}
                      <div className="py-1">
                        {/* Nút Cổng Quản Trị / Portal được đưa vào đây */}
                        <button
                          onClick={() => {
                            onSelectTab('dashboard');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-slate-900 font-bold">{getPortalTitle(user.role)}</div>
                            <div className="text-[10px] text-slate-500 font-normal">Truy cập giao diện vận hành & dữ liệu</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            onSelectTab('explore');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Home className="w-4 h-4 text-slate-400" />
                          <span>Khám phá căn hộ</span>
                        </button>

                        <button
                          onClick={() => {
                            onSelectTab('services');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Wrench className="w-4 h-4 text-slate-400" />
                          <span>Dịch vụ & Bảo trì</span>
                        </button>

                        {(user.role === 'SUPER_ADMIN' || user.role === 'OWNER') && (
                          <a
                            href="/api/v1/docs"
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <FileCode className="w-4 h-4 text-emerald-600" />
                            <span>Tài liệu API (Swagger UI)</span>
                          </a>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-1"></div>

                      {/* Logout */}
                      <div className="px-2 py-1">
                        <button
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span>Đăng xuất tài khoản</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập / Đăng ký</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Modal */}
      {isNotifsOpen && (
        <NotificationsModal
          isOpen={isNotifsOpen}
          onClose={() => setIsNotifsOpen(false)}
        />
      )}
    </>
  );
};
