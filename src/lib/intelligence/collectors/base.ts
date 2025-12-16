/**
 * Base Collector
 * Abstract base class for all intelligence collectors
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  IntelligenceSourceType,
  CollectorOptions,
  CollectorResult,
} from '../types';

// ============================================
// ABSTRACT BASE COLLECTOR
// ============================================

export abstract class BaseCollector<TData, TOptions extends CollectorOptions = CollectorOptions> {
  abstract readonly sourceType: IntelligenceSourceType;
  abstract readonly displayName: string;

  protected defaultTimeout = 60000; // 60 seconds
  protected defaultMaxRetries = 2;

  /**
   * Main collection method - must be implemented by subclasses
   */
  abstract collect(
    companyName: string,
    domain: string | null,
    options?: TOptions
  ): Promise<CollectorResult<TData>>;

  /**
   * Validate collected data - can be overridden
   */
  validate(data: TData): boolean {
    return data !== null && data !== undefined;
  }

  /**
   * Calculate quality score - can be overridden
   * Returns 0-100 based on data completeness
   */
  calculateQualityScore(data: TData): number {
    if (!data) return 0;

    // Default implementation - count non-null fields
    const fields = Object.values(data as Record<string, unknown>);
    const nonNullFields = fields.filter(
      (v) => v !== null && v !== undefined && v !== '' &&
      !(Array.isArray(v) && v.length === 0)
    );

    return Math.round((nonNullFields.length / fields.length) * 100);
  }

  /**
   * Save collected data to intelligence_sources table
   */
  async save(
    accountIntelligenceId: string,
    result: CollectorResult<TData>
  ): Promise<void> {
    const supabase = createAdminClient();

    // Check if source already exists for this intelligence record
    const { data: existing } = await supabase
      .from('intelligence_sources')
      .select('id')
      .eq('account_intelligence_id', accountIntelligenceId)
      .eq('source_type', this.sourceType)
      .single();

    const sourceData = {
      account_intelligence_id: accountIntelligenceId,
      source_type: this.sourceType,
      raw_data: result.data,
      processed_data: result.data, // For now, same as raw - can be transformed later
      quality_score: result.qualityScore,
      collected_at: new Date().toISOString(),
      collection_duration_ms: result.durationMs,
      error_message: result.error,
    };

    if (existing) {
      await supabase
        .from('intelligence_sources')
        .update(sourceData)
        .eq('id', existing.id);
    } else {
      await supabase.from('intelligence_sources').insert(sourceData);
    }
  }

  /**
   * Wrap collection with retry logic
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.defaultMaxRetries
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[${this.displayName}] Attempt ${attempt + 1} failed:`,
          error
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper: Sleep for ms
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Create success result
   */
  protected successResult(data: TData, durationMs: number): CollectorResult<TData> {
    return {
      success: true,
      data,
      error: null,
      qualityScore: this.calculateQualityScore(data),
      durationMs,
    };
  }

  /**
   * Helper: Create error result
   */
  protected errorResult(error: string, durationMs: number): CollectorResult<TData> {
    return {
      success: false,
      data: null,
      error,
      qualityScore: 0,
      durationMs,
    };
  }

  /**
   * Helper: Clean URL for display/storage
   */
  protected cleanUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }

  /**
   * Helper: Normalize domain (remove www, protocol)
   */
  protected normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }

  /**
   * Helper: Build URL from domain
   */
  protected buildUrl(domain: string, path: string = ''): string {
    const normalized = this.normalizeDomain(domain);
    return `https://${normalized}${path}`;
  }

  /**
   * Helper: Truncate text to max length
   */
  protected truncate(text: string | null | undefined, maxLength: number): string | null {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Clean text (remove extra whitespace, newlines)
   */
  protected cleanText(text: string | null | undefined): string | null {
    if (!text) return null;
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  /**
   * Helper: Extract emails from text
   */
  protected extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Helper: Extract phone numbers from text
   */
  protected extractPhones(text: string): string[] {
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    const matches = text.match(phoneRegex);
    return matches ? [...new Set(matches.map((p) => p.replace(/\D/g, '')))] : [];
  }

  /**
   * Helper: Parse date string
   */
  protected parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }
}

// ============================================
// COLLECTOR REGISTRY
// ============================================

const collectorRegistry = new Map<IntelligenceSourceType, BaseCollector<unknown>>();

export function registerCollector(collector: BaseCollector<unknown>): void {
  collectorRegistry.set(collector.sourceType, collector);
}

export function getCollector(
  sourceType: IntelligenceSourceType
): BaseCollector<unknown> | undefined {
  return collectorRegistry.get(sourceType);
}

export function getAllCollectors(): BaseCollector<unknown>[] {
  return Array.from(collectorRegistry.values());
}
