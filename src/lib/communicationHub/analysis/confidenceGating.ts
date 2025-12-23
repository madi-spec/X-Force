import { CONFIDENCE_THRESHOLDS } from '@/types/communicationHub';

interface WithConfidence {
  confidence: number;
}

/**
 * Filter items by confidence threshold
 */
export function filterByConfidence<T extends WithConfidence>(
  items: T[],
  threshold: number = CONFIDENCE_THRESHOLDS.MEDIUM
): T[] {
  return items.filter(item => item.confidence >= threshold);
}

/**
 * Categorize items by confidence level
 */
export function categorizeByConfidence<T extends WithConfidence>(
  items: T[]
): {
  high: T[];
  medium: T[];
  low: T[];
} {
  return {
    high: items.filter(i => i.confidence >= CONFIDENCE_THRESHOLDS.HIGH),
    medium: items.filter(i =>
      i.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM &&
      i.confidence < CONFIDENCE_THRESHOLDS.HIGH
    ),
    low: items.filter(i => i.confidence < CONFIDENCE_THRESHOLDS.MEDIUM),
  };
}

/**
 * Get display label for confidence level
 */
export function getConfidenceLabel(confidence: number): {
  level: 'high' | 'medium' | 'low';
  label: string;
  showByDefault: boolean;
} {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return { level: 'high', label: '', showByDefault: true };
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return { level: 'medium', label: 'Possible', showByDefault: true };
  }
  return { level: 'low', label: 'Uncertain', showByDefault: false };
}

/**
 * Should this item trigger a Command Center action?
 */
export function canTriggerAction(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.HIGH;
}
