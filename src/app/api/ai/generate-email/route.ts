/**
 * POST /api/ai/generate-email
 *
 * Generate an AI email draft based on company context.
 * Used by the products pipeline to generate outreach emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmailFromPromptKey } from '@/lib/ai/promptManager';
import { firstOrNull } from '@/lib/supabase/normalize';

interface GenerateEmailRequest {
  companyId: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  context?: 'sales_outreach' | 'followup' | 'reengagement';
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient();
    const { data: { user: authUser } } = await supabaseUser.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateEmailRequest = await request.json();
    const { companyId, companyName, contactName, contactEmail, context = 'sales_outreach' } = body;

    if (!companyId || !companyName) {
      return NextResponse.json(
        { error: 'companyId and companyName are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, name')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get company products to understand stage context
    const { data: companyProducts } = await supabase
      .from('company_products')
      .select(`
        id,
        status,
        current_stage_id,
        product:products(id, name),
        stage:product_process_stages(id, name)
      `)
      .eq('company_id', companyId)
      .limit(1);

    const companyProduct = companyProducts?.[0];
    const product = firstOrNull(companyProduct?.product);
    const stage = firstOrNull(companyProduct?.stage);

    // Get recent communications for context
    const { data: recentComms } = await supabase
      .from('communications')
      .select('subject, content_preview, direction, occurred_at')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(3);

    const lastInbound = recentComms?.find(c => c.direction === 'inbound');
    const lastOutbound = recentComms?.find(c => c.direction === 'outbound');

    // Build context summary
    const contactFirstName = contactName?.split(' ')[0] || 'there';
    const stageName = stage?.name || 'Unknown';
    const productName = product?.name || 'X-RAI';

    // Calculate days since last contact
    const lastContactDate = recentComms?.[0]?.occurred_at;
    let daysSinceContact = 0;
    if (lastContactDate) {
      daysSinceContact = Math.floor(
        (Date.now() - new Date(lastContactDate as string).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Determine temporal context
    let temporalContext = '';
    if (daysSinceContact === 0) {
      temporalContext = 'We were in contact today.';
    } else if (daysSinceContact <= 7) {
      temporalContext = `We were last in contact ${daysSinceContact} days ago.`;
    } else if (daysSinceContact <= 30) {
      temporalContext = `It has been ${daysSinceContact} days since our last contact. This is a follow-up email.`;
    } else {
      temporalContext = `It has been ${daysSinceContact} days since our last contact. This is a re-engagement email - be warm but not apologetic.`;
    }

    // Stage-specific context
    const stageContextMap: Record<string, string> = {
      'New Lead': 'Focus on introducing our value proposition and understanding their needs.',
      'Qualifying': 'Focus on learning more about their challenges and qualifying the opportunity.',
      'Discovery': 'Focus on deeper discovery of their pain points and how we can help.',
      'Demo': 'Focus on scheduling or confirming a demo. They have not seen the product yet.',
      'Trial': 'They have access to the platform. Focus on how the trial is going and addressing questions.',
      'Negotiation': 'Focus on addressing any remaining concerns and moving toward close.',
    };
    const stageContext = stageContextMap[stageName] || `Current stage: ${stageName}`;

    // Choose prompt key based on context and days since contact
    let promptKey = 'email_followup_stalled'; // Default to reengagement which is more flexible

    // Build variables for the prompt
    const variables: Record<string, string> = {
      company_name: companyName,
      contact_name: contactName || 'there',
      contact_first_name: contactFirstName,
      product_name: productName,
      stage_name: stageName,
      stage_context: stageContext,
      temporal_context: temporalContext,
      reason: 'Follow up and advance the relationship',
      recommended_action: 'Re-engage and move the conversation forward',
      last_inbound_summary: lastInbound?.content_preview?.slice(0, 500) || 'No recent inbound messages',
      last_outbound_summary: lastOutbound?.content_preview?.slice(0, 500) || 'No recent outbound messages',
      sender_name: dbUser.name || 'Your Sales Representative',
      days_since_contact: String(daysSinceContact),
    };

    // Generate email using AI prompts system
    let draft: { subject: string; body: string };

    try {
      const result = await generateEmailFromPromptKey(promptKey, variables);
      draft = {
        subject: result.subject,
        body: result.body,
      };
    } catch (err) {
      console.warn('[GenerateEmail] Error generating draft, using fallback:', err);
      // Fallback draft
      draft = {
        subject: `Following up - ${companyName}`,
        body: `Hi ${contactFirstName},

I wanted to reach out and reconnect about ${productName}.

${stageContext}

Would you have time for a brief call this week to discuss how we can help?

Best regards,
${dbUser.name || 'Your Sales Team'}`,
      };
    }

    return NextResponse.json({
      success: true,
      subject: draft.subject,
      body: draft.body,
    });
  } catch (error) {
    console.error('[GenerateEmail] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email' },
      { status: 500 }
    );
  }
}
