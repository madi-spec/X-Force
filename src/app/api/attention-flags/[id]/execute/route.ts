/**
 * POST /api/attention-flags/[id]/execute
 *
 * Execute suggested action for stalled attention flags.
 * Generates a follow-up draft message using AI.
 *
 * Phase 1: Returns draft only (no sending)
 * Phase 2: If send=true and sending mechanism exists, sends and resolves flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import { callAI } from '@/lib/ai/core/aiClient';
import { AttentionFlagType } from '@/types/operatingLayer';

// Stall flag types that support execute action
const STALL_FLAG_TYPES: AttentionFlagType[] = [
  'STALE_IN_STAGE',
  'NO_NEXT_STEP_AFTER_MEETING',
  'GHOSTING_AFTER_PROPOSAL',
];

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

    // 5. Load company_product context
    let productContext: {
      product_name: string | null;
      stage_name: string | null;
      last_stage_moved_at: string | null;
      next_step_due_at: string | null;
    } = {
      product_name: null,
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
          product:products(id, name),
          current_stage:product_sales_stages(id, name)
        `)
        .eq('id', flag.company_product_id)
        .single();

      if (companyProduct) {
        const product = firstOrNull(companyProduct.product as { id: string; name: string } | { id: string; name: string }[] | null);
        const stage = firstOrNull(companyProduct.current_stage as { id: string; name: string } | { id: string; name: string }[] | null);
        productContext = {
          product_name: product?.name || null,
          stage_name: stage?.name || null,
          last_stage_moved_at: companyProduct.last_stage_moved_at,
          next_step_due_at: companyProduct.next_step_due_at,
        };
      }
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

    // 7. Generate draft using AI
    const contactName = primaryContact?.name || 'there';
    const firstName = contactName.split(' ')[0];

    const prompt = buildFollowUpPrompt({
      companyName: company.name,
      contactName,
      firstName,
      contactTitle: primaryContact?.title || null,
      contactEmail: primaryContact?.email || null,
      productName: productContext.product_name,
      stageName: productContext.stage_name,
      flagType: flag.flag_type as AttentionFlagType,
      reason: flag.reason,
      recommendedAction: flag.recommended_action,
      lastInbound: lastInbound ? {
        subject: lastInbound.subject,
        snippet: lastInbound.body?.slice(0, 200),
        date: lastInbound.occurred_at,
      } : null,
      lastOutbound: lastOutbound ? {
        subject: lastOutbound.subject,
        snippet: lastOutbound.body?.slice(0, 200),
        date: lastOutbound.occurred_at,
      } : null,
    });

    const aiResponse = await callAI({
      prompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    // Parse AI response
    const draft = parseAIDraft(aiResponse.content, firstName, company.name);

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

// ============================================
// HELPERS
// ============================================

function buildFollowUpPrompt(params: {
  companyName: string;
  contactName: string;
  firstName: string;
  contactTitle: string | null;
  contactEmail: string | null;
  productName: string | null;
  stageName: string | null;
  flagType: AttentionFlagType;
  reason: string;
  recommendedAction: string | null;
  lastInbound: { subject: string | null; snippet: string | null; date: string } | null;
  lastOutbound: { subject: string | null; snippet: string | null; date: string } | null;
}): string {
  const {
    companyName,
    contactName,
    firstName,
    contactTitle,
    contactEmail,
    productName,
    stageName,
    flagType,
    reason,
    lastInbound,
    lastOutbound,
  } = params;

  let situationContext = '';
  if (flagType === 'STALE_IN_STAGE') {
    situationContext = `The deal has been stale - ${reason}. We need to re-engage and move things forward.`;
  } else if (flagType === 'NO_NEXT_STEP_AFTER_MEETING') {
    situationContext = `We had a meeting but no next step was scheduled. ${reason}`;
  } else if (flagType === 'GHOSTING_AFTER_PROPOSAL') {
    situationContext = `We sent a proposal but haven't heard back. ${reason}`;
  }

  let commContext = '';
  const hasPriorInteraction = !!(lastInbound || lastOutbound);
  if (lastInbound) {
    commContext += `\nLast message from them (${new Date(lastInbound.date).toLocaleDateString()}): "${lastInbound.snippet || 'No preview'}..."`;
  }
  if (lastOutbound) {
    commContext += `\nOur last message (${new Date(lastOutbound.date).toLocaleDateString()}): "${lastOutbound.snippet || 'No preview'}..."`;
  }

  const hasContactInfo = contactEmail && contactName !== 'there';
  const contactInstruction = hasContactInfo
    ? `Use their first name (${firstName}) in the greeting.`
    : `IMPORTANT: No primary contact email is on file. Draft a generic message WITHOUT using a name. Start with "Hi there" or similar. Include a question asking to confirm the right contact person for this conversation.`;

  return `Generate a follow-up email for a stalled sales deal. Output MUST be valid JSON.

CONTEXT:
- Company: ${companyName}
- Contact: ${hasContactInfo ? `${contactName}${contactTitle ? ` (${contactTitle})` : ''}` : 'Unknown (no primary contact on file)'}
- Product: ${productName || 'Unknown'}
- Current stage: ${stageName || 'Unknown'}
- Situation: ${situationContext}
${commContext ? `\nPRIOR COMMUNICATIONS:${commContext}` : '\nNo prior communications on file.'}

STRICT RULES:
1. Output MUST be valid JSON with this exact structure (no markdown, no code blocks)
2. Body: 70-120 words maximum. Be concise.
3. NO INVENTED DETAILS: Do not reference specific calls, dates, pricing, or prior discussions UNLESS explicitly mentioned in the context above
4. Include exactly ONE clear next step: either propose a 15-minute call OR ask a quick yes/no question
5. Tone: Friendly, direct, professional. No hype. No "I hope this finds you well" or similar filler
6. ${contactInstruction}
7. Do NOT use phrases like "just following up" or "checking in" - be specific about why you're reaching out

OUTPUT FORMAT (respond with ONLY valid JSON, nothing else):
{
  "subject": "short, direct subject line",
  "body": "email body text here",
  "quality_checks": {
    "used_contact_name": ${hasContactInfo},
    "referenced_prior_interaction": ${hasPriorInteraction}
  }
}`;
}

function parseAIDraft(
  content: string,
  firstName: string,
  companyName: string
): { subject: string; body: string; quality_checks: QualityChecks } {
  // Try to parse JSON response
  try {
    // Clean up content - remove markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    const parsed = JSON.parse(jsonContent);
    if (parsed.subject && parsed.body) {
      return {
        subject: parsed.subject,
        body: parsed.body,
        quality_checks: parsed.quality_checks || {
          used_contact_name: false,
          referenced_prior_interaction: false,
        },
      };
    }
  } catch {
    // JSON parse failed, try legacy format
  }

  // Try to parse legacy SUBJECT/BODY format
  const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/i);
  const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

  if (subjectMatch && bodyMatch) {
    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
      quality_checks: {
        used_contact_name: false,
        referenced_prior_interaction: false,
      },
    };
  }

  // Fallback: Use entire content as body with generated subject
  return {
    subject: `Quick question for ${companyName}`,
    body: content.trim() || `Hi ${firstName},

I wanted to touch base and see if you had any questions about our conversation. I'd love to find a time for a quick call to discuss next steps.

Would you have 15 minutes this week?

Best regards`,
    quality_checks: {
      used_contact_name: false,
      referenced_prior_interaction: false,
    },
  };
}
