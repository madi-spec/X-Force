import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks
 *
 * Fetch tasks for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    // Get tasks assigned to current user
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        deal:deals(id, name),
        company:companies(id, name)
      `)
      .eq('assigned_to', profile.id)
      .order('due_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks || [] });
  } catch (error) {
    console.error('Error in tasks API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 *
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const body = await request.json();
    const { title, description, type, priority, due_at, deal_id, company_product_id, company_id } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const taskData = {
      title,
      description: description || null,
      type: type || 'custom',
      priority: priority || 'medium',
      due_at: due_at || new Date().toISOString(),
      deal_id: deal_id || null,
      company_product_id: company_product_id || null,
      company_id: company_id || null,
      assigned_to: profile.id,
      created_by: profile.id,
      source: 'manual',
    };

    const { data: task, error } = await adminSupabase
      .from('tasks')
      .insert(taskData)
      .select(`
        *,
        deal:deals(id, name),
        company:companies(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error in task creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
