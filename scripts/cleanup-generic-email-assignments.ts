/**
 * Cleanup script to unassign communications from generic email domains
 * These were incorrectly auto-assigned to companies
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GENERIC_DOMAINS = [
  '@gmail.com',
  '@yahoo.com',
  '@hotmail.com',
  '@outlook.com',
  '@aol.com',
  '@icloud.com',
];

async function main() {
  console.log('Finding communications from generic email domains that are assigned to companies...\n');

  // Find all affected communications
  const { data: comms, error: fetchError } = await supabase
    .from('communications')
    .select('id, their_participants, company_id, subject')
    .not('company_id', 'is', null);

  if (fetchError) {
    console.error('Error fetching communications:', fetchError);
    process.exit(1);
  }

  // Filter to those with generic email domains
  const affectedComms = comms?.filter(c => {
    const participants = JSON.stringify(c.their_participants || []).toLowerCase();
    return GENERIC_DOMAINS.some(domain => participants.includes(domain));
  }) || [];

  console.log(`Found ${affectedComms.length} communications to unassign\n`);

  if (affectedComms.length === 0) {
    console.log('No items to clean up.');
    return;
  }

  // Unassign them
  const ids = affectedComms.map(c => c.id);

  const { error: updateError, count } = await supabase
    .from('communications')
    .update({ company_id: null, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (updateError) {
    console.error('Error updating communications:', updateError);
    process.exit(1);
  }

  console.log(`Successfully unassigned ${affectedComms.length} communications from companies.`);
  console.log('These items will now appear in the unassigned queue for manual review.');
}

main().catch(console.error);
