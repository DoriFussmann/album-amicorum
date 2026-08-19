import type Stripe from 'stripe';
import { Resend } from 'resend';
import { formatMoney } from './cart';
import { getEnv } from './serverEnv';
import { getStripe } from './stripeServer';

function formatAddress(address: Stripe.Address | null | undefined): string {
  if (!address) return '(none provided)';
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
  return lines.join('\n') || '(none provided)';
}

function formatAmountFromCents(cents: number | null | undefined): string {
  if (typeof cents !== 'number') return '—';
  return formatMoney(cents / 100);
}

export async function sendOrderOpsEmail(params: {
  session: Stripe.Checkout.Session;
  lineItems: Stripe.LineItem[];
}): Promise<'sent' | 'skipped' | 'failed'> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey || apiKey.includes('PASTE_HERE')) {
    console.warn(
      '[orders] RESEND_API_KEY not configured — skipping ops email for session',
      params.session.id,
    );
    return 'skipped';
  }

  const to = getEnv('ORDER_NOTIFY_EMAIL') || 'hello@albumamicorum.com';
  const from = getEnv('ORDER_FROM_EMAIL') || 'hello@albumamicorum.com';
  const session = params.session;
  const shortId = session.id.replace(/^cs_test_/, '').replace(/^cs_live_/, '').slice(0, 12);

  const itemLines = params.lineItems
    .map((item) => {
      const name = item.description || item.price?.nickname || 'Item';
      const qty = item.quantity ?? 1;
      const amount = formatAmountFromCents(item.amount_total);
      return `- ${name} × ${qty} — ${amount}`;
    })
    .join('\n');

  const customerName =
    session.customer_details?.name ||
    session.shipping_details?.name ||
    '(not provided)';
  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    '(not provided)';
  const shippingAddress =
    session.collected_information?.shipping_details?.address ||
    session.shipping_details?.address ||
    session.customer_details?.address;

  const text = [
    'New Friend Book order',
    '',
    `Stripe session: ${session.id}`,
    `Payment status: ${session.payment_status}`,
    '',
    'Items:',
    itemLines || '- (none)',
    '',
    `Subtotal: ${formatAmountFromCents(session.amount_subtotal)}`,
    `Shipping: ${formatAmountFromCents(
      typeof session.total_details?.amount_shipping === 'number'
        ? session.total_details.amount_shipping
        : null,
    )}`,
    `Total: ${formatAmountFromCents(session.amount_total)}`,
    `Currency: ${(session.currency || 'usd').toUpperCase()}`,
    '',
    `Customer name: ${customerName}`,
    `Customer email: ${customerEmail}`,
    '',
    'Shipping address:',
    formatAddress(shippingAddress),
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `Album Amicorum <${from}>`,
      to: [to],
      subject: `New Friend Book order — ${shortId}`,
      text,
    });

    if (result.error) {
      console.error('[orders] Resend error:', result.error);
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('[orders] Failed to send ops email:', error);
    return 'failed';
  }
}

function getCustomerEmail(session: Stripe.Checkout.Session): string | null {
  const email = session.customer_details?.email || session.customer_email;
  if (!email || !email.includes('@')) return null;
  return email.trim();
}

/** Branded buyer confirmation (Website Spec confirmation email copy). */
export async function sendCustomerConfirmationEmail(params: {
  session: Stripe.Checkout.Session;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const apiKey = getEnv('RESEND_API_KEY');
  if (!apiKey || apiKey.includes('PASTE_HERE')) {
    console.warn('[orders] RESEND_API_KEY not configured — skipping customer email');
    return 'skipped';
  }

  const to = getCustomerEmail(params.session);
  if (!to) {
    console.warn('[orders] No customer email on session — skipping customer email');
    return 'skipped';
  }

  const from = getEnv('ORDER_FROM_EMAIL') || 'hello@albumamicorum.com';
  const text = [
    'Hello,',
    '',
    'Thank you for choosing My Friends Book.',
    '',
    "We're delighted that another collection of childhood memories is about to begin.",
    '',
    "We'll send another email as soon as your order ships.",
    '',
    'In the meantime, thank you for supporting a slower, more thoughtful way of preserving childhood.',
    '',
    'With gratitude,',
    '',
    'Album Amicorum',
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `Album Amicorum <${from}>`,
      to: [to],
      subject: 'Your Friend Book is on its way.',
      text,
    });

    if (result.error) {
      console.error('[orders] Customer email Resend error:', result.error);
      return 'failed';
    }
    console.info('[orders] Customer confirmation email sent to', to);
    return 'sent';
  } catch (error) {
    console.error('[orders] Failed to send customer email:', error);
    return 'failed';
  }
}

/** Ask Stripe to email its own receipt to the buyer when possible. */
export async function attachStripeReceiptEmail(params: {
  session: Stripe.Checkout.Session;
}): Promise<void> {
  const email = getCustomerEmail(params.session);
  const paymentIntentId = params.session.payment_intent;
  if (!email || !paymentIntentId || typeof paymentIntentId !== 'string') return;

  try {
    const stripe = getStripe();
    await stripe.paymentIntents.update(paymentIntentId, {
      receipt_email: email,
    });
  } catch (error) {
    // Non-fatal: branded Resend email is the reliable buyer confirmation.
    console.warn('[orders] Could not set Stripe receipt_email:', error);
  }
}
