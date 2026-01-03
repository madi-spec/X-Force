/**
 * Threshold Configuration Service
 *
 * Manages signal detection thresholds as evented settings.
 * All changes are stored as events for audit trail and replayability.
 *
 * Design principles:
 * - All threshold changes emit ThresholdConfigUpdatedEvent
 * - Current config is derived from replaying events (CQRS)
 * - Admin-only operations with user attribution
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  SignalType,
  ThresholdConfig,
  ThresholdConfigUpdatedEvent,
} from './events';

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default threshold configurations for each signal type.
 * These are used when no custom configuration exists.
 */
export const DEFAULT_THRESHOLD_CONFIGS: Record<SignalType, ThresholdConfig> = {
  // Customer Health - Critical/High sensitivity
  churn_risk: {
    trigger_threshold: 0.7, // 70% confidence
    lookback_hours: 168, // 7 days
    cooldown_hours: 24,
    severity_thresholds: { critical: 0.9, high: 0.75, medium: 0.6 },
    priority_weights: { base_weight: 1.0, recency_weight: 0.8, value_weight: 1.2, engagement_weight: 0.9 },
    enabled: true,
  },
  expansion_ready: {
    trigger_threshold: 0.6,
    lookback_hours: 336, // 14 days
    cooldown_hours: 168, // 7 days
    severity_thresholds: { critical: 0.95, high: 0.85, medium: 0.7 },
    priority_weights: { base_weight: 0.8, recency_weight: 0.6, value_weight: 1.5, engagement_weight: 1.0 },
    enabled: true,
  },
  health_declining: {
    trigger_threshold: 0.5,
    lookback_hours: 168,
    cooldown_hours: 48,
    severity_thresholds: { critical: 0.85, high: 0.7, medium: 0.55 },
    priority_weights: { base_weight: 1.0, recency_weight: 0.9, value_weight: 1.1, engagement_weight: 0.8 },
    enabled: true,
  },
  health_improving: {
    trigger_threshold: 0.6,
    lookback_hours: 336,
    cooldown_hours: 168,
    severity_thresholds: { critical: 0.95, high: 0.85, medium: 0.7 },
    priority_weights: { base_weight: 0.6, recency_weight: 0.5, value_weight: 1.2, engagement_weight: 0.8 },
    enabled: true,
  },

  // Engagement signals
  engagement_spike: {
    trigger_threshold: 2.0, // 2x normal activity
    lookback_hours: 72,
    cooldown_hours: 24,
    severity_thresholds: { critical: 5.0, high: 3.0, medium: 2.0 },
    priority_weights: { base_weight: 0.7, recency_weight: 1.0, value_weight: 1.0, engagement_weight: 1.2 },
    enabled: true,
  },
  engagement_drop: {
    trigger_threshold: 0.5, // 50% of normal
    lookback_hours: 168,
    cooldown_hours: 48,
    severity_thresholds: { critical: 0.2, high: 0.3, medium: 0.5 },
    priority_weights: { base_weight: 0.9, recency_weight: 0.8, value_weight: 1.1, engagement_weight: 0.7 },
    enabled: true,
  },
  champion_dark: {
    trigger_threshold: 14, // days without contact
    lookback_hours: 720, // 30 days
    cooldown_hours: 168,
    severity_thresholds: { critical: 30, high: 21, medium: 14 },
    priority_weights: { base_weight: 1.0, recency_weight: 0.9, value_weight: 1.2, engagement_weight: 1.0 },
    enabled: true,
  },
  new_stakeholder: {
    trigger_threshold: 1, // Any new contact
    lookback_hours: 72,
    cooldown_hours: 24,
    severity_thresholds: { critical: 3, high: 2, medium: 1 },
    priority_weights: { base_weight: 0.6, recency_weight: 1.0, value_weight: 0.8, engagement_weight: 0.7 },
    enabled: true,
  },

  // Deal signals
  deal_stalled: {
    trigger_threshold: 7, // days without activity
    lookback_hours: 336,
    cooldown_hours: 72,
    severity_thresholds: { critical: 21, high: 14, medium: 7 },
    priority_weights: { base_weight: 1.0, recency_weight: 0.8, value_weight: 1.3, engagement_weight: 0.9 },
    enabled: true,
  },
  competitive_threat: {
    trigger_threshold: 0.6,
    lookback_hours: 168,
    cooldown_hours: 48,
    severity_thresholds: { critical: 0.9, high: 0.75, medium: 0.6 },
    priority_weights: { base_weight: 1.2, recency_weight: 1.0, value_weight: 1.4, engagement_weight: 0.8 },
    enabled: true,
  },
  budget_at_risk: {
    trigger_threshold: 0.5,
    lookback_hours: 336,
    cooldown_hours: 72,
    severity_thresholds: { critical: 0.85, high: 0.7, medium: 0.5 },
    priority_weights: { base_weight: 1.1, recency_weight: 0.9, value_weight: 1.5, engagement_weight: 0.7 },
    enabled: true,
  },
  timeline_slip: {
    trigger_threshold: 7, // days slipped
    lookback_hours: 168,
    cooldown_hours: 48,
    severity_thresholds: { critical: 21, high: 14, medium: 7 },
    priority_weights: { base_weight: 0.9, recency_weight: 0.8, value_weight: 1.2, engagement_weight: 0.8 },
    enabled: true,
  },
  buying_signal: {
    trigger_threshold: 0.6,
    lookback_hours: 72,
    cooldown_hours: 24,
    severity_thresholds: { critical: 0.95, high: 0.8, medium: 0.65 },
    priority_weights: { base_weight: 0.8, recency_weight: 1.2, value_weight: 1.3, engagement_weight: 1.0 },
    enabled: true,
  },

  // Commitment signals
  promise_at_risk: {
    trigger_threshold: 24, // hours until due
    lookback_hours: 168,
    cooldown_hours: 12,
    severity_thresholds: { critical: 4, high: 12, medium: 24 },
    priority_weights: { base_weight: 1.3, recency_weight: 1.0, value_weight: 1.1, engagement_weight: 0.8 },
    enabled: true,
  },
  sla_breach: {
    trigger_threshold: 0, // Any breach
    lookback_hours: 24,
    cooldown_hours: 1,
    severity_thresholds: { critical: 0, high: 1, medium: 2 },
    priority_weights: { base_weight: 1.5, recency_weight: 1.2, value_weight: 1.0, engagement_weight: 0.6 },
    enabled: true,
  },
  deadline_approaching: {
    trigger_threshold: 72, // hours until deadline
    lookback_hours: 336,
    cooldown_hours: 24,
    severity_thresholds: { critical: 24, high: 48, medium: 72 },
    priority_weights: { base_weight: 0.8, recency_weight: 1.0, value_weight: 0.9, engagement_weight: 0.7 },
    enabled: true,
  },
  commitment_overdue: {
    trigger_threshold: 24, // hours overdue
    lookback_hours: 168,
    cooldown_hours: 12,
    severity_thresholds: { critical: 72, high: 48, medium: 24 },
    priority_weights: { base_weight: 1.2, recency_weight: 0.9, value_weight: 1.0, engagement_weight: 0.7 },
    enabled: true,
  },

  // Communication signals
  message_needs_reply: {
    trigger_threshold: 24, // hours without reply
    lookback_hours: 168,
    cooldown_hours: 4,
    severity_thresholds: { critical: 72, high: 48, medium: 24 },
    priority_weights: { base_weight: 1.0, recency_weight: 1.1, value_weight: 1.0, engagement_weight: 1.0 },
    enabled: true,
  },
  escalation_detected: {
    trigger_threshold: 0.7,
    lookback_hours: 48,
    cooldown_hours: 2,
    severity_thresholds: { critical: 0.9, high: 0.8, medium: 0.7 },
    priority_weights: { base_weight: 1.4, recency_weight: 1.2, value_weight: 1.1, engagement_weight: 0.8 },
    enabled: true,
  },
  objection_raised: {
    trigger_threshold: 0.6,
    lookback_hours: 72,
    cooldown_hours: 24,
    severity_thresholds: { critical: 0.9, high: 0.75, medium: 0.6 },
    priority_weights: { base_weight: 0.9, recency_weight: 1.0, value_weight: 1.2, engagement_weight: 0.9 },
    enabled: true,
  },
  positive_sentiment: {
    trigger_threshold: 0.7,
    lookback_hours: 168,
    cooldown_hours: 48,
    severity_thresholds: { critical: 0.95, high: 0.85, medium: 0.7 },
    priority_weights: { base_weight: 0.5, recency_weight: 0.8, value_weight: 1.0, engagement_weight: 1.0 },
    enabled: true,
  },

  // Lifecycle signals
  onboarding_blocked: {
    trigger_threshold: 48, // hours blocked
    lookback_hours: 336,
    cooldown_hours: 24,
    severity_thresholds: { critical: 168, high: 96, medium: 48 },
    priority_weights: { base_weight: 1.1, recency_weight: 0.9, value_weight: 1.0, engagement_weight: 0.8 },
    enabled: true,
  },
  milestone_due: {
    trigger_threshold: 168, // hours until due
    lookback_hours: 720,
    cooldown_hours: 48,
    severity_thresholds: { critical: 24, high: 72, medium: 168 },
    priority_weights: { base_weight: 0.7, recency_weight: 0.8, value_weight: 0.9, engagement_weight: 0.8 },
    enabled: true,
  },
  renewal_approaching: {
    trigger_threshold: 30, // days until renewal
    lookback_hours: 2160, // 90 days
    cooldown_hours: 168,
    severity_thresholds: { critical: 7, high: 14, medium: 30 },
    priority_weights: { base_weight: 0.8, recency_weight: 0.7, value_weight: 1.4, engagement_weight: 0.9 },
    enabled: true,
  },
  trial_ending: {
    trigger_threshold: 7, // days until end
    lookback_hours: 336,
    cooldown_hours: 24,
    severity_thresholds: { critical: 2, high: 5, medium: 7 },
    priority_weights: { base_weight: 0.9, recency_weight: 1.0, value_weight: 1.2, engagement_weight: 1.0 },
    enabled: true,
  },
};

// ============================================================================
// SERVICE
// ============================================================================

export class ThresholdConfigService {
  private configCache: Map<SignalType, ThresholdConfig> = new Map();
  private lastCacheRefresh: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current threshold configuration for a signal type.
   * Returns custom config if set, otherwise default.
   */
  async getConfig(signalType: SignalType): Promise<ThresholdConfig> {
    await this.ensureCacheValid();

    const customConfig = this.configCache.get(signalType);
    if (customConfig) {
      return customConfig;
    }

    return DEFAULT_THRESHOLD_CONFIGS[signalType];
  }

  /**
   * Get all current threshold configurations.
   */
  async getAllConfigs(): Promise<Map<SignalType, ThresholdConfig>> {
    await this.ensureCacheValid();

    const result = new Map<SignalType, ThresholdConfig>();

    // Start with defaults
    for (const [signalType, config] of Object.entries(DEFAULT_THRESHOLD_CONFIGS)) {
      result.set(signalType as SignalType, config);
    }

    // Override with custom configs
    for (const [signalType, config] of this.configCache) {
      result.set(signalType, config);
    }

    return result;
  }

  /**
   * Update a threshold configuration (admin only).
   * Emits ThresholdConfigUpdatedEvent for audit trail.
   */
  async updateConfig(
    signalType: SignalType,
    newConfig: Partial<ThresholdConfig>,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentConfig = await this.getConfig(signalType);
      const mergedConfig: ThresholdConfig = {
        ...currentConfig,
        ...newConfig,
      };

      // Create the update event
      const event: ThresholdConfigUpdatedEvent = {
        event_type: 'ThresholdConfigUpdated',
        event_data: {
          config_id: `threshold_${signalType}`,
          signal_type: signalType,
          previous_threshold: currentConfig,
          new_threshold: mergedConfig,
          updated_by_user_id: userId,
          reason,
        },
      };

      // Store event
      const { error } = await this.supabase.from('event_store').insert({
        aggregate_type: 'threshold_config',
        aggregate_id: signalType,
        event_type: event.event_type,
        event_data: event.event_data,
        actor_type: 'user',
        actor_id: userId,
        occurred_at: new Date().toISOString(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Update cache
      this.configCache.set(signalType, mergedConfig);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enable or disable a signal type.
   */
  async setEnabled(
    signalType: SignalType,
    enabled: boolean,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateConfig(
      signalType,
      { enabled },
      userId,
      enabled ? 'Signal type enabled' : 'Signal type disabled'
    );
  }

  /**
   * Reset a signal type to default configuration.
   */
  async resetToDefault(
    signalType: SignalType,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const defaultConfig = DEFAULT_THRESHOLD_CONFIGS[signalType];
    return this.updateConfig(
      signalType,
      defaultConfig,
      userId,
      'Reset to default configuration'
    );
  }

  /**
   * Get configuration change history for a signal type.
   */
  async getConfigHistory(
    signalType: SignalType,
    options: { limit?: number } = {}
  ): Promise<ThresholdConfigUpdatedEvent[]> {
    const { limit = 20 } = options;

    const { data } = await this.supabase
      .from('event_store')
      .select('*')
      .eq('aggregate_type', 'threshold_config')
      .eq('aggregate_id', signalType)
      .eq('event_type', 'ThresholdConfigUpdated')
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map(row => ({
      event_type: 'ThresholdConfigUpdated' as const,
      event_data: row.event_data,
    }));
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async ensureCacheValid(): Promise<void> {
    const now = new Date();

    if (
      this.lastCacheRefresh &&
      now.getTime() - this.lastCacheRefresh.getTime() < this.CACHE_TTL_MS
    ) {
      return;
    }

    await this.refreshCache();
  }

  private async refreshCache(): Promise<void> {
    // Get all threshold config events, grouped by signal type,
    // and take the latest for each
    const { data } = await this.supabase
      .from('event_store')
      .select('*')
      .eq('aggregate_type', 'threshold_config')
      .eq('event_type', 'ThresholdConfigUpdated')
      .order('occurred_at', { ascending: false });

    if (!data) {
      this.lastCacheRefresh = new Date();
      return;
    }

    // Build map of latest config per signal type
    const latestConfigs = new Map<SignalType, ThresholdConfig>();
    const seenTypes = new Set<string>();

    for (const row of data) {
      const signalType = row.aggregate_id as SignalType;
      if (seenTypes.has(signalType)) continue;

      seenTypes.add(signalType);
      latestConfigs.set(signalType, row.event_data.new_threshold);
    }

    this.configCache = latestConfigs;
    this.lastCacheRefresh = new Date();
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let serviceInstance: ThresholdConfigService | null = null;

export function getThresholdConfigService(
  supabase: SupabaseClient
): ThresholdConfigService {
  if (!serviceInstance) {
    serviceInstance = new ThresholdConfigService(supabase);
  }
  return serviceInstance;
}
