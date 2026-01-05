/**
 * Tests for Signal Priority Ordering
 *
 * Verifies that signals are correctly prioritized based on:
 * - Severity (critical > high > medium > low)
 * - Recency bonus
 * - Value multiplier
 * - Engagement factor
 *
 * These tests ensure the priority scoring is transparent and deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  SignalType,
  SignalSeverity,
  calculatePriorityScore,
  getSeverityBaseScore,
  getDefaultSeverity,
} from '../../../src/lib/signals/events';

describe('Priority Ordering', () => {
  describe('Severity-based ordering', () => {
    it('critical signals have higher base score than high', () => {
      const criticalBase = getSeverityBaseScore('critical');
      const highBase = getSeverityBaseScore('high');
      expect(criticalBase).toBeGreaterThan(highBase);
    });

    it('high signals have higher base score than medium', () => {
      const highBase = getSeverityBaseScore('high');
      const mediumBase = getSeverityBaseScore('medium');
      expect(highBase).toBeGreaterThan(mediumBase);
    });

    it('medium signals have higher base score than low', () => {
      const mediumBase = getSeverityBaseScore('medium');
      const lowBase = getSeverityBaseScore('low');
      expect(mediumBase).toBeGreaterThan(lowBase);
    });

    it('critical signal always scores higher than low signal (same other factors)', () => {
      const criticalScore = calculatePriorityScore({
        base_score: getSeverityBaseScore('critical'),
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      const lowScore = calculatePriorityScore({
        base_score: getSeverityBaseScore('low'),
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      expect(criticalScore).toBeGreaterThan(lowScore);
    });
  });

  describe('Recency bonus impact', () => {
    it('more recent signals score higher than older signals', () => {
      const recentSignalScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 20, // Very recent
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      const olderSignalScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 5, // Less recent
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      expect(recentSignalScore).toBeGreaterThan(olderSignalScore);
      expect(recentSignalScore - olderSignalScore).toBe(15); // Difference is the recency delta
    });

    it('recency bonus is capped at 20', () => {
      const cappedScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 100, // Way over cap
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      const maxScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 20, // At cap
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      expect(cappedScore).toBe(maxScore);
    });
  });

  describe('Value multiplier impact', () => {
    it('high-value accounts get higher priority', () => {
      const highValueScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 2.0, // Enterprise account
        engagement_factor: 10,
      });

      const normalValueScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0, // SMB account
        engagement_factor: 10,
      });

      expect(highValueScore).toBeGreaterThan(normalValueScore);
    });

    it('low-value accounts get lower priority', () => {
      const lowValueScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 0.5, // Very small account
        engagement_factor: 10,
      });

      const normalValueScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      expect(lowValueScore).toBeLessThan(normalValueScore);
    });

    it('value multiplier is capped between 0.5 and 2.0', () => {
      const overCapScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 5.0, // Over 2.0 cap
        engagement_factor: 10,
      });

      const atCapScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 2.0, // At cap
        engagement_factor: 10,
      });

      expect(overCapScore).toBe(atCapScore);

      const underCapScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 0.1, // Under 0.5 floor
        engagement_factor: 10,
      });

      const atFloorScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 0.5, // At floor
        engagement_factor: 10,
      });

      expect(underCapScore).toBe(atFloorScore);
    });
  });

  describe('Engagement factor impact', () => {
    it('higher engagement increases priority', () => {
      const highEngagementScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 20, // Very engaged
      });

      const lowEngagementScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 5, // Low engagement
      });

      expect(highEngagementScore).toBeGreaterThan(lowEngagementScore);
    });

    it('engagement factor is capped at 20', () => {
      const cappedScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 50, // Over cap
      });

      const maxScore = calculatePriorityScore({
        base_score: 30,
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 20, // At cap
      });

      expect(cappedScore).toBe(maxScore);
    });
  });

  describe('Combined factor ordering', () => {
    it('critical + high value > high + normal value', () => {
      const criticalHighValue = calculatePriorityScore({
        base_score: getSeverityBaseScore('critical'),
        recency_bonus: 10,
        value_multiplier: 2.0,
        engagement_factor: 10,
      });

      const highNormalValue = calculatePriorityScore({
        base_score: getSeverityBaseScore('high'),
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      expect(criticalHighValue).toBeGreaterThan(highNormalValue);
    });

    it('high + very recent > critical + stale', () => {
      const highRecent = calculatePriorityScore({
        base_score: getSeverityBaseScore('high'),
        recency_bonus: 20,
        value_multiplier: 1.0,
        engagement_factor: 20,
      });

      const criticalStale = calculatePriorityScore({
        base_score: getSeverityBaseScore('critical'),
        recency_bonus: 0,
        value_multiplier: 0.5,
        engagement_factor: 0,
      });

      expect(highRecent).toBeGreaterThan(criticalStale);
    });

    it('medium + enterprise value can exceed high + SMB value', () => {
      const mediumEnterprise = calculatePriorityScore({
        base_score: getSeverityBaseScore('medium'),
        recency_bonus: 15,
        value_multiplier: 2.0, // Enterprise
        engagement_factor: 15,
      });

      const highSMB = calculatePriorityScore({
        base_score: getSeverityBaseScore('high'),
        recency_bonus: 5,
        value_multiplier: 0.5, // Small account
        engagement_factor: 5,
      });

      expect(mediumEnterprise).toBeGreaterThan(highSMB);
    });
  });

  describe('Score bounds', () => {
    it('score never exceeds 100', () => {
      const maxPossibleScore = calculatePriorityScore({
        base_score: 100, // Way over
        recency_bonus: 100, // Way over
        value_multiplier: 10.0, // Way over
        engagement_factor: 100, // Way over
      });

      expect(maxPossibleScore).toBe(100);
    });

    it('score never goes below 1', () => {
      const minPossibleScore = calculatePriorityScore({
        base_score: -100,
        recency_bonus: -100,
        value_multiplier: 0,
        engagement_factor: -100,
      });

      expect(minPossibleScore).toBe(1);
    });

    it('zero factors produce score of 1 (minimum)', () => {
      const zeroScore = calculatePriorityScore({
        base_score: 0,
        recency_bonus: 0,
        value_multiplier: 0,
        engagement_factor: 0,
      });

      expect(zeroScore).toBe(1);
    });
  });

  describe('Realistic priority scenarios', () => {
    it('SLA breach with high-value account is highest priority', () => {
      const slaBreach = calculatePriorityScore({
        base_score: getSeverityBaseScore('critical'),
        recency_bonus: 20, // Just happened
        value_multiplier: 2.0, // Enterprise
        engagement_factor: 15,
      });

      expect(slaBreach).toBe(100); // Should hit cap
    });

    it('new expansion opportunity for engaged enterprise is high priority', () => {
      const expansion = calculatePriorityScore({
        base_score: getSeverityBaseScore('low'), // expansion_ready default
        recency_bonus: 15,
        value_multiplier: 2.0,
        engagement_factor: 20,
      });

      // 10 * 2.0 + 15 + 20 = 55
      expect(expansion).toBe(55);
    });

    it('stale deal with SMB is lower priority', () => {
      const staleDeal = calculatePriorityScore({
        base_score: getSeverityBaseScore('medium'),
        recency_bonus: 2, // Old signal
        value_multiplier: 0.6, // Small account
        engagement_factor: 3, // Low engagement
      });

      // 20 * 0.6 + 2 + 3 = 17
      expect(staleDeal).toBe(17);
    });

    it('message needing reply with recent activity is medium-high', () => {
      const messageReply = calculatePriorityScore({
        base_score: getSeverityBaseScore('medium'),
        recency_bonus: 18, // Recent message
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      // 20 * 1.0 + 18 + 10 = 48
      expect(messageReply).toBe(48);
    });
  });

  describe('Default severity ordering', () => {
    it('SLA breach > promise at risk > message needs reply > expansion ready', () => {
      const slaSeverity = getDefaultSeverity('sla_breach');
      const promiseSeverity = getDefaultSeverity('promise_at_risk');
      const messageSeverity = getDefaultSeverity('message_needs_reply');
      const expansionSeverity = getDefaultSeverity('expansion_ready');

      const slaBase = getSeverityBaseScore(slaSeverity);
      const promiseBase = getSeverityBaseScore(promiseSeverity);
      const messageBase = getSeverityBaseScore(messageSeverity);
      const expansionBase = getSeverityBaseScore(expansionSeverity);

      expect(slaBase).toBeGreaterThan(promiseBase);
      expect(promiseBase).toBeGreaterThan(messageBase);
      expect(messageBase).toBeGreaterThan(expansionBase);
    });

    it('churn risk > deal stalled > positive sentiment', () => {
      const churnSeverity = getDefaultSeverity('churn_risk');
      const stalledSeverity = getDefaultSeverity('deal_stalled');
      const positiveSeverity = getDefaultSeverity('positive_sentiment');

      const churnBase = getSeverityBaseScore(churnSeverity);
      const stalledBase = getSeverityBaseScore(stalledSeverity);
      const positiveBase = getSeverityBaseScore(positiveSeverity);

      expect(churnBase).toBeGreaterThan(stalledBase);
      expect(stalledBase).toBeGreaterThan(positiveBase);
    });
  });

  describe('Score calculation is deterministic', () => {
    it('same inputs always produce same score', () => {
      const factors = {
        base_score: 30,
        recency_bonus: 15,
        value_multiplier: 1.5,
        engagement_factor: 12,
      };

      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(calculatePriorityScore(factors));
      }

      const firstResult = results[0];
      expect(results.every(r => r === firstResult)).toBe(true);
    });

    it('order of calculation does not affect result', () => {
      // Calculate in different orders but same final values
      const factors1 = {
        base_score: 25,
        recency_bonus: 15,
        value_multiplier: 1.2,
        engagement_factor: 10,
      };

      const factors2 = {
        engagement_factor: 10,
        value_multiplier: 1.2,
        base_score: 25,
        recency_bonus: 15,
      };

      expect(calculatePriorityScore(factors1)).toBe(calculatePriorityScore(factors2));
    });
  });

  describe('Score calculation formula', () => {
    it('follows the documented formula', () => {
      // Formula: min(100, max(1, round(base * valueMultiplier + recency + engagement)))
      const score = calculatePriorityScore({
        base_score: 20,
        recency_bonus: 10,
        value_multiplier: 1.5,
        engagement_factor: 15,
      });

      // Expected: 20 * 1.5 + 10 + 15 = 55
      expect(score).toBe(55);
    });

    it('value multiplier only affects base score', () => {
      const withMultiplier = calculatePriorityScore({
        base_score: 20,
        recency_bonus: 10,
        value_multiplier: 2.0,
        engagement_factor: 10,
      });

      // 20 * 2.0 + 10 + 10 = 60
      expect(withMultiplier).toBe(60);

      const withoutMultiplier = calculatePriorityScore({
        base_score: 40, // Double base instead
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      // 40 * 1.0 + 10 + 10 = 60
      expect(withoutMultiplier).toBe(60);
    });
  });
});

describe('Sorting by Priority Score', () => {
  it('sorts signals correctly from highest to lowest priority', () => {
    const signals = [
      { name: 'low_priority', score: calculatePriorityScore({ base_score: 10, recency_bonus: 5, value_multiplier: 0.5, engagement_factor: 5 }) },
      { name: 'critical_sla', score: calculatePriorityScore({ base_score: 40, recency_bonus: 20, value_multiplier: 2.0, engagement_factor: 20 }) },
      { name: 'medium_deal', score: calculatePriorityScore({ base_score: 20, recency_bonus: 10, value_multiplier: 1.0, engagement_factor: 10 }) },
      { name: 'high_churn', score: calculatePriorityScore({ base_score: 40, recency_bonus: 15, value_multiplier: 1.5, engagement_factor: 15 }) },
    ];

    const sorted = [...signals].sort((a, b) => b.score - a.score);

    expect(sorted[0].name).toBe('critical_sla');
    expect(sorted[1].name).toBe('high_churn');
    expect(sorted[2].name).toBe('medium_deal');
    expect(sorted[3].name).toBe('low_priority');
  });

  it('stable sort when scores are equal', () => {
    const signals = [
      { name: 'first', score: 50, created_at: 1 },
      { name: 'second', score: 50, created_at: 2 },
      { name: 'third', score: 50, created_at: 3 },
    ];

    // Sort by score DESC, then by created_at ASC
    const sorted = [...signals].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.created_at - b.created_at;
    });

    expect(sorted[0].name).toBe('first');
    expect(sorted[1].name).toBe('second');
    expect(sorted[2].name).toBe('third');
  });
});
