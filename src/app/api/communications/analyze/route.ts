import { NextRequest, NextResponse } from 'next/server';
import { analyzeCommunication, analyzeAllPending } from '@/lib/communicationHub/analysis/analyzeCommunication';

// POST - Analyze specific communication or batch
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { communication_id, batch, limit } = body;

  if (communication_id) {
    // Analyze single communication
    const result = await analyzeCommunication(communication_id);
    return NextResponse.json(result);
  }

  if (batch) {
    // Analyze all pending
    const result = await analyzeAllPending({ limit: limit || 50 });
    return NextResponse.json({
      success: true,
      ...result,
    });
  }

  return NextResponse.json(
    { error: 'Must provide communication_id or batch: true' },
    { status: 400 }
  );
}

// GET - Get analysis status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const communicationId = searchParams.get('communication_id');

  if (!communicationId) {
    return NextResponse.json(
      { error: 'communication_id required' },
      { status: 400 }
    );
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('communication_analysis')
    .select('*')
    .eq('communication_id', communicationId)
    .eq('is_current', true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ analysis: data });
}
