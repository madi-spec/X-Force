/**
 * Champion Involvement Logic
 *
 * Manages when and how to involve internal champions
 * to help with scheduling difficult meetings.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Types
export interface Champion {
  id: string;
  contact_id: string;
  name: string;
  email: string;
  title: string;
  relationship_strength: number; // 0-100
  last_interaction: Date | null;
  successful_assists: number;
  total_asks: number;
}

export interface ChampionInvolvement {
  id: string;
  scheduling_request_id: string;
  champion_contact_id: string;
  involvement_type: ChampionInvolvementType;
  attempt_number: number;
  requested_at: Date;
  champion_responded: boolean | null;
  champion_helped: boolean | null;
  outcome_notes: string | null;
}

export type ChampionInvolvementType =
  | 'cc_on_email'      // CC champion on scheduling email
  | 'intro_request'    // Ask champion for intro to decision maker
  | 'direct_outreach'  // Ask champion to reach out directly
  | 'internal_nudge';  // Ask champion to nudge internally

export interface ChampionStrategy {
  should_involve: boolean;
  involvement_type: ChampionInvolvementType | null;
  champion: Champion | null;
  reasoning: string;
  suggested_message: string | null;
}

/**
 * Determine if champion should be involved in scheduling
 */
export async function shouldInvolveChampion(
  schedulingRequestId: string,
  attemptNumber: number
): Promise<ChampionStrategy> {
  const supabase = createAdminClient();

  // Get scheduling request with deal context
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      id,
      company_id,
      deal_id,
      target_contact_id,
      status,
      meeting_type,
      deals (
        id,
        stage,
        value
      )
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (!request?.company_id) {
    return {
      should_involve: false,
      involvement_type: null,
      champion: null,
      reasoning: 'No company context available',
      suggested_message: null,
    };
  }

  // Check if we've already involved a champion
  const { data: previousInvolvements } = await supabase
    .from('champion_involvements')
    .select('*')
    .eq('scheduling_request_id', schedulingRequestId);

  const hasActiveInvolvement = previousInvolvements?.some(
    i => i.champion_responded === null
  );

  if (hasActiveInvolvement) {
    return {
      should_involve: false,
      involvement_type: null,
      champion: null,
      reasoning: 'Already waiting for champion response',
      suggested_message: null,
    };
  }

  // Find potential champions at this company
  const champion = await findBestChampion(request.company_id, request.target_contact_id);

  if (!champion) {
    return {
      should_involve: false,
      involvement_type: null,
      champion: null,
      reasoning: 'No suitable champion found at company',
      suggested_message: null,
    };
  }

  // Determine when to involve champion based on attempt number and context
  // Transform the request to match expected type (deals comes as array from Supabase join)
  const dealsArray = request.deals as unknown as { id: string; stage: string; value: number }[] | null;
  const requestForStrategy = {
    meeting_type: request.meeting_type,
    deals: dealsArray?.[0] ?? null,
  };
  const strategy = determineInvolvementStrategy(
    attemptNumber,
    previousInvolvements || [],
    champion,
    requestForStrategy
  );

  return strategy;
}

/**
 * Find the best champion at a company
 */
async function findBestChampion(
  companyId: string,
  excludeContactId?: string
): Promise<Champion | null> {
  const supabase = createAdminClient();

  // Get contacts at company with engagement data
  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      id,
      first_name,
      last_name,
      email,
      title,
      relationship_strength,
      last_interaction_at
    `)
    .eq('company_id', companyId)
    .neq('id', excludeContactId || '00000000-0000-0000-0000-000000000000')
    .gt('relationship_strength', 50) // Only strong relationships
    .order('relationship_strength', { ascending: false });

  if (!contacts?.length) {
    return null;
  }

  // Get champion involvement history
  const contactIds = contacts.map(c => c.id);
  const { data: involvements } = await supabase
    .from('champion_involvements')
    .select('champion_contact_id, champion_helped')
    .in('champion_contact_id', contactIds);

  // Calculate success rate for each contact
  const championsWithStats = contacts.map(contact => {
    const contactInvolvements = involvements?.filter(
      i => i.champion_contact_id === contact.id
    ) || [];

    const successfulAssists = contactInvolvements.filter(i => i.champion_helped).length;
    const totalAsks = contactInvolvements.length;

    return {
      id: contact.id,
      contact_id: contact.id,
      name: `${contact.first_name} ${contact.last_name}`,
      email: contact.email,
      title: contact.title || 'Unknown',
      relationship_strength: contact.relationship_strength || 0,
      last_interaction: contact.last_interaction_at
        ? new Date(contact.last_interaction_at)
        : null,
      successful_assists: successfulAssists,
      total_asks: totalAsks,
    };
  });

  // Score champions
  const scored = championsWithStats.map(c => ({
    champion: c,
    score: scoreChampion(c),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.champion || null;
}

/**
 * Score a potential champion
 */
function scoreChampion(champion: Champion): number {
  let score = 0;

  // Relationship strength is key
  score += champion.relationship_strength * 0.4;

  // Recent interaction is good
  if (champion.last_interaction) {
    const daysSinceInteraction = Math.floor(
      (Date.now() - champion.last_interaction.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceInteraction < 7) score += 20;
    else if (daysSinceInteraction < 30) score += 10;
  }

  // Success rate matters
  if (champion.total_asks > 0) {
    const successRate = champion.successful_assists / champion.total_asks;
    score += successRate * 25;
  } else {
    // No history - neutral
    score += 10;
  }

  // Title influence
  const influentialTitles = ['owner', 'president', 'ceo', 'coo', 'director', 'manager'];
  if (influentialTitles.some(t => champion.title.toLowerCase().includes(t))) {
    score += 15;
  }

  return score;
}

/**
 * Determine the right involvement strategy
 */
function determineInvolvementStrategy(
  attemptNumber: number,
  previousInvolvements: ChampionInvolvement[],
  champion: Champion,
  request: { meeting_type: string; deals?: { stage: string; value: number } | null }
): ChampionStrategy {
  const hasTriedCC = previousInvolvements.some(i => i.involvement_type === 'cc_on_email');
  const hasTriedIntro = previousInvolvements.some(i => i.involvement_type === 'intro_request');
  const hasTriedDirect = previousInvolvements.some(i => i.involvement_type === 'direct_outreach');

  // High value deals get champion involvement earlier
  const isHighValue = request.deals?.value && request.deals.value > 50000;
  const involvementThreshold = isHighValue ? 3 : 4;

  // Don't involve too early
  if (attemptNumber < involvementThreshold) {
    return {
      should_involve: false,
      involvement_type: null,
      champion: null,
      reasoning: `Wait until attempt ${involvementThreshold} before involving champion`,
      suggested_message: null,
    };
  }

  // Escalation path: CC → Intro → Direct → Internal Nudge
  let involvementType: ChampionInvolvementType;
  let suggestedMessage: string;

  if (!hasTriedCC) {
    involvementType = 'cc_on_email';
    suggestedMessage = generateCCMessage(champion, request.meeting_type);
  } else if (!hasTriedIntro && attemptNumber >= involvementThreshold + 1) {
    involvementType = 'intro_request';
    suggestedMessage = generateIntroRequestMessage(champion);
  } else if (!hasTriedDirect && attemptNumber >= involvementThreshold + 2) {
    involvementType = 'direct_outreach';
    suggestedMessage = generateDirectOutreachMessage(champion, request.meeting_type);
  } else if (attemptNumber >= involvementThreshold + 3) {
    involvementType = 'internal_nudge';
    suggestedMessage = generateInternalNudgeMessage(champion);
  } else {
    return {
      should_involve: false,
      involvement_type: null,
      champion: null,
      reasoning: 'All champion involvement types exhausted',
      suggested_message: null,
    };
  }

  return {
    should_involve: true,
    involvement_type: involvementType,
    champion,
    reasoning: `Attempt ${attemptNumber}: Escalating to ${involvementType}`,
    suggested_message: suggestedMessage,
  };
}

/**
 * Generate CC message
 */
function generateCCMessage(champion: Champion, meetingType: string): string {
  const firstName = champion.name.split(' ')[0];
  return `Hi ${firstName},\n\nLooping you in on this ${meetingType} discussion. Thought you might want to be in the loop.\n\nBest`;
}

/**
 * Generate intro request message
 */
function generateIntroRequestMessage(champion: Champion): string {
  const firstName = champion.name.split(' ')[0];
  return `Hi ${firstName},\n\nI've been trying to connect with [target] about scheduling a meeting but haven't heard back. Would you be able to make an introduction or let them know I'm trying to connect?\n\nI know you're busy, so no worries if this isn't a good time.\n\nThanks!`;
}

/**
 * Generate direct outreach message
 */
function generateDirectOutreachMessage(champion: Champion, meetingType: string): string {
  const firstName = champion.name.split(' ')[0];
  return `Hi ${firstName},\n\nQuick favor - could you mention to [target] that we're trying to schedule a ${meetingType}? I think they may have missed my messages.\n\nReally appreciate any help you can provide!\n\nBest`;
}

/**
 * Generate internal nudge message
 */
function generateInternalNudgeMessage(champion: Champion): string {
  const firstName = champion.name.split(' ')[0];
  return `Hi ${firstName},\n\nI really hate to ask, but we've been having trouble connecting with [target] to schedule a meeting. Is there anything going on that I should be aware of? Or is there a better way to reach them?\n\nAny guidance would be hugely appreciated.\n\nThanks!`;
}

/**
 * Record champion involvement
 */
export async function recordChampionInvolvement(
  schedulingRequestId: string,
  championContactId: string,
  involvementType: ChampionInvolvementType,
  attemptNumber: number
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('champion_involvements')
    .insert({
      scheduling_request_id: schedulingRequestId,
      champion_contact_id: championContactId,
      involvement_type: involvementType,
      attempt_number: attemptNumber,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ChampionInvolvement] Error recording:', error);
    throw error;
  }

  return data.id;
}

/**
 * Update champion involvement outcome
 */
export async function updateChampionOutcome(
  involvementId: string,
  outcome: {
    champion_responded: boolean;
    champion_helped: boolean;
    outcome_notes?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('champion_involvements')
    .update({
      champion_responded: outcome.champion_responded,
      champion_helped: outcome.champion_helped,
      outcome_notes: outcome.outcome_notes,
    })
    .eq('id', involvementId);
}

/**
 * Get champion effectiveness report
 */
export async function getChampionEffectivenessReport(
  companyId?: string
): Promise<{
  totalInvolvements: number;
  responseRate: number;
  helpRate: number;
  byType: Record<ChampionInvolvementType, { total: number; helped: number }>;
  topChampions: Array<{
    name: string;
    involvements: number;
    success_rate: number;
  }>;
}> {
  const supabase = createAdminClient();

  let query = supabase
    .from('champion_involvements')
    .select(`
      *,
      contacts:champion_contact_id (
        id,
        first_name,
        last_name,
        company_id
      )
    `);

  // If company specified, filter
  // Note: This would require a join, simplified here

  const { data: involvements } = await query;

  if (!involvements?.length) {
    return {
      totalInvolvements: 0,
      responseRate: 0,
      helpRate: 0,
      byType: {
        cc_on_email: { total: 0, helped: 0 },
        intro_request: { total: 0, helped: 0 },
        direct_outreach: { total: 0, helped: 0 },
        internal_nudge: { total: 0, helped: 0 },
      },
      topChampions: [],
    };
  }

  // Calculate overall stats
  const responded = involvements.filter(i => i.champion_responded).length;
  const helped = involvements.filter(i => i.champion_helped).length;

  // Group by type
  const byType: Record<ChampionInvolvementType, { total: number; helped: number }> = {
    cc_on_email: { total: 0, helped: 0 },
    intro_request: { total: 0, helped: 0 },
    direct_outreach: { total: 0, helped: 0 },
    internal_nudge: { total: 0, helped: 0 },
  };

  for (const inv of involvements) {
    const type = inv.involvement_type as ChampionInvolvementType;
    if (byType[type]) {
      byType[type].total++;
      if (inv.champion_helped) byType[type].helped++;
    }
  }

  // Group by champion
  const championStats: Record<string, { name: string; total: number; helped: number }> = {};
  for (const inv of involvements) {
    const contact = inv.contacts as { first_name: string; last_name: string } | null;
    if (!contact) continue;

    const name = `${contact.first_name} ${contact.last_name}`;
    if (!championStats[inv.champion_contact_id]) {
      championStats[inv.champion_contact_id] = { name, total: 0, helped: 0 };
    }
    championStats[inv.champion_contact_id].total++;
    if (inv.champion_helped) championStats[inv.champion_contact_id].helped++;
  }

  const topChampions = Object.values(championStats)
    .map(c => ({
      name: c.name,
      involvements: c.total,
      success_rate: c.total > 0 ? c.helped / c.total : 0,
    }))
    .sort((a, b) => b.success_rate - a.success_rate)
    .slice(0, 5);

  return {
    totalInvolvements: involvements.length,
    responseRate: involvements.length > 0 ? responded / involvements.length : 0,
    helpRate: involvements.length > 0 ? helped / involvements.length : 0,
    byType,
    topChampions,
  };
}
