/**
 * Pipeline 1: Process Transcript Analysis
 *
 * Scans meeting transcription analysis for:
 * - Tier 2: Buying signals (competitor mentions, budget discussions, decision timelines)
 * - Tier 3: Our commitments and action items we own
 *
 * Creates command center items for each detected signal.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';
// Note: RI updates now happen via processIncomingCommunication when transcripts are synced
import {
  reconcileActionsForContact,
  getOpenItemsForContact,
  applyReconciliation,
} from '@/lib/intelligence/reconcileActions';
// Migrated to context-first pipeline
import { buildFullRelationshipContext } from '@/lib/intelligence';
import type { InteractionForReconciliation } from '@/types/commandCenter';
import { getProcessTypeForContext, type ProcessType } from '@/lib/process/getProcessContext';
import { isOnboardingAnalysis, type OnboardingTranscriptAnalysis } from '@/types/onboardingAnalysis';

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

interface Objection {
  objection: string;
  context?: string | null;
  howAddressed?: string | null;
  resolved?: boolean;
}

interface ExtractedInfo {
  budget?: string | null;
  timeline?: string | null;
  competitors?: string[];
  decisionProcess?: string | null;
  painPoints?: string[];
}

interface Sentiment {
  overall?: string;
  interestLevel?: string;
  urgency?: string;
}

interface TranscriptAnalysis {
  summary?: string;
  ourCommitments?: Commitment[];
  actionItems?: ActionItem[];
  buyingSignals?: BuyingSignal[];
  objections?: Objection[];
  extractedInfo?: ExtractedInfo;
  sentiment?: Sentiment;
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
  supabase: ReturnType<typeof createAdminClient>,
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
  supabase: ReturnType<typeof createAdminClient>,
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
    source: 'transcription',
    source_id: transcript.id,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Process buying signals for Tier 2 items
 */
async function processBuyingSignals(
  supabase: ReturnType<typeof createAdminClient>,
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
  supabase: ReturnType<typeof createAdminClient>,
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
 * Process onboarding-specific items from transcript analysis
 * Creates items for blockers, training gaps, go-live risks, etc.
 */
async function processOnboardingItems(
  supabase: ReturnType<typeof createAdminClient>,
  transcript: Transcript,
  analysis: OnboardingTranscriptAnalysis
): Promise<{ tier2: number; tier3: number }> {
  let tier2Created = 0;
  let tier3Created = 0;

  // Critical blockers -> Tier 2 (ONBOARDING_BLOCKER)
  const blockers = analysis.blockers || [];
  for (const blocker of blockers) {
    if (blocker.severity === 'critical' || blocker.severity === 'moderate') {
      const exists = await itemExists(supabase, transcript.id, 'onboarding_blocker', blocker.blocker);
      if (exists) continue;

      await createItem(supabase, transcript, {
        tier: blocker.severity === 'critical' ? 2 : 3,
        tierTrigger: 'onboarding_blocker',
        title: `Blocker: ${blocker.blocker.substring(0, 60)}`,
        description: `${blocker.blocker}\n\nResolution path: ${blocker.resolution_path}`,
        whyNow: `${blocker.severity.toUpperCase()} blocker owned by ${blocker.owner}: ${blocker.blocker}`,
        actionType: blocker.owner === 'us' ? 'task_complex' : 'follow_up',
        urgencyScore: blocker.severity === 'critical' ? 90 : 70,
      });

      if (blocker.severity === 'critical') {
        tier2Created++;
      } else {
        tier3Created++;
      }
    }
  }

  // Training gaps -> Tier 3 (TRAINING_GAP)
  const gaps = analysis.training_gaps || [];
  for (const gap of gaps) {
    const exists = await itemExists(supabase, transcript.id, 'training_gap', gap.area);
    if (exists) continue;

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'training_gap',
      title: `Training needed: ${gap.area.substring(0, 60)}`,
      description: `${gap.area}\n\nUsers affected: ${gap.users_affected}\nSuggested remedy: ${gap.suggested_remedy}`,
      whyNow: `Training gap identified for ${gap.users_affected}: ${gap.area}`,
      actionType: 'task_complex',
    });
    tier3Created++;
  }

  // Go-live risks -> Tier 2 if at_risk or delayed
  if (analysis.go_live_confidence === 'at_risk' || analysis.go_live_confidence === 'delayed') {
    const riskLevel = analysis.go_live_confidence;
    const exists = await itemExists(supabase, transcript.id, 'go_live_risk', riskLevel);
    if (!exists) {
      await createItem(supabase, transcript, {
        tier: 2,
        tierTrigger: 'go_live_risk',
        title: `Go-live ${riskLevel === 'delayed' ? 'DELAYED' : 'AT RISK'}${analysis.go_live_date ? ` - Target: ${analysis.go_live_date}` : ''}`,
        description: `Go-live confidence: ${riskLevel}\n\n${analysis.summary}`,
        whyNow: `Implementation is ${riskLevel}. Review blockers and risks immediately.`,
        actionType: 'review_meeting',
        urgencyScore: riskLevel === 'delayed' ? 95 : 80,
      });
      tier2Created++;
    }
  }

  // Adoption concerns -> Tier 3 (ADOPTION_RISK)
  const adoptionConcerns = (analysis.adoption_indicators || []).filter(i => i.sentiment === 'concerning');
  for (const concern of adoptionConcerns) {
    const exists = await itemExists(supabase, transcript.id, 'adoption_risk', concern.signal);
    if (exists) continue;

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'adoption_risk',
      title: `Adoption concern: ${concern.signal.substring(0, 60)}`,
      description: concern.quote ? `${concern.signal}\n\nQuote: "${concern.quote}"` : concern.signal,
      whyNow: `Concerning adoption signal detected: ${concern.signal}`,
      actionType: 'follow_up',
    });
    tier3Created++;
  }

  // Frustrated/blocker stakeholders -> Tier 2 (STAKEHOLDER_ISSUE)
  const problematicStakeholders = (analysis.stakeholder_sentiment || []).filter(
    s => s.sentiment === 'frustrated' || s.sentiment === 'blocker'
  );
  for (const stakeholder of problematicStakeholders) {
    const exists = await itemExists(supabase, transcript.id, 'stakeholder_issue', stakeholder.name);
    if (exists) continue;

    await createItem(supabase, transcript, {
      tier: stakeholder.sentiment === 'blocker' ? 2 : 3,
      tierTrigger: 'stakeholder_issue',
      title: `${stakeholder.sentiment === 'blocker' ? 'BLOCKER' : 'Frustrated'}: ${stakeholder.name} (${stakeholder.role})`,
      description: stakeholder.notes,
      whyNow: `${stakeholder.name} is ${stakeholder.sentiment}. Address their concerns to ensure successful implementation.`,
      actionType: 'call',
      urgencyScore: stakeholder.sentiment === 'blocker' ? 85 : 65,
    });

    if (stakeholder.sentiment === 'blocker') {
      tier2Created++;
    } else {
      tier3Created++;
    }
  }

  // Our commitments -> Tier 3 (same as sales, but with onboarding context)
  for (const commitment of analysis.ourCommitments || []) {
    const exists = await itemExists(supabase, transcript.id, 'promise_made', commitment.commitment);
    if (exists) continue;

    const dueDate = parseTimeframe(commitment.due_date, transcript.meeting_date);

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'promise_made',
      title: `Onboarding commitment: ${commitment.commitment.substring(0, 50)}`,
      description: commitment.commitment,
      whyNow: commitment.due_date
        ? `Promised during onboarding meeting by ${commitment.due_date}`
        : `Commitment made during onboarding: ${commitment.commitment}`,
      actionType: 'task_complex',
      commitmentText: commitment.commitment,
      promiseDate: dueDate,
      dueAt: dueDate,
    });
    tier3Created++;
  }

  // Action items -> Tier 3
  for (const ai of analysis.actionItems || []) {
    if (ai.owner !== 'us' && ai.owner !== undefined) continue;

    const exists = await itemExists(supabase, transcript.id, 'action_item', ai.description);
    if (exists) continue;

    const dueDate = ai.due_date ? new Date(ai.due_date) : parseTimeframe(null, transcript.meeting_date);

    await createItem(supabase, transcript, {
      tier: 3,
      tierTrigger: 'action_item',
      title: ai.description.substring(0, 80),
      description: ai.description,
      whyNow: `Onboarding action item: ${ai.description}`,
      actionType: ai.priority === 'high' ? 'task_complex' : 'task_simple',
      commitmentText: ai.description,
      promiseDate: dueDate,
      dueAt: dueDate,
    });
    tier3Created++;
  }

  return { tier2: tier2Created, tier3: tier3Created };
}

/**
 * Main pipeline function: Process all unprocessed transcripts
 */
export async function processTranscriptAnalysis(userId?: string): Promise<PipelineResult> {
  const supabase = createAdminClient();
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

      // Note: RI updates now happen via processIncomingCommunication when transcripts are synced
      // See src/lib/sync/initialHistoricalSync.ts for the migration

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

/**
 * Process a single transcript for command center items
 * Called immediately after AI analysis completes
 */
export async function processSingleTranscript(transcriptId: string): Promise<{
  success: boolean;
  itemsCreated: number;
  tier2Items: number;
  tier3Items: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  // Fetch the transcript with analysis
  const { data: transcript, error: fetchError } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptId)
    .single();

  if (fetchError || !transcript) {
    return {
      success: false,
      itemsCreated: 0,
      tier2Items: 0,
      tier3Items: 0,
      error: fetchError?.message || 'Transcript not found',
    };
  }

  // Check if already processed
  if (transcript.cc_items_created) {
    return {
      success: true,
      itemsCreated: 0,
      tier2Items: 0,
      tier3Items: 0,
      error: 'Already processed',
    };
  }

  // Check if analysis exists
  if (!transcript.analysis) {
    return {
      success: false,
      itemsCreated: 0,
      tier2Items: 0,
      tier3Items: 0,
      error: 'No analysis available',
    };
  }

  try {
    const typedTranscript: Transcript = {
      id: transcript.id,
      user_id: transcript.user_id,
      deal_id: transcript.deal_id,
      company_id: transcript.company_id,
      contact_id: transcript.contact_id,
      title: transcript.title,
      meeting_date: transcript.meeting_date,
      analysis: transcript.analysis as TranscriptAnalysis,
    };

    // Note: RI updates now happen via processIncomingCommunication when transcripts are synced
    // See src/lib/sync/initialHistoricalSync.ts for the migration

    // Detect process type to determine which processor to use
    const processType = await getProcessTypeForContext({
      userId: transcript.user_id,
      companyId: transcript.company_id,
    });

    console.log(`[ProcessTranscript] Using process type: ${processType} for transcript ${transcriptId}`);

    let tier2Created = 0;
    let tier3Created = 0;

    // Check if this is an onboarding analysis and process accordingly
    if (processType === 'onboarding' && isOnboardingAnalysis(typedTranscript.analysis)) {
      console.log(`[ProcessTranscript] Processing as onboarding transcript`);
      const onboardingResult = await processOnboardingItems(
        supabase,
        typedTranscript,
        typedTranscript.analysis as OnboardingTranscriptAnalysis
      );
      tier2Created = onboardingResult.tier2;
      tier3Created = onboardingResult.tier3;
    } else {
      // Default to sales processing
      console.log(`[ProcessTranscript] Processing as sales transcript`);
      // Process buying signals -> Tier 2
      tier2Created = await processBuyingSignals(supabase, typedTranscript, typedTranscript.analysis!);

      // Process commitments -> Tier 3
      tier3Created = await processCommitments(supabase, typedTranscript, typedTranscript.analysis!);
    }

    const totalCreated = tier2Created + tier3Created;

    // Run reconciliation to review all existing open items in light of this transcript
    if (typedTranscript.contact_id || typedTranscript.company_id) {
      try {
        console.log(`[ProcessTranscript] Running reconciliation for transcript ${transcriptId}`);

        // Build relationship context (migrated to buildFullRelationshipContext)
        const relationshipContext = await buildFullRelationshipContext({
          contactId: typedTranscript.contact_id,
          companyId: typedTranscript.company_id,
        });

        // Build interaction for reconciliation
        const analysis = typedTranscript.analysis!;
        const requiredActions = [
          ...(analysis.ourCommitments || []).map(c => ({
            action: c.commitment,
            owner: 'sales_rep' as const,
            urgency: 'medium' as const,
            reasoning: `Commitment made during meeting: ${typedTranscript.title}`,
          })),
          ...(analysis.actionItems || [])
            .filter(ai => ai.owner === 'us')
            .map(ai => ({
              action: ai.task,
              owner: 'sales_rep' as const,
              urgency: ai.priority === 'high' ? 'high' as const : 'medium' as const,
              reasoning: `Action item from meeting: ${typedTranscript.title}`,
            })),
        ];

        const newInteraction: InteractionForReconciliation = {
          type: 'transcript',
          date: new Date(typedTranscript.meeting_date),
          analysis: {
            summary: analysis.summary || typedTranscript.title,
            // Note: 'meeting' is not a valid CommunicationType, leaving undefined
            sales_stage: analysis.sentiment?.urgency === 'high' ? 'closing' : 'discovery',
            required_actions: requiredActions,
          },
        };

        // Get existing open items
        const existingItems = await getOpenItemsForContact(
          typedTranscript.user_id,
          typedTranscript.contact_id,
          typedTranscript.company_id
        );

        // Run reconciliation
        const reconcileResult = await reconcileActionsForContact(
          typedTranscript.contact_id,
          typedTranscript.company_id,
          typedTranscript.user_id,
          newInteraction,
          existingItems,
          relationshipContext
        );

        // Apply reconciliation decisions
        const reconStats = await applyReconciliation(
          typedTranscript.user_id,
          typedTranscript.contact_id,
          typedTranscript.company_id,
          reconcileResult
        );

        console.log(`[ProcessTranscript] Reconciliation: ${reconStats.completed} completed, ${reconStats.updated} updated, ${reconStats.created} created`);
      } catch (reconError) {
        console.error('[ProcessTranscript] Reconciliation error:', reconError);
        // Don't fail the whole process if reconciliation fails
      }
    }

    // Mark transcript as processed
    await supabase
      .from('meeting_transcriptions')
      .update({
        cc_items_created: true,
        cc_processed_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    return {
      success: true,
      itemsCreated: totalCreated,
      tier2Items: tier2Created,
      tier3Items: tier3Created,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      itemsCreated: 0,
      tier2Items: 0,
      tier3Items: 0,
      error: errorMsg,
    };
  }
}

export default processTranscriptAnalysis;
