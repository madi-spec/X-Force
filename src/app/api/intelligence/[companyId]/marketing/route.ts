/**
 * Marketing Intelligence API
 * GET /api/intelligence/[companyId]/marketing - Get marketing intelligence data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Fetch marketing intelligence for the company
    const { data, error } = await supabase
      .from('marketing_intelligence')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found
        return NextResponse.json(null);
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json(null);
    }

    // Transform the data for the frontend
    const response = {
      blog: data.blog_data || null,
      youtube: data.youtube_data || null,
      facebook: data.facebook_data || null,
      gbp: data.gbp_data || null,
      instagram: data.instagram_data || null,
      reviewVelocity: data.review_velocity || null,
      websiteMarketing: data.website_marketing || null,
      scores: data.scores || {
        content: 0,
        social: 0,
        engagement: 0,
        frequency: 0,
        reach: 0,
        sophistication: 0,
        advertising: 0,
        reviews: 0,
        overall: 0,
      },
      aiAnalysis: data.ai_analysis || null,
      collectedAt: data.collected_at,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Marketing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketing intelligence' },
      { status: 500 }
    );
  }
}
