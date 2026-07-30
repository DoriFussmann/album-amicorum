import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_NAME, SITE_URL } from '../config/site';

export async function GET(context: APIContext) {
  const articles = (await getCollection('articles'))
    .filter((a) => !a.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: SITE_NAME,
    description: `${SITE_NAME} articles`,
    site: context.site ?? SITE_URL,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.date,
      link: `/articles/${article.data.slug}/`,
    })),
  });
}
