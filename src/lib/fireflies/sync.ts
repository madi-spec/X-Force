/**
 * Fireflies Sync Service
 * Handles syncing transcripts from Fireflies.ai to X-FORCE
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { FirefliesClient, FirefliesTranscript } from './client';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';

export interface SyncResult {
  synced: number;
  analyzed: number;
  skipped: number;
  errors: string[];
}

export interface FirefliesConnection {
  id: string;
  user_id: string;
  api_key: string;
  auto_analyze: boolean;
  auto_create_drafts: boolean;
  auto_create_tasks: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  transcripts_synced: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MatchResult {
  dealId: string | null;
  companyId: string | null;
  contactIds: string[];
  confidence: number;
}

/**
 * Sync all Fireflies transcripts for a user
 */
export async function syncFirefliesTranscripts(userId: string): Promise<SyncResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let synced = 0;
  let analyzed = 0;
  let skipped = 0;

  // Get user's Fireflies connection
  const { data: connection, error: connError } = await supabase
    .from('fireflies_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (connError || !connection) {
    throw new Error('No active Fireflies connection found');
  }

  // Mark sync as in progress
  await supabase
    .from('fireflies_connections')
    .update({ last_sync_status: 'in_progress' })
    .eq('id', connection.id);

  try {
    const client = new FirefliesClient(connection.api_key);

    // Get transcripts since last sync (or last 30 days if first sync)
    const fromDate = connection.last_sync_at
      ? new Date(connection.last_sync_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const transcriptList = await client.getRecentTranscripts({
      limit: 100,
      fromDate,
    });

    for (const item of transcriptList) {
      const firefliesId = `fireflies_${item.id}`;

      try {
        // Check if we already have this transcript
        const { data: existing } = await supabase
          .from('meeting_transcriptions')
          .select('id')
          .eq('external_id', firefliesId)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Fetch full transcript with content
        const transcript = await client.getTranscript(item.id);

        // Parse participants
        const participants = FirefliesClient.parseParticipants(transcript.participants);

        // Match to deal/company/contacts
        const match = await matchTranscriptToEntities(supabase, participants);

        // Build full transcript text
        const transcriptText = FirefliesClient.buildTranscriptText(transcript.sentences);

        // Convert Unix timestamp to Date
        const meetingDate = new Date(transcript.date * 1000);

        // Save transcript to meeting_transcriptions
        const { data: saved, error: saveError } = await supabase
          .from('meeting_transcriptions')
          .insert({
            user_id: userId,
            deal_id: match.dealId,
            company_id: match.companyId,
            title: transcript.title,
            meeting_date: meetingDate.toISOString().split('T')[0],
            duration_minutes: Math.round(transcript.duration / 60),
            attendees: transcript.participants,
            transcription_text: transcriptText,
            transcription_format: 'fireflies',
            word_count: transcriptText.split(/\s+/).length,
            source: 'fireflies',
            external_id: firefliesId,
            external_metadata: {
              fireflies_id: transcript.id,
              organizer_email: transcript.organizer_email,
              sentences: transcript.sentences,
              fireflies_summary: transcript.summary,
              transcript_url: transcript.transcript_url,
              audio_url: transcript.audio_url,
              video_url: transcript.video_url,
            },
            match_confidence: match.confidence,
          })
          .select()
          .single();

        if (saveError) {
          errors.push(`Failed to save transcript ${transcript.id}: ${saveError.message}`);
          continue;
        }

        synced++;

        // Run AI analysis if enabled and we have a deal match
        if (connection.auto_analyze && saved) {
          try {
            const analysis = await analyzeMeetingTranscription(transcriptText, {
              title: transcript.title,
              meetingDate: meetingDate.toISOString().split('T')[0],
              attendees: transcript.participants,
              dealId: match.dealId || undefined,
              companyId: match.companyId || undefined,
            });

            // Update transcription with analysis
            await supabase
              .from('meeting_transcriptions')
              .update({
                analysis,
                analysis_generated_at: new Date().toISOString(),
                summary: analysis.summary,
                follow_up_email_draft: analysis.followUpEmail?.body,
              })
              .eq('id', saved.id);

            analyzed++;

            // Auto-create tasks if enabled
            if (connection.auto_create_tasks && analysis.actionItems) {
              await createTasksFromActionItems(
                supabase,
                analysis.actionItems.filter((a: { owner: string }) => a.owner === 'us'),
                match.dealId,
                userId
              );
            }

            // Auto-create email draft if enabled
            if (connection.auto_create_drafts && analysis.followUpEmail && match.contactIds.length > 0) {
              await createEmailDraft(
                supabase,
                analysis.followUpEmail,
                match,
                userId,
                saved.id
              );
            }
          } catch (analysisError) {
            const errMsg = analysisError instanceof Error ? analysisError.message : 'Unknown error';
            errors.push(`Failed to analyze transcript ${transcript.id}: ${errMsg}`);
          }
        }
      } catch (transcriptError) {
        const errMsg = transcriptError instanceof Error ? transcriptError.message : 'Unknown error';
        errors.push(`Error processing transcript ${item.id}: ${errMsg}`);
      }
    }

    // Update connection with success
    await supabase
      .from('fireflies_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
        transcripts_synced: (connection.transcripts_synced || 0) + synced,
      })
      .eq('id', connection.id);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    // Update connection with error
    await supabase
      .from('fireflies_connections')
      .update({
        last_sync_status: 'error',
        last_sync_error: errMsg,
      })
      .eq('id', connection.id);

    throw error;
  }

  return { synced, analyzed, skipped, errors };
}

/**
 * Match transcript participants to X-FORCE contacts/deals
 */
async function matchTranscriptToEntities(
  supabase: ReturnType<typeof createAdminClient>,
  participants: Array<{ name: string; email?: string }>
): Promise<MatchResult> {
  const contactIds: string[] = [];
  let dealId: string | null = null;
  let companyId: string | null = null;
  let confidence = 0;

  // Extract emails from participants
  const emails = participants
    .map((p) => p.email)
    .filter((email): email is string => !!email);

  if (emails.length > 0) {
    // Find contacts by email
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, company_id')
      .in('email', emails);

    if (contacts && contacts.length > 0) {
      contactIds.push(...contacts.map((c) => c.id));

      // Get company from first matched contact
      companyId = contacts[0].company_id;
      confidence = 0.8;

      // Try to find active deal for this company
      if (companyId) {
        const { data: deals } = await supabase
          .from('deals')
          .select('id')
          .eq('company_id', companyId)
          .not('stage', 'in', '("closed_won","closed_lost")')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (deals && deals.length > 0) {
          dealId = deals[0].id;
          confidence = 0.9;
        }
      }
    }
  }

  // If no email match, try name matching (lower confidence)
  if (contactIds.length === 0) {
    const names = participants.map((p) => p.name.toLowerCase());

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, company_id');

    if (contacts) {
      for (const contact of contacts) {
        const contactName = contact.name?.toLowerCase() || '';
        if (names.some((name) => contactName.includes(name) || name.includes(contactName))) {
          contactIds.push(contact.id);

          if (!companyId && contact.company_id) {
            companyId = contact.company_id;
            confidence = 0.6;

            // Find active deal for this company
            const { data: deals } = await supabase
              .from('deals')
              .select('id')
              .eq('company_id', companyId)
              .not('stage', 'in', '("closed_won","closed_lost")')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (deals && deals.length > 0) {
              dealId = deals[0].id;
              confidence = 0.7;
            }
          }
          break; // Take first name match
        }
      }
    }
  }

  return { dealId, companyId, contactIds, confidence };
}

/**
 * Create tasks from action items
 */
async function createTasksFromActionItems(
  supabase: ReturnType<typeof createAdminClient>,
  actionItems: Array<{
    task: string;
    priority?: string | null;
    dueDate?: string | null;
  }>,
  dealId: string | null,
  userId: string
): Promise<void> {
  for (const item of actionItems) {
    // Infer task type from content
    const taskLower = item.task.toLowerCase();
    let taskType = 'follow_up';
    if (taskLower.includes('email') || taskLower.includes('send')) {
      taskType = 'email';
    } else if (taskLower.includes('call') || taskLower.includes('phone')) {
      taskType = 'call';
    } else if (taskLower.includes('meeting') || taskLower.includes('schedule')) {
      taskType = 'meeting';
    } else if (taskLower.includes('review') || taskLower.includes('check')) {
      taskType = 'review';
    }

    // Calculate due date based on priority if not specified
    let dueAt = item.dueDate;
    if (!dueAt) {
      const days = item.priority === 'high' ? 1 : item.priority === 'medium' ? 3 : 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      dueAt = dueDate.toISOString();
    }

    await supabase.from('tasks').insert({
      deal_id: dealId,
      assigned_to: userId,
      type: taskType,
      title: item.task,
      description: `Auto-generated from Fireflies meeting transcript`,
      priority: item.priority || 'medium',
      due_at: dueAt,
      source: 'fireflies_ai',
    });
  }
}

/**
 * Create email draft from follow-up template
 */
async function createEmailDraft(
  supabase: ReturnType<typeof createAdminClient>,
  followUpEmail: {
    subject: string;
    body: string;
    attachmentSuggestions?: string[];
  },
  match: MatchResult,
  userId: string,
  transcriptionId: string
): Promise<void> {
  // Get primary contact email
  if (match.contactIds.length === 0) return;

  const { data: contact } = await supabase
    .from('contacts')
    .select('email')
    .eq('id', match.contactIds[0])
    .single();

  if (!contact?.email) return;

  await supabase.from('ai_email_drafts').insert({
    deal_id: match.dealId,
    company_id: match.companyId,
    contact_id: match.contactIds[0],
    user_id: userId,
    to_addresses: [contact.email],
    subject: followUpEmail.subject,
    body_html: followUpEmail.body.replace(/\n/g, '<br>'),
    body_plain: followUpEmail.body,
    draft_type: 'follow_up',
    generation_prompt: `Auto-generated from Fireflies meeting transcript (${transcriptionId})`,
    suggested_attachments: followUpEmail.attachmentSuggestions || [],
    status: 'draft',
  });
}

/**
 * Get connection status for a user
 */
export async function getFirefliesConnectionStatus(userId: string): Promise<{
  connected: boolean;
  connection?: FirefliesConnection;
}> {
  const supabase = createAdminClient();

  const { data: connection } = await supabase
    .from('fireflies_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    connection: connection as FirefliesConnection,
  };
}

/**
 * Connect a Fireflies account
 */
export async function connectFireflies(
  userId: string,
  apiKey: string,
  settings: {
    autoAnalyze?: boolean;
    autoCreateDrafts?: boolean;
    autoCreateTasks?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string; userEmail?: string }> {
  const supabase = createAdminClient();

  // Test the API key
  const client = new FirefliesClient(apiKey);
  const testResult = await client.testConnection();

  if (!testResult.success) {
    return { success: false, error: testResult.error || 'Invalid API key' };
  }

  // Upsert connection (replace existing if any)
  const { error: upsertError } = await supabase
    .from('fireflies_connections')
    .upsert(
      {
        user_id: userId,
        api_key: apiKey,
        auto_analyze: settings.autoAnalyze ?? true,
        auto_create_drafts: settings.autoCreateDrafts ?? true,
        auto_create_tasks: settings.autoCreateTasks ?? true,
        is_active: true,
        last_sync_status: null,
        last_sync_error: null,
      },
      {
        onConflict: 'user_id',
      }
    );

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  return { success: true, userEmail: testResult.user?.email };
}

/**
 * Disconnect Fireflies account
 */
export async function disconnectFireflies(userId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('fireflies_connections')
    .delete()
    .eq('user_id', userId);

  return !error;
}

/**
 * Update Fireflies settings
 */
export async function updateFirefliesSettings(
  userId: string,
  settings: {
    autoAnalyze?: boolean;
    autoCreateDrafts?: boolean;
    autoCreateTasks?: boolean;
  }
): Promise<boolean> {
  const supabase = createAdminClient();

  const updates: Record<string, boolean> = {};
  if (settings.autoAnalyze !== undefined) updates.auto_analyze = settings.autoAnalyze;
  if (settings.autoCreateDrafts !== undefined) updates.auto_create_drafts = settings.autoCreateDrafts;
  if (settings.autoCreateTasks !== undefined) updates.auto_create_tasks = settings.autoCreateTasks;

  const { error } = await supabase
    .from('fireflies_connections')
    .update(updates)
    .eq('user_id', userId)
    .eq('is_active', true);

  return !error;
}
