export const ARTICLE_PILLARS = [
  {
    name: 'Friend Books & Friendship Keepsakes',
    slug: 'friend-books',
    description:
      'Guides to Friend Books and the album amicorum tradition: how children collect handwritten memories and keepsakes from the friends who shape their childhood.',
  },
  {
    name: 'Meaningful & Screen-Free Gifts',
    slug: 'screen-free-gifts',
    description:
      'When a friendship book makes a meaningful, screen-free gift: occasions for giving a keepsake children fill by hand with stories and drawings.',
  },
  {
    name: 'Childhood Friendship & Connection',
    slug: 'childhood-friendship',
    description:
      'How childhood friendship takes root, and the friendship activities families can share at home so connection happens in person, not on a screen.',
  },
  {
    name: "Children's Keepsakes & Memory",
    // Brief asked for /articles/childrens-keepsakes/, but that slug is already the article childrens-keepsakes.md.
    slug: 'childrens-keepsakes-and-memory',
    description:
      'What is worth keeping from childhood, and analog activities that leave a physical memory: pages, drawings, and objects children can return to as they grow.',
  },
  {
    name: 'Slow Childhood & Analog Play',
    slug: 'slow-childhood-analog-play',
    description:
      'Analog toys, handwriting, and screen-free days: practical reading for families who want a slower childhood with more making, writing, and play.',
  },
] as const;

export type ArticlePillar = (typeof ARTICLE_PILLARS)[number];

export function pillarByName(name: string | undefined): ArticlePillar | undefined {
  if (!name) return undefined;
  return ARTICLE_PILLARS.find((pillar) => pillar.name === name);
}

export function pillarBySlug(slug: string): ArticlePillar | undefined {
  return ARTICLE_PILLARS.find((pillar) => pillar.slug === slug);
}

export function pillarHref(name: string | undefined): string | undefined {
  const pillar = pillarByName(name);
  return pillar ? `/articles/${pillar.slug}/` : undefined;
}
