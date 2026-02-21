'use client';

import { auth } from '@/app/lib/auth';
import { useEffect, useState } from 'react';

export default function RootPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    auth.getSession().then((session) => {
      if (session?.data?.user) {
        setIsAuthenticated(true);
        window.location.href = '/edit';
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const handleGoogleLogin = () => {
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    auth.signIn.social({ provider: 'google', callbackURL: `${frontendUrl}/edit` });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-stone-50">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full mx-4">
        <h1 className="text-2xl font-bold text-center mb-2">Linky</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Tu link-in-bio para Amalgama
        </p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
