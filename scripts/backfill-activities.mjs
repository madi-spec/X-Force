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

async function backfillActivities() {
  console.log('=== Backfilling Meeting Activities ===\n');

  // Get all transcripts that have a deal_id
  const { data: transcripts, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, deal_id, company_id, user_id, meeting_date, created_at, duration_minutes, summary, source')
    .not('deal_id', 'is', null);

  if (error) {
    console.error('Error fetching transcripts:', error.message);
    return;
  }

  console.log(`Found ${transcripts.length} transcripts with deal_id\n`);

  let created = 0;
  let skipped = 0;

  for (const transcript of transcripts) {
    // Check if activity already exists for this transcript
    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('metadata->>transcription_id', transcript.id)
      .single();

    if (existingActivity) {
      console.log(`[SKIP] "${transcript.title}" - activity already exists`);
      skipped++;
      continue;
    }

    // Create activity
    const { error: insertError } = await supabase
      .from('activities')
      .insert({
        deal_id: transcript.deal_id,
        company_id: transcript.company_id,
        user_id: transcript.user_id,
        type: 'meeting',
        subject: transcript.title || 'Meeting',
        body: transcript.summary || `Meeting transcript synced from ${transcript.source || 'upload'}`,
        occurred_at: transcript.meeting_date || transcript.created_at,
        metadata: {
          transcription_id: transcript.id,
          source: transcript.source || 'upload',
          duration_minutes: transcript.duration_minutes || null,
        },
      });

    if (insertError) {
      console.log(`[ERROR] "${transcript.title}":`, insertError.message);
    } else {
      console.log(`[CREATED] "${transcript.title}" -> deal ${transcript.deal_id.slice(0, 8)}...`);
      created++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
}

backfillActivities().catch(console.error);
