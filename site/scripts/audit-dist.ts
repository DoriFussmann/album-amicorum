import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { runAudit } from "seo-core";
import { ARTICLES_BASE, SITE_NAME, SITE_URL } from "../src/config/site.ts";

const siteRoot = dirname(fileURLToPath(import.meta.url)).replace(/scripts$/, "");
const distDir = join(siteRoot, "dist");

runAudit({
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  articlesBase: ARTICLES_BASE,
  distDir,
  articlesDir: join(siteRoot, "src", "content", "articles"),
});

function walkHtml(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, acc);
    else if (name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const themeErrors: string[] = [];
const articlesHref = `/${ARTICLES_BASE}/`;
for (const file of walkHtml(distDir)) {
  const rel = relative(distDir, file).replace(/\\/g, "/");
  const $ = cheerio.load(readFileSync(file, "utf8"));
  const h1Count = $("h1").length;
  if (h1Count !== 1) themeErrors.push(`${rel}: expected exactly one h1, found ${h1Count}`);

  const headerHrefs = $("header.site-header a")
    .map((_, el) => $(el).attr("href") || "")
    .get();
  if (!headerHrefs.includes(articlesHref)) {
    themeErrors.push(`${rel}: header missing link to ${articlesHref}`);
  }

  const footerHrefs = $("footer.site-footer a")
    .map((_, el) => $(el).attr("href") || "")
    .get();
  if (!footerHrefs.includes("/privacy/")) themeErrors.push(`${rel}: footer missing link to /privacy/`);
  if (!footerHrefs.includes("/terms/")) themeErrors.push(`${rel}: footer missing link to /terms/`);

  $("[class]").each((_, el) => {
    const cls = $(el).attr("class") || "";
    if (/\bfont-serif\b/.test(cls)) themeErrors.push(`${rel}: font-serif in class "${cls}"`);
    if (/#[0-9A-Fa-f]{3,8}/.test(cls)) themeErrors.push(`${rel}: hex color in class "${cls}"`);
  });
}

if (themeErrors.length) {
  console.error(`audit-dist: ${themeErrors.length} theme error(s)`);
  for (const err of themeErrors) console.error(` - ${err}`);
  process.exit(1);
}

console.log("audit-dist: theme gates passed");
