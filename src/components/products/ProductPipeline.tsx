'use client';

import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  User,
  MoreHorizontal,
  Play,
  Pause
} from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  companies: CompanyProduct[];
}

interface CompanyProduct {
  id: string;
  status?: string;
  stage_entered_at: string | null;
  ai_sequence_active?: boolean;
  mrr?: number | null;
  company: {
    id: string;
    name: string;
    domain: string | null;
    city?: string | null;
    state?: string | null;
  };
  owner?: {
    id: string;
    name: string;
  } | null;
}

interface ProductPipelineProps {
  product: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  stages: Stage[];
}

export function ProductPipeline({ product, stages }: ProductPipelineProps) {
  // Migration product uses orange theme
  const isMigrationProduct = product.slug === 'xrai-migration';

  if (stages.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No sales stages defined for this product.</p>
        <Link
          href={`/products/${product.slug}/process`}
          className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
        >
          Set up proven process →
        </Link>
      </div>
    );
  }

  const totalInPipeline = stages.reduce((sum, s) => sum + s.companies.length, 0);

  if (totalInPipeline === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500 mb-4">No companies in the pipeline yet.</p>
        <Link
          href="/companies"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Find Companies to Sell To
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex-shrink-0 w-80">
          {/* Stage Header */}
          <div className={`rounded-t-xl px-4 py-3 border-b ${
            isMigrationProduct
              ? 'bg-orange-100 border-orange-200'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  isMigrationProduct ? 'text-orange-900' : 'text-gray-900'
                }`}>
                  {stage.name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isMigrationProduct
                    ? 'bg-orange-200 text-orange-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {stage.companies.length}
                </span>
              </div>
              {index < stages.length - 1 && (
                <ChevronRight className={`w-4 h-4 ${
                  isMigrationProduct ? 'text-orange-400' : 'text-gray-400'
                }`} />
              )}
            </div>
            {stage.goal && (
              <p className={`text-xs mt-1 ${
                isMigrationProduct ? 'text-orange-600' : 'text-gray-500'
              }`}>{stage.goal}</p>
            )}
          </div>

          {/* Stage Cards */}
          <div className={`rounded-b-xl p-2 min-h-[400px] space-y-2 ${
            isMigrationProduct ? 'bg-orange-50' : 'bg-gray-50'
          }`}>
            {stage.companies.map((cp) => (
              <PipelineCard
                key={cp.id}
                companyProduct={cp}
                productSlug={product.slug}
                productColor={product.color}
                isMigration={isMigrationProduct}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineCard({
  companyProduct: cp,
  productSlug,
  productColor,
  isMigration = false
}: {
  companyProduct: CompanyProduct;
  productSlug: string;
  productColor: string | null;
  isMigration?: boolean;
}) {
  const daysInStage = cp.stage_entered_at
    ? Math.floor((Date.now() - new Date(cp.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className={`bg-white rounded-lg border p-3 hover:shadow-md transition-shadow ${
      isMigration ? 'border-orange-200' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <Link
          href={`/companies/${cp.company.id}`}
          className="font-medium text-gray-900 hover:text-blue-600"
        >
          {cp.company.name}
        </Link>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {cp.company.city && cp.company.state && (
        <p className="text-xs text-gray-500 mb-2">
          {cp.company.city}, {cp.company.state}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-gray-500">
            <Clock className="w-3 h-3" />
            {daysInStage}d
          </span>
          {cp.owner && (
            <span className="flex items-center gap-1 text-gray-500">
              <User className="w-3 h-3" />
              {cp.owner.name.split(' ')[0]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isMigration && cp.mrr ? (
            <span className="text-gray-600 font-medium">
              ${parseFloat(String(cp.mrr)).toLocaleString()}/mo
            </span>
          ) : cp.ai_sequence_active ? (
            <span className="flex items-center gap-1 text-green-600">
              <Play className="w-3 h-3" />
              AI Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-400">
              <Pause className="w-3 h-3" />
              Manual
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
