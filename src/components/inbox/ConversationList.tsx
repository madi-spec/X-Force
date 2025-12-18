'use client';

import { useState } from 'react';
import { Search, Archive, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationListItem } from './ConversationListItem';
import type { Conversation, ConversationStatus } from './types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  onRefresh,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');

  const filteredConversations = conversations.filter((conv) => {
    // Status filter - 'active' means pending or awaiting_response (not snoozed/archived/ignored)
    if (statusFilter === 'active') {
      if (conv.status !== 'pending' && conv.status !== 'awaiting_response') {
        return false;
      }
    } else if (statusFilter !== 'all' && conv.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSubject = conv.subject?.toLowerCase().includes(searchLower);
      const matchesParticipant = (conv.participants || []).some(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.address.toLowerCase().includes(searchLower)
      );
      const matchesSummary = conv.ai_summary?.toLowerCase().includes(searchLower);
      const matchesDeal = conv.deal?.name?.toLowerCase().includes(searchLower);
      const matchesCompany = conv.company?.name?.toLowerCase().includes(searchLower);

      if (!matchesSubject && !matchesParticipant && !matchesSummary && !matchesDeal && !matchesCompany) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Search and filters */}
      <div className="px-2 py-2 border-b border-gray-200 space-y-1.5">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Quick filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setStatusFilter('active')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                statusFilter === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('snoozed')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                statusFilter === 'snoozed'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              Snoozed
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={cn(
                'flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                statusFilter === 'archived'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <Archive className="h-2.5 w-2.5" />
              Archived
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              All
            </button>
          </div>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          // Loading skeleton
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div className="p-8 text-center">
            <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">
              {search
                ? 'No conversations match your search'
                : statusFilter === 'archived'
                ? 'No archived conversations'
                : statusFilter === 'snoozed'
                ? 'No snoozed conversations'
                : 'No conversations'}
            </p>
          </div>
        ) : (
          // Conversation list
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onSelect={() => onSelect(conversation)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50/50 text-[10px] text-gray-400">
        {filteredConversations.length} of {conversations.length}
      </div>
    </div>
  );
}
