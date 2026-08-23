import Stripe from 'stripe';

const configuredStripeClient = process.env.STRIPE_API_SECRET_KEY
  ? new Stripe(process.env.STRIPE_API_SECRET_KEY)
  : null;

/**
 * False on self-hosted deployments, which run without Stripe: every user is
 * granted premium locally instead. Guard any billing work with this.
 */
export const isStripeEnabled = configuredStripeClient !== null;

/**
 * Typed as always-present because the billing handlers that dereference it are
 * only registered when `isStripeEnabled` — see modules/billing/index.ts, which
 * returns early with mocked routes otherwise. Reaching this with Stripe
 * unconfigured is a wiring bug, not a runtime state to handle.
 */
export const stripeClient = configuredStripeClient as Stripe;
