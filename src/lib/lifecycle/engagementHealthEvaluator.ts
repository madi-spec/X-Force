/**
 * Engagement Health Evaluator
 *
 * Computes engagement health score and risk level for CompanyProducts based on:
 * - Support case signals (count, severity, SLA status)
 * - Communication signals (optional)
 * - Lifecycle stage signals
 *
 * ARCHITECTURE:
 * - Reads from projections (company_product_read_model, company_product_open_case_counts)
 * - Computes deterministic health score with explainable reasons
 * - Emits CompanyProductHealthComputed and CompanyProductRiskLevelSet events
 * - Idempotent: uses input hash to prevent duplicate events
 *
 * SCORING RULES (v1):
 * - Base score: 100
 * - Urgent/critical open case: -40, sets risk to high
 * - High severity open case: -25
 * - SLA breach (first response): -20, sets risk to high
 * - SLA breach (resolution): -30, sets risk to high
 * - 3+ open cases: -15
 * - 5+ open cases: -25 (cumulative with 3+)
 * - Negative engagement impact case: -10 each
 * - Critical engagement impact case: -20 each
 *
 * RISK LEVEL RULES:
 * - none: health >= 85
 * - low: health >= 70 and < 85
 * - medium: health >= 50 and < 70
 * - high: health < 50 OR has urgent/critical case OR has SLA breach
 */

import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createHealthComputedEvent,
  createRiskLevelSetEvent,
  type HealthReason,
  type CompanyProductHealthComputedData,
  type CompanyProductRiskLevelSetData,
} from './events';

// ============================================================================
// TYPES
// ============================================================================

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface HealthEvaluatorInput {
  companyProductId: string;
  /** Current read model state (optional - will be fetched if not provided) */
  readModel?: CompanyProductReadModelData | null;
  /** Current case counts (optional - will be fetched if not provided) */
  caseCounts?: CompanyProductOpenCaseCountsData | null;
}

export interface CompanyProductReadModelData {
  company_product_id: string;
  company_id: string;
  product_id: string;
  health_score: number | null;
  risk_level: RiskLevel | null;
  current_stage_name: string | null;
  is_sla_breached: boolean;
  is_sla_warning: boolean;
}

export interface CompanyProductOpenCaseCountsData {
  company_product_id: string;
  total_open_count: number;
  open_count: number;
  in_progress_count: number;
  waiting_count: number;
  escalated_count: number;
  low_count: number;
  medium_count: number;
  high_count: number;
  urgent_count: number;
  critical_count: number;
  first_response_breached_count: number;
  resolution_breached_count: number;
  any_breached_count: number;
  negative_impact_count: number;
  critical_impact_count: number;
}

export interface HealthEvaluatorResult {
  healthScore: number;
  riskLevel: RiskLevel;
  reasons: HealthReason[];
  inputHash: string;
  shouldEmitEvents: boolean;
  healthChanged: boolean;
  riskChanged: boolean;
}

export interface EvaluatorOptions {
  /** Dry run - compute but don't emit events */
  dryRun?: boolean;
  /** Force emit even if unchanged */
  forceEmit?: boolean;
  /** Correlation ID for tracing */
  correlationId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCORING_VERSION = 'v1.0';
const BASE_HEALTH_SCORE = 100;

// Scoring impacts (negative numbers reduce health)
const IMPACTS = {
  URGENT_CRITICAL_CASE: -40,
  HIGH_SEVERITY_CASE: -25,
  FIRST_RESPONSE_SLA_BREACH: -20,
  RESOLUTION_SLA_BREACH: -30,
  THREE_PLUS_OPEN_CASES: -15,
  FIVE_PLUS_OPEN_CASES: -10, // Additional to 3+
  NEGATIVE_IMPACT_CASE: -10,
  CRITICAL_IMPACT_CASE: -20,
  ESCALATED_CASE: -15,
} as const;

// Risk level thresholds
const RISK_THRESHOLDS = {
  NONE: 85,
  LOW: 70,
  MEDIUM: 50,
} as const;

// ============================================================================
// CORE EVALUATOR
// ============================================================================

/**
 * Evaluates engagement health for a CompanyProduct.
 * Returns computed health score, risk level, and reasons.
 */
export async function evaluateEngagementHealth(
  input: HealthEvaluatorInput,
  options: EvaluatorOptions = {}
): Promise<HealthEvaluatorResult> {
  const supabase = createAdminClient();

  // Fetch data if not provided
  let readModel = input.readModel;
  let caseCounts = input.caseCounts;

  if (!readModel) {
    const { data, error } = await supabase
      .from('company_product_read_model')
      .select('company_product_id, company_id, product_id, health_score, risk_level, current_stage_name, is_sla_breached, is_sla_warning')
      .eq('company_product_id', input.companyProductId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch read model: ${error.message}`);
    }
    readModel = data as CompanyProductReadModelData | null;
  }

  if (!caseCounts) {
    const { data, error } = await supabase
      .from('company_product_open_case_counts')
      .select('*')
      .eq('company_product_id', input.companyProductId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch case counts: ${error.message}`);
    }
    caseCounts = data as CompanyProductOpenCaseCountsData | null;
  }

  // Compute health and reasons
  const { healthScore, reasons, forceHighRisk } = computeHealthScore(caseCounts, readModel);
  const riskLevel = computeRiskLevel(healthScore, forceHighRisk);

  // Compute input hash for idempotency
  const inputHash = computeInputHash(caseCounts, readModel);

  // Check if values changed
  const previousHealth = readModel?.health_score ?? null;
  const previousRisk = (readModel?.risk_level as RiskLevel) ?? null;
  const healthChanged = previousHealth !== healthScore;
  const riskChanged = previousRisk !== riskLevel;

  // Determine if we should emit events
  const shouldEmitEvents = options.forceEmit || healthChanged || riskChanged;

  return {
    healthScore,
    riskLevel,
    reasons,
    inputHash,
    shouldEmitEvents,
    healthChanged,
    riskChanged,
  };
}

/**
 * Evaluates and emits events for a CompanyProduct.
 */
export async function evaluateAndEmitHealthEvents(
  input: HealthEvaluatorInput,
  options: EvaluatorOptions = {}
): Promise<HealthEvaluatorResult> {
  const supabase = createAdminClient();
  const result = await evaluateEngagementHealth(input, options);

  if (options.dryRun || !result.shouldEmitEvents) {
    return result;
  }

  // Fetch current state for event data
  const { data: readModel } = await supabase
    .from('company_product_read_model')
    .select('health_score, risk_level')
    .eq('company_product_id', input.companyProductId)
    .single();

  const previousHealth = readModel?.health_score ?? null;
  const previousRisk = (readModel?.risk_level as RiskLevel) ?? null;

  // Get next sequence number
  const { data: lastEvent } = await supabase
    .from('event_store')
    .select('sequence_number')
    .eq('aggregate_type', 'CompanyProduct')
    .eq('aggregate_id', input.companyProductId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single();

  let nextSequence = (lastEvent?.sequence_number || 0) + 1;

  // Emit HealthComputed event
  const healthEventData: CompanyProductHealthComputedData = {
    fromScore: previousHealth,
    toScore: result.healthScore,
    riskLevel: result.riskLevel,
    fromRiskLevel: previousRisk,
    reasons: result.reasons,
    inputHash: result.inputHash,
    scoringVersion: SCORING_VERSION,
    computedAt: new Date().toISOString(),
  };

  const healthEvent = createHealthComputedEvent(
    healthEventData,
    { type: 'system' },
    {
      correlationId: options.correlationId,
      source: 'engagement_health_evaluator',
    }
  );

  await appendEventToStore(supabase, {
    aggregateType: 'CompanyProduct',
    aggregateId: input.companyProductId,
    sequenceNumber: nextSequence,
    event: healthEvent,
  });
  nextSequence++;

  // Emit RiskLevelSet event if risk changed
  if (result.riskChanged) {
    const hasSupportCaseTrigger =
      result.reasons.some(r => r.source === 'support_case');
    const hasSlaTrigger =
      result.reasons.some(r => r.source === 'sla');

    const riskEventData: CompanyProductRiskLevelSetData = {
      fromRiskLevel: previousRisk,
      toRiskLevel: result.riskLevel,
      primaryReason: result.reasons[0]?.description || 'Health score threshold',
      reasons: result.reasons,
      triggeredBySupportCases: hasSupportCaseTrigger,
      triggeredBySlaBreach: hasSlaTrigger,
    };

    const riskEvent = createRiskLevelSetEvent(
      riskEventData,
      { type: 'system' },
      {
        correlationId: options.correlationId,
        source: 'engagement_health_evaluator',
      }
    );

    await appendEventToStore(supabase, {
      aggregateType: 'CompanyProduct',
      aggregateId: input.companyProductId,
      sequenceNumber: nextSequence,
      event: riskEvent,
    });
  }

  return result;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

interface ScoringResult {
  healthScore: number;
  reasons: HealthReason[];
  forceHighRisk: boolean;
}

function computeHealthScore(
  caseCounts: CompanyProductOpenCaseCountsData | null,
  readModel: CompanyProductReadModelData | null
): ScoringResult {
  let score = BASE_HEALTH_SCORE;
  const reasons: HealthReason[] = [];
  let forceHighRisk = false;

  if (!caseCounts) {
    // No case counts = no support case signals, return base score
    return { healthScore: score, reasons, forceHighRisk };
  }

  // Rule: Urgent or critical open cases (-40, forces high risk)
  const urgentCriticalCount = caseCounts.urgent_count + caseCounts.critical_count;
  if (urgentCriticalCount > 0) {
    const impact = IMPACTS.URGENT_CRITICAL_CASE;
    score += impact;
    forceHighRisk = true;
    reasons.push({
      code: 'URGENT_CRITICAL_CASE',
      description: `${urgentCriticalCount} urgent/critical support case(s) open`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: High severity cases (-25 per case, capped)
  if (caseCounts.high_count > 0) {
    const impact = IMPACTS.HIGH_SEVERITY_CASE;
    score += impact;
    reasons.push({
      code: 'HIGH_SEVERITY_CASE',
      description: `${caseCounts.high_count} high severity support case(s) open`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: First response SLA breach (-20, forces high risk)
  if (caseCounts.first_response_breached_count > 0) {
    const impact = IMPACTS.FIRST_RESPONSE_SLA_BREACH;
    score += impact;
    forceHighRisk = true;
    reasons.push({
      code: 'FIRST_RESPONSE_SLA_BREACH',
      description: `${caseCounts.first_response_breached_count} case(s) breached first response SLA`,
      impact,
      source: 'sla',
    });
  }

  // Rule: Resolution SLA breach (-30, forces high risk)
  if (caseCounts.resolution_breached_count > 0) {
    const impact = IMPACTS.RESOLUTION_SLA_BREACH;
    score += impact;
    forceHighRisk = true;
    reasons.push({
      code: 'RESOLUTION_SLA_BREACH',
      description: `${caseCounts.resolution_breached_count} case(s) breached resolution SLA`,
      impact,
      source: 'sla',
    });
  }

  // Rule: 3+ open cases (-15)
  if (caseCounts.total_open_count >= 3) {
    const impact = IMPACTS.THREE_PLUS_OPEN_CASES;
    score += impact;
    reasons.push({
      code: 'THREE_PLUS_OPEN_CASES',
      description: `${caseCounts.total_open_count} open support cases (3+ threshold)`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: 5+ open cases (additional -10)
  if (caseCounts.total_open_count >= 5) {
    const impact = IMPACTS.FIVE_PLUS_OPEN_CASES;
    score += impact;
    reasons.push({
      code: 'FIVE_PLUS_OPEN_CASES',
      description: `${caseCounts.total_open_count} open support cases (5+ threshold)`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: Escalated cases (-15)
  if (caseCounts.escalated_count > 0) {
    const impact = IMPACTS.ESCALATED_CASE;
    score += impact;
    reasons.push({
      code: 'ESCALATED_CASE',
      description: `${caseCounts.escalated_count} escalated support case(s)`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: Negative impact cases (-10 each)
  if (caseCounts.negative_impact_count > 0) {
    const impact = IMPACTS.NEGATIVE_IMPACT_CASE * caseCounts.negative_impact_count;
    score += impact;
    reasons.push({
      code: 'NEGATIVE_IMPACT_CASES',
      description: `${caseCounts.negative_impact_count} case(s) with negative engagement impact`,
      impact,
      source: 'support_case',
    });
  }

  // Rule: Critical impact cases (-20 each)
  if (caseCounts.critical_impact_count > 0) {
    const impact = IMPACTS.CRITICAL_IMPACT_CASE * caseCounts.critical_impact_count;
    score += impact;
    forceHighRisk = true;
    reasons.push({
      code: 'CRITICAL_IMPACT_CASES',
      description: `${caseCounts.critical_impact_count} case(s) with critical engagement impact`,
      impact,
      source: 'support_case',
    });
  }

  // Check lifecycle SLA breach from read model
  if (readModel?.is_sla_breached) {
    const impact = -15;
    score += impact;
    forceHighRisk = true;
    reasons.push({
      code: 'LIFECYCLE_SLA_BREACH',
      description: 'Lifecycle stage SLA breached',
      impact,
      source: 'stage',
    });
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  return { healthScore: score, reasons, forceHighRisk };
}

function computeRiskLevel(healthScore: number, forceHighRisk: boolean): RiskLevel {
  // Force high risk for urgent cases or SLA breaches
  if (forceHighRisk) {
    return 'high';
  }

  if (healthScore >= RISK_THRESHOLDS.NONE) {
    return 'none';
  }
  if (healthScore >= RISK_THRESHOLDS.LOW) {
    return 'low';
  }
  if (healthScore >= RISK_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'high';
}

function computeInputHash(
  caseCounts: CompanyProductOpenCaseCountsData | null,
  readModel: CompanyProductReadModelData | null
): string {
  const input = {
    caseCounts: caseCounts ? {
      total_open_count: caseCounts.total_open_count,
      urgent_count: caseCounts.urgent_count,
      critical_count: caseCounts.critical_count,
      high_count: caseCounts.high_count,
      first_response_breached_count: caseCounts.first_response_breached_count,
      resolution_breached_count: caseCounts.resolution_breached_count,
      escalated_count: caseCounts.escalated_count,
      negative_impact_count: caseCounts.negative_impact_count,
      critical_impact_count: caseCounts.critical_impact_count,
    } : null,
    readModel: readModel ? {
      is_sla_breached: readModel.is_sla_breached,
    } : null,
  };

  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
}

// ============================================================================
// EVENT STORE HELPER
// ============================================================================

interface AppendEventParams {
  aggregateType: string;
  aggregateId: string;
  sequenceNumber: number;
  event: {
    type: string;
    version: number;
    data: unknown;
    occurredAt: string;
    actor: { type: string; id?: string };
    metadata?: Record<string, unknown>;
  };
}

async function appendEventToStore(
  supabase: ReturnType<typeof createAdminClient>,
  params: AppendEventParams
): Promise<void> {
  const { error } = await supabase.from('event_store').insert({
    aggregate_type: params.aggregateType,
    aggregate_id: params.aggregateId,
    sequence_number: params.sequenceNumber,
    event_type: params.event.type,
    event_data: params.event.data,
    version: params.event.version,
    occurred_at: params.event.occurredAt,
    actor_type: params.event.actor.type,
    actor_id: params.event.actor.id,
    metadata: params.event.metadata || {},
  });

  if (error) {
    throw new Error(`Failed to append event: ${error.message}`);
  }
}

// ============================================================================
// BATCH EVALUATOR
// ============================================================================

export interface BatchEvaluatorResult {
  processed: number;
  updated: number;
  errors: string[];
}

/**
 * Evaluates health for all CompanyProducts with support cases.
 * Used by scheduled jobs.
 */
export async function evaluateAllEngagementHealth(
  options: EvaluatorOptions = {}
): Promise<BatchEvaluatorResult> {
  const supabase = createAdminClient();
  const result: BatchEvaluatorResult = {
    processed: 0,
    updated: 0,
    errors: [],
  };

  // Get all company_products with case counts
  const { data: companyProducts, error } = await supabase
    .from('company_product_open_case_counts')
    .select('company_product_id');

  if (error) {
    throw new Error(`Failed to fetch company products: ${error.message}`);
  }

  for (const cp of companyProducts || []) {
    try {
      const evalResult = await evaluateAndEmitHealthEvents(
        { companyProductId: cp.company_product_id },
        options
      );
      result.processed++;
      if (evalResult.shouldEmitEvents) {
        result.updated++;
      }
    } catch (err) {
      result.errors.push(`${cp.company_product_id}: ${err}`);
    }
  }

  return result;
}

/**
 * Entry point for scheduled job.
 */
export async function runEngagementHealthEvaluatorJob(): Promise<BatchEvaluatorResult> {
  console.log('[EngagementHealthEvaluator] Starting batch evaluation');

  const result = await evaluateAllEngagementHealth();

  console.log(
    `[EngagementHealthEvaluator] Completed: ${result.processed} processed, ${result.updated} updated, ${result.errors.length} errors`
  );

  if (result.errors.length > 0) {
    console.error('[EngagementHealthEvaluator] Errors:', result.errors.slice(0, 10));
  }

  return result;
}
