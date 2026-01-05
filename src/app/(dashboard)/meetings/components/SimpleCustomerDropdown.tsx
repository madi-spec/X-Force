'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, Plus, X, Search, Check } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface SimpleCustomerDropdownProps {
  customerId: string | null;
  customerName: string | null;
  onAssign: (customerId: string | null) => void;
  customers: Customer[];
}

export function SimpleCustomerDropdown({
  customerId,
  customerName,
  onAssign,
  customers,
}: SimpleCustomerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
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

  const handleSelect = (customer: Customer | null) => {
    onAssign(customer?.id || null);
    setIsOpen(false);
    setSearch('');
  };

  const isAssigned = customerId !== null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-colors ${
          isAssigned
            ? 'text-gray-600 hover:bg-gray-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        }`}
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

          <div className="max-h-[240px] overflow-y-auto">
            {isAssigned && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100"
              >
                <X className="w-4 h-4" />
                Remove assignment
              </button>
            )}

            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
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
        </div>
      )}
    </div>
  );
}
