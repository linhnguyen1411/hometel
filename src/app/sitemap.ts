import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://homtel.vn';

  // Base static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Dynamic buildings from FastAPI backend
  try {
    const res = await fetch('http://127.0.0.1:8000/api/v1/buildings', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const buildings = json.data || [];
      for (const b of buildings) {
        routes.push({
          url: `${baseUrl}/buildings/${b.slug}`,
          lastModified: new Date(b.updatedAt || b.createdAt || Date.now()),
          changeFrequency: 'weekly',
          priority: 0.85,
        });
      }
    }
  } catch (err) {
    // Fallback static known buildings if backend offline during build
    routes.push(
      {
        url: `${baseUrl}/buildings/homtel-riverside-central`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.85,
      },
      {
        url: `${baseUrl}/buildings/homtel-ocean-view`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.85,
      }
    );
  }

  return routes;
}
