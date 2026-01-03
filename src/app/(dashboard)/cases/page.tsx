import { createClient } from '@/lib/supabase/server';
import { CasesQueueList } from '@/components/cases/CasesQueueList';

export default async function CasesPage() {
  const supabase = await createClient();

  // Fetch cases from projection with company data
  const { data: cases } = await supabase
    .from('support_case_read_model')
    .select(`
      *,
      company:companies!company_id (
        id,
        name
      )
    `)
    .order('opened_at', { ascending: false })
    .limit(200);

  return <CasesQueueList cases={cases || []} />;
}
