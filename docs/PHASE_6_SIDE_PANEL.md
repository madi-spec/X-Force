# PHASE 6: Side Panel Component

## Objective
Create the slide-in side panel that displays item details, quick stats, stage-specific actions, stage selector, and assignment controls.

## Pre-Phase Checklist
- [ ] Phase 5 complete (kanban with card clicks)
- [ ] Card clicks trigger `onItemClick` handler
- [ ] Review mockup side panel design
- [ ] Study existing side panels in WorkItemDetails for patterns

## Tasks

### 6.1 Create Process Side Panel Component
Create file: `src/components/products/ProcessSidePanel.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Phone, Mail, FileText, CheckSquare, MoreHorizontal, Calendar } from 'lucide-react';
import { PipelineItem, StageDefinition } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessSidePanelProps {
  item: PipelineItem;
  stages: StageDefinition[];
  onClose: () => void;
  onStageMove: (item: PipelineItem, toStage: StageDefinition) => void;
}

export function ProcessSidePanel({ item, stages, onClose, onStageMove }: ProcessSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);

  // Fetch users for reassignment
  useEffect(() => {
    async function fetchUsers() {
      const res = await fetch('/api/products/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    }
    fetchUsers();
  }, []);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click was on backdrop
        const target = e.target as HTMLElement;
        if (target.classList.contains('panel-backdrop')) {
          onClose();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleStageClick = (stage: StageDefinition) => {
    if (stage.name !== item.stage_name) {
      onStageMove(item, stage);
    }
  };

  // Get stage-specific actions
  const stageActions = getStageActions(item.stage_name || '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/15 panel-backdrop" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[480px] bg-white shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="px-5 py-5 border-b border-[#e6eaf0]">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-lg font-semibold text-[#0b1220] pr-4">
              {item.company_name}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#f6f8fb] text-[#667085] hover:text-[#0b1220] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#e6eaf0] text-[#667085]">
              {item.product_name}
            </span>
            <span className="text-[13px] text-[#667085]">
              {item.stage_name}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Health Alert */}
          {item.health_reason && (
            <div className="p-3.5 bg-[#f6f8fb] border border-[#e6eaf0] rounded-lg flex items-center gap-2.5">
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  item.health_status === 'stalled' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
                )}
              />
              <span className="text-sm text-[#0b1220]">{item.health_reason}</span>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#f6f8fb] rounded-lg p-3.5 text-center">
              <div className="text-xl font-bold text-[#0b1220]">
                {item.days_in_stage}d
              </div>
              <div className="text-xs text-[#667085] mt-0.5">In Stage</div>
            </div>
            <div className="bg-[#f6f8fb] rounded-lg p-3.5 text-center">
              <div className="text-xl font-bold text-[#0b1220]">
                {item.mrr ? `$${item.mrr.toLocaleString()}` : '-'}
              </div>
              <div className="text-xs text-[#667085] mt-0.5">MRR</div>
            </div>
            <div className="bg-[#f6f8fb] rounded-lg p-3.5 text-center">
              <div className="text-sm font-semibold text-[#0b1220] truncate">
                {item.owner_name || 'Unassigned'}
              </div>
              <div className="text-xs text-[#667085] mt-0.5">Owner</div>
            </div>
          </div>

          {/* Quick Actions */}
          {stageActions.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085] mb-3">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {stageActions.map((action, index) => (
                  <button
                    key={index}
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-[#e6eaf0] rounded-lg text-[13px] font-medium text-[#0b1220] hover:bg-[#f6f8fb] transition-colors"
                  >
                    <span>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move Stage */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085] mb-3">
              Move Stage
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => handleStageClick(stage)}
                  className={cn(
                    'px-3 py-2 rounded-md text-[13px] transition-colors',
                    stage.name === item.stage_name
                      ? 'bg-white border border-[#3b82f6] text-[#3b82f6] font-medium'
                      : 'bg-[#f6f8fb] text-[#0b1220] hover:bg-[#e6eaf0]'
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#667085] mb-3">
              Assigned To
            </h3>
            <select
              value={item.owner_id || ''}
              onChange={(e) => {
                // TODO: Implement reassignment
                console.log('Reassign to:', e.target.value);
              }}
              className="w-full px-3 py-2.5 bg-white border border-[#e6eaf0] rounded-lg text-sm text-[#0b1220] focus:border-[#3b82f6] focus:ring-0 outline-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#e6eaf0] flex gap-2.5">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white rounded-lg text-sm font-medium hover:bg-[#2563eb] transition-colors">
            Log Activity
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#e6eaf0] text-[#0b1220] rounded-lg text-sm font-medium hover:bg-[#f6f8fb] transition-colors">
            Add Task
          </button>
          <button className="px-3.5 py-2.5 bg-white border border-[#e6eaf0] text-[#667085] rounded-lg hover:bg-[#f6f8fb] hover:text-[#0b1220] transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Stage-specific actions helper
interface StageAction {
  icon: string;
  label: string;
}

function getStageActions(stageName: string): StageAction[] {
  const actionsMap: Record<string, StageAction[]> = {
    'Actively Engaging': [
      { icon: '📅', label: 'Schedule Demo' },
      { icon: '📧', label: 'Send Intro' },
    ],
    'Demo Scheduled': [
      { icon: '🔔', label: 'Send Reminder' },
      { icon: '📅', label: 'Reschedule' },
    ],
    'Demo Complete': [
      { icon: '📧', label: 'Send Follow-up' },
      { icon: '📄', label: 'Create Proposal' },
    ],
    'Preview Ready': [
      { icon: '📞', label: 'Schedule Check-in' },
      { icon: '📚', label: 'Send Training' },
    ],
    'Trial': [
      { icon: '📊', label: 'Check Usage' },
      { icon: '📞', label: 'Schedule Call' },
    ],
    'Proposal': [
      { icon: '📄', label: 'View Proposal' },
      { icon: '✅', label: 'Mark Won' },
      { icon: '❌', label: 'Mark Lost' },
    ],
    // Onboarding stages
    'Training': [
      { icon: '📅', label: 'Schedule Session' },
      { icon: '📧', label: 'Send Materials' },
    ],
    'Data Migration': [
      { icon: '📤', label: 'Upload Data' },
      { icon: '🔍', label: 'Verify Import' },
    ],
    // Service stages
    'New': [
      { icon: '👋', label: 'Acknowledge' },
      { icon: '👤', label: 'Assign' },
    ],
    'Escalated': [
      { icon: '📞', label: 'Call Customer' },
      { icon: '👨‍💼', label: 'Involve Manager' },
    ],
    // Engagement stages
    'At Risk': [
      { icon: '📞', label: 'Call Customer' },
      { icon: '🎁', label: 'Offer Discount' },
    ],
    'Renewal Due': [
      { icon: '📄', label: 'Send Renewal' },
      { icon: '📞', label: 'Call to Discuss' },
    ],
  };

  return actionsMap[stageName] || [
    { icon: '📞', label: 'Schedule Call' },
    { icon: '📧', label: 'Send Email' },
  ];
}
```

### 6.2 Add Slide Animation
Add to `src/app/globals.css` (or create animation):

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}
```

### 6.3 Update Exports
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
export * from './ProcessEmptyState';
export * from './ProcessViewSkeleton';
```

### 6.4 Verify Container Integration
Ensure `ProcessViewContainer.tsx` properly renders the side panel:

```typescript
// In the return, after the content div:
{sidePanelItem && (
  <ProcessSidePanel
    item={sidePanelItem}
    stages={stages}
    onClose={() => setSidePanelItem(null)}
    onStageMove={handleStageMove}
  />
)}
```

## Testing Criteria

### Test 1: Panel Opens on Card Click
```typescript
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('.grid-cols-3');

// Click first card
await page.click('.bg-white.rounded-lg.cursor-pointer');

// Wait for panel
await page.waitForSelector('.w-\\[480px\\]');

// Screenshot
await page.screenshot({ path: 'side-panel-open.png' });

// Verify company name shows
const panelTitle = await page.locator('.w-\\[480px\\] h2').textContent();
console.log('Panel title:', panelTitle);
```

### Test 2: Panel Closes on X Click
```typescript
// Click close button
await page.click('.w-\\[480px\\] button:has(svg)');

// Verify panel gone
const panelVisible = await page.locator('.w-\\[480px\\]').isVisible();
console.log('Panel visible after close:', panelVisible); // Should be false
```

### Test 3: Panel Closes on Backdrop Click
```typescript
// Open panel again
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');

// Click backdrop
await page.click('.panel-backdrop');

// Verify closed
const panelVisible = await page.locator('.w-\\[480px\\]').isVisible();
console.log('Panel visible after backdrop click:', panelVisible); // Should be false
```

### Test 4: Panel Closes on Escape Key
```typescript
// Open panel
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');

// Press escape
await page.keyboard.press('Escape');

// Verify closed
const panelVisible = await page.locator('.w-\\[480px\\]').isVisible();
console.log('Panel visible after Escape:', panelVisible); // Should be false
```

### Test 5: Stats Display Correctly
```typescript
// Open panel
await page.click('.bg-white.rounded-lg.cursor-pointer');
await page.waitForSelector('.w-\\[480px\\]');

// Check stats
const daysInStage = await page.locator('text=In Stage').locator('..').locator('.font-bold').textContent();
const mrr = await page.locator('text=MRR').locator('..').locator('.font-bold').textContent();
const owner = await page.locator('text=Owner').locator('..').locator('.font-semibold').textContent();

console.log('Days:', daysInStage, 'MRR:', mrr, 'Owner:', owner);
```

### Test 6: Stage Buttons Render
```typescript
// Verify stage buttons exist
const stageButtons = await page.locator('.w-\\[480px\\] button.rounded-md').count();
console.log('Stage button count:', stageButtons);

// Verify current stage is highlighted (has border color)
const activeStage = await page.locator('.border-\\[\\#3b82f6\\]').textContent();
console.log('Active stage:', activeStage);
```

### Test 7: Stage Click Triggers Modal
```typescript
// Get non-active stage button
const inactiveStage = page.locator('.w-\\[480px\\] .bg-\\[\\#f6f8fb\\].rounded-md').first();
await inactiveStage.click();

// Modal should appear (Phase 7 will implement)
// For now, verify the handler fires by checking console or state
```

## Debugging Steps

### If panel doesn't open:
1. Verify `sidePanelItem` state is being set
2. Check `onItemClick` is being passed to cards
3. Verify conditional render in container

### If panel doesn't close:
1. Check event listeners are attached
2. Verify backdrop has correct class
3. Test escape key handler

### If animation doesn't work:
1. Verify CSS is added to globals.css
2. Check class is applied to panel element
3. Test with longer duration to see if it runs

### If data is wrong:
1. Verify `item` prop has correct data
2. Check field names match PipelineItem type
3. Console.log the item to inspect

## Completion Checklist
- [ ] Panel opens on card click
- [ ] Panel displays company name and product
- [ ] Health alert shows when applicable
- [ ] Stats show days, MRR, owner
- [ ] Quick actions render based on stage
- [ ] Stage buttons render with current highlighted
- [ ] Stage click triggers onStageMove
- [ ] Assigned To dropdown shows users
- [ ] Footer buttons render
- [ ] Panel closes on X click
- [ ] Panel closes on backdrop click
- [ ] Panel closes on Escape key
- [ ] Slide animation works
- [ ] No TypeScript errors

## Git Commit
```bash
git add -A
git commit -m "feat(products): add side panel component

- Add ProcessSidePanel with slide-in animation
- Display item details, stats, and health alert
- Add stage-specific quick actions
- Add stage selector with current highlighted
- Add user reassignment dropdown
- Add footer action buttons
- Handle close via X, backdrop, and Escape key"
```

## Next Phase
Say "PHASE 6 COMPLETE - PHASE 7 STARTING" and proceed to Phase 7.
