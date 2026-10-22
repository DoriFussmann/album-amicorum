const TIMEOUT_MS = 45000;
const LOCATION_CODE = 2840; // United States
const LANGUAGE_CODE = 'en';

export type SerpOrganicItem = {
  title: string;
  url: string;
  description?: string;
};

export function dataforseoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim()
  );
}

function authHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

/**
 * Live Google organic SERP via DataForSEO.
 * Query format for Articles Health:
 *   "{targetKeyword} {pillarKeyword} guide OR resource OR statistics"
 */
export function buildExternalSearchQuery(
  targetKeyword: string | undefined,
  pillarKeyword: string | undefined
): string | null {
  const target = String(targetKeyword || '').trim();
  const pillar = String(pillarKeyword || '').trim();
  const head = [target, pillar].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!head) return null;
  return `${head} guide OR resource OR statistics`;
}

export async function searchOrganicLive(options: {
  keyword: string;
  depth?: number;
}): Promise<{
  ok: boolean;
  items: SerpOrganicItem[];
  error: string | null;
  keyword: string;
}> {
  const keyword = String(options.keyword || '').trim();
  if (!keyword) {
    return { ok: false, items: [], error: 'keyword is required', keyword: '' };
  }

  const auth = authHeader();
  if (!auth) {
    return {
      ok: false,
      items: [],
      error: 'DATAFORSEO_LOGIN/PASSWORD not configured',
      keyword,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      'https://api.dataforseo.com/v3/serp/google/organic/live/regular',
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keyword,
            location_code: LOCATION_CODE,
            language_code: LANGUAGE_CODE,
            depth: Math.min(Math.max(Number(options.depth) || 20, 10), 50),
          },
        ]),
        signal: controller.signal,
      }
    );

    const data = (await res.json().catch(() => null)) as {
      status_code?: number;
      status_message?: string;
      tasks?: Array<{
        status_code?: number;
        status_message?: string;
        result?: Array<{
          items?: Array<{
            type?: string;
            title?: string;
            url?: string;
            description?: string;
          }>;
        }>;
      }>;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        error: `DataForSEO HTTP ${res.status}`,
        keyword,
      };
    }
    if (!data || data.status_code !== 20000) {
      return {
        ok: false,
        items: [],
        error: data?.status_message || `status_code ${data?.status_code}`,
        keyword,
      };
    }

    const task = Array.isArray(data.tasks) ? data.tasks[0] : null;
    if (!task || task.status_code !== 20000) {
      return {
        ok: false,
        items: [],
        error: task?.status_message || `task status ${task?.status_code}`,
        keyword,
      };
    }

    const result0 = Array.isArray(task.result) ? task.result[0] : null;
    const rawItems = Array.isArray(result0?.items) ? result0.items : [];
    const items: SerpOrganicItem[] = rawItems
      .filter((item) => item?.type === 'organic' && item?.url)
      .map((item) => ({
        title: String(item.title || item.url || '').trim(),
        url: String(item.url || '').trim(),
        description: item.description ? String(item.description) : undefined,
      }))
      .filter((item) => item.url.startsWith('http'));

    return { ok: true, items, error: null, keyword };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'DataForSEO request timed out'
        : err instanceof Error
          ? err.message
          : 'DataForSEO request failed';
    return { ok: false, items: [], error: message, keyword };
  } finally {
    clearTimeout(timer);
  }
}
