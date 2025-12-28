/**
 * Context-First Processing Pipeline
 *
 * The core principle: The company/deal is the SOURCE OF TRUTH.
 * Everything else derives from relationship context.
 *
 * Flow:
 * 1. FIRST: Identify company/contact using AI
 * 2. THEN: Load ALL context for that relationship
 * 3. THEN: Analyze WITH that context
 * 4. THEN: Update the relationship context (it grows)
 * 5. THEN: Determine actions needed (which may obsolete previous actions)
 * 6. Command Center = just a view of "what needs attention now"
 */

import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import {
  intelligentEntityMatch,
  CommunicationInput,
  EntityMatchResult,
} from './entityMatcher';

// Re-export CommunicationInput for consumers
export type { CommunicationInput };

// ============================================
// TYPES
// ============================================

export interface RelationshipContext {
  company: {
    id: string;
    name: string;
    domain: string | null;
    website: string | null;
    industry: string | null;
    segment: string | null;
    agent_count: number | null;
    city: string | null;
    state: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    company_id: string | null;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number | null;
    expected_close_date: string | null;
  } | null;
  allContacts: Array<{
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    role?: string;
  }>;
  relationshipIntelligence: {
    context: Record<string, unknown>;
    interactions: Array<{
      id: string;
      type: string;
      date: string;
      summary: string;
      key_points?: string[];
    }>;
    open_commitments: {
      ours: Array<{
        commitment: string;
        made_on: string;
        due_by?: string;
        status: string;
      }>;
      theirs: Array<{
        commitment: string;
        made_on: string;
        expected_by?: string;
        status: string;
      }>;
    };
    signals: {
      buying_signals: Array<{
        signal: string;
        strength: string;
        date: string;
      }>;
      concerns: Array<{
        concern: string;
        severity: string;
        resolved: boolean;
        date: string;
      }>;
      objections: Array<{
        objection: string;
        response_given?: string;
        outcome?: string;
        date: string;
      }>;
    };
    relationship_summary: string | null;
    key_facts: Array<{
      fact: string;
      source: string;
      date: string;
    }>;
  } | null;
  salespersonNotes: Array<{
    id: string;
    note: string;
    context_type: string;
    added_at: string;
  }>;
  recentCommunications: Array<{
    id: string;
    type: string;
    date: string;
    subject?: string;
    summary?: string;
    direction: 'inbound' | 'outbound';
  }>;
  formattedForAI: string;
}

export interface PlaybookAnalysis {
  // What we learned from this communication
  key_facts_learned: Array<{
    fact: string;
    confidence: number;
  }>;
  buying_signals: Array<{
    signal: string;
    strength: 'strong' | 'moderate' | 'weak';
    quote?: string;
  }>;
  concerns_raised: Array<{
    concern: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  commitment_updates: {
    new_ours: Array<{
      commitment: string;
      due_by?: string;
    }>;
    new_theirs: Array<{
      commitment: string;
      expected_by?: string;
    }>;
    completed: string[]; // Commitment texts that are now done
  };
  relationship_summary_update: string;

  // Deal implications
  should_create_deal: boolean;
  recommended_deal_stage?: string;
  estimated_deal_value?: number;
  deal_stage_change?: {
    new_stage: string;
    reason: string;
  };

  // Communication type detected
  communication_type: 'demo_request' | 'trial_request' | 'pricing_inquiry' |
    'follow_up' | 'objection' | 'negotiation' | 'general' | 'other';

  // What actions are needed
  suggested_actions: Array<{
    action_type: string;
    title: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    why_now: string;
    due_within_days?: number;
  }>;
}

export interface ActionDecision {
  existing: Array<{
    id: string;
    action: 'complete' | 'update' | 'keep';
    reason: string;
    updates?: Record<string, unknown>;
  }>;
  new: Array<{
    action_type: string;
    title: string;
    tier: number;
    why_now: string;
    workflow_steps?: Array<{
      step: string;
      type: string;
    }>;
  }>;
}

export interface ProcessingResult {
  company: EntityMatchResult['company'];
  contact: EntityMatchResult['contact'];
  deal: RelationshipContext['deal'];
  contextBefore: RelationshipContext;
  contextAfter: RelationshipContext;
  analysisWithContext: PlaybookAnalysis;
  actionsCreated: Array<{ id: string; title: string }>;
  actionsUpdated: Array<{ id: string; title: string }>;
  actionsCompleted: Array<{ id: string; title: string }>;
  matchConfidence: number;
  matchReasoning: string;
}

// ============================================
// STEP 2: BUILD FULL RELATIONSHIP CONTEXT
// ============================================

/**
 * Load ALL context for a relationship - everything we know
 */
export async function buildFullRelationshipContext(params: {
  companyId: string | null;
  contactId: string | null;
  dealId?: string | null;
  includeAllHistory?: boolean;
}): Promise<RelationshipContext> {
  const supabase = createAdminClient();
  const { companyId, contactId, dealId, includeAllHistory = false } = params;

  // Get company details
  let company: RelationshipContext['company'] = null;
  let allContacts: RelationshipContext['allContacts'] = [];
  if (companyId) {
    const { data: companyData } = await supabase
      .from('companies')
      .select('id, name, domain, website, industry, segment, agent_count, city, state')
      .eq('id', companyId)
      .single();
    company = companyData;

    // Get all contacts at this company
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('id, name, email, title')
      .eq('company_id', companyId)
      .order('name');
    allContacts = contactsData || [];
  }

  // Get specific contact details
  let contact: RelationshipContext['contact'] = null;
  if (contactId) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, name, email, phone, title, company_id')
      .eq('id', contactId)
      .single();
    contact = contactData;
  }

  // Get deal if exists
  let deal: RelationshipContext['deal'] = null;
  if (dealId) {
    const { data: dealData } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value, expected_close_date')
      .eq('id', dealId)
      .single();
    deal = dealData;
  } else if (companyId) {
    // Try to find an active deal for this company
    const { data: activeDeal } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value, expected_close_date')
      .eq('company_id', companyId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    deal = activeDeal;
  }

  // Get relationship intelligence
  let relationshipIntelligence: RelationshipContext['relationshipIntelligence'] = null;
  if (companyId || contactId) {
    let query = supabase
      .from('relationship_intelligence')
      .select('*');

    if (companyId && contactId) {
      query = query.eq('company_id', companyId).eq('contact_id', contactId);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    } else if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data: riData } = await query.limit(1).single();
    if (riData) {
      relationshipIntelligence = {
        context: riData.context || {},
        interactions: riData.interactions || [],
        open_commitments: riData.open_commitments || { ours: [], theirs: [] },
        signals: riData.signals || { buying_signals: [], concerns: [], objections: [] },
        relationship_summary: riData.relationship_summary,
        key_facts: (riData.context as any)?.key_facts || [],
      };
    }
  }

  // Get salesperson notes
  let salespersonNotes: RelationshipContext['salespersonNotes'] = [];
  if (companyId || contactId) {
    let notesQuery = supabase
      .from('relationship_notes')
      .select('id, note, context_type, added_at')
      .order('added_at', { ascending: false });

    if (companyId) {
      notesQuery = notesQuery.eq('company_id', companyId);
    } else if (contactId) {
      notesQuery = notesQuery.eq('contact_id', contactId);
    }

    const { data: notesData } = await notesQuery.limit(20);
    salespersonNotes = notesData || [];
  }

  // Get recent communications
  let recentCommunications: RelationshipContext['recentCommunications'] = [];
  if (companyId || contactId) {
    // Get email conversations linked to this company/contact
    const { data: emailData } = await supabase
      .from('email_conversations')
      .select('id, subject, last_activity_at, direction, snippet')
      .or(companyId ? `company_id.eq.${companyId}` : `contact_id.eq.${contactId}`)
      .order('last_activity_at', { ascending: false })
      .limit(includeAllHistory ? 50 : 10);

    if (emailData) {
      recentCommunications = emailData.map(e => ({
        id: e.id,
        type: 'email',
        date: e.last_activity_at,
        subject: e.subject,
        summary: e.snippet,
        direction: e.direction === 'inbound' ? 'inbound' : 'outbound',
      }));
    }
  }

  // Format everything for AI
  const formattedForAI = formatContextForAI({
    company,
    contact,
    deal,
    allContacts,
    relationshipIntelligence,
    salespersonNotes,
    recentCommunications,
  });

  return {
    company,
    contact,
    deal,
    allContacts,
    relationshipIntelligence,
    salespersonNotes,
    recentCommunications,
    formattedForAI,
  };
}

/**
 * Format context into a structured string for AI analysis
 */
function formatContextForAI(params: {
  company: RelationshipContext['company'];
  contact: RelationshipContext['contact'];
  deal: RelationshipContext['deal'];
  allContacts: RelationshipContext['allContacts'];
  relationshipIntelligence: RelationshipContext['relationshipIntelligence'];
  salespersonNotes: RelationshipContext['salespersonNotes'];
  recentCommunications: RelationshipContext['recentCommunications'];
}): string {
  const lines: string[] = [];

  // Company info
  if (params.company) {
    lines.push('## COMPANY');
    lines.push(`Name: ${params.company.name}`);
    if (params.company.industry) lines.push(`Industry: ${params.company.industry}`);
    if (params.company.segment) lines.push(`Segment: ${params.company.segment}`);
    if (params.company.agent_count) lines.push(`Team Size: ${params.company.agent_count} agents`);
    if (params.company.city || params.company.state) {
      lines.push(`Location: ${[params.company.city, params.company.state].filter(Boolean).join(', ')}`);
    }
    lines.push('');
  }

  // Main contact
  if (params.contact) {
    lines.push('## PRIMARY CONTACT');
    lines.push(`Name: ${params.contact.name}`);
    if (params.contact.email) lines.push(`Email: ${params.contact.email}`);
    if (params.contact.title) lines.push(`Title: ${params.contact.title}`);
    lines.push('');
  }

  // Other contacts at company
  if (params.allContacts.length > 1) {
    lines.push('## OTHER CONTACTS AT COMPANY');
    params.allContacts
      .filter(c => c.id !== params.contact?.id)
      .forEach(c => {
        lines.push(`- ${c.name}${c.title ? ` (${c.title})` : ''}${c.email ? ` <${c.email}>` : ''}`);
      });
    lines.push('');
  }

  // Active deal
  if (params.deal) {
    lines.push('## ACTIVE DEAL');
    lines.push(`Name: ${params.deal.name}`);
    lines.push(`Stage: ${params.deal.stage}`);
    if (params.deal.estimated_value) {
      lines.push(`Value: $${params.deal.estimated_value.toLocaleString()}`);
    }
    if (params.deal.expected_close_date) {
      lines.push(`Expected Close: ${params.deal.expected_close_date}`);
    }
    lines.push('');
  }

  // Relationship summary
  if (params.relationshipIntelligence?.relationship_summary) {
    lines.push('## RELATIONSHIP SUMMARY');
    lines.push(params.relationshipIntelligence.relationship_summary);
    lines.push('');
  }

  // Key facts
  const keyFacts = params.relationshipIntelligence?.key_facts || [];
  if (keyFacts.length > 0) {
    lines.push('## KEY FACTS KNOWN');
    keyFacts.forEach(f => {
      lines.push(`- ${f.fact} (from ${f.source}, ${f.date})`);
    });
    lines.push('');
  }

  // Open commitments
  const commitments = params.relationshipIntelligence?.open_commitments;
  if (commitments) {
    if (commitments.ours.length > 0 || commitments.theirs.length > 0) {
      lines.push('## OPEN COMMITMENTS');
      if (commitments.ours.length > 0) {
        lines.push('Our commitments to them:');
        commitments.ours.forEach(c => {
          lines.push(`- ${c.commitment}${c.due_by ? ` (due: ${c.due_by})` : ''} [${c.status}]`);
        });
      }
      if (commitments.theirs.length > 0) {
        lines.push('Their commitments to us:');
        commitments.theirs.forEach(c => {
          lines.push(`- ${c.commitment}${c.expected_by ? ` (expected: ${c.expected_by})` : ''} [${c.status}]`);
        });
      }
      lines.push('');
    }
  }

  // Signals
  const signals = params.relationshipIntelligence?.signals;
  if (signals) {
    if (signals.buying_signals.length > 0) {
      lines.push('## BUYING SIGNALS DETECTED');
      signals.buying_signals.forEach(s => {
        lines.push(`- [${s.strength.toUpperCase()}] ${s.signal}`);
      });
      lines.push('');
    }
    if (signals.concerns.length > 0) {
      lines.push('## CONCERNS RAISED');
      signals.concerns.forEach(c => {
        const status = c.resolved ? 'RESOLVED' : 'OPEN';
        lines.push(`- [${c.severity.toUpperCase()}/${status}] ${c.concern}`);
      });
      lines.push('');
    }
  }

  // Salesperson notes
  if (params.salespersonNotes.length > 0) {
    lines.push('## SALESPERSON NOTES');
    params.salespersonNotes.slice(0, 5).forEach(n => {
      lines.push(`- [${n.context_type}] ${n.note}`);
    });
    lines.push('');
  }

  // Recent communications
  if (params.recentCommunications.length > 0) {
    lines.push('## RECENT COMMUNICATION HISTORY');
    params.recentCommunications.slice(0, 10).forEach(c => {
      const date = new Date(c.date).toLocaleDateString();
      lines.push(`- ${date} | ${c.direction.toUpperCase()} ${c.type}: ${c.subject || c.summary || 'No subject'}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================
// STEP 3: ANALYZE WITH FULL CONTEXT
// ============================================

/**
 * Analyze communication with full relationship context
 */
export async function analyzeWithFullContext(params: {
  communication: CommunicationInput;
  context: RelationshipContext;
}): Promise<PlaybookAnalysis> {
  const client = new Anthropic();
  const { communication, context } = params;

  const prompt = `You are analyzing an incoming communication for a sales CRM.

## EXISTING RELATIONSHIP CONTEXT
${context.formattedForAI}

## THE NEW COMMUNICATION
Type: ${communication.type}
From: ${communication.from_email || 'Unknown'}${communication.from_name ? ` (${communication.from_name})` : ''}
Subject: ${communication.subject || 'N/A'}
Content:
${(communication.body || communication.transcript_text || '').substring(0, 3000)}

## YOUR TASK

Analyze this communication IN THE CONTEXT of the existing relationship. What new information does it provide? What actions should we take?

Consider:
1. What NEW facts did we learn? (Don't repeat what we already knew)
2. What buying signals are present?
3. What concerns or objections are raised?
4. What commitments were made (by us or them)?
5. Were any previous commitments fulfilled?
6. What's the type of this communication?
7. What actions should we take next?
8. If there's no deal yet, should we create one?
9. If there's a deal, should the stage change?

Return JSON only (no markdown):
{
  "key_facts_learned": [
    {"fact": "string", "confidence": 0.0-1.0}
  ],
  "buying_signals": [
    {"signal": "string", "strength": "strong|moderate|weak", "quote": "string or null"}
  ],
  "concerns_raised": [
    {"concern": "string", "severity": "high|medium|low"}
  ],
  "commitment_updates": {
    "new_ours": [{"commitment": "string", "due_by": "string or null"}],
    "new_theirs": [{"commitment": "string", "expected_by": "string or null"}],
    "completed": ["commitment text that is now done"]
  },
  "relationship_summary_update": "Updated summary incorporating this communication",
  "should_create_deal": true/false,
  "recommended_deal_stage": "stage name if creating deal",
  "estimated_deal_value": number or null,
  "deal_stage_change": {"new_stage": "stage", "reason": "why"} or null,
  "communication_type": "demo_request|trial_request|pricing_inquiry|follow_up|objection|negotiation|general|other",
  "suggested_actions": [
    {
      "action_type": "respond|follow_up|schedule|prepare|escalate",
      "title": "What to do",
      "priority": "urgent|high|medium|low",
      "why_now": "Specific reason this needs attention",
      "due_within_days": number or null
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    jsonText = jsonText
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ');

    return JSON.parse(jsonText) as PlaybookAnalysis;
  } catch (error) {
    console.error('[ContextPipeline] Analysis error:', error);

    // Return safe defaults
    return {
      key_facts_learned: [],
      buying_signals: [],
      concerns_raised: [],
      commitment_updates: { new_ours: [], new_theirs: [], completed: [] },
      relationship_summary_update: 'Analysis pending',
      should_create_deal: false,
      communication_type: 'general',
      suggested_actions: [{
        action_type: 'respond',
        title: 'Review and respond to communication',
        priority: 'medium',
        why_now: 'New communication received',
      }],
    };
  }
}

// ============================================
// STEP 4: UPDATE RELATIONSHIP INTELLIGENCE
// ============================================

/**
 * Update the relationship with new learnings from analysis
 */
export async function updateRelationshipIntelligence(params: {
  companyId: string;
  contactId: string;
  communicationId: string;
  communicationType: string;
  analysis: PlaybookAnalysis;
}): Promise<void> {
  const supabase = createAdminClient();
  const { companyId, contactId, communicationId, communicationType, analysis } = params;

  // Get or create relationship intelligence record
  const { data: existing } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .single();

  const now = new Date().toISOString();

  // Type definitions for commitment tracking
  interface CommitmentRecord {
    commitment: string;
    made_on?: string;
    due_by?: string;
    expected_by?: string;
    source_type?: string;
    source_id?: string;
    status?: string;
  }

  if (existing) {
    // Update existing record
    const currentContext = existing.context || {};
    const currentInteractions = existing.interactions || [];
    const currentCommitments: { ours: CommitmentRecord[]; theirs: CommitmentRecord[] } =
      existing.open_commitments as { ours: CommitmentRecord[]; theirs: CommitmentRecord[] } || { ours: [], theirs: [] };
    const currentSignals = existing.signals || { buying_signals: [], concerns: [], objections: [] };

    // Add new key facts
    const existingFacts = (currentContext as any).key_facts || [];
    const newFacts = analysis.key_facts_learned.map(f => ({
      fact: f.fact,
      source: communicationType,
      source_id: communicationId,
      date: now,
      confidence: f.confidence,
    }));

    // Add new interaction
    const newInteraction = {
      id: communicationId,
      type: communicationType,
      date: now,
      summary: analysis.relationship_summary_update,
      key_points: analysis.key_facts_learned.map(f => f.fact),
      buying_signals: analysis.buying_signals.map(s => s.signal),
      concerns: analysis.concerns_raised.map(c => c.concern),
    };

    // Update commitments
    const updatedOurs = [
      ...currentCommitments.ours.filter(c => !analysis.commitment_updates.completed.includes(c.commitment)),
      ...analysis.commitment_updates.new_ours.map(c => ({
        commitment: c.commitment,
        made_on: now,
        due_by: c.due_by,
        source_type: communicationType,
        source_id: communicationId,
        status: 'open',
      })),
    ];

    const updatedTheirs = [
      ...currentCommitments.theirs.filter(c => !analysis.commitment_updates.completed.includes(c.commitment)),
      ...analysis.commitment_updates.new_theirs.map(c => ({
        commitment: c.commitment,
        made_on: now,
        expected_by: c.expected_by,
        source_type: communicationType,
        source_id: communicationId,
        status: 'open',
      })),
    ];

    // Add new signals
    const newBuyingSignals = analysis.buying_signals.map(s => ({
      signal: s.signal,
      strength: s.strength,
      quote: s.quote,
      date: now,
      source_id: communicationId,
    }));

    const newConcerns = analysis.concerns_raised.map(c => ({
      concern: c.concern,
      severity: c.severity,
      resolved: false,
      date: now,
      source_id: communicationId,
    }));

    await supabase
      .from('relationship_intelligence')
      .update({
        context: {
          ...currentContext,
          key_facts: [...existingFacts, ...newFacts],
        },
        interactions: [...currentInteractions, newInteraction],
        open_commitments: { ours: updatedOurs, theirs: updatedTheirs },
        signals: {
          buying_signals: [...currentSignals.buying_signals, ...newBuyingSignals],
          concerns: [...currentSignals.concerns, ...newConcerns],
          objections: currentSignals.objections,
        },
        relationship_summary: analysis.relationship_summary_update,
        updated_at: now,
      })
      .eq('id', existing.id);

    console.log('[ContextPipeline] Updated relationship intelligence');
  } else {
    // Create new record
    await supabase.from('relationship_intelligence').insert({
      company_id: companyId,
      contact_id: contactId,
      context: {
        key_facts: analysis.key_facts_learned.map(f => ({
          fact: f.fact,
          source: communicationType,
          source_id: communicationId,
          date: now,
          confidence: f.confidence,
        })),
      },
      interactions: [{
        id: communicationId,
        type: communicationType,
        date: now,
        summary: analysis.relationship_summary_update,
        key_points: analysis.key_facts_learned.map(f => f.fact),
      }],
      open_commitments: {
        ours: analysis.commitment_updates.new_ours.map(c => ({
          commitment: c.commitment,
          made_on: now,
          due_by: c.due_by,
          status: 'open',
        })),
        theirs: analysis.commitment_updates.new_theirs.map(c => ({
          commitment: c.commitment,
          made_on: now,
          expected_by: c.expected_by,
          status: 'open',
        })),
      },
      signals: {
        buying_signals: analysis.buying_signals.map(s => ({
          signal: s.signal,
          strength: s.strength,
          date: now,
        })),
        concerns: analysis.concerns_raised.map(c => ({
          concern: c.concern,
          severity: c.severity,
          resolved: false,
          date: now,
        })),
        objections: [],
      },
      relationship_summary: analysis.relationship_summary_update,
    });

    console.log('[ContextPipeline] Created new relationship intelligence record');
  }
}

// ============================================
// STEP 5: DETERMINE ACTIONS WITH CONTEXT
// ============================================

/**
 * Determine what actions are needed based on current state
 */
export async function determineActionsWithContext(params: {
  analysis: PlaybookAnalysis;
  existingActions: Array<{ id: string; title: string; action_type: string; status: string }>;
  context: RelationshipContext;
  communication: CommunicationInput;
}): Promise<ActionDecision> {
  const { analysis, existingActions } = params;

  // Simple logic for now - can be AI-enhanced later
  const decision: ActionDecision = {
    existing: [],
    new: [],
  };

  // Check if any existing actions should be completed
  for (const action of existingActions.filter(a => a.status === 'pending')) {
    // If we received a response to something we were waiting for
    if (action.action_type === 'follow_up' && params.communication.type === 'email_inbound') {
      decision.existing.push({
        id: action.id,
        action: 'complete',
        reason: 'Received response from prospect',
      });
    }
  }

  // Create new actions from analysis
  for (const suggestedAction of analysis.suggested_actions) {
    // Determine tier based on priority and communication type
    let tier = 4; // Default to Tier 4
    if (suggestedAction.priority === 'urgent') tier = 1;
    else if (suggestedAction.priority === 'high') tier = 2;
    else if (suggestedAction.priority === 'medium') tier = 3;

    // Adjust tier based on communication type
    if (analysis.communication_type === 'demo_request') tier = Math.min(tier, 1);
    if (analysis.communication_type === 'trial_request') tier = Math.min(tier, 1);
    if (analysis.communication_type === 'pricing_inquiry') tier = Math.min(tier, 2);

    decision.new.push({
      action_type: suggestedAction.action_type,
      title: suggestedAction.title,
      tier,
      why_now: suggestedAction.why_now,
      workflow_steps: generateWorkflowSteps(suggestedAction.action_type),
    });
  }

  return decision;
}

/**
 * Generate workflow steps based on action type
 */
function generateWorkflowSteps(actionType: string): Array<{ step: string; type: string }> {
  switch (actionType) {
    case 'respond':
      return [
        { step: 'Review the communication', type: 'review' },
        { step: 'Draft response', type: 'compose' },
        { step: 'Send response', type: 'send' },
      ];
    case 'follow_up':
      return [
        { step: 'Check last interaction', type: 'review' },
        { step: 'Compose follow-up', type: 'compose' },
        { step: 'Send follow-up', type: 'send' },
      ];
    case 'schedule':
      return [
        { step: 'Check availability', type: 'review' },
        { step: 'Send calendar invite', type: 'schedule' },
      ];
    default:
      return [{ step: 'Complete task', type: 'action' }];
  }
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Process an incoming communication using context-first approach
 */
export async function processIncomingCommunication(
  communication: CommunicationInput,
  userId: string
): Promise<ProcessingResult> {
  console.log('[ContextPipeline] Starting context-first processing');
  const supabase = createAdminClient();

  // ============================================
  // STEP 1: IDENTIFY COMPANY AND CONTACT FIRST
  // ============================================
  console.log('[ContextPipeline] Step 1: Identifying entities...');
  const matchResult = await intelligentEntityMatch(communication, userId);

  if (!matchResult.company && !matchResult.contact) {
    throw new Error('Could not identify company or contact for this communication');
  }

  console.log(`[ContextPipeline] Matched: company=${matchResult.company?.name}, contact=${matchResult.contact?.name}, confidence=${matchResult.confidence}`);

  // ============================================
  // STEP 2: LOAD ALL EXISTING CONTEXT
  // ============================================
  console.log('[ContextPipeline] Step 2: Loading relationship context...');
  const contextBefore = await buildFullRelationshipContext({
    companyId: matchResult.company?.id || null,
    contactId: matchResult.contact?.id || null,
    includeAllHistory: true,
  });

  console.log(`[ContextPipeline] Context loaded: ${contextBefore.recentCommunications.length} communications, ${contextBefore.salespersonNotes.length} notes`);

  // ============================================
  // STEP 3: ANALYZE WITH FULL CONTEXT
  // ============================================
  console.log('[ContextPipeline] Step 3: Analyzing with context...');
  const analysis = await analyzeWithFullContext({
    communication,
    context: contextBefore,
  });

  console.log(`[ContextPipeline] Analysis complete: ${analysis.key_facts_learned.length} facts, ${analysis.buying_signals.length} signals, ${analysis.suggested_actions.length} actions`);

  // ============================================
  // STEP 4: UPDATE THE RELATIONSHIP CONTEXT
  // ============================================
  console.log('[ContextPipeline] Step 4: Updating relationship intelligence...');

  // If contact wasn't matched but AI suggested creating one, create it now
  if (!matchResult.contact && matchResult.company?.id) {
    // Extract contact info from communication
    const suggestedName = communication.from_name || communication.from_email?.split('@')[0] || 'Unknown';
    const suggestedEmail = communication.from_email;

    if (suggestedEmail) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: suggestedName,
          email: suggestedEmail,
          company_id: matchResult.company.id,
          status: 'active',
          source: 'ai_extracted',
          user_id: userId,
        })
        .select('id, name, email, company_id')
        .single();

      if (!contactError && newContact) {
        // Update matchResult with the new contact
        (matchResult as any).contact = newContact;
        (matchResult as any).was_created = { ...matchResult.was_created, contact: true };
        console.log(`[ContextPipeline] Created new contact: ${newContact.name}`);
      }
    }
  }

  // Update relationship intelligence if we have company and contact
  if (matchResult.company?.id && matchResult.contact?.id) {
    await updateRelationshipIntelligence({
      companyId: matchResult.company.id,
      contactId: matchResult.contact.id,
      communicationId: crypto.randomUUID(), // Use actual communication ID if available
      communicationType: communication.type,
      analysis,
    });
  } else if (matchResult.company?.id) {
    // Update company-level intelligence even without specific contact
    console.log('[ContextPipeline] Updating company-level intelligence (no specific contact)');
  }

  // Create deal if needed
  let deal = contextBefore.deal;
  if (!deal && analysis.should_create_deal && matchResult.company?.id) {
    const { data: newDeal } = await supabase
      .from('deals')
      .insert({
        company_id: matchResult.company.id,
        contact_id: matchResult.contact?.id,
        name: `${matchResult.contact?.name || 'Unknown'} - ${matchResult.company.name}`,
        stage: analysis.recommended_deal_stage || 'qualifying',
        estimated_value: analysis.estimated_deal_value,
        source: communication.type,
        user_id: userId,
      })
      .select('id, name, stage, estimated_value, expected_close_date')
      .single();

    if (newDeal) {
      deal = newDeal;
      console.log(`[ContextPipeline] Created deal: ${newDeal.name}`);
    }
  }

  // Update deal stage if needed
  if (deal && analysis.deal_stage_change) {
    await supabase
      .from('deals')
      .update({
        stage: analysis.deal_stage_change.new_stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deal.id);

    deal.stage = analysis.deal_stage_change.new_stage;
    console.log(`[ContextPipeline] Updated deal stage to: ${analysis.deal_stage_change.new_stage}`);
  }

  // ============================================
  // STEP 5: DETERMINE ACTIONS
  // ============================================
  console.log('[ContextPipeline] Step 5: Determining actions...');

  // Get existing actions for this relationship
  const { data: existingActions } = await supabase
    .from('command_center_items')
    .select('id, title, action_type, status')
    .eq('company_id', matchResult.company?.id)
    .eq('status', 'pending');

  const actionDecisions = await determineActionsWithContext({
    analysis,
    existingActions: existingActions || [],
    context: contextBefore,
    communication,
  });

  // Apply action decisions
  const actionsCompleted: Array<{ id: string; title: string }> = [];
  const actionsUpdated: Array<{ id: string; title: string }> = [];
  const actionsCreated: Array<{ id: string; title: string }> = [];

  for (const decision of actionDecisions.existing) {
    if (decision.action === 'complete') {
      await supabase
        .from('command_center_items')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', decision.id);
      const action = existingActions?.find(a => a.id === decision.id);
      if (action) actionsCompleted.push({ id: action.id, title: action.title });
    } else if (decision.action === 'update' && decision.updates) {
      await supabase
        .from('command_center_items')
        .update({ ...decision.updates, updated_at: new Date().toISOString() })
        .eq('id', decision.id);
      const action = existingActions?.find(a => a.id === decision.id);
      if (action) actionsUpdated.push({ id: action.id, title: action.title });
    }
  }

  for (const newAction of actionDecisions.new) {
    // Convert tier to momentum score (tier 1 = 100, tier 5 = 20)
    const momentumScore = Math.max(20, 100 - (newAction.tier - 1) * 20);

    const { data: created, error } = await supabase
      .from('command_center_items')
      .insert({
        user_id: userId,
        company_id: matchResult.company?.id,
        contact_id: matchResult.contact?.id,
        deal_id: deal?.id,
        title: newAction.title,
        action_type: newAction.action_type,
        momentum_score: momentumScore,
        why_now: newAction.why_now,
        source: communication.type,
        status: 'pending',
        target_name: matchResult.contact?.name,
        company_name: matchResult.company?.name,
      })
      .select('id, title')
      .single();

    if (error) {
      console.error('[ContextPipeline] Error creating action:', error.message);
    }
    if (created) actionsCreated.push(created);
  }

  console.log(`[ContextPipeline] Actions: ${actionsCreated.length} created, ${actionsUpdated.length} updated, ${actionsCompleted.length} completed`);

  // ============================================
  // STEP 6: RETURN FULL RESULT
  // ============================================
  const contextAfter = await buildFullRelationshipContext({
    companyId: matchResult.company?.id || null,
    contactId: matchResult.contact?.id || null,
    dealId: deal?.id,
  });

  return {
    company: matchResult.company,
    contact: matchResult.contact,
    deal,
    contextBefore,
    contextAfter,
    analysisWithContext: analysis,
    actionsCreated,
    actionsUpdated,
    actionsCompleted,
    matchConfidence: matchResult.confidence,
    matchReasoning: matchResult.reasoning,
  };
}
