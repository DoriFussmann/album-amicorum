import Stripe from 'stripe';
import { getEnv } from './serverEnv';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const key = getEnv('STRIPE_SECRET_KEY');
  if (!key || key.includes('PASTE_HERE')) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  stripeClient = new Stripe(key, {
    apiVersion: '2026-07-29.dahlia',
  });
  return stripeClient;
}
