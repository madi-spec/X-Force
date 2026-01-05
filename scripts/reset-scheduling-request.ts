import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUEST_ID = 'ea66537b-0a84-48bd-ad98-039afba4e6db';

async function reset() {
  console.log('Resetting scheduling request to awaiting_response...');

  // Reset the scheduling request status
  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      status: 'awaiting_response',
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', REQUEST_ID);

  if (updateError) {
    console.error('Error updating:', updateError);
    return;
  }

  // Delete any actions logged for this email so it can be re-processed
  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('id, action_type, created_at')
    .eq('scheduling_request_id', REQUEST_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent actions:', actions);

  // Delete the most recent EMAIL_RECEIVED action to allow re-processing
  if (actions && actions.length > 0) {
    const recentEmailAction = actions.find(a => a.action_type === 'email_received');
    if (recentEmailAction) {
      const { error: deleteError } = await supabase
        .from('scheduling_actions')
        .delete()
        .eq('id', recentEmailAction.id);

      if (deleteError) {
        console.error('Error deleting action:', deleteError);
      } else {
        console.log('Deleted action:', recentEmailAction.id);
      }
    }
  }

  console.log('Done! Run fetch-and-process.ts again to re-test.');
}

reset().catch(console.error);
