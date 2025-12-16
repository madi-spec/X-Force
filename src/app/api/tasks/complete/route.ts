import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/tasks/complete
 * 
 * Complete a task and optionally log an activity
 * 
 * Body:
 * {
 *   taskId: string,
 *   action?: {
 *     type: 'email_sent' | 'call_made' | 'meeting_held' | 'note',
 *     subject?: string,
 *     body?: string,
 *     metadata?: Record<string, unknown>
 *   },
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await authSupabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { taskId, action, notes } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the task with related data
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        type,
        deal_id,
        company_id,
        completed_at,
        deal:deals(id, name, company_id),
        company:companies(id, name)
      `)
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.completed_at) {
      return NextResponse.json({ error: 'Task already completed' }, { status: 400 });
    }

    // Mark task as complete
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      console.error('Error completing task:', updateError);
      return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
    }

    // Determine company_id (from task directly or via deal)
    const companyId = task.company_id || (task.deal as { company_id?: string })?.company_id;
    const dealId = task.deal_id;

    // Log activity if action provided or if task has a company/deal
    if ((action || companyId) && (action?.type || task.type)) {
      // Map task type to activity type if no action specified
      const activityType = action?.type || mapTaskTypeToActivityType(task.type);
      
      const activityData = {
        user_id: profile.id,
        company_id: companyId,
        deal_id: dealId,
        type: activityType,
        subject: action?.subject || `Completed: ${task.title}`,
        body: action?.body || notes || task.description || null,
        occurred_at: new Date().toISOString(),
        metadata: {
          source: 'task_completion',
          task_id: taskId,
          task_type: task.type,
          ...(action?.metadata || {}),
        },
      };

      const { error: activityError } = await supabase
        .from('activities')
        .insert(activityData);

      if (activityError) {
        console.error('Error creating activity:', activityError);
        // Don't fail the whole request, task is already completed
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Task completed',
      task: {
        id: taskId,
        completed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in task completion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function mapTaskTypeToActivityType(taskType: string): string {
  const mapping: Record<string, string> = {
    email: 'email_sent',
    call: 'call_made',
    meeting: 'meeting_held',
    follow_up: 'note',
    review: 'note',
    custom: 'note',
  };
  return mapping[taskType] || 'note';
}
