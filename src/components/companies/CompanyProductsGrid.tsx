'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  MinusCircle,
  ChevronRight,
  Play
} from 'lucide-react';

interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
  tier: {
    name: string;
  } | null;
  current_stage: {
    name: string;
  } | null;
  mrr: string | null;
  seats: number | null;
  activated_at: string | null;
}

interface AvailableProduct {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

interface CompanyProductsGridProps {
  companyId: string;
  companyProducts: CompanyProduct[];
  availableProducts: AvailableProduct[];
}

const STATUS_CONFIG = {
  active: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Active' },
  in_sales: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'In Sales' },
  in_onboarding: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Onboarding' },
  declined: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Declined' },
  churned: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Churned' },
  inactive: { icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Not Started' },
};

export function CompanyProductsGrid({
  companyId,
  companyProducts,
  availableProducts
}: CompanyProductsGridProps) {
  // Get products the company doesn't have yet
  const activeProductIds = companyProducts.map(cp => cp.product.id);
  const missingProducts = availableProducts.filter(p => !activeProductIds.includes(p.id));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-medium text-gray-900">Products</h3>
      </div>

      <div className="divide-y divide-gray-200">
        {/* Active Products */}
        {companyProducts.map((cp) => {
          const config = STATUS_CONFIG[cp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.inactive;
          const StatusIcon = config.icon;

          return (
            <div key={cp.id} className={`p-4 ${config.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${cp.product.color}20` }}
                  >
                    {cp.product.icon || '📦'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{cp.product.name}</span>
                      {cp.tier && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          {cp.tier.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={config.color}>{config.label}</span>
                      {cp.current_stage && cp.status === 'in_sales' && (
                        <span className="text-gray-500">• {cp.current_stage.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {cp.mrr && cp.status === 'active' && (
                    <span className="text-sm font-medium text-gray-900">
                      ${parseFloat(cp.mrr).toLocaleString()}/mo
                    </span>
                  )}
                  <Link
                    href={`/products/${cp.product.slug}`}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {/* Products Not Yet Sold */}
        {missingProducts.map((product) => (
          <div key={product.id} className="p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg opacity-50"
                  style={{ backgroundColor: `${product.color}20` }}
                >
                  {product.icon || '📦'}
                </div>
                <div>
                  <span className="font-medium text-gray-400">{product.name}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <MinusCircle className="w-4 h-4 text-gray-300" />
                    <span className="text-gray-400">Not Started</span>
                  </div>
                </div>
              </div>

              <StartSaleButton companyId={companyId} productId={product.id} productName={product.name} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StartSaleButton({
  companyId,
  productId,
  productName
}: {
  companyId: string;
  productId: string;
  productName: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStartSale = async () => {
    if (!confirm(`Start selling ${productName} to this company?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/companies/${companyId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          status: 'in_sales'
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to start sale');
      }
    } catch (error) {
      alert('Failed to start sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStartSale}
      disabled={loading}
      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? 'Starting...' : 'Start Sale'}
    </button>
  );
}
