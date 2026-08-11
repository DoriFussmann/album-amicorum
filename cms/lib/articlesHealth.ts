import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ARTICLES_DIR } from './paths.ts';
import { readArticleFile, patchArticleContent } from './writeArticle.ts';
import { SITE_URL } from './siteConfig.ts';
import {
  pagespeedConfigured,
  runPagespeedBoth,
  scoreBand,
  type PagespeedStrategyResult,
} from './pagespeed.ts';
import {
  buildExternalSearchQuery,
  dataforseoConfigured,
  searchOrganicLive,
} from './dataforseoSerp.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WTS_SOURCES_PATH = path.join(__dirname, '../data/where-things-stand-sources.json');

export const EXTERNAL_SIGNPOST =
  'For further reading, see the Sources listed below.';
export const INTERNAL_SIGNPOST = 'See Related below for more on this topic.';

/** Cap for every CMS write path that mutates externalLinks. */
export const MAX_EXTERNAL_LINKS = 5;

export type HealthStatus = 'green' | 'orange' | 'red' | 'gray' | 'unconfigured';

export type LinkRef = { label: string; url: string };

export type ArticleRecord = {
  slug: string;
  title: string;
  draft: boolean;
  description: string;
  date?: string;
  updatedDate?: string;
  h1?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaType?: string;
  author?: string;
  pillarKeyword?: string;
  supportingKeyword?: string;
  articleType?: string;
  targetKeyword?: string;
  internalLinks: LinkRef[];
  externalLinks: LinkRef[];
  faqs: unknown[];
  body: string;
};

function asLinks(value: unknown): LinkRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = String((item as LinkRef).label || '').trim();
      const url = String((item as LinkRef).url || '').trim();
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((x): x is LinkRef => Boolean(x));
}

function loadAllArticles(): ArticleRecord[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
      const fm = match ? YAML.parse(match[1]) || {} : {};
      const body = match ? String(match[2] || '').trim() : raw;
      return {
        slug: String(fm.slug || file.replace(/\.md$/, '')),
        title: String(fm.title || file),
        draft: Boolean(fm.draft),
        description: String(fm.description || ''),
        date: fm.date ? String(fm.date) : undefined,
        updatedDate: fm.updatedDate ? String(fm.updatedDate) : undefined,
        h1: fm.h1 ? String(fm.h1) : undefined,
        canonical: fm.canonical ? String(fm.canonical) : undefined,
        ogTitle: fm.ogTitle ? String(fm.ogTitle) : undefined,
        ogDescription: fm.ogDescription ? String(fm.ogDescription) : undefined,
        ogImage: fm.ogImage ? String(fm.ogImage) : undefined,
        schemaType: fm.schemaType ? String(fm.schemaType) : undefined,
        author: fm.author ? String(fm.author) : undefined,
        pillarKeyword: fm.pillarKeyword ? String(fm.pillarKeyword) : undefined,
        supportingKeyword: fm.supportingKeyword
          ? String(fm.supportingKeyword)
          : undefined,
        articleType: fm.articleType ? String(fm.articleType) : undefined,
        targetKeyword: fm.targetKeyword ? String(fm.targetKeyword) : undefined,
        internalLinks: asLinks(fm.internalLinks),
        externalLinks: asLinks(fm.externalLinks),
        faqs: Array.isArray(fm.faqs) ? fm.faqs : [],
        body,
      };
    });
}

function normalizePath(url: string): string {
  try {
    if (url.startsWith('http')) {
      return new URL(url).pathname.replace(/\/+$/, '') || '/';
    }
  } catch {
    /* ignore */
  }
  const pathOnly = url.split('#')[0].split('?')[0];
  return pathOnly.replace(/\/+$/, '') || '/';
}

function articlePath(slug: string): string {
  return `/articles/${slug}`;
}

function hasInternalLinkTo(links: LinkRef[], slug: string): boolean {
  const target = articlePath(slug);
  return links.some((l) => normalizePath(l.url) === target);
}

function isPillar(article: ArticleRecord): boolean {
  return Boolean(
    article.pillarKeyword &&
      !article.supportingKeyword &&
      article.articleType === 'comprehensive'
  );
}

function published(articles: ArticleRecord[]): ArticleRecord[] {
  return articles.filter((a) => !a.draft);
}

/** Required internal targets for an article (published only). */
export function requiredInternalTargets(
  article: ArticleRecord,
  all: ArticleRecord[]
): Array<{ slug: string; title: string; reason: string }> {
  const live = published(all);
  if (!article.pillarKeyword) return [];

  if (isPillar(article)) {
    const clusters = new Map<string, ArticleRecord[]>();
    for (const a of live) {
      if (a.slug === article.slug) continue;
      if (a.pillarKeyword !== article.pillarKeyword) continue;
      if (!a.supportingKeyword) continue;
      const list = clusters.get(a.supportingKeyword) || [];
      list.push(a);
      clusters.set(a.supportingKeyword, list);
    }
    const required: Array<{ slug: string; title: string; reason: string }> = [];
    for (const [supportingKeyword, members] of clusters) {
      const hub =
        members.find((m) => m.articleType === 'comprehensive') || members[0];
      if (!hub) continue;
      required.push({
        slug: hub.slug,
        title: hub.title,
        reason: `Pillar should link to comprehensive hub for supporting cluster "${supportingKeyword}"`,
      });
    }
    return required;
  }

  const required: Array<{ slug: string; title: string; reason: string }> = [];
  const pillar = live.find(
    (a) =>
      a.pillarKeyword === article.pillarKeyword &&
      !a.supportingKeyword &&
      a.articleType === 'comprehensive'
  );
  if (pillar) {
    required.push({
      slug: pillar.slug,
      title: pillar.title,
      reason: 'Supporting article must link to its pillar',
    });
  }

  if (article.supportingKeyword) {
    for (const sibling of live) {
      if (sibling.slug === article.slug) continue;
      if (sibling.supportingKeyword !== article.supportingKeyword) continue;
      required.push({
        slug: sibling.slug,
        title: sibling.title,
        reason: `Same supporting cluster ("${article.supportingKeyword}")`,
      });
    }
  }

  return required;
}

function scanLinks(article: ArticleRecord, all: ArticleRecord[]) {
  const externalCount = article.externalLinks.length;
  const required = requiredInternalTargets(article, all);
  const missingInternal = required.filter(
    (r) => !hasInternalLinkTo(article.internalLinks, r.slug)
  );
  const classified = Boolean(article.pillarKeyword || article.articleType);

  let status: HealthStatus = 'gray';
  const findings: string[] = [];

  const missingPillar = missingInternal.some((m) =>
    m.reason.includes('must link to its pillar')
  );

  if (!classified) {
    status = 'gray';
    findings.push(
      'Unclassified — missing pillarKeyword/articleType relationship metadata.'
    );
  } else if (externalCount <= 1 || missingPillar) {
    status = 'red';
  } else if (externalCount >= 3 && missingInternal.length === 0) {
    status = 'green';
  } else {
    status = 'orange';
  }

  if (externalCount < 3) {
    findings.push(`External links: ${externalCount}/3 (target is at least 3).`);
  } else {
    findings.push(`External links: ${externalCount} (meets target).`);
  }

  if (missingInternal.length) {
    findings.push(`Missing ${missingInternal.length} required internal link(s).`);
  } else if (classified) {
    findings.push('All required internal links present.');
  }

  const siteUrl = SITE_URL.replace(/\/+$/, '');

  return {
    status,
    findings,
    externalCount,
    internalCount: article.internalLinks.length,
    internalLinks: article.internalLinks.map((l) => ({
      ...l,
      href: l.url.startsWith('http')
        ? l.url
        : `${siteUrl}${l.url.startsWith('/') ? '' : '/'}${l.url}`,
    })),
    externalLinks: article.externalLinks.map((l) => ({
      ...l,
      href: l.url,
    })),
    missingInternal: missingInternal.map((m) => ({
      ...m,
      url: `${siteUrl}${articlePath(m.slug)}/`,
      path: `${articlePath(m.slug)}/`,
    })),
    canPropose: externalCount < 3,
    unclassified: !classified,
  };
}

function scanMeta(article: ArticleRecord) {
  const findings: string[] = [];
  const titleLen = article.title.length;
  const descLen = article.description.length;
  const titleOk = titleLen >= 55 && titleLen <= 60;
  const descOk = descLen >= 140 && descLen <= 160;
  const expectedCanonical = `${SITE_URL.replace(/\/+$/, '')}${articlePath(article.slug)}/`;
  const canonicalOk =
    !article.canonical ||
    normalizePath(article.canonical) === articlePath(article.slug);
  const ogOk = Boolean(
    (article.ogTitle || article.title) &&
      (article.ogDescription || article.description) &&
      (article.ogImage || true)
  );
  const h1Ok = !article.h1 || article.h1.length >= 20;

  if (!titleOk) findings.push(`title is ${titleLen} characters, needs 55–60.`);
  if (!descOk) findings.push(`description is ${descLen} characters, needs 140–160.`);
  if (article.canonical) {
    findings.push(
      canonicalOk
        ? `canonical present: ${article.canonical}`
        : `canonical present but unexpected: ${article.canonical}`
    );
  } else {
    findings.push(`canonical omitted — layout defaults to ${expectedCanonical}.`);
  }
  if (!ogOk) findings.push('OG title/description incomplete.');
  else findings.push('OG tags resolve (explicit or via title/description/hero).');
  if (article.h1) {
    findings.push(
      h1Ok
        ? `h1 set (${article.h1.length} chars).`
        : `h1 is ${article.h1.length} chars, needs ≥20 when set.`
    );
  } else {
    findings.push('h1 omitted — layout falls back to title.');
  }

  const status: HealthStatus =
    titleOk && descOk && canonicalOk && ogOk && h1Ok ? 'green' : 'red';

  return { status, findings, expectedCanonical };
}

function scanSchema(article: ArticleRecord) {
  const findings: string[] = [];
  const expectedTypes = ['BlogPosting', 'Person', 'BreadcrumbList'];
  if (article.faqs.length > 0) expectedTypes.push('FAQPage');

  const schemaType = article.schemaType || 'BlogPosting';
  const okType = Boolean(schemaType);
  if (!okType) findings.push('schemaType missing.');
  else findings.push(`schemaType: ${schemaType} (layout emits JSON-LD).`);

  if (!article.author) {
    findings.push('author missing — Person schema would fail at build.');
  } else {
    findings.push(`author present (${article.author}) → Person JSON-LD.`);
  }
  findings.push('BreadcrumbList always emitted by ArticleLayout.');
  if (article.faqs.length > 0) {
    findings.push(`FAQPage emitted (${article.faqs.length} FAQs).`);
  } else {
    findings.push('No FAQs — FAQPage omitted (OK).');
  }

  const status: HealthStatus =
    okType && Boolean(article.author) ? 'green' : 'red';
  return { status, findings, expectedTypes };
}

function scanSitemap(article: ArticleRecord) {
  const findings: string[] = [];
  const lastmodSource = article.updatedDate || article.date;
  if (article.draft) {
    return {
      status: 'red' as HealthStatus,
      findings: ['Draft articles are excluded from the sitemap.'],
      lastmod: null as string | null,
    };
  }
  if (!lastmodSource) {
    findings.push('No date/updatedDate — sitemap lastmod would be null.');
    return { status: 'red' as HealthStatus, findings, lastmod: null };
  }
  const d = new Date(lastmodSource);
  if (Number.isNaN(d.getTime())) {
    findings.push(`Invalid date for lastmod: ${lastmodSource}`);
    return { status: 'red' as HealthStatus, findings, lastmod: null };
  }
  findings.push(
    `Present in sitemap with lastmod from ${article.updatedDate ? 'updatedDate' : 'date'} (${d.toISOString().slice(0, 10)}).`
  );
  return {
    status: 'green' as HealthStatus,
    findings,
    lastmod: d.toISOString(),
  };
}

export type SpeedScanDetail = {
  status: HealthStatus;
  findings: string[];
  publishedUrl: string | null;
  canScan: boolean;
  scanned: boolean;
  mobile: PagespeedStrategyResult | null;
  desktop: PagespeedStrategyResult | null;
  indicatorScore: number | null;
  indicatorLabel: 'mobile Performance';
  fetchedAt: string | null;
  disabledReason: string | null;
};

type SpeedCacheEntry = {
  publishedUrl: string;
  mobile: PagespeedStrategyResult;
  desktop: PagespeedStrategyResult;
  fetchedAt: string;
};

/** In-memory PageSpeed results for the CMS process lifetime. */
const speedScanCache = new Map<string, SpeedCacheEntry>();

function strategySummary(label: string, result: PagespeedStrategyResult | null): string {
  if (!result) return `${label}: not scanned.`;
  if (!result.ok) return `${label}: ${result.error || 'scan failed'}.`;
  const s = result.scores;
  if (!s) return `${label}: no scores returned.`;
  return `${label}: Performance ${s.performance ?? '—'}, Accessibility ${s.accessibility ?? '—'}, Best Practices ${s.bestPractices ?? '—'}, SEO ${s.seo ?? '—'}.`;
}

function buildSpeedDetail(article: ArticleRecord): SpeedScanDetail {
  const configured = pagespeedConfigured();
  const publishedUrl = article.draft ? null : absoluteArticleUrl(article.slug);

  if (!publishedUrl) {
    return {
      status: 'gray',
      findings: [
        'Scan unavailable — article is not Published, so there is no live URL (published_url) to test.',
      ],
      publishedUrl: null,
      canScan: false,
      scanned: false,
      mobile: null,
      desktop: null,
      indicatorScore: null,
      indicatorLabel: 'mobile Performance',
      fetchedAt: null,
      disabledReason: 'No published URL — publish the article before scanning Speed.',
    };
  }

  if (!configured) {
    return {
      status: 'unconfigured',
      findings: [
        'Not configured — add GOOGLE_PAGESPEED_API_KEY to cms/.env.local to enable PageSpeed scans.',
      ],
      publishedUrl,
      canScan: false,
      scanned: false,
      mobile: null,
      desktop: null,
      indicatorScore: null,
      indicatorLabel: 'mobile Performance',
      fetchedAt: null,
      disabledReason: 'PageSpeed API key is not configured.',
    };
  }

  const cached = speedScanCache.get(article.slug);
  if (cached && cached.publishedUrl === publishedUrl) {
    const mobileScore = cached.mobile.ok
      ? cached.mobile.scores?.performance ?? null
      : null;
    const status = cached.mobile.ok
      ? (scoreBand(mobileScore) as HealthStatus)
      : ('red' as HealthStatus);
    return {
      status,
      findings: [
        strategySummary('Mobile', cached.mobile),
        strategySummary('Desktop', cached.desktop),
        `Indicator uses mobile Performance (${mobileScore ?? 'n/a'}).`,
      ],
      publishedUrl,
      canScan: true,
      scanned: true,
      mobile: cached.mobile,
      desktop: cached.desktop,
      indicatorScore: mobileScore,
      indicatorLabel: 'mobile Performance',
      fetchedAt: cached.fetchedAt,
      disabledReason: null,
    };
  }

  return {
    status: 'gray',
    findings: [
      'Not scanned yet — click Scan to run PageSpeed Insights (mobile + desktop). Calls are slow.',
    ],
    publishedUrl,
    canScan: true,
    scanned: false,
    mobile: null,
    desktop: null,
    indicatorScore: null,
    indicatorLabel: 'mobile Performance',
    fetchedAt: null,
    disabledReason: null,
  };
}

export async function runArticleSpeedScan(slug: string): Promise<{
  slug: string;
  title: string;
  speed: SpeedScanDetail;
}> {
  const all = loadAllArticles();
  const article = all.find((a) => a.slug === slug);
  if (!article) throw new Error(`Article not found: ${slug}`);

  const publishedUrl = article.draft ? null : absoluteArticleUrl(article.slug);
  if (!publishedUrl) {
    throw new Error(
      'Scan unavailable — article is not Published, so there is no live URL to test.'
    );
  }
  if (!pagespeedConfigured()) {
    throw new Error(
      'Not configured — add GOOGLE_PAGESPEED_API_KEY to cms/.env.local to enable PageSpeed scans.'
    );
  }

  const { mobile, desktop } = await runPagespeedBoth(publishedUrl);
  const fetchedAt = new Date().toISOString();
  speedScanCache.set(slug, { publishedUrl, mobile, desktop, fetchedAt });

  return {
    slug: article.slug,
    title: article.title,
    speed: buildSpeedDetail(article),
  };
}

export function listSpeedScanTargets(): Array<{
  slug: string;
  title: string;
  publishedUrl: string;
}> {
  return loadAllArticles()
    .filter((a) => !a.draft)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      publishedUrl: absoluteArticleUrl(a.slug),
    }));
}

export function buildArticlesHealthReport() {
  const all = loadAllArticles();
  const psiReady = pagespeedConfigured();
  const dfsReady = dataforseoConfigured();
  const articles = all.map((article) => {
    const links = scanLinks(article, all);
    const meta = scanMeta(article);
    const schema = scanSchema(article);
    const sitemap = scanSitemap(article);
    const speed = buildSpeedDetail(article);
    const publishedUrl = article.draft ? null : absoluteArticleUrl(article.slug);
    return {
      slug: article.slug,
      title: article.title,
      draft: article.draft,
      publishedUrl,
      pillarKeyword: article.pillarKeyword || null,
      supportingKeyword: article.supportingKeyword || null,
      articleType: article.articleType || null,
      targetKeyword: article.targetKeyword || null,
      indicators: {
        links: links.status,
        meta: meta.status,
        schema: schema.status,
        sitemap: sitemap.status,
        speed: speed.status,
      },
      details: { links, meta, schema, sitemap, speed },
    };
  });

  return {
    siteUrl: SITE_URL.replace(/\/+$/, ''),
    pagespeedConfigured: psiReady,
    dataforseoConfigured: dfsReady,
    articles,
  };
}

export type SourceCandidate = {
  title: string;
  url: string;
  source: string;
  note?: string;
  confidence?: 'high' | 'borderline';
};

export type ProposedExternalLink = {
  id: string;
  articleSlug: string;
  articleTitle: string;
  title: string;
  url: string;
  source: string;
  confidence: 'high' | 'borderline';
  preChecked: boolean;
  slot: number;
};

type TopicConfidence = 'high' | 'borderline' | 'reject';

const TOPIC_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'how',
  'does',
  'what',
  'with',
  'from',
  'that',
  'this',
  'are',
  'was',
  'has',
  'have',
  'into',
  'your',
  'you',
  'can',
  'not',
  'volume',
  'data',
  'guide',
  'complete',
  'best',
]);

const WEAK_TOPIC_TOKENS = new Set([
  'home',
  'homes',
  'house',
  'houses',
  'kids',
  'book',
  'books',
  'new',
  'long',
  'take',
  'last',
  'better',
  'report',
  'checklist',
]);

function normalizeKeyword(value: string | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeKeyword(value: string | undefined): string[] {
  return normalizeKeyword(value)
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !TOPIC_STOPWORDS.has(t));
}

export function urlKey(url: string): string {
  return url.replace(/\/+$/, '');
}

export function mergeExternalLinks(
  existing: LinkRef[],
  toAdd: LinkRef[]
): {
  links: LinkRef[];
  written: LinkRef[];
  skipped: Array<LinkRef & { reason: string }>;
  trimmed: LinkRef[];
} {
  let links = [...existing];
  const present = new Set(links.map((l) => urlKey(l.url)));
  const written: LinkRef[] = [];
  const skipped: Array<LinkRef & { reason: string }> = [];

  for (const link of toAdd) {
    const label = String(link.label || '').trim();
    const url = String(link.url || '').trim();
    if (!label || !url) {
      skipped.push({ label, url, reason: 'label and url are required' });
      continue;
    }
    const key = urlKey(url);
    if (present.has(key)) {
      skipped.push({ label, url, reason: 'External link already present' });
      continue;
    }
    const entry = { label, url };
    links.push(entry);
    present.add(key);
    written.push(entry);
  }

  let trimmed: LinkRef[] = [];
  if (links.length > MAX_EXTERNAL_LINKS) {
    const overflow = links.length - MAX_EXTERNAL_LINKS;
    trimmed = links.slice(0, overflow);
    links = links.slice(-MAX_EXTERNAL_LINKS);
  }

  return { links, written, skipped, trimmed };
}

function mapSourceItem(
  item: { url?: string; note?: string; title?: string },
  source: string
): SourceCandidate | null {
  const url = String(item.url || '').trim();
  if (!url.startsWith('http')) return null;
  if (url.includes('albumamicorum.com')) return null;
  return {
    url,
    title: String(item.title || item.note || url).trim(),
    note: item.note ? String(item.note) : undefined,
    source,
  };
}

function loadWtsPools(slug: string): {
  primary: SourceCandidate[];
  fallback: SourceCandidate[];
} {
  if (!fs.existsSync(WTS_SOURCES_PATH)) {
    return { primary: [], fallback: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(WTS_SOURCES_PATH, 'utf8'));
    if (Array.isArray(raw)) {
      return {
        primary: [],
        fallback: raw
          .map((item) => mapSourceItem(item, 'whereThingsStandSources'))
          .filter((x): x is SourceCandidate => Boolean(x)),
      };
    }
    const global = Array.isArray(raw.sources)
      ? raw.sources
          .map((item: { url?: string; note?: string; title?: string }) =>
            mapSourceItem(item, 'whereThingsStandSources')
          )
          .filter((x: SourceCandidate | null): x is SourceCandidate => Boolean(x))
      : [];
    const byArticle =
      raw.byArticle && typeof raw.byArticle === 'object' ? raw.byArticle : {};
    const articleList = Array.isArray(byArticle[slug]) ? byArticle[slug] : [];
    const primary = articleList
      .map((item: { url?: string; note?: string; title?: string }) =>
        mapSourceItem(item, 'whereThingsStandSources:article')
      )
      .filter((x: SourceCandidate | null): x is SourceCandidate => Boolean(x));
    return { primary, fallback: global };
  } catch {
    return { primary: [], fallback: [] };
  }
}

function extractBodyExternalLinks(body: string): SourceCandidate[] {
  const out: SourceCandidate[] = [];
  const mdLink = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLink.exec(body))) {
    out.push({ title: match[1].trim(), url: match[2].trim(), source: 'body' });
  }
  const bare = /(?<!\()(https?:\/\/[^\s)<]+)/g;
  while ((match = bare.exec(body))) {
    const url = match[1].replace(/[.,;:]+$/, '');
    if (!out.some((o) => o.url === url)) {
      out.push({ title: url, url, source: 'body' });
    }
  }
  return out;
}

function stemToken(token: string): string {
  return token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token;
}

function partitionTopicTokens(tokens: string[]): {
  strong: string[];
  weak: string[];
} {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const token of tokens) {
    if (WEAK_TOPIC_TOKENS.has(token) || WEAK_TOPIC_TOKENS.has(stemToken(token))) {
      weak.push(token);
    } else {
      strong.push(token);
    }
  }
  return { strong, weak };
}

function countHits(tokens: string[], haystack: string): number {
  return tokens.filter((t) => haystack.includes(t) || haystack.includes(stemToken(t)))
    .length;
}

export function scoreTopicRelevance(
  candidate: { title: string; url: string; note?: string },
  targetKeyword: string | undefined,
  pillarKeyword: string | undefined
): TopicConfidence {
  const target = normalizeKeyword(targetKeyword);
  const pillar = normalizeKeyword(pillarKeyword);
  if (!target && !pillar) return 'reject';

  const haystack = `${candidate.title} ${candidate.url} ${candidate.note || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ');

  const targetTokens = tokenizeKeyword(targetKeyword);
  const pillarTokens = tokenizeKeyword(pillarKeyword);
  const allTokens = [...new Set([...targetTokens, ...pillarTokens])];
  const { strong, weak } = partitionTopicTokens(allTokens);

  const targetPhraseHit = Boolean(target) && haystack.includes(target);
  const pillarPhraseHit = Boolean(pillar) && haystack.includes(pillar);
  const strongHits = countHits(strong, haystack);
  const weakHits = countHits(weak, haystack);
  const targetStrong = partitionTopicTokens(targetTokens).strong;
  const pillarStrong = partitionTopicTokens(pillarTokens).strong;
  const targetStrongHits = countHits(targetStrong, haystack);
  const pillarStrongHits = countHits(pillarStrong, haystack);

  if (strong.length > 0 && strongHits === 0 && !targetPhraseHit && !pillarPhraseHit) {
    return 'reject';
  }
  if (!targetPhraseHit && !pillarPhraseHit && strongHits === 0 && weakHits === 0) {
    return 'reject';
  }
  if (
    targetPhraseHit ||
    pillarPhraseHit ||
    strongHits >= 2 ||
    (targetStrongHits >= 1 && pillarStrongHits >= 1) ||
    (strongHits >= 1 && (targetStrongHits >= 1 || pillarStrongHits >= 1) && weakHits >= 1)
  ) {
    return 'high';
  }
  if (strongHits >= 1) return 'borderline';
  if (strong.length === 0 && weakHits >= 2) return 'borderline';
  return 'reject';
}

function collectCandidatePool(slug: string, body: string): SourceCandidate[] {
  const { primary, fallback } = loadWtsPools(slug);
  const bodyLinks = extractBodyExternalLinks(body);
  const ordered = [...primary, ...bodyLinks, ...fallback];
  const seen = new Set<string>();
  const out: SourceCandidate[] = [];
  for (const c of ordered) {
    const key = urlKey(c.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function countRejectedOffTopic(
  pool: SourceCandidate[],
  targetKeyword: string | undefined,
  pillarKeyword: string | undefined,
  existingUrls: Set<string>
): number {
  let rejected = 0;
  for (const candidate of pool) {
    if (existingUrls.has(urlKey(candidate.url))) continue;
    if (scoreTopicRelevance(candidate, targetKeyword, pillarKeyword) === 'reject') {
      rejected += 1;
    }
  }
  return rejected;
}

function filterRelevantCandidates(
  pool: SourceCandidate[],
  targetKeyword: string | undefined,
  pillarKeyword: string | undefined,
  existingUrls: Set<string>
): Array<SourceCandidate & { confidence: 'high' | 'borderline' }> {
  const out: Array<SourceCandidate & { confidence: 'high' | 'borderline' }> = [];
  for (const candidate of pool) {
    const key = urlKey(candidate.url);
    if (existingUrls.has(key)) continue;
    const confidence = scoreTopicRelevance(candidate, targetKeyword, pillarKeyword);
    if (confidence === 'reject') continue;
    out.push({ ...candidate, confidence });
  }
  out.sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === 'high' ? -1 : 1;
  });
  return out;
}

function articleTopicFields(frontmatter: Record<string, unknown>): {
  targetKeyword?: string;
  pillarKeyword?: string;
  title: string;
} {
  return {
    targetKeyword: frontmatter.targetKeyword
      ? String(frontmatter.targetKeyword)
      : undefined,
    pillarKeyword: frontmatter.pillarKeyword
      ? String(frontmatter.pillarKeyword)
      : undefined,
    title: String(frontmatter.title || ''),
  };
}

export type ProposeExternalLinksResult = {
  proposals: Array<SourceCandidate & { confidence: 'high' | 'borderline' }>;
  externalCount: number;
  slotsNeeded: number;
  rejectedOffTopic: number;
  searchQuery: string | null;
  searchUsed: boolean;
  searchError: string | null;
};

async function liveSearchCandidates(
  targetKeyword: string | undefined,
  pillarKeyword: string | undefined
): Promise<{
  searched: boolean;
  query: string | null;
  candidates: SourceCandidate[];
  error: string | null;
}> {
  const query = buildExternalSearchQuery(targetKeyword, pillarKeyword);
  if (!query) {
    return {
      searched: false,
      query: null,
      candidates: [],
      error: 'Cannot run live search — targetKeyword/pillarKeyword missing.',
    };
  }
  if (!dataforseoConfigured()) {
    return {
      searched: false,
      query,
      candidates: [],
      error:
        'Live search unavailable — add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to cms/.env.local.',
    };
  }

  const result = await searchOrganicLive({ keyword: query, depth: 20 });
  if (!result.ok) {
    return {
      searched: true,
      query,
      candidates: [],
      error: result.error || 'Live search failed',
    };
  }

  const candidates: SourceCandidate[] = [];
  const seen = new Set<string>();
  for (const item of result.items) {
    const mapped = mapSourceItem(
      {
        url: item.url,
        title: item.title,
        note: item.description,
      },
      'liveSearch:dataforseo'
    );
    if (!mapped) continue;
    const key = urlKey(mapped.url);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(mapped);
  }

  return { searched: true, query, candidates, error: null };
}

/**
 * External proposals priority:
 * 1) article-specific whereThingsStandSources
 * 2) body links
 * 3) static global source file
 * 4) live DataForSEO SERP search — only if steps 1–3 yield zero on-topic hits
 */
export async function proposeExternalLinks(
  slug: string
): Promise<ProposeExternalLinksResult> {
  const article = readArticleFile(slug);
  if (!article) throw new Error(`Article not found: ${slug}`);
  const existing = asLinks(article.frontmatter.externalLinks);
  const existingUrls = new Set(existing.map((l) => urlKey(l.url)));
  const { targetKeyword, pillarKeyword } = articleTopicFields(
    article.frontmatter as Record<string, unknown>
  );

  const pool = collectCandidatePool(slug, article.body);
  let rejectedOffTopic = countRejectedOffTopic(
    pool,
    targetKeyword,
    pillarKeyword,
    existingUrls
  );
  let relevant = filterRelevantCandidates(
    pool,
    targetKeyword,
    pillarKeyword,
    existingUrls
  );

  let searchQuery: string | null = null;
  let searchUsed = false;
  let searchError: string | null = null;

  // Live search only when static/WTS/body pools yield zero on-topic hits.
  if (relevant.length === 0) {
    const live = await liveSearchCandidates(targetKeyword, pillarKeyword);
    searchQuery = live.query;
    searchUsed = live.searched;
    if (live.error) {
      searchError = live.error;
    } else {
      rejectedOffTopic += countRejectedOffTopic(
        live.candidates,
        targetKeyword,
        pillarKeyword,
        existingUrls
      );
      relevant = filterRelevantCandidates(
        live.candidates,
        targetKeyword,
        pillarKeyword,
        existingUrls
      );
      if (!relevant.length) {
        searchError =
          'no on-topic proposals found after live search (topic filter rejected all SERP results)';
      }
    }
  }

  const slotsNeeded = Math.max(0, 3 - existing.length);
  const proposals = relevant.slice(0, Math.max(slotsNeeded, 3));

  if (proposals.length === 0 && !searchError) {
    searchError =
      'no on-topic proposals found in article-specific sources, body links, or static source file';
  }

  return {
    proposals,
    externalCount: existing.length,
    slotsNeeded,
    rejectedOffTopic,
    searchQuery,
    searchUsed,
    searchError,
  };
}

export async function proposeAllExternalLinks(options?: {
  slug?: string;
}): Promise<{
  proposals: ProposedExternalLink[];
  articlesScanned: number;
  articlesNeeding: number;
  searchErrors: Array<{ slug: string; error: string }>;
  searchUsedCount: number;
}> {
  const all = loadAllArticles();
  const targetSlugs = options?.slug
    ? all.filter((a) => a.slug === options.slug)
    : published(all).filter((a) => a.externalLinks.length < 3);

  if (options?.slug && targetSlugs.length === 0) {
    throw new Error(`Article not found: ${options.slug}`);
  }

  const proposals: ProposedExternalLink[] = [];
  const searchErrors: Array<{ slug: string; error: string }> = [];
  let articlesNeeding = 0;
  let searchUsedCount = 0;

  for (const article of targetSlugs) {
    const slotsNeeded = Math.max(0, 3 - article.externalLinks.length);
    if (slotsNeeded === 0) continue;
    articlesNeeding += 1;

    const result = await proposeExternalLinks(article.slug);
    if (result.searchUsed) searchUsedCount += 1;
    if (!result.proposals.length) {
      searchErrors.push({
        slug: article.slug,
        error: result.searchError || 'no on-topic proposals found',
      });
      continue;
    }

    const forSlots = result.proposals.slice(0, slotsNeeded);
    for (let i = 0; i < forSlots.length; i++) {
      const c = forSlots[i];
      proposals.push({
        id: `${article.slug}::${urlKey(c.url)}`,
        articleSlug: article.slug,
        articleTitle: article.title,
        title: c.title,
        url: c.url,
        source: c.source,
        confidence: c.confidence,
        // Approve is the low-friction path — checked by default.
        preChecked: true,
        slot: i + 1,
      });
    }
  }

  return {
    proposals,
    articlesScanned: targetSlugs.length,
    articlesNeeding,
    searchErrors,
    searchUsedCount,
  };
}

export function addExternalLinksSelected(
  items: Array<{ slug: string; label: string; url: string }>
): {
  written: Array<{ slug: string; label: string; url: string }>;
  skipped: Array<{ slug: string; label: string; url: string; reason: string }>;
} {
  const written: Array<{ slug: string; label: string; url: string }> = [];
  const skipped: Array<{
    slug: string;
    label: string;
    url: string;
    reason: string;
  }> = [];

  const bySlug = new Map<string, Array<{ label: string; url: string }>>();
  for (const item of items) {
    const slug = String(item.slug || '').trim();
    const label = String(item.label || '').trim();
    const url = String(item.url || '').trim();
    if (!slug || !label || !url) {
      skipped.push({ slug, label, url, reason: 'slug, label, and url are required' });
      continue;
    }
    const list = bySlug.get(slug) || [];
    list.push({ label, url });
    bySlug.set(slug, list);
  }

  for (const [slug, linksToAdd] of bySlug) {
    const existing = readArticleFile(slug);
    if (!existing) {
      for (const link of linksToAdd) {
        skipped.push({ slug, ...link, reason: 'Article not found' });
      }
      continue;
    }

    const existingLinks = Array.isArray(existing.frontmatter.externalLinks)
      ? [
          ...(existing.frontmatter.externalLinks as Array<{
            label: string;
            url: string;
          }>),
        ]
      : [];
    const merged = mergeExternalLinks(existingLinks, linksToAdd);
    for (const link of merged.written) written.push({ slug, ...link });
    for (const item of merged.skipped) skipped.push({ slug, ...item });
    if (!merged.written.length) continue;

    const body = ensureSignpost(existing.body, EXTERNAL_SIGNPOST);
    patchArticleContent(slug, {
      frontmatterPatch: { externalLinks: merged.links },
      body,
      bumpUpdatedDate: true,
    });
  }

  return { written, skipped };
}

export function ensureSignpost(body: string, signpost: string): string {
  if (body.includes(signpost)) return body;
  return `${body.trim()}\n\n${signpost}\n`;
}

export function absoluteArticleUrl(slug: string): string {
  return `${SITE_URL.replace(/\/+$/, '')}${articlePath(slug)}/`;
}

export function connectInternalLinkWrite(
  slug: string,
  targetSlug: string,
  label?: string
): {
  slug: string;
  updatedDate?: string;
  internalLinks: LinkRef[];
  connected: { slug: string; label: string; url: string; href: string };
} {
  const existing = readArticleFile(slug);
  if (!existing) throw new Error(`Article not found: ${slug}`);
  const target = readArticleFile(targetSlug);
  if (!target) throw new Error(`Target article not found: ${targetSlug}`);
  if (Boolean(target.frontmatter.draft)) {
    throw new Error(`Target article is a draft: ${targetSlug}`);
  }

  const linkLabel =
    String(label || target.frontmatter.title || targetSlug).trim() || targetSlug;
  const pathUrl = `${articlePath(targetSlug)}/`;
  const links = asLinks(existing.frontmatter.internalLinks);
  if (hasInternalLinkTo(links, targetSlug)) {
    throw new Error(`Internal link already present: ${pathUrl}`);
  }
  links.push({ label: linkLabel, url: pathUrl });
  const body = ensureSignpost(existing.body, INTERNAL_SIGNPOST);
  const result = patchArticleContent(slug, {
    frontmatterPatch: { internalLinks: links },
    body,
    bumpUpdatedDate: true,
  });

  return {
    slug: result.slug,
    updatedDate: result.updatedDate,
    internalLinks: links,
    connected: {
      slug: targetSlug,
      label: linkLabel,
      url: pathUrl,
      href: absoluteArticleUrl(targetSlug),
    },
  };
}
