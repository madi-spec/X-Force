'use client';

import { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import type { BuyingSignal, Concern, Objection } from '@/lib/intelligence/relationshipStore';

interface SignalsPanelProps {
  buyingSignals: BuyingSignal[];
  concerns: Concern[];
  objections?: Objection[];
}

const strengthColors: Record<string, string> = {
  strong: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-blue-100 text-blue-700 border-blue-200',
  weak: 'bg-gray-100 text-gray-700 border-gray-200',
};

const severityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const outcomeColors: Record<string, string> = {
  overcome: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  blocker: 'bg-red-100 text-red-700',
};

export function SignalsPanel({
  buyingSignals,
  concerns,
  objections = [],
}: SignalsPanelProps) {
  const [activeTab, setActiveTab] = useState<'signals' | 'concerns' | 'objections'>('signals');
  const [isExpanded, setIsExpanded] = useState(false);

  // Counts
  const unresolvedConcerns = concerns.filter((c) => !c.resolved);
  const pendingObjections = objections.filter((o) => o.outcome === 'pending');

  // Max items to show
  const maxVisible = 5;

  const renderBuyingSignals = () => {
    const visibleSignals = isExpanded ? buyingSignals : buyingSignals.slice(0, maxVisible);

    return (
      <div className="space-y-2">
        {visibleSignals.length > 0 ? (
          visibleSignals.map((signal, index) => (
            <div
              key={`signal-${signal.source_id}-${index}`}
              className="p-3 rounded-lg bg-green-50 border border-green-100"
            >
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {signal.signal}
                  </p>
                  {signal.quote && (
                    <p className="text-xs text-gray-600 mt-1 italic">
                      "{signal.quote}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border',
                        strengthColors[signal.strength]
                      )}
                    >
                      {signal.strength}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(signal.date)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic text-center py-4">
            No buying signals detected yet.
          </p>
        )}
        {buyingSignals.length > maxVisible && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Show {buyingSignals.length - maxVisible} more
          </button>
        )}
      </div>
    );
  };

  const renderConcerns = () => {
    const visibleConcerns = isExpanded ? concerns : concerns.slice(0, maxVisible);

    return (
      <div className="space-y-2">
        {visibleConcerns.length > 0 ? (
          visibleConcerns.map((concern, index) => (
            <div
              key={`concern-${concern.source_id}-${index}`}
              className={cn(
                'p-3 rounded-lg border',
                concern.resolved
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-orange-50 border-orange-100'
              )}
            >
              <div className="flex items-start gap-3">
                {concern.resolved ? (
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm',
                      concern.resolved
                        ? 'text-gray-500 line-through'
                        : 'text-gray-900'
                    )}
                  >
                    {concern.concern}
                  </p>
                  {concern.resolved && concern.resolution && (
                    <p className="text-xs text-green-600 mt-1">
                      Resolved: {concern.resolution}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {!concern.resolved && (
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          severityColors[concern.severity]
                        )}
                      >
                        {concern.severity}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(concern.date)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic text-center py-4">
            No concerns detected.
          </p>
        )}
        {concerns.length > maxVisible && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Show {concerns.length - maxVisible} more
          </button>
        )}
      </div>
    );
  };

  const renderObjections = () => {
    const visibleObjections = isExpanded ? objections : objections.slice(0, maxVisible);

    return (
      <div className="space-y-2">
        {visibleObjections.length > 0 ? (
          visibleObjections.map((objection, index) => (
            <div
              key={`objection-${objection.source_id}-${index}`}
              className="p-3 rounded-lg bg-purple-50 border border-purple-100"
            >
              <div className="flex items-start gap-3">
                <MessageSquare className="w-4 h-4 text-purple-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-medium">
                    "{objection.objection}"
                  </p>
                  {objection.response_given && (
                    <p className="text-xs text-gray-600 mt-1">
                      Response: {objection.response_given}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        outcomeColors[objection.outcome]
                      )}
                    >
                      {objection.outcome}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(objection.date)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic text-center py-4">
            No objections recorded.
          </p>
        )}
        {objections.length > maxVisible && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Show {objections.length - maxVisible} more
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header with tabs */}
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
        <button
          onClick={() => {
            setActiveTab('signals');
            setIsExpanded(false);
          }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'signals'
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <TrendingUp className="w-4 h-4" />
          Buying Signals ({buyingSignals.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('concerns');
            setIsExpanded(false);
          }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'concerns'
              ? 'bg-orange-100 text-orange-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          Concerns ({unresolvedConcerns.length}/{concerns.length})
        </button>
        {objections.length > 0 && (
          <button
            onClick={() => {
              setActiveTab('objections');
              setIsExpanded(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'objections'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Objections ({pendingObjections.length}/{objections.length})
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'signals' && renderBuyingSignals()}
      {activeTab === 'concerns' && renderConcerns()}
      {activeTab === 'objections' && renderObjections()}

      {isExpanded && (
        <button
          onClick={() => setIsExpanded(false)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronUp className="w-4 h-4" />
          Show less
        </button>
      )}
    </div>
  );
}
