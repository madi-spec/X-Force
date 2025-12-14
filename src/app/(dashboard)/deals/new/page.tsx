import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DealForm } from '@/components/deals/DealForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function NewDealPage() {
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

  // Get companies
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pipeline
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Deal</h1>
        <p className="text-gray-500 text-sm mt-1">
          Add a new deal to your pipeline
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <DealForm
          companies={companies || []}
          currentUserId={profile.id}
        />
      </div>
    </div>
  );
}
