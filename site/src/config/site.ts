export const SITE_URL = "https://www.albumamicorum.com";
export const SITE_NAME = "Album Amicorum";

/** Public profiles only. Add Pinterest / Amazon / Facebook when their public URLs are confirmed. */
export const SOCIAL_LINKS = [
  {
    name: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/albumamicorumbooks/",
  },
  {
    name: "etsy",
    label: "Etsy shop",
    href: "https://www.etsy.com/shop/AlbumAmicorum",
  },
] as const;

export type SocialLinkName = (typeof SOCIAL_LINKS)[number]["name"];

export const SAME_AS: string[] = SOCIAL_LINKS.map((link) => link.href);

/** Hosts that must never appear in externalLinks (template placeholder + www). */
export const FORBIDDEN_EXTERNAL_HOSTS = ["example.com", "www.example.com"] as const;
