import { SITE_URL } from '../config/site';

const FILE_ENDPOINTS = new Set([
  'robots.txt',
  'rss.xml',
  'sitemap-index.xml',
  'sitemap.xml',
  'llms.txt',
]);

/**
 * Join SITE_URL + path with trailing-slash rules:
 * - Page routes always end with /
 * - File endpoints (robots.txt, rss.xml, sitemap-index.xml, etc.) never get a trailing slash
 */
export function absoluteUrl(path: string = '/'): string {
  const base = SITE_URL.replace(/\/+$/, '');
  let normalized = path.trim();

  if (!normalized || normalized === '/') {
    return `${base}/`;
  }

  // Strip leading slash for joining, keep query/hash out of path checks
  const [pathPart, ...rest] = normalized.split(/(?=[?#])/);
  let p = pathPart.replace(/^\/+/, '');

  const lastSegment = p.split('/').filter(Boolean).pop() ?? '';
  const isFileEndpoint = FILE_ENDPOINTS.has(lastSegment) || /\.[a-z0-9]+$/i.test(lastSegment);

  if (!isFileEndpoint && !p.endsWith('/')) {
    p = `${p}/`;
  }
  if (isFileEndpoint && p.endsWith('/')) {
    p = p.replace(/\/+$/, '');
  }

  return `${base}/${p}${rest.join('')}`;
}
