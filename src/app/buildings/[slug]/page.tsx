import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Building2, Layers, CheckCircle2, ArrowRight, Shield, Zap, Droplets, Wifi, ShieldAlert } from 'lucide-react';
import { JsonLd } from '@/components/SEO/JsonLd';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getBuilding(slug: string) {
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/buildings/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (err) {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const building = await getBuilding(slug);

  if (!building) {
    return {
      title: 'Không tìm thấy tòa nhà | Homtel',
    };
  }

  return {
    title: `${building.name} - Căn Hộ Cho Thuê Đà Nẵng`,
    description: building.description || `Khám phá các phòng cho thuê tiện nghi cao cấp tại ${building.name}, ${building.address}.`,
    openGraph: {
      title: `${building.name} | Homtel`,
      description: building.description,
      images: [building.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
    },
  };
}

export default async function BuildingDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const building = await getBuilding(slug);

  if (!building) {
    notFound();
  }

  const apartmentSchema = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: building.name,
    description: building.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: building.address,
      addressLocality: building.district || 'Hải Châu',
      addressRegion: building.city || 'Đà Nẵng',
      addressCountry: 'VN',
    },
    image: building.imageUrl,
    numberOfAccommodationUnits: building.availableRooms?.length || 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <JsonLd data={apartmentSchema} />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-600">Trang chủ</Link>
        <span>/</span>
        <Link href="/explore" className="hover:text-blue-600">Khám phá</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{building.name}</span>
      </nav>

      {/* Building Hero & Main Details */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="relative aspect-[21/9] w-full bg-slate-100 overflow-hidden">
          <img
            src={building.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'}
            alt={building.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/80 backdrop-blur-md text-xs font-semibold mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Tòa Nhà Vận Hành Chuẩn Homtel</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold">{building.name}</h1>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-200 mt-2">
              <MapPin className="w-4 h-4 text-slate-300 shrink-0" />
              <span>{building.address}</span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Giới thiệu tòa nhà</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
              {building.description || 'Tòa nhà căn hộ dịch vụ cao cấp được quản lý bởi hệ thống Homtel Smart Property, trang bị đầy đủ khóa vân tay thông minh, hệ thống camera an ninh 24/7, đồng hồ điện nước IoT và dịch vụ kỹ thuật bảo trì tận tâm.'}
            </p>
          </div>

          {/* Standard Utility Rates */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Biểu Phí Dịch Vụ & Tiện Ích Niêm Yết</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Điện sinh hoạt</span>
                <span className="font-bold text-slate-900">3.500 đ/kWh</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Nước sinh hoạt</span>
                <span className="font-bold text-slate-900">15.000 đ/m³</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Internet Wifi 6</span>
                <span className="font-bold text-slate-900">100.000 đ/tháng</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-1">Giữ xe máy</span>
                <span className="font-bold text-slate-900">100.000 đ/xe</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Rooms Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Danh Sách Phòng Sẵn Sàng Cho Thuê</h2>
            <p className="text-xs text-slate-500">Đặt lịch xem phòng hoặc nộp đơn thuê trực tuyến</p>
          </div>
        </div>

        {(!building.availableRooms || building.availableRooms.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Hiện tại tất cả các phòng trong tòa nhà này đã có cư dân thuê. Vui lòng quay lại sau hoặc tham khảo các tòa nhà khác!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {building.availableRooms.map((room: any) => (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                      Phòng {room.roomNumber}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      Còn trống
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">Loại: {room.roomType}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Diện tích: {room.area} m²</span>
                      <span>•</span>
                      <span>Sức chứa: {room.capacity} người</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Giá thuê</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {room.baseRent?.toLocaleString()} đ<span className="text-xs font-normal text-slate-400">/tháng</span>
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <Link
                    href={`/rooms/${room.id}`}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Xem Chi Tiết Phòng 360</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
