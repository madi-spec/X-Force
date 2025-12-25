'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';

interface Opportunity {
  company_id: string;
  company_name: string;
  current_products: string[];
  missing_products: {
    product_name: string;
    product_slug: string;
    estimated_mrr: number;
    fit_score: number;
    fit_reasons: string[];
  }[];
  total_potential_mrr: number;
  priority_score: number;
}

interface WhitespaceOpportunityListProps {
  opportunities: Opportunity[];
}

export function WhitespaceOpportunityList({ opportunities }: WhitespaceOpportunityListProps) {
  if (opportunities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        No expansion opportunities found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Current Products</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunities</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Potential MRR</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fit</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {opportunities.map((opp) => (
            <tr key={opp.company_id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${opp.company_id}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {opp.company_name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {opp.current_products.slice(0, 3).map((product, i) => (
                    <span
                      key={i}
                      className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
                    >
                      {product}
                    </span>
                  ))}
                  {opp.current_products.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{opp.current_products.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {opp.missing_products.slice(0, 2).map((product, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1"
                      title={product.fit_reasons.join(', ')}
                    >
                      <Sparkles className="w-3 h-3" />
                      {product.product_name}
                    </span>
                  ))}
                  {opp.missing_products.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{opp.missing_products.length - 2} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium text-green-600">
                  ${opp.total_potential_mrr.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <FitScoreBadge score={opp.priority_score} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${opp.company_id}`}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FitScoreBadge({ score }: { score: number }) {
  let bgColor = 'bg-gray-100 text-gray-600';
  if (score >= 80) bgColor = 'bg-green-100 text-green-700';
  else if (score >= 60) bgColor = 'bg-yellow-100 text-yellow-700';
  else if (score >= 40) bgColor = 'bg-orange-100 text-orange-700';

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${bgColor}`}>
      {score}%
    </span>
  );
}
