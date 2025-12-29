'use client';

/**
 * ProcessPipeline Component
 *
 * Renders a kanban-style pipeline for lifecycle processes.
 * Uses data from company_product_read_model projection.
 */

import Link from 'next/link';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  sla_days?: number;
  is_terminal: boolean;
}

interface CompanyProductReadModel {
  company_product_id: string;
  company_id: string;
  product_id: string;
  current_stage_id: string | null;
  current_stage_name: string | null;
  stage_entered_at: string | null;
  days_in_current_stage: number | null;
  is_sla_warning: boolean;
  is_sla_breached: boolean;
  owner_id: string | null;
  owner_name: string | null;
  tier: number | null;
  company?: {
    id: string;
    name: string;
    domain: string | null;
  };
}

interface StageWithCompanies extends Stage {
  companies: CompanyProductReadModel[];
}

interface Props {
  processType: 'sales' | 'onboarding' | 'engagement';
  stages: StageWithCompanies[];
  productSlug: string;
}

export function ProcessPipeline({ processType, stages, productSlug }: Props) {
  const getProcessColor = () => {
    switch (processType) {
      case 'sales':
        return 'yellow';
      case 'onboarding':
        return 'blue';
      case 'engagement':
        return 'green';
      default:
        return 'gray';
    }
  };

  const color = getProcessColor();

  const getDaysColor = (days: number | null, slaDays?: number) => {
    if (days === null || !slaDays) return 'text-gray-500';
    if (days >= slaDays) return 'text-red-600';
    if (days >= slaDays * 0.7) return 'text-amber-600';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-4">
      {/* Process Type Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full bg-${color}-500`} />
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {processType} Pipeline
        </h3>
        <span className="text-xs text-gray-400">
          ({stages.reduce((sum, s) => sum + s.companies.length, 0)} total)
        </span>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-72 bg-gray-50 rounded-xl border border-gray-200"
          >
            {/* Stage Header */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  {stage.name}
                </h4>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700${color}-900/30${color}-400`}>
                  {stage.companies.length}
                </span>
              </div>
              {stage.sla_days && (
                <p className="text-xs text-gray-500 mt-1">
                  SLA: {stage.sla_days} days
                </p>
              )}
            </div>

            {/* Stage Cards */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
              {stage.companies.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No companies
                </div>
              ) : (
                stage.companies.map((cp) => (
                  <Link
                    key={cp.company_product_id}
                    href={`/companies/${cp.company_id}`}
                    className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {cp.company?.name || 'Unknown Company'}
                    </div>
                    {cp.company?.domain && (
                      <div className="text-xs text-gray-500 truncate">
                        {cp.company.domain}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs ${getDaysColor(cp.days_in_current_stage, stage.sla_days)}`}>
                        {cp.days_in_current_stage !== null
                          ? `${cp.days_in_current_stage}d in stage`
                          : 'Just entered'}
                      </span>
                      {cp.is_sla_breached && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                          SLA Breached
                        </span>
                      )}
                      {!cp.is_sla_breached && cp.is_sla_warning && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          At Risk
                        </span>
                      )}
                    </div>
                    {cp.owner_name && (
                      <div className="text-xs text-gray-400 mt-1">
                        Owner: {cp.owner_name}
                      </div>
                    )}
                    {cp.tier && (
                      <div className="mt-1">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          cp.tier === 1 ? 'bg-purple-100 text-purple-700' :
                          cp.tier === 2 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Tier {cp.tier}
                        </span>
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {stages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No {processType} process stages configured.</p>
          <p className="text-sm mt-1">Configure stages in product settings.</p>
        </div>
      )}
    </div>
  );
}
