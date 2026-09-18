import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, Building2, CheckCircle2, ShieldCheck, Zap, ArrowRight, UserCheck, Calendar } from 'lucide-react';
import { JsonLd } from '@/components/SEO/JsonLd';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getRoom(id: string) {
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/rooms/${id}`, {
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
  const { id } = await params;
  const room = await getRoom(id);

  if (!room) {
    return { title: 'Không tìm thấy phòng | Homtel' };
  }

  return {
    title: `Phòng ${room.roomNumber} - ${room.buildingName || 'Homtel'}`,
    description: room.description || `Căn hộ cho thuê phòng ${room.roomNumber}, diện tích ${room.area}m², giá ${room.baseRent?.toLocaleString()} đ/tháng.`,
    openGraph: {
      title: `Phòng ${room.roomNumber} - ${room.buildingName}`,
      description: `Giá thuê ${room.baseRent?.toLocaleString()} đ/tháng. Đầy đủ nội thất cao cấp.`,
      images: room.images && room.images.length > 0 ? [room.images[0]] : [],
    },
  };
}

export default async function RoomDetailPage({ params }: PageProps) {
  const { id } = await params;
  const room = await getRoom(id);

  if (!room) {
    notFound();
  }

  const roomSchema = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: `Phòng ${room.roomNumber} - ${room.buildingName}`,
    description: room.description,
    occupancy: {
      '@type': 'QuantitativeValue',
      value: room.capacity || 2,
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: room.area,
      unitCode: 'MTK',
    },
    amenityFeature: (room.amenities || []).map((a: string) => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
      value: true,
    })),
  };

  const images = room.images && room.images.length > 0 ? room.images : [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <JsonLd data={roomSchema} />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-600">Trang chủ</Link>
        <span>/</span>
        <Link href="/explore" className="hover:text-blue-600">Khám phá</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Phòng {room.roomNumber}</span>
      </nav>

      {/* Room Photo Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-3xl overflow-hidden shadow-sm">
        <div className="md:col-span-2 aspect-video bg-slate-100 overflow-hidden relative">
          <img src={images[0]} alt={`Phòng ${room.roomNumber}`} className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white">
            Phòng {room.roomNumber} • {room.roomType}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
          <div className="aspect-video bg-slate-100 overflow-hidden rounded-2xl md:rounded-none">
            <img src={images[1] || images[0]} alt="Phòng ngủ" className="w-full h-full object-cover" />
          </div>
          <div className="aspect-video bg-slate-100 overflow-hidden rounded-2xl md:rounded-none">
            <img src={images[2] || images[0]} alt="Nội thất" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Room Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Căn Hộ Phòng {room.roomNumber}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-700">{room.buildingName}</span>
                  <span>•</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{room.buildingAddress}</span>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                room.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}>
                {room.status === 'AVAILABLE' ? 'Sẵn sàng dọn vào' : room.status}
              </span>
            </div>

            {/* Room Specs */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-center">
              <div className="bg-slate-50 p-3.5 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Diện tích</span>
                <span className="text-base font-extrabold text-slate-900">{room.area} m²</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Sức chứa</span>
                <span className="text-base font-extrabold text-slate-900">{room.capacity} người</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Nội thất</span>
                <span className="text-xs font-extrabold text-slate-900">Đầy đủ cao cấp</span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 mb-2">Mô tả chi tiết</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {room.description || 'Căn hộ dịch vụ được thiết kế tối ưu công năng, ánh sáng tự nhiên ngập tràn, ban công rộng rãi thoáng mát. Trang bị đầy đủ giường nệm cao cấp, tủ quần áo âm tường, điều hòa Inverter tiết kiệm điện, khu bếp tiện nghi và nhà vệ sinh khép kín.'}
              </p>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">Tiện ích trong phòng</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(room.amenities || ['Wifi 6', 'Khóa vân tay', 'Điều hòa Inverter', 'Bếp từ', 'Máy giặt riêng', 'Ban công']).map((amenity: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Quick Booking Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-6 sticky top-20">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Giá thuê hàng tháng</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {room.baseRent?.toLocaleString()} đ
                </span>
                <span className="text-xs text-slate-400">/ tháng</span>
              </div>
            </div>

            <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-500">
                <span>Tiền cọc an toàn (2 tháng):</span>
                <span className="font-semibold text-slate-900">{((room.baseRent || 0) * 2).toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Kỳ thanh toán:</span>
                <span className="font-semibold text-slate-900">Hàng tháng (trước ngày 5)</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Hợp đồng tối thiểu:</span>
                <span className="font-semibold text-slate-900">6 - 12 tháng</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/explore"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Nộp Hồ Sơ Đăng Ký Thuê</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11px] text-center text-slate-400">
                Ký hợp đồng điện tử pháp lý & kích hoạt phòng ngay trong ngày
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
