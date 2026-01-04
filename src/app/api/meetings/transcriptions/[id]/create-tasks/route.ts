import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MeetingAnalysis, MeetingActionItem } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Create tasks from action items
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actionItemIndexes } = body as { actionItemIndexes: number[] };

    if (!actionItemIndexes || !Array.isArray(actionItemIndexes)) {
      return NextResponse.json(
        { error: 'actionItemIndexes array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Fetch the transcription with analysis
    const { data: transcription, error: fetchError } = await supabase
      .from('meeting_transcriptions')
      .select('id, deal_id, company_product_id, company_id, analysis, title')
      .eq('id', id)
      .single();

    if (fetchError || !transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    const analysis = transcription.analysis as MeetingAnalysis | null;
    if (!analysis || !analysis.actionItems) {
      return NextResponse.json(
        { error: 'No action items found in analysis' },
        { status: 400 }
      );
    }

    // Filter to only "us" action items (tasks we need to do)
    const ourActionItems = analysis.actionItems.filter(
      (item: MeetingActionItem) => item.owner === 'us'
    );

    // Get selected action items
    const selectedItems = actionItemIndexes
      .filter((index: number) => index >= 0 && index < ourActionItems.length)
      .map((index: number) => ourActionItems[index]);

    if (selectedItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid action items selected' },
        { status: 400 }
      );
    }

    // Create tasks for each selected action item
    const tasksToCreate = selectedItems.map((item: MeetingActionItem) => ({
      deal_id: transcription.deal_id,
      company_product_id: transcription.company_product_id,
      company_id: transcription.company_id,
      assigned_to: profile.id,
      created_by: profile.id,
      type: inferTaskType(item.task),
      title: item.task,
      description: `From meeting: ${transcription.title}`,
      priority: item.priority,
      due_at: item.dueDate || getDefaultDueDate(item.priority),
      source: 'meeting_extraction' as const,
    }));

    const { data: createdTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToCreate)
      .select('id');

    if (insertError) {
      console.error('Error creating tasks:', insertError);
      return NextResponse.json(
        { error: 'Failed to create tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tasksCreated: createdTasks.length,
      taskIds: createdTasks.map((t) => t.id),
    });
  } catch (error) {
    console.error('Error creating tasks:', error);
    return NextResponse.json(
      { error: 'Failed to create tasks' },
      { status: 500 }
    );
  }
}

function inferTaskType(taskDescription: string): string {
  const lowerTask = taskDescription.toLowerCase();

  if (lowerTask.includes('email') || lowerTask.includes('send')) {
    return 'email';
  }
  if (lowerTask.includes('call') || lowerTask.includes('phone')) {
    return 'call';
  }
  if (lowerTask.includes('meeting') || lowerTask.includes('schedule') || lowerTask.includes('demo')) {
    return 'meeting';
  }
  if (lowerTask.includes('review') || lowerTask.includes('check') || lowerTask.includes('prepare')) {
    return 'review';
  }

  return 'follow_up';
}

function getDefaultDueDate(priority: string): string {
  const now = new Date();

  switch (priority) {
    case 'high':
      // Due in 1 day
      now.setDate(now.getDate() + 1);
      break;
    case 'medium':
      // Due in 3 days
      now.setDate(now.getDate() + 3);
      break;
    case 'low':
      // Due in 7 days
      now.setDate(now.getDate() + 7);
      break;
    default:
      now.setDate(now.getDate() + 3);
  }

  return now.toISOString();
}
