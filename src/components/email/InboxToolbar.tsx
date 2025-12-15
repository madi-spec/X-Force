'use client';

import { Search, RefreshCw, ChevronDown, Archive, Trash2, MoreHorizontal, Mail, MailOpen, Star, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailFilter } from './types';
import { useState, useRef, useEffect } from 'react';

interface InboxToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: EmailFilter;
  onFilterChange: (filter: EmailFilter) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  totalCount: number;
  onArchive: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onStarSelected: () => void;
}

export function InboxToolbar({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  onRefresh,
  isRefreshing,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  allSelected,
  totalCount,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onStarSelected,
}: InboxToolbarProps) {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBulkMoreMenu, setShowBulkMoreMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const bulkMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (bulkMoreRef.current && !bulkMoreRef.current.contains(event.target as Node)) {
        setShowBulkMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filters: { id: EmailFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'starred', label: 'Starred' },
    { id: 'contacts', label: 'From Contacts' },
  ];

  const currentFilterLabel = filters.find(f => f.id === filter)?.label || 'All';

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      {/* Select All Checkbox */}
      <div className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={allSelected && totalCount > 0}
          onChange={() => allSelected ? onDeselectAll() : onSelectAll()}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <button
          onClick={() => allSelected ? onDeselectAll() : onSelectAll()}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Bulk Actions (show when items selected) */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1">
          <span className="text-sm text-gray-600 mr-2">{selectedCount} selected</span>
          <button
            onClick={onArchive}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* More Actions Dropdown for Bulk */}
          <div className="relative" ref={bulkMoreRef}>
            <button
              onClick={() => setShowBulkMoreMenu(!showBulkMoreMenu)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
              title="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showBulkMoreMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    onMarkRead();
                    setShowBulkMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <MailOpen className="h-4 w-4" />
                  Mark as read
                </button>
                <button
                  onClick={() => {
                    onMarkUnread();
                    setShowBulkMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Mark as unread
                </button>
                <button
                  onClick={() => {
                    onStarSelected();
                    setShowBulkMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Star className="h-4 w-4" />
                  Star selected
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    onDeselectAll();
                    setShowBulkMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors',
              isRefreshing && 'animate-spin'
            )}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* More Actions Dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
              title="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    onSelectAll();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Tag className="h-4 w-4" />
                  Select all
                </button>
                <button
                  onClick={() => {
                    onFilterChange('unread');
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Show unread only
                </button>
                <button
                  onClick={() => {
                    onFilterChange('starred');
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Star className="h-4 w-4" />
                  Show starred only
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search Bar */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search emails..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-colors"
        />
      </div>

      {/* Filter Dropdown */}
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <span>{currentFilterLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {showFilterMenu && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onFilterChange(f.id);
                  setShowFilterMenu(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors',
                  filter === f.id ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
