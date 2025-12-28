/**
 * Pattern Learning Service
 *
 * Aggregates patterns from postmortems and successful/unsuccessful
 * approaches to identify what works and what doesn't.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface PatternLearning {
  id: string;
  pattern_type: string;
  pattern_name: string;
  pattern_description: string | null;
  times_successful: number;
  times_unsuccessful: number;
  success_rate: number | null;
  applicable_segments: string[];
  applicable_stages: string[];
  confidence: number;
  sample_size: number;
}

export interface PatternInsight {
  type: 'winning' | 'losing' | 'neutral';
  pattern: string;
  successRate: number;
  sampleSize: number;
  applicableTo: string[];
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Aggregate patterns from postmortems into pattern_learnings table
 */
export async function aggregatePostmortemPatterns(): Promise<{
  patternsUpdated: number;
  patternsCreated: number;
}> {
  const supabase = createAdminClient();
  let patternsUpdated = 0;
  let patternsCreated = 0;

  // Get all postmortems with their deal info
  const { data: postmortems } = await supabase
    .from('deal_postmortems')
    .select(`
      *,
      deal:deals(
        stage,
        company:companies(segment)
      )
    `);

  if (!postmortems || postmortems.length === 0) {
    return { patternsUpdated: 0, patternsCreated: 0 };
  }

  // Extract patterns
  const patternCounts = new Map<string, {
    type: string;
    name: string;
    successful: number;
    unsuccessful: number;
    segments: Set<string>;
    stages: Set<string>;
  }>();

  for (const pm of postmortems) {
    const isWin = pm.outcome === 'won';
    const segment = (pm.deal as any)?.company?.segment || 'unknown';
    const stage = (pm.deal as any)?.stage || 'unknown';

    // Process "what worked" items
    for (const item of pm.what_worked || []) {
      const key = `approach:${item.toLowerCase()}`;
      const existing = patternCounts.get(key) || {
        type: 'approach',
        name: item,
        successful: 0,
        unsuccessful: 0,
        segments: new Set(),
        stages: new Set(),
      };

      if (isWin) {
        existing.successful++;
      }
      existing.segments.add(segment);
      existing.stages.add(stage);
      patternCounts.set(key, existing);
    }

    // Process "what didn't work" items
    for (const item of pm.what_didnt_work || []) {
      const key = `approach:${item.toLowerCase()}`;
      const existing = patternCounts.get(key) || {
        type: 'approach',
        name: item,
        successful: 0,
        unsuccessful: 0,
        segments: new Set(),
        stages: new Set(),
      };

      if (!isWin) {
        existing.unsuccessful++;
      }
      existing.segments.add(segment);
      existing.stages.add(stage);
      patternCounts.set(key, existing);
    }

    // Process primary reason as a pattern
    if (pm.primary_reason) {
      const key = `reason:${pm.primary_reason.toLowerCase()}`;
      const existing = patternCounts.get(key) || {
        type: isWin ? 'win_factor' : 'loss_factor',
        name: pm.primary_reason,
        successful: 0,
        unsuccessful: 0,
        segments: new Set(),
        stages: new Set(),
      };

      if (isWin) {
        existing.successful++;
      } else {
        existing.unsuccessful++;
      }
      existing.segments.add(segment);
      existing.stages.add(stage);
      patternCounts.set(key, existing);
    }
  }

  // Upsert patterns to database
  for (const [key, data] of patternCounts) {
    const totalSamples = data.successful + data.unsuccessful;
    const successRate = totalSamples > 0
      ? Math.round((data.successful / totalSamples) * 100)
      : null;

    // Calculate confidence based on sample size
    const confidence = Math.min(95, 30 + totalSamples * 10);

    const { data: existing } = await supabase
      .from('pattern_learnings')
      .select('id')
      .eq('pattern_type', data.type)
      .eq('pattern_name', data.name)
      .single();

    if (existing) {
      await supabase
        .from('pattern_learnings')
        .update({
          times_successful: data.successful,
          times_unsuccessful: data.unsuccessful,
          success_rate: successRate,
          applicable_segments: Array.from(data.segments),
          applicable_stages: Array.from(data.stages),
          confidence,
          sample_size: totalSamples,
        })
        .eq('id', existing.id);
      patternsUpdated++;
    } else {
      await supabase
        .from('pattern_learnings')
        .insert({
          pattern_type: data.type,
          pattern_name: data.name,
          times_successful: data.successful,
          times_unsuccessful: data.unsuccessful,
          success_rate: successRate,
          applicable_segments: Array.from(data.segments),
          applicable_stages: Array.from(data.stages),
          confidence,
          sample_size: totalSamples,
        });
      patternsCreated++;
    }
  }

  return { patternsUpdated, patternsCreated };
}

/**
 * Get winning patterns (high success rate approaches)
 */
export async function getWinningPatterns(
  segment?: string,
  stage?: string,
  limit: number = 10
): Promise<PatternInsight[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('pattern_learnings')
    .select('*')
    .gte('success_rate', 60)
    .gte('sample_size', 2)
    .order('success_rate', { ascending: false })
    .limit(limit);

  if (segment) {
    query = query.contains('applicable_segments', [segment]);
  }
  if (stage) {
    query = query.contains('applicable_stages', [stage]);
  }

  const { data: patterns } = await query;

  return (patterns || []).map(p => ({
    type: 'winning' as const,
    pattern: p.pattern_name,
    successRate: p.success_rate || 0,
    sampleSize: p.sample_size || 0,
    applicableTo: [...(p.applicable_segments || []), ...(p.applicable_stages || [])],
  }));
}

/**
 * Get losing patterns (low success rate approaches)
 */
export async function getLosingPatterns(
  segment?: string,
  stage?: string,
  limit: number = 10
): Promise<PatternInsight[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('pattern_learnings')
    .select('*')
    .lte('success_rate', 40)
    .gte('sample_size', 2)
    .order('success_rate', { ascending: true })
    .limit(limit);

  if (segment) {
    query = query.contains('applicable_segments', [segment]);
  }
  if (stage) {
    query = query.contains('applicable_stages', [stage]);
  }

  const { data: patterns } = await query;

  return (patterns || []).map(p => ({
    type: 'losing' as const,
    pattern: p.pattern_name,
    successRate: p.success_rate || 0,
    sampleSize: p.sample_size || 0,
    applicableTo: [...(p.applicable_segments || []), ...(p.applicable_stages || [])],
  }));
}

/**
 * Get relevant patterns for a specific deal context
 */
export async function getRelevantPatterns(
  segment: string,
  stage: string
): Promise<{
  winning: PatternInsight[];
  losing: PatternInsight[];
}> {
  const [winning, losing] = await Promise.all([
    getWinningPatterns(segment, stage, 5),
    getLosingPatterns(segment, stage, 5),
  ]);

  return { winning, losing };
}

/**
 * Get pattern recommendations for account memory
 */
export async function getPatternRecommendations(
  companyId: string
): Promise<{
  tryThese: string[];
  avoidThese: string[];
}> {
  const supabase = createAdminClient();

  // Get company segment
  const { data: company } = await supabase
    .from('companies')
    .select('segment')
    .eq('id', companyId)
    .single();

  const segment = company?.segment || 'smb';

  // Get winning patterns for this segment
  const winning = await getWinningPatterns(segment, undefined, 3);
  const losing = await getLosingPatterns(segment, undefined, 3);

  return {
    tryThese: winning.map(p => p.pattern),
    avoidThese: losing.map(p => p.pattern),
  };
}
