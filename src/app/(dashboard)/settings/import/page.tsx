import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ImportWizard } from '@/components/import/ImportWizard';

export default async function ImportPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('auth_id', user.id)
    .single();

  // Get all users for owner mapping
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .order('name');

  // Get existing companies for duplicate detection
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-gray-500 mt-1">
          Import deals, companies, and contacts from a CSV file
        </p>
      </div>

      <ImportWizard
        currentUserId={profile?.id || ''}
        users={users || []}
        existingCompanies={existingCompanies || []}
      />
    </div>
  );
}
