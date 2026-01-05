# X-RAI Process Studio - Workflow Builder Specification

## Overview

The Workflow Builder is a visual, node-based editor accessed from Process Studio that allows users to design dynamic workflows with branching logic, AI automation, and custom triggers/conditions. It powers four distinct process types across the customer lifecycle:

| Process Type | Icon Color | Purpose | Primary Entity |
|--------------|------------|---------|----------------|
| **Sales Process** | Orange | Lead to close pipeline | Deals |
| **Onboarding Milestones** | Blue | Customer activation journey | Customers |
| **Support Playbooks** | Red | Issue resolution workflows | Tickets |
| **Engagement Plays** | Purple | Retention and expansion | Customers |

### Access Path
```
Process Studio → [Product] → [Process Type] → Configure process → Workflow Builder
```

### Core Philosophy
- **Flexible, not prescriptive**: Users can create any workflow that fits their process
- **AI as a first-class citizen**: AI actions are nodes just like stages and conditions
- **Extensible**: Users can create custom nodes, triggers, conditions, and actions
- **Visual**: The workflow should be immediately understandable at a glance
- **Data-driven**: Live counts and metrics visible on the canvas
- **Process-aware**: Node templates and metrics adapt to the process type

---

## Process Types

Each process type has its own set of default nodes, metrics, and terminology.

### Sales Process
**Purpose**: Convert leads to customers
**Primary Entity**: Deals
**Key Metrics**: Conversion rate, deal velocity, pipeline value

**Default Triggers:**
- New Lead Created
- Form Submitted
- Call Completed
- Email Replied
- Meeting Completed
- Trial Started
- Deal Stage Changed

**Default Stages:**
- Actively Engaging
- Demo Scheduled
- Demo Complete
- Trial
- Proposal
- Negotiation

**Default Exits:**
- Closed Won
- Closed Lost
- Disqualified
- Send to Nurture

---

### Onboarding Milestones
**Purpose**: Activate new customers and drive adoption
**Primary Entity**: Customers (new)
**Key Metrics**: Time to value, milestone completion rate, activation rate

**Default Triggers:**
- Contract Signed
- Account Created
- First Login
- Integration Connected
- Milestone Completed
- Usage Threshold Reached

**Default Stages:**
- Welcome / Kickoff
- Technical Setup
- Training Scheduled
- Training Complete
- Go-Live
- Adoption Review
- Fully Activated

**Default Exits:**
- Successfully Onboarded
- Onboarding Stalled
- Churned During Onboarding
- Fast-Track Complete

---

### Support Playbooks
**Purpose**: Resolve issues efficiently with proper escalation
**Primary Entity**: Tickets
**Key Metrics**: Resolution time, first response time, escalation rate, CSAT

**Default Triggers:**
- Ticket Created
- Severity Changed
- SLA Warning (75% time elapsed)
- SLA Breach
- Customer Replied
- Escalation Requested
- Ticket Reopened

**Default Stages:**
- New / Triage
- Assigned
- In Progress
- Waiting on Customer
- Waiting on Internal
- Under Review
- Pending Resolution

**Default Conditions:**
- Severity Level (P1/P2/P3/P4)
- Customer Tier (Enterprise/Mid/SMB)
- Issue Category
- Time in Stage
- SLA Status

**Default Exits:**
- Resolved
- Closed - No Response
- Escalated to Engineering
- Merged / Duplicate

---

### Engagement Plays
**Purpose**: Retain customers and drive expansion
**Primary Entity**: Customers (existing)
**Key Metrics**: Health score, NRR, churn rate, expansion revenue

**Default Triggers:**
- Health Score Changed
- Usage Dropped (week over week)
- NPS Response Received
- Contract Renewal Approaching (30/60/90 days)
- Support Tickets Spike
- Champion Left Company
- Expansion Opportunity Identified
- Payment Failed

**Default Stages:**
- Monitoring
- At Risk Identified
- Intervention Active
- Stabilizing
- Re-Engaged
- Expansion Discussion
- Renewal Negotiation

**Default Conditions:**
- Health Score Range
- Days Until Renewal
- Usage Trend
- NPS Score
- Support Ticket Count (last 30 days)
- Contract Value

**Default Exits:**
- Renewed
- Expanded
- Churned
- Downgraded
- Saved (was at-risk)

---

## Node System

### Node Categories

| Category | Icon | Color | Purpose |
|----------|------|-------|---------|
| Triggers | ⚡ | Orange (#f97316) | Entry points that start a flow |
| Stages | 📋 | Blue (#3b82f6) | Resting states where entities accumulate |
| Conditions | 🔀 | Yellow (#eab308) | Decision points that route entities |
| AI Actions | ✨ | Purple (#a855f7) | Automated AI-powered operations |
| Human Actions | 👤 | Cyan (#06b6d4) | Tasks assigned to team members |
| Exits | 🏁 | Green/Red | Terminal states |

### Process-Specific Node Loading

When the Workflow Builder opens, it loads nodes based on the process type:

```typescript
function getDefaultNodes(processType: ProcessType) {
  const common = {
    conditions: commonConditions,      // Time in stage, custom field checks
    aiActions: commonAIActions,        // AI Follow-up, AI Analysis, AI Summary
    humanActions: commonHumanActions,  // Create Task, Send Notification, Assign
  };
  
  switch (processType) {
    case 'sales':
      return {
        ...common,
        triggers: salesTriggers,
        stages: salesStages,
        conditions: [...common.conditions, ...salesConditions],
        exits: salesExits,
      };
    case 'onboarding':
      return {
        ...common,
        triggers: onboardingTriggers,
        stages: onboardingStages,
        conditions: [...common.conditions, ...onboardingConditions],
        exits: onboardingExits,
      };
    case 'support':
      return {
        ...common,
        triggers: supportTriggers,
        stages: supportStages,
        conditions: [...common.conditions, ...supportConditions],
        exits: supportExits,
      };
    case 'engagement':
      return {
        ...common,
        triggers: engagementTriggers,
        stages: engagementStages,
        conditions: [...common.conditions, ...engagementConditions],
        exits: engagementExits,
      };
  }
}
```

### Common Nodes (All Process Types)

### Common Nodes (All Process Types)

#### Common Conditions
- Time in Stage (days/hours)
- Custom Field Check
- Tag/Label Check
- Owner Check
- Created Date Range
- Last Activity Date

#### Common AI Actions
- AI Follow-up Email
- AI Summary Generator
- AI Sentiment Analysis
- AI Next Best Action
- AI Translation (for multi-language)

#### Common Human Actions
- Create Task
- Send Notification
- Assign to User/Team
- Add Tag
- Update Field
- Send Email Template
- Create Calendar Event

### Process-Specific AI Actions

**Sales:**
- AI Scheduler (meeting booking)
- AI Objection Handler
- AI Proposal Generator
- AI Competitive Response
- AI Lead Scoring

**Onboarding:**
- AI Training Recommendation
- AI Setup Assistant
- AI Health Check
- AI Success Plan Generator

**Support:**
- AI Ticket Classifier
- AI Solution Suggester
- AI Escalation Predictor
- AI Response Drafter
- AI Knowledge Article Finder

**Engagement:**
- AI Churn Predictor
- AI Expansion Identifier
- AI Health Score Calculator
- AI Win-Back Campaign
- AI Renewal Prep

### Custom Node Creation

Users can create custom nodes in any category:

#### Custom Trigger
```
{
  id: "custom_trigger_uuid",
  type: "trigger",
  name: "PestWorld Lead",
  description: "Lead from trade show",
  icon: "🎪", // User selectable or upload
  color: "#f97316", // Inherits from category or custom
  config: {
    source: "webhook", // webhook, integration, manual
    webhook_url: "...", // If webhook
    integration: null, // If integration
    filters: [] // Optional filters
  }
}
```

#### Custom Condition
```
{
  id: "custom_condition_uuid",
  type: "condition",
  name: "Hot Lead Check",
  description: "Check if lead is hot based on multiple factors",
  icon: "🔥",
  config: {
    logic: "AND", // AND, OR
    rules: [
      { field: "lead_score", operator: ">=", value: 80 },
      { field: "company_size", operator: ">=", value: 5 },
      { field: "responded_within", operator: "<=", value: "24h" }
    ],
    outputs: [
      { id: "yes", label: "Hot", color: "#10b981" },
      { id: "no", label: "Not Hot", color: "#ef4444" }
    ]
  }
}
```

#### Custom AI Action
```
{
  id: "custom_ai_action_uuid",
  type: "aiAction",
  name: "AI Competitive Response",
  description: "Generate response when competitor mentioned",
  icon: "⚔️",
  config: {
    prompt_template: "...", // System prompt for this action
    model: "claude-sonnet-4", // Model selection
    inputs: ["transcript", "competitor_name"],
    outputs: ["response_text", "confidence_score"],
    auto_execute: true, // Or require approval
    notification: true // Notify rep when complete
  }
}
```

#### Custom Human Action
```
{
  id: "custom_human_action_uuid",
  type: "humanAction",
  name: "Technical Review",
  description: "Assign to solutions engineer",
  icon: "🔧",
  config: {
    task_type: "review",
    default_assignee: "role:solutions_engineer", // Or specific user
    due_in: "2d",
    priority: "high",
    template: "..." // Task description template
  }
}
```

---

## Condition Builder

### Rule Structure

Each condition node contains a rule builder with:

```
{
  logic: "AND" | "OR" | "CUSTOM",
  rules: [
    {
      field: string, // Field to evaluate
      operator: string, // Comparison operator
      value: any, // Value to compare against
      value_type: "static" | "field" | "formula" // Value source
    }
  ],
  outputs: [
    {
      id: string,
      label: string,
      color: string,
      is_default: boolean // Fallback if no match
    }
  ]
}
```

### Available Fields

#### Deal Fields
- deal.name
- deal.value
- deal.stage
- deal.owner
- deal.created_at
- deal.updated_at
- deal.days_in_stage
- deal.total_days_open
- deal.last_activity_at
- deal.last_contact_at
- deal.next_step
- deal.close_date
- deal.probability
- deal.tags[]
- deal.custom_fields.*

#### Contact Fields
- contact.name
- contact.email
- contact.phone
- contact.title
- contact.decision_maker
- contact.last_contacted
- contact.email_opens
- contact.email_clicks
- contact.calls_count
- contact.meetings_count

#### Company Fields
- company.name
- company.size (employees)
- company.revenue
- company.industry
- company.location
- company.crm_type
- company.current_provider
- company.custom_fields.*

#### Engagement Fields
- engagement.lead_score
- engagement.email_response_time
- engagement.meeting_attendance_rate
- engagement.calls_this_week
- engagement.last_positive_signal
- engagement.sentiment_score

#### Calculated Fields
- calc.days_since_last_contact
- calc.days_until_close_date
- calc.conversion_probability
- calc.engagement_velocity

### Available Operators

| Operator | Label | Applicable Types |
|----------|-------|------------------|
| eq | equals | all |
| neq | not equals | all |
| gt | greater than | number, date |
| gte | greater than or equal | number, date |
| lt | less than | number, date |
| lte | less than or equal | number, date |
| contains | contains | string, array |
| not_contains | does not contain | string, array |
| starts_with | starts with | string |
| ends_with | ends with | string |
| is_empty | is empty | all |
| is_not_empty | is not empty | all |
| in | is one of | all (multi-select) |
| not_in | is not one of | all (multi-select) |
| between | is between | number, date |
| regex | matches pattern | string |

### Output Branches

Conditions can have 2+ output branches:
- Simple: Yes/No (boolean)
- Multi: Hot/Warm/Cold (ranges)
- Custom: Any number of labeled outputs

Each output connects to a different path in the pipeline.

---

## Connection System

### Connection Types

| Type | Style | Purpose |
|------|-------|---------|
| Default | Solid gray | Standard flow |
| Conditional | Colored + labeled | Branch from condition |
| Loop | Dashed | Returns to earlier node |
| Exit | Red/Green | Terminal path |

### Connection Rules

1. **Triggers** can only have outgoing connections
2. **Exits** can only have incoming connections
3. **Stages** can have multiple incoming, one default outgoing, plus exit branches
4. **Conditions** must have 2+ outgoing (one per output branch)
5. **Actions** have one incoming, one outgoing
6. **Loops** are allowed (with cycle detection warning)

### Connection Data

```
{
  id: "conn_uuid",
  from_node: "node_uuid",
  from_port: "default" | "output_id", // For conditions
  to_node: "node_uuid",
  to_port: "input",
  label: string | null, // Shown on connection
  color: string | null, // Override default
  style: "solid" | "dashed",
  conditions: [] // Additional inline conditions (optional)
}
```

---

## Canvas Interface

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Process Studio    [Product] › [Process Type]    [Test] [Publish]      │
│                     Sales Process for X-RAI 2.0                         │
├─────────────┬─────────────────────────────────────────────┬─────────────┤
│             │                                             │             │
│  TOOLBOX    │              CANVAS                         │  CONFIG     │
│             │                                             │  PANEL      │
│ ▼ Triggers  │    [Nodes connected by lines]               │             │
│   (process- │                                             │ (appears    │
│    specific)│                                             │  when node  │
│             │                                             │  selected)  │
│ ▼ Stages    │                                             │             │
│             │                                             │             │
│ ▼ Conditions│                                             │             │
│             │                                             │             │
│ ▼ AI Actions│                                             │             │
│             │                                             │             │
│ ▼ Human     │                                             │             │
│   Actions   │                                             │             │
│             │                                             │             │
│ ▼ Exits     │                                             │             │
│             │                                             │             │
│ ─────────── │                                             │             │
│ + Create    │                                             │             │
│   Custom    │              [Zoom: 100%]                   │             │
│             │                                             │             │
│ ─────────── │  ┌─────────────────────────────────────┐    │             │
│ AI Process  │  │ METRICS BAR (process-specific)      │    │             │
│ Assistant   │  │ Sales: 30 deals | 68% conv | 26 days│    │             │
│             │  │ Support: 12 tickets | 4.2h avg res  │    │             │
│             │  └─────────────────────────────────────┘    │             │
└─────────────┴─────────────────────────────────────────────┴─────────────┘
```

### Header

The header adapts to show:
- Back link to Process Studio
- Breadcrumb: [Product Name] › [Process Type]
- Process name (editable inline)
- Process-specific status badge:
  - Sales: "30 active deals"
  - Onboarding: "8 customers onboarding"
  - Support: "12 open tickets"
  - Engagement: "5 at-risk accounts"
- Test button
- Publish button

### Metrics Bar (Bottom of Canvas)

Process-specific metrics displayed in a collapsible bar:

**Sales Process:**
- Active Deals | Conversion Rate | Avg Cycle Time | Pipeline Value

**Onboarding Milestones:**
- In Progress | Completion Rate | Avg Time to Value | Stalled Count

**Support Playbooks:**
- Open Tickets | Avg Resolution Time | SLA Compliance | Escalation Rate

**Engagement Plays:**
- Monitored Accounts | At Risk | Health Score Avg | Renewal Pipeline

### Toolbox (Left Panel - 260px)

- Collapsible categories with node items
- Drag-and-drop to canvas
- Search/filter nodes
- "Create Custom" button at bottom
- "AI Pipeline Assistant" CTA for auto-generation

### Canvas (Center)

- Infinite canvas with pan/zoom
- Dot grid background (24px spacing)
- Nodes positioned absolutely
- SVG layer for connections (bezier curves)
- Click node to select (shows config panel)
- Click canvas to deselect
- Drag nodes to reposition
- Drag from node port to create connection
- Multi-select with shift+click or marquee
- Delete key removes selected
- Undo/redo support

### Config Panel (Right - 320px, conditional)

- Appears when node is selected
- Different content per node type
- Node name (editable)
- Type-specific configuration
- For stages: pitch points, objections, resources tabs
- For conditions: rule builder
- For AI actions: prompt config, model selection
- Delete button
- Save/Cancel buttons

### Header

- Back navigation
- Pipeline name (editable inline)
- Active deals count (live)
- Test button (simulate a deal through the flow)
- Publish button (activate the pipeline)

### Zoom Controls (Bottom left of canvas)

- Zoom in/out buttons
- Current zoom percentage
- Fit to screen button
- Minimap toggle (optional)

---

## Node Configuration Panels

### Stage Config
```
┌─────────────────────────────┐
│ ✕                    Stage │
├─────────────────────────────┤
│ [Icon] Demo Scheduled       │
│                             │
│ Stage Name                  │
│ [Demo Scheduled_________]   │
│                             │
│ Goal                        │
│ [Show platform capabilities]│
│                             │
│ Exit Criteria               │
│ [Demo completed_________]   │
│                             │
│ ┌─────────────────────────┐ │
│ │ ✨ AI Automation    [ON]│ │
│ │ AI will send follow-up  │ │
│ │ if no activity in 3 days│ │
│ └─────────────────────────┘ │
│                             │
│ STAGE CONTENT               │
│ ┌─────────────────────────┐ │
│ │ 💬 Pitch Points      3 →│ │
│ ├─────────────────────────┤ │
│ │ 🛡️ Objection Handlers 5 →│ │
│ ├─────────────────────────┤ │
│ │ 📎 Resources         2 →│ │
│ └─────────────────────────┘ │
│                             │
│ [✨ Generate from Transcripts]│
│                             │
├─────────────────────────────┤
│ [Delete]         [Save]     │
└─────────────────────────────┘
```

### Condition Config
```
┌─────────────────────────────┐
│ ✕                Condition │
├─────────────────────────────┤
│ [Icon] Lead Score Check     │
│                             │
│ Condition Name              │
│ [Lead Score Check_______]   │
│                             │
│ RULES                  [AND]│
│ ┌─────────────────────────┐ │
│ │[Lead Score ▼][>=▼][80_]│×│ │
│ └─────────────────────────┘ │
│ [+ Add Rule]                │
│                             │
│ OUTPUT BRANCHES             │
│ ┌─────────────────────────┐ │
│ │ 🟢 [Hot (80+)_______] ×│ │
│ │ 🟡 [Warm (50-79)____] ×│ │
│ │ 🔴 [Cold (<50)______] ×│ │
│ └─────────────────────────┘ │
│ [+ Add Branch]              │
│                             │
├─────────────────────────────┤
│ [Delete]         [Save]     │
└─────────────────────────────┘
```

### AI Action Config
```
┌─────────────────────────────┐
│ ✕               AI Action  │
├─────────────────────────────┤
│ [Icon] AI Scheduler         │
│                             │
│ Action Name                 │
│ [AI Scheduler___________]   │
│                             │
│ ┌─────────────────────────┐ │
│ │ ✨ AI Enabled      [ON] │ │
│ │ Runs automatically      │ │
│ └─────────────────────────┘ │
│                             │
│ CONFIGURATION               │
│                             │
│ Meeting Type                │
│ [Discovery Call________▼]   │
│                             │
│ Scheduling Window           │
│ [Next 14 days__________▼]   │
│                             │
│ Preferred Times             │
│ [x] Morning  [x] Afternoon  │
│ [ ] Evening                 │
│                             │
│ Fallback Action             │
│ [Create task for rep___▼]   │
│                             │
│ [Advanced Settings →]       │
│                             │
├─────────────────────────────┤
│ [Delete]         [Save]     │
└─────────────────────────────┘
```

### Custom Node Creator
```
┌─────────────────────────────┐
│ Create Custom Node          │
├─────────────────────────────┤
│                             │
│ Node Type                   │
│ (○) Trigger                 │
│ (○) Stage                   │
│ (●) Condition               │
│ (○) AI Action               │
│ (○) Human Action            │
│ (○) Exit                    │
│                             │
│ Name                        │
│ [_______________________]   │
│                             │
│ Description                 │
│ [_______________________]   │
│                             │
│ Icon                        │
│ [🔥▼] or [Upload]           │
│                             │
│ [Continue to Configuration →]│
│                             │
└─────────────────────────────┘
```

---

## Data Model

### Process (formerly Pipeline)
```typescript
interface Process {
  id: string;
  product_id: string;
  process_type: 'sales' | 'onboarding' | 'support' | 'engagement';
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  created_at: datetime;
  updated_at: datetime;
  created_by: string;
  
  nodes: Node[];
  connections: Connection[];
  
  settings: {
    allow_multiple_paths: boolean;
    auto_advance: boolean;
    notifications: NotificationSettings;
    // Process-specific settings
    sla_settings?: SLASettings;        // For support
    health_thresholds?: HealthSettings; // For engagement
  };
  
  metrics: ProcessMetrics; // Varies by type
}

interface ProcessMetrics {
  // Common
  active_count: number;
  total_processed: number;
  
  // Sales-specific
  conversion_rate?: number;
  avg_cycle_time?: number;
  pipeline_value?: number;
  
  // Onboarding-specific
  completion_rate?: number;
  avg_time_to_value?: number;
  stalled_count?: number;
  
  // Support-specific
  avg_resolution_time?: number;
  sla_compliance?: number;
  escalation_rate?: number;
  csat_score?: number;
  
  // Engagement-specific
  health_score_avg?: number;
  at_risk_count?: number;
  renewal_pipeline?: number;
  nrr?: number;
}
```

### Node
```typescript
interface Node {
  id: string;
  process_id: string;
  type: 'trigger' | 'stage' | 'condition' | 'aiAction' | 'humanAction' | 'exit';
  item_id: string; // Reference to node template or custom node
  
  // Canvas position
  position: { x: number; y: number };
  
  // Display
  label: string;
  icon: string;
  color: string;
  
  // Type-specific config
  config: NodeConfig; // Varies by type
  
  // Runtime data (terminology varies by process type)
  // Sales: deals_count, Onboarding: customers_count, Support: tickets_count, Engagement: accounts_count
  entity_count?: number;
  avg_time_in_stage?: number;
  conversion_rate?: number;
  
  // Metadata
  created_at: datetime;
  updated_at: datetime;
}
```

### Connection
```typescript
interface Connection {
  id: string;
  process_id: string;
  
  from_node_id: string;
  from_port: string; // 'default' or output branch id
  to_node_id: string;
  to_port: string; // Usually 'input'
  
  label?: string;
  color?: string;
  style: 'solid' | 'dashed';
  
  // Analytics
  entities_through: number;
  avg_transition_time: number;
}
```

### Custom Node Template
```typescript
interface CustomNodeTemplate {
  id: string;
  organization_id: string;
  process_types: ProcessType[]; // Which process types can use this node
  type: NodeType;
  
  name: string;
  description: string;
  icon: string;
  color?: string;
  
  config_schema: JSONSchema;
  default_config: object;
  
  // For AI actions
  prompt_template?: string;
  model?: string;
  
  // For conditions
  default_rules?: Rule[];
  default_outputs?: Output[];
  
  is_system: boolean;
  created_at: datetime;
  updated_at: datetime;
}
```

---

## API Endpoints

### Processes
- `GET /api/products/:productId/processes` - List all processes for a product
- `GET /api/products/:productId/processes/:type` - Get specific process (sales, onboarding, support, engagement)
- `POST /api/products/:productId/processes/:type` - Create process
- `PUT /api/products/:productId/processes/:type` - Update process (nodes, connections, settings)
- `POST /api/products/:productId/processes/:type/publish` - Publish/activate process
- `POST /api/products/:productId/processes/:type/duplicate` - Clone process

### Nodes
- `POST /api/processes/:id/nodes` - Add node
- `PUT /api/processes/:id/nodes/:nodeId` - Update node
- `DELETE /api/processes/:id/nodes/:nodeId` - Delete node
- `PUT /api/processes/:id/nodes/positions` - Batch update positions

### Connections
- `POST /api/processes/:id/connections` - Add connection
- `DELETE /api/processes/:id/connections/:connId` - Delete connection

### Node Templates
- `GET /api/node-templates?processType=sales` - List templates filtered by process type
- `POST /api/node-templates` - Create custom template
- `PUT /api/node-templates/:id` - Update custom template
- `DELETE /api/node-templates/:id` - Delete custom template

### Analytics
- `GET /api/processes/:id/analytics` - Process performance metrics
- `GET /api/processes/:id/nodes/:nodeId/analytics` - Node-specific metrics

---

## AI Features

### AI Pipeline Assistant

The "Analyze & Suggest" feature in the toolbox:

1. **Analyzes call transcripts** from closed-won and closed-lost deals
2. **Identifies patterns** in successful vs unsuccessful paths
3. **Suggests optimal pipeline structure** including:
   - Where to add conditions (e.g., "Deals with budget confirmed early convert 2x better")
   - Where to add AI actions (e.g., "Follow-up within 24h increases response rate by 40%")
   - Recommended stage sequence
4. **Generates pitch points and objection handlers** per stage
5. **Provides reasoning** for each suggestion

### AI Action Execution

When a deal reaches an AI Action node:

1. **Context gathering**: Collect deal, contact, company data
2. **Prompt construction**: Build prompt from template + context
3. **Model execution**: Call Claude API
4. **Output handling**: 
   - If auto_execute: Perform action (send email, update field, etc.)
   - If approval_required: Create task for rep to review
5. **Logging**: Record action taken for analytics

### Stage Content Generation

"Generate from Transcripts" button on stage config:

1. **Selects relevant transcripts** (calls at this stage, won deals)
2. **Extracts patterns**:
   - What pitch points resonated?
   - What objections came up?
   - What resources were mentioned?
3. **Generates suggestions** with confidence scores
4. **User reviews and approves** each item

---

## Implementation Phases

### Phase 1: Core Canvas (MVP)
- [ ] Basic canvas with pan/zoom
- [ ] Drag nodes from toolbox
- [ ] Position nodes on canvas
- [ ] Connect nodes with lines
- [ ] Select nodes, show config panel
- [ ] Save/load pipeline
- [ ] Default node templates only

### Phase 2: Configuration
- [ ] Stage config (name, goal, exit criteria)
- [ ] Condition config (rule builder, outputs)
- [ ] AI Action config (basic settings)
- [ ] Human Action config (task creation)
- [ ] Connection labels and colors

### Phase 3: Custom Nodes
- [ ] Custom node creator modal
- [ ] Save custom templates
- [ ] Custom conditions with rule builder
- [ ] Custom AI actions with prompt templates

### Phase 4: Runtime & Analytics
- [ ] Live deal counts on stage nodes
- [ ] Connection analytics (deals through)
- [ ] Pipeline metrics dashboard
- [ ] Test mode (simulate deal flow)

### Phase 5: AI Features
- [ ] AI Pipeline Assistant (analyze & suggest)
- [ ] Generate stage content from transcripts
- [ ] AI action execution engine
- [ ] Approval workflows for AI actions

### Phase 6: Advanced
- [ ] Undo/redo
- [ ] Keyboard shortcuts
- [ ] Multi-select and bulk operations
- [ ] Pipeline versioning
- [ ] A/B testing paths
- [ ] Minimap
- [ ] Export/import pipelines

---

## Design System Alignment

Follow X-RAI design system (light mode):

### Colors
- Background: #f8fafc
- Card: #ffffff
- Elevated: #f1f5f9
- Border: #e2e8f0
- Text Primary: #0f172a
- Text Secondary: #475569
- Text Muted: #94a3b8

### Node Type Colors
- Trigger: #f97316 (orange)
- Stage: #3b82f6 (blue)
- Condition: #eab308 (yellow)
- AI Action: #a855f7 (purple)
- Human Action: #06b6d4 (cyan)
- Exit Won: #10b981 (green)
- Exit Lost: #ef4444 (red)

### Component Patterns
- Border radius: 10-12px for cards, 6-8px for inputs
- Shadows: Subtle (0 2px 8px rgba(0,0,0,0.06))
- Transitions: 150-200ms ease
- Font sizes: 11px labels, 13px body, 14-15px headings

---

## Testing Considerations

### Test Mode

"Test" button in header allows:

1. **Create test deal** with configurable properties
2. **Step through pipeline** manually or auto-advance
3. **See which path** the deal takes at each condition
4. **Verify AI actions** would trigger correctly
5. **No real actions taken** (emails not sent, tasks not created)

### Validation Rules

Before publishing, validate:

- [ ] At least one trigger node
- [ ] At least one exit node
- [ ] All nodes connected (no orphans)
- [ ] All condition outputs have connections
- [ ] No infinite loops without exit conditions
- [ ] All required config fields populated

---

## Success Metrics

- Time to create pipeline (target: <15 min for basic)
- Pipeline complexity (avg nodes, conditions)
- AI action adoption rate
- Custom node creation rate
- Deal flow accuracy (predicted vs actual path)
- Conversion rate improvement after pipeline optimization
