/**
 * Batch Intelligence Processing API
 * POST - Run research, extract, and strategy for all companies with valid domains
 * GET - Get batch processing status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { researchCompanyV61 } from '@/lib/intelligence/researchAgentV61';

// Generic/personal email domains to exclude
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

interface CompanyWithDomain {
  id: string;
  name: string;
  domain: string;
}

interface BatchResult {
  companyId: string;
  companyName: string;
  domain: string;
  research: { success: boolean; error?: string; confidence_score?: number };
  extract: { success: boolean; error?: string; contactsCreated?: number };
  strategy: { success: boolean; error?: string };
}

// POST /api/intelligence-v61/batch
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const results: BatchResult[] = [];

  try {
    // Get all companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, domain')
      .order('name');

    if (companiesError) {
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }

    // Get all contacts with emails for domain extraction
    const { data: contacts } = await supabase
      .from('contacts')
      .select('company_id, email')
      .not('email', 'is', null);

    // Build map of company -> business domains from contacts
    const companyDomains = new Map<string, string>();
    if (contacts) {
      const domainCounts = new Map<string, Map<string, number>>();

      for (const contact of contacts) {
        if (!contact.email || !contact.company_id) continue;

        const email = contact.email.toLowerCase().trim();
        const atIndex = email.lastIndexOf('@');
        if (atIndex === -1) continue;

        const domain = email.substring(atIndex + 1);
        if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

        if (!domainCounts.has(contact.company_id)) {
          domainCounts.set(contact.company_id, new Map());
        }
        const counts = domainCounts.get(contact.company_id)!;
        counts.set(domain, (counts.get(domain) || 0) + 1);
      }

      // Pick the most common domain for each company
      for (const [companyId, counts] of domainCounts) {
        let bestDomain = '';
        let bestCount = 0;
        for (const [domain, count] of counts) {
          if (count > bestCount) {
            bestDomain = domain;
            bestCount = count;
          }
        }
        if (bestDomain) {
          companyDomains.set(companyId, bestDomain);
        }
      }
    }

    // Get existing research to skip already-processed companies
    const { data: existingResearch } = await supabase
      .from('company_research')
      .select('company_id')
      .eq('status', 'completed');

    const alreadyResearched = new Set(existingResearch?.map(r => r.company_id) || []);

    // Build list of companies with valid domains that haven't been researched
    const eligibleCompanies: CompanyWithDomain[] = [];

    for (const company of companies || []) {
      // Skip if already researched
      if (alreadyResearched.has(company.id)) {
        continue;
      }

      // Get domain from company or contacts
      let domain = company.domain;
      if (!domain) {
        domain = companyDomains.get(company.id) || null;
      }

      if (domain) {
        // Clean up domain
        try {
          const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
          domain = url.hostname.replace(/^www\./, '');
        } catch {
          // Keep as-is
        }

        eligibleCompanies.push({
          id: company.id,
          name: company.name,
          domain,
        });
      }
    }

    console.log(`[Batch] Found ${eligibleCompanies.length} eligible companies to process`);

    // Process each company sequentially
    for (const company of eligibleCompanies) {
      console.log(`[Batch] Processing: ${company.name} (${company.domain})`);

      const result: BatchResult = {
        companyId: company.id,
        companyName: company.name,
        domain: company.domain,
        research: { success: false },
        extract: { success: false },
        strategy: { success: false },
      };

      try {
        // Step 1: Run Research
        console.log(`[Batch] Step 1: Research for ${company.name}`);
        const researchResult = await researchCompanyV61({
          companyName: company.name,
          domain: company.domain,
          state: null,
        });

        // Save research to database
        const { error: saveError } = await supabase
          .from('company_research')
          .upsert({
            company_id: company.id,
            markdown_report: researchResult.markdown_report,
            version: researchResult.version,
            researched_at: researchResult.researched_at,
            duration_seconds: researchResult.duration_seconds,
            tool_calls: researchResult.tool_calls,
            phases_completed: researchResult.phases_completed,
            confidence_score: researchResult.confidence_score,
            confidence_breakdown: researchResult.confidence_breakdown,
            key_findings: researchResult.key_findings,
            summary: researchResult.summary,
            canonical_identity: researchResult.canonical_identity,
            findings: researchResult.findings,
            inferences: researchResult.inferences,
            tech_stack: researchResult.tech_stack,
            growth_signals: researchResult.growth_signals,
            timeline: researchResult.timeline,
            gaps: researchResult.gaps,
            discrepancies: researchResult.discrepancies,
            company_profile: researchResult.company_profile,
            status: 'completed',
          }, { onConflict: 'company_id' });

        if (saveError) {
          result.research = { success: false, error: saveError.message };
        } else {
          result.research = { success: true, confidence_score: researchResult.confidence_score };
        }

        // Step 2: Extract Data (only if research succeeded)
        if (result.research.success) {
          console.log(`[Batch] Step 2: Extract for ${company.name}`);
          try {
            const extractResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/intelligence-v61/${company.id}/extract`,
              { method: 'POST' }
            );
            const extractData = await extractResponse.json();

            if (extractData.success) {
              result.extract = {
                success: true,
                contactsCreated: extractData.updates?.contactsCreated || 0
              };
            } else {
              result.extract = { success: false, error: extractData.error };
            }
          } catch (extractError) {
            result.extract = {
              success: false,
              error: extractError instanceof Error ? extractError.message : 'Extract failed'
            };
          }
        }

        // Step 3: Generate Strategy (only if extract succeeded)
        if (result.extract.success) {
          console.log(`[Batch] Step 3: Strategy for ${company.name}`);
          try {
            const strategyResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/intelligence-v61/${company.id}/strategy`,
              { method: 'POST' }
            );
            const strategyData = await strategyResponse.json();

            if (strategyData.success) {
              result.strategy = { success: true };
            } else {
              result.strategy = { success: false, error: strategyData.error };
            }
          } catch (strategyError) {
            result.strategy = {
              success: false,
              error: strategyError instanceof Error ? strategyError.message : 'Strategy failed'
            };
          }
        }

      } catch (error) {
        console.error(`[Batch] Error processing ${company.name}:`, error);
        result.research = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      results.push(result);
      console.log(`[Batch] Completed: ${company.name} - Research: ${result.research.success}, Extract: ${result.extract.success}, Strategy: ${result.strategy.success}`);
    }

    // Summary
    const summary = {
      total: eligibleCompanies.length,
      researchSucceeded: results.filter(r => r.research.success).length,
      extractSucceeded: results.filter(r => r.extract.success).length,
      strategySucceeded: results.filter(r => r.strategy.success).length,
      skipped: (companies?.length || 0) - eligibleCompanies.length - alreadyResearched.size,
      alreadyProcessed: alreadyResearched.size,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
    });

  } catch (error) {
    console.error('[Batch] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch processing failed' },
      { status: 500 }
    );
  }
}

// GET /api/intelligence-v61/batch - Get status of what's been processed
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    // Get all companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, domain')
      .order('name');

    // Get all contacts with emails
    const { data: contacts } = await supabase
      .from('contacts')
      .select('company_id, email')
      .not('email', 'is', null);

    // Build domain map from contacts
    const companyDomains = new Map<string, string>();
    if (contacts) {
      const domainCounts = new Map<string, Map<string, number>>();

      for (const contact of contacts) {
        if (!contact.email || !contact.company_id) continue;

        const email = contact.email.toLowerCase().trim();
        const atIndex = email.lastIndexOf('@');
        if (atIndex === -1) continue;

        const domain = email.substring(atIndex + 1);
        if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

        if (!domainCounts.has(contact.company_id)) {
          domainCounts.set(contact.company_id, new Map());
        }
        const counts = domainCounts.get(contact.company_id)!;
        counts.set(domain, (counts.get(domain) || 0) + 1);
      }

      for (const [companyId, counts] of domainCounts) {
        let bestDomain = '';
        let bestCount = 0;
        for (const [domain, count] of counts) {
          if (count > bestCount) {
            bestDomain = domain;
            bestCount = count;
          }
        }
        if (bestDomain) {
          companyDomains.set(companyId, bestDomain);
        }
      }
    }

    // Get existing research
    const { data: research } = await supabase
      .from('company_research')
      .select('company_id, status, confidence_score, researched_at');

    // Get existing extractions
    const { data: extractions } = await supabase
      .from('company_extractions')
      .select('company_id, status');

    // Get existing strategies
    const { data: strategies } = await supabase
      .from('company_strategies')
      .select('company_id');

    const researchMap = new Map(research?.map(r => [r.company_id, r]) || []);
    const extractionSet = new Set(extractions?.map(e => e.company_id) || []);
    const strategySet = new Set(strategies?.map(s => s.company_id) || []);

    // Categorize companies
    const withDomain: Array<{ id: string; name: string; domain: string; status: string }> = [];
    const withoutDomain: Array<{ id: string; name: string }> = [];

    for (const company of companies || []) {
      let domain = company.domain || companyDomains.get(company.id) || null;

      if (domain) {
        try {
          const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
          domain = url.hostname.replace(/^www\./, '');
        } catch {
          // Keep as-is
        }

        const hasResearch = researchMap.has(company.id);
        const hasExtraction = extractionSet.has(company.id);
        const hasStrategy = strategySet.has(company.id);

        let status = 'pending';
        if (hasStrategy) status = 'complete';
        else if (hasExtraction) status = 'extracted';
        else if (hasResearch) status = 'researched';

        withDomain.push({ id: company.id, name: company.name, domain, status });
      } else {
        withoutDomain.push({ id: company.id, name: company.name });
      }
    }

    return NextResponse.json({
      summary: {
        totalCompanies: companies?.length || 0,
        withDomain: withDomain.length,
        withoutDomain: withoutDomain.length,
        pending: withDomain.filter(c => c.status === 'pending').length,
        researched: withDomain.filter(c => c.status === 'researched').length,
        extracted: withDomain.filter(c => c.status === 'extracted').length,
        complete: withDomain.filter(c => c.status === 'complete').length,
      },
      companiesWithDomain: withDomain,
      companiesWithoutDomain: withoutDomain,
    });

  } catch (error) {
    console.error('[Batch Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
