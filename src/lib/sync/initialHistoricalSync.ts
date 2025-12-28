/**
 * Initial Historical Sync
 *
 * MIGRATED: Now uses processIncomingCommunication from contextFirstPipeline
 * instead of deprecated updateRelationshipFromAnalysis and processOutboundEmail.
 *
 * Comprehensive sync that:
 * 1. Fetches all emails from all folders (except Deleted/Junk) from last month
 * 2. Fetches all calendar events from last month
 * 3. Fetches all transcripts from last month
 * 4. Processes everything in CHRONOLOGICAL ORDER (oldest first)
 * 5. Builds relationship intelligence sequentially
 * 6. Creates command center actions from final state
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { syncAllFolderEmails } from '@/lib/microsoft/emailSync';
import { syncCalendarEvents } from '@/lib/microsoft/calendarSync';
// Migrated to context-first pipeline
import {
  processIncomingCommunication,
  type CommunicationInput,
} from '@/lib/intelligence/contextFirstPipeline';
import { analyzeEmail, saveEmailAnalysis } from '@/lib/email/analyzeEmail';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

export interface SyncProgress {
  phase: string;
  total: number;
  processed: number;
  currentItem?: string;
  startedAt: string;
  updatedAt: string;
}

export interface InitialSyncResult {
  success: boolean;
  phases: {
    emails: { imported: number; skipped: number; errors: string[] };
    calendar: { imported: number; skipped: number; errors: string[] };
    transcripts: { count: number };
    processing: {
      total: number;
      processed: number;
      riUpdates: number;
      errors: string[];
    };
    commandCenter: {
      itemsCreated: number;
      tier1: number;
      tier2: number;
      tier3: number;
      tier4: number;
      tier5: number;
    };
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface SyncableItem {
  type: 'email_inbound' | 'email_outbound' | 'transcript' | 'calendar';
  id: string;
  date: Date;
  data: any;
}

// ============================================
// PROGRESS TRACKING
// ============================================

async function updateProgress(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  progress: Partial<SyncProgress>
): Promise<void> {
  const now = new Date().toISOString();

  try {
    await supabase
      .from('sync_progress')
      .upsert(
        {
          user_id: userId,
          ...progress,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );
  } catch (err) {
    // Table may not exist yet, ignore
  }
}

// ============================================
// PHASE 1: SYNC ALL EMAILS
// ============================================

async function syncAllEmails(
  userId: string,
  sinceDate: Date,
  onProgress: (msg: string) => void
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  onProgress('Syncing emails from all folders...');

  const result = await syncAllFolderEmails(userId, {
    sinceDate,
    maxMessages: 500, // Generous limit for initial sync
  });

  onProgress(`Emails synced: ${result.imported} imported, ${result.skipped} skipped, ${result.folders || 0} folders`);

  return {
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
  };
}

// ============================================
// PHASE 2: SYNC CALENDAR
// ============================================

async function syncCalendar(
  userId: string,
  sinceDate: Date,
  onProgress: (msg: string) => void
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  onProgress('Syncing calendar events...');

  const result = await syncCalendarEvents(userId, {
    sinceDate,
    untilDate: new Date(), // Up to now
    maxEvents: 200,
  });

  onProgress(`Calendar synced: ${result.imported} events imported, ${result.skipped} skipped`);

  return {
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
  };
}

// ============================================
// PHASE 3: GET TRANSCRIPTS
// ============================================

async function getTranscripts(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sinceDate: Date,
  onProgress: (msg: string) => void
): Promise<any[]> {
  onProgress('Fetching transcripts...');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('user_id', userId)
    .gte('meeting_date', sinceDate.toISOString())
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: true });

  onProgress(`Found ${transcripts?.length || 0} transcripts with analysis`);

  return transcripts || [];
}

// ============================================
// PHASE 4: COLLECT AND SORT ALL ITEMS
// ============================================

async function collectAllItems(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sinceDate: Date,
  transcripts: any[],
  onProgress: (msg: string) => void
): Promise<SyncableItem[]> {
  onProgress('Collecting all items for chronological processing...');

  const items: SyncableItem[] = [];

  // Get emails from email_messages table
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, received_at, sent_at, is_sent_by_user, analysis_complete')
    .eq('user_id', userId)
    .gte('received_at', sinceDate.toISOString())
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: true });

  for (const email of emails || []) {
    items.push({
      type: email.is_sent_by_user ? 'email_outbound' : 'email_inbound',
      id: email.id,
      date: new Date(email.received_at || email.sent_at),
      data: email,
    });
  }

  // Add transcripts
  for (const transcript of transcripts) {
    items.push({
      type: 'transcript',
      id: transcript.id,
      date: new Date(transcript.meeting_date),
      data: transcript,
    });
  }

  // Sort by date (oldest first)
  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  onProgress(`Collected ${items.length} items for processing (${emails?.length || 0} emails, ${transcripts.length} transcripts)`);

  return items;
}

// ============================================
// PHASE 5: PROCESS ITEMS CHRONOLOGICALLY
// ============================================

async function processItemsChronologically(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  items: SyncableItem[],
  onProgress: (msg: string, current?: number, total?: number) => void
): Promise<{ processed: number; riUpdates: number; errors: string[] }> {
  const result = { processed: 0, riUpdates: 0, errors: [] as string[] };

  onProgress(`Processing ${items.length} items chronologically...`, 0, items.length);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const percent = Math.round((i / items.length) * 100);

    try {
      if (item.type === 'email_inbound') {
        // Process inbound email for relationship intelligence (no CC item)
        await processInboundForRI(supabase, item.id);
        result.riUpdates++;
      } else if (item.type === 'email_outbound') {
        // Process outbound email for relationship intelligence
        await processOutboundForRI(supabase, item.id);
        result.riUpdates++;
      } else if (item.type === 'transcript') {
        // Process transcript for relationship intelligence (no CC item)
        await processTranscriptForRI(supabase, item.data);
        result.riUpdates++;
      }

      result.processed++;

      if (i % 10 === 0 || i === items.length - 1) {
        onProgress(`Processing... ${percent}% (${i + 1}/${items.length})`, i + 1, items.length);
      }
    } catch (err) {
      result.errors.push(`${item.type} ${item.id}: ${err}`);
    }
  }

  onProgress(`Completed: ${result.processed} items processed, ${result.riUpdates} RI updates`, items.length, items.length);

  return result;
}

// ============================================
// PROCESS INBOUND EMAIL FOR RI ONLY
// ============================================

async function processInboundForRI(
  supabase: ReturnType<typeof createAdminClient>,
  emailId: string
): Promise<void> {
  // Get email details
  const { data: email } = await supabase
    .from('email_messages')
    .select('id, user_id, conversation_ref, from_email, from_name, to_emails, subject, body_text, body_preview, received_at, analysis')
    .eq('id', emailId)
    .single();

  if (!email) return;

  // Build CommunicationInput for context-first pipeline
  const communication: CommunicationInput = {
    type: 'email_inbound',
    from_email: email.from_email,
    from_name: email.from_name || undefined,
    to_emails: email.to_emails || [],
    subject: email.subject || undefined,
    body: email.body_text || email.body_preview || undefined,
  };

  try {
    // Run context-first pipeline (handles entity matching + RI updates)
    await processIncomingCommunication(communication, email.user_id);
  } catch (err) {
    console.warn(`[InitialSync] Pipeline failed for inbound email ${emailId}:`, err);
    // Fall back to legacy analysis if pipeline fails
    try {
      const result = await analyzeEmail(emailId);
      await saveEmailAnalysis(result);
    } catch (analysisErr) {
      console.warn(`[InitialSync] Analysis also failed for email ${emailId}:`, analysisErr);
      return;
    }
  }

  // Mark as processed (but no CC item created during historical sync)
  await supabase
    .from('email_messages')
    .update({ analysis_complete: true })
    .eq('id', emailId);
}

// ============================================
// PROCESS OUTBOUND EMAIL FOR RI ONLY
// ============================================

async function processOutboundForRI(
  supabase: ReturnType<typeof createAdminClient>,
  emailId: string
): Promise<void> {
  // Get email details
  const { data: email } = await supabase
    .from('email_messages')
    .select('id, user_id, from_email, from_name, to_emails, subject, body_text, body_preview, sent_at')
    .eq('id', emailId)
    .single();

  if (!email) return;

  // Build CommunicationInput for context-first pipeline
  const communication: CommunicationInput = {
    type: 'email_outbound',
    from_email: email.from_email,
    from_name: email.from_name || undefined,
    to_emails: email.to_emails || [],
    subject: email.subject || undefined,
    body: email.body_text || email.body_preview || undefined,
  };

  try {
    // Run context-first pipeline (handles entity matching + RI updates)
    await processIncomingCommunication(communication, email.user_id);
  } catch (err) {
    console.warn(`[InitialSync] Pipeline failed for outbound email ${emailId}:`, err);
  }

  // Mark as processed
  await supabase
    .from('email_messages')
    .update({ analysis_complete: true })
    .eq('id', emailId);
}

// ============================================
// PROCESS TRANSCRIPT FOR RI ONLY
// ============================================

async function processTranscriptForRI(
  _supabase: ReturnType<typeof createAdminClient>,
  transcript: any
): Promise<void> {
  if (!transcript.user_id) {
    console.warn(`[InitialSync] Transcript ${transcript.id} has no user_id, skipping`);
    return;
  }

  // Build CommunicationInput for context-first pipeline
  const communication: CommunicationInput = {
    type: 'transcript',
    attendees: transcript.attendees || [],
    title: transcript.title,
    transcript_text: transcript.transcript || transcript.analysis?.summary || '',
  };

  try {
    // Run context-first pipeline (handles entity matching + RI updates)
    await processIncomingCommunication(communication, transcript.user_id);
  } catch (err) {
    console.warn(`[InitialSync] Pipeline failed for transcript ${transcript.id}:`, err);
  }
}

// ============================================
// PHASE 6: CREATE COMMAND CENTER ACTIONS
// ============================================

async function createActionsFromCurrentState(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  onProgress: (msg: string) => void
): Promise<{ itemsCreated: number; tier1: number; tier2: number; tier3: number; tier4: number; tier5: number }> {
  const result = { itemsCreated: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };

  onProgress('Creating command center actions from current state...');

  // Get all relationship intelligence records for this user
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .not('company_id', 'is', null);

  if (!riRecords || riRecords.length === 0) {
    onProgress('No relationship intelligence records found');
    return result;
  }

  const now = new Date();

  for (const ri of riRecords) {
    // Get company and contact info for linking
    let companyName: string | null = null;
    let contactName: string | null = null;

    if (ri.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', ri.company_id)
        .single();
      companyName = company?.name || null;
    }

    if (ri.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', ri.contact_id)
        .single();
      contactName = contact?.name || null;
    }

    const targetName = contactName || companyName || 'Unknown';

    // Check for overdue commitments WE made (Tier 3)
    const ourCommitments = ri.open_commitments?.ours || [];
    for (const commitment of ourCommitments) {
      if (commitment.status !== 'pending') continue;

      const dueBy = commitment.due_by ? new Date(commitment.due_by) : null;
      const isOverdue = dueBy && dueBy < now;

      if (isOverdue) {
        const daysOverdue = Math.floor((now.getTime() - dueBy.getTime()) / (1000 * 60 * 60 * 24));

        // Check if item already exists
        const { data: existing } = await supabase
          .from('command_center_items')
          .select('id')
          .eq('user_id', userId)
          .eq('tier_trigger', 'promise_made')
          .ilike('commitment_text', `%${commitment.commitment.substring(0, 50)}%`)
          .single();

        if (!existing) {
          await supabase.from('command_center_items').insert({
            user_id: userId,
            company_id: ri.company_id,
            contact_id: ri.contact_id,
            action_type: 'task_complex',
            title: `Overdue: ${commitment.commitment.substring(0, 60)}`,
            description: commitment.commitment,
            why_now: `You promised this ${daysOverdue} days ago. ${targetName} is waiting.`,
            tier: 3 as PriorityTier,
            tier_trigger: 'promise_made' as TierTrigger,
            commitment_text: commitment.commitment,
            promise_date: commitment.made_on,
            due_at: dueBy?.toISOString(),
            status: 'pending',
            source: 'system',
            target_name: targetName,
            company_name: companyName,
          });
          result.tier3++;
          result.itemsCreated++;
        }
      }
    }

    // Check for hot leads (2+ strong buying signals in last 2 weeks) (Tier 2)
    const signals = ri.signals?.buying_signals || [];
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentStrongSignals = signals.filter((s: any) => {
      const signalDate = s.date ? new Date(s.date) : now;
      return signalDate >= twoWeeksAgo && (s.strength === 'strong' || s.strength === 'moderate');
    });

    if (recentStrongSignals.length >= 2) {
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', ri.company_id)
        .eq('tier_trigger', 'buying_signal')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        await supabase.from('command_center_items').insert({
          user_id: userId,
          company_id: ri.company_id,
          contact_id: ri.contact_id,
          action_type: 'call',
          title: `Hot lead: ${targetName}`,
          description: `${recentStrongSignals.length} strong buying signals detected in the last 2 weeks.`,
          why_now: `Multiple buying signals: ${recentStrongSignals.slice(0, 2).map((s: any) => s.signal).join(', ')}`,
          tier: 2 as PriorityTier,
          tier_trigger: 'buying_signal' as TierTrigger,
          status: 'pending',
          source: 'system',
          target_name: targetName,
          company_name: companyName,
          urgency_score: 80,
        });
        result.tier2++;
        result.itemsCreated++;
      }
    }

    // Check for unresolved concerns (Tier 4)
    const concerns = ri.signals?.concerns || [];
    const unresolvedConcerns = concerns.filter((c: any) => !c.resolved);

    if (unresolvedConcerns.length > 0) {
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', ri.company_id)
        .eq('tier_trigger', 'concern_unresolved')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        await supabase.from('command_center_items').insert({
          user_id: userId,
          company_id: ri.company_id,
          contact_id: ri.contact_id,
          action_type: 'research_account',
          title: `Address concerns: ${targetName}`,
          description: `${unresolvedConcerns.length} unresolved concern(s) that need addressing.`,
          why_now: `Unresolved: "${unresolvedConcerns[0].concern}"`,
          tier: 4 as PriorityTier,
          tier_trigger: 'concern_unresolved' as TierTrigger,
          status: 'pending',
          source: 'system',
          target_name: targetName,
          company_name: companyName,
        });
        result.tier4++;
        result.itemsCreated++;
      }
    }

    // Check for THEIR overdue commitments (Tier 4)
    const theirCommitments = ri.open_commitments?.theirs || [];
    for (const commitment of theirCommitments) {
      if (commitment.status !== 'pending') continue;

      const expectedBy = commitment.expected_by ? new Date(commitment.expected_by) : null;
      const isOverdue = expectedBy && expectedBy < now;

      if (isOverdue) {
        const daysOverdue = Math.floor((now.getTime() - expectedBy.getTime()) / (1000 * 60 * 60 * 24));

        // Check if item already exists
        const { data: existing } = await supabase
          .from('command_center_items')
          .select('id')
          .eq('user_id', userId)
          .eq('tier_trigger', 'their_commitment_overdue')
          .ilike('commitment_text', `%${commitment.commitment.substring(0, 50)}%`)
          .single();

        if (!existing) {
          await supabase.from('command_center_items').insert({
            user_id: userId,
            company_id: ri.company_id,
            contact_id: ri.contact_id,
            action_type: 'call',
            title: `Follow up: ${commitment.commitment.substring(0, 50)}`,
            description: commitment.commitment,
            why_now: `They said they'd "${commitment.commitment.substring(0, 40)}" by ${expectedBy.toLocaleDateString()} — ${daysOverdue} days ago. Follow up.`,
            tier: 4 as PriorityTier,
            tier_trigger: 'their_commitment_overdue' as TierTrigger,
            commitment_text: commitment.commitment,
            due_at: expectedBy?.toISOString(),
            status: 'pending',
            source: 'system',
            target_name: targetName,
            company_name: companyName,
          });
          result.tier4++;
          result.itemsCreated++;
        }
      }
    }

  }

  // ===========================================
  // TIER 4: STALE DEALS & BIG DEALS
  // ===========================================

  // Get deals for stale deal detection
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, estimated_value, company_id, stage, updated_at, created_at')
    .eq('owner_id', userId)
    .in('stage', ['qualifying', 'discovery', 'demo', 'data_review', 'trial', 'negotiation'])
    .order('estimated_value', { ascending: false });

  // Get company names for deals
  const dealCompanyIds = [...new Set((deals || []).filter(d => d.company_id).map(d => d.company_id))];
  const { data: dealCompanies } = dealCompanyIds.length > 0
    ? await supabase.from('companies').select('id, name').in('id', dealCompanyIds)
    : { data: [] };
  const dealCompanyMap = new Map((dealCompanies || []).map(c => [c.id, c.name]));

  for (const deal of deals || []) {
    const dealCompanyName = deal.company_id ? dealCompanyMap.get(deal.company_id) : null;
    const dealTargetName = deal.name || dealCompanyName || 'Unknown Deal';

    // Calculate days since last activity (use updated_at as proxy)
    const lastActivity = deal.updated_at ? new Date(deal.updated_at) : new Date(deal.created_at);
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    // Stale deals: No activity in 10+ days (Tier 4)
    if (daysSinceActivity >= 10) {
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('deal_id', deal.id)
        .eq('tier_trigger', 'deal_stale')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        const valueStr = deal.estimated_value
          ? `$${(deal.estimated_value / 1000).toFixed(0)}K`
          : '';
        await supabase.from('command_center_items').insert({
          user_id: userId,
          deal_id: deal.id,
          company_id: deal.company_id,
          action_type: 'call',
          title: `Stale deal: ${dealTargetName}`,
          description: `${deal.stage} stage deal with no activity in ${daysSinceActivity} days.`,
          why_now: valueStr
            ? `${valueStr} deal with no activity in ${daysSinceActivity} days`
            : `Deal silent for ${daysSinceActivity} days — worth a check-in`,
          tier: 4 as PriorityTier,
          tier_trigger: 'deal_stale' as TierTrigger,
          status: 'pending',
          source: 'system',
          target_name: dealTargetName,
          company_name: dealCompanyName,
          value_score: deal.estimated_value || 0,
        });
        result.tier4++;
        result.itemsCreated++;
      }
    }
  }

  // Big deals needing attention: Top 10 by value, no contact in 7+ days (Tier 4)
  const topDeals = (deals || []).filter(d => d.estimated_value && d.estimated_value > 0).slice(0, 10);
  for (const deal of topDeals) {
    const lastActivity = deal.updated_at ? new Date(deal.updated_at) : new Date(deal.created_at);
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    // Only if 7+ days since activity but less than 10 (to avoid duplicate with stale deals)
    if (daysSinceActivity >= 7 && daysSinceActivity < 10) {
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('deal_id', deal.id)
        .eq('tier_trigger', 'big_deal_attention')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        const dealCompanyName = deal.company_id ? dealCompanyMap.get(deal.company_id) : null;
        const valueStr = `$${(deal.estimated_value / 1000).toFixed(0)}K`;

        await supabase.from('command_center_items').insert({
          user_id: userId,
          deal_id: deal.id,
          company_id: deal.company_id,
          action_type: 'call',
          title: `Check in: ${valueStr} deal`,
          description: `High-value deal at ${deal.stage} stage.`,
          why_now: `${valueStr} deal — worth a check-in`,
          tier: 4 as PriorityTier,
          tier_trigger: 'big_deal_attention' as TierTrigger,
          status: 'pending',
          source: 'system',
          target_name: deal.name || dealCompanyName || 'Deal',
          company_name: dealCompanyName,
          value_score: deal.estimated_value,
        });
        result.tier4++;
        result.itemsCreated++;
      }
    }
  }

  // Orphaned opportunities: Contacts with engagement but no deal (Tier 4)
  // These are leads that fell through the cracks - they engaged but weren't linked to a deal
  for (const ri of riRecords || []) {
    // Only check RI records that have activity
    const hasEngagement = (ri.interactions?.length || 0) > 0 ||
      (ri.signals?.buying_signals || []).length > 0;

    if (!hasEngagement) continue;

    // Check if there's a deal for this company
    let hasDeal = false;
    if (ri.company_id) {
      const { data: companyDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('company_id', ri.company_id)
        .eq('owner_id', userId)
        .not('stage', 'in', '("closed_won","closed_lost")')
        .limit(1)
        .single();
      hasDeal = !!companyDeal;
    }

    // If has deal, it's properly linked - skip
    if (hasDeal) continue;

    // Check if we already have a CC item for this
    let existingQuery = supabase
      .from('command_center_items')
      .select('id')
      .eq('user_id', userId)
      .eq('tier_trigger', 'orphaned_opportunity')
      .eq('status', 'pending');

    if (ri.contact_id) {
      existingQuery = existingQuery.eq('contact_id', ri.contact_id);
    } else if (ri.company_id) {
      existingQuery = existingQuery.eq('company_id', ri.company_id);
    } else {
      continue; // No contact or company, skip
    }

    const { data: existing } = await existingQuery.single();

    if (!existing) {
      // Get contact/company name for display
      let orphanTargetName = 'Contact';
      let orphanCompanyName: string | null = null;

      if (ri.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('name, email')
          .eq('id', ri.contact_id)
          .single();
        orphanTargetName = contact?.name || contact?.email || orphanTargetName;
      }

      if (ri.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', ri.company_id)
          .single();
        orphanCompanyName = company?.name || null;
        if (!ri.contact_id) {
          orphanTargetName = orphanCompanyName || orphanTargetName;
        }
      }

      // Determine what's missing
      const missingWhat = !ri.company_id
        ? 'company or deal'
        : 'deal';

      const interactionCount = ri.interactions?.length || 0;
      const signalCount = (ri.signals?.buying_signals || []).length;

      await supabase.from('command_center_items').insert({
        user_id: userId,
        contact_id: ri.contact_id,
        company_id: ri.company_id,
        action_type: 'task_simple',
        title: `Link opportunity: ${orphanTargetName}`,
        description: `Has ${interactionCount} interaction${interactionCount !== 1 ? 's' : ''} and ${signalCount} buying signal${signalCount !== 1 ? 's' : ''} but no ${missingWhat} linked.`,
        why_now: `${interactionCount > 0 ? `${interactionCount} interactions` : `${signalCount} buying signals`} — link to track this opportunity`,
        tier: 4 as PriorityTier,
        tier_trigger: 'orphaned_opportunity' as TierTrigger,
        status: 'pending',
        source: 'system',
        target_name: orphanTargetName,
        company_name: orphanCompanyName,
      });
      result.tier4++;
      result.itemsCreated++;
    }
  }

  // ===========================================
  // TIER 5: BUILD PIPELINE
  // ===========================================

  // Get user's companies from multiple sources:
  // 1. From deals (owner_id)
  // 2. From RI records (which have company_id)
  const { data: userDealsForT5 } = await supabase
    .from('deals')
    .select('company_id')
    .eq('owner_id', userId)
    .not('company_id', 'is', null);

  // Also get company IDs from existing RI records (the user's interactions)
  const riCompanyIds = [...new Set((riRecords || []).filter(r => r.company_id).map(r => r.company_id))];
  const dealCompanyIdsForT5 = [...new Set((userDealsForT5 || []).map(d => d.company_id).filter(Boolean))];

  const userCompanyIds = [...new Set([...riCompanyIds, ...dealCompanyIdsForT5])];

  // Get contacts linked to those companies
  if (userCompanyIds.length > 0) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: newContacts } = await supabase
      .from('contacts')
      .select('id, name, email, company_id, created_at')
      .in('company_id', userCompanyIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    for (const contact of newContacts || []) {
      if (!contact.email) continue;

      // Check if any outbound emails sent to this contact
      const { data: outboundEmails } = await supabase
        .from('email_messages')
        .select('id')
        .eq('user_id', userId)
        .eq('is_sent_by_user', true)
        .ilike('to_email', `%${contact.email}%`)
        .limit(1)
        .single();

      if (!outboundEmails) {
        const { data: existing } = await supabase
          .from('command_center_items')
          .select('id')
          .eq('user_id', userId)
          .eq('contact_id', contact.id)
          .eq('tier_trigger', 'new_contact_no_outreach')
          .eq('status', 'pending')
          .single();

        if (!existing) {
          // Get company name
          let contactCompanyName: string | null = null;
          if (contact.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('name')
              .eq('id', contact.company_id)
              .single();
            contactCompanyName = company?.name || null;
          }

          await supabase.from('command_center_items').insert({
            user_id: userId,
            contact_id: contact.id,
            company_id: contact.company_id,
            action_type: 'email_compose',
            title: `Introduce yourself: ${contact.name || contact.email}`,
            description: `New contact added but no outreach sent yet.`,
            why_now: `New contact — no outreach yet`,
            tier: 5 as PriorityTier,
            tier_trigger: 'new_contact_no_outreach' as TierTrigger,
            status: 'pending',
            source: 'system',
            target_name: contact.name || contact.email,
            company_name: contactCompanyName,
          });
          result.tier5++;
          result.itemsCreated++;
        }
      }
    }

    // Companies needing research (Tier 5)
    const { data: companiesNeedingResearch } = await supabase
      .from('companies')
      .select('id, name, domain, intelligence_data')
      .in('id', userCompanyIds)
      .order('created_at', { ascending: false })
      .limit(50);

    for (const company of companiesNeedingResearch || []) {
      // Check if intelligence data is minimal
      const hasMinimalData =
        !company.intelligence_data ||
        Object.keys(company.intelligence_data || {}).length < 3;

      if (hasMinimalData) {
        const { data: existing } = await supabase
          .from('command_center_items')
          .select('id')
          .eq('user_id', userId)
          .eq('company_id', company.id)
          .eq('tier_trigger', 'research_needed')
          .eq('status', 'pending')
          .single();

        if (!existing) {
          await supabase.from('command_center_items').insert({
            user_id: userId,
            company_id: company.id,
            action_type: 'research_account',
            title: `Research: ${company.name || company.domain}`,
            description: `Company needs research before meaningful outreach.`,
            why_now: `Research needed before outreach`,
            tier: 5 as PriorityTier,
            tier_trigger: 'research_needed' as TierTrigger,
            status: 'pending',
            source: 'system',
            target_name: company.name || company.domain,
            company_name: company.name,
          });
          result.tier5++;
          result.itemsCreated++;
        }
      }
    }
  }

  // Cold leads: RI records with buying signals but no interaction in 30+ days (Tier 5)
  // Calculate from last_contact_date in RI (or from interactions array)
  for (const ri of riRecords || []) {
    const hasBuyingSignals = (ri.signals?.buying_signals || []).length > 0;

    // Try to get last contact date from metrics or interactions
    let lastContactDate: Date | null = null;
    if (ri.metrics?.last_contact_date) {
      lastContactDate = new Date(ri.metrics.last_contact_date);
    } else if (ri.interactions?.length > 0) {
      // Get the most recent interaction date
      const lastInteraction = ri.interactions[ri.interactions.length - 1];
      if (lastInteraction?.date) {
        lastContactDate = new Date(lastInteraction.date);
      }
    }

    if (!lastContactDate || !hasBuyingSignals) continue;

    const daysSinceInteraction = Math.floor(
      (now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceInteraction >= 30) {
      // Get names for display
      let coldTargetName = 'Lead';
      let coldCompanyName: string | null = null;

      if (ri.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', ri.company_id)
          .single();
        coldCompanyName = company?.name || null;
        coldTargetName = coldCompanyName || coldTargetName;
      }

      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', ri.company_id)
        .eq('tier_trigger', 'cold_lead_reengage')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        await supabase.from('command_center_items').insert({
          user_id: userId,
          company_id: ri.company_id,
          contact_id: ri.contact_id,
          action_type: 'email_compose',
          title: `Re-engage: ${coldTargetName}`,
          description: `Had buying signals but no contact in ${daysSinceInteraction} days.`,
          why_now: `Showed interest ${daysSinceInteraction} days ago — worth a re-engage`,
          tier: 5 as PriorityTier,
          tier_trigger: 'cold_lead_reengage' as TierTrigger,
          status: 'pending',
          source: 'system',
          target_name: coldTargetName,
          company_name: coldCompanyName,
        });
        result.tier5++;
        result.itemsCreated++;
      }
    }
  }

  // Check for unanswered inbound emails (Tier 1)
  const { data: unansweredEmails } = await supabase
    .from('email_messages')
    .select(`
      id,
      conversation_ref,
      from_email,
      from_name,
      subject,
      received_at,
      analysis
    `)
    .eq('user_id', userId)
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(20);

  for (const email of unansweredEmails || []) {
    // Check if we've replied
    const { data: reply } = await supabase
      .from('email_messages')
      .select('id')
      .eq('conversation_ref', email.conversation_ref)
      .eq('is_sent_by_user', true)
      .gt('received_at', email.received_at)
      .limit(1)
      .single();

    if (reply) continue; // Already replied

    // Check if CC item already exists
    const { data: existing } = await supabase
      .from('command_center_items')
      .select('id')
      .eq('conversation_id', email.conversation_ref)
      .eq('status', 'pending')
      .single();

    if (existing) continue;

    const fromName = email.from_name || email.from_email.split('@')[0];
    const analysis = email.analysis as any;
    const receivedDate = new Date(email.received_at);
    const hoursAgo = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60));

    // Only create items for recent unanswered emails (last 48 hours)
    if (hoursAgo > 48) continue;

    await supabase.from('command_center_items').insert({
      user_id: userId,
      conversation_id: email.conversation_ref,
      action_type: 'email_respond',
      title: `Reply to ${fromName}`,
      description: analysis?.email_analysis?.summary || email.subject,
      why_now: hoursAgo <= 4
        ? `${fromName} is waiting. Received ${hoursAgo} hours ago.`
        : `Unanswered for ${hoursAgo} hours. ${fromName} may be waiting.`,
      tier: hoursAgo <= 4 ? 1 : 2 as PriorityTier,
      tier_trigger: 'email_needs_response' as TierTrigger,
      sla_minutes: hoursAgo <= 4 ? 240 : 480,
      received_at: email.received_at,
      status: 'pending',
      source: 'email_ai_analysis',
      target_name: fromName,
      email_draft: analysis?.response_draft,
    });

    if (hoursAgo <= 4) {
      result.tier1++;
    } else {
      result.tier2++;
    }
    result.itemsCreated++;
  }

  onProgress(`Created ${result.itemsCreated} command center items (T1: ${result.tier1}, T2: ${result.tier2}, T3: ${result.tier3}, T4: ${result.tier4}, T5: ${result.tier5})`);

  return result;
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function runInitialHistoricalSync(
  userId: string,
  onProgress?: (message: string, phase?: string, current?: number, total?: number) => void
): Promise<InitialSyncResult> {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  const result: InitialSyncResult = {
    success: false,
    phases: {
      emails: { imported: 0, skipped: 0, errors: [] },
      calendar: { imported: 0, skipped: 0, errors: [] },
      transcripts: { count: 0 },
      processing: { total: 0, processed: 0, riUpdates: 0, errors: [] },
      commandCenter: { itemsCreated: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 },
    },
    startedAt,
  };

  const log = (msg: string, phase?: string, current?: number, total?: number) => {
    console.log(`[InitialSync] ${msg}`);
    onProgress?.(msg, phase, current, total);
  };

  try {
    // Calculate 1 month ago
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 1);

    log(`Starting initial sync from ${sinceDate.toISOString()}`, 'init');

    // Mark sync as started (if column exists)
    try {
      await supabase
        .from('users')
        .update({ initial_sync_started_at: startedAt })
        .eq('id', userId);
    } catch (err) {
      // Column may not exist yet, ignore
    }

    // PHASE 1: Sync all emails
    log('Phase 1: Syncing emails...', 'emails');
    result.phases.emails = await syncAllEmails(userId, sinceDate, (msg) => log(msg, 'emails'));

    // PHASE 2: Sync calendar
    log('Phase 2: Syncing calendar...', 'calendar');
    result.phases.calendar = await syncCalendar(userId, sinceDate, (msg) => log(msg, 'calendar'));

    // PHASE 3: Get transcripts
    log('Phase 3: Getting transcripts...', 'transcripts');
    const transcripts = await getTranscripts(supabase, userId, sinceDate, (msg) => log(msg, 'transcripts'));
    result.phases.transcripts.count = transcripts.length;

    // PHASE 4: Collect all items
    log('Phase 4: Collecting items...', 'collecting');
    const items = await collectAllItems(supabase, userId, sinceDate, transcripts, (msg) => log(msg, 'collecting'));
    result.phases.processing.total = items.length;

    // PHASE 5: Process chronologically
    log('Phase 5: Processing chronologically...', 'processing');
    const processingResult = await processItemsChronologically(
      supabase,
      userId,
      items,
      (msg, current, total) => log(msg, 'processing', current, total)
    );
    result.phases.processing.processed = processingResult.processed;
    result.phases.processing.riUpdates = processingResult.riUpdates;
    result.phases.processing.errors = processingResult.errors;

    // PHASE 6: Create command center actions
    log('Phase 6: Creating command center actions...', 'commandCenter');
    result.phases.commandCenter = await createActionsFromCurrentState(
      supabase,
      userId,
      (msg) => log(msg, 'commandCenter')
    );

    // Mark sync as complete (if columns exist)
    const completedAt = new Date().toISOString();
    try {
      await supabase
        .from('users')
        .update({
          initial_sync_complete: true,
          initial_sync_completed_at: completedAt,
        })
        .eq('id', userId);
    } catch (err) {
      // Columns may not exist yet, ignore
    }

    result.success = true;
    result.completedAt = completedAt;

    log(`Sync complete! ${result.phases.processing.processed} items processed, ${result.phases.commandCenter.itemsCreated} CC items created`, 'complete');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.error = errorMsg;
    log(`Sync failed: ${errorMsg}`, 'error');
  }

  return result;
}

// ============================================
// EXPORTS
// ============================================

export { createActionsFromCurrentState };
