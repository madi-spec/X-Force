/**
 * AI Summaries API
 * Generate and retrieve AI summaries
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateSummary,
  getSummary,
  getSummaryStats,
  refreshStaleDealSummaries,
} from '@/lib/ai/summaries';
import type { EntityType } from '@/lib/ai/summaries/types';

// GET /api/ai/summaries?type=deal&id=xxx
// GET /api/ai/summaries?stats=true
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const entityType = url.searchParams.get('type') as EntityType | null;
    const entityId = url.searchParams.get('id');
    const stats = url.searchParams.get('stats');

    // Return stats if requested
    if (stats === 'true') {
      const summaryStats = await getSummaryStats();
      return NextResponse.json(summaryStats);
    }

    // Validate parameters
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and id' },
        { status: 400 }
      );
    }

    if (!['deal', 'company', 'contact'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type. Must be: deal, company, or contact' },
        { status: 400 }
      );
    }

    // Get the summary
    const summary = await getSummary(entityType, entityId);

    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found', entityType, entityId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      entityType,
      entityId,
      summary,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

// POST /api/ai/summaries
// Body: { type: 'deal', id: 'xxx', force?: boolean }
// Or: { action: 'refresh_stale' }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Handle batch refresh action
    if (body.action === 'refresh_stale') {
      const result = await refreshStaleDealSummaries();
      return NextResponse.json({
        action: 'refresh_stale',
        result,
      });
    }

    // Handle single summary generation
    const { type: entityType, id: entityId, force } = body;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: type and id' },
        { status: 400 }
      );
    }

    if (!['deal', 'company', 'contact'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type. Must be: deal, company, or contact' },
        { status: 400 }
      );
    }

    // Generate the summary
    const result = await generateSummary(entityType as EntityType, entityId, {
      force: force === true,
    });

    return NextResponse.json({
      entityType,
      entityId,
      summary: result.summary,
      isNew: result.isNew,
      wasStale: result.wasStale,
      tokensUsed: result.tokensUsed,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
