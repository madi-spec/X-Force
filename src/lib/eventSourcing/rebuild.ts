/**
 * Deterministic Projection Rebuild Tool
 *
 * Rebuilds all projections from the event store:
 * 1. Truncates projection tables
 * 2. Resets projector checkpoints
 * 3. Replays all events in global_sequence order
 *
 * This is a destructive operation that should be used carefully.
 * It ensures projections can always be rebuilt from authoritative events.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PROJECTION_TABLES } from './guardrails';
import {
  esLogger,
  trackRebuildStarted,
  trackRebuildProgress,
  trackRebuildCompleted,
} from './observability';

// All projectors that need to be rebuilt
export const ALL_PROJECTORS = [
  'support_case_read_model',
  'support_case_sla_facts',
  'company_product_read_model',
  'company_product_stage_facts',
  'company_product_open_case_counts',
  'company_open_case_counts',
  'product_pipeline_stage_counts',
] as const;

export type ProjectorName = typeof ALL_PROJECTORS[number];

export interface RebuildOptions {
  // Which projectors to rebuild (defaults to all)
  projectors?: ProjectorName[];
  // Batch size for event processing
  batchSize?: number;
  // Progress callback
  onProgress?: (projector: string, eventsProcessed: number, totalEvents: number) => void;
  // Whether to run in dry-run mode (don't actually truncate/rebuild)
  dryRun?: boolean;
}

export interface RebuildResult {
  success: boolean;
  projectors: {
    name: string;
    eventsProcessed: number;
    durationMs: number;
    success: boolean;
    error?: string;
  }[];
  totalEvents: number;
  totalDurationMs: number;
  snapshotBefore?: ProjectionSnapshot;
  snapshotAfter?: ProjectionSnapshot;
}

export interface ProjectionSnapshot {
  takenAt: string;
  tables: {
    tableName: string;
    rowCount: number;
    checksum: string;
    sampleRows?: Record<string, unknown>[];
  }[];
}

/**
 * Take a snapshot of projection tables for comparison
 */
export async function takeProjectionSnapshot(
  supabase: SupabaseClient,
  tables: readonly string[] = PROJECTION_TABLES
): Promise<ProjectionSnapshot> {
  const snapshot: ProjectionSnapshot = {
    takenAt: new Date().toISOString(),
    tables: [],
  };

  for (const tableName of tables) {
    try {
      // Get row count
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      // Get all rows for checksum calculation (sorted for determinism)
      const { data: rows } = await supabase
        .from(tableName)
        .select('*')
        .order('id' in (await getTableColumns(supabase, tableName)) ? 'id' : 'created_at', { ascending: true });

      // Calculate a simple checksum from the data
      const checksum = calculateChecksum(rows || []);

      snapshot.tables.push({
        tableName,
        rowCount: count || 0,
        checksum,
        sampleRows: (rows || []).slice(0, 5), // First 5 rows for debugging
      });
    } catch (error) {
      esLogger.error('rebuild', `Failed to snapshot table ${tableName}`, error as Error);
      snapshot.tables.push({
        tableName,
        rowCount: -1,
        checksum: 'error',
      });
    }
  }

  return snapshot;
}

/**
 * Get table columns (helper for ordering)
 */
async function getTableColumns(supabase: SupabaseClient, tableName: string): Promise<string[]> {
  // This is a simplified version - in production you'd query information_schema
  const { data } = await supabase.from(tableName).select('*').limit(1);
  if (data && data.length > 0) {
    return Object.keys(data[0]);
  }
  return [];
}

/**
 * Calculate a deterministic checksum for row data
 */
function calculateChecksum(rows: Record<string, unknown>[]): string {
  // Sort each row's keys and serialize deterministically
  const normalized = rows.map(row => {
    const sortedKeys = Object.keys(row).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      // Normalize timestamps to ISO strings
      let value = row[key];
      if (value instanceof Date) {
        value = value.toISOString();
      }
      // Normalize projected_at/updated_at to ignore minor differences
      if (key === 'projected_at' || key === 'updated_at' || key === 'projection_updated_at') {
        // Only keep date part for comparison (ignore exact milliseconds)
        if (typeof value === 'string') {
          value = value.substring(0, 19); // YYYY-MM-DDTHH:MM:SS
        }
      }
      normalized[key] = value;
    }
    return JSON.stringify(normalized);
  });

  // Simple hash of the serialized data
  const content = normalized.join('|');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Compare two snapshots for equality
 */
export function compareSnapshots(
  before: ProjectionSnapshot,
  after: ProjectionSnapshot
): { equal: boolean; differences: string[] } {
  const differences: string[] = [];

  for (const afterTable of after.tables) {
    const beforeTable = before.tables.find(t => t.tableName === afterTable.tableName);

    if (!beforeTable) {
      differences.push(`Table ${afterTable.tableName}: not in before snapshot`);
      continue;
    }

    if (beforeTable.rowCount !== afterTable.rowCount) {
      differences.push(
        `Table ${afterTable.tableName}: row count differs (${beforeTable.rowCount} vs ${afterTable.rowCount})`
      );
    }

    if (beforeTable.checksum !== afterTable.checksum) {
      differences.push(
        `Table ${afterTable.tableName}: checksum differs (${beforeTable.checksum} vs ${afterTable.checksum})`
      );
    }
  }

  return {
    equal: differences.length === 0,
    differences,
  };
}

/**
 * Truncate projection tables
 */
async function truncateProjectionTables(
  supabase: SupabaseClient,
  tables: readonly string[]
): Promise<void> {
  for (const tableName of tables) {
    esLogger.info('rebuild', `Truncating table: ${tableName}`);

    // Use DELETE instead of TRUNCATE for RLS compatibility
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) {
      // If 'id' column doesn't exist, try alternate approach
      if (error.message.includes('id')) {
        // Try deleting with a different primary key
        const { error: error2 } = await supabase.rpc('truncate_projection_table', {
          table_name: tableName,
        });
        if (error2) {
          throw new Error(`Failed to truncate ${tableName}: ${error2.message}`);
        }
      } else {
        throw new Error(`Failed to truncate ${tableName}: ${error.message}`);
      }
    }
  }
}

/**
 * Reset projector checkpoints
 */
async function resetProjectorCheckpoints(
  supabase: SupabaseClient,
  projectors: readonly string[]
): Promise<void> {
  for (const projectorName of projectors) {
    esLogger.info('rebuild', `Resetting checkpoint: ${projectorName}`);

    const { error } = await supabase
      .from('projector_checkpoints')
      .update({
        last_processed_global_sequence: 0,
        last_processed_event_id: null,
        last_processed_at: null,
        events_processed_count: 0,
        errors_count: 0,
        last_error: null,
        last_error_at: null,
        status: 'rebuilding',
        updated_at: new Date().toISOString(),
      })
      .eq('projector_name', projectorName);

    if (error) {
      throw new Error(`Failed to reset checkpoint for ${projectorName}: ${error.message}`);
    }
  }
}

/**
 * Get total event count for progress tracking
 */
async function getTotalEventCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('event_store')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to get event count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Run a single projector to completion
 */
async function runProjectorToCompletion(
  supabase: SupabaseClient,
  projectorName: string,
  batchSize: number,
  onProgress?: (eventsProcessed: number, totalEvents: number) => void
): Promise<{ eventsProcessed: number; durationMs: number }> {
  const startTime = Date.now();
  let eventsProcessed = 0;
  let lastSequence = 0;

  // Import projectors dynamically to avoid circular dependencies
  const { runProjector } = await import('../lifecycle/projectors/core');
  const { getProjectorByName } = await import('./projectorRegistry');

  const projector = await getProjectorByName(projectorName);
  if (!projector) {
    throw new Error(`Unknown projector: ${projectorName}`);
  }

  // Process in batches until complete
  let hasMore = true;
  while (hasMore) {
    const result = await runProjector(supabase, projector, {
      batchSize,
      stopOnError: true,
    });

    eventsProcessed += result.eventsProcessed;
    lastSequence = result.lastProcessedSequence;
    hasMore = result.eventsProcessed === batchSize;

    if (onProgress) {
      const totalEvents = await getTotalEventCount(supabase);
      onProgress(eventsProcessed, totalEvents);
    }
  }

  // Mark projector as active after rebuild
  await supabase
    .from('projector_checkpoints')
    .update({ status: 'active' })
    .eq('projector_name', projectorName);

  return {
    eventsProcessed,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Main rebuild function
 */
export async function rebuildProjections(
  supabase: SupabaseClient,
  options: RebuildOptions = {}
): Promise<RebuildResult> {
  const {
    projectors = [...ALL_PROJECTORS],
    batchSize = 500,
    onProgress,
    dryRun = false,
  } = options;

  const startTime = Date.now();
  const result: RebuildResult = {
    success: true,
    projectors: [],
    totalEvents: 0,
    totalDurationMs: 0,
  };

  try {
    esLogger.info('rebuild', 'Starting projection rebuild', {
      projectors,
      batchSize,
      dryRun,
    });
    trackRebuildStarted([...projectors]);

    // 1. Take before snapshot
    result.snapshotBefore = await takeProjectionSnapshot(supabase, projectors);
    esLogger.info('rebuild', 'Before snapshot taken', {
      tables: result.snapshotBefore.tables.map(t => ({
        name: t.tableName,
        rows: t.rowCount,
      })),
    });

    if (dryRun) {
      esLogger.info('rebuild', 'Dry run mode - skipping actual rebuild');
      result.totalDurationMs = Date.now() - startTime;
      return result;
    }

    // 2. Truncate projection tables
    await truncateProjectionTables(supabase, projectors);

    // 3. Reset checkpoints
    await resetProjectorCheckpoints(supabase, projectors);

    // 4. Get total events for progress tracking
    const totalEvents = await getTotalEventCount(supabase);
    result.totalEvents = totalEvents;

    // 5. Replay events for each projector
    for (const projectorName of projectors) {
      const projectorStart = Date.now();

      try {
        esLogger.info('rebuild', `Rebuilding projector: ${projectorName}`);

        const { eventsProcessed, durationMs } = await runProjectorToCompletion(
          supabase,
          projectorName,
          batchSize,
          (processed, total) => {
            trackRebuildProgress(projectorName, processed, total, Date.now() - projectorStart);
            if (onProgress) {
              onProgress(projectorName, processed, total);
            }
          }
        );

        result.projectors.push({
          name: projectorName,
          eventsProcessed,
          durationMs,
          success: true,
        });
      } catch (error) {
        const err = error as Error;
        esLogger.error('rebuild', `Failed to rebuild projector: ${projectorName}`, err);

        result.projectors.push({
          name: projectorName,
          eventsProcessed: 0,
          durationMs: Date.now() - projectorStart,
          success: false,
          error: err.message,
        });

        result.success = false;
      }
    }

    // 6. Take after snapshot
    result.snapshotAfter = await takeProjectionSnapshot(supabase, projectors);

    result.totalDurationMs = Date.now() - startTime;

    trackRebuildCompleted(
      [...projectors],
      result.totalEvents,
      result.totalDurationMs,
      result.success
    );

    esLogger.info('rebuild', 'Projection rebuild completed', {
      success: result.success,
      totalEvents: result.totalEvents,
      durationMs: result.totalDurationMs,
      durationSeconds: Math.round(result.totalDurationMs / 1000),
    });

    return result;

  } catch (error) {
    const err = error as Error;
    esLogger.error('rebuild', 'Projection rebuild failed', err);

    result.success = false;
    result.totalDurationMs = Date.now() - startTime;

    trackRebuildCompleted(
      [...projectors],
      result.totalEvents,
      result.totalDurationMs,
      false,
      err
    );

    return result;
  }
}

/**
 * Verify rebuild determinism by rebuilding twice and comparing
 */
export async function verifyRebuildDeterminism(
  supabase: SupabaseClient,
  options: RebuildOptions = {}
): Promise<{
  deterministic: boolean;
  rebuild1: RebuildResult;
  rebuild2: RebuildResult;
  comparison: { equal: boolean; differences: string[] };
}> {
  esLogger.info('rebuild', 'Starting determinism verification (double rebuild)');

  // First rebuild
  const rebuild1 = await rebuildProjections(supabase, options);

  if (!rebuild1.success) {
    return {
      deterministic: false,
      rebuild1,
      rebuild2: { success: false, projectors: [], totalEvents: 0, totalDurationMs: 0 },
      comparison: { equal: false, differences: ['First rebuild failed'] },
    };
  }

  // Take snapshot after first rebuild
  const snapshot1 = await takeProjectionSnapshot(supabase, options.projectors || ALL_PROJECTORS);

  // Second rebuild
  const rebuild2 = await rebuildProjections(supabase, options);

  if (!rebuild2.success) {
    return {
      deterministic: false,
      rebuild1,
      rebuild2,
      comparison: { equal: false, differences: ['Second rebuild failed'] },
    };
  }

  // Take snapshot after second rebuild
  const snapshot2 = await takeProjectionSnapshot(supabase, options.projectors || ALL_PROJECTORS);

  // Compare snapshots
  const comparison = compareSnapshots(snapshot1, snapshot2);

  esLogger.info('rebuild', 'Determinism verification completed', {
    deterministic: comparison.equal,
    differences: comparison.differences,
  });

  return {
    deterministic: comparison.equal,
    rebuild1,
    rebuild2,
    comparison,
  };
}
