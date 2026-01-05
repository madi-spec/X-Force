# Communication Hub: Phase 3 - Daily Driver UIs

## Overview

Phase 1 created tables + backfill. Phase 2 added AI analysis. Phase 3 builds the UIs that make the team use this **every single day**.

**The Goal:** These aren't just "views" - they're accountability tools that create urgency and prevent things from falling through cracks.

---

## The Daily Drivers

| Component | Question It Answers | Why They'll Use It |
|-----------|--------------------|--------------------|
| **Response Queue** | "Who's waiting on ME?" | Guilt-driven accountability |
| **Promises Tracker** | "What did I commit to?" | Never forget, look reliable |
| **AI Activity Feed** | "What did AI do?" | Trust through transparency |

---

## Phase 3 Tasks

### Task 1: Response Queue Component

Create `src/components/communications/ResponseQueue.tsx`:

```tsx
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

function getUrgencyColor(item: ResponseQueueItem, category: string): string {
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
    <div className={`border-l-4 rounded-lg p-4 mb-3 ${getUrgencyColor(item, category)}`}>
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
  
  const handleMarkResponded = async (communicationId: string) => {
    // Mark as responded
    await fetch(`/api/communications/${communicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        awaiting_our_response: false,
        responded_at: new Date().toISOString()
      }),
    });
    mutate();
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
```

### Task 2: Promises Tracker Component

Create `src/components/communications/PromisesTracker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow, format } from 'date-fns';
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
    occurred_at: string 
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
```

### Task 3: AI Activity Feed Component

Create `src/components/communications/AIActivityFeed.tsx`:

```tsx
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
  AlertCircle,
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
              AI {activity.ai_action_type}
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
```

### Task 4: Export Index File

Create `src/components/communications/index.ts`:

```typescript
export { ResponseQueue } from './ResponseQueue';
export { PromisesTracker } from './PromisesTracker';
export { AIActivityFeed } from './AIActivityFeed';
```

### Task 5: Fix Communications API for Joins

Update `src/app/api/communications/route.ts` to handle join ambiguity:

Find and update the select query to use explicit foreign key references:

```typescript
// Replace the existing select with explicit FK references
.select(`
  *,
  company:companies!company_id(id, name, domain),
  contact:contacts!contact_id(id, name, email),
  deal:deals!deal_id(id, name, stage, value),
  current_analysis:communication_analysis!current_analysis_id(*)
`, { count: 'exact' })
```

### Task 6: Create Dashboard Integration Page

Create `src/app/(dashboard)/communications/page.tsx`:

```tsx
import { ResponseQueue } from '@/components/communications/ResponseQueue';
import { PromisesTracker } from '@/components/communications/PromisesTracker';
import { AIActivityFeed } from '@/components/communications/AIActivityFeed';

export default function CommunicationsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Communications Hub</h1>
        <p className="text-gray-500">Your daily accountability center</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Response Queue - Most Important */}
        <div className="lg:col-span-2">
          <ResponseQueue />
        </div>
        
        {/* AI Activity */}
        <div>
          <AIActivityFeed />
        </div>
        
        {/* Promises - We Owe */}
        <div>
          <PromisesTracker direction="we_promised" />
        </div>
        
        {/* Promises - They Owe */}
        <div>
          <PromisesTracker direction="they_promised" />
        </div>
        
        {/* AI Activity takes remaining space */}
        <div className="lg:col-span-1">
          {/* Could add more components here */}
        </div>
      </div>
    </div>
  );
}
```

### Task 7: Add Navigation Link

Add a link to the Communications Hub in your sidebar/navigation. Find your navigation component and add:

```tsx
{
  name: 'Communications',
  href: '/communications',
  icon: MessageSquare, // from lucide-react
}
```

---

## Verification

After implementation:

1. **Start dev server:**
```bash
npm run dev
```

2. **Navigate to /communications:**
- Response Queue should show items awaiting response
- Promises Tracker should show promises (switch tabs for We Owe / They Owe)
- AI Activity Feed should show AI-generated communications

3. **Test interactions:**
- Click "Respond" on a Response Queue item
- Click checkbox to mark a promise complete
- Switch between tabs/filters

4. **Check console for errors**

---

## Success Criteria

- [ ] ResponseQueue component renders with overdue/due soon/upcoming sections
- [ ] PromisesTracker component renders with tabs (We Owe / They Owe)
- [ ] PromisesTracker allows marking promises complete
- [ ] AIActivityFeed component renders with filter tabs
- [ ] /communications page shows all three components
- [ ] No console errors
- [ ] TypeScript compiles clean

---

## Visual Result

The /communications page should look like:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Communications Hub                                                          │
│ Your daily accountability center                                            │
├─────────────────────────────────────────────────┬───────────────────────────┤
│                                                 │                           │
│  ⏰ WAITING ON YOU                    3 items   │  🤖 AI ACTIVITY           │
│  ─────────────────────────────────────────────  │  ─────────────────────────│
│                                                 │                           │
│  🔴 OVERDUE (1)                                 │  [All] [Awaiting] [Replied]│
│  ┌───────────────────────────────────────────┐  │                           │
│  │ Ramsey Cole (Happinest)         4h overdue│  │  📤 Scheduling → Ramsey   │
│  │ "Can you send the timeline?"              │  │     Awaiting • 4h ago     │
│  └───────────────────────────────────────────┘  │                           │
│                                                 │  ✅ Follow-up → Marcus    │
│  🟡 DUE SOON (2)                                │     Replied • 2h ago      │
│  ...                                            │                           │
│                                                 │                           │
├─────────────────────────────────────────────────┼───────────────────────────┤
│                                                 │                           │
│  📝 PROMISES: WE OWE                            │  📝 PROMISES: THEY OWE    │
│  ─────────────────────────────────────────────  │  ─────────────────────────│
│                                                 │                           │
│  ▼ Overdue (2)                                  │  ▼ No Due Date (15)       │
│    ☐ Send revised timeline - Happinest         │    ☐ Internal review...   │
│    ☐ Connect reference - Triangle              │    ☐ Evaluate proposal... │
│                                                 │                           │
│  ▼ Due Today (1)                                │                           │
│    ☐ Send ROI calculator - Pest Authority      │                           │
│                                                 │                           │
└─────────────────────────────────────────────────┴───────────────────────────┘
```
