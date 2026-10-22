import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { generateLlmsTxt } from "seo-core";
import { ARTICLES_BASE, SITE_NAME, SITE_TAGLINE, SITE_URL } from "../config/site";

export const GET: APIRoute = async () => {
  const articles = (await getCollection("articles", ({ data }) => data.draft !== true)).sort(
    (a, b) => (b.data.updatedDate || b.data.date).localeCompare(a.data.updatedDate || a.data.date),
  );
  const team = await getCollection("team");
  const books = (await getCollection("books", ({ data }) => !data.hidden && !data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );
  const extraPages = [
    { title: "My Friends Book — the collection", path: "/friend-book/", description: "All seven illustrated editions of My Friends Book, a friend book children fill in by hand." },
    ...books.map((book) => ({
      title: `My Friends Book — ${book.data.title} edition`,
      path: `/friend-book/${book.data.slug}/`,
      description: `${book.data.tagline} ${book.data.price}.`,
    })),
    { title: "Our Story", path: "/our-story/", description: "The 450-year-old album amicorum tradition behind My Friends Book." },
  ];

  const body = generateLlmsTxt({
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    siteTagline: SITE_TAGLINE,
    articlesBase: ARTICLES_BASE,
    articles,
    team,
    extraPages,
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
