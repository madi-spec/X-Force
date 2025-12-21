/**
 * Relationship Intelligence Store
 *
 * Functions for managing cumulative relationship intelligence records.
 * Each contact+company pair has one relationship record that grows over time.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface KeyFact {
  fact: string;
  source: 'email' | 'transcript' | 'note' | 'research';
  source_id: string;
  date: string;
}

export interface Stakeholder {
  name: string;
  title: string;
  role: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'user';
  sentiment: string;
  notes: string;
}

export interface Preferences {
  preferred_channel?: 'email' | 'phone' | 'text';
  best_time_to_reach?: string;
  communication_style?: string;
  response_pattern?: string;
}

export interface RelationshipContext {
  company_profile?: {
    name?: string;
    industry?: string;
    size?: string;
    location?: string;
    description?: string;
    recent_news?: string[];
    tech_stack?: string[];
    competitors?: string[];
    key_people?: Array<{ name: string; title: string }>;
  };
  key_facts?: KeyFact[];
  stakeholders?: Stakeholder[];
  preferences?: Preferences;
}

export interface Interaction {
  id: string;
  type: 'email_inbound' | 'email_outbound' | 'transcript' | 'note' | 'meeting_scheduled';
  date: string;
  summary: string;
  analysis_id?: string;
  key_points?: string[];
  commitments_made?: string[];
  commitments_received?: string[];
  buying_signals?: string[];
  concerns?: string[];
  sentiment?: string;
}

export interface Commitment {
  commitment: string;
  made_on: string;
  due_by?: string;
  expected_by?: string;
  source_type: string;
  source_id: string;
  status: 'pending' | 'overdue' | 'completed';
}

export interface BuyingSignal {
  signal: string;
  quote?: string;
  strength: 'strong' | 'moderate' | 'weak';
  date: string;
  source_id: string;
}

export interface Concern {
  concern: string;
  severity: 'high' | 'medium' | 'low';
  resolved: boolean;
  resolution?: string;
  date: string;
  source_id: string;
}

export interface Objection {
  objection: string;
  response_given?: string;
  outcome: 'overcome' | 'pending' | 'blocker';
  date: string;
  source_id: string;
}

export interface RelationshipSignals {
  buying_signals: BuyingSignal[];
  concerns: Concern[];
  objections: Objection[];
}

export interface RelationshipMetrics {
  total_interactions: number;
  days_in_relationship: number;
  average_response_time_hours?: number;
  last_contact_date?: string;
  overall_sentiment_trend?: 'improving' | 'stable' | 'declining';
  engagement_score?: number;
}

export interface RelationshipIntelligence {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  context: RelationshipContext;
  interactions: Interaction[];
  open_commitments: {
    ours: Commitment[];
    theirs: Commitment[];
  };
  signals: RelationshipSignals;
  metrics: RelationshipMetrics;
  relationship_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipNote {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  note: string;
  context_type: 'strategy' | 'insight' | 'warning' | 'general';
  added_by: string;
  added_at: string;
  linked_item_id?: string;
  linked_source_type?: string;
  linked_source_id?: string;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get or create a relationship intelligence record
 */
export async function getOrCreateRelationshipIntelligence(
  contactId: string | null,
  companyId: string | null
): Promise<RelationshipIntelligence> {
  if (!contactId && !companyId) {
    throw new Error('At least one of contactId or companyId must be provided');
  }

  const supabase = createAdminClient();

  // Try to find existing record
  let query = supabase
    .from('relationship_intelligence')
    .select('*');

  if (contactId) {
    query = query.eq('contact_id', contactId);
  } else {
    query = query.is('contact_id', null);
  }

  if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    query = query.is('company_id', null);
  }

  const { data: existing, error: fetchError } = await query.single();

  if (existing && !fetchError) {
    return existing as RelationshipIntelligence;
  }

  // Create new record
  const newRecord = {
    contact_id: contactId,
    company_id: companyId,
    context: {},
    interactions: [],
    open_commitments: { ours: [], theirs: [] },
    signals: { buying_signals: [], concerns: [], objections: [] },
    metrics: {
      total_interactions: 0,
      days_in_relationship: 0,
    },
  };

  const { data: created, error: insertError } = await supabase
    .from('relationship_intelligence')
    .insert(newRecord)
    .select()
    .single();

  if (insertError) {
    // Handle race condition - another process may have created it
    if (insertError.code === '23505') {
      // Unique constraint violation - try to fetch again
      const { data: retryFetch } = await query.single();
      if (retryFetch) {
        return retryFetch as RelationshipIntelligence;
      }
    }
    throw new Error(`Failed to create relationship intelligence: ${insertError.message}`);
  }

  return created as RelationshipIntelligence;
}

/**
 * Update a relationship intelligence record
 */
export async function updateRelationshipIntelligence(
  id: string,
  updates: Partial<Pick<RelationshipIntelligence,
    'context' | 'interactions' | 'open_commitments' | 'signals' | 'metrics' | 'relationship_summary'
  >>
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('relationship_intelligence')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update relationship intelligence: ${error.message}`);
  }

  return data as RelationshipIntelligence;
}

/**
 * Add an interaction to the relationship timeline
 */
export async function addInteraction(
  relationshipId: string,
  interaction: Interaction
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  // Get current record
  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('interactions, metrics')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const interactions = [...(current.interactions || []), interaction];
  const metrics = {
    ...current.metrics,
    total_interactions: interactions.length,
    last_contact_date: interaction.date,
  };

  return updateRelationshipIntelligence(relationshipId, { interactions, metrics });
}

/**
 * Add a commitment to the relationship
 */
export async function addCommitment(
  relationshipId: string,
  commitment: Commitment,
  type: 'ours' | 'theirs'
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('open_commitments')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const open_commitments = {
    ours: [...(current.open_commitments?.ours || [])],
    theirs: [...(current.open_commitments?.theirs || [])],
  };

  open_commitments[type].push(commitment);

  return updateRelationshipIntelligence(relationshipId, { open_commitments });
}

/**
 * Add a buying signal to the relationship
 */
export async function addBuyingSignal(
  relationshipId: string,
  signal: BuyingSignal
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('signals')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const signals = {
    buying_signals: [...(current.signals?.buying_signals || []), signal],
    concerns: current.signals?.concerns || [],
    objections: current.signals?.objections || [],
  };

  return updateRelationshipIntelligence(relationshipId, { signals });
}

/**
 * Add a concern to the relationship
 */
export async function addConcern(
  relationshipId: string,
  concern: Concern
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('signals')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const signals = {
    buying_signals: current.signals?.buying_signals || [],
    concerns: [...(current.signals?.concerns || []), concern],
    objections: current.signals?.objections || [],
  };

  return updateRelationshipIntelligence(relationshipId, { signals });
}

/**
 * Add a key fact to the relationship context
 */
export async function addKeyFact(
  relationshipId: string,
  fact: KeyFact
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('context')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const context = { ...current.context };
  const existingFacts = context.key_facts || [];

  // Avoid duplicate facts
  if (!existingFacts.some(f => f.fact === fact.fact)) {
    context.key_facts = [...existingFacts, fact];
    return updateRelationshipIntelligence(relationshipId, { context });
  }

  return current as unknown as RelationshipIntelligence;
}

/**
 * Update relationship summary
 */
export async function updateRelationshipSummary(
  relationshipId: string,
  summary: string
): Promise<RelationshipIntelligence> {
  return updateRelationshipIntelligence(relationshipId, { relationship_summary: summary });
}

// ============================================
// NOTES FUNCTIONS
// ============================================

/**
 * Add a manual note to a relationship
 */
export async function addRelationshipNote(params: {
  contactId?: string;
  companyId?: string;
  note: string;
  contextType?: 'strategy' | 'insight' | 'warning' | 'general';
  addedBy: string;
  linkedItemId?: string;
  linkedSourceType?: string;
  linkedSourceId?: string;
}): Promise<RelationshipNote> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: params.contactId || null,
      company_id: params.companyId || null,
      note: params.note,
      context_type: params.contextType || 'general',
      added_by: params.addedBy,
      linked_item_id: params.linkedItemId || null,
      linked_source_type: params.linkedSourceType || null,
      linked_source_id: params.linkedSourceId || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add relationship note: ${error.message}`);
  }

  return data as RelationshipNote;
}

/**
 * Get all notes for a contact or company
 */
export async function getRelationshipNotes(params: {
  contactId?: string;
  companyId?: string;
  limit?: number;
}): Promise<RelationshipNote[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('relationship_notes')
    .select('*')
    .order('added_at', { ascending: false });

  if (params.contactId) {
    query = query.eq('contact_id', params.contactId);
  }

  if (params.companyId) {
    query = query.eq('company_id', params.companyId);
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get relationship notes: ${error.message}`);
  }

  return (data || []) as RelationshipNote[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get full relationship context for AI analysis prompts
 */
export async function getRelationshipContextForPrompt(
  contactId: string | null,
  companyId: string | null
): Promise<{
  relationship: RelationshipIntelligence | null;
  notes: RelationshipNote[];
  recentInteractions: Interaction[];
}> {
  if (!contactId && !companyId) {
    return { relationship: null, notes: [], recentInteractions: [] };
  }

  const supabase = createAdminClient();

  // Get relationship intelligence
  let query = supabase
    .from('relationship_intelligence')
    .select('*');

  if (contactId) {
    query = query.eq('contact_id', contactId);
  }
  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data: relationship } = await query.single();

  // Get notes
  const notes = await getRelationshipNotes({
    contactId: contactId || undefined,
    companyId: companyId || undefined,
    limit: 10,
  });

  // Get recent interactions from relationship
  const interactions = (relationship?.interactions || []) as Interaction[];
  const recentInteractions = interactions.slice(-10);

  return {
    relationship: relationship as RelationshipIntelligence | null,
    notes,
    recentInteractions,
  };
}

/**
 * Check if we should regenerate the relationship summary
 */
export function shouldRegenerateSummary(relationship: RelationshipIntelligence): boolean {
  // Regenerate if:
  // 1. No summary exists
  if (!relationship.relationship_summary) return true;

  // 2. More than 5 new interactions since last update
  const interactionsSinceUpdate = relationship.interactions.filter(
    i => new Date(i.date) > new Date(relationship.updated_at)
  );
  if (interactionsSinceUpdate.length >= 5) return true;

  // 3. Last update was more than 7 days ago
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(relationship.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceUpdate >= 7) return true;

  return false;
}

/**
 * Mark a commitment as completed
 */
export async function markCommitmentCompleted(
  relationshipId: string,
  commitmentText: string,
  type: 'ours' | 'theirs'
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('open_commitments')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const open_commitments = {
    ours: [...(current.open_commitments?.ours || [])],
    theirs: [...(current.open_commitments?.theirs || [])],
  };

  // Find and update the commitment
  const commitmentIndex = open_commitments[type].findIndex(
    c => c.commitment === commitmentText && c.status === 'pending'
  );

  if (commitmentIndex !== -1) {
    open_commitments[type][commitmentIndex].status = 'completed';
  }

  return updateRelationshipIntelligence(relationshipId, { open_commitments });
}

/**
 * Mark a concern as resolved
 */
export async function markConcernResolved(
  relationshipId: string,
  concernText: string,
  resolution: string
): Promise<RelationshipIntelligence> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from('relationship_intelligence')
    .select('signals')
    .eq('id', relationshipId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Relationship record not found: ${relationshipId}`);
  }

  const signals = { ...current.signals };
  const concernIndex = (signals.concerns || []).findIndex(
    c => c.concern === concernText && !c.resolved
  );

  if (concernIndex !== -1) {
    signals.concerns[concernIndex].resolved = true;
    signals.concerns[concernIndex].resolution = resolution;
  }

  return updateRelationshipIntelligence(relationshipId, { signals });
}
