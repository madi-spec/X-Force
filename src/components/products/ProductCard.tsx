'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ProductCardData } from '@/types/products';

interface ProductCardProps {
  product: ProductCardData;
}

export function ProductCard({ product }: ProductCardProps) {
  const sortedStages = [...(product.stages || [])].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${product.color}20`, color: product.color || '#3B82F6' }}
            >
              {product.icon || '📦'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                {!product.is_sellable && (
                  <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                    Legacy
                  </span>
                )}
              </div>
              {product.description && (
                <p className="text-sm text-gray-500">{product.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/products/${product.slug}/process`}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Proven Process
            </Link>
            <Link
              href={`/products/${product.slug}`}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1"
              style={{ backgroundColor: product.color || '#3B82F6' }}
            >
              View Pipeline
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Row - Clickable */}
      <div className="p-4 border-b bg-gray-50">
        <div className="grid grid-cols-5 gap-4">
          <Link
            href={`/products/${product.slug}?view=active`}
            className="text-center p-2 -m-2 rounded-lg hover:bg-green-50 transition-colors cursor-pointer group"
          >
            <div className="text-2xl font-bold text-green-600 group-hover:text-green-700">{product.stats.active}</div>
            <div className="text-xs text-gray-500 group-hover:text-green-600">Active</div>
          </Link>
          <Link
            href={`/products/${product.slug}?view=in_sales`}
            className="text-center p-2 -m-2 rounded-lg hover:bg-yellow-50 transition-colors cursor-pointer group"
          >
            <div className="text-2xl font-bold text-yellow-600 group-hover:text-yellow-700">{product.stats.in_sales}</div>
            <div className="text-xs text-gray-500 group-hover:text-yellow-600">In Sales</div>
          </Link>
          <Link
            href={`/products/${product.slug}?view=in_onboarding`}
            className="text-center p-2 -m-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer group"
          >
            <div className="text-2xl font-bold text-blue-600 group-hover:text-blue-700">{product.stats.in_onboarding}</div>
            <div className="text-xs text-gray-500 group-hover:text-blue-600">Onboarding</div>
          </Link>
          <Link
            href={`/products/${product.slug}?view=inactive`}
            className="text-center p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
          >
            <div className="text-2xl font-bold text-gray-400 group-hover:text-gray-600">{product.stats.inactive}</div>
            <div className="text-xs text-gray-500 group-hover:text-gray-600">Inactive</div>
          </Link>
          <div className="text-center p-2 -m-2">
            <div className="text-2xl font-bold text-green-600">
              ${product.stats.total_mrr.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">MRR</div>
          </div>
        </div>
      </div>

      {/* Pipeline Mini-View */}
      {sortedStages.length > 0 && (
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">Sales Pipeline</div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {sortedStages.map((stage, index) => {
              const count = product.pipelineByStage[stage.id] || 0;
              return (
                <div key={stage.id} className="flex items-center flex-shrink-0">
                  <div className="text-center">
                    <div
                      className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap ${
                        count > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {stage.name} ({count})
                    </div>
                  </div>
                  {index < sortedStages.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
