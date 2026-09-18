import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/explore', '/services', '/buildings/', '/rooms/'],
        disallow: ['/admin', '/owner', '/provider', '/my', '/api/'],
      },
    ],
    sitemap: 'https://homtel.vn/sitemap.xml',
  };
}
