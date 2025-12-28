/**
 * Twilio SMS Webhook
 *
 * Receives incoming SMS messages from Twilio and processes
 * them for scheduling responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseSmsIntent, formatPhoneNumber } from '@/lib/sms';
import { processSchedulingResponse } from '@/lib/scheduler';
import { adminSchedulingService } from '@/lib/scheduler/schedulingService';
import { ACTION_TYPES, COMMUNICATION_CHANNELS } from '@/lib/scheduler/types';

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();

    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log('[SMS Webhook] Received:', { from, to, body: body?.slice(0, 50) });

    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Find matching scheduling request by phone number
    const supabase = createAdminClient();

    // Normalize phone number
    const normalizedFrom = formatPhoneNumber(from);

    // Look up contact by phone
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .or(`phone.eq.${normalizedFrom},mobile.eq.${normalizedFrom}`);

    if (!contacts || contacts.length === 0) {
      console.log('[SMS Webhook] No matching contact for:', normalizedFrom);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const contactIds = contacts.map(c => c.id);

    // Find active scheduling request for this contact
    const { data: attendees } = await supabase
      .from('scheduling_attendees')
      .select(`
        scheduling_request_id,
        scheduling_request:scheduling_requests(
          *,
          attendees:scheduling_attendees(*)
        )
      `)
      .in('contact_id', contactIds)
      .eq('is_primary_contact', true);

    // Find active request
    let activeRequest = null;
    for (const att of attendees || []) {
      const req = att.scheduling_request as unknown as { status: string; current_channel: string };
      if (req && !['completed', 'cancelled'].includes(req.status)) {
        activeRequest = att.scheduling_request;
        break;
      }
    }

    if (!activeRequest) {
      console.log('[SMS Webhook] No active scheduling request for contact');
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Parse the SMS intent
    const intent = parseSmsIntent(body);
    console.log('[SMS Webhook] Parsed intent:', intent);

    // Log the incoming SMS
    await adminSchedulingService.logAction((activeRequest as unknown as { id: string }).id, {
      action_type: ACTION_TYPES.SMS_RECEIVED,
      message_content: body,
      actor: 'prospect',
      ai_reasoning: `SMS intent: ${intent.intent}${intent.extractedTime ? `, time: ${intent.extractedTime}` : ''}`,
    });

    // Add to conversation history
    const typedRequest = activeRequest as unknown as {
      id: string;
      conversation_history: unknown[];
    };

    const message = {
      id: messageSid,
      timestamp: new Date().toISOString(),
      direction: 'inbound' as const,
      channel: COMMUNICATION_CHANNELS.SMS,
      subject: '',
      body,
      sender: from,
      recipient: to,
    };

    await supabase
      .from('scheduling_requests')
      .update({
        conversation_history: [
          ...(typedRequest.conversation_history || []),
          message,
        ],
        last_action_at: new Date().toISOString(),
      })
      .eq('id', typedRequest.id);

    // Process based on intent
    // For now, we'll flag for human review since SMS responses are often brief
    let nextActionType = 'review_sms_response';

    switch (intent.intent) {
      case 'accept':
        nextActionType = 'confirm_sms_acceptance';
        break;
      case 'decline':
        nextActionType = 'review_sms_decline';
        break;
      case 'call_request':
        nextActionType = 'schedule_call';
        break;
      case 'time_suggestion':
        nextActionType = 'review_sms_time_suggestion';
        break;
      case 'question':
        nextActionType = 'answer_sms_question';
        break;
    }

    await supabase
      .from('scheduling_requests')
      .update({
        next_action_type: nextActionType,
        next_action_at: new Date().toISOString(),
      })
      .eq('id', typedRequest.id);

    // Return empty TwiML response (no auto-reply for now)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (err) {
    console.error('[SMS Webhook] Error:', err);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// Twilio sends GET for verification
export async function GET() {
  return NextResponse.json({ status: 'SMS webhook active' });
}
