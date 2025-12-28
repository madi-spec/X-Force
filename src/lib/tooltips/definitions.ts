/**
 * Info Tooltip Definitions
 * Comprehensive definitions for metrics, terms, and features across the platform
 */

export interface TooltipDefinition {
  title: string;
  description: string;
  formula?: string;
  example?: string;
  thresholds?: Array<{ label: string; value: string; color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }>;
  notes?: string[];
}

export const tooltipDefinitions: Record<string, TooltipDefinition> = {
  // ============================================
  // PIPELINE & DEAL METRICS
  // ============================================

  pipeline_value: {
    title: 'Pipeline Value',
    description: 'Total potential revenue from all active deals in the pipeline.',
    formula: 'Sum of all deal values (excluding Closed Won/Lost)',
    example: '10 deals × $50K avg = $500K pipeline',
  },

  weighted_pipeline: {
    title: 'Weighted Pipeline',
    description: 'Pipeline value adjusted by probability of each deal closing based on stage.',
    formula: 'Σ (Deal Value × Stage Probability)',
    example: '$100K at Proposal (60%) = $60K weighted',
    thresholds: [
      { label: 'New Lead', value: '10%', color: 'gray' },
      { label: 'Discovery', value: '20%', color: 'gray' },
      { label: 'Qualification', value: '40%', color: 'yellow' },
      { label: 'Demo', value: '50%', color: 'yellow' },
      { label: 'Proposal', value: '60%', color: 'blue' },
      { label: 'Negotiation', value: '80%', color: 'blue' },
      { label: 'Verbal Commit', value: '90%', color: 'green' },
    ],
  },

  win_rate: {
    title: 'Win Rate',
    description: 'Percentage of closed deals that were won vs lost.',
    formula: 'Closed Won ÷ (Closed Won + Closed Lost) × 100',
    example: '8 won ÷ 10 closed = 80% win rate',
  },

  deal_health_score: {
    title: 'Deal Health Score',
    description: 'AI-calculated score indicating the likelihood of a deal closing successfully.',
    formula: 'Engagement (25%) + Velocity (20%) + Stakeholders (15%) + Activity (15%) + Competitor Risk (10%) + Trial (15%)',
    thresholds: [
      { label: 'Healthy', value: '70-100', color: 'green' },
      { label: 'Needs Attention', value: '40-69', color: 'yellow' },
      { label: 'At Risk', value: '0-39', color: 'red' },
    ],
  },

  average_deal_size: {
    title: 'Average Deal Size',
    description: 'Mean value of closed-won deals.',
    formula: 'Total Closed Won Revenue ÷ Number of Closed Won Deals',
  },

  sales_cycle: {
    title: 'Sales Cycle',
    description: 'Average time from deal creation to close.',
    formula: 'Avg days from Created → Closed Won',
    notes: ['Excludes deals closed within 24 hours (likely data imports)'],
  },

  stage_velocity: {
    title: 'Stage Velocity',
    description: 'Average time deals spend in each stage before advancing.',
    notes: ['Helps identify bottlenecks in the sales process'],
  },

  forecast_accuracy: {
    title: 'Forecast Accuracy',
    description: 'How close forecasted revenue matches actual closed revenue.',
    formula: 'Actual ÷ Forecasted × 100',
    thresholds: [
      { label: 'Accurate', value: '90-110%', color: 'green' },
      { label: 'Acceptable', value: '80-120%', color: 'yellow' },
      { label: 'Needs Improvement', value: '<80% or >120%', color: 'red' },
    ],
  },

  // ============================================
  // DEAL STAGES
  // ============================================

  stage_new_lead: {
    title: 'New Lead',
    description: 'Initial contact made. Prospect has shown interest but not yet qualified.',
    notes: ['Target: Move to Discovery within 48 hours'],
  },

  stage_discovery: {
    title: 'Discovery',
    description: 'Understanding the prospect\'s needs, pain points, and current situation.',
    notes: ['Key questions: Current solution, pain points, timeline, budget range'],
  },

  stage_qualification: {
    title: 'Qualification',
    description: 'Confirming the prospect meets criteria: Budget, Authority, Need, Timeline (BANT).',
  },

  stage_demo: {
    title: 'Demo',
    description: 'Product demonstration scheduled or completed.',
    notes: ['Ensure decision-makers are present', 'Customize demo to their use case'],
  },

  stage_proposal: {
    title: 'Proposal',
    description: 'Formal proposal or quote has been sent to the prospect.',
    notes: ['Follow up within 48 hours if no response'],
  },

  stage_negotiation: {
    title: 'Negotiation',
    description: 'Active discussions on pricing, terms, or contract details.',
  },

  stage_verbal_commit: {
    title: 'Verbal Commit',
    description: 'Prospect has verbally agreed to move forward.',
    notes: ['Send contract within 24 hours', '90% close probability'],
  },

  // ============================================
  // SALES TERMINOLOGY
  // ============================================

  champion: {
    title: 'Champion',
    description: 'Internal advocate within the prospect organization who actively promotes your solution.',
    notes: ['Has influence but may not have budget authority', 'Keep them informed and equipped with materials'],
  },

  economic_buyer: {
    title: 'Economic Buyer',
    description: 'The person with budget authority who can approve the purchase.',
    notes: ['Critical to identify early', 'May be different from day-to-day contact'],
  },

  decision_maker: {
    title: 'Decision Maker',
    description: 'Person who makes the final decision on the purchase.',
    notes: ['May overlap with Economic Buyer', 'Ensure they see value before proposal'],
  },

  influencer: {
    title: 'Influencer',
    description: 'Someone who can affect the decision but doesn\'t make it directly.',
    notes: ['Often technical evaluators or team leads', 'Address their concerns early'],
  },

  // ============================================
  // REVENUE METRICS
  // ============================================

  arr: {
    title: 'ARR (Annual Recurring Revenue)',
    description: 'Total recurring revenue normalized to a one-year period.',
    formula: 'MRR × 12',
    notes: ['Excludes one-time fees', 'Key metric for SaaS businesses'],
  },

  mrr: {
    title: 'MRR (Monthly Recurring Revenue)',
    description: 'Predictable revenue received each month from subscriptions.',
    formula: 'Sum of all monthly subscription values',
  },

  acv: {
    title: 'ACV (Annual Contract Value)',
    description: 'Average annualized revenue per customer contract.',
    formula: 'Total Contract Value ÷ Contract Years',
    example: '$150K over 3 years = $50K ACV',
  },

  tcv: {
    title: 'TCV (Total Contract Value)',
    description: 'Full value of a contract over its entire term.',
    formula: 'Monthly Value × Contract Months + One-time Fees',
  },

  ltv: {
    title: 'LTV (Lifetime Value)',
    description: 'Total revenue expected from a customer over the entire relationship.',
    formula: 'ARPU × Average Customer Lifespan',
  },

  cac: {
    title: 'CAC (Customer Acquisition Cost)',
    description: 'Total cost to acquire a new customer.',
    formula: '(Sales + Marketing Costs) ÷ New Customers',
    notes: ['LTV:CAC ratio should be > 3:1'],
  },

  // ============================================
  // FORECASTING
  // ============================================

  forecast: {
    title: 'Forecast',
    description: 'Projected revenue expected to close within a period.',
    thresholds: [
      { label: 'Commit', value: '>90% probability', color: 'green' },
      { label: 'Best Case', value: '>70% probability', color: 'blue' },
      { label: 'Pipeline', value: '>40% probability', color: 'yellow' },
    ],
  },

  commit_forecast: {
    title: 'Commit Forecast',
    description: 'Deals with >90% probability that sales is confident will close.',
    notes: ['Used for executive reporting', 'Should be highly accurate'],
  },

  best_case_forecast: {
    title: 'Best Case Forecast',
    description: 'Deals with >70% probability - likely to close with favorable conditions.',
  },

  pipeline_forecast: {
    title: 'Pipeline Forecast',
    description: 'All deals with >40% probability - possible to close this period.',
  },

  // ============================================
  // AI FEATURES
  // ============================================

  ai_summary: {
    title: 'AI Summary',
    description: 'Automatically generated summary of key points from emails, calls, or meetings.',
    notes: ['Updated when new content is analyzed', 'Highlights action items and decisions'],
  },

  ai_signals: {
    title: 'AI Signals',
    description: 'Patterns detected by AI in communications that indicate deal status.',
    thresholds: [
      { label: 'Buying Signal', value: 'Interest, urgency, budget mentions', color: 'green' },
      { label: 'Objection', value: 'Price, timing, competitor concerns', color: 'yellow' },
      { label: 'Risk Signal', value: 'Delays, ghosting, stakeholder changes', color: 'red' },
      { label: 'Competitor Mention', value: 'References to alternatives', color: 'blue' },
    ],
  },

  ai_next_steps: {
    title: 'AI Next Steps',
    description: 'Recommended actions based on deal stage, activity, and signals.',
    notes: ['Prioritized by impact', 'Click to create as task'],
  },

  ai_insights: {
    title: 'AI Insights',
    description: 'Analysis and recommendations generated from your sales data.',
    notes: ['Updates daily', 'Based on patterns across all deals'],
  },

  // ============================================
  // EMAIL & INBOX
  // ============================================

  email_priority: {
    title: 'Email Priority',
    description: 'AI-determined importance level based on content and context.',
    thresholds: [
      { label: 'High', value: 'Decision maker, urgent, opportunity', color: 'red' },
      { label: 'Medium', value: 'Active deal, question, follow-up', color: 'yellow' },
      { label: 'Low', value: 'FYI, newsletter, automated', color: 'gray' },
    ],
  },

  link_confidence: {
    title: 'Link Confidence',
    description: 'How confident the system is about email-to-deal/company matching.',
    formula: 'Contact Match (40%) + Domain Match (35%) + Content Match (25%)',
    thresholds: [
      { label: 'Auto-linked', value: '>80%', color: 'green' },
      { label: 'Suggested', value: '60-80%', color: 'yellow' },
      { label: 'Manual Review', value: '<60%', color: 'gray' },
    ],
  },

  thread_status: {
    title: 'Thread Status',
    description: 'Current state of an email conversation.',
    thresholds: [
      { label: 'Pending', value: 'Needs your response', color: 'red' },
      { label: 'Awaiting Reply', value: 'Waiting for them', color: 'yellow' },
      { label: 'Snoozed', value: 'Hidden until later', color: 'blue' },
      { label: 'Processed', value: 'Handled, archived', color: 'green' },
      { label: 'Ignored', value: 'Not relevant', color: 'gray' },
    ],
  },

  draft_confidence: {
    title: 'Draft Confidence',
    description: 'AI confidence level in the generated email draft.',
    thresholds: [
      { label: 'High', value: 'Ready to send with minor review', color: 'green' },
      { label: 'Medium', value: 'Needs customization', color: 'yellow' },
      { label: 'Low', value: 'Significant editing needed', color: 'red' },
    ],
  },

  // ============================================
  // ACTION QUEUES (Inbox)
  // ============================================

  queue_respond: {
    title: 'Respond Queue',
    description: 'Emails that need your response. These are typically questions or requests from contacts.',
    notes: ['Prioritized by SLA and sender importance', 'Aim to respond within 24 hours'],
  },

  queue_follow_up: {
    title: 'Follow Up Queue',
    description: 'Emails where you\'re waiting for a response. Nudge if no reply after expected time.',
    notes: ['Check daily', 'Consider re-sending or calling after 3-5 days'],
  },

  queue_review: {
    title: 'Review Queue',
    description: 'AI-generated drafts and suggestions that need your approval before sending.',
    notes: ['Review for accuracy and tone', 'Edit as needed before sending'],
  },

  queue_drafts: {
    title: 'Drafts Queue',
    description: 'Emails you started writing but haven\'t sent yet.',
    notes: ['Complete or discard regularly', 'Don\'t let important drafts get stale'],
  },

  queue_fyi: {
    title: 'FYI Queue',
    description: 'Informational emails that don\'t require action. Auto-replies, newsletters, notifications.',
    notes: ['Quick scan for anything important', 'Archive after reviewing'],
  },

  // ============================================
  // SLA & TIMING
  // ============================================

  sla_status: {
    title: 'SLA Status',
    description: 'Whether response time meets service level agreement.',
    thresholds: [
      { label: 'On Track', value: 'Within SLA window', color: 'green' },
      { label: 'Warning', value: 'Approaching deadline', color: 'yellow' },
      { label: 'Overdue', value: 'Past SLA deadline', color: 'red' },
    ],
  },

  response_time: {
    title: 'Response Time',
    description: 'Average time to respond to incoming emails.',
    notes: ['Measured from receipt to first reply', 'Business hours only'],
  },

  last_activity: {
    title: 'Last Activity',
    description: 'Most recent interaction with this contact, company, or deal.',
    notes: ['Includes emails, calls, meetings, notes'],
  },

  days_in_stage: {
    title: 'Days in Stage',
    description: 'How long the deal has been in its current stage.',
    notes: ['Compare to average stage duration', 'Long duration may indicate stall'],
  },

  // ============================================
  // COMPANY & CONTACT
  // ============================================

  company_segment: {
    title: 'Company Segment',
    description: 'Size classification of the company.',
    thresholds: [
      { label: 'SMB', value: '1-5 agents, $5-15K ACV', color: 'gray' },
      { label: 'Mid-Market', value: '6-20 agents, $15-50K ACV', color: 'blue' },
      { label: 'Enterprise', value: '21-100 agents, $50-150K ACV', color: 'green' },
      { label: 'PE Platform', value: '100+ agents, $150K+ ACV', color: 'green' },
    ],
  },

  company_status: {
    title: 'Company Status',
    description: 'Current relationship status with the company.',
    thresholds: [
      { label: 'Prospect', value: 'Not yet a customer', color: 'gray' },
      { label: 'Active', value: 'Current customer', color: 'green' },
      { label: 'Churned', value: 'Former customer', color: 'red' },
      { label: 'Inactive', value: 'No recent activity', color: 'yellow' },
    ],
  },

  contact_role: {
    title: 'Contact Role',
    description: 'The contact\'s role in the buying process.',
    thresholds: [
      { label: 'Decision Maker', value: 'Final authority', color: 'green' },
      { label: 'Economic Buyer', value: 'Budget holder', color: 'green' },
      { label: 'Champion', value: 'Internal advocate', color: 'blue' },
      { label: 'Influencer', value: 'Can affect decision', color: 'yellow' },
      { label: 'End User', value: 'Will use the product', color: 'gray' },
    ],
  },

  // ============================================
  // RESEARCH & INTELLIGENCE
  // ============================================

  research_confidence: {
    title: 'Research Confidence',
    description: 'How confident the AI is in the research findings.',
    formula: 'Based on source quality, data consistency, and verification',
    thresholds: [
      { label: 'High', value: '80-100%', color: 'green' },
      { label: 'Medium', value: '60-79%', color: 'yellow' },
      { label: 'Low', value: '<60%', color: 'red' },
    ],
  },

  tech_stack: {
    title: 'Tech Stack',
    description: 'Technology platforms and tools used by the company.',
    notes: ['CRM, phone system, routing software', 'Helps identify integration needs'],
  },

  growth_signals: {
    title: 'Growth Signals',
    description: 'Indicators that suggest company is growing.',
    notes: ['Hiring, new locations, acquisitions', 'May indicate budget availability'],
  },

  // ============================================
  // MEETINGS & TRANSCRIPTIONS
  // ============================================

  meeting_sentiment: {
    title: 'Meeting Sentiment',
    description: 'Overall tone and feeling detected in the meeting.',
    thresholds: [
      { label: 'Positive', value: 'Enthusiasm, agreement', color: 'green' },
      { label: 'Neutral', value: 'Information exchange', color: 'gray' },
      { label: 'Negative', value: 'Concerns, objections', color: 'red' },
    ],
  },

  action_items: {
    title: 'Action Items',
    description: 'Tasks identified from meeting that need follow-up.',
    notes: ['Assigned to either party', 'Click to create as task'],
  },

  key_moments: {
    title: 'Key Moments',
    description: 'Important points in the conversation flagged by AI.',
    notes: ['Pricing discussions', 'Objections raised', 'Commitments made'],
  },

  // ============================================
  // TASKS
  // ============================================

  task_priority: {
    title: 'Task Priority',
    description: 'Urgency level of the task.',
    thresholds: [
      { label: 'Urgent', value: 'Do today', color: 'red' },
      { label: 'High', value: 'Do this week', color: 'yellow' },
      { label: 'Medium', value: 'Do soon', color: 'blue' },
      { label: 'Low', value: 'When possible', color: 'gray' },
    ],
  },

  task_source: {
    title: 'Task Source',
    description: 'Where the task originated from.',
    thresholds: [
      { label: 'AI Generated', value: 'From meeting/email analysis', color: 'blue' },
      { label: 'Manual', value: 'Created by user', color: 'gray' },
      { label: 'System', value: 'Automated reminder', color: 'yellow' },
    ],
  },

  // ============================================
  // PRESENCE & COLLABORATION
  // ============================================

  presence_status: {
    title: 'Presence Status',
    description: 'User\'s availability status from Microsoft Teams.',
    thresholds: [
      { label: 'Available', value: 'Online and free', color: 'green' },
      { label: 'Busy', value: 'In a meeting or call', color: 'red' },
      { label: 'Away', value: 'Idle or stepped away', color: 'yellow' },
      { label: 'Do Not Disturb', value: 'Focused work', color: 'red' },
      { label: 'Offline', value: 'Not signed in', color: 'gray' },
    ],
  },

  // ============================================
  // SALES TEAMS
  // ============================================

  sales_team: {
    title: 'Sales Team',
    description: 'Which team is responsible for this deal.',
    thresholds: [
      { label: 'Voice Inside', value: 'Inside sales, SMB focus', color: 'blue' },
      { label: 'Voice Outside', value: 'Field sales, enterprise', color: 'green' },
      { label: 'X-RAI', value: 'AI platform sales', color: 'yellow' },
    ],
  },

  deal_owner: {
    title: 'Deal Owner',
    description: 'The sales rep primarily responsible for this deal.',
    notes: ['Has quota credit', 'Primary contact for updates'],
  },
};

/**
 * Get a tooltip definition by term
 */
export function getTooltip(term: string): TooltipDefinition | null {
  return tooltipDefinitions[term] || null;
}

/**
 * Get all tooltip terms for a category
 */
export function getTooltipsByCategory(category: string): Record<string, TooltipDefinition> {
  const prefixes: Record<string, string[]> = {
    pipeline: ['pipeline_', 'weighted_', 'win_rate', 'deal_health', 'average_deal', 'sales_cycle', 'stage_velocity', 'forecast'],
    stages: ['stage_'],
    revenue: ['arr', 'mrr', 'acv', 'tcv', 'ltv', 'cac'],
    ai: ['ai_'],
    email: ['email_', 'link_', 'thread_', 'draft_'],
    company: ['company_', 'contact_'],
    research: ['research_', 'tech_stack', 'growth_'],
  };

  const result: Record<string, TooltipDefinition> = {};
  const patterns = prefixes[category] || [];

  for (const [term, definition] of Object.entries(tooltipDefinitions)) {
    if (patterns.some(p => term.startsWith(p))) {
      result[term] = definition;
    }
  }

  return result;
}
