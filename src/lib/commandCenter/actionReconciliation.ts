/**
 * Action Reconciliation Service
 *
 * Syncs command center actions with relationship intelligence data:
 * - Commitments → Actions: Creates actions from commitments with due dates
 * - Actions → Commitments: Updates commitment status when actions complete
 * - Signals → Actions: Creates proactive actions from buying signals
 * - Concerns → Actions: Creates actions to address high-priority concerns
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment, BuyingSignal, Concern } from '@/lib/intelligence/relationshipStore';

interface ReconciliationResult {
  actionsCreated: number;
  actionsUpdated: number;
  commitmentsUpdated: number;
  errors: string[];
}

// Create service client for background jobs
function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Reconcile actions for a specific company
 */
export async function reconcileCompanyActions(
  companyId: string,
  userId: string,
  useServerClient = false
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    actionsCreated: 0,
    actionsUpdated: 0,
    commitmentsUpdated: 0,
    errors: [],
  };

  try {
    const supabase = useServerClient ? await createServerClient() : createServiceClient();

    // Get relationship intelligence
    const { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, context, company_id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (riError) {
      result.errors.push(`Failed to fetch relationship intelligence: ${riError.message}`);
      return result;
    }

    if (!ri || !ri.context) {
      return result; // No data to reconcile
    }

    // Get existing command center items for this company
    const { data: existingItems } = await supabase
      .from('command_center_items')
      .select('id, source_id, source_type, status')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    const existingItemMap = new Map(
      (existingItems || []).map((item) => [`${item.source_type}:${item.source_id}`, item])
    );

    // 1. Reconcile commitments
    const ourCommitments = (ri.context.our_commitments || []) as Commitment[];
    const theirCommitments = (ri.context.their_commitments || []) as Commitment[];

    for (const commitment of [...ourCommitments, ...theirCommitments]) {
      const isOurs = ourCommitments.includes(commitment);
      const sourceKey = `commitment:${commitment.source_id}`;

      // Skip completed commitments
      if (commitment.status === 'completed') {
        // If there's an existing action, mark it complete
        const existingItem = existingItemMap.get(sourceKey);
        if (existingItem && existingItem.status !== 'completed') {
          await supabase
            .from('command_center_items')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', existingItem.id);
          result.actionsUpdated++;
        }
        continue;
      }

      // Only create actions for commitments with due dates
      const dueDate = commitment.due_by || commitment.expected_by;
      if (!dueDate) continue;

      // Check if action already exists
      if (!existingItemMap.has(sourceKey)) {
        // Create new action for this commitment
        const tier = isOurs ? 3 : 4; // Tier 3: KEEP YOUR WORD for our commitments
        const slaMinutes = calculateSlaMinutes(dueDate);

        const { error: insertError } = await supabase
          .from('command_center_items')
          .insert({
            user_id: userId,
            company_id: companyId,
            title: `${isOurs ? 'Fulfill' : 'Follow up on'}: ${commitment.commitment}`,
            description: commitment.commitment,
            action_type: isOurs ? 'fulfill_commitment' : 'follow_up',
            tier,
            tier_trigger: 'commitment',
            source_type: 'commitment',
            source_id: commitment.source_id,
            sla_minutes: slaMinutes,
            sla_status: slaMinutes < 0 ? 'breached' : slaMinutes < 60 ? 'at_risk' : 'on_track',
            why_now: generateCommitmentWhyNow(commitment, isOurs),
            promise_date: dueDate,
            commitment_text: commitment.commitment,
            status: 'active',
          });

        if (insertError) {
          result.errors.push(`Failed to create action for commitment: ${insertError.message}`);
        } else {
          result.actionsCreated++;
        }
      }
    }

    // 2. Reconcile high-priority concerns
    const concerns = (ri.context.concerns || []) as Concern[];
    const unresolvedHighConcerns = concerns.filter(
      (c) => !c.resolved && c.severity === 'high'
    );

    for (const concern of unresolvedHighConcerns) {
      const sourceKey = `concern:${concern.source_id}`;

      if (!existingItemMap.has(sourceKey)) {
        const { error: insertError } = await supabase
          .from('command_center_items')
          .insert({
            user_id: userId,
            company_id: companyId,
            title: `Address concern: ${concern.concern.slice(0, 50)}...`,
            description: concern.concern,
            action_type: 'address_concern',
            tier: 2, // Tier 2: DON'T LOSE THIS
            tier_trigger: 'high_concern',
            source_type: 'concern',
            source_id: concern.source_id,
            why_now: `High severity concern identified on ${formatDate(concern.date)}`,
            status: 'active',
          });

        if (insertError) {
          result.errors.push(`Failed to create action for concern: ${insertError.message}`);
        } else {
          result.actionsCreated++;
        }
      }
    }

    // 3. Reconcile strong buying signals (create proactive actions)
    const buyingSignals = (ri.context.buying_signals || []) as BuyingSignal[];
    const strongSignals = buyingSignals.filter((s) => s.strength === 'strong');

    for (const signal of strongSignals.slice(0, 3)) { // Limit to 3 to avoid noise
      const sourceKey = `signal:${signal.source_id}`;

      if (!existingItemMap.has(sourceKey)) {
        const { error: insertError } = await supabase
          .from('command_center_items')
          .insert({
            user_id: userId,
            company_id: companyId,
            title: `Capitalize on: ${signal.signal.slice(0, 50)}...`,
            description: signal.signal,
            action_type: 'capitalize_signal',
            tier: 4, // Tier 4: MOVE BIG DEALS
            tier_trigger: 'strong_signal',
            source_type: 'buying_signal',
            source_id: signal.source_id,
            why_now: signal.quote ? `"${signal.quote.slice(0, 100)}..."` : null,
            status: 'active',
          });

        if (insertError) {
          result.errors.push(`Failed to create action for signal: ${insertError.message}`);
        } else {
          result.actionsCreated++;
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

/**
 * Sync action completion back to relationship intelligence
 */
export async function syncActionCompletion(
  actionId: string,
  companyId: string
): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    // Get the action details
    const { data: action, error: actionError } = await supabase
      .from('command_center_items')
      .select('source_type, source_id, status')
      .eq('id', actionId)
      .single();

    if (actionError || !action) {
      console.error('Failed to fetch action:', actionError);
      return false;
    }

    if (action.status !== 'completed') {
      return true; // Nothing to sync
    }

    if (action.source_type !== 'commitment') {
      return true; // Only sync commitments for now
    }

    // Get relationship intelligence
    const { data: ri, error: riError } = await supabase
      .from('relationship_intelligence')
      .select('id, context')
      .eq('company_id', companyId)
      .single();

    if (riError || !ri) {
      console.error('Failed to fetch relationship intelligence:', riError);
      return false;
    }

    const context = ri.context || {};
    let updated = false;

    // Update our commitments
    if (context.our_commitments) {
      const commitmentIndex = context.our_commitments.findIndex(
        (c: Commitment) => c.source_id === action.source_id
      );
      if (commitmentIndex !== -1) {
        context.our_commitments[commitmentIndex].status = 'completed';
        updated = true;
      }
    }

    // Update their commitments
    if (context.their_commitments && !updated) {
      const commitmentIndex = context.their_commitments.findIndex(
        (c: Commitment) => c.source_id === action.source_id
      );
      if (commitmentIndex !== -1) {
        context.their_commitments[commitmentIndex].status = 'completed';
        updated = true;
      }
    }

    if (updated) {
      const { error: updateError } = await supabase
        .from('relationship_intelligence')
        .update({
          context,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ri.id);

      if (updateError) {
        console.error('Failed to update relationship intelligence:', updateError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Unexpected error syncing action completion:', err);
    return false;
  }
}

/**
 * Run reconciliation for all companies with recent updates
 */
export async function runBatchReconciliation(
  userId: string,
  since?: Date
): Promise<ReconciliationResult> {
  const aggregateResult: ReconciliationResult = {
    actionsCreated: 0,
    actionsUpdated: 0,
    commitmentsUpdated: 0,
    errors: [],
  };

  try {
    const supabase = createServiceClient();

    // Get companies with recent relationship intelligence updates
    let query = supabase
      .from('relationship_intelligence')
      .select('company_id')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (since) {
      query = query.gte('updated_at', since.toISOString());
    }

    const { data: companies, error } = await query;

    if (error) {
      aggregateResult.errors.push(`Failed to fetch companies: ${error.message}`);
      return aggregateResult;
    }

    for (const { company_id } of companies || []) {
      const result = await reconcileCompanyActions(company_id, userId, false);
      aggregateResult.actionsCreated += result.actionsCreated;
      aggregateResult.actionsUpdated += result.actionsUpdated;
      aggregateResult.commitmentsUpdated += result.commitmentsUpdated;
      aggregateResult.errors.push(...result.errors);
    }

    return aggregateResult;
  } catch (err) {
    aggregateResult.errors.push(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return aggregateResult;
  }
}

// Helper functions
function calculateSlaMinutes(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((due.getTime() - now.getTime()) / (1000 * 60));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateCommitmentWhyNow(commitment: Commitment, isOurs: boolean): string {
  const dueDate = commitment.due_by || commitment.expected_by;
  if (!dueDate) return '';

  const due = new Date(dueDate);
  const now = new Date();
  const daysUntil = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return `${isOurs ? 'You said' : 'They said'} "${commitment.commitment.slice(0, 40)}..." — ${Math.abs(daysUntil)} days overdue`;
  } else if (daysUntil === 0) {
    return `${isOurs ? 'You said' : 'They said'} "${commitment.commitment.slice(0, 40)}..." — due today`;
  } else if (daysUntil === 1) {
    return `${isOurs ? 'You said' : 'They said'} "${commitment.commitment.slice(0, 40)}..." — due tomorrow`;
  } else if (daysUntil <= 7) {
    return `${isOurs ? 'You said' : 'They said'} "${commitment.commitment.slice(0, 40)}..." — due in ${daysUntil} days`;
  }

  return `${isOurs ? 'You promised' : 'They promised'}: "${commitment.commitment.slice(0, 50)}..."`;
}
