import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/activities/[id]/assign-company
 *
 * Assigns a company to an activity (meeting).
 *
 * Body:
 * - company_id: string - The company ID to assign
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Parse request body
    let body: { company_id?: string | null };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { company_id } = body;

    // company_id can be null to remove assignment
    if (company_id === undefined) {
      return NextResponse.json({ error: 'company_id is required (can be null to remove)' }, { status: 400 });
    }

    // Verify activity exists and belongs to user
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If company_id is provided, verify company exists
    let companyData: { id: string; name: string } | null = null;
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      companyData = company;
    }

    // Use admin client for update to bypass RLS (we've already verified ownership above)
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('activities')
      .update({
        company_id: company_id,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Assign Company API] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to assign company' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: company_id ? 'Company assigned' : 'Company removed',
      company: companyData,
    });

  } catch (error) {
    console.error('[Assign Company API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to assign company' },
      { status: 500 }
    );
  }
}
