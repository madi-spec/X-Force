'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Customer {
  id: string;
  status: string;
  activated_at: string | null;
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

interface ProductCustomersProps {
  product: {
    id: string;
    name: string;
    pricing_model: string | null;
  };
  customers: Customer[];
}

export function ProductCustomers({ product, customers }: ProductCustomersProps) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No active customers yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Tier</th>
            {product.pricing_model === 'per_seat' && (
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Seats</th>
            )}
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">MRR</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Since</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {customers.map((customer) => (
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
                {customer.activated_at
                  ? formatDistanceToNow(new Date(customer.activated_at), { addSuffix: true })
                  : '—'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
