'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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

interface ProductCustomersProps {
  product: {
    id: string;
    name: string;
    pricing_model: string | null;
  };
  customers: Customer[];
  title?: string;
  emptyMessage?: string;
}

export function ProductCustomers({ product, customers, title, emptyMessage }: ProductCustomersProps) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">{title}</h3>
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {customers.map((customer) => {
            const dateValue = getDateField(customer);
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
