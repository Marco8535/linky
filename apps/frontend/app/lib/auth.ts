import { auth } from '@trylinky/common';

export const { signIn, signOut, useSession } = auth;

type GetSessionOptions = Parameters<typeof auth.getSession>[0];

/** Pulls the cookie out of whichever shape the caller passed headers in. */
function readCookieHeader(headers: unknown): string {
  if (!headers) {
    return '';
  }

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('cookie') ?? '';
  }

  if (Array.isArray(headers)) {
    const entry = (headers as [string, string][]).find(
      ([key]) => key.toLowerCase() === 'cookie'
    );
    return entry?.[1] ?? '';
  }

  const record = headers as Record<string, string | undefined>;
  return record.cookie ?? record.Cookie ?? '';
}

/**
 * Server components read the session with `headers()` from the incoming
 * request, which carries `host: <frontend domain>`. Forwarded verbatim to an
 * API that lives on a *different* domain, that Host header routes the request
 * straight back to the frontend, which answers 404 — so every server-side
 * session read came back empty and the editor bounced logged-in users to the
 * login page, which bounced them back.
 *
 * Only the cookie means anything to the session endpoint, so that is all this
 * forwards. Everything else still goes through better-auth's own client.
 */
export async function getSession(options?: GetSessionOptions) {
  const cookie = readCookieHeader(options?.fetchOptions?.headers);

  return auth.getSession({
    ...options,
    fetchOptions: {
      ...options?.fetchOptions,
      headers: cookie ? { cookie } : {},
    },
  });
}

export { auth };
