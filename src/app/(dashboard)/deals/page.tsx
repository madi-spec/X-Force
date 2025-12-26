import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DealsView } from './DealsView';

export default async function DealsPage() {
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

  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name, segment),
      owner:users!deals_owner_id_fkey(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deals:', error);
  }

  // Get all users for salesperson filter
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, team')
    .order('name');

  // Get all companies that have deals for company filter
  const companyIds = [...new Set((deals || []).map(d => d.company_id).filter(Boolean))];
  const { data: companies } = companyIds.length > 0
    ? await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds)
        .order('name')
    : { data: [] };

  return (
    <DealsView
      initialDeals={deals || []}
      currentUserId={profile?.id || ''}
      users={users || []}
      companies={companies || []}
    />
  );
}
