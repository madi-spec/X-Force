// ============================================
// MEETINGS PAGE - TYPE DEFINITIONS
// ============================================

// Base types
export type MeetingType = 'video' | 'phone' | 'in_person';
export type ResponseStatus = 'pending' | 'accepted' | 'declined' | 'tentative';
export type TranscriptSource = 'fireflies' | 'manual' | 'zoom' | 'teams' | 'google_meet';
export type TranscriptStatus = 'pending' | 'processing' | 'analyzed' | 'failed';
export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type ActionItemStatus = 'pending' | 'in_progress' | 'done';
export type ActionItemSource = 'ai_generated' | 'manual';

// ============================================
// NEW MEETINGS TABLE TYPES (meetings_redesign)
// ============================================

// Database row type for new meetings table
export interface Meeting {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  meeting_type: MeetingType;
  meeting_url: string | null;
  external_id: string | null;
  external_source: string | null;
  customer_id: string | null;
  excluded: boolean;
  excluded_at: string | null;
  excluded_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// New meeting attendee table type
export interface NewMeetingAttendee {
  id: string;
  meeting_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  is_organizer: boolean;
  response_status: ResponseStatus;
  created_at: string;
}

// New meeting prep table type
export interface NewMeetingPrep {
  id: string;
  meeting_id: string;
  summary: string | null;
  key_points: string[];
  suggested_questions: string[];
  deal_id: string | null;
  generated_at: string;
  updated_at: string;
}

// New meeting transcript table type
export interface MeetingTranscriptNew {
  id: string;
  organization_id: string;
  meeting_id: string | null;
  title: string | null;
  source: TranscriptSource;
  external_id: string | null;
  raw_content: string | null;
  word_count: number;
  duration_seconds: number | null;
  status: TranscriptStatus;
  processing_progress: number;
  error_message: string | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

// New meeting transcript analysis type
export interface MeetingTranscriptAnalysis {
  id: string;
  transcript_id: string;
  summary: string | null;
  key_insights: string[];
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  signals_count: number;
  signals: Signal[];
  topics: Topic[];
  speaker_breakdown: SpeakerStats[];
  full_analysis: Record<string, unknown> | null;
  analyzed_at: string;
  analyzed_by: string | null;
  updated_at: string;
}

// New meeting action item table type
export interface MeetingActionItem {
  id: string;
  organization_id: string;
  meeting_id: string | null;
  transcript_id: string | null;
  text: string;
  assignee_id: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  completed_by: string | null;
  source: ActionItemSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Combined types for API/UI with relations
export interface MeetingWithRelations extends Meeting {
  customer?: {
    id: string;
    name: string;
  } | null;
  attendees: NewMeetingAttendee[];
  prep: NewMeetingPrep | null;
  transcript: (MeetingTranscriptNew & { analysis: MeetingTranscriptAnalysis | null }) | null;
  action_items: (MeetingActionItem & {
    assignee?: {
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
    } | null;
  })[];
}

// ============================================
// LEGACY/EXISTING TYPES (activities-based)
// ============================================

// Database row types
export interface ActionItem {
  id: string;
  user_id: string;
  activity_id: string | null;
  transcription_id: string | null;
  text: string;
  assignee_id: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  completed_by: string | null;
  source: ActionItemSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingActivity {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  summary: string | null;
  occurred_at: string;
  metadata: MeetingMetadata;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  company_product_id: string | null;
  user_id: string;
  external_id: string | null;
  excluded_at: string | null;
  excluded_by: string | null;
  exclusion_reason: string | null;
  sentiment: Sentiment | null;
  action_items: LegacyActionItem[] | null;
  created_at: string;
}

export interface MeetingMetadata {
  attendees?: MeetingAttendee[];
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  joinUrl?: string;
  join_url?: string;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  location?: string;
  organizer?: {
    name?: string;
    email?: string;
  };
  [key: string]: unknown;
}

export interface MeetingAttendee {
  name?: string;
  email?: string;
  type?: 'required' | 'optional' | 'resource';
  status?: ResponseStatus;
}

export interface LegacyActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
  completed?: boolean;
}

export interface MeetingTranscription {
  id: string;
  user_id: string;
  activity_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  company_product_id: string | null;
  title: string;
  meeting_date: string;
  duration_minutes: number | null;
  attendees: string[] | null;
  transcription_text: string;
  transcription_format: string | null;
  word_count: number | null;
  analysis: TranscriptAnalysis | null;
  analysis_generated_at: string | null;
  summary: string | null;
  follow_up_email_draft: string | null;
  source: string | null;
  external_id: string | null;
  external_metadata: Record<string, unknown> | null;
  // New columns from migration
  status: TranscriptStatus;
  processing_progress: number;
  error_message: string | null;
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  signals_count: number;
  key_insights: string[];
  created_at: string;
  updated_at: string;
}

export interface TranscriptAnalysis {
  headline?: string;
  summary?: string;
  sentiment?: Sentiment;
  sentiment_score?: number;
  buying_signals?: number;
  buyingSignals?: number;
  objections?: Objection[];
  action_items?: TranscriptActionItem[];
  actionItems?: TranscriptActionItem[];
  key_insights?: string[];
  keyInsights?: string[];
  topics?: (string | Topic)[];
  next_steps?: string[];
  nextSteps?: string[];
  signals?: Signal[];
  speaker_breakdown?: SpeakerStats[];
  analyzed_by?: string;
  analyzed_at?: string;
  [key: string]: unknown;
}

export interface Objection {
  text: string;
  severity?: 'low' | 'medium' | 'high';
  response?: string;
}

export interface TranscriptActionItem {
  text: string;
  assignee?: string;
  due_date?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface Signal {
  type: string;
  text: string;
  timestamp?: string;
  confidence?: number;
}

export interface Topic {
  name: string;
  relevance: number;
  mentions: number;
}

export interface SpeakerStats {
  name: string;
  email?: string;
  talk_time_seconds: number;
  talk_time_percentage: number;
  word_count: number;
}

export interface MeetingPrep {
  id: string;
  user_id: string;
  meeting_id: string;
  meeting_external_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  join_url: string | null;
  company_id: string | null;
  deal_id: string | null;
  attendees: MeetingAttendee[] | null;
  objective: string | null;
  talking_points: string[] | null;
  landmines: string[] | null;
  questions_to_ask: string[] | null;
  prep_materials: PrepMaterial[] | null;
  generated_at: string | null;
  last_refreshed_at: string | null;
  has_external_attendees: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PrepMaterial {
  type: 'company_info' | 'deal_context' | 'recent_activity' | 'contact_history';
  title: string;
  content: string;
  source?: string;
}

// API/UI types with relations
export interface MeetingWithDetails {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: MeetingMetadata;
  company_id: string | null;
  company_product_id: string | null;
  external_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  attendee_count: number;
  duration_minutes: number | null;
  join_url: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
  transcript: TranscriptData | null;
  prep: MeetingPrepData | null;
  action_items: ActionItemWithAssignee[];
  needsCompanyAssignment: boolean;
  excluded_at: string | null;
  exclusion_reason: string | null;
}

export interface TranscriptData {
  id: string;
  title: string;
  summary: string | null;
  word_count: number | null;
  duration_minutes: number | null;
  status: TranscriptStatus;
  processing_progress: number;
  analysis: {
    headline: string | null;
    sentiment: Sentiment | null;
    sentiment_score: number | null;
    buyingSignals: number;
    actionItems: number;
    topics: string[];
    nextSteps: string[];
    keyInsights: string[];
  } | null;
}

export interface MeetingPrepData {
  id: string;
  objective: string | null;
  talking_points: string[];
  landmines: string[];
  questions_to_ask: string[];
  generated_at: string | null;
}

export interface ActionItemWithAssignee extends ActionItem {
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  } | null;
}

export interface ProcessingTranscript {
  id: string;
  activity_id: string | null;
  title: string;
  status: TranscriptStatus;
  progress: number;
  word_count: number;
  source: string | null;
}

// Form/input types
export interface CreateActionItemInput {
  text: string;
  assignee_id?: string;
  due_date?: string;
  activity_id?: string;
  transcription_id?: string;
}

export interface UpdateActionItemInput {
  text?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  status?: ActionItemStatus;
}

export interface UpdateMeetingInput {
  company_id?: string | null;
  company_product_id?: string | null;
}

export interface ExcludeMeetingInput {
  reason?: string;
}

// Stats types
export interface MeetingsStats {
  today_count: number;
  this_week_count: number;
  analyzed_count: number;
  pending_actions_count: number;
  processing_count: number;
  excluded_count: number;
}

// Grouped meetings for UI
export interface GroupedUpcoming {
  today: MeetingWithDetails[];
  tomorrow: MeetingWithDetails[];
  later: MeetingWithDetails[];
  totalCount: number;
}

export interface GroupedPast {
  byDate: Record<string, MeetingWithDetails[]>;
  totalCount: number;
}

export interface MeetingsData {
  upcoming: GroupedUpcoming;
  past: GroupedPast;
  stats?: MeetingsStats;
  processing?: ProcessingTranscript[];
}
