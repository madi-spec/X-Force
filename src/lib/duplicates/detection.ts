/**
 * Duplicate Detection Utilities
 * Core functions for detecting and scoring potential duplicates
 */

import type { CompletenessResult, FieldWeights } from '@/types/duplicates';

/**
 * Normalize a company/contact name for comparison
 * Removes common suffixes, special characters, and standardizes format
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove regional/state suffixes (common in pest control industry)
    .replace(
      /\s*-\s*(corporate|corp|headquarters|hq|va|nc|sc|ga|fl|tx|ca|ny|oh|pa|il|az|nv|co|wa|or|ma|ct|nj|md|tn|ky|al|la|mo|mn|wi|ia|ks|ok|ar|ms|ut|ne|nm|wv|id|hi|me|nh|ri|mt|de|sd|nd|ak|vt|wy|dc|state)\s*$/gi,
      ''
    )
    // Remove special characters
    .replace(/[^a-z0-9]/g, '')
    // Remove common business suffixes
    .replace(/(inc|incorporated|llc|corp|corporation|company|co|ltd|limited|services|service|pest|control|lawn|care|solutions|group|enterprises|enterprise)$/g, '');
}

/**
 * Normalize a phone number for comparison
 * Removes all non-digit characters
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Normalize an email for comparison
 * Lowercase and trim whitespace
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize a domain for comparison
 * Remove www., trailing slashes, protocol
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '');
}

/**
 * Calculate completeness score for a record
 * Higher score = more complete record
 */
export function calculateCompletenessScore(
  record: Record<string, unknown>,
  weights: FieldWeights
): CompletenessResult {
  let fieldCount = 0;
  let weightedScore = 0;
  let maxScore = 0;

  for (const [field, weight] of Object.entries(weights)) {
    maxScore += weight;
    const value = record[field];

    // Check if field has a meaningful value
    const hasValue =
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

    if (hasValue) {
      fieldCount++;
      weightedScore += weight;
    }
  }

  return {
    fieldCount,
    score: maxScore > 0 ? (weightedScore / maxScore) * 100 : 0,
  };
}

/**
 * Field weights for company completeness scoring
 * Higher weight = more important for determining "most complete"
 */
export const COMPANY_FIELD_WEIGHTS: FieldWeights = {
  name: 10,
  domain: 15,
  status: 5,
  segment: 5,
  industry: 5,
  agent_count: 5,
  address: 10,
  crm_platform: 5,
  voice_customer: 5,
  voice_customer_since: 5,
  vfp_customer_id: 10,
  ats_id: 10,
  external_ids: 10,
  employee_count: 3,
  employee_range: 3,
  revenue_estimate: 3,
  vfp_support_contact: 3,
};

/**
 * Field weights for contact completeness scoring
 */
export const CONTACT_FIELD_WEIGHTS: FieldWeights = {
  name: 10,
  email: 20,
  phone: 10,
  title: 10,
  role: 10,
  company_id: 10,
  is_primary: 5,
  is_decision_maker: 5,
  relationship_facts: 10,
  communication_style: 5,
  last_contacted_at: 5,
};

/**
 * Confidence score thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  exact: 100,
  high: 85,
  medium: 70,
  low: 50,
};

/**
 * Get confidence level from match score
 */
export function getConfidenceFromScore(score: number): 'exact' | 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.exact) return 'exact';
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Check if two strings are similar using Levenshtein distance
 * Returns similarity ratio 0-1
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}
