import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rehypeEmitWtsComments, rehypeKeyTakeaways, remarkPreserveWts, seoSitemap } from "seo-core";
import { SITE_URL } from "./src/config/site";

/** Book slugs and visibility, read before Astro's content layer exists. */
function loadBookFrontmatter() {
  const dir = fileURLToPath(new URL("./src/content/books", import.meta.url));
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = readFileSync(`${dir}/${file}`, "utf8");
      return {
        slug: raw.match(/^slug:\s*(\S+)/m)?.[1],
        hidden: /^hidden:\s*true\s*$/m.test(raw),
      };
    })
    .filter((book) => book.slug);
}

/** Legacy URLs from the previous site, kept so old links and bookmarks still land. */
function legacyRedirects() {
  /** @type {Record<string, string>} */
  const redirects = {
    "/pages": "/our-story/",
    "/preview": "/",
    "/theme": "/friend-book/",
    // The previous site published @astrojs/sitemap files; Search Console may still request them.
    "/sitemap-index.xml": "/sitemap.xml",
    "/sitemap-0.xml": "/sitemap.xml",
    "/articles/page/2": "/articles/2/",
    "/articles/page/3": "/articles/3/",
    "/articles/page/4": "/articles/4/",
    // Articles merged into one page per search intent (content consolidation, Oct 2026).
    "/articles/friend-books-for-kids": "/articles/friendship-book-for-kids/",
    "/articles/friendship-book-for-kids-questions": "/articles/friendship-book-for-kids/",
    "/articles/how-to-start-an-album-amicorum-tradition-with-kids": "/articles/how-to-start-a-friendship-book-for-kids/",
    "/articles/memory-book-for-kids": "/articles/how-to-start-a-friendship-book-for-kids/",
    "/articles/album-amicorum-history": "/articles/album-amicorum/",
    "/articles/amicorum-meaning": "/articles/album-amicorum/",
    "/articles/liber-amicorum": "/articles/album-amicorum/",
    "/articles/friendship-activities-for-kids-questions-parents-ask": "/articles/friendship-activities-for-kids/",
    "/articles/how-to-do-friendship-activities-at-home-with-kids": "/articles/friendship-activities-for-kids/",
    "/articles/structured-friendship-activities-vs-free-play": "/articles/friendship-activities-for-kids/",
    "/articles/analog-friendship-activities-for-kids-that-make-keepsakes": "/articles/friendship-activities-for-kids/",
    "/articles/analog-toys-for-kids-questions-answered": "/articles/analog-toys-for-kids/",
    "/articles/analog-toys-vs-digital-toys-for-kids": "/articles/analog-toys-for-kids/",
    "/articles/how-to-build-an-analog-toy-shelf-for-kids": "/articles/analog-toys-for-kids/",
    "/articles/analog-toys-for-kids-that-make-keepsakes": "/articles/analog-toys-for-kids/",
    "/articles/screen-free-childhood": "/articles/smartphone-free-childhood/",
    "/articles/smartphone-free-childhood-pact": "/articles/smartphone-free-childhood/",
    "/articles/jonathan-haidt-screen-free-childhood-advice": "/articles/smartphone-free-childhood/",
    "/articles/is-handwriting-important-for-kids": "/articles/benefits-of-handwriting-for-kids/",
    "/articles/handwriting-activities-for-kids-at-home": "/articles/handwriting-practice-for-kids/",
    "/articles/how-to-encourage-handwriting-at-home-for-kids": "/articles/handwriting-practice-for-kids/",
    "/articles/unique-gifts-for-6-year-olds-that-arent-toys": "/articles/unique-gifts-for-6-year-olds/",
    "/articles/unique-gifts-for-6-year-olds-questions-answered": "/articles/unique-gifts-for-6-year-olds/",
    "/articles/unique-gift-vs-toy-for-6-year-old": "/articles/unique-gifts-for-6-year-olds/",
    "/articles/how-to-choose-a-unique-gift-for-a-6-year-old": "/articles/unique-gifts-for-6-year-olds/",
  };
  for (const book of loadBookFrontmatter()) {
    redirects[`/theme/${book.slug}`] = book.hidden ? "/friend-book/" : `/friend-book/${book.slug}/`;
  }
  return redirects;
}

export default defineConfig({
  site: SITE_URL,
  // Pages are static; the checkout and Stripe webhook API routes opt into SSR with `prerender = false`.
  output: "static",
  adapter: vercel(),
  trailingSlash: "always",
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  redirects: legacyRedirects(),
  vite: {
    ssr: {
      noExternal: ["seo-core"],
    },
  },
  markdown: {
    remarkPlugins: [remarkPreserveWts],
    rehypePlugins: [rehypeEmitWtsComments, rehypeKeyTakeaways],
  },
  integrations: [tailwind(), seoSitemap()],
});
