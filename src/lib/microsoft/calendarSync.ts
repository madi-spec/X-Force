import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from './graph';
import { getValidToken, updateLastSync } from './auth';

interface CalendarSyncResult {
  imported: number;
  skipped: number;
  rematched: number;
  errors: string[];
}

interface CalendarSyncOptions {
  sinceDate?: Date;
  untilDate?: Date;
  maxEvents?: number;
}

// Map Windows timezone names to IANA timezone offsets (common ones)
// Microsoft Graph uses Windows timezone names
const TIMEZONE_OFFSETS: Record<string, number> = {
  'UTC': 0,
  'GMT Standard Time': 0,
  'Eastern Standard Time': -5,
  'Eastern Daylight Time': -4,
  'Central Standard Time': -6,
  'Central Daylight Time': -5,
  'Mountain Standard Time': -7,
  'Mountain Daylight Time': -6,
  'Pacific Standard Time': -8,
  'Pacific Daylight Time': -7,
  'US Eastern Standard Time': -5,
  'US Mountain Standard Time': -7,
  'Atlantic Standard Time': -4,
  'Alaskan Standard Time': -9,
  'Hawaiian Standard Time': -10,
};

/**
 * Convert a Microsoft Graph datetime + timezone to UTC ISO string
 */
function convertToUTC(dateTime: string, timeZone: string): string {
  // Parse the datetime (which has no timezone indicator)
  const [datePart, timePart] = dateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(s => parseFloat(s));

  // Get the offset for this timezone (default to 0 if unknown)
  const offsetHours = TIMEZONE_OFFSETS[timeZone] ?? 0;

  // Create a date in UTC by subtracting the offset
  // If timezone is EST (-5), a 9:00 AM meeting is 14:00 UTC
  const utcDate = new Date(Date.UTC(
    year,
    month - 1, // JS months are 0-indexed
    day,
    hours - offsetHours,
    minutes,
    Math.floor(seconds || 0)
  ));

  return utcDate.toISOString();
}

interface MeetingMetadata {
  attendees?: Array<{ email?: string; name?: string }>;
  [key: string]: unknown;
}

/**
 * Re-match future meetings that are currently linked to "External Contacts"
 * to proper companies based on attendee emails matching known contacts.
 *
 * This handles the case where a meeting was synced before a contact was added.
 */
async function rematchFutureMeetings(
  externalCompanyId: string,
  contactsByEmail: Map<string, { id: string; email?: string; company_id: string }>,
  dealsByContact: Map<string, string>
): Promise<{ rematched: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let rematched = 0;

  // Get all future meetings linked to External Contacts
  const { data: unmatchedMeetings, error } = await supabase
    .from('activities')
    .select('id, subject, metadata')
    .eq('company_id', externalCompanyId)
    .eq('type', 'meeting')
    .gte('occurred_at', now);

  if (error) {
    console.error('[CalendarSync] Error fetching unmatched meetings:', error);
    return { rematched: 0 };
  }

  if (!unmatchedMeetings || unmatchedMeetings.length === 0) {
    return { rematched: 0 };
  }

  console.log(`[CalendarSync] Checking ${unmatchedMeetings.length} future meetings for re-matching`);

  for (const meeting of unmatchedMeetings) {
    const metadata = meeting.metadata as MeetingMetadata | null;
    const attendees = metadata?.attendees || [];

    // Try to find a matching contact from attendees
    let matchedContact: { id: string; email?: string; company_id: string } | null = null;

    for (const attendee of attendees) {
      const email = attendee.email?.toLowerCase();
      if (email && contactsByEmail.has(email)) {
        const contact = contactsByEmail.get(email)!;
        // Only match if the contact belongs to a real company (not External Contacts)
        if (contact.company_id !== externalCompanyId) {
          matchedContact = contact;
          break;
        }
      }
    }

    if (matchedContact) {
      // Update the meeting with the matched company and contact
      const dealId = dealsByContact.get(matchedContact.id) || null;

      const { error: updateError } = await supabase
        .from('activities')
        .update({
          company_id: matchedContact.company_id,
          contact_id: matchedContact.id,
          deal_id: dealId,
          metadata: {
            ...metadata,
            has_contact: true,
            rematched_at: new Date().toISOString(),
          },
        })
        .eq('id', meeting.id);

      if (updateError) {
        console.error(`[CalendarSync] Error re-matching meeting ${meeting.id}:`, updateError);
      } else {
        console.log(`[CalendarSync] Re-matched meeting "${meeting.subject}" to company ${matchedContact.company_id}`);
        rematched++;
      }
    }
  }

  return { rematched };
}

/**
 * Sync calendar events from Microsoft 365 to activities
 */
export async function syncCalendarEvents(userId: string, options: CalendarSyncOptions = {}): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { imported: 0, skipped: 0, rematched: 0, errors: [] };
  const { sinceDate, untilDate, maxEvents = 100 } = options;

  console.log('[CalendarSync] Starting sync for user:', userId);

  const token = await getValidToken(userId);
  if (!token) {
    console.log('[CalendarSync] No valid token available');
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = createAdminClient();
  const client = new MicrosoftGraphClient(token);

  try {
    // Get or create a default company for external events
    let { data: externalCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'External Contacts')
      .single();

    if (!externalCompany) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: 'External Contacts', industry: 'pest', segment: 'smb', status: 'prospect' })
        .select('id')
        .single();
      if (companyError) {
        console.error('[CalendarSync] Failed to create External Contacts company:', companyError);
      }
      externalCompany = newCompany;
    }

    const externalCompanyId = externalCompany?.id;
    console.log('[CalendarSync] External company ID:', externalCompanyId);

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

    // Get user info
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Get calendar events - use provided dates or defaults
    const now = new Date();
    const startDate = sinceDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
    const endDate = untilDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days ahead

    console.log('[CalendarSync] Date range:', startDate.toISOString(), 'to', endDate.toISOString());

    const events = await client.getCalendarEvents({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      top: maxEvents,
    });

    console.log('[CalendarSync] Fetched events:', events.value.length);

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

        // Find matching contact from attendees (optional - we import all events now)
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

        // Get deal for this contact if available
        const dealId = matchedContact ? dealsByContact.get(matchedContact.id) : null;

        // Use external company for events without matched contacts
        const companyId = matchedContact?.company_id || externalCompanyId;

        if (!companyId) {
          console.log('[CalendarSync] Skipping event - no company available:', event.subject);
          result.skipped++;
          continue;
        }

        // Determine activity type based on event characteristics
        const isOnlineMeeting = event.isOnlineMeeting || event.onlineMeeting?.joinUrl;

        // Convert times to UTC for consistent storage
        const startTimeUTC = event.start?.dateTime && event.start?.timeZone
          ? convertToUTC(event.start.dateTime, event.start.timeZone)
          : new Date().toISOString();
        const endTimeUTC = event.end?.dateTime && event.end?.timeZone
          ? convertToUTC(event.end.dateTime, event.end.timeZone)
          : null;

        // Create activity record
        const activityData = {
          type: 'meeting' as const,
          subject: event.subject || '(No subject)',
          body: event.bodyPreview || '',
          contact_id: matchedContact?.id || null,
          company_id: companyId,
          deal_id: dealId || null,
          user_id: userProfile?.id || userId,
          occurred_at: startTimeUTC,
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
            start_time: startTimeUTC,
            end_time: endTimeUTC,
            original_timezone: event.start?.timeZone,
            show_as: event.showAs,
            has_contact: !!matchedContact,
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

    // Re-match future meetings that are linked to External Contacts
    // This catches meetings that were imported before contacts were added
    if (externalCompanyId) {
      const rematchResult = await rematchFutureMeetings(externalCompanyId, contactsByEmail, dealsByContact);
      result.rematched = rematchResult.rematched;
      if (rematchResult.rematched > 0) {
        console.log(`[CalendarSync] Re-matched ${rematchResult.rematched} meetings to proper companies`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(userId);

    console.log('[CalendarSync] Sync complete:', result);

  } catch (err) {
    console.error('[CalendarSync] Sync error:', err);
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

/**
 * Create a calendar event via Microsoft Graph
 *
 * IMPORTANT: The start/end Date objects should represent the correct UTC time.
 * The timezone parameter determines how the event is displayed in Outlook.
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
    timezone?: string; // e.g., 'America/New_York' - defaults to ET
  }
): Promise<{ success: boolean; eventId?: string; joinUrl?: string; error?: string }> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
  }

  const client = new MicrosoftGraphClient(token);
  const timezone = event.timezone || 'America/New_York';

  try {
    // Format datetime for Microsoft Graph
    // Convert UTC Date to local time string in the target timezone
    const formatForGraph = (date: Date): string => {
      // Use sv-SE locale for ISO-like format (YYYY-MM-DD HH:mm:ss)
      return date.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T');
    };

    console.log('[createCalendarEvent] Creating event:', {
      startUTC: event.start.toISOString(),
      startFormatted: formatForGraph(event.start),
      endUTC: event.end.toISOString(),
      endFormatted: formatForGraph(event.end),
      timezone,
    });

    const result = await client.createEvent({
      subject: event.subject,
      body: event.body ? { contentType: 'HTML', content: event.body } : undefined,
      start: {
        dateTime: formatForGraph(event.start),
        timeZone: timezone,
      },
      end: {
        dateTime: formatForGraph(event.end),
        timeZone: timezone,
      },
      attendees: event.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required' as const,
      })),
      isOnlineMeeting: event.isOnlineMeeting,
      onlineMeetingProvider: event.isOnlineMeeting ? 'teamsForBusiness' : undefined,
    });

    // Cast result to include onlineMeeting which Graph API returns but isn't in our typed response
    const fullResult = result as { id: string; webLink: string; onlineMeeting?: { joinUrl?: string } };

    return {
      success: true,
      eventId: fullResult.id,
      joinUrl: fullResult.onlineMeeting?.joinUrl,
    };
  } catch (err) {
    console.error('[createCalendarEvent] Error:', err);
    return { success: false, error: String(err) };
  }
}
