/**
 * POST /api/attention-flags/create
 *
 * Manually create an attention flag.
 * Used as a manual lever for flagging items that need attention.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AttentionFlagType,
  AttentionFlagSeverity,
  AttentionFlagMutationResponse,
} from '@/types/operatingLayer';

// Valid flag types for validation
const VALID_FLAG_TYPES: AttentionFlagType[] = [
  'NEEDS_REPLY',
  'BOOK_MEETING_APPROVAL',
  'PROPOSAL_APPROVAL',
  'PRICING_EXCEPTION',
  'CLOSE_DECISION',
  'HIGH_RISK_OBJECTION',
  'NO_NEXT_STEP_AFTER_MEETING',
  'STALE_IN_STAGE',
  'GHOSTING_AFTER_PROPOSAL',
  'DATA_MISSING_BLOCKER',
  'SYSTEM_ERROR',
];

// Valid severity levels for validation
const VALID_SEVERITIES: AttentionFlagSeverity[] = ['low', 'medium', 'high', 'critical'];

interface CreateAttentionFlagRequest {
  company_id: string;
  company_product_id?: string | null;
  flag_type: AttentionFlagType;
  severity: AttentionFlagSeverity;
  reason: string;
  recommended_action: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Verify user exists
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate request body
    let body: CreateAttentionFlagRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate required fields
    const errors: string[] = [];

    if (!body.company_id || typeof body.company_id !== 'string') {
      errors.push('company_id is required and must be a string');
    }

    if (!body.flag_type || !VALID_FLAG_TYPES.includes(body.flag_type)) {
      errors.push(`flag_type is required and must be one of: ${VALID_FLAG_TYPES.join(', ')}`);
    }

    if (!body.severity || !VALID_SEVERITIES.includes(body.severity)) {
      errors.push(`severity is required and must be one of: ${VALID_SEVERITIES.join(', ')}`);
    }

    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      errors.push('reason is required and must be a non-empty string');
    }

    if (!body.recommended_action || typeof body.recommended_action !== 'string' || body.recommended_action.trim().length === 0) {
      errors.push('recommended_action is required and must be a non-empty string');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', body.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // If company_product_id provided, verify it exists and belongs to the company
    if (body.company_product_id) {
      const { data: companyProduct, error: cpError } = await supabase
        .from('company_products')
        .select('id, company_id')
        .eq('id', body.company_product_id)
        .single();

      if (cpError || !companyProduct) {
        return NextResponse.json({ error: 'Company product not found' }, { status: 404 });
      }

      if (companyProduct.company_id !== body.company_id) {
        return NextResponse.json(
          { error: 'Company product does not belong to the specified company' },
          { status: 400 }
        );
      }
    }

    // Create the attention flag
    const { data: createdFlag, error: insertError } = await supabase
      .from('attention_flags')
      .insert({
        company_id: body.company_id,
        company_product_id: body.company_product_id || null,
        source_type: 'system',
        source_id: null,
        flag_type: body.flag_type,
        severity: body.severity,
        reason: body.reason.trim(),
        recommended_action: body.recommended_action.trim(),
        owner: 'human',
        status: 'open',
      })
      .select(`
        *,
        company:companies(id, name),
        company_product:company_products(
          id,
          product:products(id, name, slug)
        )
      `)
      .single();

    if (insertError) {
      console.error('[AttentionFlags] Error creating flag:', insertError);
      throw insertError;
    }

    const response: AttentionFlagMutationResponse = {
      success: true,
      flag: createdFlag,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[AttentionFlags] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
