'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Building2, Plus, X, Search, Check } from 'lucide-react';
import { assignCustomerAction } from '../actions';

interface Customer {
  id: string;
  name: string;
}

interface CustomerDropdownProps {
  meetingId: string;
  customerId: string | null;
  customerName: string | null;
  customers: Customer[];
  onOptimisticUpdate?: (customerId: string | null, customerName: string | null) => void;
}

export function CustomerDropdown({
  meetingId,
  customerId,
  customerName,
  customers,
  onOptimisticUpdate,
}: CustomerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAssign = (customer: Customer | null) => {
    const newCustomerId = customer?.id || null;
    const newCustomerName = customer?.name || null;

    // Optimistic update
    onOptimisticUpdate?.(newCustomerId, newCustomerName);

    setIsOpen(false);
    setSearch('');

    startTransition(async () => {
      const result = await assignCustomerAction(meetingId, newCustomerId);
      if (!result.success) {
        // Revert on error
        onOptimisticUpdate?.(customerId, customerName);
        console.error('Failed to assign customer:', result.error);
      }
    });
  };

  const isAssigned = customerId !== null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isPending}
        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-colors ${
          isAssigned
            ? 'text-gray-600 hover:bg-gray-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{customerName || 'Assign Customer'}</span>
        {!isAssigned && <Plus className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 min-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="max-h-[240px] overflow-y-auto">
            {/* Remove assignment option */}
            {isAssigned && (
              <button
                onClick={() => handleAssign(null)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100"
              >
                <X className="w-4 h-4" />
                Remove assignment
              </button>
            )}

            {/* Filtered customers */}
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleAssign(customer)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    customer.id === customerId
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{customer.name}</span>
                  {customer.id === customerId && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {search ? 'No customers found' : 'No customers available'}
              </div>
            )}
          </div>

          {/* Create new customer hint */}
          {search && filteredCustomers.length === 0 && (
            <div className="px-3 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Customer not found? Create one in the Customers section.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
