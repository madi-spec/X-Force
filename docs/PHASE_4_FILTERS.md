# PHASE 4: Filter Components

## Objective
Create the filter bar with user multi-select, product multi-select, health filter, search, and view controls.

## Pre-Phase Checklist
- [ ] Phase 3 complete (tabs and header working)
- [ ] `/api/products/list` returns products
- [ ] `/api/products/users` returns users
- [ ] Review mockup filter bar design

## Tasks

### 4.1 Create Process Filters Component
Create file: `src/components/products/ProcessFilters.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Users, Package, ChevronDown, User, X } from 'lucide-react';
import { HealthStatus } from '@/types/products';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  initials: string | null;
  role: string | null;
}

interface ProcessFiltersProps {
  selectedProducts: string[];
  selectedUsers: string[];
  health: HealthStatus | 'all';
  search: string;
  onProductsChange: (products: string[]) => void;
  onUsersChange: (users: string[]) => void;
  onHealthChange: (health: HealthStatus | 'all') => void;
  onSearchChange: (search: string) => void;
}

export function ProcessFilters({
  selectedProducts,
  selectedUsers,
  health,
  search,
  onProductsChange,
  onUsersChange,
  onHealthChange,
  onSearchChange,
}: ProcessFiltersProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(search);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch products and users
  useEffect(() => {
    async function fetchData() {
      const [productsRes, usersRes] = await Promise.all([
        fetch('/api/products/list'),
        fetch('/api/products/users'),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data);
        // Select all products by default if none selected
        if (selectedProducts.length === 0) {
          onProductsChange(data.map((p: Product) => p.id));
        }
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
      }
    }
    fetchData();
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== search) {
        onSearchChange(searchValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleUserToggle = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onUsersChange(selectedUsers.filter(id => id !== userId));
    } else {
      onUsersChange([...selectedUsers, userId]);
    }
  };

  const handleProductToggle = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      onProductsChange(selectedProducts.filter(id => id !== productId));
    } else {
      onProductsChange([...selectedProducts, productId]);
    }
  };

  const handleMyItems = () => {
    // TODO: Get current user ID from auth
    // For now, select first user
    if (users.length > 0) {
      onUsersChange([users[0].id]);
    }
    setUserDropdownOpen(false);
  };

  const getUserLabel = () => {
    if (selectedUsers.length === 0) return 'All Users';
    if (selectedUsers.length === 1) {
      const user = users.find(u => u.id === selectedUsers[0]);
      return user?.name || 'Unknown';
    }
    return `${selectedUsers.length} Users`;
  };

  const getProductLabel = () => {
    if (selectedProducts.length === 0 || selectedProducts.length === products.length) {
      return 'All Products';
    }
    if (selectedProducts.length === 1) {
      const product = products.find(p => p.id === selectedProducts[0]);
      return product?.name || 'Unknown';
    }
    return `${selectedProducts.length} Products`;
  };

  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6 py-3">
      <div className="flex items-center gap-3">
        {/* User Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => {
              setUserDropdownOpen(!userDropdownOpen);
              setProductDropdownOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm transition-colors',
              selectedUsers.length > 0
                ? 'border-[#3b82f6] bg-[#f8fafc]'
                : 'border-[#e6eaf0] hover:border-[#d1d5db]'
            )}
          >
            <Users className="w-4 h-4 text-[#667085]" />
            <span className="text-[#0b1220]">{getUserLabel()}</span>
            <ChevronDown className="w-3 h-3 text-[#667085]" />
          </button>

          {userDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-[#e6eaf0] rounded-xl shadow-lg z-50">
              <div className="p-2 border-b border-[#e6eaf0]">
                <button
                  onClick={handleMyItems}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-[#f6f8fb] transition-colors"
                >
                  <User className="w-4 h-4 text-[#667085]" />
                  <span className="text-sm font-medium text-[#0b1220]">My Items Only</span>
                </button>
              </div>

              <div className="p-2 max-h-64 overflow-auto">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#667085] px-3 py-1.5">
                  Team Members
                </div>
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f6f8fb] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleUserToggle(user.id)}
                      className="w-4 h-4 rounded border-[#e6eaf0] text-[#3b82f6] focus:ring-[#3b82f6]"
                    />
                    <div className="w-8 h-8 rounded-full bg-[#e6eaf0] flex items-center justify-center text-xs font-semibold text-[#667085]">
                      {user.initials || user.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#0b1220] truncate">{user.name}</div>
                      <div className="text-xs text-[#667085] truncate">{user.role}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between p-2 border-t border-[#e6eaf0]">
                <button
                  onClick={() => onUsersChange([])}
                  className="text-sm text-[#667085] hover:text-[#0b1220] px-3 py-1.5 rounded-lg hover:bg-[#f6f8fb]"
                >
                  Clear
                </button>
                <button
                  onClick={() => setUserDropdownOpen(false)}
                  className="text-sm text-[#3b82f6] px-3 py-1.5 rounded-lg hover:bg-[#f6f8fb]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Product Dropdown */}
        <div className="relative" ref={productDropdownRef}>
          <button
            onClick={() => {
              setProductDropdownOpen(!productDropdownOpen);
              setUserDropdownOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm transition-colors',
              selectedProducts.length > 0 && selectedProducts.length < products.length
                ? 'border-[#3b82f6] bg-[#f8fafc]'
                : 'border-[#e6eaf0] hover:border-[#d1d5db]'
            )}
          >
            <Package className="w-4 h-4 text-[#667085]" />
            <span className="text-[#0b1220]">{getProductLabel()}</span>
            <ChevronDown className="w-3 h-3 text-[#667085]" />
          </button>

          {productDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-[#e6eaf0] rounded-xl shadow-lg z-50">
              <div className="p-2">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f6f8fb] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleProductToggle(product.id)}
                      className="w-4 h-4 rounded border-[#e6eaf0] text-[#3b82f6] focus:ring-[#3b82f6]"
                    />
                    <span className="text-lg">{product.icon || '📦'}</span>
                    <span className="text-sm font-medium text-[#0b1220]">{product.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between p-2 border-t border-[#e6eaf0]">
                <button
                  onClick={() => onProductsChange(products.map(p => p.id))}
                  className="text-sm text-[#667085] hover:text-[#0b1220] px-3 py-1.5 rounded-lg hover:bg-[#f6f8fb]"
                >
                  Select All
                </button>
                <button
                  onClick={() => setProductDropdownOpen(false)}
                  className="text-sm text-[#3b82f6] px-3 py-1.5 rounded-lg hover:bg-[#f6f8fb]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Health Filter */}
        <select
          value={health}
          onChange={(e) => onHealthChange(e.target.value as HealthStatus | 'all')}
          className="px-3 py-2 bg-white border border-[#e6eaf0] rounded-lg text-sm text-[#0b1220] focus:border-[#3b82f6] focus:ring-0 outline-none cursor-pointer"
        >
          <option value="all">All Health</option>
          <option value="attention">Needs Attention</option>
          <option value="stalled">Stalled</option>
          <option value="healthy">Healthy</option>
        </select>

        {/* Search */}
        <div className="flex-1 max-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#e6eaf0] rounded-lg text-sm text-[#0b1220] placeholder-[#667085] focus:border-[#3b82f6] focus:ring-0 outline-none"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue('');
                onSearchChange('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-[#667085] hover:text-[#0b1220]" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Quick Filter */}
        <button
          onClick={() => onHealthChange(health === 'attention' ? 'all' : 'attention')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            health === 'attention'
              ? 'bg-[#0b1220] text-white'
              : 'bg-white border border-[#e6eaf0] text-[#667085] hover:text-[#0b1220] hover:bg-[#f6f8fb]'
          )}
        >
          Needs Attention
        </button>
      </div>
    </div>
  );
}
```

### 4.2 Create View Controls Component
Create file: `src/components/products/ProcessViewControls.tsx`

```typescript
'use client';

import { LayoutGrid, List, Building2, Columns } from 'lucide-react';
import { ViewMode } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessViewControlsProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ProcessViewControls({ view, onViewChange }: ProcessViewControlsProps) {
  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6 py-2.5">
      <div className="flex items-center justify-between">
        {/* View Mode Tabs */}
        <div className="flex bg-[#f6f8fb] p-1 rounded-lg gap-0.5">
          <ViewTab
            active={view === 'all'}
            onClick={() => onViewChange('all')}
            icon={<LayoutGrid className="w-4 h-4" />}
            label="All Items"
          />
          <ViewTab
            active={view === 'stage'}
            onClick={() => onViewChange('stage')}
            icon={<Columns className="w-4 h-4" />}
            label="By Stage"
          />
          <ViewTab
            active={view === 'company'}
            onClick={() => onViewChange('company')}
            icon={<Building2 className="w-4 h-4" />}
            label="By Company"
          />
        </div>

        {/* Display Toggle (Kanban/List) - For future use */}
        <div className="flex bg-[#f6f8fb] p-1 rounded-lg gap-0.5">
          <button className="px-3 py-2 rounded-md bg-white shadow-sm text-[#0b1220]">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button className="px-3 py-2 rounded-md text-[#667085] hover:text-[#0b1220]">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ViewTab({ active, onClick, icon, label }: ViewTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-all',
        active
          ? 'bg-white shadow-sm text-[#0b1220]'
          : 'text-[#667085] hover:text-[#0b1220]'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
```

### 4.3 Update Exports
Update file: `src/components/products/index.ts`

```typescript
export * from './ProcessViewContainer';
export * from './ProcessTabs';
export * from './ProcessHeader';
export * from './ProcessFilters';
export * from './ProcessViewControls';
export * from './ProcessViewSkeleton';
```

## Testing Criteria

### Test 1: Visual Verification
Use Playwright MCP:

```typescript
// Navigate and wait for filters
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('[data-testid="process-filters"]');

// Take screenshot of filter bar
await page.screenshot({ path: 'process-filters.png' });
```

### Test 2: User Dropdown
```typescript
// Open user dropdown
await page.click('text=All Users');
await page.waitForSelector('text=Team Members');

// Screenshot dropdown open
await page.screenshot({ path: 'user-dropdown-open.png' });

// Select a user
await page.click('input[type="checkbox"]');

// Verify filter applied
const userLabel = await page.locator('text=Users').first().textContent();
console.log('User filter label:', userLabel);
```

### Test 3: Product Dropdown
```typescript
// Open product dropdown
await page.click('text=All Products');
await page.waitForSelector('input[type="checkbox"]');

// Toggle a product off
const firstCheckbox = page.locator('input[type="checkbox"]').first();
await firstCheckbox.click();

// Verify filter applied
const productLabel = await page.locator('text=Products').first().textContent();
console.log('Product filter label:', productLabel);
```

### Test 4: Search Filter
```typescript
// Type in search
await page.fill('input[placeholder="Search companies..."]', 'Spring');

// Wait for debounce
await page.waitForTimeout(400);

// Verify URL updated
const url = page.url();
console.log('URL after search:', url);
// Should contain: ?search=Spring
```

### Test 5: Quick Filter Toggle
```typescript
// Click needs attention
await page.click('text=Needs Attention');

// Verify button is active (dark background)
const button = page.locator('text=Needs Attention');
const bgColor = await button.evaluate(el => window.getComputedStyle(el).backgroundColor);
console.log('Quick filter button bg:', bgColor);
// Should be dark when active
```

## Debugging Steps

### If dropdowns don't close:
1. Verify click outside listener is attached
2. Check ref is properly assigned
3. Test event propagation

### If filters don't apply:
1. Check URL is updating via `updateParams`
2. Verify `useSearchParams` returns correct values
3. Check API is receiving filter params

### If products/users don't load:
1. Check API endpoints work directly
2. Verify fetch is completing
3. Check for CORS or auth issues

## Completion Checklist
- [ ] User dropdown opens and closes correctly
- [ ] User multi-select works
- [ ] "My Items Only" button works
- [ ] Product dropdown opens and closes correctly
- [ ] Product multi-select works
- [ ] Health select filter works
- [ ] Search input with debounce works
- [ ] Quick filter "Needs Attention" toggles
- [ ] View mode tabs switch correctly
- [ ] URL updates with filter changes
- [ ] No TypeScript errors

## Git Commit
```bash
git add -A
git commit -m "feat(products): add filter components

- Add ProcessFilters with user and product multi-select
- Add search with debounce
- Add health filter dropdown
- Add quick filter button
- Add ProcessViewControls with view mode tabs
- Filters update URL for shareable state"
```

## Next Phase
Say "PHASE 4 COMPLETE - PHASE 5 STARTING" and proceed to Phase 5.
