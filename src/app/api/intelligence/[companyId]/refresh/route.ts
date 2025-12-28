/**
 * Intelligence Refresh API
 * POST: Force refresh intelligence collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  collectIntelligence,
  type TriggerCollectionResponse,
} from '@/lib/intelligence';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<TriggerCollectionResponse | { error: string }>> {
  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));
    const { sources } = body;

    const supabase = createAdminClient();

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, address, domain')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Force refresh - always run collection
    const result = await collectIntelligence({
      companyId,
      companyName: company.name,
      domain: company.domain || null,
      sources,
      force: true,
    });

    return NextResponse.json({
      status: 'started',
      intelligenceId: result.intelligence?.id || null,
      message: result.success
        ? 'Intelligence refresh complete'
        : 'Refresh partially completed',
    });
  } catch (error) {
    console.error('[API] Error refreshing intelligence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
