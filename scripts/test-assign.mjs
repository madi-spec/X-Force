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

async function testAssign() {
  // Get PestStop task
  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, description')
    .ilike('title', '%PestStop%')
    .is('completed_at', null)
    .single();

  if (!task) {
    console.log('No PestStop task found');
    return;
  }

  console.log('=== Task ===');
  console.log('ID:', task.id);
  console.log('Title:', task.title);

  // Extract transcription ID
  const match = task.description?.match(/Transcription ID:\s*([a-f0-9-]+)/i);
  const transcriptionId = match ? match[1] : null;
  console.log('Transcription ID:', transcriptionId);

  if (!transcriptionId) {
    console.log('No transcription ID found in task');
    return;
  }

  // Find Peststop Services company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, status')
    .ilike('name', '%peststop%')
    .single();

  console.log('\n=== Company to match ===');
  console.log('ID:', company?.id);
  console.log('Name:', company?.name);

  // Get transcript info
  const { data: transcript } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, external_metadata')
    .eq('id', transcriptionId)
    .single();

  console.log('\n=== Transcript ===');
  console.log('Title:', transcript?.title);
  console.log('Current company:', transcript?.company_id || 'None');
  console.log('Extracted company:', transcript?.external_metadata?.extracted_entity_data?.company?.name);

  // Now test the assignment
  if (company && transcript) {
    console.log('\n=== Testing Assignment ===');

    // Update transcription
    const { error: updateError } = await supabase
      .from('meeting_transcriptions')
      .update({
        company_id: company.id,
        match_confidence: 1.0,
      })
      .eq('id', transcriptionId);

    if (updateError) {
      console.log('Update error:', updateError.message);
      return;
    }

    // Complete the task
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', task.id);

    if (taskError) {
      console.log('Task error:', taskError.message);
      return;
    }

    console.log('SUCCESS! Transcript assigned to', company.name);
    console.log('Task completed.');
  }
}

testAssign().catch(console.error);
