import type { APIRoute } from 'astro';
import { SITE_URL } from '../config/site';

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

Sitemap: ${SITE_URL.replace(/\/+$/, '')}/sitemap-index.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
