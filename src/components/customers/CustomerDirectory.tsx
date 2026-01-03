'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Building2,
  Search,
  Filter,
  ChevronRight,
  HeartPulse,
  Copy,
  User,
} from 'lucide-react';
import { DuplicateManager } from '@/components/duplicates';

interface CompanyProduct {
  id: string;
  product_id: string;
  status: string;
  mrr: number | null;
  tier_id: string | null;
  owner_user_id: string | null;
  product: { id: string; name: string; slug: string } | null;
  owner_user: { id: string; name: string } | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  customer_type: string | null;
  created_at: string;
  vfp_support_contact: string | null;
  company_products: CompanyProduct[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface Stats {
  total: number;
  active: number;
  churned: number;
  total_mrr: number;
}

interface CustomerDirectoryProps {
  companies: Company[];
  products: Product[];
  stats: Stats;
}

type StatusFilter = 'all' | 'active' | 'in_sales' | 'in_onboarding' | 'churned';
type HealthFilter = 'all' | 'healthy' | 'at_risk' | 'critical';

function getHealthColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getHealthBg(score: number | null): string {
  if (score === null) return 'bg-gray-100';
  if (score >= 80) return 'bg-green-50';
  if (score >= 60) return 'bg-yellow-50';
  return 'bg-red-50';
}

function formatMRR(mrr: number | null): string {
  if (mrr === null) return '-';
  return `$${mrr.toLocaleString()}`;
}

export function CustomerDirectory({ companies, products, stats }: CustomerDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);

  // Fetch duplicate count on mount
  useEffect(() => {
    const fetchDuplicateCount = async () => {
      try {
        const res = await fetch('/api/duplicates?entityType=customer&status=pending');
        if (res.ok) {
          const data = await res.json();
          setDuplicateCount(data.groups?.length || 0);
        }
      } catch (err) {
        console.error('Failed to fetch duplicate count:', err);
      }
    };
    fetchDuplicateCount();
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !company.name.toLowerCase().includes(query) &&
          !company.domain?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const hasMatchingStatus = company.company_products.some(
          (cp) => cp.status === statusFilter
        );
        if (!hasMatchingStatus && statusFilter !== 'active') return false;
        if (statusFilter === 'active' && !company.company_products.some(cp => cp.status === 'active')) return false;
      }

      // Health filter - disabled until health_score is available on company_products
      // if (healthFilter !== 'all') {
      //   const avgHealth =
      //     company.company_products.reduce((sum, cp) => sum + (cp.health_score || 0), 0) /
      //     (company.company_products.length || 1);
      //   if (healthFilter === 'healthy' && avgHealth < 80) return false;
      //   if (healthFilter === 'at_risk' && (avgHealth >= 80 || avgHealth < 50)) return false;
      //   if (healthFilter === 'critical' && avgHealth >= 50) return false;
      // }

      // Product filter
      if (productFilter !== 'all') {
        const hasProduct = company.company_products.some(
          (cp) => cp.product?.id === productFilter
        );
        if (!hasProduct) return false;
      }

      return true;
    });
  }, [companies, searchQuery, statusFilter, healthFilter, productFilter]);

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All Statuses' },
    { key: 'active', label: 'Active' },
    { key: 'in_sales', label: 'In Sales' },
    { key: 'in_onboarding', label: 'Onboarding' },
    { key: 'churned', label: 'Churned' },
  ];

  const healthOptions: { key: HealthFilter; label: string }[] = [
    { key: 'all', label: 'All Health' },
    { key: 'healthy', label: 'Healthy (80+)' },
    { key: 'at_risk', label: 'At Risk (50-79)' },
    { key: 'critical', label: 'Critical (<50)' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Customers</h1>
          <p className="text-xs text-gray-500 mt-1">
            {filteredCompanies.length} of {companies.length} companies
          </p>
        </div>
        <button
          onClick={() => setShowDuplicateManager(true)}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            duplicateCount > 0
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          <Copy className="h-4 w-4" />
          Duplicates
          {duplicateCount > 0 && (
            <span className="bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {duplicateCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Customers</p>
          <p className="text-2xl font-light text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-light text-green-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Churned</p>
          <p className="text-2xl font-light text-red-600 mt-1">{stats.churned}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total MRR</p>
          <p className="text-2xl font-light text-gray-900 mt-1">${(stats.total_mrr || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              showFilters
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Health Filter */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                Health
              </label>
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value as HealthFilter)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {healthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                Product
              </label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredCompanies.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No customers match your filters</p>
            </div>
          ) : (
            filteredCompanies.map((company) => {
              const totalMRR = company.company_products.reduce(
                (sum, cp) => sum + (cp.mrr || 0),
                0
              );
              // Health score not available on company_products table yet
              const avgHealth: number | null = null;

              // Get success rep from vfp_support_contact (string field on companies table)
              const successRep = company.vfp_support_contact && company.vfp_support_contact !== 'None'
                ? company.vfp_support_contact
                : null;

              return (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{company.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {company.domain && <span>{company.domain}</span>}
                        {successRep && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <User className="h-3 w-3" />
                            {successRep}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    {/* Success Rep (larger screens) */}
                    {successRep && (
                      <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-blue-50 rounded">
                        <User className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">
                          {successRep}
                        </span>
                      </div>
                    )}

                    {/* Products */}
                    <div className="hidden md:flex items-center gap-1">
                      {company.company_products.slice(0, 3).map((cp) => (
                        <span
                          key={cp.id}
                          className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                        >
                          {cp.product?.name || 'Unknown'}
                        </span>
                      ))}
                      {company.company_products.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{company.company_products.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Health */}
                    <div
                      className={cn(
                        'hidden sm:flex items-center gap-1 px-2 py-1 rounded',
                        getHealthBg(avgHealth)
                      )}
                    >
                      <HeartPulse className={cn('h-3.5 w-3.5', getHealthColor(avgHealth))} />
                      <span className={cn('text-xs font-medium', getHealthColor(avgHealth))}>
                        {avgHealth !== null ? Math.round(avgHealth) : '-'}
                      </span>
                    </div>

                    {/* MRR */}
                    <div className="text-right min-w-[80px]">
                      <p className="text-sm font-medium text-gray-900">
                        {formatMRR(totalMRR)}
                      </p>
                      <p className="text-xs text-gray-500">MRR</p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Duplicate Manager Modal */}
      {showDuplicateManager && (
        <DuplicateManager
          entityType="customer"
          onClose={() => {
            setShowDuplicateManager(false);
            // Refresh count after closing
            fetch('/api/duplicates?entityType=customer&status=pending')
              .then((res) => res.json())
              .then((data) => setDuplicateCount(data.groups?.length || 0))
              .catch(() => {});
          }}
          isModal
        />
      )}
    </div>
  );
}
