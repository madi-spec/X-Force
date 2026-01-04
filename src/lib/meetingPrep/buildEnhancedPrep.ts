/**
 * Enhanced Meeting Prep Builder
 *
 * Orchestrates meeting prep by combining:
 * - EXISTING AI prep generation functions
 * - NEW collateral matching
 * - NEW software links
 * - NEW persisted notes
 *
 * IMPORTANT: This module REUSES existing prep functions, not recreates them.
 */

import {
  generateContextAwareMeetingPrep,
  hasRichContext,
  type MeetingInfo,
  type FullMeetingPrep,
} from '@/lib/intelligence/generateMeetingPrep';
import {
  generateCompleteMeetingPrep,
  enrichAttendees,
} from '@/lib/commandCenter/meetingPrep';
import type { MeetingAttendee } from '@/types/commandCenter';
import { getMatchingCollateral, type ScoredCollateral } from '@/lib/collateral/matching';
import { inferMeetingType } from '@/lib/collateral/inferMeetingType';
import type { MeetingType, ProductTag, IndustryTag, CompanySizeTag } from '@/types/collateral';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface EnhancedDealContext {
  id: string;
  name: string;
  stage: string;
  value: number | null;
  health_score: number | null;
  products: { voice: boolean; platform: boolean };
  competitor?: string | null;
}

export interface EnhancedCompanyContext {
  id: string;
  name: string;
  industry: string | null;
  segment: string | null;
}

export interface SoftwareLink {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
}

export interface PastContextLink {
  type: 'deal' | 'intelligence' | 'transcript' | 'meeting';
  label: string;
  url: string;
}

export interface PrepNotes {
  prep_notes: string | null;
  meeting_notes: string | null;
}

export interface EnhancedMeetingPrep {
  meeting: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    joinUrl?: string | null;
    meetingType: MeetingType;
    durationMinutes: number;
  };
  attendees: MeetingAttendee[];
  deal: EnhancedDealContext | null;
  company: EnhancedCompanyContext | null;
  aiPrep: {
    objective: string;
    talking_points: string[];
    landmines: string[];
    questions_to_ask: string[];
    quick_context?: string;
    relationship_status?: {
      deal_stage: string | null;
      deal_value: number | null;
      sentiment: string | null;
      total_interactions: number;
    };
  };
  collateral: ScoredCollateral[];
  softwareLinks: SoftwareLink[];
  pastContext: PastContextLink[];
  notes: PrepNotes | null;
  generatedAt: string;
}

export interface MeetingInput {
  title: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  joinUrl?: string | null;
  dealId?: string | null;
  companyId?: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate meeting duration in minutes from start and end times
 */
function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / 60000);
}

/**
 * Get deal context from database
 */
async function getDealContext(
  dealId: string
): Promise<{ deal: EnhancedDealContext; companyId: string | null } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('deals')
    .select('id, name, stage, estimated_value, health_score, products, competitor_mentioned, organization_id')
    .eq('id', dealId)
    .single();

  if (error || !data) {
    console.error('[EnhancedPrep] Error fetching deal:', error);
    return null;
  }

  return {
    deal: {
      id: data.id,
      name: data.name,
      stage: data.stage,
      value: data.estimated_value,
      health_score: data.health_score,
      products: data.products || { voice: false, platform: false },
      competitor: data.competitor_mentioned,
    },
    companyId: data.organization_id,
  };
}

/**
 * Get company context from database
 */
async function getCompanyContext(
  companyId: string
): Promise<EnhancedCompanyContext | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, industry, segment')
    .eq('id', companyId)
    .single();

  if (error || !data) {
    console.error('[EnhancedPrep] Error fetching company:', error);
    return null;
  }

  return data;
}

/**
 * Get software links matching the meeting context
 */
async function getSoftwareLinks(meetingType: MeetingType): Promise<SoftwareLink[]> {
  const supabase = createAdminClient();

  // Get all active links
  const { data, error } = await supabase
    .from('software_links')
    .select('id, name, description, url, icon, show_for_meeting_types')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) {
    console.error('[EnhancedPrep] Error fetching software links:', error);
    return [];
  }

  // Filter by meeting type - include if array is empty (show for all) or contains the type
  return data.filter((link) => {
    const types = link.show_for_meeting_types as string[] | null;
    return !types || types.length === 0 || types.includes(meetingType);
  }).map((link) => ({
    id: link.id,
    name: link.name,
    description: link.description,
    url: link.url,
    icon: link.icon,
  }));
}

/**
 * Get existing prep notes for this meeting and user
 */
async function getExistingNotes(
  meetingId: string,
  userId: string
): Promise<PrepNotes | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('meeting_prep_notes')
    .select('prep_notes, meeting_notes')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Build past context links (deals, company intel, transcripts)
 */
async function buildPastContextLinks(
  deal: EnhancedDealContext | null,
  company: EnhancedCompanyContext | null,
  companyId: string | null
): Promise<PastContextLink[]> {
  const supabase = createAdminClient();
  const links: PastContextLink[] = [];

  // Add deal link
  if (deal) {
    links.push({
      type: 'deal',
      label: `Deal: ${deal.name}`,
      url: `/deals/${deal.id}`,
    });
  }

  // Add company intelligence link
  if (company) {
    links.push({
      type: 'intelligence',
      label: `${company.name} Intelligence`,
      url: `/companies/${company.id}/intelligence`,
    });
  }

  // Add recent transcripts
  if (companyId) {
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date')
      .eq('company_id', companyId)
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (transcripts?.length) {
      for (const tx of transcripts) {
        const date = new Date(tx.meeting_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        links.push({
          type: 'transcript',
          label: `${date}: ${tx.title}`,
          url: `/meetings/transcriptions/${tx.id}`,
        });
      }
    }
  }

  return links;
}

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Build enhanced meeting prep with all contextual data
 *
 * This function orchestrates:
 * 1. Deal and company context lookup
 * 2. Meeting type inference
 * 3. EXISTING AI prep generation (generateContextAwareMeetingPrep or generateCompleteMeetingPrep)
 * 4. Collateral matching
 * 5. Software links
 * 6. User notes
 * 7. Past context links
 */
export async function buildEnhancedMeetingPrep(
  userId: string,
  meetingId: string,
  meetingData: MeetingInput
): Promise<EnhancedMeetingPrep> {
  console.log(`[EnhancedPrep] Building prep for meeting: ${meetingData.title}`);

  // 1. Get deal and company context
  let deal: EnhancedDealContext | null = null;
  let company: EnhancedCompanyContext | null = null;
  let companyId = meetingData.companyId;

  if (meetingData.dealId) {
    const dealResult = await getDealContext(meetingData.dealId);
    if (dealResult) {
      deal = dealResult.deal;
      // Use company from deal if not provided
      if (!companyId && dealResult.companyId) {
        companyId = dealResult.companyId;
      }
    }
  }

  if (companyId) {
    company = await getCompanyContext(companyId);
  }

  // 2. Infer meeting type from title and deal stage
  const meetingType = inferMeetingType(meetingData.title, deal?.stage);
  console.log(`[EnhancedPrep] Inferred meeting type: ${meetingType}`);

  // 3. Calculate duration
  const durationMinutes = calculateDuration(meetingData.startTime, meetingData.endTime);

  // 4. Use EXISTING prep generation functions
  // Try rich context first if available, fall back to basic
  let aiPrep: EnhancedMeetingPrep['aiPrep'];
  let attendees: MeetingAttendee[] = [];

  const hasRich = await hasRichContext(meetingData.attendeeEmails);
  console.log(`[EnhancedPrep] Has rich context: ${hasRich}`);

  if (hasRich) {
    // Use the rich context-aware prep
    const meetingInfo: MeetingInfo = {
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      duration_minutes: durationMinutes,
      attendeeEmails: meetingData.attendeeEmails,
      dealId: meetingData.dealId,
      companyId: companyId,
      joinUrl: meetingData.joinUrl,
    };

    const richPrep: FullMeetingPrep = await generateContextAwareMeetingPrep(meetingInfo);

    aiPrep = {
      objective: richPrep.prep.suggested_goals?.join('. ') || '',
      talking_points: richPrep.prep.talking_points || [],
      landmines: richPrep.prep.watch_out || [],
      questions_to_ask: [],
      quick_context: richPrep.prep.quick_context,
      relationship_status: {
        deal_stage: richPrep.prep.relationship_status?.deal_stage || null,
        deal_value: richPrep.prep.relationship_status?.deal_value || null,
        sentiment: richPrep.prep.relationship_status?.sentiment || null,
        total_interactions: richPrep.prep.relationship_status?.total_interactions || 0,
      },
    };

    // Map attendees from rich prep
    attendees = richPrep.attendees.map((a): MeetingAttendee => ({
      email: a.email,
      name: a.name,
      title: a.title,
      role: (a.role as MeetingAttendee['role']) || 'unknown',
    }));
  } else {
    // Use the basic prep
    const basicPrep = await generateCompleteMeetingPrep(userId, {
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      attendeeEmails: meetingData.attendeeEmails,
      dealId: meetingData.dealId,
      companyId: companyId,
    });

    aiPrep = {
      objective: basicPrep.prep.objective || '',
      talking_points: basicPrep.prep.talking_points || [],
      landmines: basicPrep.prep.landmines || [],
      questions_to_ask: basicPrep.prep.questions_to_ask || [],
    };

    attendees = basicPrep.attendees;
  }

  // 5. Get matching collateral (NEW functionality)
  const products: ProductTag[] = [];
  if (deal?.products?.voice) products.push('voice_agent');
  if (deal?.products?.platform) {
    products.push('performance_center', 'action_hub', 'platform');
  }

  const collateral = await getMatchingCollateral({
    meetingType,
    products,
    industry: (company?.industry as IndustryTag) || undefined,
    companySize: (company?.segment as CompanySizeTag) || undefined,
  });
  console.log(`[EnhancedPrep] Matched ${collateral.length} collateral items`);

  // 6. Get software links (NEW functionality)
  const softwareLinks = await getSoftwareLinks(meetingType);

  // 7. Get existing prep notes (NEW functionality)
  const notes = await getExistingNotes(meetingId, userId);

  // 8. Build past context links
  const pastContext = await buildPastContextLinks(deal, company, companyId ?? null);

  // If we don't have enriched attendees, enrich them now
  if (attendees.length === 0 && meetingData.attendeeEmails.length > 0) {
    attendees = await enrichAttendees(meetingData.attendeeEmails, companyId ?? null);
  }

  return {
    meeting: {
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      joinUrl: meetingData.joinUrl,
      meetingType,
      durationMinutes,
    },
    attendees,
    deal,
    company,
    aiPrep,
    collateral,
    softwareLinks,
    pastContext,
    notes,
    generatedAt: new Date().toISOString(),
  };
}
