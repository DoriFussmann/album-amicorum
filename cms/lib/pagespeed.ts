const PAGESPEED_ENDPOINT =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const CATEGORIES = [
  'performance',
  'accessibility',
  'best-practices',
  'seo',
] as const;

const CATEGORY_KEYS = {
  performance: 'performance',
  accessibility: 'accessibility',
  'best-practices': 'bestPractices',
  seo: 'seo',
} as const;

export type PagespeedScores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
};

export type PagespeedStrategyResult = {
  ok: boolean;
  strategy: 'mobile' | 'desktop';
  scores: PagespeedScores | null;
  error: string | null;
  finalUrl: string | null;
  fetchTime: string | null;
};

function scoreTo100(raw: unknown): number | null {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  return Math.round(raw * 100);
}

export function pagespeedConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PAGESPEED_API_KEY?.trim());
}

export function scoreBand(score: number | null | undefined): 'green' | 'orange' | 'red' | 'gray' {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'gray';
  if (score >= 90) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

/**
 * Run PageSpeed Insights for one strategy (mobile | desktop).
 */
export async function runPagespeedStrategy(options: {
  url: string;
  strategy: 'mobile' | 'desktop';
  signal?: AbortSignal;
}): Promise<PagespeedStrategyResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      strategy: options.strategy,
      scores: null,
      error: 'GOOGLE_PAGESPEED_API_KEY is not configured',
      finalUrl: null,
      fetchTime: null,
    };
  }

  const params = new URLSearchParams({
    url: options.url,
    strategy: options.strategy,
    key: apiKey,
  });
  for (const category of CATEGORIES) {
    params.append('category', category);
  }

  try {
    const res = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; errors?: Array<{ message?: string }> };
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        fetchTime?: string;
        finalUrl?: string;
      };
      id?: string;
    };

    if (!res.ok) {
      const message =
        data?.error?.message ||
        data?.error?.errors?.[0]?.message ||
        `PageSpeed API error (${res.status})`;
      return {
        ok: false,
        strategy: options.strategy,
        scores: null,
        error: message,
        finalUrl: null,
        fetchTime: null,
      };
    }

    const lighthouse = data.lighthouseResult || {};
    const categories = lighthouse.categories || {};
    const scores: PagespeedScores = {
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
    };
    for (const cat of CATEGORIES) {
      const key = CATEGORY_KEYS[cat];
      scores[key] = scoreTo100(categories[cat]?.score);
    }

    return {
      ok: true,
      strategy: options.strategy,
      scores,
      error: null,
      finalUrl: lighthouse.finalUrl || data.id || options.url,
      fetchTime: lighthouse.fetchTime || null,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'PageSpeed request timed out'
        : err instanceof Error
          ? err.message
          : 'PageSpeed request failed';
    return {
      ok: false,
      strategy: options.strategy,
      scores: null,
      error: message,
      finalUrl: null,
      fetchTime: null,
    };
  }
}

async function runPagespeedStrategyWithRetry(options: {
  url: string;
  strategy: 'mobile' | 'desktop';
}): Promise<PagespeedStrategyResult> {
  const first = await runPagespeedStrategy(options);
  if (first.ok) return first;
  // PSI occasionally returns transient Lighthouse errors; one retry helps.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return runPagespeedStrategy(options);
}

export async function runPagespeedBoth(url: string): Promise<{
  mobile: PagespeedStrategyResult;
  desktop: PagespeedStrategyResult;
}> {
  // Sequential — PSI is slow and quota-sensitive; avoids burst failures.
  const mobile = await runPagespeedStrategyWithRetry({ url, strategy: 'mobile' });
  const desktop = await runPagespeedStrategyWithRetry({ url, strategy: 'desktop' });
  return { mobile, desktop };
}
