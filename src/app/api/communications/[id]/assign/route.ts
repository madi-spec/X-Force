/**
 * Assign Communication to Company API
 *
 * POST - Assign a communication to an existing company
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface AssignRequest {
  company_id: string;
  contact_id?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: AssignRequest = await request.json();

    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify company exists
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id, name')
      .eq('id', body.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Update the communication
    const updates: Record<string, string | null> = {
      company_id: body.company_id,
    };
    if (body.contact_id) {
      updates.contact_id = body.contact_id;
    }

    const { error } = await adminClient
      .from('communications')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[Assign] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      company: { id: company.id, name: company.name },
    });
  } catch (error) {
    console.error('[Assign] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
