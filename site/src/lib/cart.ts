export const CART_STORAGE_KEY = 'album-amicorum-cart';
export const CART_UPDATED_EVENT = 'aa:cart-updated';
export const SHIPPING_FLAT_RATE = 7;

export type CartItem = {
  slug: string;
  title: string;
  price: string;
  cover: string;
  quantity: number;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function parsePrice(price: string): number {
  const match = price.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : 0;
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function getCart(): CartItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.slug === 'string' &&
        typeof item.title === 'string' &&
        typeof item.price === 'string' &&
        typeof item.cover === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): CartItem[] {
  if (!canUseStorage()) return items;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { items } }));
  return items;
}

export function cartCount(items: CartItem[] = getCart()): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function cartSubtotal(items: CartItem[] = getCart()): number {
  return items.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);
}

export function addToCart(
  item: Omit<CartItem, 'quantity'>,
  quantity = 1,
): CartItem[] {
  const cart = getCart();
  const existing = cart.find((entry) => entry.slug === item.slug);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity });
  }
  return saveCart(cart);
}

export function setCartQuantity(slug: string, quantity: number): CartItem[] {
  const next = getCart()
    .map((item) => (item.slug === slug ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);
  return saveCart(next);
}

export function removeFromCart(slug: string): CartItem[] {
  return saveCart(getCart().filter((item) => item.slug !== slug));
}

export function clearCart(): CartItem[] {
  return saveCart([]);
}
