import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Mic, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FirefliesIntegration } from '@/components/settings/FirefliesIntegration';

export default async function FirefliesIntegrationPage() {
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
        <h1 className="text-xl font-normal text-gray-900">Fireflies.ai Integration</h1>
        <p className="text-xs text-gray-500 mt-1">
          Connect Fireflies.ai to automatically import meeting transcripts
        </p>
      </div>

      <div className="space-y-6">
        {/* Fireflies.ai Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Mic className="h-5 w-5 text-purple-500" />
            <h2 className="text-base font-medium text-gray-900">Fireflies.ai</h2>
          </div>

          <FirefliesIntegration />
        </div>

        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Meeting transcripts are processed automatically after import
          </p>
        </div>
      </div>
    </div>
  );
}
