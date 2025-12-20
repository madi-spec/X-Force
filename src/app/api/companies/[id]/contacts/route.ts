/**
 * Company Contacts API
 *
 * GET - Get all contacts for a company
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch contacts for this company
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, name, email, title, phone')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('[CompanyContacts] Error fetching contacts:', error);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contacts: contacts || [],
    });
  } catch (error) {
    console.error('[CompanyContacts] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
