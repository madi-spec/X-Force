'use client';

import { cn } from '@/lib/utils';
import {
  Target,
  DollarSign,
  Calendar,
  User,
  ChevronRight,
  TrendingUp,
  Package,
  ArrowRight,
} from 'lucide-react';
import { CustomerHubData, CompanyProduct } from '../types';

interface SalesTabProps {
  data: CustomerHubData;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function OpportunityCard({ product }: { product: CompanyProduct }) {
  const stageColors: Record<string, string> = {
    new_lead: 'bg-gray-100 text-gray-700',
    qualifying: 'bg-blue-100 text-blue-700',
    discovery: 'bg-purple-100 text-purple-700',
    demo: 'bg-indigo-100 text-indigo-700',
    trial: 'bg-cyan-100 text-cyan-700',
    negotiation: 'bg-amber-100 text-amber-700',
    closed_won: 'bg-green-100 text-green-700',
    closed_lost: 'bg-red-100 text-red-700',
  };

  const stageSlug = product.current_stage?.slug || 'new_lead';
  const annualValue = (product.mrr || 0) * 12;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Package className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{product.product?.name || 'Unknown Product'}</h4>
            <p className="text-sm text-gray-500">{product.tier?.name || 'No tier selected'}</p>
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-lg text-sm font-medium', stageColors[stageSlug] || stageColors.new_lead)}>
          {product.current_stage?.name || 'New Lead'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <DollarSign className="h-4 w-4 text-gray-400 mx-auto mb-1" />
          <p className="text-lg font-medium text-gray-900">{formatCurrency(annualValue)}</p>
          <p className="text-xs text-gray-500">Annual Value</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <User className="h-4 w-4 text-gray-400 mx-auto mb-1" />
          <p className="text-lg font-medium text-gray-900">{product.owner?.name?.split(' ')[0] || '-'}</p>
          <p className="text-xs text-gray-500">Owner</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <Calendar className="h-4 w-4 text-gray-400 mx-auto mb-1" />
          <p className="text-lg font-medium text-gray-900">-</p>
          <p className="text-xs text-gray-500">Close Date</p>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2">Sales Stage</p>
        <div className="flex items-center gap-1">
          {['Qualifying', 'Discovery', 'Demo', 'Trial', 'Negotiation'].map((stage, idx) => (
            <div key={stage} className="flex items-center">
              <div
                className={cn(
                  'h-2 flex-1 rounded-full min-w-[40px]',
                  (product.current_stage?.stage_order || 0) > idx
                    ? 'bg-purple-500'
                    : 'bg-gray-200'
                )}
              />
              {idx < 4 && <ArrowRight className="h-3 w-3 text-gray-300 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SalesTab({ data }: SalesTabProps) {
  const { companyProducts, company } = data;

  const salesProducts = companyProducts.filter(p => p.status === 'in_sales');
  const wonProducts = companyProducts.filter(p => p.status === 'active' && p.activated_at);
  const lostProducts = companyProducts.filter(p => p.status === 'declined');

  const totalPipelineValue = salesProducts.reduce((sum, p) => sum + ((p.mrr || 0) * 12), 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Pipeline</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{formatCurrency(totalPipelineValue)}</p>
          <p className="text-xs text-gray-500 mt-1">{salesProducts.length} opportunities</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Won</span>
          </div>
          <p className="text-2xl font-light text-green-600">{wonProducts.length}</p>
          <p className="text-xs text-gray-500 mt-1">products activated</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-2xl font-light text-blue-600">
            {companyProducts.filter(p => p.status === 'active').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">products</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">Customer Since</span>
          </div>
          <p className="text-2xl font-light text-gray-900">
            {company.created_at ? new Date(company.created_at).getFullYear() : '-'}
          </p>
        </div>
      </div>

      {/* Active Opportunities */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Active Opportunities</h3>
        {salesProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No active sales opportunities</p>
            <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
              Start New Opportunity
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {salesProducts.map((product) => (
              <OpportunityCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Won/Lost History */}
      {(wonProducts.length > 0 || lostProducts.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4">Sales History</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...wonProducts, ...lostProducts].slice(0, 10).map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product?.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>
                        {product.status === 'active' ? 'Won' : 'Lost'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency((product.mrr || 0) * 12)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {product.activated_at ? new Date(product.activated_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
