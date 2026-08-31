import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './src/config/site.ts';

function loadBookFrontmatter() {
  const dir = fileURLToPath(new URL('./src/content/books', import.meta.url));
  const books = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(`${dir}/${file}`, 'utf8');
    const slug = raw.match(/^slug:\s*(\S+)/m)?.[1];
    if (!slug) continue;
    books.push({
      slug,
      draft: /^draft:\s*true\s*$/m.test(raw),
      hidden: /^hidden:\s*true\s*$/m.test(raw),
    });
  }
  return books;
}

const bookEntries = loadBookFrontmatter();

function draftThemePageUrls() {
  const urls = new Set();
  for (const book of bookEntries) {
    if (book.draft) {
      urls.add(`${SITE_URL.replace(/\/+$/, '')}/friend-book/${book.slug}/`);
    }
  }
  return urls;
}

function themeRedirects() {
  /** @type {Record<string, string>} */
  const redirects = { '/theme': '/friend-book/' };
  for (const book of bookEntries) {
    redirects[`/theme/${book.slug}`] = book.hidden
      ? '/friend-book/'
      : `/friend-book/${book.slug}/`;
  }
  return redirects;
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
    ...themeRedirects(),
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
