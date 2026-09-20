import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateLlmsTxt, toIsoDateString } from 'seo-core';
import { SITE_NAME, SITE_URL } from '../config/site';
import { ARTICLE_PILLARS } from '../lib/pillars';
import { isListedTheme, sortThemes } from '../lib/themes';

const SITE_TAGLINE = 'Illustrated Friend Books for handwritten childhood memories';

export const GET: APIRoute = async () => {
  const articles = (await getCollection('articles')).filter((article) => !article.data.draft);
  const books = sortThemes((await getCollection('books')).filter(isListedTheme));

  const extraPages = [
    {
      title: 'Home',
      path: '/',
      description:
        'Beautifully illustrated friend books for kids — a place to keep handwritten memories, drawings, and friendships, inspired by a 450-year-old tradition.',
    },
    {
      title: 'Articles',
      path: '/articles/',
      description:
        'Stories and guides on childhood friendship, handwritten keepsakes, and screen-free days — ideas for families who want memories that last beyond a screen.',
    },
    {
      title: 'Team',
      path: '/team/',
      description: `Meet the writers and makers behind ${SITE_NAME}, creating illustrated Friend Books that help children keep handwritten memories of childhood.`,
    },
    {
      title: 'Friend Book',
      path: '/friend-book/',
      description:
        'Beautiful Friend Books inspired by a centuries-old tradition of preserving friendships, memories, and childhood by hand.',
    },
    ...books.map((book) => ({
      title: book.data.title,
      path: `/friend-book/${book.data.slug}/`,
      description: book.data.tagline,
    })),
    ...ARTICLE_PILLARS.map((pillar) => ({
      title: pillar.name,
      path: `/articles/${pillar.slug}/`,
      description: pillar.description,
    })),
  ];

  const body = generateLlmsTxt({
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    siteTagline: SITE_TAGLINE,
    articlesBase: 'articles',
    articles: articles.map((article) => ({
      id: article.data.slug ?? article.id,
      data: {
        title: article.data.title,
        description: article.data.description,
        date: toIsoDateString(article.data.date) ?? '',
        updatedDate: article.data.updatedDate
          ? toIsoDateString(article.data.updatedDate)
          : undefined,
        pillarKeyword: article.data.pillarKeyword,
        articleType: article.data.articleType,
        supportingKeyword: article.data.supportingKeyword,
      },
    })),
    // Album team lives at /team/#slug, not /team/[id]/. Core would emit the latter.
    team: [],
    services: [],
    extraPages,
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
