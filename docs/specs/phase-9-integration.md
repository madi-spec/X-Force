# Phase 9: Final Integration and Testing

## Objective
Integrate all components into the main Meetings page, wire up state management, and perform end-to-end testing.

## Prerequisites
- Phases 1-8 complete
- All components available

---

## Step 9.1: Create the Main Meetings Page

Create file: `app/(dashboard)/meetings/page.tsx`

```typescript
import { Suspense } from 'react';
import { getMeetingsPageData } from './data';
import { MeetingsContent } from './MeetingsContent';
import MeetingsLoading from './loading';

export const metadata = {
  title: 'Meetings | X-FORCE CRM',
  description: 'Prepare, review, and analyze your meetings',
};

export default async function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsLoading />}>
      <MeetingsPageContent />
    </Suspense>
  );
}

async function MeetingsPageContent() {
  const data = await getMeetingsPageData();

  return (
    <MeetingsContent
      initialUpcomingMeetings={data.upcomingMeetings}
      initialPastMeetings={data.pastMeetings}
      initialProcessingQueue={data.processingQueue}
      initialStats={data.stats}
      customers={data.customers}
      teamMembers={data.teamMembers}
    />
  );
}
```

---

## Step 9.2: Create MeetingsContent Client Component

Create file: `app/(dashboard)/meetings/MeetingsContent.tsx`

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Calendar,
  Mic,
  ArrowRight,
  Filter,
  Search,
  ChevronDown,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import {
  StatsBar,
  MeetingPrepCard,
  PastMeetingCard,
  ActionItemsList,
  SimpleCustomerDropdown,
  ExcludedBanner,
  ProcessingQueue,
  FullAnalysisModal,
} from './components';
import { ToastProvider, useToast } from './contexts';
import { useExcludeMeeting } from './hooks';
import { assignCustomerAction } from './actions';
import type {
  MeetingWithDetails,
  ProcessingTranscript,
  MeetingsStats,
  TranscriptAnalysis,
} from '@/types/meetings';

interface Customer {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface MeetingsContentProps {
  initialUpcomingMeetings: MeetingWithDetails[];
  initialPastMeetings: MeetingWithDetails[];
  initialProcessingQueue: ProcessingTranscript[];
  initialStats: MeetingsStats;
  customers: Customer[];
  teamMembers: TeamMember[];
}

function MeetingsContentInner({
  initialUpcomingMeetings,
  initialPastMeetings,
  initialProcessingQueue,
  initialStats,
  customers,
  teamMembers,
}: MeetingsContentProps) {
  // State
  const [upcomingMeetings, setUpcomingMeetings] = useState(initialUpcomingMeetings);
  const [pastMeetings, setPastMeetings] = useState(initialPastMeetings);
  const [processingQueue] = useState(initialProcessingQueue);
  const [stats] = useState(initialStats);

  // UI State
  const [expandedUpcoming, setExpandedUpcoming] = useState<Set<string>>(
    new Set(initialUpcomingMeetings.slice(0, 1).map((m) => m.id))
  );
  const [expandedPast, setExpandedPast] = useState<Set<string>>(
    new Set(initialPastMeetings.slice(0, 1).map((m) => m.id))
  );
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [pastFilter, setPastFilter] = useState<'all' | 'analyzed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedAnalysis, setSelectedAnalysis] = useState<{
    analysis: TranscriptAnalysis;
    title: string;
  } | null>(null);

  const { showToast } = useToast();

  // Exclude functionality
  const { exclude: excludeMeeting } = useExcludeMeeting({
    onExclude: (meetingId) => {
      showToast('Meeting excluded', 'success');
    },
    onError: (error) => {
      showToast(error, 'error');
    },
  });

  // Toggle functions
  const toggleUpcoming = useCallback((id: string) => {
    setExpandedUpcoming((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const togglePast = useCallback((id: string) => {
    setExpandedPast((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Exclude handlers
  const handleExcludeUpcoming = useCallback(
    (meetingId: string) => {
      setUpcomingMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded: true } : m))
      );
      excludeMeeting(meetingId);
    },
    [excludeMeeting]
  );

  const handleExcludePast = useCallback(
    (meetingId: string) => {
      setPastMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded: true } : m))
      );
      excludeMeeting(meetingId);
    },
    [excludeMeeting]
  );

  // Customer assignment handlers
  const handleAssignCustomerUpcoming = useCallback(
    async (meetingId: string, customerId: string | null, customerName: string | null) => {
      setUpcomingMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                customer_id: customerId,
                customer: customerId && customerName ? { id: customerId, name: customerName } : null,
              }
            : m
        )
      );
      await assignCustomerAction(meetingId, customerId);
    },
    []
  );

  const handleAssignCustomerPast = useCallback(
    async (meetingId: string, customerId: string | null, customerName: string | null) => {
      setPastMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                customer_id: customerId,
                customer: customerId && customerName ? { id: customerId, name: customerName } : null,
              }
            : m
        )
      );
      await assignCustomerAction(meetingId, customerId);
    },
    []
  );

  // View full analysis
  const handleViewFullAnalysis = useCallback(
    (meeting: MeetingWithDetails) => {
      if (meeting.transcript?.analysis) {
        setSelectedAnalysis({
          analysis: meeting.transcript.analysis,
          title: meeting.title,
        });
      }
    },
    []
  );

  // Computed values
  const visibleUpcoming = useMemo(() => {
    return upcomingMeetings.filter((m) => showExcluded || !m.excluded);
  }, [upcomingMeetings, showExcluded]);

  const visiblePast = useMemo(() => {
    let filtered = pastMeetings.filter((m) => showExcluded || !m.excluded);

    if (pastFilter === 'analyzed') {
      filtered = filtered.filter((m) => m.transcript?.status === 'analyzed');
    } else if (pastFilter === 'pending') {
      filtered = filtered.filter(
        (m) => m.transcript?.status === 'pending' || m.transcript?.status === 'processing'
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.customer?.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [pastMeetings, showExcluded, pastFilter, searchQuery]);

  const excludedCount = useMemo(() => {
    return (
      upcomingMeetings.filter((m) => m.excluded).length +
      pastMeetings.filter((m) => m.excluded).length
    );
  }, [upcomingMeetings, pastMeetings]);

  // Group upcoming by date
  const groupedUpcoming = useMemo(() => {
    const groups: { label: string; meetings: MeetingWithDetails[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const todayMeetings: MeetingWithDetails[] = [];
    const tomorrowMeetings: MeetingWithDetails[] = [];
    const laterMeetings: MeetingWithDetails[] = [];

    visibleUpcoming.forEach((m) => {
      const meetingDate = new Date(m.start_time);
      meetingDate.setHours(0, 0, 0, 0);

      if (meetingDate.getTime() === today.getTime()) {
        todayMeetings.push(m);
      } else if (meetingDate.getTime() === tomorrow.getTime()) {
        tomorrowMeetings.push(m);
      } else {
        laterMeetings.push(m);
      }
    });

    if (todayMeetings.length > 0) {
      groups.push({ label: 'Today', meetings: todayMeetings });
    }
    if (tomorrowMeetings.length > 0) {
      groups.push({ label: 'Tomorrow', meetings: tomorrowMeetings });
    }
    if (laterMeetings.length > 0) {
      groups.push({ label: 'This Week', meetings: laterMeetings });
    }

    return groups;
  }, [visibleUpcoming]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Prepare, review, and analyze your meetings
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ExcludedBanner
                excludedCount={excludedCount}
                showExcluded={showExcluded}
                onToggle={() => setShowExcluded(!showExcluded)}
              />
              <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Mic className="w-4 h-4" />
                Upload Recording
              </button>
            </div>
          </div>

          <StatsBar stats={stats} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Upcoming Meetings Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming Meetings</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                {visibleUpcoming.length} scheduled
              </span>
            </div>
            <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors">
              View Calendar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {groupedUpcoming.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 text-sm text-slate-400 uppercase tracking-wide font-medium mb-3">
                  <Calendar className="w-4 h-4" />
                  {group.label}
                </div>
                <div className="space-y-3">
                  {group.meetings
                    .slice(0, showAllUpcoming ? undefined : 3)
                    .map((meeting) => (
                      <div
                        key={meeting.id}
                        className={meeting.excluded ? 'opacity-50' : ''}
                      >
                        <MeetingPrepCard
                          meeting={meeting}
                          isExpanded={expandedUpcoming.has(meeting.id)}
                          onToggle={() => toggleUpcoming(meeting.id)}
                          onExclude={() => handleExcludeUpcoming(meeting.id)}
                          customers={customers}
                          onAssignCustomer={(customerId, customerName) =>
                            handleAssignCustomerUpcoming(meeting.id, customerId, customerName)
                          }
                          CustomerDropdown={SimpleCustomerDropdown}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {visibleUpcoming.length > 3 && (
              <button
                onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllUpcoming
                  ? 'Show less'
                  : `Show ${visibleUpcoming.length - 3} more this week`}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showAllUpcoming ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {visibleUpcoming.length === 0 && (
              <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No upcoming meetings</p>
              </div>
            )}
          </div>
        </section>

        {/* Past Meetings Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Past Meetings & Analysis
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded">
                {visiblePast.filter((m) => m.transcript?.status === 'analyzed').length}{' '}
                analyzed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                {(['all', 'analyzed', 'pending'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPastFilter(f)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                      pastFilter === f
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-slate-400" />
              </button>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {visiblePast.slice(0, showAllPast ? undefined : 4).map((meeting) => (
              <div key={meeting.id} className={meeting.excluded ? 'opacity-50' : ''}>
                <PastMeetingCard
                  meeting={meeting}
                  isExpanded={expandedPast.has(meeting.id)}
                  onToggle={() => togglePast(meeting.id)}
                  onExclude={() => handleExcludePast(meeting.id)}
                  customers={customers}
                  teamMembers={teamMembers}
                  onAssignCustomer={(customerId, customerName) =>
                    handleAssignCustomerPast(meeting.id, customerId, customerName)
                  }
                  onViewFullAnalysis={() => handleViewFullAnalysis(meeting)}
                  CustomerDropdown={SimpleCustomerDropdown}
                  ActionItemsList={ActionItemsList}
                />
              </div>
            ))}

            {visiblePast.length > 4 && (
              <button
                onClick={() => setShowAllPast(!showAllPast)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllPast ? 'Show less' : `Show ${visiblePast.length - 4} more`}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAllPast ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {visiblePast.length === 0 && (
              <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No meetings found</p>
              </div>
            )}
          </div>
        </section>

        {/* Processing Queue Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Processing Queue</h2>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-sm font-medium rounded">
                {processingQueue.length} in queue
              </span>
            </div>
          </div>

          <ProcessingQueue items={processingQueue} />
        </section>
      </div>

      {/* Full Analysis Modal */}
      <FullAnalysisModal
        isOpen={selectedAnalysis !== null}
        onClose={() => setSelectedAnalysis(null)}
        analysis={selectedAnalysis?.analysis || null}
        meetingTitle={selectedAnalysis?.title || ''}
      />
    </div>
  );
}

export function MeetingsContent(props: MeetingsContentProps) {
  return (
    <ToastProvider>
      <MeetingsContentInner {...props} />
    </ToastProvider>
  );
}
```

---

## Step 9.3: Final Directory Structure

Verify the following structure exists:

```
app/(dashboard)/meetings/
├── page.tsx                          # Main page (server component)
├── MeetingsContent.tsx               # Client component with state
├── loading.tsx                       # Loading skeleton
├── data.ts                           # Data fetching functions
├── actions.ts                        # Server actions
├── components/
│   ├── index.ts                      # Component exports
│   ├── EditableText.tsx
│   ├── SentimentBadge.tsx
│   ├── DateDropdown.tsx
│   ├── AssigneeDropdown.tsx
│   ├── StatsBar.tsx
│   ├── MeetingPrepCard.tsx
│   ├── PastMeetingCard.tsx
│   ├── ActionItemRow.tsx
│   ├── ActionItemsList.tsx
│   ├── CustomerDropdown.tsx
│   ├── MeetingCustomerDropdown.tsx
│   ├── SimpleCustomerDropdown.tsx
│   ├── ExcludedBanner.tsx
│   ├── ExcludedMeetingOverlay.tsx
│   ├── Toast.tsx
│   ├── ProcessingQueueItem.tsx
│   ├── ProcessingQueue.tsx
│   └── FullAnalysisModal.tsx
├── hooks/
│   ├── index.ts
│   └── useExcludeMeeting.ts
└── contexts/
    ├── index.ts
    └── ToastContext.tsx

lib/supabase/
└── meetings.ts                       # Database query functions

types/
└── meetings.ts                       # TypeScript type definitions

supabase/migrations/
└── 20250104120000_meetings_redesign.sql
```

---

## Step 9.4: Run Full Test Suite

### 1. TypeScript Check
```bash
npx tsc --noEmit
```
Expected: No errors

### 2. Build Check
```bash
npm run build
```
Expected: Successful build

### 3. Run Development Server
```bash
npm run dev
```
Navigate to `/meetings` and verify:

### 4. Functional Tests

#### Header Section
- [ ] Page title displays "Meetings"
- [ ] Stats bar shows 4 stat cards
- [ ] Schedule button present
- [ ] Upload Recording button present
- [ ] Excluded count shows (if any excluded)

#### Upcoming Meetings
- [ ] Meetings display with correct info
- [ ] Click meeting to expand
- [ ] Tabs (Overview, Questions, Key Points) work
- [ ] Customer dropdown works
- [ ] Exclude button works
- [ ] Join button links to meeting URL
- [ ] "Show more" expands list

#### Past Meetings
- [ ] Meetings display with correct info
- [ ] Filter tabs (All, Analyzed, Pending) work
- [ ] Search filters meetings
- [ ] Click meeting to expand
- [ ] Tabs (Summary, Insights, Actions) work
- [ ] Full AI Analysis button opens modal

#### Action Items (in past meetings)
- [ ] Click checkbox cycles status
- [ ] Click text enables editing
- [ ] Press Enter saves text
- [ ] Press Escape cancels edit
- [ ] Assignee dropdown works
- [ ] Date picker works
- [ ] Delete button removes item
- [ ] Add new action item works

#### Customer Assignment
- [ ] Unassigned shows amber "Assign Customer"
- [ ] Click opens dropdown with search
- [ ] Search filters customers
- [ ] Select customer updates UI
- [ ] Remove assignment works

#### Exclude Functionality
- [ ] Click exclude fades meeting
- [ ] Toast notification appears
- [ ] Excluded count updates
- [ ] Toggle shows/hides excluded meetings

#### Processing Queue
- [ ] Shows processing items with progress
- [ ] Shows queued items
- [ ] More options menu works
- [ ] Empty state shows when no items

#### Full AI Analysis Modal
- [ ] Modal opens correctly
- [ ] All tabs display data
- [ ] ESC closes modal
- [ ] Click backdrop closes modal

---

## Step 9.5: Performance Checks

### 1. Check bundle size
```bash
npm run build
# Check .next/analyze if bundle analyzer is configured
```

### 2. Check for hydration errors
Open browser dev tools console and check for:
- No hydration mismatch warnings
- No React errors

### 3. Check loading states
- Slow network simulation should show loading skeleton
- Actions should show pending states

---

## Step 9.6: Accessibility Checks

### 1. Keyboard navigation
- Tab through all interactive elements
- Enter/Space activates buttons
- Escape closes modals/dropdowns
- Arrow keys in dropdowns

### 2. Screen reader
- All images have alt text
- Buttons have labels
- Status changes announced

### 3. Color contrast
- All text meets WCAG AA
- Focus states visible

---

## Completion Checklist

- [ ] All TypeScript compiles without errors
- [ ] Build succeeds
- [ ] All functional tests pass
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Accessibility requirements met

---

## Phase 9 Complete

🎉 **Congratulations!** The Meetings page redesign is complete.

### Summary of What Was Built:

1. **Database Layer** - Full schema with meetings, transcripts, action items, and analysis tables
2. **API Layer** - Server actions for all CRUD operations with optimistic updates
3. **Base Components** - Reusable UI components (EditableText, dropdowns, badges)
4. **Meeting Cards** - Upcoming and past meeting cards with prep and analysis
5. **Action Items** - Full inline editing with status, assignee, and date management
6. **Customer Assignment** - Searchable dropdown for linking meetings to customers
7. **Exclude Functionality** - Hide irrelevant meetings with restore capability
8. **Processing Queue** - Monitor transcript analysis progress
9. **Full Integration** - Complete page with state management and all features

### Next Steps (Optional Enhancements):

- Add drag-and-drop reordering for action items
- Implement real-time updates for processing queue
- Add export functionality for analyses
- Integrate with calendar sync
- Add email notifications for action item due dates
