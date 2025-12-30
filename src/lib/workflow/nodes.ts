/**
 * Workflow Node Definitions
 *
 * Process-specific nodes for each workflow type
 */

import { ProcessType, NodeType, NodeItem } from './types';

// Process-specific node definitions
export const PROCESS_NODES: Record<ProcessType, {
  triggers: NodeItem[];
  stages: NodeItem[];
  conditions: NodeItem[];
  aiActions: NodeItem[];
  exits: NodeItem[];
}> = {
  sales: {
    triggers: [
      { id: 'new_lead', label: 'New Lead Created', icon: '📥', description: 'When a new lead enters the system' },
      { id: 'form_submit', label: 'Form Submitted', icon: '📝', description: 'When a prospect submits a form' },
      { id: 'call_complete', label: 'Call Completed', icon: '📞', description: 'After a sales call ends' },
      { id: 'email_replied', label: 'Email Replied', icon: '📧', description: 'When prospect replies to email' },
      { id: 'meeting_complete', label: 'Meeting Completed', icon: '🤝', description: 'After a meeting ends' },
      { id: 'trial_started', label: 'Trial Started', icon: '🚀', description: 'When prospect starts a trial' },
    ],
    stages: [
      { id: 'engaging', label: 'Actively Engaging', icon: '1' },
      { id: 'demo_scheduled', label: 'Demo Scheduled', icon: '2' },
      { id: 'demo_complete', label: 'Demo Complete', icon: '3' },
      { id: 'trial', label: 'Trial', icon: '4' },
      { id: 'proposal', label: 'Proposal', icon: '5' },
      { id: 'negotiation', label: 'Negotiation', icon: '6' },
    ],
    conditions: [
      { id: 'lead_score', label: 'Lead Score Check', icon: '📊', description: 'Route based on lead score' },
      { id: 'company_size', label: 'Company Size', icon: '🏢', description: 'Route by employee count' },
      { id: 'response_time', label: 'Response Time', icon: '⏱️', description: 'Time since last response' },
      { id: 'decision_maker', label: 'Decision Maker?', icon: '👔', description: 'Check contact role' },
    ],
    aiActions: [
      { id: 'ai_scheduler', label: 'AI Scheduler', icon: '📅', description: 'Auto-schedule meetings' },
      { id: 'ai_followup', label: 'AI Follow-up', icon: '📧', description: 'Send personalized follow-up' },
      { id: 'ai_objection', label: 'AI Objection Handler', icon: '🛡️', description: 'Handle objections' },
      { id: 'ai_analysis', label: 'AI Call Analysis', icon: '🎯', description: 'Analyze call transcripts' },
    ],
    exits: [
      { id: 'won', label: 'Closed Won', icon: '🎉', color: '#10b981' },
      { id: 'lost', label: 'Closed Lost', icon: '📉', color: '#ef4444' },
      { id: 'disqualified', label: 'Disqualified', icon: '🚫', color: '#ef4444' },
      { id: 'nurture', label: 'Send to Nurture', icon: '🌱', color: '#f97316' },
    ],
  },

  onboarding: {
    triggers: [
      { id: 'contract_signed', label: 'Contract Signed', icon: '✍️', description: 'When contract is executed' },
      { id: 'account_created', label: 'Account Created', icon: '👤', description: 'When account is provisioned' },
      { id: 'first_login', label: 'First Login', icon: '🔑', description: 'User logs in first time' },
      { id: 'integration_connected', label: 'Integration Connected', icon: '🔗', description: 'External system linked' },
      { id: 'milestone_completed', label: 'Milestone Completed', icon: '✅', description: 'When a milestone is done' },
    ],
    stages: [
      { id: 'welcome', label: 'Welcome / Kickoff', icon: '1' },
      { id: 'technical_setup', label: 'Technical Setup', icon: '2' },
      { id: 'training_scheduled', label: 'Training Scheduled', icon: '3' },
      { id: 'training_complete', label: 'Training Complete', icon: '4' },
      { id: 'go_live', label: 'Go-Live', icon: '5' },
      { id: 'adoption_review', label: 'Adoption Review', icon: '6' },
    ],
    conditions: [
      { id: 'integration_count', label: 'Integrations Connected', icon: '🔗', description: 'Number of integrations' },
      { id: 'user_count', label: 'Active Users', icon: '👥', description: 'Users who logged in' },
      { id: 'days_since_start', label: 'Days Since Start', icon: '📅', description: 'Time elapsed' },
      { id: 'completion_rate', label: 'Setup Completion', icon: '📊', description: 'Setup progress %' },
    ],
    aiActions: [
      { id: 'ai_training_rec', label: 'AI Training Recommendation', icon: '📚', description: 'Suggest next training' },
      { id: 'ai_setup_assist', label: 'AI Setup Assistant', icon: '🔧', description: 'Guide configuration' },
      { id: 'ai_health_check', label: 'AI Health Check', icon: '💊', description: 'Assess progress' },
    ],
    exits: [
      { id: 'onboarded', label: 'Successfully Onboarded', icon: '🎉', color: '#10b981' },
      { id: 'stalled', label: 'Onboarding Stalled', icon: '⏸️', color: '#f97316' },
      { id: 'churned', label: 'Churned During Onboarding', icon: '📉', color: '#ef4444' },
      { id: 'fast_track', label: 'Fast-Track Complete', icon: '⚡', color: '#10b981' },
    ],
  },

  support: {
    triggers: [
      { id: 'ticket_created', label: 'Ticket Created', icon: '🎫', description: 'New support ticket' },
      { id: 'severity_changed', label: 'Severity Changed', icon: '⚠️', description: 'Priority escalated' },
      { id: 'sla_warning', label: 'SLA Warning', icon: '⏰', description: '75% time elapsed' },
      { id: 'sla_breach', label: 'SLA Breach', icon: '🚨', description: 'SLA time exceeded' },
      { id: 'customer_replied', label: 'Customer Replied', icon: '💬', description: 'New customer message' },
      { id: 'escalation_requested', label: 'Escalation Requested', icon: '📢', description: 'Manual escalation' },
    ],
    stages: [
      { id: 'triage', label: 'New / Triage', icon: '1' },
      { id: 'assigned', label: 'Assigned', icon: '2' },
      { id: 'in_progress', label: 'In Progress', icon: '3' },
      { id: 'waiting_customer', label: 'Waiting on Customer', icon: '4' },
      { id: 'waiting_internal', label: 'Waiting on Internal', icon: '5' },
      { id: 'pending_resolution', label: 'Pending Resolution', icon: '6' },
    ],
    conditions: [
      { id: 'severity', label: 'Severity Level', icon: '🔴', description: 'P1/P2/P3/P4 check' },
      { id: 'customer_tier', label: 'Customer Tier', icon: '⭐', description: 'Enterprise/Mid/SMB' },
      { id: 'issue_category', label: 'Issue Category', icon: '📁', description: 'Type of issue' },
      { id: 'sla_status', label: 'SLA Status', icon: '⏱️', description: 'Time remaining' },
    ],
    aiActions: [
      { id: 'ai_classifier', label: 'AI Ticket Classifier', icon: '🏷️', description: 'Auto-categorize tickets' },
      { id: 'ai_solution', label: 'AI Solution Suggester', icon: '💡', description: 'Suggest solutions' },
      { id: 'ai_response', label: 'AI Response Drafter', icon: '✍️', description: 'Draft replies' },
      { id: 'ai_escalation', label: 'AI Escalation Predictor', icon: '📈', description: 'Predict escalations' },
    ],
    exits: [
      { id: 'resolved', label: 'Resolved', icon: '✅', color: '#10b981' },
      { id: 'closed_no_response', label: 'Closed - No Response', icon: '🔇', color: '#6b7280' },
      { id: 'escalated', label: 'Escalated to Engineering', icon: '👨‍💻', color: '#f97316' },
      { id: 'duplicate', label: 'Merged / Duplicate', icon: '🔗', color: '#6b7280' },
    ],
  },

  engagement: {
    triggers: [
      { id: 'health_changed', label: 'Health Score Changed', icon: '💓', description: 'Score increased/decreased' },
      { id: 'usage_dropped', label: 'Usage Dropped', icon: '📉', description: 'Week-over-week decline' },
      { id: 'nps_received', label: 'NPS Response Received', icon: '📊', description: 'Customer rated NPS' },
      { id: 'renewal_approaching', label: 'Renewal Approaching', icon: '📅', description: '30/60/90 day warning' },
      { id: 'tickets_spike', label: 'Support Tickets Spike', icon: '🎫', description: 'Unusual ticket volume' },
      { id: 'champion_left', label: 'Champion Left Company', icon: '👋', description: 'Key contact departed' },
      { id: 'expansion_opportunity', label: 'Expansion Opportunity', icon: '🚀', description: 'Upsell signal detected' },
    ],
    stages: [
      { id: 'monitoring', label: 'Monitoring', icon: '👁️' },
      { id: 'at_risk', label: 'At Risk Identified', icon: '⚠️' },
      { id: 'intervention', label: 'Intervention Active', icon: '🩹' },
      { id: 'stabilizing', label: 'Stabilizing', icon: '📈' },
      { id: 'expansion', label: 'Expansion Discussion', icon: '💰' },
      { id: 'renewal', label: 'Renewal Negotiation', icon: '📝' },
    ],
    conditions: [
      { id: 'health_score', label: 'Health Score Range', icon: '💓', description: 'Check health level' },
      { id: 'days_to_renewal', label: 'Days Until Renewal', icon: '📅', description: 'Time to renewal' },
      { id: 'usage_trend', label: 'Usage Trend', icon: '📊', description: 'Up/down/stable' },
      { id: 'nps_score', label: 'NPS Score', icon: '⭐', description: 'Customer satisfaction' },
    ],
    aiActions: [
      { id: 'ai_churn_predictor', label: 'AI Churn Predictor', icon: '🔮', description: 'Predict churn risk' },
      { id: 'ai_expansion', label: 'AI Expansion Identifier', icon: '🎯', description: 'Find upsell opportunities' },
      { id: 'ai_health_calc', label: 'AI Health Calculator', icon: '💊', description: 'Calculate health score' },
      { id: 'ai_winback', label: 'AI Win-Back Campaign', icon: '🔄', description: 'Re-engage at-risk' },
    ],
    exits: [
      { id: 'renewed', label: 'Renewed', icon: '🎉', color: '#10b981' },
      { id: 'expanded', label: 'Expanded', icon: '📈', color: '#10b981' },
      { id: 'churned', label: 'Churned', icon: '📉', color: '#ef4444' },
      { id: 'downgraded', label: 'Downgraded', icon: '📉', color: '#f97316' },
      { id: 'saved', label: 'Saved (was at-risk)', icon: '💪', color: '#10b981' },
    ],
  },
};

// Common nodes available to all process types
export const COMMON_NODES: {
  conditions: NodeItem[];
  humanActions: NodeItem[];
  aiActions: NodeItem[];
} = {
  conditions: [
    { id: 'time_in_stage', label: 'Time in Stage', icon: '⏱️', description: 'Days/hours in current stage' },
    { id: 'custom_field', label: 'Custom Field Check', icon: '📋', description: 'Check any field value' },
    { id: 'tag_check', label: 'Tag Check', icon: '🏷️', description: 'Check for specific tags' },
  ],
  humanActions: [
    { id: 'create_task', label: 'Create Task', icon: '✅', description: 'Assign a task to team' },
    { id: 'send_notification', label: 'Send Notification', icon: '🔔', description: 'Alert team members' },
    { id: 'assign_user', label: 'Assign to User', icon: '👤', description: 'Assign ownership' },
    { id: 'send_email', label: 'Send Email Template', icon: '📧', description: 'Send templated email' },
    { id: 'add_tag', label: 'Add Tag', icon: '🏷️', description: 'Apply a tag' },
  ],
  aiActions: [
    { id: 'ai_followup_common', label: 'AI Follow-up', icon: '📧', description: 'Smart follow-up email' },
    { id: 'ai_summary', label: 'AI Summary', icon: '📝', description: 'Generate summary' },
    { id: 'ai_sentiment', label: 'AI Sentiment Analysis', icon: '😊', description: 'Analyze sentiment' },
  ],
};

// Get all nodes for a process type (combines process-specific with common)
export function getNodesForProcessType(processType: ProcessType) {
  const specific = PROCESS_NODES[processType];
  return {
    triggers: specific.triggers,
    stages: specific.stages,
    conditions: [...specific.conditions, ...COMMON_NODES.conditions],
    aiActions: [...specific.aiActions, ...COMMON_NODES.aiActions],
    humanActions: COMMON_NODES.humanActions,
    exits: specific.exits,
  };
}

// Get a specific node item by type and id
export function getNodeItem(processType: ProcessType, nodeType: NodeType, itemId: string): NodeItem | undefined {
  const nodes = getNodesForProcessType(processType);

  switch (nodeType) {
    case 'trigger':
      return nodes.triggers.find(n => n.id === itemId);
    case 'stage':
      return nodes.stages.find(n => n.id === itemId);
    case 'condition':
      return nodes.conditions.find(n => n.id === itemId);
    case 'aiAction':
      return nodes.aiActions.find(n => n.id === itemId);
    case 'humanAction':
      return nodes.humanActions.find(n => n.id === itemId);
    case 'exit':
      return nodes.exits.find(n => n.id === itemId);
    default:
      return undefined;
  }
}
