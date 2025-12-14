import { createClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name, segment),
      owner:users(id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deals:', error);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your deals across stages
          </p>
        </div>
        <Link
          href="/deals/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </Link>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        <KanbanBoard initialDeals={deals || []} />
      </div>
    </div>
  );
}
