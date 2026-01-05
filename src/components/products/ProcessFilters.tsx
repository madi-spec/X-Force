'use client';

import { useState, useRef, useEffect } from 'react';
import { HealthStatus } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessFiltersProps {
  products: { id: string; name: string; color: string | null }[];
  users: { id: string; name: string; initials: string }[];
  selectedProducts: string[];
  selectedUsers: string[];
  healthFilter: HealthStatus | 'all';
  searchQuery: string;
  onUpdateParams: (updates: Record<string, string | null>) => void;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onToggle,
  onClear,
  renderOption,
}: {
  label: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  renderOption?: (option: { id: string; name: string }) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setIsOpen(false));

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors',
          hasSelection
            ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]'
            : 'border-[#e6eaf0] bg-white text-[#667085] hover:border-[#d1d5db]'
        )}
      >
        <span>{hasSelection ? `${selectedIds.length} selected` : label}</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-[#e6eaf0] shadow-lg z-50">
          <div className="p-2 border-b border-[#e6eaf0]">
            <span className="text-xs text-[#667085] uppercase tracking-wider font-medium">{label}</span>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => onToggle(option.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded hover:bg-[#f6f8fb]"
              >
                <div className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  selectedIds.includes(option.id)
                    ? 'bg-[#3b82f6] border-[#3b82f6]'
                    : 'border-[#d1d5db]'
                )}>
                  {selectedIds.includes(option.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {renderOption ? renderOption(option) : <span className="text-[#0b1220]">{option.name}</span>}
              </button>
            ))}
          </div>
          {hasSelection && (
            <div className="p-2 border-t border-[#e6eaf0]">
              <button
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="text-xs text-[#667085] hover:text-[#0b1220]"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProcessFilters({
  products,
  users,
  selectedProducts,
  selectedUsers,
  healthFilter,
  searchQuery,
  onUpdateParams,
}: ProcessFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onUpdateParams({ search: localSearch || null });
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [localSearch, searchQuery, onUpdateParams]);

  const toggleProduct = (id: string) => {
    const newSelection = selectedProducts.includes(id)
      ? selectedProducts.filter(p => p !== id)
      : [...selectedProducts, id];
    onUpdateParams({ products: newSelection.length > 0 ? newSelection.join(',') : null });
  };

  const toggleUser = (id: string) => {
    const newSelection = selectedUsers.includes(id)
      ? selectedUsers.filter(u => u !== id)
      : [...selectedUsers, id];
    onUpdateParams({ users: newSelection.length > 0 ? newSelection.join(',') : null });
  };

  const needsAttentionActive = healthFilter === 'attention' || healthFilter === 'stalled';

  return (
    <div className="flex items-center gap-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search companies..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-48 pl-9 pr-3 py-2 text-sm border border-[#e6eaf0] rounded-lg focus:outline-none focus:border-[#3b82f6] placeholder:text-[#9ca3af]"
        />
      </div>

      {/* User Filter */}
      <MultiSelectDropdown
        label="All Users"
        options={users}
        selectedIds={selectedUsers}
        onToggle={toggleUser}
        onClear={() => onUpdateParams({ users: null })}
        renderOption={(option) => {
          const user = users.find(u => u.id === option.id);
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#eef2f7] text-xs font-medium text-[#667085] flex items-center justify-center">
                {user?.initials}
              </div>
              <span className="text-[#0b1220]">{option.name}</span>
            </div>
          );
        }}
      />

      {/* Product Filter */}
      <MultiSelectDropdown
        label="All Products"
        options={products}
        selectedIds={selectedProducts}
        onToggle={toggleProduct}
        onClear={() => onUpdateParams({ products: null })}
      />

      {/* Health Filter */}
      <select
        value={healthFilter}
        onChange={(e) => onUpdateParams({ health: e.target.value === 'all' ? null : e.target.value })}
        className="px-3 py-2 text-sm border border-[#e6eaf0] rounded-lg bg-white text-[#667085] focus:outline-none focus:border-[#3b82f6]"
      >
        <option value="all">All Health</option>
        <option value="healthy">Healthy</option>
        <option value="attention">Needs Attention</option>
        <option value="stalled">Stalled</option>
      </select>

      {/* Quick Filter: Needs Attention */}
      <button
        onClick={() => onUpdateParams({ health: needsAttentionActive ? null : 'attention' })}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors',
          needsAttentionActive
            ? 'bg-[#fef3c7] border-[#f59e0b] text-[#92400e]'
            : 'bg-white border-[#e6eaf0] text-[#667085] hover:border-[#d1d5db]'
        )}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span>Needs Attention</span>
      </button>
    </div>
  );
}
