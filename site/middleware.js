// AI-crawler tracking and SEO response headers (Vercel Routing Middleware).
// All logic lives in seo-core/middleware; this file only switches it on,
// because Vercel reads middleware from the project root (next to package.json).
// Needs seo-core >= 1.4.1. Visitors are untouched.
//
// What it does on every matched request:
//   - reports AI and search crawler hits to TNV Analytics (inert until
//     TNV_BOT_TOKEN is set on this Vercel project);
//   - nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy;
//   - Link rel="canonical" on /articles/<slug>/index.md copies;
//   - X-Robots-Tag: noindex on /llms.txt and /llms-full.txt.
//
// Not used here: the middleware's trailingSlash redirect. The Astro Vercel
// adapter already 308s /page to /page/ (trailingSlash: "always" in
// astro.config.mjs).
import { createBotMiddleware } from "seo-core/middleware";

export const config = {
  // /api/ is left out: checkout and the Stripe webhook never pass through here.
  matcher: ["/((?!_astro/|_vercel/|_image|api/|favicon).*)"],
  runtime: "nodejs",
};

export default createBotMiddleware({
  endpoint: "https://thenightventures.com/api/audit-snapshot?action=analytics.ingest",
});
