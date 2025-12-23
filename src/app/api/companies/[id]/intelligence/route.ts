/**
 * Company Intelligence API
 *
 * GET /api/companies/[id]/intelligence
 *
 * Returns the full intelligence picture for a company:
 * - Relationship intelligence (context, interactions, commitments, signals)
 * - Linked contacts with their relationship data
 * - Active deals
 * - Recent emails
 * - Recent transcripts
 * - Active command center items
 * - Account research/intelligence
 * - Salesperson notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RelationshipIntelligence, RelationshipNote } from '@/lib/intelligence/relationshipStore';

export interface CompanyIntelligenceResponse {
  company: {
    id: string;
    name: string;
    status: string;
    industry: string;
    segment: string;
    domain: string | null;
    address: Record<string, string> | null;
    agent_count: number | null;
    crm_platform: string | null;
  };
  relationshipIntelligence: RelationshipIntelligence | null;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    role: string | null;
    is_primary: boolean;
    relationship_summary?: string;
  }>;
  deals: Array<{
    id: string;
    name: string;
    stage: string;
    estimated_value: number | null;
    expected_close_date: string | null;
    owner_name: string | null;
  }>;
  recentEmails: Array<{
    id: string;
    subject: string | null;
    from_email: string;
    to_emails: string[];
    received_at: string | null;
    is_sent_by_user: boolean;
    snippet: string | null;
  }>;
  transcripts: Array<{
    id: string;
    title: string;
    meeting_date: string | null;
    duration_minutes: number | null;
    has_analysis: boolean;
  }>;
  activeActions: Array<{
    id: string;
    title: string;
    tier: number;
    tier_trigger: string | null;
    why_now: string | null;
    status: string;
    created_at: string;
  }>;
  accountResearch: {
    id: string;
    summary: string | null;
    key_findings: Record<string, unknown> | null;
    researched_at: string | null;
  } | null;
  salespersonNotes: RelationshipNote[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      console.log('[Company Intelligence] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: companyId } = await params;
    console.log('[Company Intelligence] Fetching for company:', companyId);
    const supabase = createAdminClient();

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, status, industry, segment, domain, address, agent_count, crm_platform')
      .eq('id', companyId)
      .single();

    console.log('[Company Intelligence] Company query result:', { found: !!company, error: companyError?.message });

    if (companyError || !company) {
      console.log('[Company Intelligence] Company not found:', companyId, companyError);
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get relationship intelligence for this company
    const { data: rawRI } = await supabase
      .from('relationship_intelligence')
      .select('*')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    // Transform RI data to the format the UI expects
    // Database stores: open_commitments.ours, signals.buying_signals, context.key_facts
    // UI expects: context.our_commitments, context.buying_signals, context.facts
    const relationshipIntelligence = rawRI ? {
      ...rawRI,
      context: {
        ...(rawRI.context || {}),
        // Map key_facts to facts
        facts: (rawRI.context as any)?.key_facts || [],
        // Map open_commitments to context level
        our_commitments: (rawRI.open_commitments as any)?.ours || [],
        their_commitments: (rawRI.open_commitments as any)?.theirs || [],
        // Map signals to context level
        buying_signals: (rawRI.signals as any)?.buying_signals || [],
        concerns: (rawRI.signals as any)?.concerns || [],
        objections: (rawRI.signals as any)?.objections || [],
        // Map top-level interactions to context
        interactions: rawRI.interactions || [],
        // Stakeholders from context
        stakeholders: (rawRI.context as any)?.stakeholders || [],
      },
      // Also keep summary accessible
      context_summary: rawRI.relationship_summary,
      context_summary_updated_at: rawRI.updated_at,
      interaction_count: (rawRI.interactions || []).length,
      last_interaction_at: (rawRI.interactions || []).length > 0
        ? (rawRI.interactions as any[])[0]?.date
        : null,
    } : null;

    // Get linked contacts with their RI summaries
    const { data: contacts } = await supabase
      .from('contacts')
      .select(`
        id, name, email, title, role, is_primary,
        relationship_intelligence:relationship_intelligence(relationship_summary)
      `)
      .eq('company_id', companyId)
      .order('is_primary', { ascending: false })
      .order('name');

    // Map contacts to include relationship summary
    const contactsWithSummary = (contacts || []).map((c: Record<string, unknown>) => {
      const ri = c.relationship_intelligence as Record<string, unknown>[] | null;
      return {
        id: c.id as string,
        name: c.name as string,
        email: c.email as string | null,
        title: c.title as string | null,
        role: c.role as string | null,
        is_primary: c.is_primary as boolean,
        relationship_summary: ri && ri.length > 0 ? (ri[0].relationship_summary as string) : undefined,
      };
    });

    // Get linked deals
    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id, name, stage, estimated_value, expected_close_date,
        owner:users(name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    const dealsWithOwner = (deals || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      name: d.name as string,
      stage: d.stage as string,
      estimated_value: d.estimated_value as number | null,
      expected_close_date: d.expected_close_date as string | null,
      owner_name: (d.owner as Record<string, unknown> | null)?.name as string | null,
    }));

    // Get recent emails via conversations (email_messages doesn't have company_id)
    const { data: conversations } = await supabase
      .from('email_conversations')
      .select('id, subject, participant_emails, participant_names, last_message_at, last_inbound_at, status, ai_thread_summary')
      .eq('company_id', companyId)
      .order('last_message_at', { ascending: false })
      .limit(20);

    const recentEmails = (conversations || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      subject: c.subject as string | null,
      from_email: ((c.participant_emails as string[]) || [])[0] || '',
      to_emails: (c.participant_emails as string[]) || [],
      received_at: c.last_inbound_at as string | null,
      is_sent_by_user: false, // Conversations don't track this directly
      snippet: c.ai_thread_summary as string | null,
    }));

    // Get transcripts
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date, duration_minutes, analysis')
      .eq('company_id', companyId)
      .order('meeting_date', { ascending: false })
      .limit(10);

    const transcriptsWithAnalysis = (transcripts || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      title: t.title as string,
      meeting_date: t.meeting_date as string | null,
      duration_minutes: t.duration_minutes as number | null,
      has_analysis: !!t.analysis,
    }));

    // Get active command center items
    const { data: actions } = await supabase
      .from('command_center_items')
      .select('id, title, tier, tier_trigger, why_now, status, created_at')
      .eq('company_id', companyId)
      .in('status', ['active', 'pending'])
      .order('tier', { ascending: true })
      .order('created_at', { ascending: false });

    // Get account research/intelligence
    const { data: accountIntel } = await supabase
      .from('account_intelligence')
      .select('id, executive_summary, recommendations, opportunities, pain_points, updated_at')
      .eq('company_id', companyId)
      .single();

    const accountResearch = accountIntel ? {
      id: accountIntel.id,
      summary: accountIntel.executive_summary,
      key_findings: {
        recommendations: accountIntel.recommendations,
        opportunities: accountIntel.opportunities,
        pain_points: accountIntel.pain_points,
      },
      researched_at: accountIntel.updated_at,
    } : null;

    // Get salesperson notes
    const { data: notes } = await supabase
      .from('relationship_notes')
      .select('*')
      .eq('company_id', companyId)
      .order('added_at', { ascending: false })
      .limit(20);

    const response: CompanyIntelligenceResponse = {
      company,
      relationshipIntelligence: relationshipIntelligence as RelationshipIntelligence | null,
      contacts: contactsWithSummary,
      deals: dealsWithOwner,
      recentEmails,
      transcripts: transcriptsWithAnalysis,
      activeActions: (actions || []) as CompanyIntelligenceResponse['activeActions'],
      accountResearch,
      salespersonNotes: (notes || []) as RelationshipNote[],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Company Intelligence API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
