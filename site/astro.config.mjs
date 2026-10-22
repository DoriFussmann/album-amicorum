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
    "/articles/page/2": "/articles/2/",
    "/articles/page/3": "/articles/3/",
    "/articles/page/4": "/articles/4/",
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
