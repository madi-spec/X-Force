import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function fixLookout() {
  const supabase = createAdminClient();

  // Get the transcript
  const { data: transcript } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .ilike('title', '%lookout%')
    .single();

  if (!transcript) {
    console.log('No transcript found');
    return;
  }

  console.log('Transcript:', transcript.title);
  console.log('ID:', transcript.id);
  console.log('Has analysis:', !!transcript.analysis);
  console.log('Company ID:', transcript.company_id || 'NONE');

  // Find Lookout Pest Control LLC company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%lookout%')
    .single();

  console.log('\nFound company:', company?.name, company?.id);

  if (company) {
    // Update transcript with company
    await supabase
      .from('meeting_transcriptions')
      .update({ company_id: company.id })
      .eq('id', transcript.id);
    console.log('Linked transcript to company');

    // Create CC item for meeting follow-up
    const { data: ccItem, error: ccErr } = await supabase
      .from('command_center_items')
      .insert({
        user_id: transcript.user_id,
        company_id: company.id,
        title: 'Follow up on Lookout Pest meeting',
        description: 'Review meeting with Lookout Pest and follow up on discussed items. Meeting: ' + transcript.title,
        tier: 2,
        status: 'pending',
        priority_score: 85,
        source_type: 'transcript',
        source_id: transcript.id,
        action_type: 'follow_up',
        metadata: {
          meeting_title: transcript.title,
          meeting_date: transcript.meeting_date,
        }
      })
      .select()
      .single();

    if (ccErr) {
      console.log('CC Error:', ccErr.message);
    } else {
      console.log('Created CC item:', ccItem?.id);
    }

    // Also sync to communications
    const { data: comm, error: commErr } = await supabase
      .from('communications')
      .insert({
        user_id: transcript.user_id,
        company_id: company.id,
        type: 'transcript',
        subject: transcript.title,
        body_text: transcript.summary || 'Meeting transcript',
        direction: 'inbound',
        occurred_at: transcript.meeting_date,
        source: 'fireflies',
        source_id: transcript.id,
        metadata: {
          duration_minutes: transcript.duration_minutes,
          attendees: transcript.attendees,
        }
      })
      .select()
      .single();

    if (commErr) {
      console.log('Comm Error:', commErr.message);
    } else {
      console.log('Created communication:', comm?.id);
    }
  }
}

fixLookout().catch(console.error);
