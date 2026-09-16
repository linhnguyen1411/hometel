import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { api } from '../../services/api.js';
import { LanguageSelector } from '../LanguageSelector.js';
import { NotificationsModal } from '../NotificationsModal.js';
import {
  Building,
  Bell,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Globe,
  ExternalLink,
  Shield,
  Sparkles,
  Search
} from 'lucide-react';

export interface PortalMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

interface PortalShellProps {
  portalName: string;
  portalSubtitle?: string;
  portalIcon?: React.ReactNode;
  roleBadgeText?: string;
  roleBadgeColor?: string;
  menuItems: PortalMenuItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onBackToPublic?: () => void;
  onOpenSearch?: () => void;
  quickAction?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string;
  };
  children: React.ReactNode;
}

export const PortalShell: React.FC<PortalShellProps> = ({
  portalName,
  portalSubtitle,
  portalIcon,
  roleBadgeText,
  roleBadgeColor = 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  menuItems,
  activeTab,
  onSelectTab,
  onBackToPublic,
  onOpenSearch,
  quickAction,
  children
}) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.getNotifications()
        .then(res => setUnreadNotifs(res.unreadCount || 0))
        .catch(() => {});
    }
  }, [user, isNotifsOpen]);

  const activeItem = menuItems.find(m => m.id === activeTab) || menuItems[0];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row text-slate-900 font-sans">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* LEFT MENU SIDEBAR */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              {portalIcon || <Building className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base tracking-tight">Homtel</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-semibold border border-blue-400/30">
                  {t('brand.version', 'v1.0')}
                </span>
              </div>
              <span className="block text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
                {portalSubtitle || portalName}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0">
                <img
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.fullName)}`}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user.fullName}</div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>

            {roleBadgeText && (
              <div className="mt-2.5 flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${roleBadgeColor}`}>
                  {roleBadgeText}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  {t('status.active', 'Active')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick Action in Left Menu */}
        {quickAction && (
          <div className="p-3">
            <button
              onClick={quickAction.onClick}
              className={`w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                quickAction.color || 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {quickAction.icon}
              <span>{quickAction.label}</span>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t('menu.dashboard', 'Menu Navigation')}
          </div>

          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} transition-colors`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.badge !== undefined && item.badge !== 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white text-blue-700'
                          : item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-950/30">
          {/* Multi-Language Selector */}
          <div>
            <div className="px-1 pb-1 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" />
              <span>{t('language.select', 'Ngôn ngữ / Language')}</span>
            </div>
            <LanguageSelector variant="sidebar" />
          </div>

          {/* Return to Public Website */}
          {onBackToPublic && (
            <button
              onClick={onBackToPublic}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('nav.back_to_site', 'Back to Public Site')}</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Homtel</span>
            </button>
          )}

          {/* Sign Out */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.sign_out', 'Sign Out')}</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Hamburger + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <span>Homtel</span>
                <span>/</span>
                <span className="text-slate-600">{portalName}</span>
                <span>/</span>
                <span className="font-semibold text-blue-600">{activeItem?.label}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {activeItem?.label}
              </h2>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5">
            {/* Global Search Shortcut */}
            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors border border-slate-200"
                title="Tìm kiếm nhanh (Ctrl + K)"
              >
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Tìm kiếm phòng, cư dân...</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white text-slate-500 rounded border border-slate-200 font-bold">
                  ⌘K
                </span>
              </button>
            )}

            {/* Language Selector Compact */}
            <div className="hidden sm:block">
              <LanguageSelector variant="compact" />
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifsOpen(true)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title={t('nav.notifications', 'Notifications')}
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
                  {unreadNotifs}
                </span>
              )}
            </button>

            {/* Back to website button */}
            {onBackToPublic && (
              <button
                onClick={onBackToPublic}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{t('nav.browse_rooms', 'Browse Rooms')}</span>
              </button>
            )}
          </div>
        </header>

        {/* Body View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotifsOpen}
        onClose={() => setIsNotifsOpen(false)}
        onSelectEntity={(type) => {
          setIsNotifsOpen(false);
          if (type.includes('INVOICE') || type.includes('PAYMENT')) {
            onSelectTab('invoices');
          } else if (type.includes('APPLICATION')) {
            onSelectTab('applications');
          } else if (type.includes('SERVICE')) {
            onSelectTab('services');
          }
        }}
      />
    </div>
  );
};
