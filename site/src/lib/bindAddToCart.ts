import { addToCart } from './cart';

/** Bind existing `[data-add-to-cart]` buttons. Feedback lives in `[data-cart-scope]`. */
export function bindAddToCartButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-add-to-cart]').forEach((button) => {
    if (button.dataset.cartBound === 'true') return;
    button.addEventListener('click', () => {
      const raw = button.getAttribute('data-cart-item');
      if (!raw) return;
      try {
        const item = JSON.parse(raw) as {
          slug: string;
          title: string;
          price: string;
          cover: string;
        };
        addToCart(item);
        const scope = button.closest('[data-cart-scope]') ?? button.closest('dialog');
        const feedback = scope?.querySelector<HTMLElement>('[data-cart-feedback]');
        if (feedback) {
          feedback.textContent = `${item.title} added to your cart.`;
          feedback.classList.remove('hidden');
        }
        button.textContent = 'Added';
        window.setTimeout(() => {
          button.textContent = 'Add to Cart';
        }, 1600);
      } catch {
        // Ignore malformed cart payloads.
      }
    });
    button.dataset.cartBound = 'true';
  });
}
