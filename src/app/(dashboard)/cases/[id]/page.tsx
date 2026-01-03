import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CaseDetailView } from '@/components/cases/CaseDetailView';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '@/lib/supportCase/events';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch case from projection
  const { data: caseData, error: caseError } = await supabase
    .from('support_case_read_model')
    .select(`
      *,
      company:companies!company_id (
        id,
        name,
        domain
      )
    `)
    .eq('support_case_id', id)
    .single();

  if (caseError || !caseData) {
    notFound();
  }

  // Fetch timeline events
  const { data: events } = await supabase
    .from('event_store')
    .select(`
      id,
      event_type,
      event_data,
      sequence_number,
      occurred_at,
      actor_type,
      actor_id
    `)
    .eq('aggregate_type', SUPPORT_CASE_AGGREGATE_TYPE)
    .eq('aggregate_id', id)
    .order('sequence_number', { ascending: true });

  const timeline = (events || []).map((event) => ({
    id: event.id,
    type: event.event_type,
    data: event.event_data as Record<string, unknown>,
    sequence: event.sequence_number,
    occurredAt: event.occurred_at,
    actor: {
      type: event.actor_type,
      id: event.actor_id,
    },
  }));

  return <CaseDetailView caseData={caseData} timeline={timeline} />;
}
