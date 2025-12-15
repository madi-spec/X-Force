import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CommandCenter } from './CommandCenter';

export const metadata = {
  title: 'AI Command Center | X-FORCE',
  description: 'AI-powered insights and recommendations for your sales pipeline',
};

export default async function AIPage() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();

  if (!dbUser) {
    redirect('/login');
  }

  // Fetch summary stats for the dashboard
  const { data: deals } = await supabase
    .from('deals')
    .select('id, health_score, health_trend, value, stage')
    .not('stage', 'in', '("closed_won","closed_lost")');

  const stats = {
    totalOpenDeals: deals?.length || 0,
    atRiskDeals: deals?.filter(d => d.health_score !== null && d.health_score < 50).length || 0,
    decliningDeals: deals?.filter(d => d.health_trend === 'declining').length || 0,
    healthyDeals: deals?.filter(d => d.health_score !== null && d.health_score >= 70).length || 0,
    totalPipelineValue: deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0,
    atRiskValue: deals
      ?.filter(d => d.health_score !== null && d.health_score < 50)
      .reduce((sum, d) => sum + (d.value || 0), 0) || 0,
  };

  return (
    <div className="flex flex-col h-full">
      <CommandCenter userName={dbUser.name || 'there'} stats={stats} />
    </div>
  );
}
