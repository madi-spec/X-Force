# Phase 4: Meeting Card Components

## Objective
Create the MeetingPrepCard (for upcoming meetings) and PastMeetingCard components.

## Prerequisites
- Phases 1-3 complete
- Base UI components available

---

## Step 4.1: Create MeetingPrepCard Component

Create file: `app/(dashboard)/meetings/components/MeetingPrepCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import {
  Video,
  Phone,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Sparkles,
  MessageSquare,
  Lightbulb,
  Brain,
  Target,
  FileText,
  Building2,
} from 'lucide-react';
import type { MeetingWithDetails, MeetingType } from '@/types/meetings';

interface Customer {
  id: string;
  name: string;
}

interface MeetingPrepCardProps {
  meeting: MeetingWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  onExclude: () => void;
  customers: Customer[];
  onAssignCustomer: (customerId: string | null, customerName: string | null) => void;
  CustomerDropdown: React.ComponentType<{
    customerId: string | null;
    company: string | null;
    onAssign: (customerId: string | null, customerName: string | null) => void;
    customers: Customer[];
  }>;
}

const meetingTypeIcons: Record<MeetingType, typeof Video> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

export function MeetingPrepCard({
  meeting,
  isExpanded,
  onToggle,
  onExclude,
  customers,
  onAssignCustomer,
  CustomerDropdown,
}: MeetingPrepCardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'insights'>('overview');

  const MeetingIcon = meetingTypeIcons[meeting.meeting_type] || Video;
  
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = () => {
    const start = new Date(meeting.start_time);
    const end = new Date(meeting.end_time);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const prep = meeting.prep;
  const deal = prep?.deal_id ? { stage: 'Discovery', value: '$18,000 ARR' } : null; // TODO: fetch actual deal

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <MeetingIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{meeting.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.customer_id}
                company={meeting.customer?.name || null}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(meeting.start_time)} · {getDuration()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {meeting.attendees.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {deal && (
            <div className="text-right mr-2 hidden sm:block">
              <div className="text-xs text-slate-400">{deal.stage}</div>
              <div className="text-sm font-semibold text-emerald-600">{deal.value}</div>
            </div>
          )}
          {meeting.meeting_url && (
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Video className="w-4 h-4" />
              Join
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExclude();
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            title="Exclude meeting"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content - Meeting Prep */}
      {isExpanded && prep && (
        <div className="border-t border-slate-100">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-slate-50">
            {[
              { id: 'overview' as const, label: 'Overview', icon: Sparkles },
              { id: 'questions' as const, label: 'Questions', icon: MessageSquare },
              { id: 'insights' as const, label: 'Key Points', icon: Lightbulb },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {prep.summary || 'No summary available.'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'questions' && (
              <div className="space-y-2">
                {prep.suggested_questions && prep.suggested_questions.length > 0 ? (
                  prep.suggested_questions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <Target className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{q}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">No suggested questions.</p>
                )}
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-2">
                {prep.key_points && prep.key_points.length > 0 ? (
                  prep.key_points.map((point, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{point}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">No key points available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Prep Available */}
      {isExpanded && !prep && (
        <div className="border-t border-slate-100 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No meeting prep available</p>
          <p className="text-xs text-slate-400 mt-1">
            This appears to be an internal meeting
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Step 4.2: Create PastMeetingCard Component

Create file: `app/(dashboard)/meetings/components/PastMeetingCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  EyeOff,
  FileText,
  Lightbulb,
  Target,
  Brain,
  Zap,
  Building2,
} from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import type { MeetingWithDetails, ActionItemWithAssignee } from '@/types/meetings';

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

interface PastMeetingCardProps {
  meeting: MeetingWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  onExclude: () => void;
  customers: Customer[];
  teamMembers: TeamMember[];
  onAssignCustomer: (customerId: string | null, customerName: string | null) => void;
  onViewFullAnalysis: () => void;
  CustomerDropdown: React.ComponentType<{
    customerId: string | null;
    company: string | null;
    onAssign: (customerId: string | null, customerName: string | null) => void;
    customers: Customer[];
  }>;
  ActionItemsList: React.ComponentType<{
    actionItems: ActionItemWithAssignee[];
    meetingId: string;
    teamMembers: TeamMember[];
  }>;
}

export function PastMeetingCard({
  meeting,
  isExpanded,
  onToggle,
  onExclude,
  customers,
  teamMembers,
  onAssignCustomer,
  onViewFullAnalysis,
  CustomerDropdown,
  ActionItemsList,
}: PastMeetingCardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'insights' | 'actions'>('summary');

  const transcript = meeting.transcript;
  const analysis = transcript?.analysis;
  const isAnalyzed = transcript?.status === 'analyzed';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDuration = () => {
    const start = new Date(meeting.start_time);
    const end = new Date(meeting.end_time);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isAnalyzed ? 'bg-emerald-100' : 'bg-amber-100'
            }`}
          >
            {isAnalyzed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 truncate">{meeting.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.customer_id}
                company={meeting.customer?.name || null}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span>{formatDate(meeting.start_time)}</span>
              <span>{getDuration()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAnalyzed && analysis && (
            <div className="hidden sm:flex items-center gap-3">
              <SentimentBadge sentiment={analysis.sentiment} />
              <div className="flex items-center gap-1 text-sm">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="text-purple-600 font-medium">{analysis.signals_count}</span>
                <span className="text-slate-300">/</span>
                <span className="text-blue-600 font-medium">
                  {meeting.action_items.length}
                </span>
              </div>
            </div>
          )}
          {transcript && !isAnalyzed && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
              {transcript.status === 'processing' ? 'Processing...' : 'Pending Analysis'}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExclude();
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            title="Exclude meeting"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && isAnalyzed && analysis && (
        <div className="border-t border-slate-100">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-slate-50">
            {[
              { id: 'summary' as const, label: 'Summary', icon: FileText },
              { id: 'insights' as const, label: 'Insights', icon: Lightbulb },
              {
                id: 'actions' as const,
                label: `Actions (${meeting.action_items.length})`,
                icon: Target,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewFullAnalysis();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Brain className="w-4 h-4" />
              Full AI Analysis
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'summary' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {analysis.summary || 'No summary available.'}
                </p>
                <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
                  <span>{transcript.word_count?.toLocaleString() || 0} words</span>
                  <span>•</span>
                  <span>{meeting.attendees.length} participants</span>
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-2">
                {analysis.key_insights && analysis.key_insights.length > 0 ? (
                  analysis.key_insights.map((insight, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{insight}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">No insights available.</p>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <ActionItemsList
                actionItems={meeting.action_items}
                meetingId={meeting.id}
                teamMembers={teamMembers}
              />
            )}
          </div>
        </div>
      )}

      {/* Pending Analysis State */}
      {isExpanded && transcript && !isAnalyzed && (
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center justify-center gap-3 py-6">
            {transcript.status === 'processing' ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                <span className="text-sm text-slate-500">
                  Processing... {transcript.processing_progress}%
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-500">Analysis pending...</span>
            )}
          </div>
        </div>
      )}

      {/* No Transcript */}
      {isExpanded && !transcript && (
        <div className="border-t border-slate-100 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No transcript available</p>
        </div>
      )}
    </div>
  );
}
```

---

## Step 4.3: Update Component Index

Update file: `app/(dashboard)/meetings/components/index.ts`

```typescript
export { EditableText } from './EditableText';
export { SentimentBadge } from './SentimentBadge';
export { DateDropdown } from './DateDropdown';
export { AssigneeDropdown } from './AssigneeDropdown';
export { StatsBar } from './StatsBar';
export { MeetingPrepCard } from './MeetingPrepCard';
export { PastMeetingCard } from './PastMeetingCard';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/components/MeetingPrepCard.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/PastMeetingCard.tsx --noEmit
```
Expected: No errors

### 2. Check all required props are typed
Verify that both components have proper TypeScript interfaces for their props.

### 3. Verify imports resolve
```bash
npx tsc app/\(dashboard\)/meetings/components/index.ts --noEmit
```

---

## Phase 4 Complete

Once all verification checks pass, proceed to `phase-5-action-items.md`.
