import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Find Kanga pest control scheduler request - search by company name
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%kanga%');

  console.log('Companies matching "kanga":', companies);

  if (!companies || companies.length === 0) {
    console.log('No companies found matching "kanga"');

    // Try to find recent scheduler requests
    const { data: recentRequests } = await supabase
      .from('scheduling_requests')
      .select('id, status, contact_name, contact_email, company_id, created_at, meeting_type')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\nRecent scheduler requests:', JSON.stringify(recentRequests, null, 2));
    return;
  }

  // Find scheduler requests for these companies
  const companyIds = companies.map(c => c.id);

  const { data: requests, error } = await supabase
    .from('scheduling_requests')
    .select('*')
    .in('company_id', companyIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('\nFound', requests?.length, 'scheduler requests for Kanga companies');

  if (requests && requests.length > 0) {
    for (const r of requests) {
      console.log('\n=== Scheduler Request ===');
      console.log('ID:', r.id);
      console.log('Status:', r.status);
      console.log('Created:', r.created_at);
      console.log('Meeting Type:', r.meeting_type);
      console.log('Contact Name:', r.contact_name);
      console.log('Contact Email:', r.contact_email);
      console.log('Email Sent At:', r.email_sent_at);
      console.log('Error Message:', r.error_message);
      console.log('Proposed Times:', r.proposed_times);
      console.log('Selected Time:', r.selected_time);
      console.log('Source Type:', r.source_type);
      console.log('Source ID:', r.source_id);
    }
  } else {
    console.log('No scheduler requests found for Kanga');

    // Show all recent requests with status 'new'
    const { data: newRequests } = await supabase
      .from('scheduling_requests')
      .select('*, company:companies(name)')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\nAll requests with status "new":');
    newRequests?.forEach(r => {
      console.log(`  - ${r.company?.name || 'Unknown'}: ${r.contact_name} <${r.contact_email}> created ${r.created_at}`);
    });
  }
}

check().catch(console.error);
