/**
 * Fireflies Sync Service
 * Handles syncing transcripts from Fireflies.ai to X-FORCE
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { FirefliesClient, FirefliesTranscript } from './client';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';
// Migrated to context-first architecture
import {
  intelligentEntityMatch,
  updateRelationshipIntelligence,
  type CommunicationInput,
  type EntityMatchResult,
} from '@/lib/intelligence';
import {
  createTranscriptReviewTask,
  extractEntityDataFromTranscript,
  createEntityReviewTask,
  type TranscriptMatchResult,
} from './transcriptUtils';
import { processSingleTranscript } from '@/lib/pipelines';
import { syncTranscriptToCommunication } from '@/lib/communicationHub/sync';

export interface SyncResult {
  synced: number;
  analyzed: number;
  skipped: number;
  reviewTasksCreated: number;
  ccItemsCreated: number;
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
  aiMatchResult?: TranscriptMatchResult;
  matchMethod: 'email' | 'name' | 'ai' | 'none';
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
  let reviewTasksCreated = 0;
  let ccItemsCreated = 0;

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

    console.log('[Fireflies Sync] Fetching transcripts since:', fromDate.toISOString());

    let transcriptList;
    try {
      transcriptList = await client.getRecentTranscripts({
        limit: 50, // Fireflies API max is 50
        fromDate,
      });
      console.log('[Fireflies Sync] Found', transcriptList.length, 'transcripts');
    } catch (listError) {
      console.error('[Fireflies Sync] Error fetching transcript list:', listError);
      throw listError;
    }

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
        console.log('[Fireflies Sync] Fetching transcript:', item.id);
        let transcript;
        try {
          transcript = await client.getTranscript(item.id);
          console.log('[Fireflies Sync] Got transcript:', transcript.title);
        } catch (fetchError) {
          console.error('[Fireflies Sync] Error fetching transcript', item.id, ':', fetchError);
          throw fetchError;
        }

        // Parse participants
        const participants = FirefliesClient.parseParticipants(transcript.participants);

        // Build full transcript text first (needed for AI matching)
        const sentences = transcript.sentences || [];
        const transcriptText = sentences.length > 0
          ? FirefliesClient.buildTranscriptText(sentences)
          : `[No transcript text available for: ${transcript.title}]`;

        // Match to deal/company/contacts using basic matching first
        let match = await matchTranscriptToEntities(supabase, participants);

        // If basic matching has low confidence, use AI matching
        const AI_MATCH_THRESHOLD = 0.7;
        if (match.confidence < AI_MATCH_THRESHOLD && transcriptText.length > 100) {
          console.log('[Fireflies Sync] Low confidence basic match, using AI matching...');
          try {
            // Build CommunicationInput for the new entity matcher
            const communication: CommunicationInput = {
              type: 'transcript',
              attendees: participants.map(p => p.email || p.name),
              title: transcript.title || 'Untitled Meeting',
              transcript_text: transcriptText,
            };

            const entityMatch = await intelligentEntityMatch(communication, userId);

            // Update match with AI results if AI found a match
            if (entityMatch.company) {
              // Convert EntityMatchResult to TranscriptMatchResult format
              const aiMatchResult: TranscriptMatchResult = {
                companyId: entityMatch.company.id,
                companyName: entityMatch.company.name,
                dealId: null, // EntityMatchResult doesn't include deal
                confidence: entityMatch.confidence,
                reasoning: entityMatch.reasoning,
                requiresHumanReview: entityMatch.confidence < 0.7,
                reviewReason: entityMatch.confidence < 0.7 ? 'Low confidence match - review recommended' : null,
                extractedCompanyName: entityMatch.company.name,
                extractedPersonNames: participants.map(p => p.name),
              };

              match = {
                dealId: match.dealId, // Keep deal from basic matching
                companyId: entityMatch.company.id,
                contactIds: entityMatch.contact ? [entityMatch.contact.id] : match.contactIds,
                confidence: entityMatch.confidence,
                aiMatchResult,
                matchMethod: 'ai',
              };
              console.log('[Fireflies Sync] AI match found:', {
                company: entityMatch.company.name,
                confidence: entityMatch.confidence,
              });
            } else {
              // AI didn't find a match, but save the result for review task creation
              match.aiMatchResult = {
                companyId: null,
                companyName: null,
                dealId: null,
                confidence: entityMatch.confidence,
                reasoning: entityMatch.reasoning,
                requiresHumanReview: true,
                reviewReason: 'No matching company found',
                extractedCompanyName: null,
                extractedPersonNames: participants.map(p => p.name),
              };
              match.matchMethod = match.confidence > 0 ? match.matchMethod : 'none';
            }
          } catch (aiError) {
            console.error('[Fireflies Sync] AI matching failed:', aiError);
            // Continue with basic match results
          }
        }

        // Convert timestamp to Date
        // Fireflies returns timestamps in milliseconds (13 digits)
        const timestamp = transcript.date;
        const meetingDate = timestamp > 9999999999
          ? new Date(timestamp)  // Already in milliseconds
          : new Date(timestamp * 1000);  // Convert from seconds

        // Prepare insert data
        const insertData = {
          user_id: userId,
          deal_id: match.dealId,
          company_id: match.companyId,
          title: transcript.title || 'Untitled Meeting',
          meeting_date: meetingDate.toISOString().split('T')[0],
          duration_minutes: Math.round((transcript.duration || 0) / 60),
          attendees: transcript.participants || [],
          transcription_text: transcriptText,
          transcription_format: 'fireflies',
          word_count: transcriptText.split(/\s+/).length,
          source: 'fireflies',
          external_id: firefliesId,
          external_metadata: {
            fireflies_id: transcript.id,
            organizer_email: transcript.organizer_email,
            sentences: sentences,
            fireflies_summary: transcript.summary,
            transcript_url: transcript.transcript_url,
            audio_url: transcript.audio_url,
            video_url: transcript.video_url,
            match_method: match.matchMethod,
            ai_match_result: match.aiMatchResult || null,
          },
          match_confidence: match.confidence,
        };

        console.log('[Fireflies Sync] Saving transcript to database:', transcript.id);

        // Save transcript to meeting_transcriptions
        const { data: saved, error: saveError } = await supabase
          .from('meeting_transcriptions')
          .insert(insertData)
          .select()
          .single();

        if (saveError) {
          console.error('[Fireflies Sync] Database insert error:', saveError);
          errors.push(`Failed to save transcript ${transcript.id}: ${saveError.message}`);
          continue;
        }

        synced++;

        // Sync to Communication Hub (async, don't block)
        if (saved?.id) {
          syncTranscriptToCommunication(saved.id).catch((err) => {
            console.error('[Fireflies Sync] Failed to sync transcript to Communication Hub:', err);
          });
        }

        // Create activity record if matched to a deal (so it shows in Recent Activity)
        if (match.dealId && saved) {
          try {
            await supabase.from('activities').insert({
              deal_id: match.dealId,
              company_id: match.companyId,
              user_id: userId,
              type: 'meeting',
              subject: transcript.title || 'Meeting',
              body: transcript.summary?.overview || `Meeting transcript synced from Fireflies`,
              occurred_at: meetingDate.toISOString(),
              metadata: {
                transcription_id: saved.id,
                source: 'fireflies',
                duration_minutes: Math.round((transcript.duration || 0) / 60),
              },
            });
            console.log('[Fireflies Sync] Created meeting activity for transcript');
          } catch (activityError) {
            console.error('[Fireflies Sync] Failed to create activity:', activityError);
          }
        }

        // Handle unmatched transcripts - create review task with extracted data
        const noMatch = !match.dealId && !match.companyId;

        if (noMatch && saved && transcriptText.length > 100) {
          console.log('[Fireflies Sync] No match found, extracting entity data for review...');

          try {
            // Extract entity data from the transcript
            const extractedData = await extractEntityDataFromTranscript(
              transcriptText,
              transcript.title || 'Untitled Meeting',
              participants,
              userId
            );

            if (extractedData && extractedData.company?.name) {
              console.log('[Fireflies Sync] Extracted company:', extractedData.company.name);

              // Try to find a matching company by name similarity
              const { data: similarCompanies } = await supabase
                .from('companies')
                .select('id, name')
                .ilike('name', `%${extractedData.company.name.split(' ')[0]}%`)
                .limit(5);

              // If we find a likely match, link it
              if (similarCompanies && similarCompanies.length > 0) {
                const bestMatch = similarCompanies[0];
                console.log('[Fireflies Sync] Found similar company, linking:', bestMatch.name);

                match.companyId = bestMatch.id;
                await supabase
                  .from('meeting_transcriptions')
                  .update({ company_id: bestMatch.id })
                  .eq('id', saved.id);
              }

              // Store extracted data in metadata for later use
              await supabase
                .from('meeting_transcriptions')
                .update({
                  external_metadata: {
                    ...insertData.external_metadata,
                    extracted_entity_data: extractedData,
                  },
                })
                .eq('id', saved.id);

              // Create CC item directly for meeting follow-up
              const { error: ccError } = await supabase
                .from('command_center_items')
                .insert({
                  user_id: userId,
                  company_id: match.companyId,
                  title: `Review meeting: ${transcript.title || 'Untitled Meeting'}`,
                  description: `Review transcript and follow up on discussed items. ${extractedData.deal?.notes || ''}`,
                  action_type: 'meeting_follow_up',
                  status: 'pending',
                  momentum_score: 75,
                  source: 'fireflies',
                  source_id: saved.id,
                  company_name: extractedData.company.name,
                  why_now: 'New meeting transcript synced - needs review',
                  estimated_minutes: 15,
                });

              if (ccError) {
                console.error('[Fireflies Sync] Failed to create CC item:', ccError.message);
              } else {
                ccItemsCreated++;
                console.log('[Fireflies Sync] Created CC item for transcript review');
              }
            } else {
              // Couldn't extract enough data - create CC item anyway
              console.log('[Fireflies Sync] Could not extract entity data, creating basic CC item');

              const { error: ccError } = await supabase
                .from('command_center_items')
                .insert({
                  user_id: userId,
                  title: `Review transcript: ${transcript.title || 'Untitled Meeting'}`,
                  description: 'Meeting transcript needs manual review to assign to company.',
                  action_type: 'meeting_follow_up',
                  status: 'pending',
                  momentum_score: 60,
                  source: 'fireflies',
                  source_id: saved.id,
                  why_now: 'New meeting transcript synced - needs company assignment',
                  estimated_minutes: 10,
                });

              if (ccError) {
                console.error('[Fireflies Sync] Failed to create CC item:', ccError.message);
              } else {
                ccItemsCreated++;
              }
            }
          } catch (extractError) {
            console.error('[Fireflies Sync] Failed to extract entity data:', extractError);
            errors.push(`Failed to extract entity data for transcript ${transcript.id}: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
          }
        } else if (match.aiMatchResult?.requiresHumanReview && saved) {
          // Matched but still needs review (e.g., low confidence match)
          try {
            const { error: ccError } = await supabase
              .from('command_center_items')
              .insert({
                user_id: userId,
                company_id: match.companyId,
                title: `Review match: ${transcript.title || 'Untitled Meeting'}`,
                description: `Meeting transcript matched with low confidence. ${match.aiMatchResult.reasoning}`,
                action_type: 'meeting_follow_up',
                status: 'pending',
                momentum_score: 70,
                source: 'fireflies',
                source_id: saved.id,
                why_now: match.aiMatchResult.reviewReason || 'Low confidence match - needs verification',
                estimated_minutes: 10,
              });

            if (ccError) {
              console.error('[Fireflies Sync] Failed to create CC item:', ccError.message);
            } else {
              ccItemsCreated++;
              console.log('[Fireflies Sync] Created CC item for review');
            }
          } catch (taskError) {
            console.error('[Fireflies Sync] Failed to create review CC item:', taskError);
          }
        }

        // Run AI analysis if enabled
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

            // Process transcript for command center items
            try {
              const ccResult = await processSingleTranscript(saved.id);
              if (ccResult.success) {
                ccItemsCreated += ccResult.itemsCreated;
                console.log(`[Fireflies Sync] Created ${ccResult.itemsCreated} CC items (${ccResult.tier2Items} tier 2, ${ccResult.tier3Items} tier 3)`);
              }
            } catch (ccError) {
              console.error('[Fireflies Sync] Failed to create CC items:', ccError);
            }

            // Update Relationship Intelligence with transcript analysis
            // Only update if we have both company and contact (required by updateRelationshipIntelligence)
            const primaryContactId = match.contactIds[0];
            if (match.companyId && primaryContactId) {
              try {
                await updateRelationshipIntelligence({
                  companyId: match.companyId,
                  contactId: primaryContactId,
                  communicationId: saved.id,
                  communicationType: 'transcript',
                  analysis: {
                    key_facts_learned: (analysis.keyPoints || []).map((p: any) => ({
                      fact: typeof p === 'string' ? p : p?.point || String(p),
                      confidence: 0.8,
                    })),
                    buying_signals: (analysis.buyingSignals || []).map((s: any) => ({
                      signal: s.signal || (typeof s === 'string' ? s : String(s)),
                      strength: s.strength || 'moderate',
                    })),
                    concerns_raised: (analysis.objections || []).map((o: any) => ({
                      concern: o.objection || (typeof o === 'string' ? o : String(o)),
                      severity: o.resolved ? 'low' as const : 'medium' as const,
                    })),
                    commitment_updates: {
                      new_ours: (analysis.ourCommitments || []).map((c: any) => ({
                        commitment: c.commitment,
                        due_by: c.when,
                      })),
                      new_theirs: (analysis.theirCommitments || []).map((c: any) => ({
                        commitment: c.commitment,
                        expected_by: c.when,
                      })),
                      completed: [],
                    },
                    relationship_summary_update: analysis.summary || `Meeting: ${transcript.title}`,
                    should_create_deal: false,
                    communication_type: 'general',
                    suggested_actions: [],
                  },
                });
                console.log('[Fireflies Sync] Updated Relationship Intelligence for', match.companyId);
              } catch (riError) {
                console.error('[Fireflies Sync] Failed to update RI:', riError);
              }
            } else if (match.companyId) {
              console.log('[Fireflies Sync] Skipping RI update - no contact linked to transcript');
            }

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

  return { synced, analyzed, skipped, reviewTasksCreated, ccItemsCreated, errors };
}

// Internal/sales team email domains to exclude from matching
// These are X-RAI internal emails that shouldn't be used to match transcripts to companies
const INTERNAL_EMAIL_DOMAINS = new Set([
  'affiliatedtech.com',
  'x-rai.com',
  'xrai.com',
  'xrailabs.com',
]);

/**
 * Check if an email is from an internal domain
 */
function isInternalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  return domain ? INTERNAL_EMAIL_DOMAINS.has(domain) : false;
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
  let matchMethod: 'email' | 'name' | 'ai' | 'none' = 'none';

  // Extract emails from participants, excluding internal domains
  const emails = participants
    .map((p) => p.email)
    .filter((email): email is string => !!email && !isInternalEmail(email));

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
      matchMethod = 'email';

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
            matchMethod = 'name';

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

  return { dealId, companyId, contactIds, confidence, matchMethod };
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
