/**
 * Assign Communication to Company API
 *
 * POST - Assign a communication to an existing company
 * This also triggers follow-up processing (attention flags, etc.)
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

    // Get the communication before updating to check what type it is
    const { data: communication } = await adminClient
      .from('communications')
      .select('*')
      .eq('id', id)
      .single();

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

    // Trigger follow-up processing for the newly assigned communication
    // Check if this communication needs attention (e.g., awaiting response)
    if (communication && communication.awaiting_our_response) {
      // Create an attention flag for the assigned company
      const { error: flagError } = await adminClient
        .from('attention_flags')
        .insert({
          company_id: body.company_id,
          flag_type: 'needs_response',
          severity: 'high',
          reason: `Email assigned from unknown company - requires response`,
          source_type: 'communication',
          source_id: id,
          metadata: {
            communication_id: id,
            assigned_from_unknown: true,
            subject: communication.subject,
          },
        });

      if (flagError) {
        console.error('[Assign] Error creating attention flag:', flagError);
        // Don't fail the request, just log
      } else {
        console.log('[Assign] Created attention flag for assigned communication');
      }
    }

    // Update any related activities to point to the new company
    const { error: activityError } = await adminClient
      .from('activities')
      .update({ company_id: body.company_id })
      .eq('communication_id', id)
      .is('company_id', null);

    if (activityError) {
      console.error('[Assign] Error updating activities:', activityError);
    }

    console.log(`[Assign] Communication ${id} assigned to company ${company.name}`);

    return NextResponse.json({
      success: true,
      company: { id: company.id, name: company.name },
      followUpCreated: communication?.awaiting_our_response || false,
    });
  } catch (error) {
    console.error('[Assign] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
