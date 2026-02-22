import { getSession } from '@/app/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showTeamOnboarding = searchParams.get('showTeamOnboarding');
  const showPremiumOnboarding = searchParams.get('showPremiumOnboarding');

  // --- DEBUG: exhaustive trace (remove after auth is working) ---
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get('cookie');
  const allHeaderKeys = Array.from(reqHeaders.keys());
  console.log('[/edit] === REQUEST START ===');
  console.log('[/edit] Cookie header present:', !!cookieHeader);
  console.log('[/edit] Cookie header length:', cookieHeader?.length || 0);
  console.log('[/edit] Cookie names:', cookieHeader?.split(';').map(c => c.trim().split('=')[0]).join(', ') || 'NONE');
  console.log('[/edit] All request header keys:', allHeaderKeys.join(', '));
  console.log('[/edit] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || 'NOT SET');

  // Test: manually call the API to see what it returns
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  try {
    const directRes = await fetch(`${apiUrl}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader || '',
      },
      credentials: 'include',
    });
    const directBody = await directRes.text();
    console.log('[/edit] Direct API call status:', directRes.status);
    console.log('[/edit] Direct API call body:', directBody.substring(0, 500));
    const directCookies: string[] = [];
    directRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') directCookies.push(value.split('=')[0]);
    });
    if (directCookies.length > 0) {
      console.log('[/edit] Direct API set-cookie names:', directCookies.join(', '));
    }
  } catch (e: any) {
    console.log('[/edit] Direct API call FAILED:', e.message);
  }

  // Now use the standard getSession
  let session: any;
  try {
    session = await getSession({
      fetchOptions: { headers: reqHeaders },
    });
    console.log('[/edit] getSession full result:', JSON.stringify(session)?.substring(0, 1000));
  } catch (e: any) {
    console.log('[/edit] getSession THREW:', e.message);
    session = null;
  }

  const { user, session: sessionData } = session?.data ?? {};

  console.log('[/edit] user:', user ? `${user.email} (${user.id})` : 'NULL');
  console.log('[/edit] sessionData:', sessionData ? `orgId=${sessionData.activeOrganizationId}` : 'NULL');
  console.log('[/edit] === REQUEST END ===');

  if (!user || !sessionData?.activeOrganizationId) {
    console.log('[/edit] REDIRECT TO / — no user or no orgId');
    return redirect('/');
  }

  const pages = await prisma.page.findMany({
    where: {
      organizationId: sessionData?.activeOrganizationId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      slug: true,
    },
    take: 1,
  });

  if (!pages || pages.length === 0) {
    return redirect('/new?freshOnboarding=true');
  }

  const params = new URLSearchParams();
  if (showTeamOnboarding) params.set('showTeamOnboarding', 'true');
  if (showPremiumOnboarding) params.set('showPremiumOnboarding', 'true');

  const queryString = params.toString();
  return redirect(`/${pages[0].slug}${queryString ? `?${queryString}` : ''}`);
}
