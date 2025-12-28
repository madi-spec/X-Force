'use client';

import { useState, useEffect } from 'react';
import { X, Package, Loader2, Plus, Pencil, CheckCircle, Clock, XCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  is_sellable: boolean;
}

interface CompanyProduct {
  id: string;
  status: string;
  product_id: string;
  mrr: string | null;
  product: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  tier: {
    id: string;
    name: string;
  } | null;
  current_stage: {
    id: string;
    name: string;
  } | null;
}

interface ManageProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  onUpdated: () => void;
}

const STATUS_CONFIG = {
  active: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Active' },
  in_sales: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'In Sales' },
  in_onboarding: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Onboarding' },
  declined: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Declined' },
  churned: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Churned' },
  inactive: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Inactive' },
};

export function ManageProductsModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  onUpdated,
}: ManageProductsModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [companyProducts, setCompanyProducts] = useState<CompanyProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<CompanyProduct | null>(null);
  const [editForm, setEditForm] = useState({
    status: '',
    mrr: '',
  });

  // Fetch company products and all products
  useEffect(() => {
    if (!isOpen) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch company products
        const cpRes = await fetch(`/api/companies/${companyId}/products`);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          setCompanyProducts(cpData.companyProducts || []);
        }

        // Fetch all products
        const pRes = await fetch('/api/products');
        if (pRes.ok) {
          const pData = await pRes.json();
          setAllProducts(pData.products || []);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isOpen, companyId]);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setEditingProduct(null);
      setEditForm({ status: '', mrr: '' });
    }
  }, [isOpen]);

  const handleStartSale = async (productId: string) => {
    setActionLoading(productId);
    try {
      const res = await fetch(`/api/companies/${companyId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          status: 'in_sales',
        }),
      });

      if (res.ok) {
        // Refresh list
        const cpRes = await fetch(`/api/companies/${companyId}/products`);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          setCompanyProducts(cpData.companyProducts || []);
        }
        onUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to start sale');
      }
    } catch (error) {
      console.error('Error starting sale:', error);
      alert('Failed to start sale');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (cp: CompanyProduct) => {
    setEditingProduct(cp);
    setEditForm({
      status: cp.status,
      mrr: cp.mrr || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    setActionLoading(editingProduct.id);
    try {
      const res = await fetch(`/api/companies/${companyId}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_product_id: editingProduct.id,
          status: editForm.status,
          mrr: editForm.mrr || null,
        }),
      });

      if (res.ok) {
        // Refresh list
        const cpRes = await fetch(`/api/companies/${companyId}/products`);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          setCompanyProducts(cpData.companyProducts || []);
        }
        setEditingProduct(null);
        onUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  // Get products not yet assigned to this company
  const activeProductIds = new Set(companyProducts.map((cp) => cp.product_id));
  const availableProducts = allProducts.filter(
    (p) => !activeProductIds.has(p.id) && p.is_sellable
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Manage Products
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Company context */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[#2a2a2a]">
            <p className="text-xs text-gray-500">
              Products for: <span className="font-medium text-gray-700 dark:text-gray-300">{companyName}</span>
            </p>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current Products */}
                {companyProducts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Current Products
                    </h3>
                    <div className="space-y-2">
                      {companyProducts.map((cp) => {
                        const config = STATUS_CONFIG[cp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.inactive;
                        const StatusIcon = config.icon;
                        const isEditing = editingProduct?.id === cp.id;
                        const isLoadingThis = actionLoading === cp.id;

                        return (
                          <div
                            key={cp.id}
                            className={cn(
                              'p-3 rounded-lg border',
                              isEditing ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                            )}
                          >
                            {isEditing ? (
                              // Edit form
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{cp.product.icon || '📦'}</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {cp.product.name}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      Status
                                    </label>
                                    <select
                                      value={editForm.status}
                                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                    >
                                      <option value="inactive">Inactive</option>
                                      <option value="in_sales">In Sales</option>
                                      <option value="in_onboarding">Onboarding</option>
                                      <option value="active">Active</option>
                                      <option value="declined">Declined</option>
                                      <option value="churned">Churned</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                      MRR
                                    </label>
                                    <input
                                      type="number"
                                      value={editForm.mrr}
                                      onChange={(e) => setEditForm({ ...editForm, mrr: e.target.value })}
                                      placeholder="0.00"
                                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingProduct(null)}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={isLoadingThis}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 transition-colors"
                                  >
                                    {isLoadingThis ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-3 w-3" />
                                    )}
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Display view
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{cp.product.icon || '📦'}</span>
                                  <div>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {cp.product.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <StatusIcon className={cn('h-3 w-3', config.color)} />
                                      <span className={cn('text-xs', config.color)}>
                                        {config.label}
                                      </span>
                                      {cp.mrr && parseFloat(cp.mrr) > 0 && (
                                        <span className="text-xs text-gray-500">
                                          ${parseFloat(cp.mrr).toLocaleString()}/mo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleStartEdit(cp)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Products */}
                {availableProducts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Add Product
                    </h3>
                    <div className="space-y-2">
                      {availableProducts.map((product) => {
                        const isLoadingThis = actionLoading === product.id;

                        return (
                          <div
                            key={product.id}
                            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg opacity-50">{product.icon || '📦'}</span>
                              <span className="text-gray-500">{product.name}</span>
                            </div>

                            <button
                              onClick={() => handleStartSale(product.id)}
                              disabled={isLoadingThis}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            >
                              {isLoadingThis ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Start Sale
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {companyProducts.length === 0 && availableProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No products available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-[#2a2a2a] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
