import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/reports', '/report', '/transparency', '/login', '/register'];
  const now = new Date();
  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/reports' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
