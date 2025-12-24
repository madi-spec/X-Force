'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { Mail, Phone, MessageSquare, Clock, AlertCircle, CheckCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ResponseQueueItem {
  id: string;
  channel: string;
  subject: string | null;
  content_preview: string | null;
  occurred_at: string;
  response_due_by: string | null;
  hours_overdue?: number;
  hours_remaining?: number;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
}

interface ResponseQueueData {
  response_queue: {
    overdue: ResponseQueueItem[];
    due_soon: ResponseQueueItem[];
    upcoming: ResponseQueueItem[];
  };
  total: number;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  sms: MessageSquare,
  meeting: Phone,
};

function getUrgencyColor(category: string): string {
  if (category === 'overdue') return 'border-l-red-500 bg-red-50';
  if (category === 'due_soon') return 'border-l-yellow-500 bg-yellow-50';
  return 'border-l-green-500 bg-green-50';
}

function getUrgencyBadge(category: string): React.ReactNode {
  if (category === 'overdue') {
    return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">OVERDUE</span>;
  }
  if (category === 'due_soon') {
    return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">DUE SOON</span>;
  }
  return null;
}

function ResponseQueueCard({
  item,
  category,
  onRespond
}: {
  item: ResponseQueueItem;
  category: string;
  onRespond: (id: string) => void;
}) {
  const Icon = channelIcons[item.channel] || Mail;

  return (
    <div className={`border-l-4 rounded-lg p-4 mb-3 ${getUrgencyColor(category)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">
                {item.contact?.name || item.company?.name || 'Unknown'}
              </span>
              {item.company && item.contact && (
                <span className="text-gray-500 text-sm">
                  ({item.company.name})
                </span>
              )}
              {getUrgencyBadge(category)}
            </div>

            {item.subject && (
              <p className="text-sm font-medium text-gray-700 truncate mb-1">
                {item.subject}
              </p>
            )}

            {item.content_preview && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {item.content_preview}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Received {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })}
              </span>

              {category === 'overdue' && item.hours_overdue && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {item.hours_overdue.toFixed(1)}h overdue
                </span>
              )}

              {category === 'due_soon' && item.hours_remaining !== undefined && (
                <span className="flex items-center gap-1 text-yellow-600 font-medium">
                  <Clock className="w-3 h-3" />
                  {item.hours_remaining.toFixed(1)}h remaining
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onRespond(item.id)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Respond
        </button>
      </div>
    </div>
  );
}

export function ResponseQueue({ userId }: { userId?: string }) {
  const { data, error, isLoading, mutate } = useSWR<ResponseQueueData>(
    `/api/communications/response-queue${userId ? `?user_id=${userId}` : ''}`,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  const handleRespond = async (communicationId: string) => {
    // Open the communication detail or compose response
    // For now, just navigate to the communication
    window.open(`/communications/${communicationId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-24 bg-gray-100 rounded"></div>
            <div className="h-24 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm">
        <p className="text-red-600">Failed to load response queue</p>
      </div>
    );
  }

  const queue = data?.response_queue;
  const total = data?.total || 0;
  const overdueCount = queue?.overdue?.length || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${overdueCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
            {overdueCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Waiting on You
            </h2>
            <p className="text-sm text-gray-500">
              {total} {total === 1 ? 'person' : 'people'} waiting for a response
            </p>
          </div>
        </div>

        {overdueCount > 0 && (
          <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full">
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* Queue Items */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {total === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">All caught up!</p>
            <p className="text-sm text-gray-500">No one is waiting on you right now.</p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {queue?.overdue && queue.overdue.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  OVERDUE ({queue.overdue.length})
                </h3>
                {queue.overdue.map(item => (
                  <ResponseQueueCard
                    key={item.id}
                    item={item}
                    category="overdue"
                    onRespond={handleRespond}
                  />
                ))}
              </div>
            )}

            {/* Due Soon */}
            {queue?.due_soon && queue.due_soon.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-yellow-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  DUE SOON ({queue.due_soon.length})
                </h3>
                {queue.due_soon.map(item => (
                  <ResponseQueueCard
                    key={item.id}
                    item={item}
                    category="due_soon"
                    onRespond={handleRespond}
                  />
                ))}
              </div>
            )}

            {/* Upcoming */}
            {queue?.upcoming && queue.upcoming.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3">
                  UPCOMING ({queue.upcoming.length})
                </h3>
                {queue.upcoming.map(item => (
                  <ResponseQueueCard
                    key={item.id}
                    item={item}
                    category="upcoming"
                    onRespond={handleRespond}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
