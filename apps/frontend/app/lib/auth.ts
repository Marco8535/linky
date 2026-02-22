import { auth } from '@trylinky/common';

export const { signIn, signOut, useSession } = auth;

/**
 * Patched getSession that bypasses better-auth client's response parsing.
 *
 * The better-auth client's getSession() returns garbled/compressed data
 * when called server-side through Cloudflare tunnel (the response body
 * isn't properly decompressed). This wrapper calls the API directly
 * and parses the JSON response, returning in the same format the rest
 * of the codebase expects: { data: { session, user } | null }.
 */
export async function getSession(
  options?: { fetchOptions?: { headers?: HeadersInit } }
): Promise<{ data: { session: any; user: any } | null }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { data: null };

  // Extract cookie header from the passed headers
  let cookieHeader = '';

  if (options?.fetchOptions?.headers) {
    const h = options.fetchOptions.headers;
    if (h instanceof Headers || (h as any).get) {
      cookieHeader = (h as Headers).get('cookie') || '';
    } else if (Array.isArray(h)) {
      const entry = h.find(([k]) => k.toLowerCase() === 'cookie');
      cookieHeader = entry?.[1] || '';
    } else if (typeof h === 'object') {
      cookieHeader =
        (h as Record<string, string>).cookie ||
        (h as Record<string, string>).Cookie ||
        '';
    }
  }

  try {
    const res = await fetch(`${apiUrl}/api/auth/get-session`, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: 'no-store',
    });

    if (!res.ok) return { data: null };

    const body = await res.json();
    // API returns { session: {...}, user: {...} } or null
    if (!body || !body.user) return { data: null };

    return { data: body };
  } catch {
    return { data: null };
  }
}

export { auth };
