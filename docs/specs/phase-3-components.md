# Phase 3: Base UI Components

## Objective
Create reusable UI components that will be used across the Meetings page.

## Prerequisites
- Phase 1 & 2 complete
- Tailwind CSS configured
- Lucide React installed (`npm install lucide-react`)

---

## Step 3.1: Create EditableText Component

Create file: `app/(dashboard)/meetings/components/EditableText.tsx`

```typescript
'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  className = '',
  placeholder = 'Enter text...',
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedText = text.trim();
    if (trimmedText && trimmedText !== value) {
      onSave(trimmedText);
    } else {
      setText(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setText(value);
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <span className={className}>
        {value || <span className="text-slate-400 italic">{placeholder}</span>}
      </span>
    );
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-white border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 transition-colors ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsEditing(true);
        }
      }}
    >
      {value || <span className="text-slate-400 italic">{placeholder}</span>}
    </span>
  );
}
```

---

## Step 3.2: Create SentimentBadge Component

Create file: `app/(dashboard)/meetings/components/SentimentBadge.tsx`

```typescript
import type { Sentiment } from '@/types/meetings';

interface SentimentBadgeProps {
  sentiment: Sentiment | null;
}

const sentimentConfig: Record<Sentiment, { bg: string; text: string; label: string }> = {
  very_positive: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Very Positive' },
  positive: { bg: 'bg-green-100', text: 'text-green-700', label: 'Positive' },
  neutral: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Neutral' },
  negative: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Negative' },
  very_negative: { bg: 'bg-red-100', text: 'text-red-700', label: 'Very Negative' },
};

export function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  if (!sentiment) return null;

  const config = sentimentConfig[sentiment] || sentimentConfig.neutral;

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
```

---

## Step 3.3: Create DateDropdown Component

Create file: `app/(dashboard)/meetings/components/DateDropdown.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface DateDropdownProps {
  date: string | null;
  onDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DateDropdown({ date, onDateChange, disabled = false }: DateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (disabled) {
    return (
      <span className="text-xs text-slate-500">
        Due {formatDate(date)}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        Due {formatDate(date)}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
          <input
            type="date"
            value={date || ''}
            onChange={(e) => {
              onDateChange(e.target.value);
              setIsOpen(false);
            }}
            className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
```

---

## Step 3.4: Create AssigneeDropdown Component

Create file: `app/(dashboard)/meetings/components/AssigneeDropdown.tsx`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface AssigneeDropdownProps {
  assignee: TeamMember | null;
  teamMembers: TeamMember[];
  onAssign: (member: TeamMember) => void;
  disabled?: boolean;
}

export function AssigneeDropdown({
  assignee,
  teamMembers,
  onAssign,
  disabled = false,
}: AssigneeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (disabled) {
    return (
      <span className="text-xs text-slate-500">
        @{assignee?.name || 'Unassigned'}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        @{assignee?.name || 'Unassigned'}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px] max-h-[200px] overflow-y-auto">
          {teamMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => {
                onAssign(member);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                member.id === assignee?.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium flex-shrink-0">
                {getInitials(member.name)}
              </span>
              <span className="truncate">{member.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 3.5: Create StatsBar Component

Create file: `app/(dashboard)/meetings/components/StatsBar.tsx`

```typescript
import type { MeetingsStats } from '@/types/meetings';

interface StatsBarProps {
  stats: MeetingsStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const statItems = [
    {
      label: 'Today',
      value: stats.today_count,
      sublabel: 'meetings',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'This Week',
      value: stats.this_week_count,
      sublabel: 'scheduled',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Analyzed',
      value: stats.analyzed_count,
      sublabel: 'transcripts',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Action Items',
      value: stats.pending_actions_count,
      sublabel: 'pending',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {statItems.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bg} rounded-lg p-3 border border-slate-100`}
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
            <span className="text-sm text-slate-500">{stat.sublabel}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
```

---

## Step 3.6: Create Loading Skeleton

Create file: `app/(dashboard)/meetings/loading.tsx`

```typescript
export default function MeetingsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-32 bg-slate-200 rounded" />
              <div className="h-4 w-64 bg-slate-100 rounded mt-2" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-28 bg-slate-200 rounded-lg" />
              <div className="h-10 w-36 bg-slate-200 rounded-lg" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-100 rounded-lg p-3 h-20" />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Upcoming section skeleton */}
        <section>
          <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-4 h-24"
              />
            ))}
          </div>
        </section>

        {/* Past section skeleton */}
        <section>
          <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-4 h-24"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

---

## Step 3.7: Create Component Index

Create file: `app/(dashboard)/meetings/components/index.ts`

```typescript
export { EditableText } from './EditableText';
export { SentimentBadge } from './SentimentBadge';
export { DateDropdown } from './DateDropdown';
export { AssigneeDropdown } from './AssigneeDropdown';
export { StatsBar } from './StatsBar';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/components/*.tsx --noEmit
```
Expected: No errors

### 2. Visual verification
Create a temporary test page to render all components:

Create file: `app/(dashboard)/meetings/components/test-page.tsx` (temporary)

```typescript
import { EditableText } from './EditableText';
import { SentimentBadge } from './SentimentBadge';
import { DateDropdown } from './DateDropdown';
import { AssigneeDropdown } from './AssigneeDropdown';
import { StatsBar } from './StatsBar';

const mockTeamMembers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
];

const mockStats = {
  today_count: 3,
  this_week_count: 12,
  analyzed_count: 45,
  pending_actions_count: 8,
};

export default function ComponentTest() {
  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div>
        <h2 className="text-lg font-semibold mb-2">EditableText</h2>
        <EditableText value="Click to edit" onSave={console.log} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">SentimentBadge</h2>
        <div className="flex gap-2">
          <SentimentBadge sentiment="very_positive" />
          <SentimentBadge sentiment="positive" />
          <SentimentBadge sentiment="neutral" />
          <SentimentBadge sentiment="negative" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">DateDropdown</h2>
        <DateDropdown date="2025-01-15" onDateChange={console.log} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">AssigneeDropdown</h2>
        <AssigneeDropdown
          assignee={mockTeamMembers[0]}
          teamMembers={mockTeamMembers}
          onAssign={console.log}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">StatsBar</h2>
        <StatsBar stats={mockStats} />
      </div>
    </div>
  );
}
```

### 3. Check imports
```bash
# Verify index exports work
echo "import { EditableText, SentimentBadge, DateDropdown, AssigneeDropdown, StatsBar } from './components';" > /tmp/test-import.ts
```

### 4. Delete test file after verification
```bash
rm app/\(dashboard\)/meetings/components/test-page.tsx
```

---

## Phase 3 Complete

Once all verification checks pass, proceed to `phase-4-meeting-cards.md`.
