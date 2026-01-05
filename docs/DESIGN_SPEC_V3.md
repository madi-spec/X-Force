# Products Process Views - Design Specification v3

## Overview

A unified process management experience where **Process** (Sales, Onboarding, Customer Service, Customer Engagement) is the primary navigation axis, with multi-select filtering for **Users** and **Products**.

---

## Core Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   PROCESS (Primary Tab)                                                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│   │ 🎯 Sales    │ │ 🚀 Onboard  │ │ 🛟 Service  │ │ 💚 Engage   │          │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                         │                                                    │
│                         ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ FILTERS (Multi-select)                                               │  │
│   │                                                                       │  │
│   │  Users: [John Doe ✓] [Sarah D ✓] [Mike J ☐] [Amy K ☐]              │  │
│   │  Products: [X-RAI ✓] [Summary ✓] [AI Agents ☐] [Smart Data ☐]      │  │
│   │  Health: [All ▾]                                                      │  │
│   │                                                                       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                         │                                                    │
│                         ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ VIEW MODE                                                            │  │
│   │ [All Items] [By Stage] [By Company]                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                         │                                                    │
│                         ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ KANBAN / LIST                                                        │  │
│   │ (Each process has its own stages per product)                        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Four Processes

| Process | Purpose | Who Uses It | Key Metrics |
|---------|---------|-------------|-------------|
| **Sales** | Track prospects through the sales funnel | Sales Reps, Sales Managers | Pipeline MRR, Conversion Rate |
| **Onboarding** | Get new customers up and running | Onboarding Specialists | Time to Go-Live, Completion Rate |
| **Customer Service** | Handle issues and requests | CSRs, Support Managers | Open Tickets, Resolution Time |
| **Customer Engagement** | Retention, upsells, health monitoring | Account Managers, CSMs | Churn Risk, Expansion Revenue |

### Process-Specific Stages (Per Product)

Each product has different stages for each process:

```typescript
const processStages: Record<ProcessId, Record<ProductId, string[]>> = {
  sales: {
    'xrai': ['Actively Engaging', 'Demo Scheduled', 'Demo Complete', 'Preview Approved', 'Preview Ready', 'Trial', 'Proposal'],
    'aiagents': ['Actively Engaging', 'Discovery Call', 'Demo Scheduled', 'Trial Setup', 'Trial Active', 'Proposal'],
    'summary': ['Actively Engaging', 'Demo', 'Closing'],
  },
  onboarding: {
    'xrai': ['Kickoff Scheduled', 'Training', 'Data Migration', 'Go Live Prep', 'Go Live'],
    'aiagents': ['Setup', 'Voice Training', 'Testing', 'Go Live'],
    'summary': ['Account Setup', 'Integration', 'Training', 'Active'],
  },
  customer_service: {
    'xrai': ['New', 'In Progress', 'Waiting on Customer', 'Escalated', 'Resolved'],
    'aiagents': ['New', 'Investigating', 'Waiting', 'Resolved'],
    'summary': ['New', 'In Progress', 'Resolved'],
  },
  engagement: {
    'xrai': ['Health Check Due', 'QBR Scheduled', 'Upsell Opportunity', 'Renewal Due', 'At Risk'],
    'aiagents': ['Check-in Due', 'Expansion Opportunity', 'Renewal'],
    'summary': ['Review Due', 'Upsell', 'Renewal'],
  }
};
```

---

## Process Tabs (Primary Navigation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ 🎯 Sales     │ │ 🚀 Onboarding│ │ 🛟 Service   │ │ 💚 Engagement│        │
│ │ (94) •       │ │ (12)         │ │ (8) •        │ │ (156)        │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

• = Has items needing attention (yellow dot indicator)
```

### Tab Component

```typescript
interface ProcessTab {
  id: 'sales' | 'onboarding' | 'customer_service' | 'engagement';
  name: string;
  icon: string;
  color: string;
  description: string;
  stats: {
    total: number;
    needsAttention: number;
  };
}
```

---

## User Multi-Select Filter

### Design

```
┌────────────────────────────────────────┐
│ 👥 Users: Sarah Davis, John Doe ▾      │  ← Collapsed state
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👥 Users: 2 selected ▾                 │  ← Collapsed (many selected)
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 👥 All Users ▾                         │  ← Collapsed (none/all selected)
└────────────────────────────────────────┘

DROPDOWN EXPANDED:
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │
│ │ 👤 My Items Only                   │ │  ← Quick filter
│ └────────────────────────────────────┘ │
│ ────────────────────────────────────── │
│ Select users:                          │
│ ┌────────────────────────────────────┐ │
│ │ [✓] JD  John Doe                   │ │
│ │        Sales Rep                    │ │
│ ├────────────────────────────────────┤ │
│ │ [✓] SD  Sarah Davis                │ │
│ │        Sales Rep                    │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] MJ  Mike Johnson               │ │
│ │        Onboarding Specialist        │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] AK  Amy Kim                    │ │
│ │        CSR                          │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] TB  Tom Brown                  │ │
│ │        Account Manager              │ │
│ └────────────────────────────────────┘ │
│ ────────────────────────────────────── │
│ [Clear]                        [Done]  │
└────────────────────────────────────────┘
```

### Behavior

| Selection | Display | Filter Behavior |
|-----------|---------|-----------------|
| None selected | "All Users" | Show all items |
| 1 selected | User's name | Show only that user's items |
| 2-3 selected | Names joined | Show selected users' items |
| 4+ selected | "X users" | Show selected users' items |
| "My Items Only" | Current user name | Quick filter to current user |

### State

```typescript
interface UserFilterState {
  selectedUserIds: string[];  // Empty = all users
  isDropdownOpen: boolean;
}

// Quick filter sets selectedUserIds to [currentUserId]
// Clear sets selectedUserIds to []
```

---

## Product Multi-Select Filter

### Design

```
┌────────────────────────────────────────┐
│ 📦 Products: X-RAI 2.0, Summary Note ▾ │  ← Collapsed
└────────────────────────────────────────┘

DROPDOWN EXPANDED:
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │
│ │ [✓] 🤖 X-RAI 2.0                   │ │
│ ├────────────────────────────────────┤ │
│ │ [✓] 📝 Summary Note                │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] 🎙️ AI Agents                   │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] 📊 Smart Data Plus             │ │
│ ├────────────────────────────────────┤ │
│ │ [ ] 🔄 X-RAI Migration             │ │
│ └────────────────────────────────────┘ │
│ ────────────────────────────────────── │
│ [Select All]                   [Done]  │
└────────────────────────────────────────┘
```

---

## Combined Filter Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  [👥 Sarah Davis, John Doe ▾]  [📦 X-RAI, Summary ▾]  [Health: All ▾]       │
│                                                                              │
│  [🔍 Search companies...]                          [⚠️ Needs Attention]     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Interaction States

- **Default**: All users, all products, all health
- **Active filter**: Button shows blue border/background
- **Quick filter**: "Needs Attention" toggles health filter

---

## View Modes

### All Items View (Health-Based Grouping)

When viewing multiple products OR when you want to see what needs attention:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ NEEDS ATTENTION (23)    │ 🔴 STALLED (12)         │ ✓ ON TRACK (58)      │
├────────────────────────────┼─────────────────────────┼──────────────────────┤
│ ┌────────────────────────┐ │ ┌─────────────────────┐ │ [Collapsed by        │
│ │ Spring Green           │ │ │ Custom Lawn Care    │ │  default - click     │
│ │ [X-RAI 2.0]            │ │ │ [X-RAI 2.0]         │ │  to expand]          │
│ │ Preview Ready          │ │ │ Preview Ready       │ │                      │
│ │ 20d · $200 · @SD       │ │ │ 45d · $300 · @JD    │ │                      │
│ │ ⚠️ No activity 14d     │ │ │ 🔴 Stalled 45d      │ │                      │
│ └────────────────────────┘ │ └─────────────────────┘ │                      │
└────────────────────────────┴─────────────────────────┴──────────────────────┘
```

### By Stage View (Single Product)

When one product is selected, show that product's process stages:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Actively     │ Demo         │ Demo         │ Preview      │ Proposal     │
│ Engaging (1) │ Scheduled (0)│ Complete (2) │ Ready (15)   │ (3)          │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │              │ ┌──────────┐ │ [Sub-grouped │ ┌──────────┐ │
│ │ Lawn     │ │              │ │ ABC Pest │ │  by health]  │ │ Nozzle   │ │
│ │ Doctor   │ │              │ │          │ │              │ │ Nolen    │ │
│ │ 8d @JD   │ │              │ │ 5d @SD   │ │ ⚠️ Attention │ │ 2d @JD   │ │
│ └──────────┘ │              │ └──────────┘ │ (8)          │ └──────────┘ │
│              │              │              │ ✓ On Track   │              │
│              │              │              │ (7)          │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### By Company View

Group by company, show all their products in that process:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Spring Green                                                 $500/mo     │
│    Has items needing attention                                              │
│ ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│ │ 🟠 X-RAI 2.0             │  │ 🩷 AI Agents             │                 │
│ │ Preview Ready · 20d      │  │ Discovery Call · 12d     │                 │
│ │ ⚠️ No activity 14d       │  │ ⚠️ No activity 9d        │                 │
│ └──────────────────────────┘  └──────────────────────────┘                 │
│ @Sarah Davis · Last: 9 days ago                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Lawn Doctor of West Lake County                                 $579/mo     │
│ ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│ │ 🟠 X-RAI 2.0             │  │ 🟣 Summary Note          │                 │
│ │ Actively Engaging · 8d   │  │ Demo · 5d                │                 │
│ │ ✓ Healthy                │  │ ✓ Healthy                │                 │
│ └──────────────────────────┘  └──────────────────────────┘                 │
│ @John Doe · Last: 2 days ago                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage-Specific Quick Actions

Each process + stage combination has different relevant actions:

### Sales Process Actions

| Stage | Actions |
|-------|---------|
| Actively Engaging | Schedule Demo, Send Intro Email |
| Demo Scheduled | Send Reminder, Reschedule, Cancel |
| Demo Complete | Send Follow-up, Create Proposal |
| Preview Ready | Schedule Check-in, Send Training Materials |
| Trial | Check Usage, Extend Trial, Schedule Call |
| Proposal | View Proposal, Send Reminder, Mark Won, Mark Lost |

### Onboarding Process Actions

| Stage | Actions |
|-------|---------|
| Kickoff Scheduled | Send Agenda, Prep Checklist |
| Training | Schedule Session, Send Materials |
| Data Migration | Upload Data, Verify Import, Report Issue |
| Go Live Prep | Final Review, Schedule Go-Live |
| Go Live | Activate Account, Send Welcome |

### Customer Service Process Actions

| Stage | Actions |
|-------|---------|
| New | Acknowledge, Assign, Set Priority |
| In Progress | Update Customer, Add Note, Request Info |
| Waiting on Customer | Send Reminder, Follow Up |
| Escalated | Involve Manager, Call Customer, Expedite |
| Resolved | Close Ticket, Send Survey |

### Customer Engagement Process Actions

| Stage | Actions |
|-------|---------|
| Health Check Due | Schedule Call, Send Check-in Email |
| QBR Scheduled | Prep QBR Deck, Send Agenda |
| Upsell Opportunity | Create Proposal, Schedule Demo |
| Renewal Due | Send Renewal Notice, Schedule Call |
| At Risk | Call Customer, Offer Discount, Create Recovery Plan |

---

## Side Panel

### Layout

```
┌─────────────────────────────────────────────────┐
│ Spring Green                              [✕]   │
│ [X-RAI 2.0] Preview Ready                       │
│ ─────────────────────────────────────────────── │
│                                                  │
│ ⚠️ No activity for 14 days                      │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ 20 days  │ │ $200/mo  │ │ SD       │         │
│ │ In Stage │ │ MRR      │ │ Sarah D. │         │
│ └──────────┘ └──────────┘ └──────────┘         │
│                                                  │
│ QUICK ACTIONS (stage-specific)                   │
│ ┌─────────────────┐ ┌─────────────────┐         │
│ │ 📞 Check-in     │ │ 📚 Send Training│         │
│ └─────────────────┘ └─────────────────┘         │
│                                                  │
│ MOVE STAGE                                       │
│ [Actively Engaging] [Demo Scheduled] ...         │
│ [Preview Approved] [●Preview Ready] [Trial]      │
│                                                  │
│ ASSIGNED TO                                      │
│ [Sarah Davis (Sales Rep) ▾]                      │
│                                                  │
│ RECENT ACTIVITY                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📧 Email sent - 14 days ago                 │ │
│ │ 📞 Call logged - 18 days ago                │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ─────────────────────────────────────────────── │
│ [📞 Log Activity]  [➕ Add Task]  [⋯ More]      │
└─────────────────────────────────────────────────┘
```

### Reassignment

The "Assigned To" dropdown allows reassigning to any user. This is process-aware:
- Sales items → Show sales reps
- Onboarding items → Show onboarding specialists  
- Service items → Show CSRs
- Engagement items → Show account managers

But also allows cross-assignment if needed.

---

## URL State

All state stored in URL for shareability:

```
/products?
  process=sales&
  users=jd,sd&
  products=xrai,summary&
  view=all&
  health=attention&
  search=spring
```

---

## Data Model Implications

### company_products Table Extensions

```sql
-- Current stage tracking per process
ALTER TABLE company_products ADD COLUMN IF NOT EXISTS
  sales_stage_id UUID REFERENCES product_sales_stages(id),
  onboarding_stage_id UUID REFERENCES product_onboarding_stages(id),
  service_stage_id UUID REFERENCES product_service_stages(id),
  engagement_stage_id UUID REFERENCES product_engagement_stages(id);

-- Or use a more flexible approach:
CREATE TABLE company_product_process_stages (
  id UUID PRIMARY KEY,
  company_product_id UUID REFERENCES company_products(id),
  process_type TEXT NOT NULL, -- 'sales', 'onboarding', 'customer_service', 'engagement'
  stage_id UUID NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID REFERENCES profiles(id),
  
  UNIQUE(company_product_id, process_type)
);
```

### Process-Specific Stage Tables

```sql
-- Sales stages (existing)
CREATE TABLE product_sales_stages (...);

-- Onboarding stages  
CREATE TABLE product_onboarding_stages (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  order_index INTEGER,
  ...
);

-- Service stages
CREATE TABLE product_service_stages (...);

-- Engagement stages
CREATE TABLE product_engagement_stages (...);
```

---

## API Endpoints

```typescript
// Get process view data
GET /api/products/process/:processType
Query params:
  - users: string[] (user IDs, empty = all)
  - products: string[] (product IDs)
  - health: 'all' | 'attention' | 'stalled' | 'healthy'
  - view: 'all' | 'stage' | 'company'
  - search: string

Response: {
  process: ProcessInfo,
  stats: { total, needsAttention, value },
  items: ProcessItem[],
  stages: StageInfo[] // For stage view
}

// Move item to new stage (with note)
POST /api/company-products/:id/move-stage
Body: {
  processType: string,
  toStageId: string,
  note: string
}

// Reassign item
POST /api/company-products/:id/reassign
Body: {
  processType: string,
  newOwnerId: string,
  note?: string
}
```

---

## Component Architecture

```
src/components/products/
├── ProcessTabs/
│   ├── ProcessTabs.tsx              # Main tab bar
│   └── ProcessTab.tsx               # Individual tab
│
├── Filters/
│   ├── FilterBar.tsx                # Container
│   ├── UserMultiSelect.tsx          # User dropdown
│   ├── ProductMultiSelect.tsx       # Product dropdown
│   ├── HealthFilter.tsx             # Health dropdown
│   └── QuickFilters.tsx             # Quick filter buttons
│
├── Views/
│   ├── AllItemsView.tsx             # Health-based columns
│   ├── StageView.tsx                # Product stages kanban
│   ├── CompanyView.tsx              # Company cards
│   └── ListView.tsx                 # Table view
│
├── Cards/
│   ├── ProcessCard.tsx              # Item card
│   ├── CompanyCard.tsx              # Company summary card
│   └── ProductBadge.tsx             # Product indicator
│
├── SidePanel/
│   ├── ItemSidePanel.tsx            # Main panel
│   ├── StageActions.tsx             # Stage-specific actions
│   ├── StageMover.tsx               # Stage selection
│   ├── AssignmentSelector.tsx       # Reassign dropdown
│   └── ActivityFeed.tsx             # Recent activity
│
└── hooks/
    ├── useProcessData.ts            # Data fetching
    ├── useFilters.ts                # Filter state
    └── useUrlState.ts               # URL sync
```

---

## Implementation Phases

### Phase 1: Process Infrastructure (3-4 hours)
- ProcessTabs component
- Process routing
- Process-specific stage tables (if needed)

### Phase 2: Multi-Select Filters (3-4 hours)
- UserMultiSelect component
- ProductMultiSelect component
- Filter state management
- URL state sync

### Phase 3: All Items View (2-3 hours)
- Health-based grouping
- Cards with product badges
- User attribution

### Phase 4: Stage View (2-3 hours)
- Product-specific stages
- Stage columns
- Sub-grouping within stages

### Phase 5: Company View (2-3 hours)
- Company cards
- Product grid within company
- Aggregated health status

### Phase 6: Side Panel (3-4 hours)
- Panel layout
- Stage-specific actions (per process)
- Stage mover with notes
- Reassignment

### Phase 7: Polish (2-3 hours)
- Loading states
- Empty states
- Mobile responsiveness
- Keyboard navigation

**Total Estimate: 17-24 hours**

---

## Key UX Decisions

| Decision | Rationale |
|----------|-----------|
| Process as primary nav | Different processes = different mental models, different teams |
| Multi-select users | Managers need to see team, reps need to focus on self |
| Multi-select products | Flexibility to slice data however needed |
| "My Items Only" quick filter | Most common filter, one click |
| Health grouping as default | Answers "what needs attention?" immediately |
| Stage-specific actions | Reduces cognitive load, shows relevant next steps |
| Side panel (not navigate) | Keep context, quick edits, return easily |
| Required notes on stage move | Creates accountability, audit trail |
