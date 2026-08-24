'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

const integrationNames: Record<string, string> = {
  instagram: 'Instagram',
  spotify: 'Spotify',
  threads: 'Threads',
  tiktok: 'TikTok',
};

export default function IntegrationCallbackPage() {
  const params = useParams<{ integration: string }>();
  const integration = params.integration;
  const integrationName = integrationNames[integration] ?? 'Integration';

  useEffect(() => {
    if (!window.opener) return;

    window.opener.postMessage(
      { type: 'linky:integration-connected', integration },
      window.location.origin
    );
    window.close();
  }, [integration]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-stone-950">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{integrationName} connected</h1>
        <p className="mt-2 text-sm text-stone-600">
          The account is ready to use in Linky. You can close this window.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          onClick={() => window.close()}
        >
          Close window
        </button>
      </section>
    </main>
  );
}
