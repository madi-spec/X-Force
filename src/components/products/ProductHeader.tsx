'use client';

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';

interface ProductHeaderProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
}

export function ProductHeader({ product }: ProductHeaderProps) {
  return (
    <div className="mb-6">
      <Link
        href="/products"
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        All Products
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${product.color}20`, color: product.color || '#3B82F6' }}
          >
            {product.icon || '📦'}
          </div>
          <div>
            <h1 className="text-xl font-normal text-gray-900">{product.name}</h1>
            {product.description && (
              <p className="text-sm text-gray-500">{product.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/products/${product.slug}/process`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Process Editor
          </Link>
        </div>
      </div>
    </div>
  );
}
