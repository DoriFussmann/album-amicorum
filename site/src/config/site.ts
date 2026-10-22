import { DEFAULT_AI_CRAWLERS, type CrawlerPolicy, type SiteIdentity } from "seo-core";

export const SITE_URL = "https://www.albumamicorum.com";
export const SITE_NAME = "Album Amicorum";
export const SITE_TAGLINE = "Friend Books & Memory Books for Kids"; // used in homepage <title>
/** Public brand profiles. */
export const SOCIAL_LINKS = [
  { name: "instagram", label: "Instagram", href: "https://www.instagram.com/albumamicorumbooks/" },
  { name: "etsy", label: "Etsy shop", href: "https://www.etsy.com/shop/AlbumAmicorum" },
] as const;
/** Official brand profiles (LinkedIn company page, Crunchbase, X…). The audit warns while empty. */
export const SAME_AS: string[] = SOCIAL_LINKS.map((link) => link.href);
/** Organization logo: PNG/JPEG/WebP in public/, at least 112×112px (the audit fails SVG and favicons). */
export const LOGO_PATH = "/logo.png";
/** Open Graph image for pages without their own (1200×675, matches BaseLayout's og:image size). */
export const DEFAULT_OG_IMAGE = "/og-default.jpg";
export const ARTICLES_BASE = "articles";          // URL segment; changing later requires redirects
export const DEFAULT_AUTHOR = "dori-fussmann";
/** Hosts that must never appear in externalLinks (used by the local CMS checks). */
export const FORBIDDEN_EXTERNAL_HOSTS = ["example.com", "www.example.com"] as const;
export const CONTACT_EMAIL = "hello@albumamicorum.com";
/** seo-core's default list (CCBot allowed on purpose). Override single entries here if a site must differ. */
export const AI_CRAWLERS: Record<string, CrawlerPolicy> = { ...DEFAULT_AI_CRAWLERS };

export const SITE_IDENTITY: SiteIdentity = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  logo: LOGO_PATH,
  sameAs: SAME_AS,
};

export const NAV: { label: string; href: string }[] = [
  { label: "The Books", href: "/friend-book/" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Our Story", href: "/our-story/" },
  { label: "Articles", href: `/${ARTICLES_BASE}/` },
];

export const HEADER_CTA = { label: "Shop the Collection", href: "/friend-book/" };

export const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "Shipping & Returns", href: "/shipping-returns/" },
  { label: "Privacy", href: "/privacy/" },
  { label: "Terms", href: "/terms/" },
];

if (!NAV.some((item) => item.href === `/${ARTICLES_BASE}/`)) {
  throw new Error("Articles must stay in NAV");
}
