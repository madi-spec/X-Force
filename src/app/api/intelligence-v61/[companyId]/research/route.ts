/**
 * Intelligence Research API v6.1
 * POST - Run agentic research and save markdown report
 * GET - Get research status and results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { researchCompanyV61 } from '@/lib/intelligence/researchAgentV61';

// Generic/personal email domains to exclude when deriving from contacts
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'google.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'aim.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'zoho.com', 'zohomail.com',
  'mail.com', 'email.com',
  'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru',
  'qq.com', '163.com', '126.com',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net',
  'charter.net', 'cox.net', 'earthlink.net', 'frontier.com',
  'fastmail.com', 'tutanota.com', 'hushmail.com',
  'inbox.com', 'mail.ru', 'rediffmail.com',
]);

// POST /api/intelligence-v61/[companyId]/research
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, domain')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Extract domain - first from company, then from contact emails
    let domain = company.domain;

    // If no domain in company, try to derive from contact emails
    if (!domain) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('email')
        .eq('company_id', companyId)
        .not('email', 'is', null);

      if (contacts && contacts.length > 0) {
        // Count domains from contact emails
        const domainCounts = new Map<string, number>();
        for (const contact of contacts) {
          if (!contact.email) continue;
          const email = contact.email.toLowerCase().trim();
          const atIndex = email.lastIndexOf('@');
          if (atIndex === -1) continue;
          const emailDomain = email.substring(atIndex + 1);
          if (!emailDomain || GENERIC_EMAIL_DOMAINS.has(emailDomain)) continue;
          domainCounts.set(emailDomain, (domainCounts.get(emailDomain) || 0) + 1);
        }

        // Pick the most common domain
        let bestDomain = '';
        let bestCount = 0;
        for (const [d, count] of domainCounts) {
          if (count > bestCount) {
            bestDomain = d;
            bestCount = count;
          }
        }
        if (bestDomain) {
          domain = bestDomain;
          console.log(`[Intelligence v6.1] Derived domain from contacts: ${domain}`);
        }
      }
    }

    if (domain) {
      try {
        const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
        domain = url.hostname.replace(/^www\./, '');
      } catch {
        // Keep as-is if not parseable
      }
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'Company has no website/domain and no contact emails with business domains' },
        { status: 400 }
      );
    }

    console.log(`[Intelligence v6.1] Starting research for: ${company.name} (${domain})`);

    // Run the v6.1 research agent
    const result = await researchCompanyV61({
      companyName: company.name,
      domain,
      state: null,
    });

    // Save to company_research table
    const { error: saveError } = await supabase
      .from('company_research')
      .upsert({
        company_id: companyId,
        markdown_report: result.markdown_report,
        version: result.version,
        researched_at: result.researched_at,
        duration_seconds: result.duration_seconds,
        tool_calls: result.tool_calls,
        phases_completed: result.phases_completed,
        confidence_score: result.confidence_score,
        confidence_breakdown: result.confidence_breakdown,
        key_findings: result.key_findings,
        summary: result.summary,
        canonical_identity: result.canonical_identity,
        findings: result.findings,
        inferences: result.inferences,
        tech_stack: result.tech_stack,
        growth_signals: result.growth_signals,
        timeline: result.timeline,
        gaps: result.gaps,
        discrepancies: result.discrepancies,
        company_profile: result.company_profile,
        status: 'completed',
      }, { onConflict: 'company_id' });

    if (saveError) {
      console.error('[Intelligence v6.1] Save error:', saveError);
      // Return success with warning - research completed but save failed
      return NextResponse.json({
        success: true,
        warning: 'Research completed but failed to save to database',
        companyId,
        companyName: company.name,
        domain,
        result: {
          version: result.version,
          confidence_score: result.confidence_score,
          key_findings: result.key_findings,
          summary: result.summary,
          markdown_report: result.markdown_report,
        },
      });
    }

    return NextResponse.json({
      success: true,
      companyId,
      companyName: company.name,
      domain,
      result: {
        version: result.version,
        researched_at: result.researched_at,
        duration_seconds: result.duration_seconds,
        tool_calls: result.tool_calls,
        phases_completed: result.phases_completed,
        confidence_score: result.confidence_score,
        key_findings: result.key_findings,
        summary: result.summary,
        ownership_type: result.canonical_identity.ownership_type,
        tech_stack: result.tech_stack,
      },
      // Include markdown for immediate display
      markdown_report: result.markdown_report,
    });
  } catch (error) {
    console.error('[Intelligence v6.1] Research error:', error);
    return NextResponse.json(
      { error: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET /api/intelligence-v61/[companyId]/research
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('company_research')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No research found for this company' },
        { status: 404 }
      );
    }

    // Check if research is stale (>30 days)
    const researchedAt = new Date(data.researched_at);
    const daysOld = Math.floor((Date.now() - researchedAt.getTime()) / (1000 * 60 * 60 * 24));
    const isStale = daysOld > 30;

    return NextResponse.json({
      success: true,
      companyId,
      research: {
        id: data.id,
        version: data.version,
        status: data.status,
        researched_at: data.researched_at,
        duration_seconds: data.duration_seconds,
        tool_calls: data.tool_calls,
        phases_completed: data.phases_completed,
        confidence_score: data.confidence_score,
        confidence_breakdown: data.confidence_breakdown,
        key_findings: data.key_findings,
        summary: data.summary,
        canonical_identity: data.canonical_identity,
        tech_stack: data.tech_stack,
        growth_signals: data.growth_signals,
        timeline: data.timeline,
        gaps: data.gaps,
      },
      markdown_report: data.markdown_report,
      is_stale: isStale,
      days_old: daysOld,
    });
  } catch (error) {
    console.error('[Intelligence v6.1] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve research' },
      { status: 500 }
    );
  }
}
