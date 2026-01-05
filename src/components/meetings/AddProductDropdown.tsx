'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Loader2, Check, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface AddProductDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName?: string;
  onSuccess?: (productId: string, companyProductId: string) => void;
}

export function AddProductDropdown({
  isOpen,
  onClose,
  companyId,
  companyName,
  onSuccess,
}: AddProductDropdownProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ productId: string; companyProductId: string } | null>(null);

  // Fetch available products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/products?sellable=true');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data.products || data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load products when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setSuccess(null);
    }
  }, [isOpen, fetchProducts]);

  const handleAddProduct = async (productId: string) => {
    setAdding(productId);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${companyId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          status: 'discovery',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add product');
      }

      const data = await response.json();
      setSuccess({ productId, companyProductId: data.id || data.company_product?.id });
      onSuccess?.(productId, data.id || data.company_product?.id);
    } catch (err) {
      console.error('Error adding product:', err);
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setAdding(null);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Product</h2>
            {companyName && (
              <p className="text-xs text-gray-500 mt-0.5">
                Start a product process for {companyName}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Success message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Product added successfully</span>
              </div>
              <Link
                href={`/process/${success.companyProductId}`}
                className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"
                onClick={handleClose}
              >
                View in Process Studio
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Product list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No products available</p>
              </div>
            ) : (
              <div className="space-y-1">
                {products.map((product) => {
                  const isAdded = success?.productId === product.id;
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product.id)}
                      disabled={!!adding || isAdded}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors',
                        isAdded
                          ? 'bg-green-50 cursor-default'
                          : adding === product.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                          isAdded ? 'bg-green-100' : 'bg-gray-100'
                        )}
                      >
                        {isAdded ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Package className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isAdded ? 'text-green-700' : 'text-gray-900'
                          )}
                        >
                          {product.name}
                        </p>
                        {product.category && (
                          <p className="text-xs text-gray-500 truncate">
                            {product.category}
                          </p>
                        )}
                      </div>
                      {adding === product.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
