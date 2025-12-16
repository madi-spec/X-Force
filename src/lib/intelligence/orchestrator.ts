/**
 * Intelligence Collection Orchestrator
 * Coordinates all collectors and synthesizes results
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { websiteCollector } from './collectors/websiteCollector';
import { facebookCollector } from './collectors/facebookCollector';
import { googleReviewsCollector } from './collectors/googleReviewsCollector';
import { apolloCompanyCollector } from './collectors/apolloCompanyCollector';
import { apolloPeopleCollector } from './collectors/apolloPeopleCollector';
import { industryCollector } from './collectors/industryCollector';
import {
  synthesizeIntelligence,
  saveIntelligence,
  getIntelligence,
  isIntelligenceStale,
} from './synthesis/intelligenceSynthesis';
import type {
  CollectionRequest,
  CollectionResult,
  CollectionProgress,
  AccountIntelligence,
  IntelligenceSource,
  ContactIntelligence,
  IndustryMention,
  IntelligenceSourceType,
  CollectorResult,
  ApolloPeopleData,
  IndustryMentionsData,
} from './types';

// ============================================
// CONSTANTS
// ============================================

const ALL_SOURCES: IntelligenceSourceType[] = [
  'website',
  'facebook',
  'google_reviews',
  'linkedin_company',
  'linkedin_people',
  'industry_mentions',
];

// ============================================
// ORCHESTRATOR
// ============================================

/**
 * Main entry point for intelligence collection
 */
export async function collectIntelligence(
  request: CollectionRequest
): Promise<CollectionResult> {
  const { companyId, companyName, domain, sources = ALL_SOURCES, force = false } = request;
  const startTime = Date.now();
  const supabase = createAdminClient();

  console.log(`[Orchestrator] Starting collection for ${companyName} (${companyId})`);

  // Check if we need to collect
  if (!force) {
    const isStale = await isIntelligenceStale(companyId);
    if (!isStale) {
      console.log(`[Orchestrator] Intelligence is fresh, skipping collection`);
      const existing = await getIntelligence(companyId);
      if (existing) {
        return {
          companyId,
          success: true,
          intelligence: existing,
          sources: [],
          contacts: [],
          mentions: [],
          totalDurationMs: Date.now() - startTime,
        };
      }
    }
  }

  // Create or get intelligence record
  let intelligence = await getOrCreateIntelligence(companyId);

  // Update status to collecting
  await updateIntelligenceStatus(intelligence.id, 'collecting');

  const sourceResults: CollectionResult['sources'] = [];
  const allContacts: ContactIntelligence[] = [];
  const allMentions: IndustryMention[] = [];
  const collectedSources: IntelligenceSource[] = [];

  // Run collectors
  for (const sourceType of sources) {
    console.log(`[Orchestrator] Collecting ${sourceType}...`);

    try {
      const result = await runCollector(sourceType, companyName, domain);

      sourceResults.push({
        type: sourceType,
        success: result.success,
        qualityScore: result.qualityScore,
        error: result.error,
      });

      if (result.success && result.data) {
        // Save source to database
        const savedSource = await saveSource(intelligence.id, sourceType, result);
        collectedSources.push(savedSource);

        // Handle special cases (contacts, mentions)
        if (sourceType === 'linkedin_people' && result.data) {
          const peopleData = result.data as ApolloPeopleData;
          const contacts = await saveContacts(companyId, peopleData);
          allContacts.push(...contacts);
        }

        if (sourceType === 'industry_mentions' && result.data) {
          const mentionsData = result.data as IndustryMentionsData;
          const mentions = await saveMentions(companyId, mentionsData);
          allMentions.push(...mentions);
        }
      }
    } catch (error) {
      console.error(`[Orchestrator] Error collecting ${sourceType}:`, error);
      sourceResults.push({
        type: sourceType,
        success: false,
        qualityScore: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Synthesize intelligence if we have data
  const successfulSources = collectedSources.filter((s) => s.processed_data);

  if (successfulSources.length > 0) {
    try {
      console.log(`[Orchestrator] Synthesizing ${successfulSources.length} sources...`);

      const { synthesis, contextHash } = await synthesizeIntelligence(
        companyId,
        companyName,
        successfulSources
      );

      intelligence = await saveIntelligence(companyId, synthesis, contextHash);
    } catch (error) {
      console.error('[Orchestrator] Synthesis failed:', error);
      await updateIntelligenceStatus(intelligence.id, 'partial', error instanceof Error ? error.message : 'Synthesis failed');
    }
  } else {
    await updateIntelligenceStatus(intelligence.id, 'failed', 'No source data collected');
  }

  console.log(`[Orchestrator] Collection complete in ${Date.now() - startTime}ms`);

  return {
    companyId,
    success: successfulSources.length > 0,
    intelligence,
    sources: sourceResults,
    contacts: allContacts,
    mentions: allMentions,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * Get collection progress
 */
export async function getCollectionProgress(
  companyId: string
): Promise<CollectionProgress | null> {
  const intelligence = await getIntelligence(companyId);
  if (!intelligence) return null;

  const supabase = createAdminClient();

  // Get source statuses
  const { data: sources } = await supabase
    .from('intelligence_sources')
    .select('source_type, error_message, collected_at')
    .eq('account_intelligence_id', intelligence.id);

  const completedSources = (sources || [])
    .filter((s) => s.collected_at && !s.error_message)
    .map((s) => s.source_type as IntelligenceSourceType);

  const failedSources = (sources || [])
    .filter((s) => s.error_message)
    .map((s) => s.source_type as IntelligenceSourceType);

  return {
    companyId,
    status: intelligence.collection_status as CollectionProgress['status'],
    sourcesTotal: ALL_SOURCES.length,
    sourcesCompleted: completedSources.length,
    sourcesInProgress: intelligence.collection_status === 'collecting'
      ? ALL_SOURCES.filter((s) => !completedSources.includes(s) && !failedSources.includes(s))
      : [],
    sourcesFailed: failedSources,
    startedAt: intelligence.created_at,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getOrCreateIntelligence(companyId: string): Promise<AccountIntelligence> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('account_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (existing) return existing as AccountIntelligence;

  const { data: created, error } = await supabase
    .from('account_intelligence')
    .insert({
      company_id: companyId,
      collection_status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return created as AccountIntelligence;
}

async function updateIntelligenceStatus(
  intelligenceId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('account_intelligence')
    .update({
      collection_status: status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intelligenceId);
}

async function runCollector(
  sourceType: IntelligenceSourceType,
  companyName: string,
  domain: string | null
): Promise<CollectorResult<unknown>> {
  switch (sourceType) {
    case 'website':
      return websiteCollector.collect(companyName, domain);
    case 'facebook':
      return facebookCollector.collect(companyName, domain);
    case 'google_reviews':
      return googleReviewsCollector.collect(companyName, domain);
    case 'linkedin_company':
      return apolloCompanyCollector.collect(companyName, domain);
    case 'linkedin_people':
      return apolloPeopleCollector.collect(companyName, domain);
    case 'industry_mentions':
      return industryCollector.collect(companyName, domain);
    default:
      return {
        success: false,
        data: null,
        error: `Unknown source type: ${sourceType}`,
        qualityScore: 0,
        durationMs: 0,
      };
  }
}

async function saveSource(
  intelligenceId: string,
  sourceType: IntelligenceSourceType,
  result: CollectorResult<unknown>
): Promise<IntelligenceSource> {
  const supabase = createAdminClient();

  // Check if source exists
  const { data: existing } = await supabase
    .from('intelligence_sources')
    .select('id')
    .eq('account_intelligence_id', intelligenceId)
    .eq('source_type', sourceType)
    .single();

  const sourceData = {
    account_intelligence_id: intelligenceId,
    source_type: sourceType,
    raw_data: result.data,
    processed_data: result.data,
    quality_score: result.qualityScore,
    collected_at: new Date().toISOString(),
    collection_duration_ms: result.durationMs,
    error_message: result.error,
  };

  if (existing) {
    const { data, error } = await supabase
      .from('intelligence_sources')
      .update(sourceData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as IntelligenceSource;
  } else {
    const { data, error } = await supabase
      .from('intelligence_sources')
      .insert(sourceData)
      .select()
      .single();

    if (error) throw error;
    return data as IntelligenceSource;
  }
}

async function saveContacts(
  companyId: string,
  peopleData: ApolloPeopleData
): Promise<ContactIntelligence[]> {
  const supabase = createAdminClient();
  const savedContacts: ContactIntelligence[] = [];

  for (const person of peopleData.people) {
    try {
      // Check if contact exists (by Apollo ID or email)
      const { data: existing } = await supabase
        .from('contact_intelligence')
        .select('id')
        .eq('company_id', companyId)
        .or(`apollo_id.eq.${person.apolloId},email.eq.${person.email || 'none'}`)
        .single();

      const contactData = {
        company_id: companyId,
        full_name: person.fullName,
        title: person.title,
        department: person.department,
        seniority: person.seniority,
        linkedin_url: person.linkedinUrl,
        email: person.email,
        phone: person.phone,
        apollo_id: person.apolloId,
        headline: person.headline,
        photo_url: person.photoUrl,
        is_decision_maker: ['c_level', 'owner', 'partner', 'vp', 'director'].includes(
          person.seniority || ''
        ),
        source: 'apollo' as const,
        collected_at: new Date().toISOString(),
      };

      if (existing) {
        const { data } = await supabase
          .from('contact_intelligence')
          .update(contactData)
          .eq('id', existing.id)
          .select()
          .single();

        if (data) savedContacts.push(data as ContactIntelligence);
      } else {
        const { data } = await supabase
          .from('contact_intelligence')
          .insert(contactData)
          .select()
          .single();

        if (data) savedContacts.push(data as ContactIntelligence);
      }
    } catch (error) {
      console.error(`[Orchestrator] Error saving contact ${person.fullName}:`, error);
    }
  }

  return savedContacts;
}

async function saveMentions(
  companyId: string,
  mentionsData: IndustryMentionsData
): Promise<IndustryMention[]> {
  const supabase = createAdminClient();
  const savedMentions: IndustryMention[] = [];

  for (const mention of mentionsData.mentions) {
    try {
      // Check if mention exists (by URL)
      const { data: existing } = await supabase
        .from('industry_mentions')
        .select('id')
        .eq('company_id', companyId)
        .eq('source_url', mention.url)
        .single();

      const mentionData = {
        company_id: companyId,
        mention_type: mention.mentionType,
        title: mention.title,
        source_name: mention.source,
        source_url: mention.url,
        published_at: mention.publishedAt,
        summary: mention.snippet,
        sentiment: mention.sentiment,
        relevance_score: mention.relevanceScore,
        search_query: mention.searchQuery,
        serp_position: mention.serpPosition,
        collected_at: new Date().toISOString(),
      };

      if (existing) {
        const { data } = await supabase
          .from('industry_mentions')
          .update(mentionData)
          .eq('id', existing.id)
          .select()
          .single();

        if (data) savedMentions.push(data as IndustryMention);
      } else {
        const { data } = await supabase
          .from('industry_mentions')
          .insert(mentionData)
          .select()
          .single();

        if (data) savedMentions.push(data as IndustryMention);
      }
    } catch (error) {
      console.error(`[Orchestrator] Error saving mention ${mention.title}:`, error);
    }
  }

  return savedMentions;
}

// ============================================
// EXPORTS
// ============================================

export { getIntelligence, isIntelligenceStale };
