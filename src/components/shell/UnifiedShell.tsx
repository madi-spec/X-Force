'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/focus';
import { FocusSwitcher } from './FocusSwitcher';
import {
  Building2,
  Search,
  Settings,
  LogOut,
  Zap,
  MessageSquare,
  Package,
  ListTodo,
  Brain,
  Ticket,
  Inbox,
  Users,
  Workflow,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Bell,
  Command,
  Loader2,
  Briefcase,
  User,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';

// ============================================================================
// SEARCH TYPES
// ============================================================================

interface SearchResult {
  id: string;
  name: string;
  type: 'company' | 'deal' | 'contact';
  subtitle?: string;
}

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

// Primary navigation - new IA structure (always visible)
const primaryNavigation = [
  { name: 'Work', href: '/work', icon: Inbox },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Process Studio', href: '/process', icon: Workflow },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

// Secondary navigation - other tools (collapsible)
const secondaryNavigation = [
  { name: 'Command Center', href: '/ai', icon: Brain },
  { name: 'Daily Driver', href: '/daily', icon: ListTodo },
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Support Cases', href: '/cases', icon: Ticket },
  { name: 'Deals', href: '/deals', icon: Zap },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedShellProps {
  children: ReactNode;
  user?: {
    name: string;
    email: string;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedShell({ children, user }: UnifiedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = useFocus();
  const [showSecondary, setShowSecondary] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const [companiesRes, dealsRes, contactsRes] = await Promise.all([
          fetch(`/api/companies?search=${encodeURIComponent(searchQuery)}&limit=5`),
          fetch(`/api/deals?search=${encodeURIComponent(searchQuery)}&limit=5`),
          fetch(`/api/contacts?search=${encodeURIComponent(searchQuery)}&limit=5`),
        ]);

        const [companiesData, dealsData, contactsData] = await Promise.all([
          companiesRes.ok ? companiesRes.json() : { companies: [] },
          dealsRes.ok ? dealsRes.json() : { deals: [] },
          contactsRes.ok ? contactsRes.json() : { contacts: [] },
        ]);

        const companies = companiesData.companies || [];
        const deals = dealsData.deals || [];
        const contacts = contactsData.contacts || [];

        const results: SearchResult[] = [
          ...companies.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
            type: 'company' as const,
          })),
          ...deals.map((d: { id: string; name: string; company?: { name: string } }) => ({
            id: d.id,
            name: d.name,
            type: 'deal' as const,
            subtitle: d.company?.name,
          })),
          ...contacts.map((c: { id: string; full_name: string; company?: { name: string } }) => ({
            id: c.id,
            name: c.full_name,
            type: 'contact' as const,
            subtitle: c.company?.name,
          })),
        ];

        setSearchResults(results);
        setIsSearchOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    setIsSearchOpen(false);
    setSearchQuery('');

    switch (result.type) {
      case 'company':
        router.push(`/companies/${result.id}`);
        break;
      case 'deal':
        router.push(`/deals/${result.id}`);
        break;
      case 'contact':
        router.push(`/contacts/${result.id}`);
        break;
    }
  }, [router]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleSearchSelect(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsSearchOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const getSearchIcon = (type: 'company' | 'deal' | 'contact') => {
    switch (type) {
      case 'company':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case 'deal':
        return <Briefcase className="h-4 w-4 text-green-500" />;
      case 'contact':
        return <User className="h-4 w-4 text-purple-500" />;
    }
  };

  const getSearchTypeLabel = (type: 'company' | 'deal' | 'contact') => {
    switch (type) {
      case 'company':
        return 'Company';
      case 'deal':
        return 'Deal';
      case 'contact':
        return 'Contact';
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors, still redirect to login
    }
    router.push('/login');
    router.refresh();
  };

  // Check if any secondary nav item is active
  const isSecondaryActive = secondaryNavigation.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex h-full w-64 flex-col bg-gray-900">
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <span className="text-xl font-bold text-white">X-FORCE</span>
        </div>

        {/* Focus Switcher */}
        <div className="px-3 pb-4">
          <FocusSwitcher variant="sidebar" />
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto border-t border-gray-800">
          <div className="space-y-1">
            {primaryNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Secondary Navigation - Collapsible */}
          <div className="mt-6">
            <button
              onClick={() => setShowSecondary(!showSecondary)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors rounded-lg',
                isSecondaryActive
                  ? 'text-gray-300'
                  : 'text-gray-500 hover:text-gray-400'
              )}
            >
              <span>More Tools</span>
              {showSecondary ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {(showSecondary || isSecondaryActive) && (
              <div className="mt-1 space-y-1">
                {secondaryNavigation.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-800 px-3 py-4 space-y-1">
          {bottomNavigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-xl" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {isSearchLoading && (
                <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchResults.length > 0 && setIsSearchOpen(true)}
                placeholder="Search customers, deals, contacts..."
                className={cn(
                  'w-full pl-10 pr-16 py-2 rounded-lg text-sm',
                  'bg-gray-100',
                  'border border-transparent',
                  'focus:border-gray-300',
                  'focus:bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'placeholder-gray-500',
                  'text-gray-900'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>

              {/* Search Results Dropdown */}
              {isSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSearchSelect(result)}
                      className={cn(
                        'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors',
                        index === selectedIndex && 'bg-gray-50'
                      )}
                    >
                      {getSearchIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{getSearchTypeLabel(result.type)}</span>
                    </button>
                  ))}
                  {searchResults.length === 0 && searchQuery && !isSearchLoading && (
                    <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right-side Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              className={cn(
                'relative p-2 rounded-lg transition-colors',
                'hover:bg-gray-100',
                'text-gray-600'
              )}
            >
              <Bell className="h-5 w-5" />
            </button>

            {/* User Menu */}
            {user && (
              <div className="hidden md:flex items-center gap-3 ml-2 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {user.name?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
