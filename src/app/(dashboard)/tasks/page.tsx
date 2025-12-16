import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Filter, Plus } from 'lucide-react';
import { TasksList } from '@/components/tasks/TasksList';

export default async function TasksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Get tasks assigned to current user
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      deal:deals(id, name),
      company:companies(id, name)
    `)
    .eq('assigned_to', profile.id)
    .order('due_at', { ascending: true });

  const openTasks = tasks?.filter((t) => !t.completed_at) || [];
  const completedTasks = tasks?.filter((t) => t.completed_at) || [];

  // Group open tasks
  const overdueTasks = openTasks.filter(
    (t) => new Date(t.due_at) < new Date()
  );
  const todayTasks = openTasks.filter((t) => {
    const dueDate = new Date(t.due_at);
    const today = new Date();
    return (
      dueDate >= today &&
      dueDate.toDateString() === today.toDateString()
    );
  });
  const upcomingTasks = openTasks.filter((t) => {
    const dueDate = new Date(t.due_at);
    const today = new Date();
    return dueDate > today && dueDate.toDateString() !== today.toDateString();
  });

  // Count fireflies review tasks
  const firefliesReviewCount = openTasks.filter(
    (t) => t.source === 'fireflies_ai' && t.type === 'review'
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Tasks</h1>
          <p className="text-xs text-gray-500 mt-1">
            {openTasks.length} open tasks
            {firefliesReviewCount > 0 && (
              <span className="ml-2 text-amber-600">
                ({firefliesReviewCount} transcript{firefliesReviewCount !== 1 ? 's' : ''} to review)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      <TasksList
        overdueTasks={overdueTasks}
        todayTasks={todayTasks}
        upcomingTasks={upcomingTasks}
        completedTasks={completedTasks}
      />
    </div>
  );
}
