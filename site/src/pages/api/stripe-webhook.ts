import type { APIRoute } from 'astro';
import {
  attachStripeReceiptEmail,
  sendCustomerConfirmationEmail,
  sendOrderOpsEmail,
} from '../../lib/orderEmail';
import { getEnv } from '../../lib/serverEnv';
import { getStripe } from '../../lib/stripeServer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret || webhookSecret.includes('PASTE_HERE')) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured.');
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items.data.price.product'],
      });
      const lineItems = fullSession.line_items?.data ?? [];
      await attachStripeReceiptEmail({ session: fullSession });
      await sendOrderOpsEmail({ session: fullSession, lineItems });
      await sendCustomerConfirmationEmail({ session: fullSession });
    } catch (error) {
      // Return 200 so Stripe does not retry forever on email failures during early setup.
      console.error('[stripe-webhook] Order processing error:', error);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
