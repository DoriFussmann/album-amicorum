import type { APIRoute } from "astro";
import { generateRobotsTxt } from "seo-core";
import { AI_CRAWLERS, SITE_URL } from "../config/site";

export const GET: APIRoute = () => {
  return new Response(generateRobotsTxt({ siteUrl: SITE_URL, aiCrawlers: AI_CRAWLERS }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
