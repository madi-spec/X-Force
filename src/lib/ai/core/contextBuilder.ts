import { formatDate, formatCurrency } from '@/lib/utils';

/**
 * Build context string for deal analysis
 */
export function buildDealContext(deal: {
  name: string;
  stage: string;
  estimated_value?: number | null;
  health_score?: number | null;
  stage_entered_at?: string;
  created_at: string;
  close_date?: string | null;
  deal_type?: string;
  sales_team?: string;
  notes?: string | null;
  company?: {
    name: string;
    segment?: string;
    agent_count?: number;
    industry?: string;
    status?: string;
  } | null;
}): string {
  const daysInStage = deal.stage_entered_at
    ? Math.floor(
        (Date.now() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const dealAge = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const lines = [
    '## Deal Information',
    `Name: ${deal.name}`,
    `Stage: ${deal.stage.replace('_', ' ')}`,
    `Value: ${deal.estimated_value ? formatCurrency(deal.estimated_value) : 'Not set'}`,
    `Health Score: ${deal.health_score ?? 'Not calculated'}/100`,
    `Days in Stage: ${daysInStage}`,
    `Deal Age: ${dealAge} days`,
  ];

  if (deal.deal_type) {
    lines.push(`Type: ${deal.deal_type.replace('_', ' ')}`);
  }

  if (deal.sales_team) {
    lines.push(`Team: ${deal.sales_team.replace('_', ' ')}`);
  }

  if (deal.close_date) {
    lines.push(`Expected Close: ${formatDate(deal.close_date)}`);
  }

  if (deal.notes) {
    lines.push(`\nNotes: ${deal.notes}`);
  }

  if (deal.company) {
    lines.push('\n## Company');
    lines.push(`Name: ${deal.company.name}`);
    if (deal.company.segment) {
      lines.push(`Segment: ${deal.company.segment.replace('_', ' ')}`);
    }
    if (deal.company.agent_count) {
      lines.push(`Size: ${deal.company.agent_count} agents`);
    }
    if (deal.company.industry) {
      lines.push(`Industry: ${deal.company.industry}`);
    }
    if (deal.company.status) {
      lines.push(`Status: ${deal.company.status.replace('_', ' ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build context string for activities
 */
export function buildActivitiesContext(
  activities: Array<{
    type: string;
    subject?: string | null;
    body?: string | null;
    summary?: string | null;
    occurred_at: string;
    sentiment?: string | null;
    user?: { name: string } | null;
  }>,
  limit = 15
): string {
  if (!activities || activities.length === 0) {
    return '## Recent Activity\nNo activities recorded.';
  }

  const recentActivities = activities.slice(0, limit);

  const lines = ['## Recent Activity'];

  for (const activity of recentActivities) {
    const date = formatDate(activity.occurred_at);
    const type = activity.type.replace('_', ' ');
    const byUser = activity.user?.name ? ` (${activity.user.name})` : '';
    const sentiment = activity.sentiment ? ` [${activity.sentiment}]` : '';

    lines.push(`\n### ${date} - ${type}${byUser}${sentiment}`);

    if (activity.subject) {
      lines.push(`Subject: ${activity.subject}`);
    }

    if (activity.summary) {
      lines.push(`Summary: ${activity.summary}`);
    } else if (activity.body) {
      // Truncate long bodies
      const truncatedBody =
        activity.body.length > 500 ? activity.body.slice(0, 500) + '...' : activity.body;
      lines.push(truncatedBody);
    }
  }

  if (activities.length > limit) {
    lines.push(`\n(${activities.length - limit} more activities not shown)`);
  }

  return lines.join('\n');
}

/**
 * Build context string for contacts
 */
export function buildContactsContext(
  contacts: Array<{
    name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    is_primary?: boolean;
  }>
): string {
  if (!contacts || contacts.length === 0) {
    return '## Contacts\nNo contacts linked.';
  }

  const lines = ['## Contacts'];

  for (const contact of contacts) {
    const isPrimary = contact.is_primary ? ' (Primary)' : '';
    const role = contact.role ? ` - ${contact.role.replace('_', ' ')}` : '';

    lines.push(`\n**${contact.name}**${isPrimary}${role}`);

    if (contact.title) {
      lines.push(`Title: ${contact.title}`);
    }

    if (contact.email) {
      lines.push(`Email: ${contact.email}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build context for signals
 */
export function buildSignalsContext(
  signals: Array<{
    signal_type: string;
    severity: string;
    title: string;
    description?: string | null;
    created_at: string;
  }>
): string {
  if (!signals || signals.length === 0) {
    return '## Active Signals\nNo active signals.';
  }

  const lines = ['## Active Signals'];

  for (const signal of signals) {
    const severityIcon =
      {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        positive: '✅',
      }[signal.severity] || '•';

    lines.push(`\n${severityIcon} **${signal.title}** (${signal.signal_type})`);

    if (signal.description) {
      lines.push(signal.description);
    }
  }

  return lines.join('\n');
}

/**
 * Build full context for a deal with all related data
 */
export function buildFullDealContext(params: {
  deal: Parameters<typeof buildDealContext>[0];
  activities?: Parameters<typeof buildActivitiesContext>[0];
  contacts?: Parameters<typeof buildContactsContext>[0];
  signals?: Parameters<typeof buildSignalsContext>[0];
  additionalContext?: string;
}): string {
  const sections = [buildDealContext(params.deal)];

  if (params.contacts && params.contacts.length > 0) {
    sections.push(buildContactsContext(params.contacts));
  }

  if (params.activities && params.activities.length > 0) {
    sections.push(buildActivitiesContext(params.activities));
  }

  if (params.signals && params.signals.length > 0) {
    sections.push(buildSignalsContext(params.signals));
  }

  if (params.additionalContext) {
    sections.push(params.additionalContext);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Build context for company analysis
 */
export function buildCompanyContext(company: {
  name: string;
  segment?: string | null;
  industry?: string | null;
  agent_count?: number | null;
  status?: string | null;
  crm_platform?: string | null;
  voice_customer?: boolean | null;
  created_at: string;
  deals?: Array<{
    name: string;
    stage: string;
    estimated_value?: number | null;
  }>;
  contacts?: Array<{
    name: string;
    title?: string | null;
  }>;
}): string {
  const lines = [
    '## Company Information',
    `Name: ${company.name}`,
    `Segment: ${company.segment?.replace('_', ' ') || 'Not set'}`,
    `Industry: ${company.industry || 'Not set'}`,
    `Size: ${company.agent_count ? `${company.agent_count} agents` : 'Not set'}`,
    `Status: ${company.status?.replace('_', ' ') || 'Not set'}`,
  ];

  if (company.crm_platform) {
    lines.push(`CRM: ${company.crm_platform}`);
  }

  if (company.voice_customer !== undefined) {
    lines.push(`Voice Customer: ${company.voice_customer ? 'Yes' : 'No'}`);
  }

  if (company.deals && company.deals.length > 0) {
    lines.push('\n## Active Deals');
    for (const deal of company.deals) {
      const value = deal.estimated_value ? ` - ${formatCurrency(deal.estimated_value)}` : '';
      lines.push(`- ${deal.name} (${deal.stage.replace('_', ' ')})${value}`);
    }
  }

  if (company.contacts && company.contacts.length > 0) {
    lines.push('\n## Key Contacts');
    for (const contact of company.contacts.slice(0, 5)) {
      const title = contact.title ? ` - ${contact.title}` : '';
      lines.push(`- ${contact.name}${title}`);
    }
    if (company.contacts.length > 5) {
      lines.push(`- (${company.contacts.length - 5} more contacts)`);
    }
  }

  return lines.join('\n');
}
