'use client';

import { useState, useEffect } from 'react';
import { useLens } from '@/lib/lens';
import { CustomerHubHeader } from './CustomerHubHeader';
import { CustomerHubTabs } from './CustomerHubTabs';
import { CustomerHubTab, CustomerHubData } from './types';
import {
  OverviewTab,
  SalesTab,
  OnboardingTab,
  EngagementTab,
  SupportTab,
  TimelineTab,
  ConversationsTab,
  MeetingsTab,
} from './tabs';

interface CustomerHubProps {
  data: CustomerHubData;
  isLoading?: boolean;
  /** Initial tab from URL params (overrides lens default) */
  initialTab?: CustomerHubTab;
  /** Source Work item ID for context preservation */
  sourceWorkItemId?: string;
}

function CustomerHubSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-gray-200 rounded-lg" />
            <div className="h-8 w-24 bg-gray-200 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-20 bg-gray-200 rounded-full" />
          ))}
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-4 w-20 bg-gray-200 rounded mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerHub({ data, isLoading, initialTab, sourceWorkItemId }: CustomerHubProps) {
  const { config: lensConfig } = useLens();

  // Priority: initialTab (from URL) > lens default
  const defaultTab = initialTab || (lensConfig.defaultCustomerTab as CustomerHubTab);
  const [activeTab, setActiveTab] = useState<CustomerHubTab>(defaultTab);

  // Update default tab when lens changes (only if no explicit initialTab)
  useEffect(() => {
    if (!initialTab) {
      setActiveTab(lensConfig.defaultCustomerTab as CustomerHubTab);
    }
  }, [lensConfig.defaultCustomerTab, initialTab]);

  if (isLoading) {
    return <CustomerHubSkeleton />;
  }

  // Calculate tab counts for badges
  const tabCounts: Partial<Record<CustomerHubTab, number>> = {
    sales: data.companyProducts.filter(p => p.status === 'in_sales').length,
    onboarding: data.companyProducts.filter(p => p.status === 'in_onboarding').length,
    support: data.supportCases.filter(c => !['resolved', 'closed'].includes(c.status)).length,
    meetings: data.meetings.length,
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={data} />;
      case 'sales':
        return <SalesTab data={data} />;
      case 'onboarding':
        return <OnboardingTab data={data} />;
      case 'engagement':
        return <EngagementTab data={data} />;
      case 'support':
        return <SupportTab data={data} />;
      case 'timeline':
        return <TimelineTab data={data} />;
      case 'conversations':
        return <ConversationsTab data={data} />;
      case 'meetings':
        return <MeetingsTab data={data} />;
      default:
        return <OverviewTab data={data} />;
    }
  };

  return (
    <div className="space-y-6">
      <CustomerHubHeader data={data} />
      <CustomerHubTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />
      {renderTabContent()}
    </div>
  );
}
