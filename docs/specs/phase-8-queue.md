# Phase 8: Processing Queue Section

## Objective
Create the ProcessingQueue component that shows transcripts being analyzed.

## Prerequisites
- Phases 1-7 complete
- Transcript data fetching available

---

## Step 8.1: Create ProcessingQueueItem Component

Create file: `app/(dashboard)/meetings/components/ProcessingQueueItem.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Clock, MoreHorizontal, RefreshCw, UserPlus, Trash2 } from 'lucide-react';
import type { ProcessingTranscript } from '@/types/meetings';

interface ProcessingQueueItemProps {
  item: ProcessingTranscript;
  onReprocess?: (id: string) => void;
  onAssign?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ProcessingQueueItem({
  item,
  onReprocess,
  onAssign,
  onRemove,
}: ProcessingQueueItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isAnalyzing = item.status === 'processing';

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Status indicator */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isAnalyzing ? 'bg-blue-100' : 'bg-slate-100'
          }`}
        >
          {isAnalyzing ? (
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          ) : (
            <Clock className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Title and metadata */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-slate-900 truncate">
            {item.title}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {item.word_count.toLocaleString()} words
            {item.source && (
              <span className="ml-2 capitalize">• {item.source.replace('_', ' ')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Progress bar for analyzing items */}
        {isAnalyzing && (
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {/* Status badge */}
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            isAnalyzing
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isAnalyzing ? `${item.progress}%` : 'Queued'}
        </span>

        {/* More options menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-400" />
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                <button
                  onClick={() => {
                    onReprocess?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reprocess
                </button>
                <button
                  onClick={() => {
                    onAssign?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </button>
                <button
                  onClick={() => {
                    onRemove?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 8.2: Create ProcessingQueue Component

Create file: `app/(dashboard)/meetings/components/ProcessingQueue.tsx`

```typescript
'use client';

import { useState, useTransition } from 'react';
import { RefreshCw, UserPlus, Inbox } from 'lucide-react';
import { ProcessingQueueItem } from './ProcessingQueueItem';
import type { ProcessingTranscript } from '@/types/meetings';

interface ProcessingQueueProps {
  items: ProcessingTranscript[];
  onRefresh?: () => void;
}

export function ProcessingQueue({ items, onRefresh }: ProcessingQueueProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      onRefresh?.();
    });
  };

  const handleReprocess = (id: string) => {
    console.log('Reprocess:', id);
    // TODO: Implement reprocess action
  };

  const handleAssign = (id: string) => {
    console.log('Assign:', id);
    // TODO: Implement assign modal
  };

  const handleRemove = (id: string) => {
    console.log('Remove:', id);
    // TODO: Implement remove action
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Inbox className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">No transcripts in queue</p>
        <p className="text-xs text-slate-400 mt-1">
          Upload a recording or connect a transcription service
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Queue header actions */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors">
          <UserPlus className="w-4 h-4" />
          Bulk Assign
        </button>
      </div>

      {/* Queue items */}
      <div className="space-y-2">
        {items.map((item) => (
          <ProcessingQueueItem
            key={item.id}
            item={item}
            onReprocess={handleReprocess}
            onAssign={handleAssign}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Queue stats */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>
          {items.filter((i) => i.status === 'processing').length} processing,{' '}
          {items.filter((i) => i.status === 'pending').length} queued
        </span>
        <span>
          Est. completion:{' '}
          {Math.ceil(
            items.reduce((acc, i) => acc + (100 - i.progress) / 10, 0)
          )}{' '}
          min
        </span>
      </div>
    </div>
  );
}
```

---

## Step 8.3: Create FullAnalysisModal Component

Create file: `app/(dashboard)/meetings/components/FullAnalysisModal.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Brain,
  TrendingUp,
  Users,
  MessageSquare,
  Lightbulb,
  Target,
  Download,
  Share2,
} from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import type { TranscriptAnalysis } from '@/types/meetings';

interface FullAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: TranscriptAnalysis | null;
  meetingTitle: string;
}

export function FullAnalysisModal({
  isOpen,
  onClose,
  analysis,
  meetingTitle,
}: FullAnalysisModalProps) {
  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen || !analysis) return null;

  const sections = [
    { id: 'summary', label: 'Summary', icon: Brain },
    { id: 'insights', label: 'Key Insights', icon: Lightbulb },
    { id: 'signals', label: 'Signals', icon: TrendingUp },
    { id: 'topics', label: 'Topics', icon: MessageSquare },
    { id: 'speakers', label: 'Speakers', icon: Users },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Full AI Analysis</h2>
              <p className="text-sm text-slate-500 truncate max-w-md">
                {meetingTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-100">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'summary' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <SentimentBadge sentiment={analysis.sentiment} />
                {analysis.sentiment_score && (
                  <span className="text-sm text-slate-500">
                    Confidence: {Math.round(analysis.sentiment_score * 100)}%
                  </span>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed">
                {analysis.summary || 'No summary available.'}
              </p>
            </div>
          )}

          {activeSection === 'insights' && (
            <div className="space-y-3">
              {analysis.key_insights && analysis.key_insights.length > 0 ? (
                analysis.key_insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700">{insight}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No insights available.</p>
              )}
            </div>
          )}

          {activeSection === 'signals' && (
            <div className="space-y-3">
              {analysis.signals && analysis.signals.length > 0 ? (
                analysis.signals.map((signal, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-lg bg-purple-50 border border-purple-100"
                  >
                    <TrendingUp className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-purple-600 uppercase">
                        {signal.type}
                      </span>
                      <p className="text-slate-700 mt-1">{signal.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No signals detected.</p>
              )}
            </div>
          )}

          {activeSection === 'topics' && (
            <div className="space-y-3">
              {analysis.topics && analysis.topics.length > 0 ? (
                analysis.topics.map((topic, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{topic.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {topic.mentions} mentions
                      </span>
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${topic.relevance * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No topics identified.</p>
              )}
            </div>
          )}

          {activeSection === 'speakers' && (
            <div className="space-y-3">
              {analysis.speaker_breakdown && analysis.speaker_breakdown.length > 0 ? (
                analysis.speaker_breakdown.map((speaker, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <Users className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">{speaker.name}</p>
                        {speaker.email && (
                          <p className="text-sm text-slate-400">{speaker.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-700">
                        {Math.round(speaker.talk_time_percentage)}%
                      </p>
                      <p className="text-sm text-slate-400">
                        {Math.round(speaker.talk_time_seconds / 60)} min
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No speaker data available.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-400 text-center">
            Analysis generated by {analysis.analyzed_by || 'AI'} on{' '}
            {new Date(analysis.analyzed_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 8.4: Update Component Index

Update file: `app/(dashboard)/meetings/components/index.ts`

```typescript
export { EditableText } from './EditableText';
export { SentimentBadge } from './SentimentBadge';
export { DateDropdown } from './DateDropdown';
export { AssigneeDropdown } from './AssigneeDropdown';
export { StatsBar } from './StatsBar';
export { MeetingPrepCard } from './MeetingPrepCard';
export { PastMeetingCard } from './PastMeetingCard';
export { ActionItemRow } from './ActionItemRow';
export { ActionItemsList } from './ActionItemsList';
export { CustomerDropdown } from './CustomerDropdown';
export { MeetingCustomerDropdown } from './MeetingCustomerDropdown';
export { SimpleCustomerDropdown } from './SimpleCustomerDropdown';
export { ExcludedBanner } from './ExcludedBanner';
export { ExcludedMeetingOverlay } from './ExcludedMeetingOverlay';
export { Toast } from './Toast';
export { ProcessingQueueItem } from './ProcessingQueueItem';
export { ProcessingQueue } from './ProcessingQueue';
export { FullAnalysisModal } from './FullAnalysisModal';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/components/ProcessingQueueItem.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/ProcessingQueue.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/FullAnalysisModal.tsx --noEmit
```
Expected: No errors

### 2. Test queue display
1. Items with status "processing" show spinner and progress bar
2. Items with status "pending" show clock icon and "Queued" badge
3. More options menu opens and closes correctly
4. Empty state shows when no items

### 3. Test Full Analysis Modal
1. Modal opens with analysis data
2. All tabs render correctly
3. ESC key closes modal
4. Click backdrop closes modal
5. Scroll works for long content

---

## Phase 8 Complete

Once all verification checks pass, proceed to `phase-9-integration.md`.
