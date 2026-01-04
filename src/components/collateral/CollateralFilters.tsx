'use client';

import { Search, X } from 'lucide-react';
import type {
  CollateralFilters as Filters,
  DocumentType,
  MeetingType,
  ProductTag,
  IndustryTag,
} from '@/types/collateral';
import {
  DOCUMENT_TYPE_LABELS,
  MEETING_TYPE_LABELS,
  PRODUCT_TAG_LABELS,
  INDUSTRY_TAG_LABELS,
} from '@/types/collateral';

interface CollateralFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
}

export function CollateralFilters({
  filters,
  onChange,
  onClear,
}: CollateralFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.document_type ||
    filters.meeting_type ||
    filters.product ||
    filters.industry ||
    filters.search
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          placeholder="Search collateral..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Document Type */}
      <select
        value={filters.document_type || ''}
        onChange={(e) =>
          onChange({
            ...filters,
            document_type: (e.target.value as DocumentType) || undefined,
          })
        }
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="">All Types</option>
        {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Meeting Type */}
      <select
        value={filters.meeting_type || ''}
        onChange={(e) =>
          onChange({
            ...filters,
            meeting_type: (e.target.value as MeetingType) || undefined,
          })
        }
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="">All Meetings</option>
        {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Product */}
      <select
        value={filters.product || ''}
        onChange={(e) =>
          onChange({
            ...filters,
            product: (e.target.value as ProductTag) || undefined,
          })
        }
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="">All Products</option>
        {Object.entries(PRODUCT_TAG_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Industry */}
      <select
        value={filters.industry || ''}
        onChange={(e) =>
          onChange({
            ...filters,
            industry: (e.target.value as IndustryTag) || undefined,
          })
        }
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="">All Industries</option>
        {Object.entries(INDUSTRY_TAG_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      )}
    </div>
  );
}
