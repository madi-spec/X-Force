import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PipelineView } from '@/components/pipeline/PipelineView';

export default async function PipelinePage() {
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
      owner:users(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deals:', error);
  }

  // Get all users for team filter
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .order('name');

  return (
    <PipelineView
      initialDeals={deals || []}
      currentUserId={profile?.id || ''}
      users={users || []}
    />
  );
}
