import prisma from '@/lib/prisma';
import { FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `automationTokenHook` on routes that accept machine tokens. */
    automationSession?: { user: { id: string }; activeOrganizationId: string };
  }
}

/**
 * Machine access for automations (n8n, scripts) that need to edit pages and
 * blocks without a browser session.
 *
 * The token acts *as a real user*: the page and block handlers check
 * membership against the database, so a synthetic identity would fail those
 * checks. `LINKY_AUTOMATION_USER_ID` names the user it impersonates, and the
 * organization is resolved the same way a login does.
 *
 * Deliberately narrow: only the routes that opt in accept it, and billing,
 * auth and organization management are not among them.
 */
const AUTOMATION_TOKEN = process.env.LINKY_AUTOMATION_TOKEN;
const AUTOMATION_USER_ID = process.env.LINKY_AUTOMATION_USER_ID;

export const isAutomationTokenConfigured = Boolean(
  AUTOMATION_TOKEN && AUTOMATION_USER_ID
);

/**
 * Constant-time comparison, so a wrong token cannot be narrowed down by timing
 * how long the rejection takes. Mirrors decorators/authenticate-api-key.
 */
function matchesToken(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  // timingSafeEqual throws on a length mismatch, which would leak the length.
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

/** Reads the bearer token out of an Authorization header, if present. */
export function readBearerToken(
  header: string | string[] | undefined
): string | null {
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');

  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

/**
 * Online brute-force guard. No rate-limit plugin is installed and adding one
 * would mean a new dependency to reconcile on every upstream sync, so this
 * keeps a small in-process counter: after too many wrong tokens the API stops
 * comparing until the window passes. Single API instance, so in-memory is
 * enough; it resets on restart, which is acceptable for a throttle.
 */
const MAX_FAILURES_PER_WINDOW = 10;
const FAILURE_WINDOW_MS = 60_000;

let failureCount = 0;
let windowStartedAt = 0;

function isThrottled(now: number): boolean {
  if (now - windowStartedAt > FAILURE_WINDOW_MS) {
    failureCount = 0;
    windowStartedAt = now;
    return false;
  }

  return failureCount >= MAX_FAILURES_PER_WINDOW;
}

function recordFailure(now: number): void {
  if (now - windowStartedAt > FAILURE_WINDOW_MS) {
    windowStartedAt = now;
    failureCount = 0;
  }

  failureCount += 1;
}

/**
 * Resolves a bearer token to the session the handlers expect, or null when the
 * token is absent, wrong, or the configured user no longer has an
 * organization. Never throws: callers fall back to cookie authentication.
 */
export async function resolveAutomationSession(
  authorizationHeader: string | string[] | undefined
): Promise<{ user: { id: string }; activeOrganizationId: string } | null> {
  if (!isAutomationTokenConfigured) {
    return null;
  }

  const provided = readBearerToken(authorizationHeader);

  if (!provided) {
    return null;
  }

  const now = Date.now();

  if (isThrottled(now)) {
    return null;
  }

  if (!matchesToken(provided, AUTOMATION_TOKEN as string)) {
    recordFailure(now);
    return null;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      members: { some: { userId: AUTOMATION_USER_ID as string } },
    },
    select: { id: true },
  });

  if (!organization) {
    return null;
  }

  return {
    user: { id: AUTOMATION_USER_ID as string },
    activeOrganizationId: organization.id,
  };
}

/**
 * Register this on a route plugin to let it accept the automation token.
 * Scoped per plugin on purpose — billing, auth and organization routes never
 * see it, so a leaked token cannot touch them.
 *
 * A missing or invalid token is not an error here: the request falls through
 * to normal cookie authentication, which rejects it if there is no session.
 */
export async function automationTokenHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!isAutomationTokenConfigured) {
    return;
  }

  const session = await resolveAutomationSession(
    request.headers.authorization
  );

  if (session) {
    request.automationSession = session;
    request.log.info(
      { route: request.url, method: request.method },
      'automation token accepted'
    );
  }
}
