import Stripe from 'stripe';

/**
 * Stripe Client
 * Returns null when STRIPE_API_SECRET_KEY is not set (self-hosted mode)
 */
export const stripeClient = process.env.STRIPE_API_SECRET_KEY
  ? new Stripe(process.env.STRIPE_API_SECRET_KEY)
  : null;
