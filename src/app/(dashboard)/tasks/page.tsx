import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Plus,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-gray-600 bg-gray-50',
};

const typeIcons: Record<string, string> = {
  follow_up: 'Follow Up',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  review: 'Review',
  custom: 'Task',
};

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

  const TaskItem = ({ task }: { task: any }) => (
    <div className="flex items-start gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <button className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors">
        <Circle className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900">{task.title}</p>
            {task.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              {task.deal && (
                <Link
                  href={`/deals/${task.deal.id}`}
                  className="hover:text-blue-600"
                >
                  {task.deal.name}
                </Link>
              )}
              {task.company && !task.deal && (
                <Link
                  href={`/companies/${task.company.id}`}
                  className="hover:text-blue-600"
                >
                  {task.company.name}
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                priorityColors[task.priority]
              )}
            >
              {task.priority}
            </span>
            <span className="text-xs text-gray-500">
              {typeIcons[task.type] || task.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(task.due_at)}</span>
          {task.source === 'ai_recommendation' && (
            <span className="ml-2 text-blue-500">AI suggested</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 text-sm mt-1">
            {openTasks.length} open tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <h2 className="font-medium text-red-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Overdue ({overdueTasks.length})
              </h2>
            </div>
            <div>
              {overdueTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Today */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today ({todayTasks.length})
            </h2>
          </div>
          <div>
            {todayTasks.length > 0 ? (
              todayTasks.map((task) => <TaskItem key={task.id} task={task} />)
            ) : (
              <p className="px-4 py-8 text-center text-gray-500 text-sm">
                No tasks due today
              </p>
            )}
          </div>
        </div>

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-medium text-gray-700">
                Upcoming ({upcomingTasks.length})
              </h2>
            </div>
            <div>
              {upcomingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-medium text-gray-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Completed ({completedTasks.length})
              </h2>
            </div>
            <div>
              {completedTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0 opacity-60"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <p className="text-gray-500 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
