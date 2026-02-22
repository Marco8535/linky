import { getSession } from '@/app/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * DEBUG endpoint — returns full session diagnostic info as JSON.
 * Remove after auth is working.
 */
export async function GET() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get('cookie');
  const cookieNames = cookieHeader
    ?.split(';')
    .map((c) => c.trim().split('=')[0])
    .filter(Boolean) || [];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const diagnostics: Record<string, unknown> = {
    step1_cookies: {
      present: !!cookieHeader,
      length: cookieHeader?.length || 0,
      names: cookieNames,
    },
    step2_env: {
      NEXT_PUBLIC_API_URL: apiUrl || 'NOT SET',
    },
  };

  // Step 3: Direct fetch to API
  try {
    const directRes = await fetch(`${apiUrl}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader || '',
      },
    });
    const directText = await directRes.text();
    let directJson: unknown = null;
    try {
      directJson = JSON.parse(directText);
    } catch {
      directJson = directText;
    }
    diagnostics.step3_directApiCall = {
      status: directRes.status,
      statusText: directRes.statusText,
      body: directJson,
      bodyType: typeof directJson,
      bodyIsNull: directJson === null,
    };
  } catch (e: any) {
    diagnostics.step3_directApiCall = { error: e.message };
  }

  // Step 4: getSession from better-auth client
  try {
    const session = await getSession({
      fetchOptions: { headers: reqHeaders },
    });

    diagnostics.step4_getSession = {
      fullResult: session,
      resultType: typeof session,
      hasData: !!session?.data,
      dataType: typeof session?.data,
      dataKeys: session?.data ? Object.keys(session.data) : [],
      user: session?.data?.user || null,
      session: session?.data?.session || null,
      error: (session as any)?.error || null,
    };
  } catch (e: any) {
    diagnostics.step4_getSession = { error: e.message, stack: e.stack?.substring(0, 500) };
  }

  return NextResponse.json(diagnostics, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
