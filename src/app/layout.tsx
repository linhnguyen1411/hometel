import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/index.css';
import { Providers } from '@/components/layout/Providers';
import { JsonLd } from '@/components/SEO/JsonLd';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://homtel.vn'),
  title: {
    default: 'Homtel - Nền tảng Quản lý & Thuê Căn hộ Dịch vụ Thông minh',
    template: '%s | Homtel',
  },
  description:
    'Hệ sinh thái công nghệ quản lý vận hành tòa nhà, căn hộ cho thuê thông minh, hợp đồng điện tử pháp lý, thanh toán VietQR tự động và điều phối dịch vụ kỹ thuật 24/7.',
  keywords: [
    'thuê căn hộ đà nẵng',
    'quản lý tòa nhà',
    'homtel',
    'căn hộ dịch vụ',
    'hợp đồng điện tử',
    'vietqr',
    'smart property management',
    'quản lý phòng trọ',
    'công tơ điện thông minh',
  ],
  authors: [{ name: 'Homtel Property Group' }],
  creator: 'Homtel',
  publisher: 'Homtel Property Group',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://homtel.vn',
    siteName: 'Homtel Property Rental & Management',
    title: 'Homtel - Nền tảng Quản lý & Thuê Căn hộ Dịch vụ Thông minh',
    description:
      'Hệ thống quản lý tòa nhà căn hộ cho thuê hàng đầu Việt Nam: Quản lý phòng 360, Hợp đồng điện tử ký số OTP, Hóa đơn điện nước tự động, Cổng cư dân hiện đại.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=630&q=80',
        width: 1200,
        height: 630,
        alt: 'Homtel Property Rental Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homtel - Nền tảng Quản lý & Thuê Căn hộ Dịch vụ Thông minh',
    description: 'Hệ thống quản lý tòa nhà căn hộ cho thuê thông minh.',
    images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=630&q=80'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Homtel Property Rental & Smart Operations',
    url: 'https://homtel.vn',
    logo: 'https://homtel.vn/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+84-905-123-456',
      contactType: 'customer service',
      areaServed: 'VN',
      availableLanguage: ['Vietnamese', 'English'],
    },
    sameAs: [
      'https://facebook.com/homtel.vn',
      'https://zalo.me/homtel',
    ],
  };

  return (
    <html lang="vi" className={inter.variable}>
      <head>
        <JsonLd data={organizationSchema} />
      </head>
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
