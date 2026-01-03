/**
 * POST /api/attention-flags/[id]/execute
 *
 * Execute suggested action for stalled attention flags.
 * Generates a follow-up draft message using AI via ai_prompts system.
 *
 * Phase 1: Returns draft only (no sending)
 * Phase 2: If send=true and sending mechanism exists, sends and resolves flag
 *
 * Prompt keys used:
 * - email_followup_stalled: For STALE_IN_STAGE, NO_NEXT_STEP_AFTER_MEETING, GHOSTING_AFTER_PROPOSAL
 * - email_followup_needs_reply: For NEEDS_REPLY flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import { generateEmailFromPromptKey } from '@/lib/ai/promptManager';
import { AttentionFlagType } from '@/types/operatingLayer';

// Flag types that support execute action
const STALL_FLAG_TYPES: AttentionFlagType[] = [
  'STALE_IN_STAGE',
  'NO_NEXT_STEP_AFTER_MEETING',
  'GHOSTING_AFTER_PROPOSAL',
  'NEEDS_REPLY',
];

// Map flag types to prompt keys
const FLAG_TYPE_TO_PROMPT_KEY: Record<string, string> = {
  'STALE_IN_STAGE': 'email_followup_stalled',
  'NO_NEXT_STEP_AFTER_MEETING': 'email_followup_stalled',
  'GHOSTING_AFTER_PROPOSAL': 'email_followup_stalled',
  'NEEDS_REPLY': 'email_followup_needs_reply',
};

interface ExecuteRequest {
  send?: boolean; // Phase 2: actually send the message
}

interface QualityChecks {
  used_contact_name: boolean;
  referenced_prior_interaction: boolean;
}

interface ExecuteResponse {
  success: boolean;
  draft: {
    subject: string;
    body: string;
    channel: 'email' | 'sms';
    quality_checks: QualityChecks;
  };
  context: {
    company_name: string;
    contact_name: string | null;
    contact_email: string | null;
    product_name: string | null;
    stage_name: string | null;
    flag_type: AttentionFlagType;
    reason: string;
  };
  sent?: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flagId } = await params;
    const body: ExecuteRequest = await request.json().catch(() => ({}));

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();

    // 1. Load attention flag
    const { data: flag, error: flagError } = await supabase
      .from('attention_flags')
      .select(`
        id,
        company_id,
        company_product_id,
        flag_type,
        severity,
        status,
        reason,
        recommended_action
      `)
      .eq('id', flagId)
      .single();

    if (flagError || !flag) {
      return NextResponse.json(
        { success: false, error: 'Attention flag not found' },
        { status: 404 }
      );
    }

    // 2. Validate flag
    if (flag.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Flag is not open' },
        { status: 400 }
      );
    }

    if (!STALL_FLAG_TYPES.includes(flag.flag_type as AttentionFlagType)) {
      return NextResponse.json(
        { success: false, error: `Execute not supported for flag type: ${flag.flag_type}` },
        { status: 400 }
      );
    }

    // 3. Load company
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, domain')
      .eq('id', flag.company_id)
      .single();

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 4. Load primary contact
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, title, role')
      .eq('company_id', flag.company_id)
      .order('is_primary', { ascending: false })
      .limit(3);

    const primaryContact = firstOrNull(contacts);

    // 5. Load company_product context (product_name is MANDATORY)
    let productContext: {
      product_name: string | null;
      product_slug: string | null;
      stage_name: string | null;
      last_stage_moved_at: string | null;
      next_step_due_at: string | null;
    } = {
      product_name: null,
      product_slug: null,
      stage_name: null,
      last_stage_moved_at: null,
      next_step_due_at: null,
    };

    if (flag.company_product_id) {
      const { data: companyProduct } = await supabase
        .from('company_products')
        .select(`
          id,
          last_stage_moved_at,
          next_step_due_at,
          product:products(id, name, slug),
          current_stage:product_process_stages(id, name)
        `)
        .eq('id', flag.company_product_id)
        .single();

      if (companyProduct) {
        const product = firstOrNull(companyProduct.product as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null);
        const stage = firstOrNull(companyProduct.current_stage as { id: string; name: string } | { id: string; name: string }[] | null);
        productContext = {
          product_name: product?.name || null,
          product_slug: product?.slug || null,
          stage_name: stage?.name || null,
          last_stage_moved_at: companyProduct.last_stage_moved_at,
          next_step_due_at: companyProduct.next_step_due_at,
        };
      }
    }

    // Product is MANDATORY for generating meaningful follow-up emails
    if (!productContext.product_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot generate follow-up: No product associated with this flag. The attention flag must be linked to a company_product.',
        },
        { status: 400 }
      );
    }

    // 6. Load recent communications for context
    const { data: recentComms } = await supabase
      .from('communications')
      .select('id, channel, direction, subject, body, occurred_at')
      .eq('company_id', flag.company_id)
      .order('occurred_at', { ascending: false })
      .limit(5);

    const lastInbound = recentComms?.find((c) => c.direction === 'inbound');
    const lastOutbound = recentComms?.find((c) => c.direction === 'outbound');

    // 7. Generate draft using AI via ai_prompts system
    const contactName = primaryContact?.name || null;
    const contactFirstName = contactName ? contactName.split(' ')[0] : null;

    // Build variables for the prompt template
    // These MUST match the variables defined in the ai_prompts migration
    const promptVariables: Record<string, string> = {
      company_name: company.name,
      contact_name: contactName || 'there',
      contact_first_name: contactFirstName || 'there',
      contact_title: primaryContact?.title || '',
      product_name: productContext.product_name, // Already validated as non-null above
      stage_name: productContext.stage_name || 'In Progress',
      flag_type: flag.flag_type,
      reason: flag.reason || 'No recent activity',
      recommended_action: flag.recommended_action || 'Follow up to re-engage',
      last_inbound_summary: lastInbound
        ? `[${new Date(lastInbound.occurred_at).toLocaleDateString()}] Subject: "${lastInbound.subject || '(no subject)'}"\n${lastInbound.body?.slice(0, 300) || '(no content)'}`
        : '(No prior inbound messages)',
      last_outbound_summary: lastOutbound
        ? `[${new Date(lastOutbound.occurred_at).toLocaleDateString()}] Subject: "${lastOutbound.subject || '(no subject)'}"\n${lastOutbound.body?.slice(0, 300) || '(no content)'}`
        : '(No prior outbound messages)',
    };

    // Determine base prompt key based on flag type
    const basePromptKey = FLAG_TYPE_TO_PROMPT_KEY[flag.flag_type] || 'email_followup_stalled';

    // Generate email using the ai_prompts system with product-specific override
    // Priority: email_followup_stalled__{product_slug} -> email_followup_stalled
    let draft: { subject: string; body: string; quality_checks: QualityChecks };
    try {
      const emailDraft = await generateEmailFromPromptKey(
        basePromptKey,
        promptVariables,
        { productSlug: productContext.product_slug }
      );
      draft = {
        subject: emailDraft.subject,
        body: emailDraft.body,
        quality_checks: emailDraft.quality_checks,
      };
    } catch (promptError) {
      // NO FALLBACK - if prompt system fails, return clear error
      const errorMessage = promptError instanceof Error ? promptError.message : 'Unknown error';
      console.error('[ExecuteFlag] AI prompt system error:', errorMessage);

      // Determine which prompt keys were tried
      const triedKeys = productContext.product_slug
        ? [`${basePromptKey}__${productContext.product_slug}`, basePromptKey]
        : [basePromptKey];

      return NextResponse.json(
        {
          success: false,
          error: `Failed to generate email draft. AI prompt not found or failed.`,
          details: {
            tried_prompt_keys: triedKeys,
            product_slug: productContext.product_slug,
            underlying_error: errorMessage,
          },
        },
        { status: 500 }
      );
    }

    // Build response
    const response: ExecuteResponse = {
      success: true,
      draft: {
        subject: draft.subject,
        body: draft.body,
        channel: 'email',
        quality_checks: draft.quality_checks,
      },
      context: {
        company_name: company.name,
        contact_name: primaryContact?.name || null,
        contact_email: primaryContact?.email || null,
        product_name: productContext.product_name,
        stage_name: productContext.stage_name,
        flag_type: flag.flag_type as AttentionFlagType,
        reason: flag.reason,
      },
      sent: false,
    };

    // Phase 2: If send=true and we had a send mechanism, we would send here
    // For now, just return the draft
    if (body.send) {
      response.error = 'Sending not yet implemented. Copy the draft and send manually.';
    }

    console.log(`[ExecuteFlag] Generated draft for flag ${flagId}, company ${company.name}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ExecuteFlag] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

