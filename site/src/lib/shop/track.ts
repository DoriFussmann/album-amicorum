import { ANALYTICS_ID, GOOGLE_ADS_ID, GOOGLE_ADS_LABELS } from '../../config/publicEnv';
import { cartSubtotal, parsePrice, SHIPPING_FLAT_RATE, type CartItem } from './cart';

type Gtag = (...args: unknown[]) => void;
type ShopEvent = 'add_to_cart' | 'begin_checkout' | 'purchase';

const FIRED_KEY = 'album-amicorum-tracked-orders';

function gtag(): Gtag | null {
  const fn = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof fn === 'function' ? fn : null;
}

function toItems(items: CartItem[]) {
  return items.map((item) => ({
    item_id: item.slug,
    item_name: item.title,
    price: parsePrice(item.price),
    quantity: item.quantity,
  }));
}

/**
 * Send a shop event to GA4 (standard ecommerce event) and, when a label is
 * configured, to Google Ads as a conversion. Never throws.
 */
export function trackShopEvent(event: ShopEvent, items: CartItem[], transactionId?: string): void {
  try {
    const g = gtag();
    if (!g || !items.length) return;
    const value = cartSubtotal(items) + (event === 'purchase' ? SHIPPING_FLAT_RATE : 0);
    if (ANALYTICS_ID) {
      g('event', event, {
        currency: 'USD',
        value,
        items: toItems(items),
        ...(transactionId ? { transaction_id: transactionId, shipping: SHIPPING_FLAT_RATE } : {}),
      });
    }
    const label = GOOGLE_ADS_LABELS[event];
    if (GOOGLE_ADS_ID && label) {
      g('event', 'conversion', {
        send_to: `${GOOGLE_ADS_ID}/${label}`,
        value,
        currency: 'USD',
        ...(transactionId ? { transaction_id: transactionId } : {}),
      });
    }
  } catch {
    // Tracking must never break the shop.
  }
}

/** Fire the purchase event once per Stripe session, even if the page is reloaded. */
export function trackPurchaseOnce(sessionId: string, items: CartItem[]): void {
  try {
    const fired = JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? '[]') as string[];
    if (fired.includes(sessionId)) return;
    trackShopEvent('purchase', items, sessionId);
    window.localStorage.setItem(FIRED_KEY, JSON.stringify([...fired, sessionId].slice(-20)));
  } catch {
    trackShopEvent('purchase', items, sessionId);
  }
}

/**
 * Count clicks on "Buy on Amazon" links ([data-amazon-link="<slug>"]) in GA4 and,
 * when the label is set, as the Google Ads "Amazon link click" conversion. Bound once
 * per page with a delegated listener. Never throws.
 */
export function bindAmazonLinkTracking(): void {
  const w = window as unknown as { __aaAmazonBound?: boolean };
  if (w.__aaAmazonBound) return;
  w.__aaAmazonBound = true;
  document.addEventListener('click', (event) => {
    try {
      const link = (event.target as Element | null)?.closest?.('[data-amazon-link]');
      if (!link) return;
      const g = gtag();
      if (!g) return;
      const slug = link.getAttribute('data-amazon-link') || '';
      if (ANALYTICS_ID) g('event', 'amazon_click', { item_id: slug, transport_type: 'beacon' });
      const label = GOOGLE_ADS_LABELS.amazon_click;
      if (GOOGLE_ADS_ID && label) {
        g('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}`, transport_type: 'beacon' });
      }
    } catch {
      // Tracking must never block the link.
    }
  });
}
