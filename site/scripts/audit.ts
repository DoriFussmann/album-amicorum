import { fileURLToPath } from 'node:url';
import { runAudit } from 'seo-core/audit';
import { SITE_NAME, SITE_URL } from '../src/config/site';
import { ARTICLE_PILLARS } from '../src/lib/pillars';

runAudit({
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  articlesBase: 'articles',
  distDir: fileURLToPath(new URL('../dist/client', import.meta.url)),
  articlesDir: fileURLToPath(new URL('../src/content/articles', import.meta.url)),
  requireKeyTakeaways: false,
  requireWts: false,
  pillarHubs: ARTICLE_PILLARS.map((pillar) => `/articles/${pillar.slug}/`),
});
