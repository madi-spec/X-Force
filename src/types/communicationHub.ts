/**
 * Communication Hub Types
 *
 * Core principle:
 * - Communications = FACTS (immutable events)
 * - Analysis = OPINIONS (versioned, replaceable)
 * - Prioritization = JUDGMENT (CC engine decides tier)
 */

export interface Communication {
  id: string;

  // Relationships
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;

  // Channel
  channel: 'email' | 'call' | 'meeting' | 'sms' | 'chat' | 'note';
  direction: 'inbound' | 'outbound' | 'internal';

  // Participants
  our_participants: Participant[];
  their_participants: Participant[];

  // AI Provenance
  is_ai_generated: boolean;
  ai_action_type: string | null;
  ai_initiated_by: string | null;
  ai_approved_by: string | null;
  ai_model_used: string | null;

  // Timing
  occurred_at: string;
  duration_seconds: number | null;

  // Content
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  content_html: string | null;
  attachments: Attachment[];
  recording_url: string | null;

  // Source
  source_table: string | null;
  source_id: string | null;
  external_id: string | null;
  thread_id: string | null;
  in_reply_to: string | null;

  // Response State
  awaiting_our_response: boolean;
  awaiting_their_response: boolean;
  response_due_by: string | null;
  response_sla_minutes: number | null;
  responded_at: string | null;
  response_communication_id: string | null;

  // Email Engagement
  email_opened_at: string | null;
  email_clicked_at: string | null;
  email_bounced: boolean;

  // User Tags
  tags: string[];
  is_starred: boolean;
  is_archived: boolean;

  // Analysis
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  current_analysis_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Participant {
  user_id?: string;
  contact_id?: string;
  name: string;
  email?: string;
  title?: string;
  role?: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface CommunicationAnalysis {
  id: string;
  communication_id: string;

  // Version
  version: number;
  is_current: boolean;
  model_used: string | null;
  prompt_version: string | null;

  // Summary
  summary: string | null;
  communication_type: string | null;
  products_discussed: string[];

  // Sentiment
  sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'excited' | null;
  sentiment_score: number | null;
  sentiment_confidence: number | null;

  // Extracted Intelligence
  extracted_facts: ExtractedFact[];
  extracted_signals: ExtractedSignal[];
  extracted_objections: ExtractedObjection[];
  extracted_commitments_us: ExtractedCommitment[];
  extracted_commitments_them: ExtractedCommitment[];
  extracted_competitors: ExtractedCompetitor[];
  extracted_next_steps: ExtractedNextStep[];

  // Triggers
  potential_triggers: string[];

  // Timestamps
  analyzed_at: string;
  created_at: string;
}

export interface ExtractedFact {
  fact: string;
  confidence: number;
  quote?: string;
}

export interface ExtractedSignal {
  signal: string;
  detail: string;
  confidence: number;
  quote?: string;
}

export interface ExtractedObjection {
  objection: string;
  detail: string;
  confidence: number;
  addressed: boolean;
}

export interface ExtractedCommitment {
  commitment: string;
  confidence: number;
  due_by?: string;
  owner?: string;  // For us
  who?: string;    // For them
  status: 'pending' | 'completed' | 'overdue';
}

export interface ExtractedCompetitor {
  competitor: string;
  context: string;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface ExtractedNextStep {
  step: string;
  owner: 'us' | 'them';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

export interface Promise {
  id: string;
  direction: 'we_promised' | 'they_promised';
  promise_text: string;

  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;

  owner_user_id: string | null;
  owner_name: string | null;
  promiser_contact_id: string | null;
  promiser_name: string | null;

  promised_at: string;
  due_by: string | null;

  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  completed_at: string | null;
  completed_communication_id: string | null;

  source_communication_id: string | null;
  source_analysis_id: string | null;
  confidence: number | null;

  is_hidden: boolean;

  created_at: string;
  updated_at: string;
}

// Confidence thresholds for display
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,      // Show prominently, can trigger CC
  MEDIUM: 0.70,    // Show with "Possible" prefix
  LOW: 0.70,       // Hide by default
} as const;

// Filter helper
export function filterByConfidence<T extends { confidence: number }>(
  items: T[],
  threshold: number = CONFIDENCE_THRESHOLDS.MEDIUM
): T[] {
  return items.filter(item => item.confidence >= threshold);
}

// API Response types
export interface CommunicationsResponse {
  communications: CommunicationWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

export interface CommunicationWithRelations extends Communication {
  company?: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  contact?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  deal?: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
  } | null;
  current_analysis?: CommunicationAnalysis | null;
}

export interface ResponseQueueResponse {
  response_queue: {
    overdue: CommunicationWithUrgency[];
    due_soon: CommunicationWithUrgency[];
    upcoming: CommunicationWithUrgency[];
  };
  total: number;
}

export interface CommunicationWithUrgency extends CommunicationWithRelations {
  hours_overdue?: number;
  hours_remaining?: number;
}
