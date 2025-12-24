'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import {
  Bot,
  Mail,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AIActivity {
  id: string;
  channel: string;
  ai_action_type: string;
  subject: string | null;
  content_preview: string | null;
  occurred_at: string;
  email_opened_at: string | null;
  email_replied_at: string | null;
  awaiting_their_response: boolean;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case 'scheduling':
      return Calendar;
    case 'follow_up':
      return Mail;
    case 'reminder':
      return Clock;
    default:
      return Bot;
  }
}

function getStatusBadge(activity: AIActivity): { label: string; color: string; icon: React.ElementType } {
  if (activity.email_replied_at) {
    return { label: 'Replied', color: 'bg-green-100 text-green-700', icon: CheckCircle };
  }
  if (activity.email_opened_at) {
    return { label: 'Opened', color: 'bg-blue-100 text-blue-700', icon: Mail };
  }
  if (activity.awaiting_their_response) {
    return { label: 'Awaiting Response', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  }
  return { label: 'Sent', color: 'bg-gray-100 text-gray-600', icon: Mail };
}

function AIActivityCard({ activity }: { activity: AIActivity }) {
  const ActionIcon = getActionIcon(activity.ai_action_type);
  const status = getStatusBadge(activity);
  const StatusIcon = status.icon;

  return (
    <div className="border rounded-lg p-4 mb-3 bg-white">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <ActionIcon className="w-4 h-4 text-purple-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              AI {activity.ai_action_type || 'action'}
            </span>
            <span className="text-gray-500">→</span>
            <span className="text-gray-700">
              {activity.contact?.name || activity.company?.name || 'Unknown'}
            </span>
          </div>

          {activity.subject && (
            <p className="text-sm text-gray-600 mb-2 truncate">
              {activity.subject}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs">
            <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>

            <span className="text-gray-500">
              {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
            </span>

            <a
              href={`/communications/${activity.id}`}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIActivityFeed({ userId }: { userId?: string }) {
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'successful'>('all');

  const { data, error, isLoading, mutate } = useSWR(
    `/api/communications?ai_only=true&limit=50${userId ? `&user_id=${userId}` : ''}`,
    fetcher,
    { refreshInterval: 60000 }
  );

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

  const activities: AIActivity[] = data?.communications || [];

  // Filter activities
  const filteredActivities = activities.filter(a => {
    if (filter === 'awaiting') return a.awaiting_their_response && !a.email_replied_at;
    if (filter === 'successful') return a.email_replied_at;
    return true;
  });

  // Stats
  const awaitingCount = activities.filter(a => a.awaiting_their_response && !a.email_replied_at).length;
  const repliedCount = activities.filter(a => a.email_replied_at).length;
  const successRate = activities.length > 0
    ? ((repliedCount / activities.length) * 100).toFixed(0)
    : '0';

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AI Activity
              </h2>
              <p className="text-sm text-gray-500">
                {activities.length} AI actions • {successRate}% reply rate
              </p>
            </div>
          </div>

          <button
            onClick={() => mutate()}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({activities.length})
          </button>
          <button
            onClick={() => setFilter('awaiting')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'awaiting'
                ? 'bg-yellow-100 text-yellow-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Awaiting ({awaitingCount})
          </button>
          <button
            onClick={() => setFilter('successful')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === 'successful'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Replied ({repliedCount})
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No AI activity</p>
            <p className="text-sm text-gray-500">
              AI-sent communications will appear here
            </p>
          </div>
        ) : (
          filteredActivities.map(activity => (
            <AIActivityCard key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}
