/**
 * Reset the two emails back to Daily Driver (awaiting response)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function resetEmails() {
  const supabase = createAdminClient();

  console.log('=== Resetting Emails Back to Daily Driver ===\n');

  // Find the two emails by subject pattern and responded_at time
  const { data: emails, error } = await supabase
    .from('communications')
    .select('id, subject, responded_at, awaiting_our_response, company:companies(name)')
    .or('subject.ilike.%Lawn Doctor of Warren%,subject.ilike.%NutriGreen%,subject.ilike.%Nutri-Green%')
    .not('responded_at', 'is', null)
    .order('responded_at', { ascending: false });

  if (error) {
    console.error('Error finding emails:', error);
    return;
  }

  console.log('Found emails to reset:');
  for (const e of emails || []) {
    console.log(`  - ${e.subject}`);
    console.log(`    Company: ${(e as any).company?.name}`);
    console.log(`    responded_at: ${e.responded_at}`);
    console.log(`    ID: ${e.id}`);
    console.log('');
  }

  if (!emails?.length) {
    console.log('No emails found to reset!');
    return;
  }

  // Reset these emails
  console.log('\nResetting emails...\n');

  for (const email of emails) {
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        awaiting_our_response: true,
        responded_at: null,
      })
      .eq('id', email.id);

    if (updateError) {
      console.log(`❌ Failed to reset "${email.subject}": ${updateError.message}`);
    } else {
      console.log(`✅ Reset "${email.subject}" - now in Daily Driver`);
    }
  }

  // Verify
  console.log('\n=== Verification ===\n');

  const { data: verify } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at, company:companies(name)')
    .in('id', emails.map(e => e.id));

  for (const v of verify || []) {
    console.log(`${v.subject}`);
    console.log(`  awaiting_our_response: ${v.awaiting_our_response}`);
    console.log(`  responded_at: ${v.responded_at}`);
  }
}

resetEmails().catch(console.error);
