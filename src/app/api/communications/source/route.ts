import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const table = searchParams.get('table');
  const id = searchParams.get('id');

  if (!table || !id) {
    return NextResponse.json(
      { error: 'Missing table or id parameter' },
      { status: 400 }
    );
  }

  // Validate table name to prevent SQL injection
  const allowedTables = ['email_messages', 'meeting_transcriptions'];
  if (!allowedTables.includes(table)) {
    return NextResponse.json(
      { error: 'Invalid table name' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[Source API] Error fetching from ${table}:`, error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ source: data });
  } catch (err) {
    console.error('[Source API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
