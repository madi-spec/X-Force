import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Link2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { MicrosoftConnection } from '@/components/settings/MicrosoftConnection';

export default async function MicrosoftIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; details?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Get Microsoft connection if exists
  const { data: microsoftConnection } = await supabase
    .from('microsoft_connections')
    .select('*')
    .eq('user_id', profile.id)
    .single();

  const successMessage = params.success === 'microsoft'
    ? 'Successfully connected to Microsoft 365!'
    : null;

  const errorMessages: Record<string, string> = {
    missing_params: 'Missing required parameters from Microsoft',
    save_failed: 'Failed to save connection',
    profile_fetch_failed: 'Failed to get Microsoft profile',
    unexpected_error: 'An unexpected error occurred',
    user_not_found: 'User profile not found',
    access_denied: 'Access was denied',
  };

  const errorMessage = params.error
    ? (errorMessages[params.error] || `Error: ${params.error}`) + (params.details ? ` - ${params.details}` : '')
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-normal text-gray-900">Microsoft 365 Integration</h1>
        <p className="text-xs text-gray-500 mt-1">
          Connect your Microsoft 365 account to sync email and calendar
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
          <CheckCircle className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {errorMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Microsoft 365 Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Link2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-medium text-gray-900">Microsoft 365</h2>
          </div>

          <MicrosoftConnection
            connection={microsoftConnection}
          />
        </div>

        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Email and calendar sync uses Microsoft Graph API
          </p>
        </div>
      </div>
    </div>
  );
}
