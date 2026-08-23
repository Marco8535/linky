'use strict';

import {
  getBillingPortalUrlHandler,
  getBillingPortalUrlSchema,
} from './handlers/billing-portal-url';
import {
  cancelSubscriptionHandler,
  cancelSubscriptionSchema,
} from './handlers/cancel-subscription';
import {
  getCurrentUserSubscriptionHandler,
  getCurrentUserSubscriptionSchema,
} from './handlers/current-user-subscription';
import { stripeWebhookHandler } from './handlers/stripe';
import {
  getUpgradeEligibilitySchema,
  getUpgradeEligibilityHandler,
} from './handlers/upgrade-eligibility';
import {
  upgradeToPremiumHandler,
  upgradeToPremiumSchema,
} from './handlers/upgrade-to-premium';
import {
  upgradeToTeamHandler,
  upgradeToTeamSchema,
} from './handlers/upgrade-to-team';
import {
  upgradeTrialHandler,
  upgradeTrialSchema,
} from './handlers/upgrade-trial';
import { FastifyInstance } from 'fastify';

export default async function billingRoutes(fastify: FastifyInstance) {
  if (!process.env.STRIPE_API_SECRET_KEY) {
    // Self-hosted mode: mock billing routes that grant premium to everyone
    fastify.post('/stripe-webhook', async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    });
    fastify.get('/subscription/me', async (_request, reply) => {
      return reply.send({
        plan: 'team',
        status: 'active',
        seats: 99,
        periodEnd: '2099-12-31T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      });
    });
    fastify.get('/upgrade-eligibility', async (_request, reply) => {
      return reply.send({ eligible: false });
    });
    fastify.post('/get-billing-portal-url', async (_request, reply) => {
      return reply.send({ url: null });
    });
    fastify.post('/cancel-subscription', async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    });
    fastify.post('/upgrade-trial', async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    });
    fastify.post('/upgrade/team', async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    });
    fastify.post('/upgrade/premium', async (_request, reply) => {
      return reply.status(200).send({ ok: true });
    });
    return;
  }

  fastify.post(
    '/stripe-webhook',
    { config: { rawBody: true } },
    stripeWebhookHandler
  );
  fastify.get(
    '/subscription/me',
    {
      schema: getCurrentUserSubscriptionSchema,
    },
    getCurrentUserSubscriptionHandler
  );
  fastify.get(
    '/upgrade-eligibility',
    { schema: getUpgradeEligibilitySchema },
    getUpgradeEligibilityHandler
  );

  fastify.post(
    '/get-billing-portal-url',
    { schema: getBillingPortalUrlSchema },
    getBillingPortalUrlHandler
  );

  fastify.post(
    '/cancel-subscription',
    { schema: cancelSubscriptionSchema },
    cancelSubscriptionHandler
  );

  fastify.post(
    '/upgrade-trial',
    { schema: upgradeTrialSchema },
    upgradeTrialHandler
  );

  fastify.post(
    '/upgrade/team',
    { schema: upgradeToTeamSchema },
    upgradeToTeamHandler
  );

  fastify.post(
    '/upgrade/premium',
    { schema: upgradeToPremiumSchema },
    upgradeToPremiumHandler
  );
}
