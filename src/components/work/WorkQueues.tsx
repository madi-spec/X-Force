'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Inbox,
  Ticket,
  Calendar,
  MessageSquare,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  HeartHandshake,
  Target,
  Rocket,
} from 'lucide-react';
import { useLens, LensType } from '@/lib/lens';

interface QueueItem {
  id: string;
  title?: string;
  subject?: string;
  name?: string;
  status?: string;
  priority_score?: number;
  severity?: string;
  company?: { id: string; name: string } | null;
  created_at?: string;
  opened_at?: string;
  received_at?: string;
}

interface WorkQueuesProps {
  queues: {
    commandCenter: QueueItem[];
    supportCases: QueueItem[];
    schedulerRequests: QueueItem[];
    responseQueue: QueueItem[];
  };
}

type QueueType = 'all' | 'commandCenter' | 'supportCases' | 'scheduler' | 'responses';

const queueConfig = {
  commandCenter: {
    label: 'Action Items',
    icon: Inbox,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    href: '/ai',
  },
  supportCases: {
    label: 'Support Cases',
    icon: Ticket,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    href: '/cases',
  },
  scheduler: {
    label: 'Scheduling',
    icon: Calendar,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    href: '/scheduler',
  },
  responses: {
    label: 'Responses Needed',
    icon: MessageSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    href: '/communications',
  },
};

function QueueCard({
  type,
  items,
  config,
}: {
  type: string;
  items: QueueItem[];
  config: typeof queueConfig.commandCenter;
}) {
  const Icon = config.icon;
  const urgentCount = items.filter(
    (i) => i.priority_score && i.priority_score > 80 || i.severity === 'critical' || i.severity === 'urgent'
  ).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{config.label}</h3>
              <p className="text-xs text-gray-500">
                {items.length} items{urgentCount > 0 && ` (${urgentCount} urgent)`}
              </p>
            </div>
          </div>
          <Link
            href={config.href}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {items.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">All caught up!</p>
          </div>
        ) : (
          items.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`${config.href}/${item.id}`}
              className="block p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title || item.subject || item.name || 'Untitled'}
                  </p>
                  {item.company?.name && (
                    <p className="text-xs text-gray-500 truncate">{item.company.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(item.priority_score && item.priority_score > 80) ||
                  item.severity === 'critical' ||
                  item.severity === 'urgent' ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {items.length > 5 && (
        <div className="p-3 bg-gray-50 text-center">
          <Link
            href={config.href}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            +{items.length - 5} more items
          </Link>
        </div>
      )}
    </div>
  );
}

// Map queue types to lens default queue keys
const queueToLensKey: Record<QueueType, string> = {
  all: 'all',
  commandCenter: 'commandCenter',
  supportCases: 'supportCases',
  scheduler: 'scheduler',
  responses: 'responses',
};

// Get default filter based on lens
function getDefaultFilterForLens(lens: LensType): QueueType {
  // Map lens to its primary queue focus
  const lensToDefaultQueue: Record<LensType, QueueType> = {
    focus: 'all', // Focus lens sees everything
    customer_success: 'all', // CS sees all but emphasizes responses & command center
    sales: 'all', // Sales sees all but emphasizes command center & scheduler
    onboarding: 'scheduler', // Onboarding focuses on scheduling
    support: 'supportCases', // Support focuses on support cases
  };
  return lensToDefaultQueue[lens];
}

// Lens-specific page titles
const lensPageTitles: Record<LensType, { title: string; subtitle: string }> = {
  focus: {
    title: 'All Work',
    subtitle: 'Complete view of all tasks across all areas',
  },
  customer_success: {
    title: 'CS Work Queue',
    subtitle: 'Customer engagement and retention tasks',
  },
  sales: {
    title: 'Sales Work Queue',
    subtitle: 'Pipeline and deal progression tasks',
  },
  onboarding: {
    title: 'Onboarding Queue',
    subtitle: 'Activation and training tasks',
  },
  support: {
    title: 'Support Queue',
    subtitle: 'Issue resolution and SLA tasks',
  },
};

export function WorkQueues({ queues }: WorkQueuesProps) {
  const { currentLens, config } = useLens();
  const [activeFilter, setActiveFilter] = useState<QueueType>('all');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Set default filter based on lens on initial load
  useEffect(() => {
    if (!hasInitialized) {
      setActiveFilter(getDefaultFilterForLens(currentLens));
      setHasInitialized(true);
    }
  }, [currentLens, hasInitialized]);

  const totalItems =
    queues.commandCenter.length +
    queues.supportCases.length +
    queues.schedulerRequests.length +
    queues.responseQueue.length;

  // Determine which queues are emphasized for this lens
  const isQueueEmphasized = (queueKey: string): boolean => {
    return config.defaultQueues.includes(queueKey as typeof config.defaultQueues[number]);
  };

  const filters: { key: QueueType; label: string; count: number; emphasized: boolean }[] = [
    { key: 'all', label: 'All Queues', count: totalItems, emphasized: true },
    { key: 'commandCenter', label: 'Action Items', count: queues.commandCenter.length, emphasized: isQueueEmphasized('commandCenter') },
    { key: 'supportCases', label: 'Support', count: queues.supportCases.length, emphasized: isQueueEmphasized('supportCases') },
    { key: 'scheduler', label: 'Scheduling', count: queues.schedulerRequests.length, emphasized: isQueueEmphasized('scheduler') },
    { key: 'responses', label: 'Responses', count: queues.responseQueue.length, emphasized: isQueueEmphasized('responses') },
  ];

  const pageTitle = lensPageTitles[currentLens];
  const LensIcon = currentLens === 'customer_success' ? HeartHandshake :
                   currentLens === 'sales' ? Target :
                   currentLens === 'onboarding' ? Rocket : Ticket;

  return (
    <div>
      {/* Header with lens context */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
            <LensIcon className={cn('h-4 w-4', config.color)} />
          </div>
          <h1 className="text-xl font-normal text-gray-900">{pageTitle.title}</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {pageTitle.subtitle} · {totalItems} items
        </p>
      </div>

      {/* Filters - emphasized queues shown first with visual distinction */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeFilter === filter.key
                ? 'bg-gray-900 text-white'
                : filter.emphasized
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 opacity-75'
            )}
          >
            {filter.label}
            <span className="ml-2 text-xs opacity-75">({filter.count})</span>
          </button>
        ))}
      </div>

      {/* Queue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(activeFilter === 'all' || activeFilter === 'commandCenter') && (
          <QueueCard
            type="commandCenter"
            items={queues.commandCenter}
            config={queueConfig.commandCenter}
          />
        )}
        {(activeFilter === 'all' || activeFilter === 'supportCases') && (
          <QueueCard
            type="supportCases"
            items={queues.supportCases}
            config={queueConfig.supportCases}
          />
        )}
        {(activeFilter === 'all' || activeFilter === 'scheduler') && (
          <QueueCard
            type="scheduler"
            items={queues.schedulerRequests}
            config={queueConfig.scheduler}
          />
        )}
        {(activeFilter === 'all' || activeFilter === 'responses') && (
          <QueueCard
            type="responses"
            items={queues.responseQueue}
            config={queueConfig.responses}
          />
        )}
      </div>

      {/* Next TODOs */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Next TODOs for Work Page</h3>
        <ul className="text-xs text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-gray-400">1.</span>
            Add drag-and-drop prioritization within queues
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">2.</span>
            Implement quick actions (snooze, delegate, complete) without leaving page
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">3.</span>
            Add real-time updates via Supabase subscriptions
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">4.</span>
            Add keyboard shortcuts for power users (j/k navigation, enter to open)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">5.</span>
            Integrate AI-suggested next actions per queue item
          </li>
        </ul>
      </div>
    </div>
  );
}
