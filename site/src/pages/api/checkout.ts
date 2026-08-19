import type { APIRoute } from 'astro';
import {
  SHIPPING_AMOUNT_CENTS,
  getSiteUrl,
  validateCheckoutItems,
} from '../../lib/stripeCatalog';
import { SHIPPING_COUNTRIES } from '../../lib/shippingCountries';
import { getStripe } from '../../lib/stripeServer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Something went wrong. Please try again.' }, 400);
    }

    const itemsRaw =
      body && typeof body === 'object' && 'items' in body
        ? (body as { items: unknown }).items
        : undefined;

    const validated = validateCheckoutItems(itemsRaw);
    if (!validated.ok) {
      return json({ error: validated.error }, 400);
    }

    const siteUrl = getSiteUrl();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Creates a Customer with the email entered at Checkout so Stripe's
      // "Successful payments" customer-email setting can send a receipt.
      customer_creation: 'always',
      line_items: validated.items.map((item) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      shipping_address_collection: {
        allowed_countries: [...SHIPPING_COUNTRIES],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: SHIPPING_AMOUNT_CENTS,
              currency: 'usd',
            },
            display_name: 'Flat rate · Ships worldwide',
          },
        },
      ],
      success_url: `${siteUrl}/order-confirmation/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart/`,
      metadata: {
        source: 'album-amicorum-cart',
        editions: validated.items.map((i) => `${i.slug}:${i.quantity}`).join(','),
      },
    });

    if (!session.url) {
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }

    return json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Failed to create session:', error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
