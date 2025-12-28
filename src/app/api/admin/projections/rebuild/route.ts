/**
 * Admin API: Projection Rebuild
 *
 * POST /api/admin/projections/rebuild
 *
 * Triggers a full rebuild of all projections from the event store.
 * This is a destructive operation that:
 * 1. Truncates all projection tables
 * 2. Resets projector checkpoints
 * 3. Replays all events to rebuild projections
 *
 * Request body:
 * {
 *   projectors?: string[]  // Optional list of projectors to rebuild (defaults to all)
 *   dryRun?: boolean       // If true, only validates without actual rebuild
 *   verifyDeterminism?: boolean  // If true, rebuilds twice and compares results
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  rebuildProjections,
  verifyRebuildDeterminism,
  ALL_PROJECTORS,
  type ProjectorName,
} from '@/lib/eventSourcing';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated and has admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you can customize this check)
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      projectors: requestedProjectors,
      dryRun = false,
      verifyDeterminism: shouldVerify = false,
    } = body as {
      projectors?: string[];
      dryRun?: boolean;
      verifyDeterminism?: boolean;
    };

    // Validate projector names
    let projectors: ProjectorName[] = [...ALL_PROJECTORS];
    if (requestedProjectors && Array.isArray(requestedProjectors)) {
      const validProjectors = requestedProjectors.filter(
        p => ALL_PROJECTORS.includes(p as ProjectorName)
      );
      if (validProjectors.length === 0) {
        return NextResponse.json({
          error: 'No valid projector names provided',
          validProjectors: ALL_PROJECTORS,
        }, { status: 400 });
      }
      projectors = validProjectors as ProjectorName[];
    }

    if (shouldVerify) {
      // Run determinism verification (rebuilds twice)
      const result = await verifyRebuildDeterminism(supabase, {
        projectors,
        dryRun,
        batchSize: 500,
      });

      return NextResponse.json({
        action: 'verify_determinism',
        deterministic: result.deterministic,
        rebuild1: {
          success: result.rebuild1.success,
          totalEvents: result.rebuild1.totalEvents,
          durationMs: result.rebuild1.totalDurationMs,
        },
        rebuild2: {
          success: result.rebuild2.success,
          totalEvents: result.rebuild2.totalEvents,
          durationMs: result.rebuild2.totalDurationMs,
        },
        comparison: result.comparison,
      });
    } else {
      // Single rebuild
      const result = await rebuildProjections(supabase, {
        projectors,
        dryRun,
        batchSize: 500,
      });

      return NextResponse.json({
        action: dryRun ? 'dry_run' : 'rebuild',
        success: result.success,
        projectors: result.projectors,
        totalEvents: result.totalEvents,
        totalDurationMs: result.totalDurationMs,
        snapshotBefore: result.snapshotBefore ? {
          takenAt: result.snapshotBefore.takenAt,
          tables: result.snapshotBefore.tables.map(t => ({
            tableName: t.tableName,
            rowCount: t.rowCount,
          })),
        } : null,
        snapshotAfter: result.snapshotAfter ? {
          takenAt: result.snapshotAfter.takenAt,
          tables: result.snapshotAfter.tables.map(t => ({
            tableName: t.tableName,
            rowCount: t.rowCount,
          })),
        } : null,
      });
    }
  } catch (error) {
    console.error('Projection rebuild error:', error);
    return NextResponse.json({
      error: 'Rebuild failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET: Get rebuild status / info
export async function GET() {
  return NextResponse.json({
    available_projectors: ALL_PROJECTORS,
    usage: {
      rebuild: 'POST with { projectors?: string[], dryRun?: boolean }',
      verify: 'POST with { verifyDeterminism: true }',
    },
  });
}
