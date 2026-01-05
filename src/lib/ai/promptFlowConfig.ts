/**
 * AI Prompt Flow Configuration
 *
 * Maps the complete flow of AI prompts through the system.
 * Powers the visual flowchart on the AI Prompts settings page.
 */

// ============================================
// TYPES
// ============================================

export type FlowNodeType = 'trigger' | 'worker' | 'prompt' | 'output' | 'condition';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  description?: string;
  icon: string;
  color: string;
  promptKey?: string;
  sourceFile?: string;
}

export interface FlowConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed';
  color?: string;
}

export interface FlowGroup {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: FlowCategory;
  nodes: FlowNode[];
  connections: FlowConnection[];
}

export type FlowCategory =
  | 'autopilot'
  | 'intelligence'
  | 'communication'
  | 'lifecycle'
  | 'realtime';

// ============================================
// COLORS
// ============================================

export const FLOW_COLORS = {
  trigger: '#f97316',
  worker: '#3b82f6',
  prompt: '#a855f7',
  output: '#10b981',
  condition: '#eab308',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

export const CATEGORY_COLORS: Record<FlowCategory, string> = {
  autopilot: '#ec4899',
  intelligence: '#8b5cf6',
  communication: '#3b82f6',
  lifecycle: '#10b981',
  realtime: '#f97316',
};

// ============================================
// FLOW GROUPS
// ============================================

export const AI_FLOW_GROUPS: FlowGroup[] = [
  // ==================== AUTOPILOT ====================
  {
    id: 'scheduler',
    label: 'Scheduler Autopilot',
    description: 'Processes scheduling requests and interprets prospect responses',
    icon: '📅',
    color: FLOW_COLORS.worker,
    category: 'autopilot',
    nodes: [
      { id: 'scheduler_cron', type: 'trigger', label: 'Cron Job', description: 'Runs every 5-15 minutes', icon: '⏰', color: FLOW_COLORS.trigger, sourceFile: 'src/app/api/jobs/ai-autopilot/run/route.ts' },
      { id: 'scheduler_message_received', type: 'trigger', label: 'Prospect Reply', description: 'Email/SMS with scheduling context', icon: '📨', color: FLOW_COLORS.trigger },
      { id: 'scheduler_worker', type: 'worker', label: 'Scheduler Autopilot', description: 'Evaluates safety rules, processes requests', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/autopilot/schedulerAutopilot.ts' },
      { id: 'scheduler_safety_check', type: 'condition', label: 'Safety Check', description: 'Is auto-action safe?', icon: '🛡️', color: FLOW_COLORS.condition, sourceFile: 'src/lib/autopilot/safetyRules.ts' },
      { id: 'prompt_scheduler_interpret', type: 'prompt', label: 'Interpret Response', description: 'Interprets "2pm Monday" style responses', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'scheduler_interpret_response' },
      { id: 'prompt_scheduler_email', type: 'prompt', label: 'Generate Email', description: 'Generates scheduling proposal emails', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'scheduler_email_generation' },
      { id: 'scheduler_output_email', type: 'output', label: 'Email Sent', description: 'Scheduling email sent', icon: '📧', color: FLOW_COLORS.output },
      { id: 'scheduler_output_calendar', type: 'output', label: 'Calendar Event', description: 'Meeting booked', icon: '📆', color: FLOW_COLORS.output },
      { id: 'scheduler_output_flag', type: 'output', label: 'Approval Flag', description: 'BOOK_MEETING_APPROVAL flag', icon: '🚩', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'sc1', from: 'scheduler_cron', to: 'scheduler_worker', style: 'solid' },
      { id: 'sc2', from: 'scheduler_message_received', to: 'prompt_scheduler_interpret', style: 'solid' },
      { id: 'sc3', from: 'prompt_scheduler_interpret', to: 'scheduler_worker', style: 'solid', label: 'Parsed times' },
      { id: 'sc4', from: 'scheduler_worker', to: 'scheduler_safety_check', style: 'solid' },
      { id: 'sc5', from: 'scheduler_safety_check', to: 'prompt_scheduler_email', style: 'solid', label: 'Safe' },
      { id: 'sc6', from: 'scheduler_safety_check', to: 'scheduler_output_flag', style: 'dashed', label: 'Unsafe', color: FLOW_COLORS.error },
      { id: 'sc7', from: 'prompt_scheduler_email', to: 'scheduler_output_email', style: 'solid' },
      { id: 'sc8', from: 'scheduler_output_email', to: 'scheduler_output_calendar', style: 'dashed', label: 'If confirmed' },
    ],
  },
  {
    id: 'needs_reply',
    label: 'Needs Reply Autopilot',
    description: 'Auto-responds to communications awaiting our reply',
    icon: '💬',
    color: FLOW_COLORS.worker,
    category: 'autopilot',
    nodes: [
      { id: 'needsreply_cron', type: 'trigger', label: 'Cron Job', description: 'Runs every 5-15 minutes', icon: '⏰', color: FLOW_COLORS.trigger },
      { id: 'needsreply_worker', type: 'worker', label: 'Needs Reply Autopilot', description: 'Finds awaiting_our_response=true', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/autopilot/needsReplyAutopilot.ts' },
      { id: 'needsreply_safety', type: 'condition', label: 'Safety Check', description: 'Simple logistics? No pricing?', icon: '🛡️', color: FLOW_COLORS.condition },
      { id: 'prompt_auto_reply', type: 'prompt', label: 'Generate Reply', description: 'Generates contextual auto-reply', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'email_auto_reply' },
      { id: 'needsreply_output_email', type: 'output', label: 'Reply Sent', description: 'Auto-reply sent', icon: '📧', color: FLOW_COLORS.output },
      { id: 'needsreply_output_flag', type: 'output', label: 'Needs Reply Flag', description: 'NEEDS_REPLY flag for human', icon: '🚩', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'nr1', from: 'needsreply_cron', to: 'needsreply_worker', style: 'solid' },
      { id: 'nr2', from: 'needsreply_worker', to: 'needsreply_safety', style: 'solid' },
      { id: 'nr3', from: 'needsreply_safety', to: 'prompt_auto_reply', style: 'solid', label: 'Safe' },
      { id: 'nr4', from: 'needsreply_safety', to: 'needsreply_output_flag', style: 'dashed', label: 'Needs human', color: FLOW_COLORS.error },
      { id: 'nr5', from: 'prompt_auto_reply', to: 'needsreply_output_email', style: 'solid' },
    ],
  },
  {
    id: 'transcript',
    label: 'Transcript Autopilot',
    description: 'Analyzes meeting transcripts and sends follow-ups',
    icon: '🎙️',
    color: FLOW_COLORS.worker,
    category: 'autopilot',
    nodes: [
      { id: 'transcript_webhook', type: 'trigger', label: 'Fireflies Webhook', description: 'Transcript from Fireflies.ai', icon: '🔥', color: FLOW_COLORS.trigger, sourceFile: 'src/app/api/webhooks/fireflies/route.ts' },
      { id: 'transcript_cron', type: 'trigger', label: 'Cron Job', description: 'Processes queued transcripts', icon: '⏰', color: FLOW_COLORS.trigger },
      { id: 'transcript_worker', type: 'worker', label: 'Transcript Autopilot', description: 'Processes transcripts', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/autopilot/transcriptAutopilot.ts' },
      { id: 'prompt_transcript_analysis', type: 'prompt', label: 'Analyze Transcript', description: 'Extracts insights, action items', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'transcript_analysis' },
      { id: 'prompt_followup_email', type: 'prompt', label: 'Generate Follow-up', description: 'Creates follow-up email', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'email_meeting_followup' },
      { id: 'transcript_safety', type: 'condition', label: 'Safety Check', description: 'Auto-send appropriate?', icon: '🛡️', color: FLOW_COLORS.condition },
      { id: 'transcript_output_analysis', type: 'output', label: 'Analysis Stored', description: 'Saved to DB', icon: '💾', color: FLOW_COLORS.output },
      { id: 'transcript_output_email', type: 'output', label: 'Follow-up Sent', description: 'Email sent to attendees', icon: '📧', color: FLOW_COLORS.output },
      { id: 'transcript_output_flag', type: 'output', label: 'No Next Step Flag', description: 'Flag for review', icon: '🚩', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'tr1', from: 'transcript_webhook', to: 'prompt_transcript_analysis', style: 'solid' },
      { id: 'tr2', from: 'transcript_cron', to: 'transcript_worker', style: 'solid' },
      { id: 'tr3', from: 'prompt_transcript_analysis', to: 'transcript_output_analysis', style: 'solid' },
      { id: 'tr4', from: 'transcript_output_analysis', to: 'transcript_worker', style: 'dashed', label: 'Queued' },
      { id: 'tr5', from: 'transcript_worker', to: 'transcript_safety', style: 'solid' },
      { id: 'tr6', from: 'transcript_safety', to: 'prompt_followup_email', style: 'solid', label: 'Safe' },
      { id: 'tr7', from: 'transcript_safety', to: 'transcript_output_flag', style: 'dashed', label: 'Needs review', color: FLOW_COLORS.error },
      { id: 'tr8', from: 'prompt_followup_email', to: 'transcript_output_email', style: 'solid' },
    ],
  },
  {
    id: 'stalled_deals',
    label: 'Stalled Deal Reactivation',
    description: 'Re-engages deals that have gone quiet',
    icon: '🔄',
    color: FLOW_COLORS.worker,
    category: 'autopilot',
    nodes: [
      { id: 'stalled_cron', type: 'trigger', label: 'Daily Cron', description: 'Checks for stalled deals', icon: '⏰', color: FLOW_COLORS.trigger },
      { id: 'stalled_worker', type: 'worker', label: 'Reactivation Worker', description: 'Evaluates stalled deals', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/stalledDeals.ts' },
      { id: 'stalled_check_history', type: 'condition', label: 'Check History', description: 'Reactivated before?', icon: '📜', color: FLOW_COLORS.condition },
      { id: 'prompt_stalled_email', type: 'prompt', label: 'Reactivation Email', description: 'Personalized re-engagement', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'email_followup_stalled' },
      { id: 'stalled_output_email', type: 'output', label: 'Email Draft', description: 'Ready for review', icon: '📝', color: FLOW_COLORS.output },
      { id: 'stalled_output_flag', type: 'output', label: 'Attention Flag', description: 'STALLED_DEAL flag', icon: '🚩', color: FLOW_COLORS.warning },
      { id: 'stalled_output_close', type: 'output', label: 'Mark Lost', description: 'After 3+ attempts', icon: '❌', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'sd1', from: 'stalled_cron', to: 'stalled_worker', style: 'solid' },
      { id: 'sd2', from: 'stalled_worker', to: 'stalled_check_history', style: 'solid' },
      { id: 'sd3', from: 'stalled_check_history', to: 'prompt_stalled_email', style: 'solid', label: 'Try again' },
      { id: 'sd4', from: 'stalled_check_history', to: 'stalled_output_close', style: 'dashed', label: '3+ attempts', color: FLOW_COLORS.error },
      { id: 'sd5', from: 'stalled_worker', to: 'stalled_output_flag', style: 'solid' },
      { id: 'sd6', from: 'prompt_stalled_email', to: 'stalled_output_email', style: 'solid' },
    ],
  },

  // ==================== COMMUNICATION ====================
  {
    id: 'email_classification',
    label: 'Email Classification',
    description: 'Classifies inbound emails by intent and routes appropriately',
    icon: '📬',
    color: FLOW_COLORS.worker,
    category: 'communication',
    nodes: [
      { id: 'email_received', type: 'trigger', label: 'Email Received', description: 'New email synced', icon: '📨', color: FLOW_COLORS.trigger, sourceFile: 'src/lib/microsoft/emailSync.ts' },
      { id: 'email_classifier_worker', type: 'worker', label: 'Email Classifier', description: 'Routes through intent detection', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/inbox/emailClassifier.ts' },
      { id: 'prompt_classify_intent', type: 'prompt', label: 'Classify Intent', description: 'Demo, pricing, trial, objection', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'classify_email_intent' },
      { id: 'email_intent_router', type: 'condition', label: 'Intent Router', description: 'Route by intent', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'email_output_demo', type: 'output', label: 'Demo Request', description: '→ Scheduler', icon: '📅', color: FLOW_COLORS.output },
      { id: 'email_output_pricing', type: 'output', label: 'Pricing Question', description: '→ Flag for Rep', icon: '💰', color: FLOW_COLORS.warning },
      { id: 'email_output_trial', type: 'output', label: 'Trial Auth', description: '→ Ops Team', icon: '🚀', color: FLOW_COLORS.success },
      { id: 'email_output_objection', type: 'output', label: 'Objection', description: '→ Objection Handler', icon: '⚠️', color: FLOW_COLORS.error },
      { id: 'email_output_scheduling', type: 'output', label: 'Scheduling Reply', description: '→ Scheduler Interpret', icon: '🗓️', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'ec1', from: 'email_received', to: 'email_classifier_worker', style: 'solid' },
      { id: 'ec2', from: 'email_classifier_worker', to: 'prompt_classify_intent', style: 'solid' },
      { id: 'ec3', from: 'prompt_classify_intent', to: 'email_intent_router', style: 'solid' },
      { id: 'ec4', from: 'email_intent_router', to: 'email_output_demo', style: 'dashed', label: 'Demo' },
      { id: 'ec5', from: 'email_intent_router', to: 'email_output_pricing', style: 'dashed', label: 'Pricing' },
      { id: 'ec6', from: 'email_intent_router', to: 'email_output_trial', style: 'dashed', label: 'Trial' },
      { id: 'ec7', from: 'email_intent_router', to: 'email_output_objection', style: 'dashed', label: 'Objection', color: FLOW_COLORS.error },
      { id: 'ec8', from: 'email_intent_router', to: 'email_output_scheduling', style: 'dashed', label: 'Schedule' },
    ],
  },
  {
    id: 'communication_threading',
    label: 'Communication Threading',
    description: 'Links emails to conversation threads',
    icon: '🧵',
    color: FLOW_COLORS.worker,
    category: 'communication',
    nodes: [
      { id: 'thread_email_in', type: 'trigger', label: 'Email Received', description: 'Needs thread assignment', icon: '📨', color: FLOW_COLORS.trigger },
      { id: 'thread_worker', type: 'worker', label: 'Thread Detector', description: 'Analyzes headers/content', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/communications/threadDetector.ts' },
      { id: 'prompt_thread_context', type: 'prompt', label: 'Identify Thread', description: 'AI matching when headers missing', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'identify_thread_context' },
      { id: 'thread_type_check', type: 'condition', label: 'Thread Type', description: 'New, existing, or reply?', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'thread_output_new', type: 'output', label: 'New Thread', description: 'Create new thread', icon: '🆕', color: FLOW_COLORS.output },
      { id: 'thread_output_link', type: 'output', label: 'Link to Thread', description: 'Add to existing', icon: '🔗', color: FLOW_COLORS.output },
      { id: 'thread_output_awaiting', type: 'output', label: 'Mark Awaiting', description: 'awaiting_our_response=true', icon: '⏳', color: FLOW_COLORS.warning },
    ],
    connections: [
      { id: 'ct1', from: 'thread_email_in', to: 'thread_worker', style: 'solid' },
      { id: 'ct2', from: 'thread_worker', to: 'prompt_thread_context', style: 'dashed', label: 'If ambiguous' },
      { id: 'ct3', from: 'thread_worker', to: 'thread_type_check', style: 'solid' },
      { id: 'ct4', from: 'prompt_thread_context', to: 'thread_type_check', style: 'solid' },
      { id: 'ct5', from: 'thread_type_check', to: 'thread_output_new', style: 'dashed', label: 'New' },
      { id: 'ct6', from: 'thread_type_check', to: 'thread_output_link', style: 'dashed', label: 'Existing' },
      { id: 'ct7', from: 'thread_type_check', to: 'thread_output_awaiting', style: 'dashed', label: 'Reply to us' },
    ],
  },
  {
    id: 'smart_reply',
    label: 'Smart Reply Suggestions',
    description: 'Generates contextual reply options for reps',
    icon: '💡',
    color: FLOW_COLORS.worker,
    category: 'communication',
    nodes: [
      { id: 'smartreply_trigger', type: 'trigger', label: 'Email Opened', description: 'Rep opens email', icon: '👁️', color: FLOW_COLORS.trigger },
      { id: 'smartreply_context', type: 'worker', label: 'Context Builder', description: 'Gathers deal stage, history', icon: '🔧', color: FLOW_COLORS.worker, sourceFile: 'src/lib/inbox/contextBuilder.ts' },
      { id: 'prompt_suggest_replies', type: 'prompt', label: 'Suggest Replies', description: '3 options: formal, casual, CTA', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'suggest_replies' },
      { id: 'smartreply_output_options', type: 'output', label: 'Reply Options', description: '3 drafts displayed', icon: '📝', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'sr1', from: 'smartreply_trigger', to: 'smartreply_context', style: 'solid' },
      { id: 'sr2', from: 'smartreply_context', to: 'prompt_suggest_replies', style: 'solid' },
      { id: 'sr3', from: 'prompt_suggest_replies', to: 'smartreply_output_options', style: 'solid' },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox Intelligence',
    description: 'Analyzes incoming emails for intent and urgency',
    icon: '📥',
    color: FLOW_COLORS.worker,
    category: 'communication',
    nodes: [
      { id: 'inbox_sync', type: 'trigger', label: 'Email Sync', description: 'New email synced', icon: '🔄', color: FLOW_COLORS.trigger, sourceFile: 'src/lib/microsoft/emailSync.ts' },
      { id: 'inbox_worker', type: 'worker', label: 'Inbox Analyzer', description: 'Processes for AI analysis', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/inbox/aiAnalysis.ts' },
      { id: 'prompt_email_analysis', type: 'prompt', label: 'Analyze Email', description: 'Intent, urgency, actions', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'inbox_email_analysis' },
      { id: 'prompt_draft_reply', type: 'prompt', label: 'Draft Reply', description: 'Suggested reply draft', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'inbox_draft_reply' },
      { id: 'inbox_output_categorized', type: 'output', label: 'Categorized', description: 'Intent/urgency tagged', icon: '🏷️', color: FLOW_COLORS.output },
      { id: 'inbox_output_draft', type: 'output', label: 'Draft Created', description: 'Reply ready for review', icon: '📝', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'in1', from: 'inbox_sync', to: 'inbox_worker', style: 'solid' },
      { id: 'in2', from: 'inbox_worker', to: 'prompt_email_analysis', style: 'solid' },
      { id: 'in3', from: 'prompt_email_analysis', to: 'inbox_output_categorized', style: 'solid' },
      { id: 'in4', from: 'prompt_email_analysis', to: 'prompt_draft_reply', style: 'dashed', label: 'If reply needed' },
      { id: 'in5', from: 'prompt_draft_reply', to: 'inbox_output_draft', style: 'solid' },
    ],
  },

  // ==================== INTELLIGENCE ====================
  {
    id: 'entity_matching',
    label: 'Entity Matching',
    description: 'Links transcripts/emails to CRM records',
    icon: '🔗',
    color: FLOW_COLORS.worker,
    category: 'intelligence',
    nodes: [
      { id: 'entity_input_transcript', type: 'trigger', label: 'Transcript', description: 'Needs company/contact linking', icon: '🎙️', color: FLOW_COLORS.trigger },
      { id: 'entity_input_email', type: 'trigger', label: 'Email', description: 'Needs sender ID', icon: '📧', color: FLOW_COLORS.trigger },
      { id: 'entity_worker', type: 'worker', label: 'Entity Matcher', description: 'Extracts and matches to CRM', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/entityMatcher.ts' },
      { id: 'prompt_match_entity', type: 'prompt', label: 'Match Entity', description: 'AI matches to CRM records', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'match_entity_prompt' },
      { id: 'entity_confidence_check', type: 'condition', label: 'Confidence', description: 'Match > 80%?', icon: '📊', color: FLOW_COLORS.condition },
      { id: 'entity_output_company', type: 'output', label: 'Company Matched', description: 'Linked to company', icon: '🏢', color: FLOW_COLORS.success },
      { id: 'entity_output_contact', type: 'output', label: 'Contact Matched', description: 'Linked to contact', icon: '👤', color: FLOW_COLORS.success },
      { id: 'entity_output_unknown', type: 'output', label: 'Unknown', description: 'No match - flag', icon: '❓', color: FLOW_COLORS.warning },
    ],
    connections: [
      { id: 'em1', from: 'entity_input_transcript', to: 'entity_worker', style: 'solid' },
      { id: 'em2', from: 'entity_input_email', to: 'entity_worker', style: 'solid' },
      { id: 'em3', from: 'entity_worker', to: 'prompt_match_entity', style: 'solid' },
      { id: 'em4', from: 'prompt_match_entity', to: 'entity_confidence_check', style: 'solid' },
      { id: 'em5', from: 'entity_confidence_check', to: 'entity_output_company', style: 'solid', label: 'High' },
      { id: 'em6', from: 'entity_confidence_check', to: 'entity_output_contact', style: 'solid', label: 'High' },
      { id: 'em7', from: 'entity_confidence_check', to: 'entity_output_unknown', style: 'dashed', label: 'Low', color: FLOW_COLORS.warning },
    ],
  },
  {
    id: 'objection_detection',
    label: 'Objection Detection',
    description: 'Identifies and categorizes objections from calls/emails',
    icon: '🛑',
    color: FLOW_COLORS.worker,
    category: 'intelligence',
    nodes: [
      { id: 'objection_input_call', type: 'trigger', label: 'Call Transcript', description: 'New transcript', icon: '📞', color: FLOW_COLORS.trigger },
      { id: 'objection_input_email', type: 'trigger', label: 'Email Reply', description: 'Potential pushback', icon: '📧', color: FLOW_COLORS.trigger },
      { id: 'objection_worker', type: 'worker', label: 'Objection Detector', description: 'Scans for objection patterns', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/objectionDetector.ts' },
      { id: 'prompt_detect_objections', type: 'prompt', label: 'Detect Objections', description: 'Price, timing, competition', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'detect_objections' },
      { id: 'objection_type_router', type: 'condition', label: 'Objection Type', description: 'Route by category', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'prompt_objection_response', type: 'prompt', label: 'Suggest Response', description: 'Playbook-based suggestions', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'objection_response_suggestion' },
      { id: 'objection_output_price', type: 'output', label: 'Price', description: 'Pricing concern', icon: '💰', color: FLOW_COLORS.error },
      { id: 'objection_output_timing', type: 'output', label: 'Timing', description: 'Not right time', icon: '⏰', color: FLOW_COLORS.warning },
      { id: 'objection_output_competition', type: 'output', label: 'Competition', description: 'Comparing competitor', icon: '⚔️', color: FLOW_COLORS.error },
      { id: 'objection_output_playbook', type: 'output', label: 'Playbook', description: 'Talking points for rep', icon: '📖', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'od1', from: 'objection_input_call', to: 'objection_worker', style: 'solid' },
      { id: 'od2', from: 'objection_input_email', to: 'objection_worker', style: 'solid' },
      { id: 'od3', from: 'objection_worker', to: 'prompt_detect_objections', style: 'solid' },
      { id: 'od4', from: 'prompt_detect_objections', to: 'objection_type_router', style: 'solid' },
      { id: 'od5', from: 'objection_type_router', to: 'objection_output_price', style: 'dashed', label: 'Price' },
      { id: 'od6', from: 'objection_type_router', to: 'objection_output_timing', style: 'dashed', label: 'Timing' },
      { id: 'od7', from: 'objection_type_router', to: 'objection_output_competition', style: 'dashed', label: 'Competitor' },
      { id: 'od8', from: 'objection_type_router', to: 'prompt_objection_response', style: 'solid' },
      { id: 'od9', from: 'prompt_objection_response', to: 'objection_output_playbook', style: 'solid' },
    ],
  },
  {
    id: 'sentiment_analysis',
    label: 'Sentiment Analysis',
    description: 'Analyzes call/meeting sentiment for deal health',
    icon: '😊',
    color: FLOW_COLORS.worker,
    category: 'intelligence',
    nodes: [
      { id: 'sentiment_input', type: 'trigger', label: 'Transcript Ready', description: 'Ready for analysis', icon: '🎙️', color: FLOW_COLORS.trigger },
      { id: 'sentiment_worker', type: 'worker', label: 'Sentiment Analyzer', description: 'Processes sentiment', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/sentimentAnalyzer.ts' },
      { id: 'prompt_analyze_sentiment', type: 'prompt', label: 'Analyze Sentiment', description: 'Overall sentiment + key moments', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'analyze_sentiment' },
      { id: 'sentiment_score_check', type: 'condition', label: 'Score', description: 'Route by level', icon: '📊', color: FLOW_COLORS.condition },
      { id: 'sentiment_output_positive', type: 'output', label: 'Positive', description: 'Buying signal', icon: '😊', color: FLOW_COLORS.success },
      { id: 'sentiment_output_neutral', type: 'output', label: 'Neutral', description: 'Normal flow', icon: '😐', color: FLOW_COLORS.output },
      { id: 'sentiment_output_negative', type: 'output', label: 'Negative', description: 'Alert rep', icon: '😟', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'sa1', from: 'sentiment_input', to: 'sentiment_worker', style: 'solid' },
      { id: 'sa2', from: 'sentiment_worker', to: 'prompt_analyze_sentiment', style: 'solid' },
      { id: 'sa3', from: 'prompt_analyze_sentiment', to: 'sentiment_score_check', style: 'solid' },
      { id: 'sa4', from: 'sentiment_score_check', to: 'sentiment_output_positive', style: 'dashed', label: '> 0.6' },
      { id: 'sa5', from: 'sentiment_score_check', to: 'sentiment_output_neutral', style: 'dashed', label: '0.4-0.6' },
      { id: 'sa6', from: 'sentiment_score_check', to: 'sentiment_output_negative', style: 'dashed', label: '< 0.4', color: FLOW_COLORS.error },
    ],
  },
  {
    id: 'health_score',
    label: 'Health Score Calculation',
    description: 'Calculates customer/deal health from signals',
    icon: '💚',
    color: FLOW_COLORS.worker,
    category: 'intelligence',
    nodes: [
      { id: 'health_cron', type: 'trigger', label: 'Daily Cron', description: 'Recalculates all scores', icon: '⏰', color: FLOW_COLORS.trigger },
      { id: 'health_event', type: 'trigger', label: 'Signal Event', description: 'New engagement signal', icon: '📡', color: FLOW_COLORS.trigger },
      { id: 'health_worker', type: 'worker', label: 'Health Calculator', description: 'Aggregates signals', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/lifecycle/healthScore.ts' },
      { id: 'prompt_calculate_health', type: 'prompt', label: 'Calculate Score', description: 'Weighs signals → health', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'calculate_health_score' },
      { id: 'health_level_check', type: 'condition', label: 'Health Level', description: 'Route by score', icon: '🚦', color: FLOW_COLORS.condition },
      { id: 'health_output_healthy', type: 'output', label: 'Healthy', description: '80-100: Thriving', icon: '🟢', color: FLOW_COLORS.success },
      { id: 'health_output_at_risk', type: 'output', label: 'At Risk', description: '50-79: Needs attention', icon: '🟡', color: FLOW_COLORS.warning },
      { id: 'health_output_critical', type: 'output', label: 'Critical', description: '<50: Immediate action', icon: '🔴', color: FLOW_COLORS.error },
    ],
    connections: [
      { id: 'hs1', from: 'health_cron', to: 'health_worker', style: 'solid' },
      { id: 'hs2', from: 'health_event', to: 'health_worker', style: 'solid' },
      { id: 'hs3', from: 'health_worker', to: 'prompt_calculate_health', style: 'solid' },
      { id: 'hs4', from: 'prompt_calculate_health', to: 'health_level_check', style: 'solid' },
      { id: 'hs5', from: 'health_level_check', to: 'health_output_healthy', style: 'dashed', label: '80+' },
      { id: 'hs6', from: 'health_level_check', to: 'health_output_at_risk', style: 'dashed', label: '50-79' },
      { id: 'hs7', from: 'health_level_check', to: 'health_output_critical', style: 'dashed', label: '<50', color: FLOW_COLORS.error },
    ],
  },

  // ==================== LIFECYCLE ====================
  {
    id: 'lead_scoring',
    label: 'Lead Qualification',
    description: 'Scores and qualifies new leads',
    icon: '🎯',
    color: FLOW_COLORS.worker,
    category: 'lifecycle',
    nodes: [
      { id: 'lead_input_new', type: 'trigger', label: 'New Lead', description: 'From form, import, referral', icon: '📥', color: FLOW_COLORS.trigger },
      { id: 'lead_worker', type: 'worker', label: 'Lead Scorer', description: 'Evaluates lead quality', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/leadScorer.ts' },
      { id: 'prompt_score_lead', type: 'prompt', label: 'Score Lead', description: 'Calculates 0-100 score', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'score_lead' },
      { id: 'lead_score_router', type: 'condition', label: 'Score Router', description: 'Route by score', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'lead_output_hot', type: 'output', label: 'Hot Lead', description: '80+: Fast track', icon: '🔥', color: FLOW_COLORS.error },
      { id: 'lead_output_warm', type: 'output', label: 'Warm Lead', description: '50-79: Normal flow', icon: '🌡️', color: FLOW_COLORS.warning },
      { id: 'lead_output_cold', type: 'output', label: 'Cold Lead', description: '<50: Nurture', icon: '❄️', color: FLOW_COLORS.output },
      { id: 'lead_output_notify', type: 'output', label: 'Notify Rep', description: 'Alert on hot lead', icon: '🔔', color: FLOW_COLORS.success },
    ],
    connections: [
      { id: 'ls1', from: 'lead_input_new', to: 'lead_worker', style: 'solid' },
      { id: 'ls2', from: 'lead_worker', to: 'prompt_score_lead', style: 'solid' },
      { id: 'ls3', from: 'prompt_score_lead', to: 'lead_score_router', style: 'solid' },
      { id: 'ls4', from: 'lead_score_router', to: 'lead_output_hot', style: 'dashed', label: '80+' },
      { id: 'ls5', from: 'lead_score_router', to: 'lead_output_warm', style: 'dashed', label: '50-79' },
      { id: 'ls6', from: 'lead_score_router', to: 'lead_output_cold', style: 'dashed', label: '<50' },
      { id: 'ls7', from: 'lead_output_hot', to: 'lead_output_notify', style: 'solid' },
    ],
  },
  {
    id: 'win_loss_analysis',
    label: 'Win/Loss Analysis',
    description: 'Analyzes closed deals for patterns',
    icon: '📊',
    color: FLOW_COLORS.worker,
    category: 'lifecycle',
    nodes: [
      { id: 'winloss_deal_closed', type: 'trigger', label: 'Deal Closed', description: 'Won or lost', icon: '🏁', color: FLOW_COLORS.trigger },
      { id: 'winloss_worker', type: 'worker', label: 'Analysis Worker', description: 'Gathers history', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/winLossAnalysis.ts' },
      { id: 'winloss_outcome_check', type: 'condition', label: 'Outcome', description: 'Won or lost?', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'prompt_analyze_win', type: 'prompt', label: 'Analyze Win', description: 'Extract winning patterns', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'analyze_deal_win' },
      { id: 'prompt_analyze_loss', type: 'prompt', label: 'Analyze Loss', description: 'Identify loss reasons', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'analyze_deal_loss' },
      { id: 'winloss_output_won', type: 'output', label: 'Won Analysis', description: 'Success factors', icon: '🏆', color: FLOW_COLORS.success },
      { id: 'winloss_output_lost', type: 'output', label: 'Lost Analysis', description: 'Loss reasons', icon: '❌', color: FLOW_COLORS.error },
      { id: 'winloss_output_playbook', type: 'output', label: 'Update Playbook', description: 'Add learnings', icon: '📖', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'wl1', from: 'winloss_deal_closed', to: 'winloss_worker', style: 'solid' },
      { id: 'wl2', from: 'winloss_worker', to: 'winloss_outcome_check', style: 'solid' },
      { id: 'wl3', from: 'winloss_outcome_check', to: 'prompt_analyze_win', style: 'solid', label: 'Won' },
      { id: 'wl4', from: 'winloss_outcome_check', to: 'prompt_analyze_loss', style: 'solid', label: 'Lost' },
      { id: 'wl5', from: 'prompt_analyze_win', to: 'winloss_output_won', style: 'solid' },
      { id: 'wl6', from: 'prompt_analyze_loss', to: 'winloss_output_lost', style: 'solid' },
      { id: 'wl7', from: 'winloss_output_won', to: 'winloss_output_playbook', style: 'dashed' },
    ],
  },
  {
    id: 'workflow_ai_actions',
    label: 'Workflow AI Actions',
    description: 'AI actions from workflow stage transitions',
    icon: '⚡',
    color: FLOW_COLORS.worker,
    category: 'lifecycle',
    nodes: [
      { id: 'workflow_stage_change', type: 'trigger', label: 'Stage Change', description: 'Entity moves stage', icon: '➡️', color: FLOW_COLORS.trigger },
      { id: 'workflow_time_trigger', type: 'trigger', label: 'Time in Stage', description: 'X days in stage', icon: '⏰', color: FLOW_COLORS.trigger },
      { id: 'workflow_engine', type: 'worker', label: 'Workflow Engine', description: 'Evaluates rules', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/workflow/engine.ts' },
      { id: 'workflow_action_router', type: 'condition', label: 'Action Type', description: 'Which AI action?', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'prompt_ai_followup', type: 'prompt', label: 'AI Follow-up', description: 'Stage-appropriate email', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'workflow_ai_followup' },
      { id: 'prompt_ai_analysis', type: 'prompt', label: 'AI Analysis', description: 'Deal health analysis', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'workflow_ai_analysis' },
      { id: 'prompt_ai_nurture', type: 'prompt', label: 'AI Nurture', description: 'Long-term nurture', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'workflow_ai_nurture' },
      { id: 'workflow_output_email', type: 'output', label: 'Email Queued', description: 'Ready to send', icon: '📧', color: FLOW_COLORS.output },
      { id: 'workflow_output_insight', type: 'output', label: 'Insight Logged', description: 'Added to deal', icon: '💡', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'wa1', from: 'workflow_stage_change', to: 'workflow_engine', style: 'solid' },
      { id: 'wa2', from: 'workflow_time_trigger', to: 'workflow_engine', style: 'solid' },
      { id: 'wa3', from: 'workflow_engine', to: 'workflow_action_router', style: 'solid' },
      { id: 'wa4', from: 'workflow_action_router', to: 'prompt_ai_followup', style: 'dashed', label: 'Follow-up' },
      { id: 'wa5', from: 'workflow_action_router', to: 'prompt_ai_analysis', style: 'dashed', label: 'Analyze' },
      { id: 'wa6', from: 'workflow_action_router', to: 'prompt_ai_nurture', style: 'dashed', label: 'Nurture' },
      { id: 'wa7', from: 'prompt_ai_followup', to: 'workflow_output_email', style: 'solid' },
      { id: 'wa8', from: 'prompt_ai_analysis', to: 'workflow_output_insight', style: 'solid' },
      { id: 'wa9', from: 'prompt_ai_nurture', to: 'workflow_output_email', style: 'solid' },
    ],
  },

  // ==================== REALTIME ====================
  {
    id: 'daily_intelligence',
    label: 'Daily Intelligence',
    description: 'Generates daily briefings and meeting prep',
    icon: '📊',
    color: FLOW_COLORS.worker,
    category: 'realtime',
    nodes: [
      { id: 'daily_morning_cron', type: 'trigger', label: 'Morning Cron', description: '6 AM briefing prep', icon: '🌅', color: FLOW_COLORS.trigger },
      { id: 'daily_user_request', type: 'trigger', label: 'User Request', description: 'Via Daily Driver', icon: '👆', color: FLOW_COLORS.trigger },
      { id: 'daily_worker', type: 'worker', label: 'Daily Intelligence', description: 'Aggregates data', icon: '🤖', color: FLOW_COLORS.worker, sourceFile: 'src/lib/intelligence/dailyIntelligence.ts' },
      { id: 'prompt_daily_briefing', type: 'prompt', label: 'Daily Briefing', description: 'Personalized summary', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'daily_briefing' },
      { id: 'prompt_meeting_prep', type: 'prompt', label: 'Meeting Prep', description: 'Briefing for meetings', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'meeting_prep' },
      { id: 'daily_output_briefing', type: 'output', label: 'Briefing Ready', description: 'Displayed to user', icon: '📋', color: FLOW_COLORS.output },
      { id: 'daily_output_prep', type: 'output', label: 'Prep Ready', description: 'Meeting prep cards', icon: '🎯', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'di1', from: 'daily_morning_cron', to: 'daily_worker', style: 'solid' },
      { id: 'di2', from: 'daily_user_request', to: 'daily_worker', style: 'solid' },
      { id: 'di3', from: 'daily_worker', to: 'prompt_daily_briefing', style: 'solid' },
      { id: 'di4', from: 'daily_worker', to: 'prompt_meeting_prep', style: 'solid', label: 'Each meeting' },
      { id: 'di5', from: 'prompt_daily_briefing', to: 'daily_output_briefing', style: 'solid' },
      { id: 'di6', from: 'prompt_meeting_prep', to: 'daily_output_prep', style: 'solid' },
    ],
  },
  {
    id: 'command_center',
    label: 'Command Center',
    description: 'AI-powered natural language commands',
    icon: '🎮',
    color: FLOW_COLORS.worker,
    category: 'realtime',
    nodes: [
      { id: 'cmd_user_input', type: 'trigger', label: 'User Command', description: 'Natural language input', icon: '💬', color: FLOW_COLORS.trigger },
      { id: 'cmd_context_builder', type: 'worker', label: 'Context Builder', description: 'Rich context from DB', icon: '🔧', color: FLOW_COLORS.worker, sourceFile: 'src/lib/commandCenter/contextBuilder.ts' },
      { id: 'prompt_core_system', type: 'prompt', label: 'Core System', description: 'Base system prompt', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'core_system' },
      { id: 'prompt_command_interpret', type: 'prompt', label: 'Interpret Command', description: 'Extract intent/actions', icon: '✨', color: FLOW_COLORS.prompt, promptKey: 'command_interpret' },
      { id: 'cmd_action_router', type: 'condition', label: 'Action Router', description: 'Route to handler', icon: '🔀', color: FLOW_COLORS.condition },
      { id: 'cmd_output_response', type: 'output', label: 'AI Response', description: 'Displayed to user', icon: '💭', color: FLOW_COLORS.output },
      { id: 'cmd_output_action', type: 'output', label: 'Action Done', description: 'Action performed', icon: '⚡', color: FLOW_COLORS.output },
    ],
    connections: [
      { id: 'cc1', from: 'cmd_user_input', to: 'cmd_context_builder', style: 'solid' },
      { id: 'cc2', from: 'cmd_context_builder', to: 'prompt_core_system', style: 'dashed', label: 'System prompt' },
      { id: 'cc3', from: 'cmd_context_builder', to: 'prompt_command_interpret', style: 'solid' },
      { id: 'cc4', from: 'prompt_command_interpret', to: 'cmd_action_router', style: 'solid' },
      { id: 'cc5', from: 'cmd_action_router', to: 'cmd_output_response', style: 'solid', label: 'Info' },
      { id: 'cc6', from: 'cmd_action_router', to: 'cmd_output_action', style: 'dashed', label: 'Action' },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAllPromptKeys(): string[] {
  const keys = new Set<string>();
  for (const group of AI_FLOW_GROUPS) {
    for (const node of group.nodes) {
      if (node.promptKey) {
        keys.add(node.promptKey);
      }
    }
  }
  return Array.from(keys);
}

export function findGroupsUsingPrompt(promptKey: string): FlowGroup[] {
  return AI_FLOW_GROUPS.filter(group =>
    group.nodes.some(node => node.promptKey === promptKey)
  );
}

export function getNodeForPrompt(promptKey: string): { group: FlowGroup; node: FlowNode } | null {
  for (const group of AI_FLOW_GROUPS) {
    const node = group.nodes.find(n => n.promptKey === promptKey);
    if (node) {
      return { group, node };
    }
  }
  return null;
}

export function getNodesByType(type: FlowNodeType): Array<{ group: FlowGroup; node: FlowNode }> {
  const results: Array<{ group: FlowGroup; node: FlowNode }> = [];
  for (const group of AI_FLOW_GROUPS) {
    for (const node of group.nodes) {
      if (node.type === type) {
        results.push({ group, node });
      }
    }
  }
  return results;
}

export function getGroupsByCategory(category: FlowCategory): FlowGroup[] {
  return AI_FLOW_GROUPS.filter(group => group.category === category);
}

export function getCategoryCounts(): Record<FlowCategory, number> {
  const counts: Record<FlowCategory, number> = {
    autopilot: 0,
    intelligence: 0,
    communication: 0,
    lifecycle: 0,
    realtime: 0,
  };
  for (const group of AI_FLOW_GROUPS) {
    counts[group.category]++;
  }
  return counts;
}

export function getFlowStats() {
  let totalNodes = 0;
  let totalConnections = 0;
  const promptKeys: string[] = [];

  for (const group of AI_FLOW_GROUPS) {
    totalNodes += group.nodes.length;
    totalConnections += group.connections.length;
    for (const node of group.nodes) {
      if (node.promptKey) {
        promptKeys.push(node.promptKey);
      }
    }
  }

  return {
    totalGroups: AI_FLOW_GROUPS.length,
    totalNodes,
    totalConnections,
    totalPrompts: promptKeys.length,
    promptKeys,
    categoryCounts: getCategoryCounts(),
  };
}
