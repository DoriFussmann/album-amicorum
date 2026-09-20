import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { generateRss, toIsoDateString } from 'seo-core';
import { SITE_NAME, SITE_URL } from '../config/site';

const SITE_TAGLINE = 'Illustrated Friend Books for handwritten childhood memories';

export async function GET(context: APIContext) {
  const articles = (await getCollection('articles'))
    .filter((article) => !article.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return generateRss({
    siteName: SITE_NAME,
    siteTagline: SITE_TAGLINE,
    siteUrl: SITE_URL,
    articlesBase: 'articles',
    site: context.site ?? SITE_URL,
    articles: articles.map((article) => ({
      id: article.data.slug ?? article.id,
      body: article.body,
      data: {
        title: article.data.title,
        description: article.data.description,
        date: toIsoDateString(article.data.date) ?? '',
      },
    })),
  });
}
