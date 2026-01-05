import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractEmailsFromBody, getExternalEmails } from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Find the NutriGreen emails
  const { data } = await supabase
    .from('communications')
    .select('id, subject, company_id, full_content, their_participants')
    .ilike('full_content', '%nutrigreen%')
    .limit(3);

  console.log(`Found ${data?.length || 0} emails mentioning NutriGreen\n`);

  for (const comm of data || []) {
    console.log('Subject:', comm.subject);
    console.log('Company ID:', comm.company_id || '(unlinked)');

    const theirEmails = ((comm.their_participants as Array<{ email?: string }>) || [])
      .map(p => p.email)
      .filter(Boolean);
    console.log('Their participants:', theirEmails.join(', ') || 'none');

    const bodyEmails = extractEmailsFromBody(comm.full_content || '');
    console.log('Body emails:', bodyEmails.join(', ') || 'none');
    console.log('---');
  }
}

check().catch(console.error);
