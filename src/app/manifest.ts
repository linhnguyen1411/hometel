import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Homtel - Căn Hộ Dịch Vụ Thông Minh',
    short_name: 'Homtel',
    description: 'Nền tảng quản lý vận hành tòa nhà và thuê căn hộ dịch vụ cao cấp.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/pwa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
