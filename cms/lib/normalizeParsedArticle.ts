import { ARTICLE_FIELD_NAMES, type LinkItem } from './schema.ts';

const WTS_START_LINE = /^[ \t]*<!--\s*WHERE-THINGS-STAND:START\s*-->[ \t]*\r?\n/gm;
const WTS_END_LINE = /^[ \t]*<!--\s*WHERE-THINGS-STAND:END\s*-->[ \t]*\r?\n?/gm;

/** Remove WTS HTML comment marker lines only — keep heading + body content in place. */
export function stripWhereThingsStandMarkers(body: string): string {
  return body.replace(WTS_START_LINE, '').replace(WTS_END_LINE, '');
}

function asLinkArray(value: unknown): LinkItem[] {
  if (!Array.isArray(value)) return [];
  const out: LinkItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const label = typeof (item as { label?: unknown }).label === 'string'
      ? (item as { label: string }).label.trim()
      : '';
    const url = typeof (item as { url?: unknown }).url === 'string'
      ? (item as { url: string }).url.trim()
      : '';
    if (!url && !label) continue;
    out.push({ label, url });
  }
  return out;
}

/**
 * Convert whereThingsStandSources → externalLinks (append, dedup by url),
 * then drop every frontmatter key not in ARTICLE_FIELD_NAMES.
 */
export function normalizeParsedFrontmatter(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sources = Array.isArray(data.whereThingsStandSources)
    ? data.whereThingsStandSources
    : [];

  const externalLinks = asLinkArray(data.externalLinks);
  const seenUrls = new Set(
    externalLinks.map((l) => l.url).filter((u) => Boolean(u))
  );

  for (const raw of sources) {
    if (!raw || typeof raw !== 'object') continue;
    const url =
      typeof (raw as { url?: unknown }).url === 'string'
        ? (raw as { url: string }).url.trim()
        : '';
    if (!url || seenUrls.has(url)) continue;
    const note =
      typeof (raw as { note?: unknown }).note === 'string'
        ? (raw as { note: string }).note.trim()
        : '';
    externalLinks.push({ label: note || url, url });
    seenUrls.add(url);
  }

  const normalized: Record<string, unknown> = {};
  for (const key of ARTICLE_FIELD_NAMES) {
    if (key === 'externalLinks') {
      if (externalLinks.length) normalized.externalLinks = externalLinks;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      normalized[key] = data[key];
    }
  }

  return normalized;
}

export function normalizeParsedArticle(opts: {
  data: Record<string, unknown>;
  body: string;
}): { data: Record<string, unknown>; body: string } {
  return {
    data: normalizeParsedFrontmatter(opts.data ?? {}),
    body: stripWhereThingsStandMarkers(opts.body ?? '').trim(),
  };
}
