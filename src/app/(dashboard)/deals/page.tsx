import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, Building2 } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { getHealthScoreColor, PIPELINE_STAGES } from '@/types';

export default async function DealsPage() {
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name),
      owner:users(id, name)
    `)
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-gray-500 text-sm mt-1">
            {deals?.length || 0} deals in your pipeline
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Health
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expected Close
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deals?.map((deal) => {
              const stage = PIPELINE_STAGES.find((s) => s.id === deal.stage);
              return (
                <tr key={deal.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/deals/${deal.id}`} className="block">
                      <p className="font-medium text-gray-900 hover:text-blue-600">
                        {deal.name}
                      </p>
                      {deal.company && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {deal.company.name}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white',
                        stage?.color || 'bg-gray-500'
                      )}
                    >
                      {stage?.name || deal.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatCurrency(deal.estimated_value)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'font-medium',
                        getHealthScoreColor(deal.health_score)
                      )}
                    >
                      {deal.health_score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {deal.owner?.name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {deal.expected_close_date
                      ? formatDate(deal.expected_close_date)
                      : '-'}
                  </td>
                </tr>
              );
            })}
            {(!deals || deals.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No deals yet. Create your first deal to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
