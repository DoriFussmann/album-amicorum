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
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
});
