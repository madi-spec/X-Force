'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  EyeOff,
  Check
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Promise {
  id: string;
  direction: 'we_promised' | 'they_promised';
  promise_text: string;
  promised_at: string;
  due_by: string | null;
  status: string;
  confidence: number;
  days_overdue?: number;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
  source_communication: {
    id: string;
    channel: string;
    subject: string;
    occurred_at: string;
  } | null;
  owner_name: string | null;
  promiser_name: string | null;
}

interface PromisesData {
  promises: {
    overdue: Promise[];
    due_today: Promise[];
    due_this_week: Promise[];
    upcoming: Promise[];
    no_due_date: Promise[];
    completed: Promise[];
  };
  counts: Record<string, number>;
  total: number;
}

function PromiseCard({
  promise,
  category,
  onComplete,
  onHide
}: {
  promise: Promise;
  category: string;
  onComplete: (id: string) => void;
  onHide: (id: string) => void;
}) {
  const isOverdue = category === 'overdue';
  const isDueToday = category === 'due_today';

  return (
    <div className={`border rounded-lg p-4 mb-2 ${
      isOverdue ? 'border-red-200 bg-red-50' :
      isDueToday ? 'border-yellow-200 bg-yellow-50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(promise.id)}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            promise.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {promise.status === 'completed' && (
            <Check className="w-3 h-3 text-white" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className={`font-medium ${
                promise.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
              }`}>
                {promise.promise_text}
              </p>

              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                {promise.company && (
                  <span>{promise.company.name}</span>
                )}
                {promise.direction === 'we_promised' && promise.owner_name && (
                  <span>• Owner: {promise.owner_name}</span>
                )}
                {promise.direction === 'they_promised' && promise.promiser_name && (
                  <span>• From: {promise.promiser_name}</span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {promise.due_by && (
                  <span className={`flex items-center gap-1 ${
                    isOverdue ? 'text-red-600 font-medium' : ''
                  }`}>
                    <Clock className="w-3 h-3" />
                    {isOverdue
                      ? `${promise.days_overdue?.toFixed(0)} days overdue`
                      : `Due ${format(new Date(promise.due_by), 'MMM d')}`
                    }
                  </span>
                )}

                {promise.source_communication && (
                  <a
                    href={`/communications/${promise.source_communication.id}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View source
                  </a>
                )}

                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  promise.confidence >= 0.85 ? 'bg-green-100 text-green-700' :
                  promise.confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {(promise.confidence * 100).toFixed(0)}% conf
                </span>
              </div>
            </div>

            <button
              onClick={() => onHide(promise.id)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Hide this promise"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromiseSection({
  title,
  promises,
  category,
  icon: Icon,
  iconColor,
  defaultExpanded = true,
  onComplete,
  onHide
}: {
  title: string;
  promises: Promise[];
  category: string;
  icon: React.ElementType;
  iconColor: string;
  defaultExpanded?: boolean;
  onComplete: (id: string) => void;
  onHide: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (promises.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm font-medium text-gray-700">
          {title} ({promises.length})
        </span>
      </button>

      {expanded && (
        <div className="ml-6">
          {promises.map(promise => (
            <PromiseCard
              key={promise.id}
              promise={promise}
              category={category}
              onComplete={onComplete}
              onHide={onHide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PromisesTracker({
  userId,
  companyId,
  direction
}: {
  userId?: string;
  companyId?: string;
  direction?: 'we_promised' | 'they_promised';
}) {
  const [activeTab, setActiveTab] = useState<'we_promised' | 'they_promised'>(direction || 'we_promised');

  const queryParams = new URLSearchParams();
  if (userId) queryParams.set('user_id', userId);
  if (companyId) queryParams.set('company_id', companyId);
  queryParams.set('direction', activeTab);

  const { data, error, isLoading, mutate } = useSWR<PromisesData>(
    `/api/communications/promises?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const handleComplete = async (promiseId: string) => {
    await fetch('/api/communications/promises', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promise_id: promiseId, status: 'completed' }),
    });
    mutate();
  };

  const handleHide = async (promiseId: string) => {
    await fetch('/api/communications/promises', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promise_id: promiseId, is_hidden: true }),
    });
    mutate();
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const promises = data?.promises;
  const counts = data?.counts;
  const overdueCount = counts?.overdue || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Promises Tracker
          </h2>
          {overdueCount > 0 && (
            <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full">
              {overdueCount} overdue
            </span>
          )}
        </div>

        {/* Tabs */}
        {!direction && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('we_promised')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'we_promised'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              We Owe
            </button>
            <button
              onClick={() => setActiveTab('they_promised')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'they_promised'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              They Owe
            </button>
          </div>
        )}
      </div>

      {/* Promises List */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {data?.total === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No promises tracked</p>
            <p className="text-sm text-gray-500">
              {activeTab === 'we_promised'
                ? "You haven't made any commitments"
                : "They haven't made any commitments"
              }
            </p>
          </div>
        ) : (
          <>
            <PromiseSection
              title="Overdue"
              promises={promises?.overdue || []}
              category="overdue"
              icon={AlertTriangle}
              iconColor="text-red-500"
              onComplete={handleComplete}
              onHide={handleHide}
            />

            <PromiseSection
              title="Due Today"
              promises={promises?.due_today || []}
              category="due_today"
              icon={Clock}
              iconColor="text-yellow-500"
              onComplete={handleComplete}
              onHide={handleHide}
            />

            <PromiseSection
              title="Due This Week"
              promises={promises?.due_this_week || []}
              category="due_this_week"
              icon={Clock}
              iconColor="text-blue-500"
              onComplete={handleComplete}
              onHide={handleHide}
            />

            <PromiseSection
              title="Upcoming"
              promises={promises?.upcoming || []}
              category="upcoming"
              icon={Clock}
              iconColor="text-gray-400"
              defaultExpanded={false}
              onComplete={handleComplete}
              onHide={handleHide}
            />

            <PromiseSection
              title="No Due Date"
              promises={promises?.no_due_date || []}
              category="no_due_date"
              icon={Clock}
              iconColor="text-gray-400"
              defaultExpanded={false}
              onComplete={handleComplete}
              onHide={handleHide}
            />
          </>
        )}
      </div>
    </div>
  );
}
