import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { SITE_URL } from './src/config/site.ts';

export default defineConfig({
  site: SITE_URL,
  // Static by default; API routes opt into SSR with `export const prerender = false`
  adapter: vercel(),
  trailingSlash: 'always',
  redirects: {
    '/our-story': '/#story',
    '/pages': '/#story',
    '/preview': '/',
    '/theme': '/friend-book/',
    '/theme/forest': '/friend-book/',
    '/theme/space': '/friend-book/?edition=space',
    '/theme/dinosaurs': '/friend-book/?edition=dinosaurs',
    '/theme/mermaids': '/friend-book/?edition=mermaids',
    '/theme/animals': '/friend-book/?edition=animals',
    '/theme/flowers': '/friend-book/?edition=flowers',
    '/theme/fairies': '/friend-book/?edition=fairies',
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
        !page.includes('/articles/page/'),
    }),
  ],
});
