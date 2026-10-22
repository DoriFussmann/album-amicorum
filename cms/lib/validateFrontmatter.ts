import {
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  TAGS_MIN,
  TAGS_MAX,
  ALT_MIN,
  DEFAULTS,
  type ArticleFrontmatter,
  type LinkItem,
  type FaqItem,
} from './schema.ts';
import {
  SITE_URL,
  SITE_NAME,
  FORBIDDEN_EXTERNAL_HOSTS,
} from '../../site/src/config/site.ts';

export interface SessionImages {
  image?: { stagedPath: string; originalName: string };
  image2?: { stagedPath: string; originalName: string };
  image3?: { stagedPath: string; originalName: string };
}

export interface FieldStatus {
  field: string;
  ok: boolean;
  message?: string;
}

export interface ValidationResult {
  ok: boolean;
  missing: string[];
  invalid: string[];
  statuses: FieldStatus[];
  summary: string;
  warnings: string[];
  data: Partial<ArticleFrontmatter>;
}

export function loadSiteIdentity(): { SITE_URL: string; SITE_NAME: string } {
  return { SITE_URL, SITE_NAME };
}

function isPlaceholderPath(p: unknown): boolean {
  if (typeof p !== 'string' || !p.trim()) return true;
  return /REPLACE|TODO|placeholder/i.test(p);
}

/** True when frontmatter already has a real asset path (edit keep / prior generate). */
export function isUsableExistingImagePath(p: unknown): p is string {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (p === '(session upload)') return false;
  if (isPlaceholderPath(p)) return false;
  return true;
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function knownInternalPaths(knownSlugs: {
  articles: string[];
  team: string[];
  services: string[];
}): Set<string> {
  const paths = new Set<string>(['/', '/articles/', '/team/']);
  for (const s of knownSlugs.articles) paths.add(`/articles/${s}/`);
  for (const s of knownSlugs.team) paths.add(`/team/#${s}`);
  for (const s of knownSlugs.services) paths.add(`/services/${s}/`);
  return paths;
}

function normalizeInternalUrl(url: string, siteUrl: string): string {
  try {
    if (url.startsWith('http')) {
      const u = new URL(url);
      const siteHost = new URL(siteUrl).hostname;
      if (u.hostname === siteHost) {
        return u.pathname.endsWith('/') || u.pathname.includes('#') || u.pathname.includes('.')
          ? u.pathname + u.hash
          : u.pathname + '/' + u.hash;
      }
    }
  } catch {
    /* ignore */
  }
  return url;
}

export function validateFrontmatter(opts: {
  data: Partial<ArticleFrontmatter> & Record<string, unknown>;
  sessionImages: SessionImages;
  teamSlugs: string[];
  knownSlugs: { articles: string[]; team: string[]; services: string[] };
  /** When editing, existing slug is allowed without collision warning handled elsewhere */
}): ValidationResult {
  const { data, sessionImages, teamSlugs, knownSlugs } = opts;
  const { SITE_URL } = loadSiteIdentity();
  const siteHost = hostnameOf(SITE_URL);
  if (!siteHost) {
    throw new Error('SITE_URL in site config is not a valid URL');
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];
  const statuses: FieldStatus[] = [];

  const mark = (field: string, ok: boolean, message?: string) => {
    statuses.push({ field, ok, message });
    if (!ok) {
      if (message?.toLowerCase().startsWith('missing') || message?.includes('Requires')) {
        missing.push(field);
      } else {
        invalid.push(field + (message ? ` (${message})` : ''));
      }
    }
  };

  // title
  const title = typeof data.title === 'string' ? data.title : '';
  if (!title) mark('title', false, 'Missing');
  else if (title.length < TITLE_MIN || title.length > TITLE_MAX)
    mark('title', false, `${title.length} chars, needs ${TITLE_MIN}–${TITLE_MAX}`);
  else mark('title', true);

  // description
  const description = typeof data.description === 'string' ? data.description : '';
  if (!description) mark('description', false, 'Missing');
  else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    mark(
      'description',
      false,
      `${description.length} chars, needs ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}`
    );
  else mark('description', true);

  // slug
  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  if (!slug) mark('slug', false, 'Missing');
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    mark('slug', false, 'must be lowercase kebab-case');
  else mark('slug', true);

  // date
  const dateRaw = data.date;
  const dateOk = Boolean(dateRaw) && !Number.isNaN(new Date(String(dateRaw)).valueOf());
  mark('date', dateOk, dateOk ? undefined : 'Missing or invalid date');

  // author
  const author = typeof data.author === 'string' ? data.author : '';
  if (!author) mark('author', false, 'Missing');
  else if (!teamSlugs.includes(author))
    mark('author', false, `no team member with slug "${author}"`);
  else mark('author', true);

  // category
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  mark('category', Boolean(category), category ? undefined : 'Missing');

  // tags
  const tags = Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  if (tags.length < TAGS_MIN || tags.length > TAGS_MAX)
    mark('tags', false, `${tags.length} tags, needs ${TAGS_MIN}–${TAGS_MAX}`);
  else mark('tags', true);

  // image / imageAlt — new upload or keep existing path on edit
  const hasHero =
    Boolean(sessionImages.image) || isUsableExistingImagePath(data.image);
  if (!hasHero) {
    mark('image', false, 'Missing — drop a hero image');
  } else {
    mark(
      'image',
      true,
      sessionImages.image
        ? undefined
        : 'keeping existing image'
    );
  }

  const imageAlt = typeof data.imageAlt === 'string' ? data.imageAlt.trim() : '';
  if (!hasHero) {
    mark('imageAlt', false, 'Requires a hero image');
  } else if (imageAlt.length < ALT_MIN) {
    mark('imageAlt', false, `needs at least ${ALT_MIN} characters`);
  } else {
    mark('imageAlt', true);
  }

  // defaults — always ok if present or defaultable
  mark('robots', true);
  mark('schemaType', true);
  mark('locale', true);
  mark('twitterCard', true);
  mark('draft', true);

  // updatedDate — optional, defaults to date
  mark('updatedDate', true);

  // keywords — optional but if checklist expects presence for SEO, treat empty as missing for "required SEO" — plan says optional
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.filter((k) => typeof k === 'string' && k.trim())
    : [];
  // keywords optional — ok either way, but surface as present when non-empty
  mark('keywords', true, keywords.length === 0 ? 'optional, empty' : undefined);

  // canonical optional
  const canonical = typeof data.canonical === 'string' ? data.canonical.trim() : '';
  if (canonical && !isValidHttpUrl(canonical) && !canonical.startsWith('/')) {
    mark('canonical', false, 'must be absolute URL or path');
  } else {
    mark('canonical', true, canonical ? undefined : 'optional, empty');
  }

  // image2 / image2Alt — optional; new upload or keep existing
  if (sessionImages.image2 || isUsableExistingImagePath(data.image2)) {
    mark('image2', true, sessionImages.image2 ? undefined : 'keeping existing image');
    const alt2 = typeof data.image2Alt === 'string' ? data.image2Alt.trim() : '';
    mark(
      'image2Alt',
      alt2.length >= ALT_MIN,
      alt2.length >= ALT_MIN ? undefined : `needs at least ${ALT_MIN} characters`
    );
  } else {
    mark('image2', true, 'optional, empty');
    mark('image2Alt', true, 'optional, empty');
  }

  // image3 / image3Alt — optional; new upload or keep existing
  if (sessionImages.image3 || isUsableExistingImagePath(data.image3)) {
    mark('image3', true, sessionImages.image3 ? undefined : 'keeping existing image');
    const alt3 = typeof data.image3Alt === 'string' ? data.image3Alt.trim() : '';
    mark(
      'image3Alt',
      alt3.length >= ALT_MIN,
      alt3.length >= ALT_MIN ? undefined : `needs at least ${ALT_MIN} characters`
    );
  } else {
    mark('image3', true, 'optional, empty');
    mark('image3Alt', true, 'optional, empty');
  }

  // og overrides — optional; blank is fine (omit on write)
  mark('ogTitle', true, typeof data.ogTitle === 'string' && data.ogTitle.trim() ? undefined : 'optional, empty');
  mark(
    'ogDescription',
    true,
    typeof data.ogDescription === 'string' && data.ogDescription.trim() ? undefined : 'optional, empty'
  );
  mark('ogImage', true, typeof data.ogImage === 'string' && data.ogImage.trim() ? undefined : 'optional, empty');

  // internalLinks
  const internalLinks = (Array.isArray(data.internalLinks) ? data.internalLinks : []) as LinkItem[];
  const internalPaths = knownInternalPaths(knownSlugs);
  for (const [i, link] of internalLinks.entries()) {
    if (!link.label?.trim()) {
      invalid.push(`internalLinks[${i}].label`);
    }
    if (!link.url?.trim()) {
      invalid.push(`internalLinks[${i}].url`);
    } else {
      const normalized = normalizeInternalUrl(link.url.trim(), SITE_URL);
      const pathOnly = normalized.startsWith('http')
        ? (() => {
            try {
              const u = new URL(normalized);
              return u.pathname + u.hash;
            } catch {
              return normalized;
            }
          })()
        : normalized;
      if (!internalPaths.has(pathOnly) && !internalPaths.has(pathOnly.replace(/\/$/, '') + '/')) {
        warnings.push(
          `internalLinks[${i}] URL "${link.url}" does not match a known internal page`
        );
      }
    }
  }

  // externalLinks
  const externalLinks = (Array.isArray(data.externalLinks) ? data.externalLinks : []) as LinkItem[];
  for (const [i, link] of externalLinks.entries()) {
    if (!link.label?.trim()) {
      invalid.push(`externalLinks[${i}].label (empty)`);
    }
    const url = link.url?.trim() ?? '';
    if (!isValidHttpUrl(url)) {
      invalid.push(`externalLinks[${i}].url (must be http(s) URL)`);
    } else {
      const host = hostnameOf(url);
      if (
        host === siteHost ||
        (FORBIDDEN_EXTERNAL_HOSTS as readonly string[]).includes(host ?? '')
      ) {
        invalid.push(
          `externalLinks[${i}].url (must not point at the site domain or a template placeholder host)`
        );
      }
    }
  }

  // faqs optional
  const faqs = (Array.isArray(data.faqs) ? data.faqs : []) as FaqItem[];
  for (const [i, faq] of faqs.entries()) {
    if (!faq.question?.trim() || !faq.answer?.trim()) {
      invalid.push(`faqs[${i}] (question and answer required when row present)`);
    }
  }

  // Rebuild missing/invalid from statuses for the 24 checklist fields + link errors
  const missingFields = statuses
    .filter(
      (s) =>
        !s.ok &&
        (s.message?.startsWith('Missing') || s.message?.includes('Requires'))
    )
    .map((s) => s.field);
  const invalidFields = [
    ...statuses
      .filter((s) => !s.ok && !missingFields.includes(s.field))
      .map((s) => `${s.field}${s.message ? ` (${s.message})` : ''}`),
    ...invalid.filter((x) => x.includes('[')),
  ];

  const uniqueMissing = [...new Set(missingFields)];
  const uniqueInvalid = [...new Set(invalidFields)];

  const ok = uniqueMissing.length === 0 && uniqueInvalid.length === 0;

  let summary: string;
  if (ok) {
    summary = 'All required fields present.';
  } else {
    const parts: string[] = [];
    if (uniqueMissing.length) parts.push(`Missing: ${uniqueMissing.join(', ')}`);
    if (uniqueInvalid.length) parts.push(`Invalid: ${uniqueInvalid.join(', ')}`);
    summary = parts.join(' · ');
  }

  const resolved: Partial<ArticleFrontmatter> = {
    title,
    description,
    slug,
    date: dateRaw as string,
    author,
    category,
    tags,
    imageAlt,
    robots: (data.robots as string) || DEFAULTS.robots,
    schemaType: (data.schemaType as string) || DEFAULTS.schemaType,
    locale: (data.locale as string) || DEFAULTS.locale,
    twitterCard: (data.twitterCard as string) || DEFAULTS.twitterCard,
    draft: typeof data.draft === 'boolean' ? data.draft : DEFAULTS.draft,
    updatedDate: (data.updatedDate as string) || (dateRaw as string),
    keywords: keywords.length ? keywords : undefined,
    pillarKeyword:
      typeof data.pillarKeyword === 'string' && data.pillarKeyword.trim()
        ? data.pillarKeyword.trim()
        : undefined,
    supportingKeyword:
      typeof data.supportingKeyword === 'string' && data.supportingKeyword.trim()
        ? data.supportingKeyword.trim()
        : undefined,
    articleType:
      typeof data.articleType === 'string' && data.articleType.trim()
        ? data.articleType.trim()
        : undefined,
    targetKeyword:
      typeof data.targetKeyword === 'string' && data.targetKeyword.trim()
        ? data.targetKeyword.trim()
        : undefined,
    canonical: canonical || undefined,
    image2Alt: typeof data.image2Alt === 'string' ? data.image2Alt : undefined,
    image3Alt: typeof data.image3Alt === 'string' ? data.image3Alt : undefined,
    ogTitle:
      typeof data.ogTitle === 'string' && data.ogTitle.trim() && data.ogTitle.trim() !== title
        ? data.ogTitle.trim()
        : undefined,
    ogDescription:
      typeof data.ogDescription === 'string' &&
      data.ogDescription.trim() &&
      data.ogDescription.trim() !== description
        ? data.ogDescription.trim()
        : undefined,
    ogImage:
      typeof data.ogImage === 'string' && data.ogImage.trim() ? data.ogImage.trim() : undefined,
    internalLinks: internalLinks.length ? internalLinks : undefined,
    externalLinks: externalLinks.length ? externalLinks : undefined,
    faqs: faqs.length ? faqs : undefined,
  };

  return {
    ok,
    missing: uniqueMissing,
    invalid: uniqueInvalid,
    statuses,
    summary,
    warnings,
    data: resolved,
  };
}
