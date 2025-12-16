/**
 * Intelligence Status API
 * GET: Get collection status/progress
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCollectionProgress,
  type CollectionProgress,
} from '@/lib/intelligence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<CollectionProgress | { error: string }>> {
  try {
    const { companyId } = await params;

    const progress = await getCollectionProgress(companyId);

    if (!progress) {
      return NextResponse.json(
        { error: 'No intelligence found for company' },
        { status: 404 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('[API] Error getting status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
