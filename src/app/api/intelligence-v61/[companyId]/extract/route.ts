/**
 * Intelligence Extraction API v6.1
 * POST - Extract structured data from research
 * GET - Get current extraction
 * PATCH - Update extraction (user edits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ResearchData {
  canonical_identity: {
    operating_name: string;
    legal_entity: string | null;
    domain: string;
    hq_city: string | null;
    hq_state: string | null;
    ownership_type: string;
    family_generation: string | null;
    pe_firm: string | null;
    franchise_brand: string | null;
  };
  findings: Record<string, {
    value: unknown;
    source: string;
    confidence: string;
  }>;
  inferences: Record<string, {
    value: unknown;
    method: string;
    confidence: string;
  }>;
  tech_stack: Array<{
    category: string;
    vendor: string;
    confidence: string;
    is_known_vendor: boolean;
  }>;
  growth_signals: Array<{
    signal: string;
    value: unknown;
    interpretation: string;
  }>;
  timeline: Array<{
    year: number;
    event: string;
    source: string;
  }>;
  company_profile?: {
    mission_statement: string | null;
    vision_statement: string | null;
    core_values: string[];
    culture_description: string | null;
    history_narrative: string | null;
    service_offerings: Array<{
      name: string;
      description: string;
      target_market?: string;
    }>;
    pricing_info: {
      model: string | null;
      starting_prices: string | null;
      pricing_notes: string | null;
    };
    leadership_bios: Array<{
      name: string;
      title: string;
      bio: string | null;
      linkedin?: string;
    }>;
    certifications: string[];
    service_areas: string[];
    unique_selling_points: string[];
  };
}

// POST /api/intelligence-v61/[companyId]/extract
// Extracts structured data from research report and updates company/contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Get the research data
    const { data: research, error: researchError } = await supabase
      .from('company_research')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (researchError || !research) {
      return NextResponse.json(
        { error: 'No research found. Run research first.' },
        { status: 404 }
      );
    }

    // Extract structured data from research
    const extraction = extractFromResearch(research);

    // Save to company_extractions table
    const { data: saved, error: saveError } = await supabase
      .from('company_extractions')
      .upsert({
        company_id: companyId,
        research_id: research.id,
        ...extraction,
        status: 'extracted',
        extraction_confidence: research.confidence_score,
      }, { onConflict: 'company_id' })
      .select()
      .single();

    if (saveError) {
      console.error('[Extract v6.1] Save extraction error:', saveError);
      return NextResponse.json(
        { error: 'Failed to save extraction' },
        { status: 500 }
      );
    }

    // ============================================
    // UPDATE COMPANIES TABLE
    // ============================================
    const companyUpdate: Record<string, unknown> = {};

    // Map employee data - prefer range string, calculate revenue from range
    let employeeRangeStr: string | null = null;
    let employeeMidpoint: number | null = null;

    // Check for range string first (e.g., "51-200")
    const rawEmpValue = extraction.employee_count_range || extraction.employee_count;
    if (rawEmpValue && typeof rawEmpValue === 'string' && rawEmpValue.includes('-')) {
      employeeRangeStr = rawEmpValue;
      // Parse range to get midpoint for revenue calculation
      const rangeMatch = rawEmpValue.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        const low = parseInt(rangeMatch[1], 10);
        const high = parseInt(rangeMatch[2], 10);
        employeeMidpoint = Math.round((low + high) / 2);
      }
    } else if (extraction.employee_count) {
      const empCount = Number(extraction.employee_count);
      if (!isNaN(empCount) && empCount > 0) {
        employeeMidpoint = empCount;
      }
    }

    console.log(`[Extract v6.1] Employee data from extraction:`, {
      employee_count_range: extraction.employee_count_range,
      employee_count: extraction.employee_count,
      rawEmpValue,
      employeeRangeStr,
      employeeMidpoint,
    });

    if (employeeRangeStr) {
      companyUpdate.employee_range = employeeRangeStr;
      console.log(`[Extract v6.1] Setting employee_range: ${employeeRangeStr}`);
    }
    if (employeeMidpoint) {
      companyUpdate.agent_count = employeeMidpoint;
      companyUpdate.employee_count = employeeMidpoint;
      console.log(`[Extract v6.1] Setting employee_count (midpoint): ${employeeMidpoint}`);
    }

    // Map revenue - calculate range from employee range if no direct revenue
    if (extraction.revenue) {
      const rev = Number(extraction.revenue);
      if (!isNaN(rev) && rev > 0) {
        // Calculate range (±25%)
        const low = Math.round(rev * 0.75);
        const high = Math.round(rev * 1.25);
        const revenueRange = formatRevenueRange(low, high);
        companyUpdate.revenue_estimate = revenueRange;
        console.log(`[Extract v6.1] Setting revenue_estimate: ${revenueRange}`);
      }
    } else if (employeeRangeStr) {
      // Calculate revenue range from employee range using $125K/employee heuristic
      const rangeMatch = employeeRangeStr.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        const empLow = parseInt(rangeMatch[1], 10);
        const empHigh = parseInt(rangeMatch[2], 10);
        const revLow = empLow * 125000;
        const revHigh = empHigh * 125000;
        const revenueRange = formatRevenueRange(revLow, revHigh);
        companyUpdate.revenue_estimate = revenueRange;
        console.log(`[Extract v6.1] Setting revenue_estimate from ${employeeRangeStr} employees: ${revenueRange}`);
      }
    } else if (employeeMidpoint) {
      // Fallback to midpoint-based calculation
      const estimatedRevenue = employeeMidpoint * 125000;
      const low = Math.round(estimatedRevenue * 0.75);
      const high = Math.round(estimatedRevenue * 1.25);
      const revenueRange = formatRevenueRange(low, high);
      companyUpdate.revenue_estimate = revenueRange;
      console.log(`[Extract v6.1] Setting revenue_estimate from ${employeeMidpoint} employees: ${revenueRange}`);
    }

    // Map FSM vendor to crm_platform
    if (extraction.fsm_vendor) {
      const fsmVendor = String(extraction.fsm_vendor).toLowerCase();
      if (fsmVendor.includes('fieldroutes') || fsmVendor.includes('pestroutes')) {
        companyUpdate.crm_platform = 'fieldroutes';
      } else if (fsmVendor.includes('pestpac') || fsmVendor.includes('workwave')) {
        companyUpdate.crm_platform = 'pestpac';
      } else if (fsmVendor.includes('realgreen') || fsmVendor.includes('real green')) {
        companyUpdate.crm_platform = 'realgreen';
      } else {
        companyUpdate.crm_platform = 'other';
      }
    }

    // Update address from HQ location
    if (extraction.hq_city || extraction.hq_state) {
      companyUpdate.address = {
        city: extraction.hq_city,
        state: extraction.hq_state,
      };
    }

    // Update company if we have data
    if (Object.keys(companyUpdate).length > 0) {
      console.log(`[Extract v6.1] Updating company with:`, companyUpdate);
      const { error: companyError } = await supabase
        .from('companies')
        .update(companyUpdate)
        .eq('id', companyId);

      if (companyError) {
        console.error('[Extract v6.1] Company update error:', companyError);
      } else {
        console.log(`[Extract v6.1] Company updated successfully`);
      }
    }

    // ============================================
    // CREATE/UPDATE CONTACTS FROM LEADERSHIP
    // ============================================
    const leadershipTeam = extraction.leadership_team as Array<{
      name: string;
      title: string;
      is_decision_maker: boolean;
      email?: string;
      phone?: string;
      linkedin?: string;
      bio?: string;
    }> || [];

    console.log(`[Extract v6.1] Processing ${leadershipTeam.length} leaders for contacts`);

    let contactsCreated = 0;
    let contactsUpdated = 0;

    for (const leader of leadershipTeam) {
      if (!leader.name) continue;

      // Check if contact already exists by name
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .ilike('name', leader.name)
        .single();

      // Map title to contact_role
      let contactRole: string | null = null;
      const titleLower = (leader.title || '').toLowerCase();
      if (leader.is_decision_maker || titleLower.includes('ceo') || titleLower.includes('owner') || titleLower.includes('president')) {
        contactRole = 'decision_maker';
      } else if (titleLower.includes('vp') || titleLower.includes('director')) {
        contactRole = 'influencer';
      }

      if (existingContact) {
        // Update existing contact
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            title: leader.title,
            role: contactRole,
            phone: leader.phone || undefined,
          })
          .eq('id', existingContact.id);

        if (updateError) {
          console.error(`[Extract v6.1] Failed to update contact ${leader.name}:`, updateError);
        } else {
          console.log(`[Extract v6.1] Updated contact: ${leader.name}`);
          contactsUpdated++;
        }
      } else {
        // Create new contact - generate placeholder email if not available
        const placeholderEmail = `${leader.name.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`;

        const { data: newContact, error: insertError } = await supabase
          .from('contacts')
          .insert({
            company_id: companyId,
            name: leader.name,
            title: leader.title,
            email: leader.email || placeholderEmail,
            phone: leader.phone || null,
            role: contactRole,
            is_primary: leader.is_decision_maker && contactsCreated === 0,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[Extract v6.1] Failed to create contact ${leader.name}:`, insertError);
        } else {
          console.log(`[Extract v6.1] Created contact: ${leader.name} (id: ${newContact?.id})`);
          contactsCreated++;
        }
      }

      // Also add to contact_intelligence for enriched data
      if (leader.linkedin || leader.is_decision_maker) {
        // Check if already exists
        const { data: existingIntel } = await supabase
          .from('contact_intelligence')
          .select('id')
          .eq('company_id', companyId)
          .ilike('full_name', leader.name)
          .single();

        if (existingIntel) {
          // Update existing
          await supabase
            .from('contact_intelligence')
            .update({
              title: leader.title,
              linkedin_url: leader.linkedin || null,
              email: leader.email || null,
              phone: leader.phone || null,
              is_decision_maker: leader.is_decision_maker,
              seniority: getSeniority(leader.title),
              collected_at: new Date().toISOString(),
            })
            .eq('id', existingIntel.id);
        } else {
          // Insert new
          await supabase
            .from('contact_intelligence')
            .insert({
              company_id: companyId,
              full_name: leader.name,
              title: leader.title,
              linkedin_url: leader.linkedin || null,
              email: leader.email || null,
              phone: leader.phone || null,
              is_decision_maker: leader.is_decision_maker,
              seniority: getSeniority(leader.title),
              source: 'manual',
              collected_at: new Date().toISOString(),
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      companyId,
      extraction: saved,
      updates: {
        company: Object.keys(companyUpdate).length > 0,
        contactsCreated,
        contactsUpdated,
      },
      message: `Data extracted! Updated company record, created ${contactsCreated} contacts, updated ${contactsUpdated} contacts.`,
    });
  } catch (error) {
    console.error('[Extract v6.1] Error:', error);
    return NextResponse.json(
      { error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Helper to determine seniority from title
function getSeniority(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('chief') || t.includes('president')) return 'c_level';
  if (t.includes('owner') || t.includes('founder')) return 'owner';
  if (t.includes('vp') || t.includes('vice president')) return 'vp';
  if (t.includes('director')) return 'director';
  if (t.includes('manager')) return 'manager';
  if (t.includes('senior') || t.includes('sr')) return 'senior';
  return 'entry';
}

// Helper to parse employee count from various formats
function parseEmployeeCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (typeof value === 'string') {
    // Handle ranges like "50-100" by taking the midpoint
    const rangeMatch = value.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      const low = parseInt(rangeMatch[1], 10);
      const high = parseInt(rangeMatch[2], 10);
      return Math.round((low + high) / 2);
    }
    // Handle "~50" or "approximately 50"
    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
    return isNaN(num) || num <= 0 ? null : num;
  }
  return null;
}

// Helper to parse number from various formats
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (typeof value === 'string') {
    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
    return isNaN(num) || num <= 0 ? null : num;
  }
  return null;
}

// Helper to format revenue range
function formatRevenueRange(low: number, high: number): string {
  const formatRev = (n: number): string => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  return `${formatRev(low)}-${formatRev(high)}`;
}

// GET /api/intelligence-v61/[companyId]/extract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('company_extractions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No extraction found for this company' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      extraction: data,
    });
  } catch (error) {
    console.error('[Extract v6.1] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve extraction' },
      { status: 500 }
    );
  }
}

// PATCH /api/intelligence-v61/[companyId]/extract
// Update extraction with user edits
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    // Get existing extraction
    const { data: existing, error: getError } = await supabase
      .from('company_extractions')
      .select('user_edits')
      .eq('company_id', companyId)
      .single();

    if (getError || !existing) {
      return NextResponse.json(
        { error: 'No extraction found to update' },
        { status: 404 }
      );
    }

    // Track which fields were edited
    const userEdits = existing.user_edits || {};
    for (const field of Object.keys(body)) {
      if (field !== 'status') {
        userEdits[field] = {
          edited_at: new Date().toISOString(),
          original_value: existing[field as keyof typeof existing],
        };
      }
    }

    // Update the extraction
    const { data: updated, error: updateError } = await supabase
      .from('company_extractions')
      .update({
        ...body,
        user_edits: userEdits,
        edited_at: new Date().toISOString(),
        status: 'reviewed',
      })
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      console.error('[Extract v6.1] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update extraction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      companyId,
      extraction: updated,
      message: 'Extraction updated successfully',
    });
  } catch (error) {
    console.error('[Extract v6.1] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update extraction' },
      { status: 500 }
    );
  }
}

// Helper function to extract structured data from research
function extractFromResearch(research: ResearchData & { confidence_score?: number }): Record<string, unknown> {
  const identity = research.canonical_identity || {};
  const findings = research.findings || {};
  const inferences = research.inferences || {};
  const techStack = research.tech_stack || [];
  const growthSignals = research.growth_signals || [];
  const timeline = research.timeline || [];
  const companyProfile = research.company_profile;

  // Debug: Log available keys
  console.log('[Extract v6.1] Available finding keys:', Object.keys(findings));
  console.log('[Extract v6.1] Available inference keys:', Object.keys(inferences));

  // Helper to get finding value by exact key
  const getFinding = (key: string): unknown => {
    const f = findings[key];
    return f?.value;
  };

  // Helper to get inference value by exact key
  const getInference = (key: string): unknown => {
    const i = inferences[key];
    return i?.value;
  };

  // Pattern-based search: find first finding matching a pattern
  const findFindingByPattern = (pattern: RegExp): unknown => {
    for (const key of Object.keys(findings)) {
      if (pattern.test(key)) {
        console.log(`[Extract v6.1] Pattern ${pattern} matched finding key: ${key}`);
        return findings[key]?.value;
      }
    }
    return undefined;
  };

  // Pattern-based search: find first inference matching a pattern
  const findInferenceByPattern = (pattern: RegExp): unknown => {
    for (const key of Object.keys(inferences)) {
      if (pattern.test(key)) {
        console.log(`[Extract v6.1] Pattern ${pattern} matched inference key: ${key}`);
        return inferences[key]?.value;
      }
    }
    return undefined;
  };

  // Find FSM vendor from tech stack
  const fsmTech = techStack.find(t => t.category === 'fsm');

  // Determine hiring activity from growth signals
  const hiringSignal = growthSignals.find(g =>
    g.signal.toLowerCase().includes('hiring') ||
    g.signal.toLowerCase().includes('job')
  );
  let hiringActivity: string = 'none';
  if (hiringSignal) {
    const value = String(hiringSignal.value).toLowerCase();
    if (value.includes('rapid') || value.includes('very high') || value.includes('multiple')) {
      hiringActivity = 'very_high';
    } else if (value.includes('high') || value.includes('significant')) {
      hiringActivity = 'high';
    } else if (value.includes('moderate') || value.includes('some')) {
      hiringActivity = 'moderate';
    } else {
      hiringActivity = 'low';
    }
  }

  // Check for expansion signals
  const hasGeoExpansion = growthSignals.some(g =>
    g.signal.toLowerCase().includes('location') ||
    g.signal.toLowerCase().includes('expansion') ||
    g.signal.toLowerCase().includes('geographic')
  );

  const hasServiceExpansion = growthSignals.some(g =>
    g.signal.toLowerCase().includes('service') ||
    g.signal.toLowerCase().includes('rebrand')
  );

  // Extract leadership - first from company_profile.leadership_bios, then from findings
  const leadershipTeam: Array<{ name: string; title: string; is_decision_maker: boolean; linkedin?: string; bio?: string }> = [];

  // 1. First, try company_profile.leadership_bios (from website scraping)
  if (companyProfile?.leadership_bios && companyProfile.leadership_bios.length > 0) {
    for (const leader of companyProfile.leadership_bios) {
      if (leader.name) {
        const titleLower = (leader.title || '').toLowerCase();
        const isDecisionMaker = titleLower.includes('ceo') || titleLower.includes('owner') ||
          titleLower.includes('president') || titleLower.includes('founder') ||
          titleLower.includes('vp') || titleLower.includes('director') ||
          titleLower.includes('chief');

        leadershipTeam.push({
          name: leader.name,
          title: leader.title || 'Leadership',
          is_decision_maker: isDecisionMaker,
          linkedin: leader.linkedin,
          bio: leader.bio || undefined,
        });
      }
    }
  }

  // 2. Then, add from findings if not already present
  const ceoName = getFinding('ceo_name') || getFinding('owner_name') || getFinding('owner_ceo');
  if (ceoName && !leadershipTeam.some(l => l.name.toLowerCase() === String(ceoName).toLowerCase())) {
    leadershipTeam.push({
      name: String(ceoName),
      title: 'CEO/Owner',
      is_decision_maker: true,
    });
  }

  // Add COO
  const cooName = getFinding('coo_name');
  if (cooName && !leadershipTeam.some(l => l.name.toLowerCase() === String(cooName).toLowerCase())) {
    leadershipTeam.push({
      name: String(cooName),
      title: 'COO',
      is_decision_maker: true,
    });
  }

  // Add VP
  const vpName = getFinding('vp_name');
  if (vpName && !leadershipTeam.some(l => l.name.toLowerCase() === String(vpName).toLowerCase())) {
    leadershipTeam.push({
      name: String(vpName),
      title: 'Vice President',
      is_decision_maker: true,
    });
  }

  // Handle co_owners if present
  const coOwners = getFinding('co_owners');
  if (coOwners && typeof coOwners === 'object') {
    for (const [key, title] of Object.entries(coOwners as Record<string, string>)) {
      const name = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (!leadershipTeam.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        leadershipTeam.push({
          name,
          title: String(title),
          is_decision_maker: true,
        });
      }
    }
  }

  console.log(`[Extract v6.1] Found ${leadershipTeam.length} leaders:`, leadershipTeam.map(l => l.name));

  // Extract revenue - use pattern matching to find any revenue-related data
  let revenue: number | null = null;
  let revenueYear: number | null = null;
  const revFinding = findFindingByPattern(/revenue/i) || findInferenceByPattern(/revenue/i);

  if (revFinding) {
    if (typeof revFinding === 'number') {
      revenue = revFinding;
      revenueYear = 2024;
    } else if (typeof revFinding === 'string') {
      // Parse string revenue like "$40M", "$6.7M", "40000000"
      const revStr = String(revFinding).replace(/[$,]/g, '');
      if (revStr.toLowerCase().includes('b')) {
        revenue = parseFloat(revStr) * 1_000_000_000;
      } else if (revStr.toLowerCase().includes('m')) {
        revenue = parseFloat(revStr) * 1_000_000;
      } else if (revStr.toLowerCase().includes('k')) {
        revenue = parseFloat(revStr) * 1_000;
      } else {
        revenue = parseFloat(revStr);
      }
      if (!isNaN(revenue)) {
        revenueYear = 2024;
      } else {
        revenue = null;
      }
    }
  }
  console.log(`[Extract v6.1] Revenue finding:`, revFinding, `-> parsed:`, revenue);

  // If no revenue found, calculate estimate from employee count
  let revenueRange: string | null = null;
  const empCountRaw = getFinding('employees') || getFinding('employee_count') ||
                      getInference('estimated_employees') || getInference('employee_count');
  const employeeCount = parseEmployeeCount(empCountRaw);

  if (!revenue && employeeCount) {
    // Use industry heuristic: $125K revenue per employee for service businesses
    const estimatedRevenue = employeeCount * 125000;
    revenue = estimatedRevenue;
    revenueYear = 2024;

    // Calculate range (±25%)
    const low = Math.round(estimatedRevenue * 0.75);
    const high = Math.round(estimatedRevenue * 1.25);
    revenueRange = formatRevenueRange(low, high);
    console.log(`[Extract v6.1] Calculated revenue from ${employeeCount} employees: ${revenueRange}`);
  } else {
    // Check for explicit revenue range
    const rangeVal = getFinding('revenue_range') || getInference('revenue_range');
    if (rangeVal && typeof rangeVal === 'string') {
      revenueRange = rangeVal;
    }
  }

  // Extract awards from findings
  const awards: Array<{ name: string; year?: number }> = [];
  const npmaAward = getFinding('npma_award');
  if (npmaAward) {
    awards.push({ name: String(npmaAward) });
  }
  const pctRank = getFinding('pct_rank_2024') || getFinding('pct_top_100_ranking');
  if (pctRank) {
    awards.push({ name: `PCT Top 100 - #${pctRank}`, year: 2024 });
  }

  return {
    // Identity
    company_name: identity.operating_name || null,
    legal_entity: identity.legal_entity || null,
    domain: identity.domain || null,
    hq_city: identity.hq_city || null,
    hq_state: identity.hq_state || null,

    // Ownership
    ownership_type: identity.ownership_type || null,
    family_generation: identity.family_generation || null,
    pe_firm: identity.pe_firm || null,
    franchise_brand: identity.franchise_brand || null,
    owner_name: ceoName || null,
    owner_title: 'CEO/Owner',

    // Size - check multiple keys and parse values
    employee_count: (() => {
      // Use pattern matching to find any employee-related data
      const empRaw = findFindingByPattern(/employee/i) || findInferenceByPattern(/employee/i);
      const empParsed = parseEmployeeCount(empRaw);
      console.log(`[Extract v6.1] Employee extraction: raw=${JSON.stringify(empRaw)} parsed=${empParsed}`);
      return empParsed;
    })(),
    employee_count_range: (() => {
      // Use pattern matching to find employee data that might be a range
      const rangeVal = findFindingByPattern(/employee/i) || findInferenceByPattern(/employee/i);
      console.log(`[Extract v6.1] employee_count_range check: rangeVal=${JSON.stringify(rangeVal)}, type=${typeof rangeVal}`);
      if (rangeVal && typeof rangeVal === 'string' && rangeVal.includes('-')) {
        console.log(`[Extract v6.1] Returning employee_count_range: ${rangeVal}`);
        return rangeVal;
      }
      return null;
    })(),
    location_count: parseNumber(
      // Use specific patterns to avoid matching "revenue_estimate_location"
      getFinding('location_count') || getFinding('locations') || getFinding('branch_count') ||
      getInference('location_count') || getInference('estimated_locations') ||
      findFindingByPattern(/^location_count$/i) || findFindingByPattern(/^(?:num_)?locations$/i)
    ),
    revenue,
    revenue_year: revenueYear,
    // revenue_range is calculated but saved to companies table, not extractions

    // Reputation
    founded_year: parseNumber(getFinding('founded_year')),
    years_in_business: parseNumber(getFinding('years_in_business')),
    bbb_rating: getFinding('bbb_rating') || null,
    google_rating: (() => {
      const rating = getFinding('google_rating');
      if (typeof rating === 'number') return rating;
      if (typeof rating === 'string') {
        const parsed = parseFloat(rating);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })(),

    // Industry Position
    pct_rank: parseNumber(pctRank),
    pct_rank_year: pctRank ? 2024 : null,
    industry_awards: awards,

    // Technology
    fsm_vendor: fsmTech?.vendor || null,
    fsm_confidence: fsmTech?.confidence || null,
    tech_stack: techStack,
    has_customer_portal: techStack.some(t => t.category === 'fsm'),

    // Growth Signals
    hiring_activity: hiringActivity,
    geographic_expansion: hasGeoExpansion,
    service_line_expansion: hasServiceExpansion,

    // Leadership
    leadership_team: leadershipTeam,

    // Timeline
    company_timeline: timeline,
  };
}
