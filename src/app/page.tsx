import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Building2,
  ShieldCheck,
  Zap,
  QrCode,
  Wrench,
  TrendingUp,
  MapPin,
  Search,
  ArrowRight,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { JsonLd } from '@/components/SEO/JsonLd';

export const metadata: Metadata = {
  title: 'Homtel | Quản Lý Tòa Nhà & Thuê Căn Hộ Dịch Vụ Đà Nẵng',
  description:
    'Tìm thuê căn hộ dịch vụ cao cấp, studio view biển, phòng 1-2PN đầy đủ tiện ích tại Đà Nẵng. Hệ sinh thái Homtel hỗ trợ hợp đồng điện tử pháp lý, thanh toán VietQR và dịch vụ kỹ thuật 24/7.',
  alternates: {
    canonical: 'https://homtel.vn',
  },
};

export default function HomePage() {
  const lodgingSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: 'Homtel Property Rental Platform',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=630&q=80',
    description: 'Hệ sinh thái căn hộ dịch vụ cho thuê thông minh và nền tảng quản lý bất động sản cao cấp tại Đà Nẵng.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Trần Phú',
      addressLocality: 'Hải Châu',
      addressRegion: 'Đà Nẵng',
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 16.0748,
      longitude: 108.2235,
    },
    telephone: '+84-905-123-456',
    priceRange: '5.000.000 VND - 25.000.000 VND',
  };

  const featuredBuildings = [
    {
      id: 'bld_riverside',
      name: 'Homtel Riverside Central',
      slug: 'homtel-riverside-central',
      address: '123 Trần Phú, P. Thạch Thang, Q. Hải Châu, Đà Nẵng',
      imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      priceFrom: '6.000.000',
      tag: 'Ven Sông Hàn',
      rating: 4.9,
      reviewsCount: 28,
    },
    {
      id: 'bld_oceanview',
      name: 'Homtel Ocean View Beachfront',
      slug: 'homtel-ocean-view',
      address: '456 Võ Nguyên Giáp, P. Phước Mỹ, Q. Sơn Trà, Đà Nẵng',
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      priceFrom: '7.500.000',
      tag: 'Gần Biển Mỹ Khê',
      rating: 5.0,
      reviewsCount: 34,
    },
  ];

  const features = [
    {
      icon: ShieldCheck,
      title: 'Hợp Đồng Điện Tử Pháp Lý',
      description: 'Ký kết online qua mã OTP an toàn, chứng chỉ bằng chứng số SHA-256 có giá trị pháp lý đầy đủ.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: QrCode,
      title: 'VietQR Khớp Nợ Tự Động',
      description: 'Mã QR NAPAS 24/7 theo chuẩn chuẩn hóa, tự động gạch nợ tức thì 3 giây sau khi chuyển khoản.',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: Zap,
      title: 'Công Tơ Điện Nước IoT & OCR',
      description: 'Quét chỉ số công tơ bằng trí tuệ nhân tạo, phát hiện rò rỉ và tự động lập hóa đơn kỳ phí minh bạch.',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: Wrench,
      title: 'Dịch Vụ Tiện Ích 24/7',
      description: 'Sửa chữa điện nước, vệ sinh máy lạnh, giặt sofa với đội ngũ kỹ thuật lành nghề được đánh giá 5 sao.',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="w-full">
      <JsonLd data={lodgingSchema} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-900 text-white pt-16 pb-24 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Nền Tảng Căn Hộ Dịch Vụ Thông Minh Thế Hệ Mới
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Trải Nghiệm Sống Đẳng Cấp Tại <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300">Đà Nẵng</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
            Hệ sinh thái căn hộ dịch vụ cao cấp: Tìm phòng nhanh chóng, ký hợp đồng điện tử OTP, thanh toán hóa đơn VietQR tự động và hỗ trợ kỹ thuật tận tâm 24/7.
          </p>

          {/* Quick CTA & Search Bar */}
          <div className="pt-4 max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full flex items-center gap-2 px-4 py-3 bg-white text-slate-900 rounded-xl shadow-inner">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                <input
                  type="text"
                  placeholder="Khu vực (Hải Châu, Sơn Trà, Ngũ Hành Sơn)..."
                  className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  readOnly
                  value="Đà Nẵng • Hải Châu, Sơn Trà, Ngũ Hành Sơn"
                />
              </div>

              <Link
                href="/explore"
                className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/30 shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Tìm Phòng Ngay</span>
              </Link>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>100% Ảnh chụp & Video thực tế</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Giá niêm yết minh bạch, không phí ẩn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Ký số pháp lý trực tuyến</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Buildings Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Tòa Nhà Nổi Bật</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Vị Trí Vàng Ven Sông & Gần Biển</h2>
            <p className="text-sm text-slate-500 mt-1">Các tòa nhà do Homtel trực tiếp vận hành tiêu chuẩn cao</p>
          </div>
          <Link
            href="/explore"
            className="mt-4 md:mt-0 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>Xem tất cả tòa nhà</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {featuredBuildings.map((b) => (
            <article
              key={b.id}
              className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                <img
                  src={b.imageUrl}
                  alt={b.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-slate-900 shadow-md">
                  {b.tag}
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white drop-shadow-md">
                  <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-semibold">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>{b.rating}</span>
                    <span className="text-slate-300">({b.reviewsCount} đánh giá)</span>
                  </div>
                  <div className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-bold">
                    Từ {b.priceFrom} đ/tháng
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    <Link href={`/buildings/${b.slug}`}>
                      {b.name}
                    </Link>
                  </h3>
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{b.address}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Tiện ích: Smartlock, Bếp, Thang máy</span>
                  <Link
                    href={`/buildings/${b.slug}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Xem phòng trống</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="bg-slate-100/70 border-y border-slate-200 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Công Nghệ Đột Phá</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Chuẩn Mực Mới Trong Quản Lý Căn Hộ</h2>
            <p className="text-sm text-slate-500 mt-2">Mọi nghiệp vụ đều được số hóa tự động, minh bạch và an toàn tuyệt đối</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col space-y-3"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed flex-1">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA For Owners & Partners */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Bạn Là Chủ Tòa Nhà Hoặc Đối Tác Dịch Vụ?</h2>
            <p className="text-sm text-blue-100 leading-relaxed">
              Tối ưu tỷ lệ lấp đầy, quản lý thu chi P&L tự động và giảm 90% thời gian xử lý sự cố cùng hệ thống Homtel Smart Property.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            <Link
              href="/explore"
              className="px-6 py-3.5 bg-white text-blue-600 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-md text-center transition-colors"
            >
              Khám Phá Danh Mục
            </Link>
            <Link
              href="/services"
              className="px-6 py-3.5 bg-blue-800/60 hover:bg-blue-800 text-white border border-white/20 font-semibold text-xs rounded-xl text-center transition-colors"
            >
              Xem Dịch Vụ Tiện Ích
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
