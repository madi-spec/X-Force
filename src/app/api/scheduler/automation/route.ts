/**
 * Scheduling Automation API
 *
 * POST /api/scheduler/automation
 * Triggers the automation processor to handle:
 * - Follow-up emails
 * - Reminders
 * - No-show recovery
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processSchedulingAutomation, processSchedulingEmails } from '@/lib/scheduler';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Process any new email responses first
    const emailResults = await processSchedulingEmails(user.id);

    // Then process scheduled automation actions
    const automationResults = await processSchedulingAutomation(user.id);

    return NextResponse.json({
      success: true,
      data: {
        emails: {
          processed: emailResults.processed,
          matched: emailResults.matched,
          errors: emailResults.errors.length,
        },
        automation: {
          processed: automationResults.processed,
          followUpsSent: automationResults.followUpsSent,
          remindersSent: automationResults.remindersSent,
          proposalsSent: automationResults.proposalsSent,
          noShowsHandled: automationResults.noShowsHandled,
          errors: automationResults.errors.length,
        },
      },
    });

  } catch (error) {
    console.error('[SchedulerAutomation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process automation', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to trigger scheduling automation',
    endpoints: {
      'POST /api/scheduler/automation': 'Run automation processor',
    },
  });
}
