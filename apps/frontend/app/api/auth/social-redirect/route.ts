import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies the social sign-in request to the API and returns a proper redirect.
 * This avoids the cross-origin cookie issue where the browser won't store
 * Set-Cookie headers from a cross-origin fetch response (the state cookie
 * needed for OAuth CSRF protection).
 *
 * Flow: Browser navigates here → we POST to API → forward state cookie → redirect to Google
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'google';
  const callbackURL =
    searchParams.get('callbackURL') ||
    `${process.env.NEXT_PUBLIC_APP_URL}/edit`;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { error: 'API URL not configured' },
      { status: 500 }
    );
  }

  // POST to the API's sign-in/social endpoint (server-side, no CORS issues)
  const apiResponse = await fetch(`${apiUrl}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, callbackURL }),
  });

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: 'Failed to initiate social sign-in' },
      { status: apiResponse.status }
    );
  }

  const data = await apiResponse.json();

  if (!data.url) {
    return NextResponse.json(
      { error: 'No redirect URL received from API' },
      { status: 500 }
    );
  }

  // Create redirect response
  const response = NextResponse.redirect(data.url);

  // Forward all Set-Cookie headers from the API response
  const setCookieHeaders = apiResponse.headers.getSetCookie?.() || [];
  for (const cookie of setCookieHeaders) {
    response.headers.append('Set-Cookie', cookie);
  }

  return response;
}
