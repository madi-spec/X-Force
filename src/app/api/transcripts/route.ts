import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Filters
  const source = searchParams.get('source'); // fireflies, manual
  const sentiment = searchParams.get('sentiment'); // positive, neutral, negative
  const analyzed = searchParams.get('analyzed'); // true, false
  const search = searchParams.get('search'); // title search
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const companyId = searchParams.get('companyId');
  const dealId = searchParams.get('dealId');

  // Build query
  let query = supabase
    .from('meeting_transcriptions')
    .select(`
      id,
      title,
      meeting_date,
      source,
      word_count,
      analysis,
      summary,
      attendees,
      fireflies_meeting_id,
      company_id,
      deal_id,
      created_at,
      updated_at,
      company:companies(id, name),
      deal:deals(id, name, stage)
    `, { count: 'exact' });

  // Apply filters
  if (source) {
    query = query.eq('source', source);
  }

  if (sentiment) {
    query = query.filter('analysis->sentiment->>overall', 'ilike', `%${sentiment}%`);
  }

  if (analyzed === 'true') {
    query = query.not('analysis', 'is', null);
  } else if (analyzed === 'false') {
    query = query.is('analysis', null);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  if (dateFrom) {
    query = query.gte('meeting_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('meeting_date', dateTo);
  }

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  if (dealId) {
    query = query.eq('deal_id', dealId);
  }

  // Apply sorting
  const validSortColumns = ['created_at', 'meeting_date', 'word_count', 'title'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data: transcripts, error, count } = await query;

  if (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
  }

  // Format the response
  const formattedTranscripts = (transcripts || []).map((t) => {
    const company = Array.isArray(t.company) ? t.company[0] : t.company;
    const deal = Array.isArray(t.deal) ? t.deal[0] : t.deal;
    const analysis = t.analysis as Record<string, unknown> | null;

    return {
      id: t.id,
      title: t.title,
      meetingDate: t.meeting_date,
      source: t.source,
      wordCount: t.word_count,
      summary: t.summary,
      attendees: t.attendees,
      firefliesMeetingId: t.fireflies_meeting_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      company: company ? {
        id: company.id,
        name: company.name,
      } : null,
      deal: deal ? {
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
      } : null,
      analysis: analysis ? {
        sentiment: (analysis.sentiment as Record<string, unknown>)?.overall || null,
        buyingSignals: Array.isArray(analysis.buyingSignals) ? analysis.buyingSignals.length : 0,
        actionItems: Array.isArray(analysis.actionItems) ? analysis.actionItems.length : 0,
        headline: analysis.headline || null,
      } : null,
      isAnalyzed: !!analysis,
    };
  });

  // Get summary stats
  const { data: stats } = await supabase
    .from('meeting_transcriptions')
    .select('source, analysis')
    .then(({ data }) => {
      const result = {
        total: data?.length || 0,
        analyzed: 0,
        bySource: {} as Record<string, number>,
      };

      data?.forEach((t) => {
        if (t.analysis) result.analyzed++;
        const src = t.source || 'manual';
        result.bySource[src] = (result.bySource[src] || 0) + 1;
      });

      return { data: result };
    });

  return NextResponse.json({
    transcripts: formattedTranscripts,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
    stats,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('meeting_transcriptions')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error deleting transcripts:', error);
    return NextResponse.json({ error: 'Failed to delete transcripts' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: ids.length });
}
