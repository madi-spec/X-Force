'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { ActionCard, ActionCardCompact } from './ActionCard';
import { MeetingCard, MeetingList } from './MeetingCard';
import { DayCompleteView } from './DayCompleteView';
import { ExtraCreditPanel, ExtraCreditBackdrop } from './ExtraCreditPanel';
import { SchedulerPopout } from './SchedulerPopout';
import { EmailComposerPopout } from './EmailComposerPopout';
import { MeetingPrepPopout } from './MeetingPrepPopout';
import { LinkDealPopout } from './LinkDealPopout';
import { LinkCompanyPopout } from './LinkCompanyPopout';
import {
  DailyPlan,
  CommandCenterItem,
  GetDailyPlanResponse,
  TimeBlock,
  EnrichedCommandCenterItem,
  TIER_CONFIGS,
  PriorityTier,
} from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface YourDayViewProps {
  className?: string;
}

// ============================================
// MEETING HELPERS
// ============================================

function getMeetingsFromBlocks(timeBlocks: TimeBlock[]): TimeBlock[] {
  return timeBlocks.filter(block => block.type === 'meeting');
}

function getNextMeeting(meetings: TimeBlock[]): TimeBlock | null {
  const now = new Date();
  const upcomingMeetings = meetings
    .filter(m => new Date(m.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return upcomingMeetings[0] || null;
}

function getCurrentMeeting(meetings: TimeBlock[]): TimeBlock | null {
  const now = new Date();
  return meetings.find(m => {
    const start = new Date(m.start);
    const end = new Date(m.end);
    return now >= start && now <= end;
  }) || null;
}

function isAfterWorkHours(workEndTime: string, timezone: string): boolean {
  // Parse work end time (e.g., "17:00")
  const [endHour, endMinute] = workEndTime.split(':').map(Number);

  // Get current time in user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  const currentMinutes = currentHour * 60 + currentMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= endMinutes;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function YourDayView({ className }: YourDayViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const previewMode = searchParams.get('preview') === 'tomorrow';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GetDailyPlanResponse | null>(null);
  const [showLater, setShowLater] = useState(false);
  const [showMeetings, setShowMeetings] = useState(false);
  const [showExtraCredit, setShowExtraCredit] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Popout state
  const [schedulerItemId, setSchedulerItemId] = useState<string | null>(null);
  const [emailItemId, setEmailItemId] = useState<string | null>(null);
  const [meetingPrepId, setMeetingPrepId] = useState<string | null>(null);
  const [linkDealItemId, setLinkDealItemId] = useState<string | null>(null);
  const [linkCompanyItemId, setLinkCompanyItemId] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setError(null);

    try {
      // Add date parameter for tomorrow preview
      const url = previewMode
        ? '/api/command-center?date=tomorrow'
        : '/api/command-center';
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        console.error('[YourDayView] API Error:', result);
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || 'Failed to load command center';
        throw new Error(errorMsg);
      }

      setData(result);
    } catch (err) {
      console.error('[YourDayView] Error:', err);
      setError(err instanceof Error ? err.message : 'Unable to load your day plan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [previewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Action handlers
  const handleStart = async (id: string) => {
    await fetch(`/api/command-center/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    await fetchData();
  };

  const handleComplete = async (id: string) => {
    await fetch(`/api/command-center/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    setCompletedIds((prev) => new Set(prev).add(id));
    await fetchData();
  };

  const handleSnooze = async (id: string, until: string) => {
    await fetch(`/api/command-center/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'snoozed', snoozed_until: until }),
    });
    await fetchData();
  };

  const handleDismiss = async (id: string, reason?: string) => {
    await fetch(`/api/command-center/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', dismissed_reason: reason }),
    });
    await fetchData();
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-normal text-gray-900">Your Day</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">{error || 'Unable to load data'}</p>
          <button
            onClick={() => fetchData()}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const {
    plan,
    items,
    // New tier-grouped items
    tier1_items = [],
    tier2_items = [],
    tier3_items = [],
    tier4_items = [],
    tier5_items = [],
    // Legacy fields for backward compatibility
    current_item,
    next_items,
    at_risk_items,
    overflow_count,
    debug,
    is_work_day
  } = data;

  // Filter out completed items for display
  const pendingItems = items.filter((i) => !completedIds.has(i.id));
  const laterItems = pendingItems.slice(6); // Items after top 6

  // Filter completed from tier items
  const tier1Pending = tier1_items.filter(i => !completedIds.has(i.id));
  const tier2Pending = tier2_items.filter(i => !completedIds.has(i.id));
  const tier3Pending = tier3_items.filter(i => !completedIds.has(i.id));
  const tier4Pending = tier4_items.filter(i => !completedIds.has(i.id));
  const tier5Pending = tier5_items.filter(i => !completedIds.has(i.id));

  // Determine if we have urgent items (Tier 1)
  const hasTier1Items = tier1Pending.length > 0;

  // Check if after work hours - show Day Complete view
  const workEndTime = debug?.user_timezone ? '17:00' : '17:00'; // Default 5 PM
  const timezone = debug?.user_timezone || 'America/New_York';
  const afterHours = isAfterWorkHours(workEndTime, timezone);

  // Completed items stats
  const completedItems = items.filter(i => i.status === 'completed');
  const completedValue = completedItems.reduce((sum, item) => sum + (item.deal_value || 0), 0);
  const topWin = completedItems.reduce<CommandCenterItem | null>((best, item) => {
    if (!best) return item;
    return (item.deal_value || 0) > (best.deal_value || 0) ? item : best;
  }, null);

  // After hours view - show Day Complete at 5pm regardless of pending items
  // User decision: "Time-based only (5pm = done)"
  // Skip this check when previewing tomorrow
  if (afterHours && is_work_day !== false && !previewMode) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-gray-900">Your Day</h1>
            <p className="text-sm text-gray-500">
              {debug?.day_name}, {formatDate(plan.plan_date)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExtraCredit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Extra Credit
            </button>
            <button
              onClick={() => router.push('/command-center?preview=tomorrow')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Preview Next Day
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        <DayCompleteView
          completedCount={completedItems.length + completedIds.size}
          totalValue={completedValue}
          topWin={topWin}
          planDate={plan.plan_date}
        />

        {/* Extra Credit Panel - available even after hours */}
        {showExtraCredit && (
          <>
            <ExtraCreditBackdrop onClose={() => setShowExtraCredit(false)} />
            <ExtraCreditPanel
              overflowItems={items.filter(item => item.status === 'pending' && !completedIds.has(item.id))}
              onClose={() => setShowExtraCredit(false)}
              onAddItems={async () => {
                await fetchData();
              }}
            />
          </>
        )}
      </div>
    );
  }

  // Non-work day view
  if (is_work_day === false) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-gray-900">Your Day</h1>
            <p className="text-sm text-gray-500">
              {debug?.day_name}, {formatDate(plan.plan_date)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExtraCredit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Extra Credit
            </button>
            <button
              onClick={() => router.push('/command-center?preview=tomorrow')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Preview Next Day
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">It&apos;s the Weekend!</h3>
          <p className="text-gray-500 mb-4">
            Enjoy your time off. Your action queue will be ready when you return.
          </p>
          {items.length > 0 && (
            <p className="text-sm text-gray-400">
              {items.length} action{items.length !== 1 ? 's' : ''} waiting for your next work day
            </p>
          )}
        </div>

        {/* Extra Credit Panel - available even on weekends */}
        {showExtraCredit && (
          <>
            <ExtraCreditBackdrop onClose={() => setShowExtraCredit(false)} />
            <ExtraCreditPanel
              overflowItems={items.filter(item => item.status === 'pending' && !completedIds.has(item.id))}
              onClose={() => setShowExtraCredit(false)}
              onAddItems={async () => {
                await fetchData();
              }}
            />
          </>
        )}
      </div>
    );
  }

  // Get meetings for sidebar
  const allMeetings = getMeetingsFromBlocks(plan.time_blocks || []);

  return (
    <div className={cn('', className)}>
      {/* Header with Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {previewMode && (
            <button
              onClick={() => router.push('/command-center')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <div>
            <h1 className="text-xl font-normal text-gray-900">
              {previewMode ? 'Next Work Day' : 'Your Day'}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
              <span>{formatDate(plan.plan_date)}</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(plan.available_minutes)} available
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {getMeetingCount(plan)} meetings
              </span>
              {plan.total_potential_value > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-medium text-green-600">
                    ${formatCompactValue(plan.total_potential_value)} potential
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {items.filter(i => i.status === 'completed').length + completedIds.size} done · {pendingItems.length} to go
          </span>
          <button
            onClick={() => setShowExtraCredit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Extra Credit
          </button>
          {!previewMode && (
            <button
              onClick={() => router.push('/command-center?preview=tomorrow')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Preview Next Day
            </button>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Current Time Block Indicator */}
      {!previewMode && (() => {
        const currentBlock = getCurrentTimeBlock(plan.time_blocks || []);
        if (!currentBlock) return null;
        return (
          <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Currently: {formatTimeRange(currentBlock.start, currentBlock.end)}
              </span>
            </div>
            <div className="flex-1 h-1 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0,
                    ((Date.now() - new Date(currentBlock.start).getTime()) /
                     (new Date(currentBlock.end).getTime() - new Date(currentBlock.start).getTime())) * 100
                  ))}%`
                }}
              />
            </div>
            <span className="text-xs text-blue-600">
              {currentBlock.duration_minutes - Math.floor((Date.now() - new Date(currentBlock.start).getTime()) / 60000)}m left
            </span>
          </div>
        );
      })()}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left Column - Priority Tier Sections */}
        <div className="space-y-6">
          {/* All Caught Up state */}
          {pendingItems.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">All Caught Up!</h3>
              <p className="text-gray-500">
                No pending actions. Great job staying on top of things.
              </p>
            </div>
          )}

          {/* TIER 1: RESPOND NOW - Red, dominates when present */}
          {tier1Pending.length > 0 && (
            <TierSection
              tier={1}
              items={tier1Pending}
              isHighlighted={true}
              onStart={handleStart}
              onComplete={handleComplete}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
              onSchedule={(id) => setSchedulerItemId(id)}
              onEmail={(id) => setEmailItemId(id)}
              onLinkDeal={(id) => setLinkDealItemId(id)}
              onLinkCompany={(id) => setLinkCompanyItemId(id)}
            />
          )}

          {/* TIER 2: DON'T LOSE THIS - Orange */}
          {tier2Pending.length > 0 && (
            <div className={cn(hasTier1Items && 'opacity-50')}>
              <TierSection
                tier={2}
                items={tier2Pending}
                collapsed={hasTier1Items}
                onStart={handleStart}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onSchedule={(id) => setSchedulerItemId(id)}
                onEmail={(id) => setEmailItemId(id)}
                onLinkDeal={(id) => setLinkDealItemId(id)}
                onLinkCompany={(id) => setLinkCompanyItemId(id)}
              />
            </div>
          )}

          {/* TIER 3: KEEP YOUR WORD - Yellow */}
          {tier3Pending.length > 0 && (
            <div className={cn(hasTier1Items && 'opacity-50')}>
              <TierSection
                tier={3}
                items={tier3Pending}
                collapsed={hasTier1Items}
                onStart={handleStart}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onSchedule={(id) => setSchedulerItemId(id)}
                onEmail={(id) => setEmailItemId(id)}
                onLinkDeal={(id) => setLinkDealItemId(id)}
                onLinkCompany={(id) => setLinkCompanyItemId(id)}
              />
            </div>
          )}

          {/* TIER 4: MOVE BIG DEALS - Green */}
          {tier4Pending.length > 0 && (
            <div className={cn(hasTier1Items && 'opacity-50')}>
              <TierSection
                tier={4}
                items={tier4Pending}
                collapsed={hasTier1Items}
                onStart={handleStart}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onSchedule={(id) => setSchedulerItemId(id)}
                onEmail={(id) => setEmailItemId(id)}
                onLinkDeal={(id) => setLinkDealItemId(id)}
                onLinkCompany={(id) => setLinkCompanyItemId(id)}
              />
            </div>
          )}

          {/* TIER 5: BUILD PIPELINE - Blue, collapsed by default */}
          {tier5Pending.length > 0 && (
            <div className={cn(hasTier1Items && 'opacity-50')}>
              <TierSection
                tier={5}
                items={tier5Pending}
                collapsed={true}
                onStart={handleStart}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onSchedule={(id) => setSchedulerItemId(id)}
                onEmail={(id) => setEmailItemId(id)}
                onLinkDeal={(id) => setLinkDealItemId(id)}
                onLinkCompany={(id) => setLinkCompanyItemId(id)}
              />
            </div>
          )}
        </div>

        {/* Right Column - Calendar Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {/* Today's Schedule Header */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wider">
              Today&apos;s Schedule
            </h2>
          </div>

          {/* All Meetings */}
          {allMeetings.length > 0 ? (
            <div className="space-y-3">
              {allMeetings.map((meeting, index) => (
                <MeetingCard
                  key={meeting.meeting_id || index}
                  meeting={meeting}
                  compact
                  onViewPrep={(id) => setMeetingPrepId(id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No meetings today</p>
            </div>
          )}

          {/* Time Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-light text-gray-900">
                  {formatTime(plan.available_minutes)}
                </p>
                <p className="text-xs text-gray-500">Available</p>
              </div>
              <div>
                <p className="text-2xl font-light text-gray-900">
                  {formatTime(plan.meeting_minutes)}
                </p>
                <p className="text-xs text-gray-500">In Meetings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Credit Panel */}
      {showExtraCredit && (
        <>
          <ExtraCreditBackdrop onClose={() => setShowExtraCredit(false)} />
          <ExtraCreditPanel
            overflowItems={laterItems.filter(item => !completedIds.has(item.id))}
            onClose={() => setShowExtraCredit(false)}
            onAddItems={async (itemIds) => {
              // Mark selected items as high priority by updating their planned status
              // For now, just refresh the data
              await fetchData();
            }}
          />
        </>
      )}

      {/* Scheduler Popout */}
      {schedulerItemId && (() => {
        const item = items.find(i => i.id === schedulerItemId);
        if (!item) return null;
        return (
          <SchedulerPopout
            item={item as EnrichedCommandCenterItem}
            onClose={() => setSchedulerItemId(null)}
            onScheduled={() => {
              setSchedulerItemId(null);
              fetchData();
            }}
          />
        );
      })()}

      {/* Email Composer Popout */}
      {emailItemId && (() => {
        const item = items.find(i => i.id === emailItemId);
        if (!item) return null;
        return (
          <EmailComposerPopout
            item={item as EnrichedCommandCenterItem}
            onClose={() => setEmailItemId(null)}
            onSent={() => {
              setEmailItemId(null);
              fetchData();
            }}
          />
        );
      })()}

      {/* Meeting Prep Popout */}
      {meetingPrepId && (() => {
        const meeting = getMeetingsFromBlocks(plan.time_blocks || []).find(
          m => m.meeting_id === meetingPrepId
        );
        if (!meeting) return null;
        return (
          <MeetingPrepPopout
            meeting={meeting}
            onClose={() => setMeetingPrepId(null)}
          />
        );
      })()}

      {/* Link Deal Popout */}
      {linkDealItemId && (() => {
        const item = items.find(i => i.id === linkDealItemId);
        if (!item) return null;
        return (
          <LinkDealPopout
            item={item}
            onClose={() => setLinkDealItemId(null)}
            onLinked={() => {
              setLinkDealItemId(null);
              fetchData();
            }}
          />
        );
      })()}

      {/* Link Company Popout */}
      {linkCompanyItemId && (() => {
        const item = items.find(i => i.id === linkCompanyItemId);
        if (!item) return null;
        return (
          <LinkCompanyPopout
            item={item}
            onClose={() => setLinkCompanyItemId(null)}
            onLinked={() => {
              setLinkCompanyItemId(null);
              fetchData();
            }}
          />
        );
      })()}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  // Parse date parts to avoid timezone issues
  // dateStr is in YYYY-MM-DD format
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // Local date at midnight

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateAtMidnight = new Date(year, month - 1, day);
  dateAtMidnight.setHours(0, 0, 0, 0);

  if (dateAtMidnight.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dateAtMidnight.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getMeetingCount(plan: DailyPlan): number {
  return (plan.time_blocks || []).filter(
    (block) => block.type === 'meeting'
  ).length;
}

function formatCompactValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString();
}

function getCurrentTimeBlock(timeBlocks: TimeBlock[]): TimeBlock | null {
  const now = new Date();
  return timeBlocks.find(block => {
    if (block.type === 'meeting') return false; // Skip meeting blocks
    const start = new Date(block.start);
    const end = new Date(block.end);
    return now >= start && now < end;
  }) || null;
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatHour = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return `${formatHour(startDate)} - ${formatHour(endDate)}`;
}

// ============================================
// TIER SECTION COMPONENT
// ============================================

interface TierSectionProps {
  tier: PriorityTier;
  items: CommandCenterItem[];
  isHighlighted?: boolean;
  collapsed?: boolean;
  onStart: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onSnooze: (id: string, until: string) => Promise<void>;
  onDismiss: (id: string, reason?: string) => Promise<void>;
  onSchedule: (id: string) => void;
  onEmail: (id: string) => void;
  onLinkDeal: (id: string) => void;
  onLinkCompany: (id: string) => void;
}

function TierSection({
  tier,
  items,
  isHighlighted = false,
  collapsed: initialCollapsed = false,
  onStart,
  onComplete,
  onSnooze,
  onDismiss,
  onSchedule,
  onEmail,
  onLinkDeal,
  onLinkCompany,
}: TierSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const config = TIER_CONFIGS[tier];

  // Tier-specific styling
  const tierStyles: Record<PriorityTier, {
    bg: string;
    border: string;
    headerBg: string;
    text: string;
    icon: string;
  }> = {
    1: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      headerBg: 'bg-red-100',
      text: 'text-red-800',
      icon: '🔴',
    },
    2: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      headerBg: 'bg-orange-100',
      text: 'text-orange-800',
      icon: '🟠',
    },
    3: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      headerBg: 'bg-amber-100',
      text: 'text-amber-800',
      icon: '🟡',
    },
    4: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      headerBg: 'bg-emerald-100',
      text: 'text-emerald-800',
      icon: '🟢',
    },
    5: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      headerBg: 'bg-blue-100',
      text: 'text-blue-800',
      icon: '🔵',
    },
  };

  const style = tierStyles[tier];

  // For Tier 1, show a banner when people are waiting
  if (tier === 1 && items.length > 0) {
    return (
      <div className={cn('rounded-xl border-l-4', style.bg, 'border-l-red-500 p-4')}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{style.icon}</span>
            <h3 className={cn('font-semibold', style.text)}>
              {items.length} {items.length === 1 ? 'person is' : 'people are'} waiting
            </h3>
          </div>
          <span className="text-xs text-red-600 font-medium">
            Response speed = close rate
          </span>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <ActionCard
              key={item.id}
              item={item}
              isCurrentItem={index === 0}
              onStart={onStart}
              onComplete={onComplete}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
              onSchedule={onSchedule}
              onEmail={onEmail}
              onLinkDeal={onLinkDeal}
              onLinkCompany={onLinkCompany}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border', style.bg, style.border)}>
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full flex items-center justify-between p-3 rounded-t-xl transition-colors',
          style.headerBg
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{style.icon}</span>
          <h3 className={cn('text-sm font-semibold uppercase tracking-wider', style.text)}>
            {config.name}
          </h3>
          <span className={cn('text-xs', style.text, 'opacity-70')}>
            ({items.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs', style.text, 'opacity-60')}>
            {config.description}
          </span>
          {isCollapsed ? (
            <ChevronDown className={cn('h-4 w-4', style.text)} />
          ) : (
            <ChevronUp className={cn('h-4 w-4', style.text)} />
          )}
        </div>
      </button>

      {/* Items */}
      {!isCollapsed && (
        <div className="p-3 space-y-3">
          {items.slice(0, 5).map((item, index) => (
            <ActionCard
              key={item.id}
              item={item}
              isCurrentItem={index === 0 && isHighlighted}
              onStart={onStart}
              onComplete={onComplete}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
              onSchedule={onSchedule}
              onEmail={onEmail}
              onLinkDeal={onLinkDeal}
              onLinkCompany={onLinkCompany}
            />
          ))}
          {items.length > 5 && (
            <div className="text-center py-2">
              <span className={cn('text-xs', style.text)}>
                +{items.length - 5} more items
              </span>
            </div>
          )}
        </div>
      )}

      {/* Collapsed preview */}
      {isCollapsed && items.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-2">
            {items.slice(0, 3).map((item) => (
              <span
                key={item.id}
                className={cn(
                  'text-xs px-2 py-1 rounded-full bg-white/50',
                  style.text
                )}
              >
                {item.company_name || item.target_name || item.title.slice(0, 20)}
              </span>
            ))}
            {items.length > 3 && (
              <span className={cn('text-xs px-2 py-1', style.text, 'opacity-60')}>
                +{items.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
