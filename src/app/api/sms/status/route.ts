/**
 * Twilio SMS Status Webhook
 *
 * Receives delivery status updates from Twilio.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string | null;

    // Get scheduling request ID from query params
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    console.log('[SMS Status] Update:', { messageSid, messageStatus, requestId, errorCode });

    if (requestId && messageStatus) {
      const supabase = createAdminClient();

      // Log status update if failed
      if (['failed', 'undelivered'].includes(messageStatus)) {
        await supabase
          .from('scheduling_actions')
          .insert({
            scheduling_request_id: requestId,
            action_type: 'sms_delivery_failed',
            message_content: `SMS delivery failed: ${messageStatus}${errorCode ? ` (${errorCode})` : ''}`,
            actor: 'ai',
            ai_reasoning: `Twilio status: ${messageStatus}`,
          });

        // May need to fall back to email
        await supabase
          .from('scheduling_requests')
          .update({
            next_action_type: 'sms_delivery_failed',
            next_action_at: new Date().toISOString(),
          })
          .eq('id', requestId);
      }
    }

    return new NextResponse('OK', { status: 200 });

  } catch (err) {
    console.error('[SMS Status] Error:', err);
    return new NextResponse('Error', { status: 500 });
  }
}
