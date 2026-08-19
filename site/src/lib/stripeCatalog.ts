import { SHIPPING_FLAT_RATE } from './cart';
import { getEnv } from './serverEnv';

export const EDITION_SLUGS = [
  'forest',
  'dinosaurs',
  'mermaids',
  'animals',
  'flowers',
  'space',
  'fairies',
] as const;

export type EditionSlug = (typeof EDITION_SLUGS)[number];

const PRICE_ENV_BY_SLUG: Record<EditionSlug, string> = {
  forest: 'STRIPE_PRICE_FOREST',
  dinosaurs: 'STRIPE_PRICE_DINOSAURS',
  mermaids: 'STRIPE_PRICE_MERMAIDS',
  animals: 'STRIPE_PRICE_ANIMALS',
  flowers: 'STRIPE_PRICE_FLOWERS',
  space: 'STRIPE_PRICE_SPACE',
  fairies: 'STRIPE_PRICE_FAIRIES',
};

export const SHIPPING_AMOUNT_CENTS = SHIPPING_FLAT_RATE * 100;

export function isEditionSlug(value: string): value is EditionSlug {
  return (EDITION_SLUGS as readonly string[]).includes(value);
}

export function getPriceIdForSlug(slug: EditionSlug): string {
  const envName = PRICE_ENV_BY_SLUG[slug];
  const priceId = getEnv(envName);
  if (!priceId || priceId.includes('PASTE_HERE') || !priceId.startsWith('price_')) {
    throw new Error(`Missing Stripe Price ID for edition "${slug}" (${envName}).`);
  }
  return priceId;
}

export type CheckoutRequestItem = {
  slug: string;
  quantity: number;
};

export type ValidatedCheckoutItem = {
  slug: EditionSlug;
  quantity: number;
  priceId: string;
};

export function validateCheckoutItems(
  items: unknown,
): { ok: true; items: ValidatedCheckoutItem[] } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Your cart is empty.' };
  }

  const merged = new Map<EditionSlug, number>();

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Invalid cart item.' };
    }
    const slug = String((raw as { slug?: unknown }).slug ?? '').trim().toLowerCase();
    const quantity = Number((raw as { quantity?: unknown }).quantity);

    if (!isEditionSlug(slug)) {
      return { ok: false, error: `Unknown edition: ${slug || '(empty)'}.` };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return { ok: false, error: 'Quantity must be between 1 and 20.' };
    }

    merged.set(slug, (merged.get(slug) ?? 0) + quantity);
  }

  try {
    const validated: ValidatedCheckoutItem[] = [...merged.entries()].map(([slug, quantity]) => ({
      slug,
      quantity: Math.min(20, quantity),
      priceId: getPriceIdForSlug(slug),
    }));
    return { ok: true, items: validated };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout is not configured.';
    return { ok: false, error: message };
  }
}

export function getSiteUrl(): string {
  const fromEnv = getEnv('PUBLIC_SITE_URL') || getEnv('SITE_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://localhost:4321';
}
