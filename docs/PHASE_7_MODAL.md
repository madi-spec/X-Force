# PHASE 7: Stage Move Modal

## Objective
Create the modal that appears when moving an item to a new stage, requiring the user to provide a note explaining the change.

## Pre-Phase Checklist
- [ ] Phase 6 complete (side panel with stage buttons)
- [ ] Stage button clicks trigger `onStageMove` handler
- [ ] `/api/products/process/move-stage` endpoint exists
- [ ] Review mockup modal design

## Tasks

### 7.1 Create Stage Move Modal Component
Create file: `src/components/products/StageMoveModal.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { PipelineItem } from '@/types/products';

interface StageMoveModalProps {
  item: PipelineItem;
  fromStage: string;
  toStage: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export function StageMoveModal({
  item,
  fromStage,
  toStage,
  onConfirm,
  onCancel,
}: StageMoveModalProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.classList.contains('modal-backdrop')) {
          onCancel();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = async () => {
    // Validate
    if (!note.trim()) {
      setError('Please enter a note explaining the stage change.');
      return;
    }
    if (note.trim().length < 10) {
      setError('Note must be at least 10 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError('Failed to move stage. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 modal-backdrop" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-[440px] bg-white rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-[#0b1220]">
            Move to New Stage
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {/* Info Box */}
          <div className="bg-[#f6f8fb] rounded-lg p-4 mb-4">
            <div className="text-xs text-[#667085]">Moving</div>
            <div className="text-sm font-semibold text-[#0b1220] mt-0.5">
              {item.company_name}
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className="text-[#667085]">{fromStage}</span>
              <ArrowRight className="w-4 h-4 text-[#667085]" />
              <span className="font-medium text-[#3b82f6]">{toStage}</span>
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-sm font-medium text-[#0b1220] mb-2">
              Why are you moving this? <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyPress}
              placeholder="Describe the reason for this stage change..."
              className={`w-full px-3 py-3 border rounded-lg text-sm text-[#0b1220] placeholder-[#667085] focus:ring-0 outline-none resize-none transition-colors ${
                error
                  ? 'border-[#ef4444] focus:border-[#ef4444]'
                  : 'border-[#e6eaf0] focus:border-[#3b82f6]'
              }`}
              rows={3}
            />
            {error && (
              <p className="mt-1.5 text-sm text-[#ef4444]">{error}</p>
            )}
            <p className="mt-1.5 text-xs text-[#667085]">
              This note will be saved as an activity and visible in the timeline.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#f6f8fb] border border-[#e6eaf0] text-[#0b1220] rounded-lg text-sm font-medium hover:bg-[#eef2f7] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !note.trim()}
            className="flex-1 px-4 py-2.5 bg-[#3b82f6] text-white rounded-lg text-sm font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Moving...' : 'Move & Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 7.2 Update Container to Handle Stage Move
Update `ProcessViewContainer.tsx` to properly handle the stage move flow:

```typescript
// Ensure stageMoveData state is defined:
const [stageMoveData, setStageMoveData] = useState<{
  item: PipelineItem;
  toStage: StageDefinition;
} | null>(null);

// Ensure handleStageMove function exists:
const handleStageMove = (item: PipelineItem, toStage: StageDefinition) => {
  setStageMoveData({ item, toStage });
};

// Ensure handleStageMoveConfirm function exists and calls API:
const handleStageMoveConfirm = async (note: string) => {
  if (!stageMoveData) return;
  
  try {
    const res = await fetch('/api/products/process/move-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: stageMoveData.item.id,
        to_stage_id: stageMoveData.toStage.id,
        note,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to move stage');
    }

    // Refresh data
    const params = new URLSearchParams();
    params.set('process', process);
    if (selectedProducts.length > 0) params.set('products', selectedProducts.join(','));
    if (selectedUsers.length > 0) params.set('users', selectedUsers.join(','));
    if (health !== 'all') params.set('health', health);
    if (search) params.set('search', search);

    const refreshRes = await fetch(`/api/products/process?${params.toString()}`);
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setItems(data.items);
      setStats(data.stats);
    }
    
    // Close modal and panel
    setStageMoveData(null);
    setSidePanelItem(null);
  } catch (error) {
    console.error('Failed to move stage:', error);
    throw error; // Re-throw so modal can show error
  }
};

// In the return, render the modal:
{stageMoveData && (
  <StageMoveModal
    item={stageMoveData.item}
    fromStage={stageMoveData.item.stage_name || 'Unknown'}
    toStage={stageMoveData.toStage.name}
    onConfirm={handleStageMoveConfirm}
    onCancel={() => setStageMoveData(null)}
  />
)}
```

### 7.3 Update Exports
Update file: `src/components/products/index.ts`

```typescript
export * from './ProcessViewContainer';
export * from './ProcessTabs';
export * from './ProcessHeader';
export * from './ProcessFilters';
export * from './ProcessViewControls';
export * from './ProcessKanban';
export * from './ProcessCard';
export * from './ProcessSidePanel';
export * from './StageMoveModal';
export * from './ProcessEmptyState';
export * from './ProcessViewSkeleton';
```

## Testing Criteria

### Test 1: Modal Opens on Stage Click
```typescript
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('.grid-cols-3');

// Open side panel
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');

// Click a different stage
const inactiveStage = page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first();
await inactiveStage.click();

// Wait for modal
await page.waitForSelector('text=Move to New Stage');

// Screenshot
await page.screenshot({ path: 'stage-move-modal.png' });
```

### Test 2: Modal Shows Correct Data
```typescript
// Verify company name
const companyName = await page.locator('.bg-\\[\\#f6f8fb\\] .font-semibold').textContent();
console.log('Modal company:', companyName);

// Verify from/to stages
const fromStage = await page.locator('.bg-\\[\\#f6f8fb\\] .text-\\[\\#667085\\]').last().textContent();
const toStage = await page.locator('.text-\\[\\#3b82f6\\].font-medium').textContent();
console.log('From:', fromStage, 'To:', toStage);
```

### Test 3: Validation - Empty Note
```typescript
// Try to submit without note
await page.click('text=Move & Save Note');

// Verify error shows
const error = await page.locator('text=Please enter a note').isVisible();
console.log('Error shown for empty note:', error);
```

### Test 4: Validation - Short Note
```typescript
// Type short note
await page.fill('textarea', 'short');
await page.click('text=Move & Save Note');

// Verify error shows
const error = await page.locator('text=at least 10 characters').isVisible();
console.log('Error shown for short note:', error);
```

### Test 5: Successful Move
```typescript
// Type valid note
await page.fill('textarea', 'Moving to next stage because demo was completed successfully and customer is ready for preview.');
await page.click('text=Move & Save Note');

// Wait for modal to close
await page.waitForSelector('text=Move to New Stage', { state: 'hidden' });

// Verify side panel also closed
const panelVisible = await page.locator('.w-\\[480px\\]').isVisible();
console.log('Panel closed after move:', !panelVisible);
```

### Test 6: Modal Closes on Cancel
```typescript
// Open modal again
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');
const inactiveStage = page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first();
await inactiveStage.click();
await page.waitForSelector('text=Move to New Stage');

// Click cancel
await page.click('text=Cancel');

// Verify modal closed
const modalVisible = await page.locator('text=Move to New Stage').isVisible();
console.log('Modal closed on cancel:', !modalVisible);
```

### Test 7: Modal Closes on Escape
```typescript
// Open modal
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');
await page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first().click();
await page.waitForSelector('text=Move to New Stage');

// Press escape
await page.keyboard.press('Escape');

// Verify closed
const modalVisible = await page.locator('text=Move to New Stage').isVisible();
console.log('Modal closed on escape:', !modalVisible);
```

### Test 8: Modal Closes on Backdrop Click
```typescript
// Open modal
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');
await page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first().click();
await page.waitForSelector('text=Move to New Stage');

// Click backdrop
await page.click('.modal-backdrop');

// Verify closed
const modalVisible = await page.locator('text=Move to New Stage').isVisible();
console.log('Modal closed on backdrop click:', !modalVisible);
```

### Test 9: Verify API Call
```typescript
// Monitor network requests
const [request] = await Promise.all([
  page.waitForRequest('**/api/products/process/move-stage'),
  (async () => {
    // Open modal and submit
    await page.click('.bg-white.rounded-lg.cursor-pointer');
    await page.waitForSelector('.w-\\[480px\\]');
    await page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first().click();
    await page.waitForSelector('text=Move to New Stage');
    await page.fill('textarea', 'Test note for stage move - completed successfully');
    await page.click('text=Move & Save Note');
  })(),
]);

console.log('API called:', request.url());
const postData = request.postDataJSON();
console.log('Request body:', postData);
```

## Debugging Steps

### If modal doesn't open:
1. Verify `stageMoveData` state is being set
2. Check `onStageMove` is passed to side panel
3. Verify stage button click handler fires

### If validation doesn't work:
1. Check error state is being set
2. Verify conditional rendering of error message
3. Test note length check logic

### If API fails:
1. Check API endpoint exists and works
2. Verify request body format
3. Check for auth issues
4. Test API directly with curl

### If modal doesn't close after success:
1. Verify `setStageMoveData(null)` is called
2. Check for errors in the try/catch
3. Verify async flow completes

## Completion Checklist
- [ ] Modal opens when clicking different stage
- [ ] Modal shows company name
- [ ] Modal shows from stage → to stage
- [ ] Textarea is focused on open
- [ ] Empty note shows validation error
- [ ] Short note shows validation error
- [ ] Valid note enables submit button
- [ ] Submit calls API with correct data
- [ ] Loading state shows during submit
- [ ] Modal closes on successful move
- [ ] Side panel closes on successful move
- [ ] Data refreshes after move
- [ ] Cancel button closes modal
- [ ] Escape key closes modal
- [ ] Backdrop click closes modal
- [ ] Cmd+Enter submits form

## Git Commit
```bash
git add -A
git commit -m "feat(products): add stage move modal with validation

- Add StageMoveModal component
- Require note with minimum 10 characters
- Show from/to stage transition
- Call API to persist stage change
- Log activity with note
- Refresh data after successful move
- Close modal and panel on success
- Handle close via Cancel, Escape, backdrop"
```

## Next Phase
Say "PHASE 7 COMPLETE - PHASE 8 STARTING" and proceed to Phase 8.
