'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRightCircle, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  status: string;
  activated_at: string | null;
  onboarding_started_at?: string | null;
  mrr: string | null;
  seats: number | null;
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
  tier: {
    id: string;
    name: string;
  } | null;
}

interface ConversionTarget {
  productId: string;
  productName: string;
}

interface ProductCustomersProps {
  product: {
    id: string;
    name: string;
    pricing_model: string | null;
  };
  customers: Customer[];
  title?: string;
  emptyMessage?: string;
  conversionTarget?: ConversionTarget;
}

export function ProductCustomers({
  product,
  customers,
  title,
  emptyMessage,
  conversionTarget
}: ProductCustomersProps) {
  const [converting, setConverting] = useState<string | null>(null);
  const [converted, setConverted] = useState<Set<string>>(new Set());

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">{emptyMessage || 'No customers yet.'}</p>
      </div>
    );
  }

  // Determine the date field based on customer status
  const getDateField = (customer: Customer) => {
    if (customer.status === 'in_onboarding' && customer.onboarding_started_at) {
      return customer.onboarding_started_at;
    }
    return customer.activated_at;
  };

  const dateLabel = customers[0]?.status === 'in_onboarding' ? 'Started' : 'Since';

  const handleConvert = async (customer: Customer) => {
    if (!conversionTarget || converting) return;

    if (!confirm(`Convert ${customer.company.name} from ${product.name} to ${conversionTarget.productName}?`)) {
      return;
    }

    setConverting(customer.company.id);

    try {
      const response = await fetch(`/api/companies/${customer.company.id}/products/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_product_id: product.id,
          to_product_id: conversionTarget.productId,
          transfer_mrr: true,
          new_status: 'active',
        }),
      });

      if (response.ok) {
        setConverted(prev => new Set([...prev, customer.company.id]));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to convert');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      alert('Failed to convert');
    } finally {
      setConverting(null);
    }
  };

  // Filter out already converted customers
  const visibleCustomers = customers.filter(c => !converted.has(c.company.id));

  if (visibleCustomers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <div className="text-green-600 mb-2">✓</div>
        <p className="text-gray-500">All customers have been converted!</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {conversionTarget && converted.size > 0 && (
            <span className="text-sm text-green-600">
              {converted.size} converted
            </span>
          )}
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Tier</th>
            {product.pricing_model === 'per_seat' && (
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Seats</th>
            )}
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">MRR</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">{dateLabel}</th>
            {conversionTarget && (
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Action</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {visibleCustomers.map((customer) => {
            const dateValue = getDateField(customer);
            const isConverting = converting === customer.company.id;

            return (
              <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/companies/${customer.company.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {customer.company.name}
                  </Link>
                  {customer.company.domain && (
                    <span className="text-xs text-gray-400 ml-2">
                      {customer.company.domain}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {customer.tier?.name || '—'}
                </td>
                {product.pricing_model === 'per_seat' && (
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {customer.seats || '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                  ${parseFloat(customer.mrr || '0').toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {dateValue
                    ? formatDistanceToNow(new Date(dateValue), { addSuffix: true })
                    : '—'
                  }
                </td>
                {conversionTarget && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleConvert(customer)}
                      disabled={isConverting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isConverting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <ArrowRightCircle className="w-4 h-4" />
                          Convert to {conversionTarget.productName}
                        </>
                      )}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
