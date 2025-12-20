/**
 * Pipeline 1: Process Transcript Analysis
 *
 * Scans meeting transcription analysis for:
 * - Tier 2: Buying signals (competitor mentions, budget discussions, decision timelines)
 * - Tier 3: Our commitments and action items we own
 *
 * Creates command center items for each detected signal.
 */

import { createClient } from '@/lib/supabase/server';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';

// Types for transcript analysis structure
interface Commitment {
  commitment: string;
  when?: string | null;
}

interface ActionItem {
  task: string;
  owner: 'us' | 'them';
  assignee?: string | null;
  dueDate?: string | null;
  priority: 'high' | 'medium' | 'low';
}

interface BuyingSignal {
  signal: string;
  quote?: string | null;
  strength: 'strong' | 'moderate' | 'weak';
}

interface ExtractedInfo {
  budget?: string | null;
  timeline?: string | null;
  competitors?: string[];
  decisionProcess?: string | null;
}

interface TranscriptAnalysis {
  ourCommitments?: Commitment[];
  actionItems?: ActionItem[];
  buyingSignals?: BuyingSignal[];
  extractedInfo?: ExtractedInfo;
}

interface Transcript {
  id: string;
  user_id: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  title: string;
  meeting_date: string;
  analysis: TranscriptAnalysis | null;
}

interface PipelineResult {
  transcriptsProcessed: number;
  itemsCreated: number;
  tier2Items: number;
  tier3Items: number;
  errors: string[];
}

/**
 * Parse a commitment timeframe into a due date
 */
function parseTimeframe(when: string | null | undefined, meetingDate: string): Date | null {
  if (!when) return null;

  const lowerWhen = when.toLowerCase();
  const meetingDt = new Date(meetingDate);

  // Common patterns
  if (lowerWhen.includes('today')) {
    return meetingDt;
  }
  if (lowerWhen.includes('tomorrow')) {
    const dt = new Date(meetingDt);
    dt.setDate(dt.getDate() + 1);
    return dt;
  }
  if (lowerWhen.includes('end of week') || lowerWhen.includes('this week') || lowerWhen.includes('friday')) {
    const dt = new Date(meetingDt);
    const dayOfWeek = dt.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
    dt.setDate(dt.getDate() + daysUntilFriday);
    return dt;
  }
  if (lowerWhen.includes('next week')) {
    const dt = new Date(meetingDt);
    dt.setDate(dt.getDate() + 7);
    return dt;
  }
  if (lowerWhen.includes('end of month') || lowerWhen.includes('this month')) {
    const dt = new Date(meetingDt);
    dt.setMonth(dt.getMonth() + 1);
    dt.setDate(0); // Last day of current month
    return dt;
  }
  // Try parsing as date directly
  if (/\d{4}-\d{2}-\d{2}/.test(when)) {
    return new Date(when);
  }

  // Default: 3 days from meeting
  const dt = new Date(meetingDt);
  dt.setDate(dt.getDate() + 3);
  return dt;
}

/**
 * Check if a CC item already exists for this transcript + trigger
 */
async function itemExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  transcriptionId: string,
  tierTrigger: string,
  title: string
): Promise<boolean> {
  const { data } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('transcription_id', transcriptionId)
    .eq('tier_trigger', tierTrigger)
    .ilike('title', `%${title.substring(0, 50)}%`)
    .single();

  return !!data;
}

/**
 * Create a command center item from transcript analysis
 */
async function createItem(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  transcript: Transcript,
  item: {
    tier: PriorityTier;
    tierTrigger: TierTrigger;
    title: string;
    description: string;
    whyNow: string;
    dueAt?: Date | null;
    actionType: string;
    commitmentText?: string;
    promiseDate?: Date | null;
    urgencyScore?: number;
  }
): Promise<void> {
  const now = new Date().toISOString();

  await supabase.from('command_center_items').insert({
    user_id: transcript.user_id,
    transcription_id: transcript.id,
    deal_id: transcript.deal_id,
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    action_type: item.actionType,
    title: item.title,
    description: item.description,
    why_now: item.whyNow,
    tier: item.tier,
    tier_trigger: item.tierTrigger,
    due_at: item.dueAt?.toISOString() || null,
    promise_date: item.promiseDate?.toISOString() || null,
    commitment_text: item.commitmentText || null,
    urgency_score: item.urgencyScore || 0,
    status: 'pending',
    source: 'calendar_sync',
    created_at: now,
    updated_at: now,
  });
}

/**
 * Process buying signals for Tier 2 items
 */
async function processBuyingSignals(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  transcript: Transcript,
  analysis: TranscriptAnalysis
): Promise<number> {
  let itemsCreated = 0;
  const signals = analysis.buyingSignals || [];
  const info = analysis.extractedInfo || {};

  // Strong buying signals -> Tier 2
  for (const signal of signals) {
    if (signal.strength === 'strong' || signal.strength === 'moderate') {
      const exists = await itemExists(supabase, transcript.id, 'buying_signal', signal.signal);
      if (exists) continue;

      await createItem(supabase, transcript, {
        tier: 2,
        tierTrigger: 'buying_signal',
        title: `Follow up on buying signal: ${signal.signal.substring(0, 50)}`,
        description: signal.quote || signal.signal,
        whyNow: `Strong buying signal detected: "${signal.signal}"`,
        actionType: 'task_complex',
        urgencyScore: signal.strength === 'strong' ? 80 : 60,
      });
      itemsCreated++;
    }
  }

  // Competitor mentions -> Tier 2
  const competitors = info.competitors || [];
  if (competitors.length > 0) {
    const competitorList = competitors.join(', ');
    const exists = await itemExists(supabase, transcript.id, 'competitive_risk', competitorList);
    if (!exists) {
      await createItem(supabase, transcript, {
        tier: 2,
        tierTrigger: 'competitive_risk',
        title: `Competitive response: ${competitorList}`,
        description: `Competitors mentioned: ${competitorList}. Prepare competitive positioning.`,
        whyNow: `Evaluating against ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}: ${competitorList}`,
        actionType: 'research_account',
        urgencyScore: 70,
      });
      itemsCreated++;
    }
  }

  // Budget discussions -> Tier 2
  if (info.budget) {
    const exists = await itemExists(supabase, transcript.id, 'budget_discussed', info.budget);
    if (!exists) {
      await createItem(supabase, transcript, {
        tier: 2,
        tierTrigger: 'budget_discussed',
        title: `Budget confirmed: ${info.budget}`,
        description: `Budget mentioned in meeting: ${info.budget}. Update deal value and proposal.`,
        whyNow: `Budget signal: ${info.budget}`,
        actionType: 'proposal_review',
        urgencyScore: 65,
      });
      itemsCreated++;
    }
  }

  // Decision timeline -> Tier 2 if urgent
  if (info.timeline) {
    const lowerTimeline = info.timeline.toLowerCase();
    const isUrgent =
      lowerTimeline.includes('this week') ||
      lowerTimeline.includes('today') ||
      lowerTimeline.includes('tomorrow') ||
      lowerTimeline.includes('urgent') ||
      lowerTimeline.includes('asap');

    if (isUrgent) {
      const exists = await itemExists(supabase, transcript.id, 'deadline_critical', info.timeline);
      if (!exists) {
        await createItem(supabase, transcript, {
          tier: 2,
          tierTrigger: 'deadline_critical',
          title: `Urgent timeline: ${info.timeline}`,
          description: `Decision timeline mentioned: ${info.timeline}. Prioritize this deal.`,
          whyNow: `Urgent decision: ${info.timeline}`,
          actionType: 'call',
          urgencyScore: 90,
        });
        itemsCreated++;
      }
    }
  }

  return itemsCreated;
}

/**
 * Process our commitments for Tier 3 items
 */
async function processCommitments(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  transcript: Transcript,
  analysis: TranscriptAnalysis
): Promise<number> {
  let itemsCreated = 0;
  const commitments = analysis.ourCommitments || [];
  const actionItems = (analysis.actionItems || []).filter((ai) => ai.owner === 'us');

  // Our commitments -> Tier 3
  for (const commitment of commitments) {
    const exists = await itemExists(supabase, transcript.id, 'promise_made', commitment.commitment);
    if (exists) continue;

    const dueDate = parseTimeframe(commitment.when, transcript.meeting_date);

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'promise_made',
      title: `Promised: ${commitment.commitment.substring(0, 60)}`,
      description: commitment.commitment,
      whyNow: commitment.when
        ? `You said "${commitment.commitment}" by ${commitment.when}`
        : `You promised: "${commitment.commitment}"`,
      actionType: 'task_complex',
      commitmentText: commitment.commitment,
      promiseDate: dueDate,
      dueAt: dueDate,
    });
    itemsCreated++;
  }

  // Action items owned by us -> Tier 3
  for (const ai of actionItems) {
    const exists = await itemExists(supabase, transcript.id, 'action_item', ai.task);
    if (exists) continue;

    const dueDate = ai.dueDate ? new Date(ai.dueDate) : parseTimeframe(null, transcript.meeting_date);

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'action_item',
      title: ai.task.substring(0, 80),
      description: ai.task,
      whyNow: `Action item from ${transcript.title}: ${ai.task}`,
      actionType: ai.priority === 'high' ? 'task_complex' : 'task_simple',
      commitmentText: ai.task,
      promiseDate: dueDate,
      dueAt: dueDate,
    });
    itemsCreated++;
  }

  return itemsCreated;
}

/**
 * Main pipeline function: Process all unprocessed transcripts
 */
export async function processTranscriptAnalysis(userId?: string): Promise<PipelineResult> {
  const supabase = await createClient();
  const result: PipelineResult = {
    transcriptsProcessed: 0,
    itemsCreated: 0,
    tier2Items: 0,
    tier3Items: 0,
    errors: [],
  };

  // Query for unprocessed transcripts with analysis
  let query = supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('cc_items_created', false)
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: false })
    .limit(50);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: transcripts, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!transcripts || transcripts.length === 0) {
    return result;
  }

  for (const transcript of transcripts as Transcript[]) {
    try {
      if (!transcript.analysis) continue;

      // Process buying signals -> Tier 2
      const tier2Created = await processBuyingSignals(supabase, transcript, transcript.analysis);
      result.tier2Items += tier2Created;

      // Process commitments -> Tier 3
      const tier3Created = await processCommitments(supabase, transcript, transcript.analysis);
      result.tier3Items += tier3Created;

      result.itemsCreated += tier2Created + tier3Created;

      // Mark transcript as processed
      await supabase
        .from('meeting_transcriptions')
        .update({
          cc_items_created: true,
          cc_processed_at: new Date().toISOString(),
        })
        .eq('id', transcript.id);

      result.transcriptsProcessed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Transcript ${transcript.id}: ${errorMsg}`);
    }
  }

  return result;
}

export default processTranscriptAnalysis;
