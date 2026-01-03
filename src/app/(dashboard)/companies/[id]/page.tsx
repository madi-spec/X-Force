import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CustomerHub, CustomerHubData, CompanyProduct, Contact, Communication, SupportCase, UnifiedTask, TimelineEvent, CustomerHubStats, CustomerHubTab, MeetingTranscript } from '@/components/customerHub';

interface CompanyPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; from_work?: string }>;
}

const VALID_TABS: CustomerHubTab[] = ['overview', 'sales', 'onboarding', 'engagement', 'support', 'timeline', 'conversations', 'meetings'];

export default async function CompanyPage({ params, searchParams }: CompanyPageProps) {
  const { id } = await params;
  const { tab, from_work } = await searchParams;

  // Validate tab parameter
  const initialTab = tab && VALID_TABS.includes(tab as CustomerHubTab)
    ? (tab as CustomerHubTab)
    : undefined;
  const supabase = await createClient();

  // Get company
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  // Fetch all data in parallel for performance
  const [
    companyProductsResult,
    contactsResult,
    communicationsResult,
    supportCasesResult,
    tasksResult,
    meetingsResult,
  ] = await Promise.all([
    // Company products with relations
    supabase
      .from('company_products')
      .select(`
        *,
        product:products(
          id, name, slug, description, product_type, icon, color,
          base_price_monthly, pricing_model, is_sellable, parent_product_id
        ),
        tier:product_tiers(id, name, slug, price_monthly),
        current_stage:product_process_stages(id, name, slug, stage_order),
        owner_user:users(id, name)
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false }),

    // Contacts
    supabase
      .from('contacts')
      .select('*')
      .eq('company_id', id)
      .order('is_primary', { ascending: false })
      .order('name'),

    // Communications
    supabase
      .from('communications')
      .select('*')
      .eq('company_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50),

    // Support cases from read model
    supabase
      .from('support_case_read_model')
      .select('*')
      .eq('company_id', id)
      .order('opened_at', { ascending: false }),

    // Tasks from command center items
    supabase
      .from('command_center_items')
      .select('*')
      .eq('company_id', id)
      .in('status', ['pending', 'in_progress', 'completed'])
      .order('priority_score', { ascending: false })
      .limit(20),

    // Meeting transcriptions
    supabase
      .from('meeting_transcriptions')
      .select('id, company_id, title, meeting_date, duration_minutes, attendees, summary, analysis, source, created_at')
      .eq('company_id', id)
      .order('meeting_date', { ascending: false })
      .limit(50),
  ]);

  // Transform company products
  const companyProducts: CompanyProduct[] = (companyProductsResult.data || []).map((cp: any) => ({
    id: cp.id,
    company_id: cp.company_id,
    product_id: cp.product_id,
    product: cp.product ? {
      id: cp.product.id,
      name: cp.product.name,
      slug: cp.product.slug,
      description: cp.product.description,
      product_type: cp.product.product_type,
      icon: cp.product.icon,
      color: cp.product.color,
    } : null,
    tier_id: cp.tier_id,
    tier: cp.tier ? {
      id: cp.tier.id,
      name: cp.tier.name,
      slug: cp.tier.slug,
      price_monthly: cp.tier.price_monthly,
    } : null,
    status: cp.status,
    current_stage_id: cp.current_stage_id,
    current_stage: cp.current_stage ? {
      id: cp.current_stage.id,
      name: cp.current_stage.name,
      slug: cp.current_stage.slug,
      stage_order: cp.current_stage.stage_order,
    } : null,
    mrr: cp.mrr,
    health_score: cp.health_score,
    seats: cp.seats,
    owner_id: cp.owner_user_id,
    owner: cp.owner_user ? {
      id: cp.owner_user.id,
      name: cp.owner_user.name,
    } : null,
    started_at: cp.started_at,
    activated_at: cp.activated_at,
    renewal_date: cp.renewal_date,
    notes: cp.notes,
    created_at: cp.created_at,
  }));

  // Transform contacts
  const contacts: Contact[] = (contactsResult.data || []).map((c: any) => ({
    id: c.id,
    company_id: c.company_id,
    name: c.name || '',
    email: c.email,
    phone: c.phone,
    title: c.title,
    is_primary: c.is_primary || false,
    is_decision_maker: c.is_decision_maker || false,
    created_at: c.created_at,
  }));

  // Transform communications
  const communications: Communication[] = (communicationsResult.data || []).map((comm: any) => ({
    id: comm.id,
    company_id: comm.company_id,
    channel: comm.channel,
    direction: comm.direction,
    subject: comm.subject,
    content_preview: comm.content_preview,
    from_email: comm.our_participants?.[0]?.email || (comm.direction === 'outbound' ? 'us' : null),
    to_email: comm.their_participants?.[0]?.email || (comm.direction === 'inbound' ? 'us' : null),
    received_at: comm.direction === 'inbound' ? comm.occurred_at : null,
    sent_at: comm.direction === 'outbound' ? comm.occurred_at : null,
    occurred_at: comm.occurred_at,
    created_at: comm.created_at,
    thread_id: comm.thread_id,
  }));

  // Transform support cases
  const supportCases: SupportCase[] = (supportCasesResult.data || []).map((sc: any) => ({
    id: sc.support_case_id,
    company_id: sc.company_id,
    company_product_id: sc.company_product_id,
    subject: sc.title || 'Untitled Case',
    description: sc.description,
    status: sc.status,
    severity: sc.severity,
    assigned_to: sc.owner_id ? {
      id: sc.owner_id,
      name: sc.owner_name || 'Unknown',
    } : null,
    sla_due_at: sc.resolution_due_at,
    sla_breached: sc.resolution_breached || sc.first_response_breached,
    created_at: sc.opened_at,
    resolved_at: sc.resolved_at,
  }));

  // Transform tasks from command center items
  const tasks: UnifiedTask[] = (tasksResult.data || []).map((task: any) => ({
    id: task.id,
    company_id: task.company_id,
    type: mapCommandCenterTypeToTaskType(task.item_type),
    title: task.title || 'Untitled Task',
    description: task.summary,
    status: task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'in_progress' : 'pending',
    priority: mapPriorityScore(task.priority_score),
    due_date: task.due_date,
    created_at: task.created_at,
    completed_at: task.completed_at,
  }));

  // Transform meeting transcriptions
  const meetings: MeetingTranscript[] = (meetingsResult.data || []).map((m: any) => ({
    id: m.id,
    company_id: m.company_id,
    title: m.title || 'Meeting',
    meeting_date: m.meeting_date,
    duration_minutes: m.duration_minutes,
    attendees: m.attendees,
    summary: m.summary,
    analysis: m.analysis,
    source: m.source || 'manual',
    created_at: m.created_at,
  }));

  // Build timeline from communications and activities
  const timeline: TimelineEvent[] = buildTimeline(communications, supportCases, companyProducts);

  // Calculate stats
  const activeProducts = companyProducts.filter(p => p.status === 'active');
  const totalMrr = activeProducts.reduce((sum, p) => sum + (p.mrr || 0), 0);
  const openCases = supportCases.filter(c => !['resolved', 'closed'].includes(c.status));

  // Calculate health score (average of active product health scores, or null if none)
  const healthScores = activeProducts.map(p => p.health_score).filter((h): h is number => h !== null);
  const healthScore = healthScores.length > 0
    ? healthScores.reduce((sum, h) => sum + h, 0) / healthScores.length
    : null;

  // Days since last contact
  const lastContact = communications[0]?.occurred_at;
  const daysSinceContact = lastContact
    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Days to renewal (from earliest renewal date of active products)
  const renewalDates = activeProducts
    .map(p => p.renewal_date)
    .filter((d): d is string => d !== null)
    .map(d => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime());
  const renewalDays = renewalDates.length > 0
    ? Math.ceil((renewalDates[0].getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const stats: CustomerHubStats = {
    healthScore,
    totalMrr,
    openCases: openCases.length,
    daysSinceContact,
    renewalDays,
  };

  // Build the CustomerHubData object
  const customerHubData: CustomerHubData = {
    company: {
      id: company.id,
      name: company.name,
      domain: company.website || company.domain,
      logo_url: company.logo_url,
      status: company.status,
      segment: company.segment,
      industry: company.industry,
      employee_range: company.employee_range,
      created_at: company.created_at,
    },
    companyProducts,
    contacts,
    communications,
    supportCases,
    tasks,
    meetings,
    timeline,
    stats,
  };

  return (
    <CustomerHub
      data={customerHubData}
      initialTab={initialTab}
      sourceWorkItemId={from_work}
    />
  );
}

// Helper to map command center item types to task types
function mapCommandCenterTypeToTaskType(itemType: string): 'case_followup' | 'overdue_promise' | 'next_step' | 'manual' {
  if (itemType?.includes('case') || itemType?.includes('support')) return 'case_followup';
  if (itemType?.includes('overdue') || itemType?.includes('promise')) return 'overdue_promise';
  if (itemType?.includes('next') || itemType?.includes('step')) return 'next_step';
  return 'manual';
}

// Helper to map priority score to priority level
function mapPriorityScore(score: number | null): 'urgent' | 'high' | 'medium' | 'low' {
  if (score === null) return 'medium';
  if (score >= 80) return 'urgent';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// Build timeline from various sources
function buildTimeline(
  communications: Communication[],
  supportCases: SupportCase[],
  companyProducts: CompanyProduct[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add communications
  communications.forEach(comm => {
    events.push({
      id: comm.id,
      type: comm.direction === 'inbound' ? 'email_received' : 'email_sent',
      title: comm.subject || 'Email',
      description: comm.content_preview,
      timestamp: comm.occurred_at || comm.created_at,
      actor: null,
      metadata: {
        channel: comm.channel,
        direction: comm.direction,
      },
    });
  });

  // Add support case events
  supportCases.forEach(sc => {
    events.push({
      id: `${sc.id}-opened`,
      type: 'case_opened',
      title: sc.subject,
      description: sc.description || null,
      timestamp: sc.created_at,
      actor: null,
      metadata: {
        severity: sc.severity,
        status: sc.status,
      },
    });

    if (sc.resolved_at) {
      events.push({
        id: `${sc.id}-resolved`,
        type: 'case_resolved',
        title: `Resolved: ${sc.subject}`,
        description: null,
        timestamp: sc.resolved_at,
        actor: sc.assigned_to,
        metadata: {
          severity: sc.severity,
        },
      });
    }
  });

  // Add product activations
  companyProducts.forEach(cp => {
    if (cp.activated_at && cp.product) {
      events.push({
        id: `${cp.id}-activated`,
        type: 'product_activated',
        title: `${cp.product.name} activated`,
        description: cp.tier ? `Tier: ${cp.tier.name}` : null,
        timestamp: cp.activated_at,
        actor: cp.owner,
        metadata: {
          product_id: cp.product_id,
          tier: cp.tier?.name,
        },
      });
    }
  });

  // Sort by timestamp descending
  return events.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
