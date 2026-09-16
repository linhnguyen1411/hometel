import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LanguageProvider, useLanguage } from './context/LanguageContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/public/Footer.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { PropertyExplorer } from './components/public/PropertyExplorer.js';
import { ServiceCatalogView } from './components/public/ServiceCatalogView.js';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard.js';
import { OwnerDashboard } from './components/owner/OwnerDashboard.js';
import { ProviderDashboard } from './components/provider/ProviderDashboard.js';
import { TenantDashboard } from './components/tenant/TenantDashboard.js';
import { Shield } from 'lucide-react';

function MainContent() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [currentTab, setCurrentTab] = useState<string>('explore');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Render role-specific dashboard for authenticated users
  const renderDashboard = () => {
    if (!user) {
      return (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm my-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Yêu cầu Đăng nhập</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Vui lòng đăng nhập với tài khoản của bạn để truy cập Cổng quản trị và các tính năng dành riêng cho cư dân hoặc chủ nhà.
          </p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Đăng nhập / Đăng ký tài khoản
          </button>
        </div>
      );
    }

    switch (user.role) {
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard />;
      case 'OWNER':
        return <OwnerDashboard />;
      case 'PROVIDER':
        return <ProviderDashboard />;
      case 'STAFF':
        return <OwnerDashboard />;
      case 'TENANT':
        return <TenantDashboard onBrowseServices={() => setCurrentTab('services')} />;
      default:
        return <PropertyExplorer onOpenAuthModal={() => setIsAuthModalOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Primary Header with integrated User Dropdown */}
      <Header
        currentTab={currentTab}
        onSelectTab={tab => setCurrentTab(tab)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main View Area */}
      <main className={`flex-1 w-full mx-auto ${currentTab === 'dashboard' ? 'max-w-7xl px-3 sm:px-6 lg:px-8 pt-4 pb-12' : 'max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-12'}`} role="main">
        {currentTab === 'explore' && (
          <PropertyExplorer onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        )}
        {currentTab === 'services' && (
          <ServiceCatalogView
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}
        {currentTab === 'dashboard' && renderDashboard()}
      </main>

      {/* Enterprise Production Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
