'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        not_registered:
          'Your email is not registered in X-FORCE. Please contact your administrator.',
        account_deactivated:
          'Your account has been deactivated. Please contact your administrator.',
        auth_failed: 'Authentication failed. Please try again.',
        missing_code: 'Missing authentication code. Please try again.',
        no_email:
          'Could not retrieve email from Microsoft. Please try again.',
      };
      setError(
        messageParam || errorMessages[errorParam] || `Error: ${errorParam}`
      );
    }
  }, [searchParams]);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes:
            'openid profile email User.Read Calendars.ReadWrite Mail.ReadWrite Mail.Send offline_access',
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
      // If successful, browser redirects to Microsoft
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold text-center text-gray-900">
            X-FORCE
          </h1>
          <p className="mt-2 text-center text-gray-600">
            AI-First Sales Platform
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 23 23" fill="none">
                <path d="M0 0h10.931v10.931H0z" fill="#f25022" />
                <path d="M12.069 0H23v10.931H12.069z" fill="#7fba00" />
                <path d="M0 12.069h10.931V23H0z" fill="#00a4ef" />
                <path d="M12.069 12.069H23V23H12.069z" fill="#ffb900" />
              </svg>
            )}
            <span className="text-gray-700 font-medium">
              {loading ? 'Signing in...' : 'Sign in with Microsoft'}
            </span>
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Only registered X-FORCE users can sign in.
            <br />
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
