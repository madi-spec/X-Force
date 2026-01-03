'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Building2, AlertTriangle, AlertCircle, HeartPulse, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyProductReadModel {
  company_product_id: string;
  company_id: string;
  product_id: string;
  current_process_type: string | null;
  current_process_id: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_slug: string | null;
  health_score: number | null;
  risk_level: 'none' | 'low' | 'medium' | 'high' | null;
  tier: number | null;
  mrr: number | null;
  is_sla_breached: boolean;
  is_sla_warning: boolean;
  days_in_current_stage: number | null;
  owner_name: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface ProcessStage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  is_terminal: boolean;
}

interface OpenCaseCounts {
  company_product_id: string;
  total_open_count: number;
  urgent_count: number;
  critical_count: number;
  any_breached_count: number;
}

interface EngagementBoardProps {
  companyProducts: (CompanyProductReadModel & { company?: Company | null })[];
  stages: ProcessStage[];
  caseCounts: OpenCaseCounts[];
  productName?: string;
}

const riskColors: Record<string, { bg: string; text: string; border: string }> = {
  none: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function HealthBadge({ score, riskLevel }: { score: number | null; riskLevel: string | null }) {
  const risk = riskColors[riskLevel || 'none'] || riskColors.none;

  return (
    <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', risk.bg, risk.text)}>
      <HeartPulse className="h-3 w-3" />
      {score !== null ? score : '-'}
    </div>
  );
}

function EngagementCard({
  product,
  caseCounts,
}: {
  product: CompanyProductReadModel & { company?: Company | null };
  caseCounts?: OpenCaseCounts;
}) {
  const hasUrgent = (caseCounts?.urgent_count || 0) + (caseCounts?.critical_count || 0) > 0;
  const hasBreached = (caseCounts?.any_breached_count || 0) > 0;
  const risk = riskColors[product.risk_level || 'none'] || riskColors.none;

  return (
    <Link
      href={`/companies/${product.company_id}`}
      className={cn(
        'block bg-white rounded-xl border p-4 hover:shadow-md transition-all',
        product.is_sla_breached || hasBreached ? 'border-red-300' : risk.border
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="font-medium text-gray-900 truncate">
            {product.company?.name || 'Unknown Company'}
          </span>
        </div>
        <HealthBadge score={product.health_score} riskLevel={product.risk_level} />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        {product.tier && (
          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
            Tier {product.tier}
          </span>
        )}
        {product.days_in_current_stage !== null && (
          <span>{product.days_in_current_stage}d in stage</span>
        )}
        {product.owner_name && (
          <span className="truncate">{product.owner_name}</span>
        )}
      </div>

      {/* Case Indicators */}
      {(caseCounts?.total_open_count || 0) > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs">
            <Ticket className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-600">{caseCounts?.total_open_count} open</span>
          </div>
          {hasUrgent && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{(caseCounts?.urgent_count || 0) + (caseCounts?.critical_count || 0)} urgent</span>
            </div>
          )}
          {hasBreached && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>SLA</span>
            </div>
          )}
        </div>
      )}

      {/* SLA Warning */}
      {product.is_sla_warning && !product.is_sla_breached && (
        <div className="flex items-center gap-1 text-xs text-yellow-600 mt-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>SLA warning</span>
        </div>
      )}
      {product.is_sla_breached && (
        <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>SLA breached</span>
        </div>
      )}
    </Link>
  );
}

export function EngagementBoard({ companyProducts, stages, caseCounts, productName }: EngagementBoardProps) {
  // Group products by stage
  const productsByStage = useMemo(() => {
    const groups: Record<string, (CompanyProductReadModel & { company?: Company | null })[]> = {};

    // Initialize empty arrays for each stage
    stages.forEach((stage) => {
      groups[stage.id] = [];
    });

    // Add products to their respective stages
    companyProducts.forEach((product) => {
      if (product.current_stage_id && groups[product.current_stage_id]) {
        groups[product.current_stage_id].push(product);
      }
    });

    return groups;
  }, [companyProducts, stages]);

  // Create a lookup for case counts
  const caseCountsMap = useMemo(() => {
    const map: Record<string, OpenCaseCounts> = {};
    caseCounts.forEach((cc) => {
      map[cc.company_product_id] = cc;
    });
    return map;
  }, [caseCounts]);

  // Sort stages by order
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.stage_order - b.stage_order);
  }, [stages]);

  // Calculate stats per stage
  const stageStats = useMemo(() => {
    const stats: Record<string, { count: number; atRisk: number; breached: number }> = {};
    sortedStages.forEach((stage) => {
      const products = productsByStage[stage.id] || [];
      stats[stage.id] = {
        count: products.length,
        atRisk: products.filter((p) => p.risk_level === 'high' || p.risk_level === 'medium').length,
        breached: products.filter((p) => p.is_sla_breached).length,
      };
    });
    return stats;
  }, [sortedStages, productsByStage]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">
            {productName ? `${productName} Engagement` : 'Customer Engagement'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {companyProducts.length} customers across {stages.length} stages
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {sortedStages.map((stage) => {
            const products = productsByStage[stage.id] || [];
            const stats = stageStats[stage.id];

            return (
              <div key={stage.id} className="flex flex-col w-80 shrink-0">
                {/* Column Header */}
                <div className="flex items-center justify-between px-3 py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      stage.is_terminal ? 'bg-green-500' : 'bg-blue-500'
                    )} />
                    <h3 className="font-medium text-gray-900 text-sm">{stage.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {stats.count}
                    </span>
                  </div>
                  {(stats.atRisk > 0 || stats.breached > 0) && (
                    <div className="flex items-center gap-1">
                      {stats.atRisk > 0 && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                          {stats.atRisk} at risk
                        </span>
                      )}
                      {stats.breached > 0 && (
                        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {stats.breached} SLA
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Column Content */}
                <div className="flex-1 rounded-xl bg-gray-50/50 p-2 min-h-[200px] space-y-3">
                  {products.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400">
                      No customers in this stage
                    </div>
                  ) : (
                    products.map((product) => (
                      <EngagementCard
                        key={product.company_product_id}
                        product={product}
                        caseCounts={caseCountsMap[product.company_product_id]}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
