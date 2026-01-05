import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Find the company
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%lawn doctor%tx%')
    .limit(5);

  console.log('Companies matching "Lawn Doctor TX":');
  companies?.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  if (!companies?.length) {
    // Try broader search
    const { data: broader } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', '%lawn doctor%')
      .limit(10);
    console.log('\nBroader search "Lawn Doctor":');
    broader?.forEach(c => console.log(`  - ${c.name} (${c.id})`));
  }

  // Find communications from Kris
  const { data: comms } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      from_email,
      awaiting_our_response,
      responded_at,
      excluded_at,
      response_due_by,
      created_at,
      company:companies(name)
    `)
    .or('from_email.ilike.%kris%,subject.ilike.%kris%')
    .ilike('from_email', '%lawn%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!comms?.length) {
    // Try just Kris
    const { data: krisComms } = await supabase
      .from('communications')
      .select(`
        id,
        subject,
        from_email,
        awaiting_our_response,
        responded_at,
        excluded_at,
        response_due_by,
        created_at,
        company:companies(name)
      `)
      .ilike('from_email', '%kris%')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\n\nCommunications from "Kris":');
    krisComms?.forEach(c => {
      const company = Array.isArray(c.company) ? c.company[0]?.name : (c.company as any)?.name;
      console.log(`\n  ID: ${c.id}`);
      console.log(`  From: ${c.from_email}`);
      console.log(`  Subject: ${c.subject?.substring(0, 50)}`);
      console.log(`  Company: ${company || 'Unknown'}`);
      console.log(`  Awaiting Response: ${c.awaiting_our_response}`);
      console.log(`  Responded At: ${c.responded_at || 'NOT RESPONDED'}`);
      console.log(`  Excluded At: ${c.excluded_at || 'not excluded'}`);
      console.log(`  Due: ${c.response_due_by || 'no deadline'}`);
    });
  } else {
    console.log('\n\nCommunications from Kris at Lawn Doctor:');
    comms?.forEach(c => {
      const company = Array.isArray(c.company) ? c.company[0]?.name : (c.company as any)?.name;
      console.log(`\n  ID: ${c.id}`);
      console.log(`  From: ${c.from_email}`);
      console.log(`  Subject: ${c.subject?.substring(0, 50)}`);
      console.log(`  Company: ${company || 'Unknown'}`);
      console.log(`  Awaiting Response: ${c.awaiting_our_response}`);
      console.log(`  Responded At: ${c.responded_at || 'NOT RESPONDED'}`);
      console.log(`  Excluded At: ${c.excluded_at || 'not excluded'}`);
      console.log(`  Due: ${c.response_due_by || 'no deadline'}`);
    });
  }

  // Check for any recent sent emails that might be the response
  console.log('\n\nRecent sent emails (last 2 hours):');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: sent } = await supabase
    .from('communications')
    .select('id, subject, to_email, created_at')
    .eq('direction', 'outbound')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  sent?.forEach(s => {
    console.log(`  - ${s.subject?.substring(0, 40)} → ${s.to_email}`);
  });
}

run().catch(console.error);
