import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SoftwareLinksManager } from '@/components/settings/SoftwareLinksManager';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function SoftwareLinksSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-normal text-gray-900">Software Links</h1>
        <p className="text-xs text-gray-500 mt-1">
          Configure quick access links shown on meeting prep pages. Links can be filtered by meeting type.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <SoftwareLinksManager />
      </div>
    </div>
  );
}
