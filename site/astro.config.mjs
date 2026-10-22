import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import { rehypeEmitWtsComments, rehypeKeyTakeaways, remarkPreserveWts, seoSitemap } from "seo-core";
import { SITE_URL } from "./src/config/site";

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  redirects: {},
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
