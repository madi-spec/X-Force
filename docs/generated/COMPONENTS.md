# X-FORCE Component Documentation

> Auto-generated documentation for all React components in `src/components`
> Generated: 2026-01-01

## Overview

The `src/components` directory contains 214 React components across 44 directories, providing the UI layer for the X-FORCE platform.

---

## Table of Contents

1. [UI Components](#1-ui-components)
2. [AI Components](#2-ai-components)
3. [Analytics Components](#3-analytics-components)
4. [Calendar Components](#4-calendar-components)
5. [Cases Components](#5-cases-components)
6. [Command Center Components](#6-command-center-components)
7. [Communications Components](#7-communications-components)
8. [Companies Components](#8-companies-components)
9. [Contacts Components](#9-contacts-components)
10. [Customer Hub Components](#10-customer-hub-components)
11. [Customers Components](#11-customers-components)
12. [Daily Driver Components](#12-daily-driver-components)
13. [Dashboard Components](#13-dashboard-components)
14. [Deals Components](#14-deals-components)
15. [Duplicates Components](#15-duplicates-components)
16. [Email Components](#16-email-components)
17. [Engagement Components](#17-engagement-components)
18. [Import Components](#18-import-components)
19. [Inbox Components](#19-inbox-components)
20. [Intelligence Components](#20-intelligence-components)
21. [Legacy Deals Components](#21-legacy-deals-components)
22. [Lens Components](#22-lens-components)
23. [Meetings Components](#23-meetings-components)
24. [Pipeline Components](#24-pipeline-components)
25. [Process Components](#25-process-components)
26. [Products Components](#26-products-components)
27. [Providers](#27-providers)
28. [Relationship Components](#28-relationship-components)
29. [Reports Components](#29-reports-components)
30. [Scheduler Components](#30-scheduler-components)
31. [Settings Components](#31-settings-components)
32. [Shared Components](#32-shared-components)
33. [Shell Components](#33-shell-components)
34. [Tasks Components](#34-tasks-components)
35. [Work Components](#35-work-components)
36. [Workflow Components](#36-workflow-components)

---

## 1. UI Components

**Path:** `src/components/ui/`

Base UI components (design system primitives).

### Exports (from index.ts)

```typescript
// Buttons
export { Button } from './button';
export type { ButtonProps } from './button';

// Badges
export { Badge } from './badge';
export type { BadgeProps } from './badge';

// Tooltips
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
export { InfoTooltip, MetricLabel, TableHeaderWithInfo } from './InfoTooltip';

// Layout
export { ResizablePane } from './ResizablePane';
export { Skeleton } from './Skeleton';

// Notifications
export { toast, useToast, ToastProvider, setGlobalToastHandler } from './Toast';
```

### Components

| Component | Purpose |
|-----------|---------|
| `Button` | Primary button component with variants |
| `Badge` | Status badges with color variants |
| `Tooltip` | Hover tooltip wrapper (Radix-based) |
| `InfoTooltip` | Information icon with tooltip content |
| `MetricLabel` | Metric label with optional tooltip |
| `TableHeaderWithInfo` | Table header with info tooltip |
| `ResizablePane` | Resizable panel component |
| `Skeleton` | Loading skeleton placeholder |
| `Toast` | Toast notification system |

---

## 2. AI Components

**Path:** `src/components/ai/`

AI-powered UI components organized by feature.

### Health Score (`ai/health/`)

| Component | Purpose |
|-----------|---------|
| `HealthScoreBreakdown` | Detailed health score factor breakdown |
| `HealthScoreRing` | Visual ring indicator for health scores |

### Signals (`ai/signals/`)

| Component | Purpose |
|-----------|---------|
| `SignalBadge` | Badge display for AI signals |
| `SignalCard` | Card component for signal details |
| `SignalsList` | List of AI-detected signals |

### Summaries (`ai/summaries/`)

| Component | Purpose |
|-----------|---------|
| `CompanySummaryCard` | AI-generated company summary |
| `ContactSummaryCard` | AI-generated contact summary |
| `DealSummaryCard` | AI-generated deal summary |
| `SummaryCard` | Generic summary card wrapper |

---

## 3. Analytics Components

**Path:** `src/components/analytics/`

Analytics and reporting visualizations.

| Component | Purpose |
|-----------|---------|
| `ProductAdoptionChart` | Chart showing product adoption metrics |
| `WhitespaceOpportunityList` | List of whitespace opportunities |
| `WhitespaceStats` | Whitespace analytics statistics |

---

## 4. Calendar Components

**Path:** `src/components/calendar/`

Calendar and scheduling UI.

| Component | Purpose |
|-----------|---------|
| `AgendaView` | Agenda-style calendar view |
| `CalendarHeader` | Calendar navigation header |
| `DayView` | Single day calendar view |
| `EventDetailPanel` | Calendar event detail panel |
| `MiniCalendar` | Compact calendar picker |
| `MonthView` | Full month calendar view |
| `WeekView` | Week calendar view |

---

## 5. Cases Components

**Path:** `src/components/cases/`

Support case management UI.

| Component | Purpose |
|-----------|---------|
| `CaseDetailView` | Detailed support case view |
| `CasesQueueList` | Queue list for support cases |

---

## 6. Command Center Components

**Path:** `src/components/commandCenter/`

AI co-pilot "Your Day" view components.

### Exports (from index.ts)

```typescript
export { YourDayView } from './YourDayView';
export { ActionCard, ActionCardCompact } from './ActionCard';
export { TimeBlockBar, TimeBlockBarInline } from './TimeBlockBar';
export { DaySummary, DaySummaryCompact } from './DaySummary';
export { EmailComposerPopout } from './EmailComposerPopout';
export { MeetingPrepPopout } from './MeetingPrepPopout';
export { LinkDealPopout } from './LinkDealPopout';
export { LinkCompanyPopout } from './LinkCompanyPopout';
export { EmailDraftModal } from './EmailDraftModal';
export { AddContextModal } from './AddContextModal';
export { SignalTuningView } from './SignalTuningView';
```

### Components

| Component | Purpose |
|-----------|---------|
| `YourDayView` | Main daily planning view |
| `ActionCard` | Action item card with rich context |
| `ActionCardCompact` | Compact action card variant |
| `TimeBlockBar` | Visual time block progress bar |
| `DaySummary` | Daily summary statistics |
| `DayCompleteView` | Day completion celebration view |
| `EmailComposerPopout` | Popout email composer |
| `EmailDraftModal` | Modal for reviewing email drafts |
| `EmailPreviewModal` | Modal for previewing emails |
| `MeetingCard` | Meeting item card |
| `MeetingPrepPopout` | Meeting preparation popout |
| `AddContactModal` | Modal to add new contact |
| `AddContextModal` | Modal to add context to items |
| `ExtraCreditPanel` | Optional extra tasks panel |
| `LinkCompanyPopout` | Popout to link company |
| `LinkDealPopout` | Popout to link deal |
| `ManualReplyPopout` | Manual reply composition |
| `SignalTuningView` | Signal threshold tuning UI |
| `TranscriptPreviewModal` | Transcript preview modal |

---

## 7. Communications Components

**Path:** `src/components/communications/`

Communication hub UI components.

| Component | Purpose |
|-----------|---------|
| `AIActivityFeed` | AI-analyzed activity feed |
| `AssignToCompanyModal` | Modal to assign to company |
| `ConversationList` | List of conversations |
| `ConversationThread` | Thread view for conversations |
| `CreateLeadFromEmail` | Create lead from email wizard |
| `CustomerContext` | Customer context panel |
| `PromisesTracker` | Track commitments/promises |
| `ResponseQueue` | Queue of pending responses |

---

## 8. Companies Components

**Path:** `src/components/companies/`

Company management UI.

| Component | Purpose |
|-----------|---------|
| `AccountMemoryPanel` | AI memory panel for account |
| `CompanyDetail` | Full company detail view |
| `CompanyForm` | Company create/edit form |
| `CompanyList` | Company listing view |
| `CompanyProductsGrid` | Grid of company's products |
| `QuickFlagModal` | Quick flag creation modal |

---

## 9. Contacts Components

**Path:** `src/components/contacts/`

Contact management UI.

| Component | Purpose |
|-----------|---------|
| `ContactCardWithFacts` | Contact card with relationship facts |
| `ContactForm` | Contact create/edit form |
| `RelationshipIntelligencePanel` | AI relationship intelligence |

---

## 10. Customer Hub Components

**Path:** `src/components/customerHub/`

Unified customer view components.

| Component | Purpose |
|-----------|---------|
| `CustomerHub` | Main customer hub container |
| `CustomerHubHeader` | Header with customer info |
| `CustomerHubTabs` | Tab navigation |
| `UnifiedTaskStream` | Unified task stream view |

### Tabs (`customerHub/tabs/`)

| Component | Purpose |
|-----------|---------|
| `ConversationsTab` | Conversations tab content |
| `EngagementTab` | Engagement metrics tab |
| `OnboardingTab` | Onboarding status tab |
| `OverviewTab` | Overview summary tab |
| `SalesTab` | Sales activity tab |
| `SupportTab` | Support cases tab |
| `TimelineTab` | Activity timeline tab |

---

## 11. Customers Components

**Path:** `src/components/customers/`

Customer directory UI.

| Component | Purpose |
|-----------|---------|
| `CustomerDirectory` | Customer directory listing |

---

## 12. Daily Driver Components

**Path:** `src/components/dailyDriver/`

Daily driver task management UI.

| Component | Purpose |
|-----------|---------|
| `AssignCompanyModal` | Modal to assign company |
| `CommunicationPreviewModal` | Preview communication |
| `DailyDriverView` | Main daily driver view |
| `ManageProductsModal` | Manage products modal |

---

## 13. Dashboard Components

**Path:** `src/components/dashboard/`

Dashboard widgets.

| Component | Purpose |
|-----------|---------|
| `ExpansionWidget` | Expansion opportunity widget |
| `HumanLeverageMoments` | Human leverage moments widget |

---

## 14. Deals Components

**Path:** `src/components/deals/`

Deal management UI.

| Component | Purpose |
|-----------|---------|
| `ActivityLogger` | Log deal activities |
| `AssetUploadModal` | Upload deal assets |
| `ConvertDealWizard` | Convert deal wizard |
| `DealForm` | Deal create/edit form |
| `DealHeaderActions` | Deal header action buttons |
| `DealIntelligenceCard` | AI deal intelligence card |
| `DealPostmortem` | Deal postmortem analysis |
| `DealRoomAnalytics` | Deal room analytics |
| `DealRoomSection` | Deal room content section |
| `MarkAsWonButton` | Mark deal as won button |
| `TeamSection` | Deal team section |

---

## 15. Duplicates Components

**Path:** `src/components/duplicates/`

Duplicate detection UI.

| Component | Purpose |
|-----------|---------|
| `DuplicateBadge` | Badge indicating duplicates |
| `DuplicateManager` | Duplicate management view |
| `MergeDuplicatesModal` | Modal to merge duplicates |

---

## 16. Email Components

**Path:** `src/components/email/`

Email client UI.

| Component | Purpose |
|-----------|---------|
| `EmailCompose` | Email composition form |
| `EmailDetail` | Email detail view |
| `EmailList` | Email list view |
| `EmailListItem` | Individual email list item |
| `EmailPreviewPane` | Email preview pane |
| `FolderSidebar` | Email folder sidebar |
| `InboxToolbar` | Inbox toolbar actions |

---

## 17. Engagement Components

**Path:** `src/components/engagement/`

Engagement tracking UI.

| Component | Purpose |
|-----------|---------|
| `EngagementBoard` | Engagement tracking board |

---

## 18. Import Components

**Path:** `src/components/import/`

Data import wizard UI.

| Component | Purpose |
|-----------|---------|
| `ColumnMapper` | Map import columns |
| `FileUpload` | File upload component |
| `ImportComplete` | Import completion view |
| `ImportPreview` | Preview import data |
| `ImportProgress` | Import progress indicator |
| `ImportWizard` | Main import wizard |
| `OwnerMapper` | Map record owners |
| `StageMapper` | Map deal stages |

---

## 19. Inbox Components

**Path:** `src/components/inbox/`

Unified inbox UI.

| Component | Purpose |
|-----------|---------|
| `ActionQueueTabs` | Action queue tab navigation |
| `ComposeModal` | Email compose modal |
| `ContextualComposeModal` | Contextual compose modal |
| `ConversationDetail` | Conversation detail view |
| `ConversationList` | Conversation list view |
| `ConversationListItem` | Individual conversation item |
| `InboxView` | Main inbox view |
| `LinkingModal` | Entity linking modal |
| `TasksPane` | Tasks side pane |

---

## 20. Intelligence Components

**Path:** `src/components/intelligence/`

Company intelligence UI.

| Component | Purpose |
|-----------|---------|
| `CompanyResearchTab` | Company research tab |
| `DataField` | Intelligence data field |
| `InsightsView` | Insights overview |
| `IntelligenceDataTab` | Raw intelligence data tab |
| `IntelligenceOverviewPanel` | Intelligence overview panel |
| `IntelligenceTab` | Main intelligence tab |
| `RawDataEditor` | Raw data editor |

---

## 21. Legacy Deals Components

**Path:** `src/components/legacyDeals/`

Legacy deal management (deprecated).

| Component | Purpose |
|-----------|---------|
| `LegacyDealsView` | Legacy deals view |

---

## 22. Lens Components

**Path:** `src/components/lens/`

Role-based lens UI.

| Component | Purpose |
|-----------|---------|
| `LensPageHeader` | Page header with lens context |
| `LensSwitcher` | Lens switching dropdown |

---

## 23. Meetings Components

**Path:** `src/components/meetings/`

Meeting analysis UI.

| Component | Purpose |
|-----------|---------|
| `ActionItemsList` | Meeting action items list |
| `AnalysisSummaryCard` | Meeting analysis summary |
| `BuyingSignalsCard` | Detected buying signals |
| `FollowUpEmailPreview` | Follow-up email preview |
| `KeyPointsList` | Key meeting points |
| `MeetingActivityCard` | Meeting activity card |
| `MeetingAnalysisView` | Full meeting analysis view |
| `ObjectionsCard` | Objections raised card |
| `RecommendationsPanel` | AI recommendations |
| `SentimentCard` | Meeting sentiment analysis |
| `TranscriptionSummaryModal` | Transcription summary |
| `TranscriptionUploadModal` | Upload transcription |

---

## 24. Pipeline Components

**Path:** `src/components/pipeline/`

Kanban pipeline UI.

| Component | Purpose |
|-----------|---------|
| `DealCard` | Deal card for kanban |
| `KanbanBoard` | Main kanban board |
| `PipelineColumn` | Pipeline stage column |
| `PipelineView` | Full pipeline view |

---

## 25. Process Components

**Path:** `src/components/process/`

Process studio UI.

| Component | Purpose |
|-----------|---------|
| `ProcessEditor` | Process flow editor |
| `ProcessScaffold` | Process scaffold layout |
| `ProcessStudio` | Main process studio view |

---

## 26. Products Components

**Path:** `src/components/products/`

Product management UI.

| Component | Purpose |
|-----------|---------|
| `AddStageModal` | Add pipeline stage modal |
| `AISuggestions` | AI stage suggestions |
| `ProcessPipeline` | Process-based pipeline view |
| `ProductCard` | Product card display |
| `ProductCustomers` | Product customers list |
| `ProductHeader` | Product page header |
| `ProductPipeline` | Product pipeline view |
| `ProductStats` | Product statistics |
| `ProvenProcessEditor` | Proven process editor |
| `StageDetailPanel` | Stage detail side panel |

---

## 27. Providers

**Path:** `src/components/providers/`

React context providers.

| Component | Purpose |
|-----------|---------|
| `Providers` | Root provider composition |

---

## 28. Relationship Components

**Path:** `src/components/relationship/`

Relationship intelligence UI.

| Component | Purpose |
|-----------|---------|
| `ActiveActionsPanel` | Active actions panel |
| `CommitmentsTracker` | Track commitments |
| `CommunicationTimeline` | Communication timeline |
| `KeyFactsPanel` | Key relationship facts |
| `RelationshipSummaryCard` | Relationship summary |
| `SignalsPanel` | Relationship signals |
| `StakeholderMap` | Stakeholder mapping |

---

## 29. Reports Components

**Path:** `src/components/reports/`

Reports and analytics UI.

| Component | Purpose |
|-----------|---------|
| `ReportsDashboard` | Main reports dashboard |

---

## 30. Scheduler Components

**Path:** `src/components/scheduler/`

AI scheduling UI.

| Component | Purpose |
|-----------|---------|
| `QuickBookModal` | Quick meeting booking modal |
| `ScheduleMeetingModal` | Full scheduling modal |
| `SchedulingRequestDetailModal` | Request detail modal |

---

## 31. Settings Components

**Path:** `src/components/settings/`

Settings and configuration UI.

| Component | Purpose |
|-----------|---------|
| `AIPromptEditor` | AI prompt editing |
| `FirefliesIntegration` | Fireflies.ai settings |
| `MicrosoftConnection` | Microsoft OAuth settings |
| `SettingsTabs` | Settings tab navigation |
| `TeamManagement` | Team member management |
| `TranscriptsTable` | Transcripts listing table |

---

## 32. Shared Components

**Path:** `src/components/shared/`

Shared layout components.

| Component | Purpose |
|-----------|---------|
| `Header` | Main app header |
| `MobileNav` | Mobile navigation |
| `Sidebar` | Main navigation sidebar |

### Sidebar Navigation Structure

```typescript
// Primary navigation
const primaryNavigation = [
  { id: 'work', name: 'Work', href: '/work', icon: Inbox },
  { id: 'customers', name: 'Customers', href: '/customers', icon: Users },
  { id: 'process', name: 'Process Studio', href: '/process', icon: Workflow },
  { id: 'products', name: 'Products', href: '/products', icon: Package },
  { id: 'reports', name: 'Reports', href: '/reports', icon: BarChart3 },
];

// Secondary navigation
const secondaryNavigation = [
  { id: 'communications', name: 'Communications', href: '/communications', icon: MessageSquare },
  { id: 'support_cases', name: 'Support Cases', href: '/cases', icon: Ticket },
  { id: 'companies', name: 'Companies', href: '/companies', icon: Building2 },
  // ...more items
];
```

---

## 33. Shell Components

**Path:** `src/components/shell/`

Application shell components.

| Component | Purpose |
|-----------|---------|
| `FocusSwitcher` | Focus mode switcher |
| `UnifiedShell` | Unified app shell layout |

---

## 34. Tasks Components

**Path:** `src/components/tasks/`

Task management UI.

| Component | Purpose |
|-----------|---------|
| `TaskActionModal` | Task action modal |
| `TasksList` | Tasks list view |
| `TranscriptReviewTaskModal` | Transcript review modal |

---

## 35. Work Components

**Path:** `src/components/work/`

Work queue UI (main interface).

| Component | Purpose |
|-----------|---------|
| `CommunicationsDrawer` | Communications side drawer |
| `QueueItemList` | Queue item list |
| `QueueSelector` | Queue selection tabs |
| `TriagePanel` | Triage panel for unassigned |
| `WorkItemCard` | Work item card display |
| `WorkItemContextPanel` | Item context panel |
| `WorkItemDetails` | Full item details |
| `WorkItemPreviewPane` | Item preview pane |
| `WorkPageClient` | Work page client component |
| `WorkQueues` | Queue management |
| `WorkView` | Main work queue view |

### WorkView Structure

```typescript
// Queue configuration
const QUEUE_CONFIGS = {
  action_now: { color: '#dc2626', priority: 1 },
  meeting_prep: { color: '#9333ea', priority: 2 },
  at_risk: { color: '#b91c1c', priority: 3 },
  // ...more queues
};

// Layout: Queue list + Content + Context panel
<div className="grid grid-cols-[420px_1fr_320px]">
  <QueueSelector />
  <QueueItemList />
  <WorkItemContextPanel />
</div>
```

---

## 36. Workflow Components

**Path:** `src/components/workflow/`

Workflow builder UI.

### Main Components

| Component | Purpose |
|-----------|---------|
| `AIPipelineAssistant` | AI pipeline assistant |
| `CustomNodeModal` | Custom node creation |
| `GenerateStageContent` | Generate stage content |
| `WorkflowBuilder` | Main workflow builder |
| `WorkflowCanvas` | Visual workflow canvas |
| `WorkflowConfigPanel` | Workflow configuration |
| `WorkflowConnections` | Node connections |
| `WorkflowHeader` | Builder header |
| `WorkflowMetricsBar` | Workflow metrics |
| `WorkflowNode` | Individual workflow node |
| `WorkflowTestMode` | Workflow testing mode |
| `WorkflowToolbox` | Node type toolbox |

### Config Components (`workflow/config/`)

| Component | Purpose |
|-----------|---------|
| `AIActionConfig` | AI action node config |
| `ConditionConfig` | Condition node config |
| `ExitConfig` | Exit node config |
| `HumanActionConfig` | Human action config |
| `StageConfig` | Stage node config |
| `TriggerConfig` | Trigger node config |

---

## Component Patterns

### 1. Client Components

All interactive components use the `'use client'` directive:

```tsx
'use client';

import { useState, useEffect } from 'react';
// ...
```

### 2. Utility Class Pattern

Components use the `cn()` utility for class composition:

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className
)}>
```

### 3. Supabase Client Pattern

Client components create Supabase clients:

```tsx
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
```

### 4. Modal/Popout Pattern

Modals and popouts follow consistent structure:

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ...other props
}

export function ExampleModal({ isOpen, onClose, ...props }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 ...">
      {/* Modal content */}
    </div>
  );
}
```

### 5. Lens Integration

Components can be lens-aware:

```tsx
import { useLens } from '@/lib/lens';

function MyComponent() {
  const { currentLens, isWidgetVisible } = useLens();

  if (!isWidgetVisible('myWidget')) return null;
  // ...
}
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Total Components | 214 |
| Total Directories | 44 |
| Largest Directory | `commandCenter` (19 components) |
| Workflow Components | 18 |
| Work Queue Components | 11 |
| Meeting Components | 12 |

---

## Component Hierarchy

```
App
├── Providers
│   ├── ToastProvider
│   ├── LensProvider
│   └── ...
├── UnifiedShell
│   ├── Sidebar
│   │   ├── LensSwitcher
│   │   └── Navigation
│   ├── Header
│   │   └── MobileNav
│   └── Main Content
│       ├── WorkView (Work Queue)
│       │   ├── QueueSelector
│       │   ├── QueueItemList
│       │   │   └── WorkItemCard[]
│       │   └── WorkItemContextPanel
│       ├── CustomerHub
│       │   ├── CustomerHubHeader
│       │   ├── CustomerHubTabs
│       │   └── Tab Content
│       ├── ProductPipeline
│       │   ├── ProductHeader
│       │   └── Pipeline Columns
│       └── ...other views
```

---

## Design System Tokens

Components follow the design system defined in `CLAUDE.md`:

| Token | Value |
|-------|-------|
| Border Radius | `rounded-xl` (12px) |
| Card Padding | `p-6` (24px) |
| Gap | `gap-4` (16px) |
| Font Sizes | `text-xs` to `text-3xl` |
| Colors | Semantic (success, warning, error) |
| Shadows | `shadow-sm`, `shadow-md` |
| Transitions | `duration-300` |
