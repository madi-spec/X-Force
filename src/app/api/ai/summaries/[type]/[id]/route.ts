/**
 * AI Summary by Entity
 * GET/POST /api/ai/summaries/:type/:id
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateSummary,
  getOrGenerateSummary,
  isSummaryStale,
} from '@/lib/ai/summaries';
import type { EntityType } from '@/lib/ai/summaries/types';

interface RouteParams {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

// GET /api/ai/summaries/:type/:id
// Returns existing summary or generates if needed
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type: entityType, id: entityId } = await params;

    if (!['deal', 'company', 'contact'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type. Must be: deal, company, or contact' },
        { status: 400 }
      );
    }

    // Check if summary is stale
    const isStale = await isSummaryStale(entityType as EntityType, entityId);

    // Get or generate summary
    const summary = await getOrGenerateSummary(entityType as EntityType, entityId);

    return NextResponse.json({
      entityType,
      entityId,
      summary,
      wasStale: isStale,
    });
  } catch (error) {
    console.error('Error fetching/generating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get summary' },
      { status: 500 }
    );
  }
}

// POST /api/ai/summaries/:type/:id
// Force regenerate summary
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type: entityType, id: entityId } = await params;

    if (!['deal', 'company', 'contact'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity type. Must be: deal, company, or contact' },
        { status: 400 }
      );
    }

    // Force regenerate
    const result = await generateSummary(entityType as EntityType, entityId, {
      force: true,
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
    console.error('Error regenerating summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate summary' },
      { status: 500 }
    );
  }
}
