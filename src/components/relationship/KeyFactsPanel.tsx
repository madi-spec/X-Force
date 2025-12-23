'use client';

import { useState } from 'react';
import { Lightbulb, Mail, FileText, StickyNote, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { KeyFact } from '@/lib/intelligence/relationshipStore';

interface KeyFactsPanelProps {
  facts: KeyFact[];
  maxVisible?: number;
}

const sourceIcons: Record<string, React.ElementType> = {
  email: Mail,
  transcript: FileText,
  note: StickyNote,
  research: Search,
};

const sourceColors: Record<string, string> = {
  email: 'text-blue-500 bg-blue-50',
  transcript: 'text-purple-500 bg-purple-50',
  note: 'text-yellow-500 bg-yellow-50',
  research: 'text-green-500 bg-green-50',
};

export function KeyFactsPanel({ facts, maxVisible = 8 }: KeyFactsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter facts by search
  const filteredFacts = facts.filter(
    (f) =>
      f.fact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show limited or all based on expansion
  const visibleFacts = isExpanded
    ? filteredFacts
    : filteredFacts.slice(0, maxVisible);

  const hasMore = filteredFacts.length > maxVisible;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h3 className="font-medium text-gray-900">
            Key Facts ({facts.length})
          </h3>
        </div>
        {facts.length > 5 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search facts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Facts List */}
      {visibleFacts.length > 0 ? (
        <div className="space-y-3">
          {visibleFacts.map((fact, index) => {
            const Icon = sourceIcons[fact.source] || Lightbulb;
            const colorClass = sourceColors[fact.source] || 'text-gray-500 bg-gray-50';

            return (
              <div
                key={`${fact.source_id}-${index}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={cn('p-1.5 rounded-lg', colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {fact.fact}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    From {fact.source} • {formatDate(fact.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-4">
          {searchQuery
            ? 'No facts match your search.'
            : 'No key facts learned yet. Facts will be extracted from emails and meetings.'}
        </p>
      )}

      {/* Show More/Less Button */}
      {hasMore && !searchQuery && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {filteredFacts.length - maxVisible} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
