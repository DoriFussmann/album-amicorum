/** Single source of truth for the article schema — field names must match site/src/content.config.ts exactly. */

export const ARTICLE_FIELD_NAMES = [
  'title',
  'description',
  'slug',
  'date',
  'author',
  'category',
  'tags',
  'image',
  'imageAlt',
  'robots',
  'schemaType',
  'locale',
  'twitterCard',
  'draft',
  'updatedDate',
  'keywords',
  'pillarKeyword',
  'supportingKeyword',
  'articleType',
  'targetKeyword',
  'canonical',
  'image2',
  'image2Alt',
  'image3',
  'image3Alt',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'internalLinks',
  'externalLinks',
  'faqs',
] as const;

export type ArticleFieldName = (typeof ARTICLE_FIELD_NAMES)[number];

/** Frontmatter fields shown in the CMS checklist (body is separate). */
export const CHECKLIST_FIELDS = [
  'title',
  'description',
  'slug',
  'date',
  'author',
  'category',
  'tags',
  'image',
  'imageAlt',
  'robots',
  'schemaType',
  'locale',
  'twitterCard',
  'draft',
  'updatedDate',
  'keywords',
  'pillarKeyword',
  'supportingKeyword',
  'articleType',
  'targetKeyword',
  'canonical',
  'image2',
  'image2Alt',
  'image3',
  'image3Alt',
  'ogTitle',
  'ogDescription',
  'ogImage',
] as const;

export const TITLE_MIN = 55;
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 140;
export const DESCRIPTION_MAX = 160;
export const TAGS_MIN = 4;
export const TAGS_MAX = 6;
export const ALT_MIN = 10;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const DEFAULTS = {
  robots: 'index, follow',
  schemaType: 'BlogPosting',
  locale: 'en-US',
  twitterCard: 'summary_large_image',
  draft: false,
} as const;

/** Default article author (team member slug) for new / bulk uploads. */
export const DEFAULT_AUTHOR_SLUG = 'dori-fussmann';

export interface LinkItem {
  label: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ArticleFrontmatter {
  title: string;
  description: string;
  slug: string;
  date: string | Date;
  author: string;
  category: string;
  tags: string[];
  image: string;
  imageAlt: string;
  robots?: string;
  schemaType?: string;
  locale?: string;
  twitterCard?: string;
  draft?: boolean;
  updatedDate?: string | Date;
  keywords?: string[];
  pillarKeyword?: string;
  supportingKeyword?: string;
  articleType?: string;
  targetKeyword?: string;
  canonical?: string;
  image2?: string;
  image2Alt?: string;
  image3?: string;
  image3Alt?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  internalLinks?: LinkItem[];
  externalLinks?: LinkItem[];
  faqs?: FaqItem[];
}
