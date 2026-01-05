import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get communications with their company links
  const { data: comms, count } = await supabase
    .from('communications')
    .select('id, channel, direction, company_id, contact_id, their_participants, subject', { count: 'exact' })
    .eq('channel', 'email')
    .order('occurred_at', { ascending: false })
    .limit(50);

  const linked = comms?.filter(c => c.company_id) || [];
  const unlinked = comms?.filter(c => !c.company_id) || [];

  console.log('=== Email Matching Status ===\n');
  console.log(`Total emails: ${count}`);
  console.log(`Linked to company: ${linked.length}`);
  console.log(`Unlinked: ${unlinked.length}`);

  // Show some unlinked examples
  if (unlinked.length > 0) {
    console.log('\n--- Sample Unlinked Emails ---');
    unlinked.slice(0, 10).forEach(c => {
      const participants = (c.their_participants as Array<{ email?: string; name?: string }>) || [];
      const emails = participants.map(p => p.email).filter(Boolean).join(', ');
      console.log(`  ${c.direction}: ${(c.subject || '(no subject)').substring(0, 40)}`);
      console.log(`    Participants: ${emails || 'none'}`);
    });
  }

  // Show linked distribution by company
  if (linked.length > 0) {
    console.log('\n--- Linked by Company ---');
    const byCompany: Record<string, number> = {};
    linked.forEach(c => {
      byCompany[c.company_id] = (byCompany[c.company_id] || 0) + 1;
    });

    // Get company names
    const companyIds = Object.keys(byCompany);
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    const companyNames = new Map(companies?.map(c => [c.id, c.name]) || []);

    Object.entries(byCompany)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([companyId, count]) => {
        console.log(`  ${companyNames.get(companyId) || companyId}: ${count} emails`);
      });
  }
}

check().catch(console.error);
