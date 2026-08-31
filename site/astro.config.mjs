import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './src/config/site.ts';

function draftThemePageUrls() {
  const dir = fileURLToPath(new URL('./src/content/books', import.meta.url));
  const urls = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(`${dir}/${file}`, 'utf8');
    if (!/^draft:\s*true\s*$/m.test(raw)) continue;
    const slug = raw.match(/^slug:\s*(\S+)/m)?.[1];
    if (slug) urls.add(`${SITE_URL.replace(/\/+$/, '')}/friend-book/${slug}/`);
  }
  return urls;
}

const draftThemePages = draftThemePageUrls();

export default defineConfig({
  site: SITE_URL,
  // Static by default; API routes opt into SSR with `export const prerender = false`
  adapter: vercel(),
  trailingSlash: 'always',
  redirects: {
    '/our-story': '/#story',
    '/pages': '/#story',
    '/preview': '/',
    '/theme': '/#collection',
    '/theme/forest': '/#collection',
    // TODO(F-01): repoint per-edition /theme/* to /books/<edition>/
    '/theme/space': '/#collection',
    '/articles/page/2': '/articles/',
    '/articles/page/3': '/articles/',
    '/articles/page/4': '/articles/',
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/cart/') &&
        !page.includes('/order-confirmation/') &&
        !page.includes('/articles/page/') &&
        !draftThemePages.has(page),
    }),
  ],
});
