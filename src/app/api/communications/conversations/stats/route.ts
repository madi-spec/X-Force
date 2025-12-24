import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();

  // Get count of linked communications (grouped by company)
  const { data: linkedData } = await supabase
    .from('communications')
    .select('company_id')
    .not('company_id', 'is', null);

  // Get count of unlinked communications (grouped by sender email)
  const { data: unlinkedData } = await supabase
    .from('communications')
    .select('id, their_participants')
    .is('company_id', null);

  // Count unique companies for linked
  const uniqueCompanies = new Set(linkedData?.map(c => c.company_id) || []);

  // Count unique sender emails for unlinked
  const uniqueSenders = new Set<string>();
  for (const comm of unlinkedData || []) {
    const participants = comm.their_participants as Array<{ email?: string }> || [];
    const email = participants[0]?.email;
    if (email) {
      uniqueSenders.add(email);
    } else {
      uniqueSenders.add(`unknown:${comm.id}`);
    }
  }

  return NextResponse.json({
    linked: uniqueCompanies.size,
    unlinked: uniqueSenders.size,
  });
}
