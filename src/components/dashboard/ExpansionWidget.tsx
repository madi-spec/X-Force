'use client';

import Link from 'next/link';
import { TrendingUp, ChevronRight, Sparkles } from 'lucide-react';

interface ExpansionWidgetProps {
  stats: {
    adoption_rate: number;
    customers_without_ai_products: number;
    total_whitespace_mrr: number;
  };
  topOpportunities: {
    company_id: string;
    company_name: string;
    total_potential_mrr: number;
    priority_score: number;
  }[];
}

export function ExpansionWidget({ stats, topOpportunities }: ExpansionWidgetProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h3 className="font-medium text-gray-900">Expansion Opportunities</h3>
        </div>
        <Link
          href="/analytics/whitespace"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.adoption_rate}%</div>
            <div className="text-xs text-gray-500">AI Adoption</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.customers_without_ai_products}
            </div>
            <div className="text-xs text-gray-500">Untapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${(stats.total_whitespace_mrr / 1000).toFixed(0)}k
            </div>
            <div className="text-xs text-gray-500">Potential MRR</div>
          </div>
        </div>

        {/* Top Opportunities */}
        <div className="space-y-2">
          {topOpportunities.slice(0, 5).map((opp) => (
            <Link
              key={opp.company_id}
              href={`/companies/${opp.company_id}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">
                  {opp.company_name}
                </span>
              </div>
              <span className="text-sm text-green-600 font-medium">
                +${opp.total_potential_mrr}/mo
              </span>
            </Link>
          ))}
          {topOpportunities.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No opportunities found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
