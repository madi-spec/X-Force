import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '11111111-1111-1111-1111-111111111009';

// Get the scheduling request to find the calendar event ID
const { data: request } = await supabase
  .from('scheduling_requests')
  .select('calendar_event_id, title, status')
  .eq('id', 'fd360b3e-b42a-4d52-b612-94b6e8b0e294')
  .single();

console.log('Request:', request);

if (request?.calendar_event_id) {
  console.log('Found calendar event:', request.calendar_event_id);

  // Get Microsoft token
  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (conn) {
    // Delete the calendar event
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${request.calendar_event_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + conn.access_token,
        },
      }
    );

    if (response.ok || response.status === 204) {
      console.log('Calendar event deleted successfully');
    } else {
      console.log('Failed to delete:', await response.text());
    }
  }
}

// Reset the scheduling request
await supabase
  .from('scheduling_requests')
  .update({
    status: 'awaiting_response',
    selected_time: null,
    calendar_event_id: null,
    meeting_link: null,
    next_action_type: null,
    next_action_at: null,
  })
  .eq('id', 'fd360b3e-b42a-4d52-b612-94b6e8b0e294');

console.log('Request reset to awaiting_response');
