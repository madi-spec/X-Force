/**
 * Feature Flags
 *
 * Controls feature rollout and A/B testing.
 * Flags can be overridden via environment variables or user settings.
 */

export interface FeatureFlags {
  // Unified Shell with RBAC focus permissions
  unifiedShell: boolean;

  // Event sourcing for user preferences
  eventSourcedPreferences: boolean;

  // New navigation structure
  newNavigation: boolean;
}

/**
 * Default feature flags
 */
const defaultFlags: FeatureFlags = {
  unifiedShell: true,
  eventSourcedPreferences: true,
  newNavigation: true,
};

/**
 * Get feature flags from environment
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    unifiedShell: getEnvFlag('NEXT_PUBLIC_FEATURE_UNIFIED_SHELL', defaultFlags.unifiedShell),
    eventSourcedPreferences: getEnvFlag(
      'NEXT_PUBLIC_FEATURE_EVENT_SOURCED_PREFERENCES',
      defaultFlags.eventSourcedPreferences
    ),
    newNavigation: getEnvFlag(
      'NEXT_PUBLIC_FEATURE_NEW_NAVIGATION',
      defaultFlags.newNavigation
    ),
  };
}

/**
 * Get a single feature flag
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[flag];
}

/**
 * Helper to get boolean from environment variable
 */
function getEnvFlag(envVar: string, defaultValue: boolean): boolean {
  if (typeof process === 'undefined') return defaultValue;

  const value = process.env[envVar];
  if (value === undefined) return defaultValue;

  return value === 'true' || value === '1';
}
