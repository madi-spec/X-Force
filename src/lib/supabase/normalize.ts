/**
 * Supabase Join Normalization Helpers
 *
 * Supabase returns joined relations in inconsistent shapes:
 * - Single relations may return as object OR single-element array
 * - Nullable relations may be null, undefined, or empty array
 *
 * These helpers normalize the shapes for consistent access.
 */

/**
 * Extracts the first element from a Supabase join result.
 * Handles: T, T[], null, undefined, empty array
 *
 * @example
 * const stage = firstOrNull(row.current_stage);
 * // stage is now T | null, never T[]
 */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }

  return value;
}

/**
 * Ensures a Supabase join result is always an array.
 * Handles: T, T[], null, undefined
 *
 * @example
 * const products = asArray(row.products);
 * // products is now T[], never T or null
 */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

/**
 * Type guard to check if a value is defined (not null/undefined).
 * Useful for filtering arrays after normalization.
 *
 * @example
 * const stages = items.map(i => firstOrNull(i.stage)).filter(isDefined);
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Safely extracts a nested property from a Supabase join.
 * Combines firstOrNull with property access.
 *
 * @example
 * const stageName = getNestedProp(row.current_stage, 'name');
 */
export function getNestedProp<T, K extends keyof T>(
  value: T | T[] | null | undefined,
  key: K
): T[K] | null {
  const normalized = firstOrNull(value);
  return normalized ? normalized[key] : null;
}
