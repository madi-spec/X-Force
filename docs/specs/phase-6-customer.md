# Phase 6: Customer Assignment

## Objective
Create the CustomerDropdown component that allows assigning meetings to customers.

## Prerequisites
- Phases 1-5 complete
- Server actions for customer assignment available

---

## Step 6.1: Create CustomerDropdown Component

Create file: `app/(dashboard)/meetings/components/CustomerDropdown.tsx`

```typescript
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
  company: string | null;
  customers: Customer[];
  onOptimisticUpdate?: (customerId: string | null, customerName: string | null) => void;
}

export function CustomerDropdown({
  meetingId,
  customerId,
  company,
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
        onOptimisticUpdate?.(customerId, company);
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
            ? 'text-slate-600 hover:bg-slate-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{company || 'Assign Customer'}</span>
        {!isAssigned && <Plus className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="max-h-[240px] overflow-y-auto">
            {/* Remove assignment option */}
            {isAssigned && (
              <>
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                >
                  <X className="w-4 h-4" />
                  Remove assignment
                </button>
              </>
            )}

            {/* Filtered customers */}
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleAssign(customer)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    customer.id === customerId
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{customer.name}</span>
                  {customer.id === customerId && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                {search ? 'No customers found' : 'No customers available'}
              </div>
            )}
          </div>

          {/* Create new customer hint */}
          {search && filteredCustomers.length === 0 && (
            <div className="px-3 py-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Customer not found? Create one in the Customers section.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Step 6.2: Create Wrapper for Use in Cards

Since the MeetingPrepCard and PastMeetingCard receive CustomerDropdown as a prop, we need a wrapper that handles the meeting-specific logic.

Create file: `app/(dashboard)/meetings/components/MeetingCustomerDropdown.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { CustomerDropdown } from './CustomerDropdown';

interface Customer {
  id: string;
  name: string;
}

interface MeetingCustomerDropdownProps {
  meetingId: string;
  initialCustomerId: string | null;
  initialCompany: string | null;
  customers: Customer[];
}

export function MeetingCustomerDropdown({
  meetingId,
  initialCustomerId,
  initialCompany,
  customers,
}: MeetingCustomerDropdownProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [company, setCompany] = useState(initialCompany);

  const handleOptimisticUpdate = useCallback(
    (newCustomerId: string | null, newCustomerName: string | null) => {
      setCustomerId(newCustomerId);
      setCompany(newCustomerName);
    },
    []
  );

  return (
    <CustomerDropdown
      meetingId={meetingId}
      customerId={customerId}
      company={company}
      customers={customers}
      onOptimisticUpdate={handleOptimisticUpdate}
    />
  );
}
```

---

## Step 6.3: Create Simple CustomerDropdown for Card Props

For the card components that receive CustomerDropdown as a prop pattern, create a simpler interface:

Create file: `app/(dashboard)/meetings/components/SimpleCustomerDropdown.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, Plus, X, Search, Check } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface SimpleCustomerDropdownProps {
  customerId: string | null;
  company: string | null;
  onAssign: (customerId: string | null, customerName: string | null) => void;
  customers: Customer[];
}

export function SimpleCustomerDropdown({
  customerId,
  company,
  onAssign,
  customers,
}: SimpleCustomerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const handleSelect = (customer: Customer | null) => {
    onAssign(customer?.id || null, customer?.name || null);
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
            ? 'text-slate-600 hover:bg-slate-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        }`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{company || 'Assign Customer'}</span>
        {!isAssigned && <Plus className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 min-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="max-h-[240px] overflow-y-auto">
            {isAssigned && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
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
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    customer.id === customerId
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{customer.name}</span>
                  {customer.id === customerId && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                {search ? 'No customers found' : 'No customers available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 6.4: Update Component Index

Update file: `app/(dashboard)/meetings/components/index.ts`

```typescript
export { EditableText } from './EditableText';
export { SentimentBadge } from './SentimentBadge';
export { DateDropdown } from './DateDropdown';
export { AssigneeDropdown } from './AssigneeDropdown';
export { StatsBar } from './StatsBar';
export { MeetingPrepCard } from './MeetingPrepCard';
export { PastMeetingCard } from './PastMeetingCard';
export { ActionItemRow } from './ActionItemRow';
export { ActionItemsList } from './ActionItemsList';
export { CustomerDropdown } from './CustomerDropdown';
export { MeetingCustomerDropdown } from './MeetingCustomerDropdown';
export { SimpleCustomerDropdown } from './SimpleCustomerDropdown';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/components/CustomerDropdown.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/SimpleCustomerDropdown.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/MeetingCustomerDropdown.tsx --noEmit
```
Expected: No errors

### 2. Test functionality
1. Click dropdown on unassigned meeting - should show amber "Assign Customer" button
2. Search for customer - should filter list
3. Select customer - should update and show customer name
4. Click on assigned meeting - should show current customer highlighted
5. Select "Remove assignment" - should clear and show amber button again

### 3. Verify z-index and positioning
- Dropdown should appear above other content
- Should not be cut off by card boundaries
- Click outside should close dropdown

---

## Phase 6 Complete

Once all verification checks pass, proceed to `phase-7-exclude.md`.
