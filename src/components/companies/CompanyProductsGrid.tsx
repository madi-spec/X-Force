'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  MinusCircle,
  ChevronRight,
  Play,
  Pencil,
  X
} from 'lucide-react';

interface ProductTier {
  id: string;
  name: string;
}

interface ProductStage {
  id: string;
  name: string;
  stage_order: number;
}

interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
    tiers?: ProductTier[];
    stages?: ProductStage[];
  };
  tier: {
    id: string;
    name: string;
  } | null;
  current_stage: {
    id: string;
    name: string;
  } | null;
  mrr: string | null;
  seats: number | null;
  notes: string | null;
  activated_at: string | null;
}

interface AvailableProduct {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  tiers?: ProductTier[];
  stages?: ProductStage[];
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
  const [editingProduct, setEditingProduct] = useState<CompanyProduct | null>(null);

  // Get products the company doesn't have yet
  const activeProductIds = companyProducts.map(cp => cp.product.id);
  const missingProducts = availableProducts.filter(p => !activeProductIds.includes(p.id));

  // Find the available product info (with tiers/stages) for the editing product
  const getProductInfo = (productId: string) => {
    return availableProducts.find(p => p.id === productId);
  };

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

                <div className="flex items-center gap-3">
                  {cp.mrr && cp.status === 'active' && (
                    <span className="text-sm font-medium text-gray-900">
                      ${parseFloat(cp.mrr).toLocaleString()}/mo
                    </span>
                  )}
                  <button
                    onClick={() => setEditingProduct(cp)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
                    title="Edit product"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
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

      {/* Edit Modal */}
      {editingProduct && (
        <EditCompanyProductModal
          companyId={companyId}
          companyProduct={editingProduct}
          productInfo={getProductInfo(editingProduct.product.id)}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            window.location.reload();
          }}
        />
      )}
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

// Edit Company Product Modal
function EditCompanyProductModal({
  companyId,
  companyProduct,
  productInfo,
  onClose,
  onSaved,
}: {
  companyId: string;
  companyProduct: CompanyProduct;
  productInfo?: AvailableProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: companyProduct.status,
    tier_id: companyProduct.tier?.id || '',
    current_stage_id: companyProduct.current_stage?.id || '',
    mrr: companyProduct.mrr || '',
    seats: companyProduct.seats?.toString() || '',
    notes: companyProduct.notes || '',
  });

  const statusOptions = [
    { value: 'inactive', label: 'Inactive' },
    { value: 'in_sales', label: 'In Sales' },
    { value: 'in_onboarding', label: 'Onboarding' },
    { value: 'active', label: 'Active' },
    { value: 'declined', label: 'Declined' },
    { value: 'churned', label: 'Churned' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/companies/${companyId}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_product_id: companyProduct.id,
          status: formData.status,
          tier_id: formData.tier_id || null,
          current_stage_id: formData.current_stage_id || null,
          mrr: formData.mrr || null,
          seats: formData.seats ? parseInt(formData.seats) : null,
          notes: formData.notes || null,
        }),
      });

      if (response.ok) {
        onSaved();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update');
      }
    } catch (error) {
      alert('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const tiers = productInfo?.tiers || [];
  const stages = (productInfo?.stages || []).sort((a, b) => a.stage_order - b.stage_order);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium text-gray-900">
            Edit {companyProduct.product.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier (if available) */}
          {tiers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tier
              </label>
              <select
                value={formData.tier_id}
                onChange={(e) => setFormData({ ...formData, tier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No tier selected</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stage (if in_sales) */}
          {formData.status === 'in_sales' && stages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pipeline Stage
              </label>
              <select
                value={formData.current_stage_id}
                onChange={(e) => setFormData({ ...formData, current_stage_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MRR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MRR ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.mrr}
              onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Seats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seats
            </label>
            <input
              type="number"
              value={formData.seats}
              onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
