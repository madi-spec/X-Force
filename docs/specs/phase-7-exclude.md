# Phase 7: Exclude Meeting Functionality

## Objective
Implement the exclude meeting functionality with proper state management and UI feedback.

## Prerequisites
- Phases 1-6 complete
- Server actions for exclude available

---

## Step 7.1: Create useExcludeMeeting Hook

Create file: `app/(dashboard)/meetings/hooks/useExcludeMeeting.ts`

```typescript
'use client';

import { useTransition, useCallback } from 'react';
import { excludeMeetingAction, restoreMeetingAction } from '../actions';

interface UseExcludeMeetingOptions {
  onExclude?: (meetingId: string) => void;
  onRestore?: (meetingId: string) => void;
  onError?: (error: string) => void;
}

export function useExcludeMeeting(options: UseExcludeMeetingOptions = {}) {
  const [isPending, startTransition] = useTransition();

  const exclude = useCallback(
    (meetingId: string) => {
      options.onExclude?.(meetingId);

      startTransition(async () => {
        const result = await excludeMeetingAction(meetingId);
        if (!result.success) {
          options.onError?.(result.error || 'Failed to exclude meeting');
          // Note: Parent component should handle reverting optimistic update
        }
      });
    },
    [options]
  );

  const restore = useCallback(
    (meetingId: string) => {
      options.onRestore?.(meetingId);

      startTransition(async () => {
        const result = await restoreMeetingAction(meetingId);
        if (!result.success) {
          options.onError?.(result.error || 'Failed to restore meeting');
        }
      });
    },
    [options]
  );

  return {
    exclude,
    restore,
    isPending,
  };
}
```

---

## Step 7.2: Create ExcludedBanner Component

Create file: `app/(dashboard)/meetings/components/ExcludedBanner.tsx`

```typescript
'use client';

import { EyeOff, Eye } from 'lucide-react';

interface ExcludedBannerProps {
  excludedCount: number;
  showExcluded: boolean;
  onToggle: () => void;
}

export function ExcludedBanner({
  excludedCount,
  showExcluded,
  onToggle,
}: ExcludedBannerProps) {
  if (excludedCount === 0) return null;

  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
        showExcluded
          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {showExcluded ? (
        <Eye className="w-4 h-4" />
      ) : (
        <EyeOff className="w-4 h-4" />
      )}
      {excludedCount} excluded
    </button>
  );
}
```

---

## Step 7.3: Create ExcludedMeetingOverlay Component

This shows a visual indicator when a meeting is excluded.

Create file: `app/(dashboard)/meetings/components/ExcludedMeetingOverlay.tsx`

```typescript
'use client';

import { EyeOff, RotateCcw } from 'lucide-react';

interface ExcludedMeetingOverlayProps {
  onRestore: () => void;
  isPending?: boolean;
}

export function ExcludedMeetingOverlay({
  onRestore,
  isPending = false,
}: ExcludedMeetingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
          <EyeOff className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 mb-2">Meeting excluded</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          disabled={isPending}
          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 mx-auto transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </button>
      </div>
    </div>
  );
}
```

---

## Step 7.4: Create Toast Notification Component

Create file: `app/(dashboard)/meetings/components/Toast.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const toastStyles: Record<ToastType, { bg: string; icon: typeof CheckCircle; iconColor: string }> = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const style = toastStyles[type];
  const Icon = style.icon;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${
        style.bg
      } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <Icon className={`w-5 h-5 ${style.iconColor}`} />
      <span className="text-sm text-slate-700">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="p-1 hover:bg-white/50 rounded transition-colors"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
```

---

## Step 7.5: Create Toast Context

Create file: `app/(dashboard)/meetings/contexts/ToastContext.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast } from '../components/Toast';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
```

---

## Step 7.6: Update Component Index

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
```

Create file: `app/(dashboard)/meetings/hooks/index.ts`

```typescript
export { useExcludeMeeting } from './useExcludeMeeting';
```

Create file: `app/(dashboard)/meetings/contexts/index.ts`

```typescript
export { ToastProvider, useToast } from './ToastContext';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/hooks/useExcludeMeeting.ts --noEmit
npx tsc app/\(dashboard\)/meetings/components/ExcludedBanner.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/ExcludedMeetingOverlay.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/Toast.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/contexts/ToastContext.tsx --noEmit
```
Expected: No errors

### 2. Test exclude flow
1. Click exclude (eye-off) button on a meeting
2. Meeting should fade/show overlay
3. Toast notification should appear
4. Excluded count in header should update
5. Click "Restore" should bring meeting back

### 3. Test toggle visibility
1. Click excluded count button
2. Excluded meetings should appear (faded)
3. Click again to hide excluded meetings

---

## Phase 7 Complete

Once all verification checks pass, proceed to `phase-8-queue.md`.
