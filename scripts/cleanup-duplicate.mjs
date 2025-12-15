/**
 * Clean up duplicate Bug Busters USA created during testing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== Cleaning up duplicate Bug Busters USA ===\n');

  // Find the duplicate company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('name', 'Bug Busters USA')
    .single();

  if (!company) {
    console.log('No Bug Busters USA found.');
    return;
  }

  console.log('Found company:', company.name, company.id);

  // Delete activities
  const { data: activities } = await supabase
    .from('activities')
    .delete()
    .eq('company_id', company.id)
    .select('id');
  console.log('Deleted', activities?.length || 0, 'activities');

  // Delete deals
  const { data: deals } = await supabase
    .from('deals')
    .delete()
    .eq('company_id', company.id)
    .select('id');
  console.log('Deleted', deals?.length || 0, 'deals');

  // Delete contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .delete()
    .eq('company_id', company.id)
    .select('id');
  console.log('Deleted', contacts?.length || 0, 'contacts');

  // Delete tasks related to this company
  const { data: tasks } = await supabase
    .from('tasks')
    .delete()
    .eq('company_id', company.id)
    .select('id');
  console.log('Deleted', tasks?.length || 0, 'tasks');

  // Update transcription to remove company/deal reference
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .update({ company_id: null, deal_id: null })
    .eq('company_id', company.id)
    .select('id');
  console.log('Unlinked', transcripts?.length || 0, 'transcriptions');

  // Delete the company
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', company.id);

  if (error) {
    console.log('Error deleting company:', error.message);
  } else {
    console.log('Deleted company:', company.name);
  }

  // Also delete any remaining fireflies_ai tasks
  const { data: remainingTasks } = await supabase
    .from('tasks')
    .delete()
    .eq('source', 'fireflies_ai')
    .select('id');
  console.log('Deleted', remainingTasks?.length || 0, 'remaining fireflies_ai tasks');

  // Reset transcripts for re-testing
  const { data: ffTranscripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title')
    .eq('source', 'fireflies')
    .is('company_id', null);

  console.log('\nUnassigned transcripts ready for re-test:', ffTranscripts?.length || 0);
  ffTranscripts?.forEach(t => console.log(' -', t.title));

  console.log('\n=== Cleanup Complete ===');
}

main().catch(console.error);
