import { createClient } from '@/lib/supabase/server';
import { MicrosoftGraphClient } from './graph';
import { getValidToken, updateLastSync } from './auth';

interface CalendarSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Sync calendar events from Microsoft 365 to activities
 */
export async function syncCalendarEvents(userId: string): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { imported: 0, skipped: 0, errors: [] };

  const token = await getValidToken(userId);
  if (!token) {
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = await createClient();
  const client = new MicrosoftGraphClient(token);

  try {
    // Get all contacts with email addresses for matching
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, company_id')
      .not('email', 'is', null);

    const contactsByEmail = new Map(
      contacts?.map(c => [c.email?.toLowerCase(), c]) || []
    );

    // Get deals for contacts to link activities
    const contactIds = contacts?.map(c => c.id) || [];
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select('contact_id, deal_id')
      .in('contact_id', contactIds);

    const dealsByContact = new Map<string, string>();
    dealContacts?.forEach(dc => {
      if (!dealsByContact.has(dc.contact_id)) {
        dealsByContact.set(dc.contact_id, dc.deal_id);
      }
    });

    // Get user info for created_by
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Get calendar events for the next 30 days and past 7 days
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);

    const events = await client.getCalendarEvents({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      top: 100,
    });

    for (const event of events.value) {
      try {
        // Skip cancelled events
        if (event.isCancelled) {
          result.skipped++;
          continue;
        }

        // Check if already imported
        const externalId = `ms_event_${event.id}`;
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('external_id', externalId)
          .single();

        if (existing) {
          result.skipped++;
          continue;
        }

        // Find matching contact from attendees
        let matchedContact = null;

        if (event.attendees) {
          for (const attendee of event.attendees) {
            const email = attendee.emailAddress?.address?.toLowerCase();
            if (email && contactsByEmail.has(email)) {
              matchedContact = contactsByEmail.get(email);
              break;
            }
          }
        }

        if (!matchedContact) {
          // Skip events that don't match any contacts
          result.skipped++;
          continue;
        }

        // Get deal for this contact if available
        const dealId = dealsByContact.get(matchedContact.id);

        // Determine activity type based on event characteristics
        const isOnlineMeeting = event.isOnlineMeeting || event.onlineMeeting?.joinUrl;
        const activityType = isOnlineMeeting ? 'meeting' : 'meeting';

        // Create activity record
        const activityData = {
          type: activityType as 'meeting' | 'call',
          subject: event.subject || '(No subject)',
          description: event.bodyPreview || '',
          contact_id: matchedContact.id,
          company_id: matchedContact.company_id,
          deal_id: dealId || null,
          created_by: userProfile?.id || userId,
          completed_at: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : null,
          scheduled_at: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : null,
          metadata: {
            microsoft_id: event.id,
            location: event.location?.displayName,
            is_online: isOnlineMeeting,
            join_url: event.onlineMeeting?.joinUrl,
            attendees: event.attendees?.map(a => ({
              email: a.emailAddress?.address,
              name: a.emailAddress?.name,
              response: a.status?.response,
            })),
            start_time: event.start?.dateTime,
            end_time: event.end?.dateTime,
            show_as: event.showAs,
          },
          external_id: externalId,
        };

        const { error: insertError } = await supabase
          .from('activities')
          .insert(activityData);

        if (insertError) {
          result.errors.push(`Failed to import event ${event.id}: ${insertError.message}`);
        } else {
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing event ${event.id}: ${err}`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(userId);

  } catch (err) {
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

/**
 * Create a calendar event via Microsoft Graph
 */
export async function createCalendarEvent(
  userId: string,
  event: {
    subject: string;
    body?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    isOnlineMeeting?: boolean;
  }
): Promise<{ success: boolean; eventId?: string; joinUrl?: string; error?: string }> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
  }

  const client = new MicrosoftGraphClient(token);

  try {
    const result = await client.createEvent({
      subject: event.subject,
      body: event.body ? { contentType: 'HTML', content: event.body } : undefined,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'UTC',
      },
      attendees: event.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required' as const,
      })),
      isOnlineMeeting: event.isOnlineMeeting,
      onlineMeetingProvider: event.isOnlineMeeting ? 'teamsForBusiness' : undefined,
    });

    return {
      success: true,
      eventId: result.id,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
