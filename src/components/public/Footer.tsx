import React from 'react';
import { Building, MapPin, Phone, Mail, ShieldCheck, Heart, ExternalLink, Clock, Award, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800" itemScope itemType="https://schema.org/WPFooter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          {/* Brand & Intro (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-white text-xl tracking-tight">Homtel</span>
                <span className="block text-[11px] text-blue-400 font-medium tracking-wide uppercase">Smart Property Platform</span>
              </div>
            </div>
            
            <p className="text-sm text-slate-400 leading-relaxed pr-4">
              {t('footer.about_desc', 'Hệ sinh thái công nghệ quản lý vận hành căn hộ dịch vụ và bất động sản cho thuê thế hệ mới. Minh bạch chi phí, công tơ điện tử thông minh, tự động hóa thanh toán và bảo trì tận tâm 24/7.')}
            </p>

            <div className="space-y-2 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Số 120 Đường 2/9, Phường Bình Thuận, Quận Hải Châu, TP. Đà Nẵng</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Hotline Cư Dân & Khách Hàng: <strong>1900 6868</strong> - <strong>0905 123 456</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Email hỗ trợ: support@homtel.vn • Hợp tác: contact@homtel.vn</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Thời gian hỗ trợ: 24/7 đối với sự cố khẩn cấp (Điện, Nước, Khóa phòng)</span>
              </div>
            </div>
          </div>

          {/* Quick Links - Căn hộ tại Đà Nẵng */}
          <div className="space-y-3">
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase border-l-2 border-blue-500 pl-2">
              Khu vực Tòa nhà
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#explore" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Quận Ngũ Hành Sơn (Gần Biển)
                </a>
              </li>
              <li>
                <a href="#explore" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Quận Sơn Trà (An Hải Bắc, Phước Mỹ)
                </a>
              </li>
              <li>
                <a href="#explore" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Quận Hải Châu (Trung tâm tài chính)
                </a>
              </li>
              <li>
                <a href="#explore" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Quận Cẩm Lệ & Thanh Khê
                </a>
              </li>
              <li>
                <a href="#explore" className="hover:text-blue-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Căn hộ Studio & Duplex ban công
                </a>
              </li>
            </ul>
          </div>

          {/* Dịch vụ & Tiện ích */}
          <div className="space-y-3">
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase border-l-2 border-emerald-500 pl-2">
              Dịch vụ Cư dân
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#services" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Bảo trì điều hòa & điện lạnh
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Vệ sinh buồng phòng & sofa định kỳ
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Sửa chữa khẩn cấp hệ thống cấp thoát nước
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Dịch vụ chuyển đồ & hỗ trợ dọn vào (Move-in)
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Công tơ điện tử & Hóa đơn tự động
                </a>
              </li>
            </ul>
          </div>

          {/* Pháp lý & Hỗ trợ */}
          <div className="space-y-3">
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase border-l-2 border-amber-500 pl-2">
              Quy chế & An toàn
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="hover:text-amber-400 cursor-pointer transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Chính sách cọc & hoàn trả minh bạch
                </span>
              </li>
              <li>
                <span className="hover:text-amber-400 cursor-pointer transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Nội quy an ninh & PCCC tòa nhà
                </span>
              </li>
              <li>
                <span className="hover:text-amber-400 cursor-pointer transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Bảo mật thông tin hợp đồng & thanh toán
                </span>
              </li>
              <li>
                <span className="hover:text-amber-400 cursor-pointer transition-colors flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                  Hợp đồng thuê điện tử chuẩn pháp lý
                </span>
              </li>
              <li className="pt-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-emerald-400 text-[11px] font-medium border border-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đã xác thực PCCC & An ninh trật tự
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} <strong>Homtel Platform</strong>. Bản quyền thuộc về Công ty Cổ phần Quản lý Bất động sản Homtel Việt Nam.
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <span className="hover:text-white cursor-pointer">Điều khoản sử dụng</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer">Chính sách quyền riêng tư</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer">Quy chế hoạt động</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
