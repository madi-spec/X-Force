'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLens } from '@/lib/lens';
import {
  LayoutDashboard,
  Target,
  Rocket,
  HeartHandshake,
  Ticket,
  Clock,
  MessageSquare,
  Video,
} from 'lucide-react';
import { CustomerHubTab } from './types';

interface CustomerHubTabsProps {
  activeTab: CustomerHubTab;
  onTabChange: (tab: CustomerHubTab) => void;
  counts?: {
    sales?: number;
    onboarding?: number;
    support?: number;
    meetings?: number;
  };
  className?: string;
}

const tabConfig: Record<CustomerHubTab, { label: string; icon: typeof LayoutDashboard }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  sales: { label: 'Sales', icon: Target },
  onboarding: { label: 'Onboarding', icon: Rocket },
  engagement: { label: 'Engagement', icon: HeartHandshake },
  support: { label: 'Support', icon: Ticket },
  timeline: { label: 'Timeline', icon: Clock },
  conversations: { label: 'Conversations', icon: MessageSquare },
  meetings: { label: 'Meetings', icon: Video },
};

export function CustomerHubTabs({
  activeTab,
  onTabChange,
  counts = {},
  className,
}: CustomerHubTabsProps) {
  const { config: lensConfig } = useLens();

  // Order tabs according to lens preference
  const orderedTabs = useMemo(() => {
    return lensConfig.tabOrder;
  }, [lensConfig.tabOrder]);

  return (
    <div className={cn('bg-white border-b border-gray-200', className)}>
      <div className="px-6">
        <nav className="flex gap-1 -mb-px">
          {orderedTabs.map((tabId) => {
            const tab = tabConfig[tabId];
            const isActive = activeTab === tabId;
            const count = counts[tabId as keyof typeof counts];
            const Icon = tab.icon;

            return (
              <button
                key={tabId}
                onClick={() => onTabChange(tabId)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs',
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
