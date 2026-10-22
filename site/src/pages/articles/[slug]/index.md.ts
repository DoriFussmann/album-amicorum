import type { APIRoute } from "astro";
import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import { generateArticleMarkdown } from "seo-core";
import { ARTICLES_BASE, SITE_URL } from "../../../config/site";

export async function getStaticPaths() {
  const articles = await getCollection("articles", ({ data }) => data.draft !== true);
  return articles.map((article) => ({
    params: { slug: article.id },
    props: { article },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { article } = props as { article: CollectionEntry<"articles"> };
  const author = await getEntry("team", article.data.author);
  if (!author) {
    throw new Error(`Missing team member "${article.data.author}" for article "${article.id}"`);
  }
  const body = generateArticleMarkdown({
    article,
    author: { name: author.data.name, id: author.id },
    siteUrl: SITE_URL,
    articlesBase: ARTICLES_BASE,
  });
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
