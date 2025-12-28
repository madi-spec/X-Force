'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Building2, Briefcase, User, X, Loader2 } from 'lucide-react';
import { getInitials, cn } from '@/lib/utils';
import { MobileNav } from './MobileNav';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
  };
}

interface SearchResult {
  id: string;
  name: string;
  type: 'company' | 'deal' | 'contact';
  subtitle?: string;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [companiesRes, dealsRes, contactsRes] = await Promise.all([
          fetch(`/api/companies?search=${encodeURIComponent(query)}&limit=5`),
          fetch(`/api/deals?search=${encodeURIComponent(query)}&limit=5`),
          fetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=5`),
        ]);

        const [companiesData, dealsData, contactsData] = await Promise.all([
          companiesRes.ok ? companiesRes.json() : { companies: [] },
          dealsRes.ok ? dealsRes.json() : { deals: [] },
          contactsRes.ok ? contactsRes.json() : { contacts: [] },
        ]);

        const companies = companiesData.companies || [];
        const deals = dealsData.deals || [];
        const contacts = contactsData.contacts || [];

        const searchResults: SearchResult[] = [
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

        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus mobile input when shown
  useEffect(() => {
    if (showMobileSearch && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [showMobileSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setShowMobileSearch(false);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const getIcon = (type: 'company' | 'deal' | 'contact') => {
    switch (type) {
      case 'company':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case 'deal':
        return <Briefcase className="h-4 w-4 text-green-500" />;
      case 'contact':
        return <User className="h-4 w-4 text-purple-500" />;
    }
  };

  const getTypeLabel = (type: 'company' | 'deal' | 'contact') => {
    switch (type) {
      case 'company':
        return 'Company';
      case 'deal':
        return 'Deal';
      case 'contact':
        return 'Contact';
    }
  };

  const SearchResults = () => (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
      {results.map((result, index) => (
        <button
          key={`${result.type}-${result.id}`}
          onClick={() => handleSelect(result)}
          className={cn(
            'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors',
            index === selectedIndex && 'bg-gray-50'
          )}
        >
          {getIcon(result.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
            {result.subtitle && (
              <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{getTypeLabel(result.type)}</span>
        </button>
      ))}
      {results.length === 0 && query && !isLoading && (
        <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
      )}
    </div>
  );

  return (
    <>
      <header className="h-16 border-b border-gray-200 bg-white px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Mobile Nav + Search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <MobileNav />

          {/* Search - hidden on mobile, visible on tablet+ */}
          <div className="hidden sm:block flex-1 max-w-lg" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setIsOpen(true)}
                placeholder="Search deals, companies, contacts..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isOpen && <SearchResults />}
            </div>
          </div>

          {/* Mobile search button */}
          <button
            onClick={() => setShowMobileSearch(true)}
            className="sm:hidden p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4 shrink-0">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
        </button>

        {user && (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {getInitials(user.name)}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </header>

      {/* Mobile search overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-white z-50 sm:hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setQuery('');
                setResults([]);
              }}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-73px)]">
            {results.map((result, index) => (
              <button
                key={`mobile-${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 border-b border-gray-100',
                  index === selectedIndex && 'bg-gray-50'
                )}
              >
                {getIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
                  {result.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{getTypeLabel(result.type)}</span>
              </button>
            ))}
            {results.length === 0 && query && !isLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No results found</div>
            )}
            {!query && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Search for deals, companies, or contacts
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
