/**
 * Action Reconciliation System
 *
 * After every new interaction (email, transcript), this system reviews ALL
 * existing open action items for that contact/company and determines what
 * should happen to each one:
 * - KEEP: Still relevant, no changes
 * - COMPLETE: No longer needed (action taken, deal moved past this step, etc.)
 * - UPDATE: Still relevant but needs modification (tier, why_now, title)
 * - COMBINE: Multiple items should be merged
 *
 * This prevents action item sprawl and keeps the command center focused.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { SALES_PLAYBOOK } from './salesPlaybook';
// Accept either the new RelationshipContext or legacy context with formattedForAI/promptContext
interface ReconciliationContext {
  formattedForAI?: string;
  promptContext?: string;
}
type RelationshipContext = ReconciliationContext;
import type {
  CommandCenterItem,
  ReconciliationResult,
  ReconciliationItemDecision,
  NewCommandCenterItem,
  InteractionForReconciliation,
  PriorityTier,
  TierTrigger,
  ActionOwner,
  WorkflowStep,
} from '@/types/commandCenter';
import { createHash } from 'crypto';

// ============================================
// SOURCE INFO FOR DEDUPLICATION
// ============================================

export interface SourceInfo {
  source_type: 'email' | 'meeting' | 'form' | 'manual';
  source_id: string; // email_id, meeting_id, etc.
  email_id?: string;
  communication_type?: string;
}

/**
 * Generate a hash for duplicate detection
 * Hash = source_type + source_id + contact_id + communication_type
 */
function generateSourceHash(
  sourceInfo: SourceInfo,
  contactId: string | null,
  companyId: string | null
): string {
  const parts = [
    sourceInfo.source_type,
    sourceInfo.source_id,
    contactId || 'no-contact',
    companyId || 'no-company',
    sourceInfo.communication_type || 'unknown',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 64);
}

// ============================================
// RECONCILIATION PROMPT
// ============================================

function buildReconciliationPrompt(
  newInteraction: InteractionForReconciliation,
  existingItems: CommandCenterItem[],
  relationshipContext: RelationshipContext
): string {
  const existingItemsText = existingItems.map(item => `
- ID: ${item.id}
  Title: ${item.title}
  Tier: ${item.tier}
  Trigger: ${item.tier_trigger}
  Created: ${item.created_at}
  Why Now: ${item.why_now || 'N/A'}
  Status: ${item.status}
  Description: ${item.description || 'N/A'}
`).join('\n');

  const today = new Date().toISOString().split('T')[0];

  return `${SALES_PLAYBOOK}

---

## CURRENT SITUATION

### New Interaction Just Processed:
Type: ${newInteraction.type}
Date: ${newInteraction.date.toISOString()}
Summary: ${newInteraction.analysis.summary}
Communication Type: ${newInteraction.analysis.communication_type || 'unknown'}
Sales Stage: ${newInteraction.analysis.sales_stage || 'unknown'}
Actions Identified: ${JSON.stringify(newInteraction.analysis.required_actions || [], null, 2)}

### Existing Open Action Items for This Contact/Company:
${existingItemsText || 'No existing open items'}

### Relationship Context:
${relationshipContext.formattedForAI || relationshipContext.promptContext || 'No context available'}

---

## YOUR TASK

Review the existing action items in light of this new interaction. For each existing item, determine:

1. **KEEP**: Item is still relevant and needed, no changes required.

2. **COMPLETE**: Item should be marked complete because:
   - The action was completed (e.g., we committed to send pricing, and this email shows we sent it)
   - The deal moved past this step (e.g., "schedule demo" but demo already happened)
   - Superseded by a more important/recent action
   - The interaction resolved or made this obsolete

3. **UPDATE**: Item is still relevant but needs modification:
   - Tier should change based on new urgency (upgrade or downgrade)
   - Why_now needs updating based on new context
   - Title needs clarification

4. **COMBINE**: Multiple items should be merged:
   - Redundant items about the same thing
   - Related items that make sense as one task

Also determine what NEW items should be created from this interaction that don't duplicate existing items.

IMPORTANT RULES:
- If a signed trial form was received, complete any "schedule demo" or "initial outreach" items
- If we responded to an email, complete items about "respond to email" for that thread
- Don't create duplicate items - if an existing item covers the need, update it instead
- Trial form = immediate ops action + schedule review call (2 items)
- Be conservative with new items - only create what's truly needed

Return JSON:
{
  "reasoning": "Overall assessment of how this interaction changes the action landscape. What happened and what's the impact?",

  "existing_items": [
    {
      "id": "item-uuid",
      "decision": "keep" | "complete" | "update" | "combine",
      "reason": "Why this decision based on the new interaction",
      "updates": {
        "tier": 2,
        "why_now": "Updated reason based on new context"
      },
      "combine_into": "other-item-id"
    }
  ],

  "new_items": [
    {
      "title": "Specific action title",
      "description": "What needs to be done and why",
      "tier": 1,
      "tier_trigger": "Tier 1: demo_request|pricing_request|trial_request|email_reply|meeting_request|inbound_lead | Tier 2: objection|competitor|deadline_critical|buying_signal | Tier 3: meeting_follow_up|meeting_commitment|follow_up|action_item | Tier 4: high_value|deal_stale | Tier 5: general|research_needed",
      "why_now": "Compelling reason based on the interaction",
      "owner": "sales_rep" | "operations" | "technical" | "management",
      "urgency": "critical" | "high" | "medium" | "low"
    }
  ],

  "summary": "Brief summary: X items completed, Y updated, Z new items created"
}

Today's date is ${today}.`;
}

// ============================================
// MAIN RECONCILIATION FUNCTION
// ============================================

/**
 * Reconcile actions for a contact/company after a new interaction
 */
export async function reconcileActionsForContact(
  contactId: string | null,
  companyId: string | null,
  userId: string,
  newInteraction: InteractionForReconciliation,
  existingOpenItems: CommandCenterItem[],
  relationshipContext: RelationshipContext
): Promise<ReconciliationResult> {
  console.log(`[Reconciliation] Processing for contact=${contactId}, company=${companyId}`);
  console.log(`[Reconciliation] New interaction: ${newInteraction.type} - ${newInteraction.analysis.summary}`);
  console.log(`[Reconciliation] Existing open items: ${existingOpenItems.length}`);

  // If no existing items and no required actions, skip reconciliation
  if (existingOpenItems.length === 0 && (!newInteraction.analysis.required_actions || newInteraction.analysis.required_actions.length === 0)) {
    console.log('[Reconciliation] No items to reconcile and no new actions');
    return {
      reasoning: 'No existing items and no new actions identified',
      existing_items: [],
      new_items: [],
      summary: 'No changes needed',
    };
  }

  const prompt = buildReconciliationPrompt(newInteraction, existingOpenItems, relationshipContext);

  const schema = `{
  "reasoning": "string",
  "existing_items": [
    {
      "id": "string",
      "decision": "keep|complete|update|combine",
      "reason": "string",
      "updates": {"tier": "number", "why_now": "string"},
      "combine_into": "string"
    }
  ],
  "new_items": [
    {
      "title": "string",
      "description": "string",
      "tier": "number",
      "tier_trigger": "string",
      "why_now": "string",
      "owner": "string",
      "urgency": "string"
    }
  ],
  "summary": "string"
}`;

  try {
    const result = await callAIJson<ReconciliationResult>({
      prompt,
      schema,
      maxTokens: 2500,
    });

    console.log(`[Reconciliation] Result: ${result.data.summary}`);
    return result.data;
  } catch (error) {
    console.error('[Reconciliation] Error:', error);
    // Return safe default - keep all existing items
    return {
      reasoning: `Error during reconciliation: ${error}`,
      existing_items: existingOpenItems.map(item => ({
        id: item.id,
        decision: 'keep' as const,
        reason: 'Kept due to reconciliation error',
      })),
      new_items: [],
      summary: 'Error occurred - all items kept',
    };
  }
}

// ============================================
// HELPER: GET OPEN ITEMS FOR CONTACT/COMPANY
// ============================================

/**
 * Get all open command center items for a contact or company
 */
export async function getOpenItemsForContact(
  userId: string,
  contactId: string | null,
  companyId: string | null
): Promise<CommandCenterItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('command_center_items')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .order('tier', { ascending: true })
    .order('momentum_score', { ascending: false });

  // Filter by contact or company
  if (contactId) {
    query = query.eq('contact_id', contactId);
  } else if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    // No contact or company - return empty
    return [];
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Reconciliation] Error fetching items:', error);
    return [];
  }

  return data || [];
}

// ============================================
// APPLY RECONCILIATION
// ============================================

/**
 * Apply the reconciliation decisions to the database
 *
 * When sourceInfo is provided and there are multiple new_items:
 * - Creates a SINGLE workflow card with multiple checklist steps
 * - Uses source_hash for duplicate detection
 * - Prevents creating duplicate items from the same source
 */
export async function applyReconciliation(
  userId: string,
  contactId: string | null,
  companyId: string | null,
  result: ReconciliationResult,
  dealId?: string | null,
  sourceInfo?: SourceInfo
): Promise<{
  completed: number;
  updated: number;
  combined: number;
  created: number;
}> {
  const supabase = createAdminClient();
  const stats = { completed: 0, updated: 0, combined: 0, created: 0 };

  console.log(`[Reconciliation] Applying: ${result.summary}`);

  // Generate source hash if source info is provided
  const sourceHash = sourceInfo
    ? generateSourceHash(sourceInfo, contactId, companyId)
    : null;

  // Check for existing items with same source hash (prevent duplicates)
  if (sourceHash) {
    const { data: existingWithHash } = await supabase
      .from('command_center_items')
      .select('id, title')
      .eq('source_hash', sourceHash)
      .in('status', ['pending', 'in_progress'])
      .limit(1);

    if (existingWithHash && existingWithHash.length > 0) {
      console.log(`[Reconciliation] Item already exists for source hash: ${existingWithHash[0].title}`);
      // Don't create duplicates - return early with no new creations
      // Still process existing item decisions
    }
  }

  // 1. Process existing item decisions
  for (const decision of result.existing_items) {
    try {
      switch (decision.decision) {
        case 'complete':
          await supabase
            .from('command_center_items')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_reason: decision.reason,
            })
            .eq('id', decision.id);
          stats.completed++;
          console.log(`[Reconciliation] Completed: ${decision.id} - ${decision.reason}`);
          break;

        case 'update':
          if (decision.updates) {
            await supabase
              .from('command_center_items')
              .update({
                tier: decision.updates.tier,
                why_now: decision.updates.why_now,
                updated_at: new Date().toISOString(),
              })
              .eq('id', decision.id);
            stats.updated++;
            console.log(`[Reconciliation] Updated: ${decision.id} - ${decision.reason}`);
          }
          break;

        case 'combine':
          if (decision.combine_into) {
            // Mark this item as completed (absorbed into another)
            await supabase
              .from('command_center_items')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                completed_reason: `Combined into ${decision.combine_into}: ${decision.reason}`,
              })
              .eq('id', decision.id);
            stats.combined++;
            console.log(`[Reconciliation] Combined: ${decision.id} into ${decision.combine_into}`);
          }
          break;

        case 'keep':
          // No action needed
          break;
      }
    } catch (error) {
      console.error(`[Reconciliation] Error processing decision for ${decision.id}:`, error);
    }
  }

  // Check if source hash already exists (skip creation if duplicate)
  if (sourceHash) {
    const { data: existingWithHash } = await supabase
      .from('command_center_items')
      .select('id')
      .eq('source_hash', sourceHash)
      .in('status', ['pending', 'in_progress'])
      .limit(1);

    if (existingWithHash && existingWithHash.length > 0) {
      console.log(`[Reconciliation] Skipping creation - item already exists for this source`);
      return stats;
    }
  }

  // 2. Create new items
  // If multiple items AND source info provided, create a workflow card
  const shouldCreateWorkflowCard =
    sourceInfo &&
    result.new_items.length > 1;

  if (shouldCreateWorkflowCard) {
    // Create a single workflow card with multiple steps
    const workflowCard = createWorkflowCard(result.new_items, sourceInfo!);

    try {
      const { error } = await supabase.from('command_center_items').insert({
        user_id: userId,
        contact_id: contactId,
        company_id: companyId,
        deal_id: dealId || null,
        title: workflowCard.title,
        description: workflowCard.description,
        tier: workflowCard.tier as PriorityTier,
        tier_trigger: workflowCard.tier_trigger as TierTrigger,
        why_now: workflowCard.why_now,
        action_type: 'workflow',
        status: 'pending',
        source: 'ai_recommendation',
        source_hash: sourceHash,
        email_id: sourceInfo?.email_id || null,
        workflow_steps: workflowCard.workflow_steps,
        momentum_score: calculateMomentumFromTier(workflowCard.tier as PriorityTier),
        estimated_minutes: workflowCard.workflow_steps.reduce(
          (sum, step) => sum + estimateMinutesFromAction(step.title),
          0
        ),
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`[Reconciliation] Error creating workflow card:`, error);
      } else {
        stats.created = 1;
        console.log(`[Reconciliation] Created workflow card: ${workflowCard.title} with ${workflowCard.workflow_steps.length} steps`);
      }
    } catch (error) {
      console.error(`[Reconciliation] Error creating workflow card:`, error);
    }
  } else {
    // Create individual items (single action or no source info)
    for (const newItem of result.new_items) {
      try {
        const { error } = await supabase.from('command_center_items').insert({
          user_id: userId,
          contact_id: contactId,
          company_id: companyId,
          deal_id: dealId || null,
          title: newItem.title,
          description: newItem.description,
          tier: newItem.tier as PriorityTier,
          tier_trigger: newItem.tier_trigger as TierTrigger,
          why_now: newItem.why_now,
          action_type: newItem.action_type || 'task_simple',
          status: 'pending',
          source: 'ai_recommendation',
          source_hash: sourceHash,
          email_id: sourceInfo?.email_id || null,
          momentum_score: calculateMomentumFromTier(newItem.tier as PriorityTier),
          estimated_minutes: estimateMinutesFromAction(newItem.title),
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error(`[Reconciliation] Error creating item:`, error);
        } else {
          stats.created++;
          console.log(`[Reconciliation] Created: ${newItem.title} (Tier ${newItem.tier})`);
        }
      } catch (error) {
        console.error(`[Reconciliation] Error creating item:`, error);
      }
    }
  }

  console.log(`[Reconciliation] Applied: ${stats.completed} completed, ${stats.updated} updated, ${stats.combined} combined, ${stats.created} created`);

  return stats;
}

/**
 * Create a workflow card from multiple action items
 * Consolidates multiple related actions into a single card with checklist steps
 */
function createWorkflowCard(
  items: NewCommandCenterItem[],
  sourceInfo: SourceInfo
): {
  title: string;
  description: string;
  tier: number;
  tier_trigger: string;
  why_now: string;
  workflow_steps: WorkflowStep[];
} {
  // Find the highest urgency/lowest tier (Tier 1 is most urgent)
  const highestTier = Math.min(...items.map(i => i.tier));
  const primaryItem = items.find(i => i.tier === highestTier) || items[0];

  // Generate workflow title from communication type
  const workflowTitles: Record<string, string> = {
    'free_trial_form': 'Process Trial Form Submission',
    'demo_request': 'Handle Demo Request',
    'pricing_request': 'Respond to Pricing Inquiry',
    'proposal_follow_up': 'Follow Up on Proposal',
    'meeting_follow_up': 'Complete Meeting Follow-ups',
    'contract_negotiation': 'Advance Contract Discussion',
    'question_inquiry': 'Address Customer Questions',
  };

  const title = workflowTitles[sourceInfo.communication_type || '']
    || `Process ${sourceInfo.communication_type?.replace(/_/g, ' ') || 'Response'}`;

  // Create workflow steps from items
  const workflow_steps: WorkflowStep[] = items.map((item, index) => ({
    id: `step-${index + 1}-${Date.now()}`,
    title: item.title,
    owner: item.owner || 'sales_rep',
    urgency: item.urgency || 'medium',
    completed: false,
    completed_at: null,
  }));

  // Combine descriptions
  const description = items
    .map(i => i.description)
    .filter(Boolean)
    .join('\n\n') || `Complete all ${items.length} steps to process this ${sourceInfo.communication_type?.replace(/_/g, ' ') || 'item'}.`;

  // Use primary item's why_now
  const why_now = primaryItem.why_now;

  return {
    title,
    description,
    tier: highestTier,
    tier_trigger: primaryItem.tier_trigger,
    why_now,
    workflow_steps,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Calculate a momentum score based on tier
 */
function calculateMomentumFromTier(tier: PriorityTier): number {
  const scores: Record<PriorityTier, number> = {
    1: 95,
    2: 80,
    3: 70,
    4: 60,
    5: 40,
  };
  return scores[tier] || 50;
}

/**
 * Estimate minutes based on action type
 */
function estimateMinutesFromAction(title: string): number {
  const lower = title.toLowerCase();
  if (lower.includes('call') || lower.includes('meeting')) return 30;
  if (lower.includes('email') || lower.includes('respond')) return 10;
  if (lower.includes('review') || lower.includes('schedule')) return 15;
  if (lower.includes('forward') || lower.includes('send')) return 5;
  return 15;
}
