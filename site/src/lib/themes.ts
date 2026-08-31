import type { CollectionEntry } from 'astro:content';
import { SITE_NAME, SITE_URL } from '../config/site';
import { absoluteUrl } from './url';

/** Verbatim from BookCard.astro — do not paraphrase. */
export const PRODUCT_LEAD_1 =
  'My Friends Book invites friends to leave handwritten memories, drawings, favorite things, and messages that together become a keepsake unlike any other.';

/** Verbatim from BookCard.astro — do not paraphrase. */
export const PRODUCT_LEAD_2 =
  'Every completed book tells a different story because every friendship is different.';

export const PRODUCT_DESCRIPTION = `${PRODUCT_LEAD_1} ${PRODUCT_LEAD_2}`;

export const SHIPPING_NOTE = 'Shipping calculated separately at checkout.';

export const PRODUCT_GROUP_ID = `${absoluteUrl('/friend-book/')}#product-group`;

export function isSoldTheme(book: CollectionEntry<'books'>): boolean {
  return !book.data.hidden;
}

export function isListedTheme(book: CollectionEntry<'books'>): boolean {
  return !book.data.hidden && !book.data.draft;
}

export function sortThemes(books: CollectionEntry<'books'>[]): CollectionEntry<'books'>[] {
  return [...books].sort((a, b) => a.data.order - b.data.order);
}

export function offerPrice(price: string): string {
  const match = price.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]).toFixed(2) : '0.00';
}

export function hasVisibleMarkdown(body: string | undefined): boolean {
  if (!body) return false;
  return body.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
}

export function themePageTitle(title: string): string {
  return `${title} Friend Book`;
}

export function themeMetaTitle(title: string, override?: string): string {
  return override || `${title} Friend Book — ${SITE_NAME}`;
}

export function themeMetaDescription(
  title: string,
  tagline: string,
  price: string,
  override?: string,
): string {
  if (override) return override;
  const prefix = `The ${title} edition of My Friends Book — `;
  const suffix = ` A fill-in friend book children complete by hand. ${price}.`;
  const budget = 160 - prefix.length - suffix.length;
  let clipped = tagline.trim();
  if (clipped.length > budget) {
    clipped = `${clipped.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
  }
  return `${prefix}${clipped}${suffix}`;
}

export function productLd(book: CollectionEntry<'books'>): Record<string, unknown> {
  const { title, slug, price, cover } = book.data;
  return {
    '@type': 'Product',
    name: `My Friends Book — ${title}`,
    sku: slug,
    image: absoluteUrl(cover),
    description: PRODUCT_DESCRIPTION,
    brand: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    url: absoluteUrl(`/friend-book/${slug}/`),
    isVariantOf: { '@id': PRODUCT_GROUP_ID },
    offers: {
      '@type': 'Offer',
      price: offerPrice(price),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function productGroupLd(books: CollectionEntry<'books'>[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': PRODUCT_GROUP_ID,
    name: 'My Friends Book',
    description: PRODUCT_DESCRIPTION,
    brand: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    url: absoluteUrl('/friend-book/'),
    productGroupID: 'my-friends-book',
    variesBy: ['https://schema.org/pattern'],
    hasVariant: books.map((book) => productLd(book)),
  };
}
