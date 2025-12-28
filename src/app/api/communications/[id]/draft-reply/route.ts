/**
 * POST /api/communications/[id]/draft-reply
 *
 * Generate an AI draft reply for a communication that needs a response.
 * Uses the ai_prompts system to generate contextual replies.
 * Includes REAL calendar availability for natural language scheduling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import { generateEmailFromPromptKey, clearPromptCache } from '@/lib/ai/promptManager';
import { getRealAvailableSlots, formatSlotsForPrompt } from '@/lib/scheduler/calendarIntegration';

interface DraftReplyResponse {
  success: boolean;
  draft?: {
    subject: string;
    body: string;
    channel: 'email';
  };
  context?: {
    company_name: string;
    contact_name: string | null;
    contact_email: string | null;
    original_subject: string | null;
    original_preview: string | null;
  };
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communicationId } = await params;

    // Get authenticated user for calendar access
    const supabaseUser = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseUser.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();

    // 1. Load communication with context
    const { data: comm, error: commError } = await supabase
      .from('communications')
      .select(`
        id,
        subject,
        content_preview,
        full_content,
        their_participants,
        occurred_at,
        company_id,
        contact_id,
        company:companies(id, name, domain),
        contact:contacts(id, name, email, title)
      `)
      .eq('id', communicationId)
      .single();

    if (commError || !comm) {
      return NextResponse.json(
        { success: false, error: 'Communication not found' },
        { status: 404 }
      );
    }

    // 2. Get company and contact info
    const company = firstOrNull(comm.company);
    const contact = firstOrNull(comm.contact);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Communication not linked to a company' },
        { status: 400 }
      );
    }

    // Get contact email from contact record or their_participants
    let contactEmail = contact?.email;
    let contactName = contact?.name;
    let contactTitle = (contact as { title?: string })?.title || '';

    if (!contactEmail && comm.their_participants) {
      const participants = comm.their_participants as Array<{ name?: string; email?: string }>;
      if (participants.length > 0) {
        contactEmail = participants[0].email || null;
        contactName = contactName || participants[0].name || null;
      }
    }

    // Extract first name
    const contactFirstName = contactName?.split(' ')[0] || 'there';

    // 3. Get additional context (company products, recent activity)
    const { data: companyProducts } = await supabase
      .from('company_products')
      .select(`
        id,
        stage_id,
        product_id,
        stage:pipeline_stages(id, name),
        product:products(id, name)
      `)
      .eq('company_id', company.id)
      .limit(1);

    const companyProduct = companyProducts?.[0];
    const stage = firstOrNull(companyProduct?.stage);
    const product = firstOrNull(companyProduct?.product);

    // Get most recent outbound communication for context
    const { data: recentOutbound } = await supabase
      .from('communications')
      .select('subject, content_preview')
      .eq('company_id', company.id)
      .eq('direction', 'outbound')
      .order('occurred_at', { ascending: false })
      .limit(1);

    const lastOutbound = recentOutbound?.[0];

    // 4. Fetch REAL calendar availability for scheduling
    // Get the active Microsoft connection (might be linked to auth user or a different stored user_id)
    const { data: msConnection } = await supabase
      .from('microsoft_connections')
      .select('user_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    let availableTimesText = 'No specific times available.';

    if (!msConnection) {
      console.warn('[Draft Reply] No active Microsoft connection found');
    } else {
      try {
        console.log('[Draft Reply] Fetching calendar for MS user:', msConnection.user_id);
        const { slots, error: calendarError } = await getRealAvailableSlots(msConnection.user_id, {
          daysAhead: 15,  // 3 weeks of business days to find availability past OOO
          slotDuration: 30,
          maxSlots: 4,
          timezone: 'America/New_York', // TODO: Get from user settings
        });

        console.log('[Draft Reply] Calendar result:', { slotsCount: slots.length, error: calendarError });

        if (!calendarError && slots.length > 0) {
          availableTimesText = formatSlotsForPrompt(slots);
          console.log('[Draft Reply] Available times text:', availableTimesText);
        } else if (calendarError) {
          console.warn('[Draft Reply] Calendar error:', calendarError);
        } else {
          console.warn('[Draft Reply] No slots found');
        }
      } catch (calErr) {
        console.warn('[Draft Reply] Could not fetch calendar:', calErr);
      }
    }

    // Clear prompt cache to ensure we get the latest version
    clearPromptCache();

    // 5. Build temporal context
    const emailDate = comm.occurred_at ? new Date(comm.occurred_at as string) : null;
    const now = new Date();
    const daysSinceEmail = emailDate
      ? Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    let temporalContext = '';
    if (daysSinceEmail === 0) {
      temporalContext = 'This email was sent today.';
    } else if (daysSinceEmail === 1) {
      temporalContext = 'This email was sent yesterday.';
    } else if (daysSinceEmail <= 7) {
      temporalContext = `This email was sent ${daysSinceEmail} days ago.`;
    } else if (daysSinceEmail <= 14) {
      temporalContext = `This email was sent ${daysSinceEmail} days ago (about ${Math.round(daysSinceEmail / 7)} week${daysSinceEmail > 10 ? 's' : ''} ago). Acknowledge the delay appropriately.`;
    } else {
      temporalContext = `This email was sent ${daysSinceEmail} days ago (${Math.round(daysSinceEmail / 7)} weeks ago). This is a late response - acknowledge the delay and re-engage warmly.`;
    }

    // 6. Build stage-specific context
    const stageName = stage?.name || 'Unknown';
    const stageContextMap: Record<string, string> = {
      'New Lead': 'This is a new lead. Focus on understanding their needs and qualifying the opportunity.',
      'Qualifying': 'We are qualifying this prospect. Focus on understanding their pain points, timeline, and decision process.',
      'Discovery': 'We are in discovery. Focus on deeper understanding of their challenges and how we can help.',
      'Demo': 'We are scheduling or have scheduled a demo. They have NOT seen the product yet. Focus on confirming/scheduling the demo.',
      'Data Review': 'We are reviewing their data. Focus on insights from the data review and next steps.',
      'Trial': 'They have ACCESS to the platform and are actively testing it. Do NOT offer to "show" them features - they can already see it. Focus on: How is the trial going? What questions do they have? Any obstacles? What results are they seeing?',
      'Negotiation': 'We are in contract negotiation. Focus on addressing concerns and moving toward close.',
      'Closed Won': 'This deal is closed. Focus on onboarding and customer success.',
      'Closed Lost': 'This deal was lost. Be gracious and leave the door open for future opportunities.',
    };
    const stageContext = stageContextMap[stageName] || `Current stage: ${stageName}`;

    // 7. Build variables for the prompt
    const emailContent = comm.full_content || comm.content_preview || '';
    const dateFormatOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    };
    const emailDateFormatted = emailDate
      ? emailDate.toLocaleDateString('en-US', dateFormatOptions)
      : 'Unknown date';

    const variables = {
      company_name: company.name,
      contact_first_name: contactFirstName,
      contact_title: contactTitle,
      product_name: product?.name || 'X-RAI',
      stage_name: stageName,
      stage_context: stageContext,
      temporal_context: temporalContext,
      email_date: emailDateFormatted,
      current_date: now.toLocaleDateString('en-US', dateFormatOptions),
      reason: 'Awaiting our response to their inquiry',
      recommended_action: 'Respond to move the conversation forward',
      last_inbound_summary: emailContent.slice(0, 1500), // Their message
      last_outbound_summary: lastOutbound?.content_preview?.slice(0, 500) || 'No previous outbound message found',
      available_times: availableTimesText, // Real calendar availability
    };

    // 6. Generate reply using AI prompts system
    let draft: { subject: string; body: string } | null = null;

    console.log('[Draft Reply] Variables being passed:', {
      company_name: variables.company_name,
      contact_first_name: variables.contact_first_name,
      product_name: variables.product_name,
      available_times: variables.available_times,
    });

    try {
      draft = await generateEmailFromPromptKey(
        'email_followup_needs_reply',
        variables
      );
    } catch (err) {
      console.warn('[Draft Reply] Error generating draft, using fallback:', err);
      // Fallback draft if AI generation fails
      draft = {
        subject: `Re: ${comm.subject || 'Your message'}`,
        body: `Hi ${contactFirstName},\n\nThank you for your message. I wanted to follow up and address your inquiry.\n\n[Your response here]\n\nBest regards,\n[Your Name]`,
      };
    }

    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate draft reply' },
        { status: 500 }
      );
    }

    // 6. Return draft
    const response: DraftReplyResponse = {
      success: true,
      draft: {
        subject: draft.subject,
        body: draft.body,
        channel: 'email',
      },
      context: {
        company_name: company.name,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        original_subject: comm.subject as string | null,
        original_preview: (comm.content_preview as string)?.slice(0, 200) || null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Draft Reply] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
