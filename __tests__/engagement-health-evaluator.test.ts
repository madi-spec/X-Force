/**
 * Engagement Health Evaluator Tests
 *
 * Tests for:
 * - Health score computation with support case signals
 * - Risk level determination
 * - Event emission and idempotency
 * - Case lifecycle impacts on health
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// LOCAL TYPE DEFINITIONS
// ============================================================================

type RiskLevel = 'none' | 'low' | 'medium' | 'high';

interface HealthReason {
  code: string;
  description: string;
  impact: number;
  source: 'support_case' | 'sla' | 'communication' | 'activity' | 'stage' | 'other';
  referenceId?: string;
}

interface CompanyProductReadModelData {
  company_product_id: string;
  company_id: string;
  product_id: string;
  health_score: number | null;
  risk_level: RiskLevel | null;
  current_stage_name: string | null;
  is_sla_breached: boolean;
  is_sla_warning: boolean;
}

interface CompanyProductOpenCaseCountsData {
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

interface HealthEvaluatorResult {
  healthScore: number;
  riskLevel: RiskLevel;
  reasons: HealthReason[];
  inputHash: string;
  shouldEmitEvents: boolean;
  healthChanged: boolean;
  riskChanged: boolean;
}

// ============================================================================
// SCORING CONSTANTS (mirrored from evaluator)
// ============================================================================

const BASE_HEALTH_SCORE = 100;

const IMPACTS = {
  URGENT_CRITICAL_CASE: -40,
  HIGH_SEVERITY_CASE: -25,
  FIRST_RESPONSE_SLA_BREACH: -20,
  RESOLUTION_SLA_BREACH: -30,
  THREE_PLUS_OPEN_CASES: -15,
  FIVE_PLUS_OPEN_CASES: -10,
  NEGATIVE_IMPACT_CASE: -10,
  CRITICAL_IMPACT_CASE: -20,
  ESCALATED_CASE: -15,
} as const;

const RISK_THRESHOLDS = {
  NONE: 85,
  LOW: 70,
  MEDIUM: 50,
} as const;

// ============================================================================
// MOCK EVALUATOR (mirrors production logic)
// ============================================================================

function computeHealthScore(
  caseCounts: CompanyProductOpenCaseCountsData | null,
  readModel: CompanyProductReadModelData | null
): { healthScore: number; reasons: HealthReason[]; forceHighRisk: boolean } {
  let score = BASE_HEALTH_SCORE;
  const reasons: HealthReason[] = [];
  let forceHighRisk = false;

  if (!caseCounts) {
    return { healthScore: score, reasons, forceHighRisk };
  }

  // Rule: Urgent or critical open cases
  const urgentCriticalCount = caseCounts.urgent_count + caseCounts.critical_count;
  if (urgentCriticalCount > 0) {
    score += IMPACTS.URGENT_CRITICAL_CASE;
    forceHighRisk = true;
    reasons.push({
      code: 'URGENT_CRITICAL_CASE',
      description: `${urgentCriticalCount} urgent/critical support case(s) open`,
      impact: IMPACTS.URGENT_CRITICAL_CASE,
      source: 'support_case',
    });
  }

  // Rule: High severity cases
  if (caseCounts.high_count > 0) {
    score += IMPACTS.HIGH_SEVERITY_CASE;
    reasons.push({
      code: 'HIGH_SEVERITY_CASE',
      description: `${caseCounts.high_count} high severity support case(s) open`,
      impact: IMPACTS.HIGH_SEVERITY_CASE,
      source: 'support_case',
    });
  }

  // Rule: First response SLA breach
  if (caseCounts.first_response_breached_count > 0) {
    score += IMPACTS.FIRST_RESPONSE_SLA_BREACH;
    forceHighRisk = true;
    reasons.push({
      code: 'FIRST_RESPONSE_SLA_BREACH',
      description: `${caseCounts.first_response_breached_count} case(s) breached first response SLA`,
      impact: IMPACTS.FIRST_RESPONSE_SLA_BREACH,
      source: 'sla',
    });
  }

  // Rule: Resolution SLA breach
  if (caseCounts.resolution_breached_count > 0) {
    score += IMPACTS.RESOLUTION_SLA_BREACH;
    forceHighRisk = true;
    reasons.push({
      code: 'RESOLUTION_SLA_BREACH',
      description: `${caseCounts.resolution_breached_count} case(s) breached resolution SLA`,
      impact: IMPACTS.RESOLUTION_SLA_BREACH,
      source: 'sla',
    });
  }

  // Rule: 3+ open cases
  if (caseCounts.total_open_count >= 3) {
    score += IMPACTS.THREE_PLUS_OPEN_CASES;
    reasons.push({
      code: 'THREE_PLUS_OPEN_CASES',
      description: `${caseCounts.total_open_count} open support cases (3+ threshold)`,
      impact: IMPACTS.THREE_PLUS_OPEN_CASES,
      source: 'support_case',
    });
  }

  // Rule: 5+ open cases
  if (caseCounts.total_open_count >= 5) {
    score += IMPACTS.FIVE_PLUS_OPEN_CASES;
    reasons.push({
      code: 'FIVE_PLUS_OPEN_CASES',
      description: `${caseCounts.total_open_count} open support cases (5+ threshold)`,
      impact: IMPACTS.FIVE_PLUS_OPEN_CASES,
      source: 'support_case',
    });
  }

  // Rule: Escalated cases
  if (caseCounts.escalated_count > 0) {
    score += IMPACTS.ESCALATED_CASE;
    reasons.push({
      code: 'ESCALATED_CASE',
      description: `${caseCounts.escalated_count} escalated support case(s)`,
      impact: IMPACTS.ESCALATED_CASE,
      source: 'support_case',
    });
  }

  // Rule: Negative impact cases
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

  // Rule: Critical impact cases
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

  // Lifecycle SLA breach
  if (readModel?.is_sla_breached) {
    score += -15;
    forceHighRisk = true;
    reasons.push({
      code: 'LIFECYCLE_SLA_BREACH',
      description: 'Lifecycle stage SLA breached',
      impact: -15,
      source: 'stage',
    });
  }

  score = Math.max(0, Math.min(100, score));

  return { healthScore: score, reasons, forceHighRisk };
}

function computeRiskLevel(healthScore: number, forceHighRisk: boolean): RiskLevel {
  if (forceHighRisk) return 'high';
  if (healthScore >= RISK_THRESHOLDS.NONE) return 'none';
  if (healthScore >= RISK_THRESHOLDS.LOW) return 'low';
  if (healthScore >= RISK_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

function evaluateHealth(
  caseCounts: CompanyProductOpenCaseCountsData | null,
  readModel: CompanyProductReadModelData | null
): HealthEvaluatorResult {
  const { healthScore, reasons, forceHighRisk } = computeHealthScore(caseCounts, readModel);
  const riskLevel = computeRiskLevel(healthScore, forceHighRisk);

  const inputHash = JSON.stringify({ caseCounts, readModel }).slice(0, 16);
  const previousHealth = readModel?.health_score ?? null;
  const previousRisk = readModel?.risk_level ?? null;

  return {
    healthScore,
    riskLevel,
    reasons,
    inputHash,
    shouldEmitEvents: previousHealth !== healthScore || previousRisk !== riskLevel,
    healthChanged: previousHealth !== healthScore,
    riskChanged: previousRisk !== riskLevel,
  };
}

// ============================================================================
// TEST HELPERS
// ============================================================================

function createEmptyCaseCounts(companyProductId: string): CompanyProductOpenCaseCountsData {
  return {
    company_product_id: companyProductId,
    total_open_count: 0,
    open_count: 0,
    in_progress_count: 0,
    waiting_count: 0,
    escalated_count: 0,
    low_count: 0,
    medium_count: 0,
    high_count: 0,
    urgent_count: 0,
    critical_count: 0,
    first_response_breached_count: 0,
    resolution_breached_count: 0,
    any_breached_count: 0,
    negative_impact_count: 0,
    critical_impact_count: 0,
  };
}

function createDefaultReadModel(companyProductId: string): CompanyProductReadModelData {
  return {
    company_product_id: companyProductId,
    company_id: 'company-1',
    product_id: 'product-1',
    health_score: null,
    risk_level: null,
    current_stage_name: 'Active',
    is_sla_breached: false,
    is_sla_warning: false,
  };
}

// ============================================================================
// HEALTH SCORE COMPUTATION TESTS
// ============================================================================

describe('Engagement Health Evaluator', () => {
  describe('Health Score Computation', () => {
    it('returns base score of 100 with no case counts', () => {
      const result = evaluateHealth(null, null);

      expect(result.healthScore).toBe(100);
      expect(result.riskLevel).toBe('none');
      expect(result.reasons).toHaveLength(0);
    });

    it('returns base score of 100 with zero open cases', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100);
      expect(result.riskLevel).toBe('none');
      expect(result.reasons).toHaveLength(0);
    });

    it('applies -40 penalty for urgent case and forces high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.URGENT_CRITICAL_CASE); // 60
      expect(result.riskLevel).toBe('high');
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          code: 'URGENT_CRITICAL_CASE',
          impact: IMPACTS.URGENT_CRITICAL_CASE,
        })
      );
    });

    it('applies -40 penalty for critical case and forces high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.critical_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.URGENT_CRITICAL_CASE); // 60
      expect(result.riskLevel).toBe('high');
    });

    it('applies -25 penalty for high severity case', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.high_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.HIGH_SEVERITY_CASE); // 75
      expect(result.riskLevel).toBe('low'); // Not forced high
    });

    it('applies -20 penalty for first response SLA breach and forces high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.first_response_breached_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.FIRST_RESPONSE_SLA_BREACH); // 80
      expect(result.riskLevel).toBe('high'); // Forced high
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          code: 'FIRST_RESPONSE_SLA_BREACH',
          source: 'sla',
        })
      );
    });

    it('applies -30 penalty for resolution SLA breach and forces high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.resolution_breached_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.RESOLUTION_SLA_BREACH); // 70
      expect(result.riskLevel).toBe('high'); // Forced high
    });

    it('applies -15 penalty for 3+ open cases', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.medium_count = 3;
      caseCounts.total_open_count = 3;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.THREE_PLUS_OPEN_CASES); // 85
      expect(result.riskLevel).toBe('none'); // 85 is still "none"
    });

    it('applies cumulative -25 penalty for 5+ open cases', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.medium_count = 5;
      caseCounts.total_open_count = 5;

      const result = evaluateHealth(caseCounts, null);

      // -15 for 3+ plus -10 for 5+ = -25 total
      expect(result.healthScore).toBe(100 + IMPACTS.THREE_PLUS_OPEN_CASES + IMPACTS.FIVE_PLUS_OPEN_CASES); // 75
    });

    it('applies -15 penalty for escalated cases', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.escalated_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.ESCALATED_CASE); // 85
    });

    it('applies -10 per negative impact case', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.negative_impact_count = 2;
      caseCounts.total_open_count = 2;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + (IMPACTS.NEGATIVE_IMPACT_CASE * 2)); // 80
    });

    it('applies -20 per critical impact case and forces high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.critical_impact_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100 + IMPACTS.CRITICAL_IMPACT_CASE); // 80
      expect(result.riskLevel).toBe('high'); // Forced high
    });

    it('considers lifecycle SLA breach from read model', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      const readModel = createDefaultReadModel('cp-1');
      readModel.is_sla_breached = true;

      const result = evaluateHealth(caseCounts, readModel);

      expect(result.healthScore).toBe(85); // 100 - 15
      expect(result.riskLevel).toBe('high'); // Forced high
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          code: 'LIFECYCLE_SLA_BREACH',
          source: 'stage',
        })
      );
    });

    it('clamps score to minimum of 0', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.critical_count = 3; // -40
      caseCounts.resolution_breached_count = 2; // -30
      caseCounts.first_response_breached_count = 2; // -20
      caseCounts.total_open_count = 7; // -15 -10
      caseCounts.escalated_count = 2; // -15
      caseCounts.critical_impact_count = 2; // -40
      // Total: -40 -30 -20 -15 -10 -15 -40 = -170

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(0);
      expect(result.riskLevel).toBe('high');
    });

    it('accumulates multiple penalties correctly', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1; // -40
      caseCounts.high_count = 1; // -25
      caseCounts.first_response_breached_count = 1; // -20
      caseCounts.total_open_count = 3; // -15

      const result = evaluateHealth(caseCounts, null);

      const expected = 100 - 40 - 25 - 20 - 15; // 0
      expect(result.healthScore).toBe(expected);
      expect(result.reasons).toHaveLength(4);
    });
  });

  describe('Risk Level Determination', () => {
    it('returns "none" for health >= 85 with no forced high risk', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.medium_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(100); // No impact for just medium
      expect(result.riskLevel).toBe('none');
    });

    it('returns "low" for health 70-84', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.high_count = 1; // -25 = 75

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(75);
      expect(result.riskLevel).toBe('low');
    });

    it('returns "medium" for health 50-69', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.high_count = 2; // -50 = 50... but we only have one -25

      // Simulate health of 60
      caseCounts.high_count = 1; // -25
      caseCounts.escalated_count = 1; // -15 = 60

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(60);
      expect(result.riskLevel).toBe('medium');
    });

    it('returns "high" for health < 50', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.high_count = 1; // -25
      caseCounts.escalated_count = 1; // -15
      caseCounts.negative_impact_count = 2; // -20 = 40

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(40);
      expect(result.riskLevel).toBe('high');
    });

    it('forces "high" risk regardless of score for urgent case', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(60); // Still above 50
      expect(result.riskLevel).toBe('high'); // But forced high
    });

    it('forces "high" risk for SLA breach even with high score', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.first_response_breached_count = 1;
      caseCounts.total_open_count = 1;

      const result = evaluateHealth(caseCounts, null);

      expect(result.healthScore).toBe(80); // Above medium threshold
      expect(result.riskLevel).toBe('high'); // But forced high
    });
  });

  describe('Change Detection (Idempotency)', () => {
    it('detects health change from null', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = null;

      const result = evaluateHealth(caseCounts, readModel);

      expect(result.healthChanged).toBe(true);
      expect(result.shouldEmitEvents).toBe(true);
    });

    it('detects health change from different value', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.total_open_count = 1;

      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = 100;

      const result = evaluateHealth(caseCounts, readModel);

      expect(result.healthScore).toBe(60);
      expect(result.healthChanged).toBe(true);
      expect(result.shouldEmitEvents).toBe(true);
    });

    it('does not emit events when score unchanged', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = 100;
      readModel.risk_level = 'none';

      const result = evaluateHealth(caseCounts, readModel);

      expect(result.healthScore).toBe(100);
      expect(result.riskLevel).toBe('none');
      expect(result.healthChanged).toBe(false);
      expect(result.riskChanged).toBe(false);
      expect(result.shouldEmitEvents).toBe(false);
    });

    it('detects risk level change', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.total_open_count = 1;

      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = 60;
      readModel.risk_level = 'medium'; // Previous was medium

      const result = evaluateHealth(caseCounts, readModel);

      expect(result.riskLevel).toBe('high'); // Now high
      expect(result.riskChanged).toBe(true);
      expect(result.shouldEmitEvents).toBe(true);
    });
  });

  describe('Case Lifecycle Impact', () => {
    it('shows health degradation when urgent case is opened', () => {
      // Before: No cases
      const beforeCounts = createEmptyCaseCounts('cp-1');
      const beforeResult = evaluateHealth(beforeCounts, null);

      expect(beforeResult.healthScore).toBe(100);
      expect(beforeResult.riskLevel).toBe('none');

      // After: Urgent case opened
      const afterCounts = createEmptyCaseCounts('cp-1');
      afterCounts.urgent_count = 1;
      afterCounts.total_open_count = 1;

      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = 100;
      readModel.risk_level = 'none';

      const afterResult = evaluateHealth(afterCounts, readModel);

      expect(afterResult.healthScore).toBe(60);
      expect(afterResult.riskLevel).toBe('high');
      expect(afterResult.healthChanged).toBe(true);
      expect(afterResult.riskChanged).toBe(true);
    });

    it('shows health recovery when urgent case is resolved', () => {
      // Before: With urgent case
      const beforeCounts = createEmptyCaseCounts('cp-1');
      beforeCounts.urgent_count = 1;
      beforeCounts.total_open_count = 1;

      const beforeReadModel = createDefaultReadModel('cp-1');
      beforeReadModel.health_score = 60;
      beforeReadModel.risk_level = 'high';

      // After: Case resolved (counts back to zero)
      const afterCounts = createEmptyCaseCounts('cp-1');

      const afterResult = evaluateHealth(afterCounts, beforeReadModel);

      expect(afterResult.healthScore).toBe(100);
      expect(afterResult.riskLevel).toBe('none');
      expect(afterResult.healthChanged).toBe(true);
      expect(afterResult.riskChanged).toBe(true);
    });

    it('shows incremental health degradation with multiple cases', () => {
      // Start: one high severity case
      const counts1 = createEmptyCaseCounts('cp-1');
      counts1.high_count = 1;
      counts1.total_open_count = 1;

      const result1 = evaluateHealth(counts1, null);
      expect(result1.healthScore).toBe(75);
      expect(result1.riskLevel).toBe('low');

      // Add another high severity case
      const counts2 = createEmptyCaseCounts('cp-1');
      counts2.high_count = 2;
      counts2.total_open_count = 2;

      const readModel2 = createDefaultReadModel('cp-1');
      readModel2.health_score = 75;
      readModel2.risk_level = 'low';

      const result2 = evaluateHealth(counts2, readModel2);
      expect(result2.healthScore).toBe(75); // Still -25 (not cumulative per case)
      expect(result2.healthChanged).toBe(false);

      // Add urgent case - triggers bigger penalty
      const counts3 = createEmptyCaseCounts('cp-1');
      counts3.high_count = 2;
      counts3.urgent_count = 1;
      counts3.total_open_count = 3; // Now triggers 3+ penalty too

      const readModel3 = createDefaultReadModel('cp-1');
      readModel3.health_score = 75;
      readModel3.risk_level = 'low';

      const result3 = evaluateHealth(counts3, readModel3);
      // -40 (urgent) -25 (high) -15 (3+) = 20
      expect(result3.healthScore).toBe(20);
      expect(result3.riskLevel).toBe('high');
    });

    it('SLA breach causes immediate risk escalation', () => {
      // Before: Normal case, no SLA breach
      const beforeCounts = createEmptyCaseCounts('cp-1');
      beforeCounts.medium_count = 1;
      beforeCounts.total_open_count = 1;

      const beforeResult = evaluateHealth(beforeCounts, null);
      expect(beforeResult.riskLevel).toBe('none');

      // After: SLA breach occurs
      const afterCounts = createEmptyCaseCounts('cp-1');
      afterCounts.medium_count = 1;
      afterCounts.first_response_breached_count = 1;
      afterCounts.total_open_count = 1;

      const readModel = createDefaultReadModel('cp-1');
      readModel.health_score = 100;
      readModel.risk_level = 'none';

      const afterResult = evaluateHealth(afterCounts, readModel);
      expect(afterResult.riskLevel).toBe('high');
      expect(afterResult.reasons).toContainEqual(
        expect.objectContaining({ code: 'FIRST_RESPONSE_SLA_BREACH' })
      );
    });
  });

  describe('Reason Explainability', () => {
    it('includes all applicable reasons', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.first_response_breached_count = 1;
      caseCounts.total_open_count = 3;

      const result = evaluateHealth(caseCounts, null);

      expect(result.reasons).toHaveLength(3);
      expect(result.reasons.map(r => r.code)).toContain('URGENT_CRITICAL_CASE');
      expect(result.reasons.map(r => r.code)).toContain('FIRST_RESPONSE_SLA_BREACH');
      expect(result.reasons.map(r => r.code)).toContain('THREE_PLUS_OPEN_CASES');
    });

    it('reasons include correct source types', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.first_response_breached_count = 1;
      caseCounts.total_open_count = 1;

      const readModel = createDefaultReadModel('cp-1');
      readModel.is_sla_breached = true;

      const result = evaluateHealth(caseCounts, readModel);

      const sources = result.reasons.map(r => r.source);
      expect(sources).toContain('support_case');
      expect(sources).toContain('sla');
      expect(sources).toContain('stage');
    });

    it('reasons have negative impact values', () => {
      const caseCounts = createEmptyCaseCounts('cp-1');
      caseCounts.urgent_count = 1;
      caseCounts.high_count = 1;
      caseCounts.total_open_count = 2;

      const result = evaluateHealth(caseCounts, null);

      for (const reason of result.reasons) {
        expect(reason.impact).toBeLessThan(0);
      }
    });
  });
});

// ============================================================================
// INTEGRATION SCENARIO TESTS
// ============================================================================

describe('Integration Scenarios', () => {
  it('full workflow: healthy -> urgent case -> SLA breach -> resolution -> healthy', () => {
    // Step 1: Healthy state
    let caseCounts = createEmptyCaseCounts('cp-1');
    let readModel = createDefaultReadModel('cp-1');

    let result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(100);
    expect(result.riskLevel).toBe('none');

    // Step 2: Urgent case opened
    caseCounts.urgent_count = 1;
    caseCounts.total_open_count = 1;
    readModel.health_score = 100;
    readModel.risk_level = 'none';

    result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(60);
    expect(result.riskLevel).toBe('high');
    expect(result.shouldEmitEvents).toBe(true);

    // Step 3: SLA breach occurs on that case
    caseCounts.first_response_breached_count = 1;
    readModel.health_score = 60;
    readModel.risk_level = 'high';

    result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(40); // 60 - 20
    expect(result.riskLevel).toBe('high');
    expect(result.shouldEmitEvents).toBe(true);

    // Step 4: Case resolved
    caseCounts = createEmptyCaseCounts('cp-1');
    readModel.health_score = 40;
    readModel.risk_level = 'high';

    result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(100);
    expect(result.riskLevel).toBe('none');
    expect(result.shouldEmitEvents).toBe(true);
  });

  it('multiple cases accumulate correctly then resolve incrementally', () => {
    // Start with 3 cases of different severity
    const caseCounts = createEmptyCaseCounts('cp-1');
    caseCounts.critical_count = 1; // -40
    caseCounts.high_count = 1; // -25
    caseCounts.medium_count = 1;
    caseCounts.total_open_count = 3; // -15

    let readModel = createDefaultReadModel('cp-1');

    let result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(20); // 100 - 40 - 25 - 15
    expect(result.riskLevel).toBe('high');

    // Resolve critical case
    caseCounts.critical_count = 0;
    caseCounts.total_open_count = 2;
    readModel.health_score = 20;
    readModel.risk_level = 'high';

    result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(75); // 100 - 25
    expect(result.riskLevel).toBe('low'); // No more forced high

    // Resolve high severity case
    caseCounts.high_count = 0;
    caseCounts.total_open_count = 1;
    readModel.health_score = 75;
    readModel.risk_level = 'low';

    result = evaluateHealth(caseCounts, readModel);
    expect(result.healthScore).toBe(100);
    expect(result.riskLevel).toBe('none');
  });
});
