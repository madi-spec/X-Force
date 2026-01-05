# Process Studio Workflow Builder - Claude Code Implementation Prompts

Use these prompts in sequence to build the Workflow Builder feature for Process Studio. Each prompt builds on the previous phase.

**Context:** The Workflow Builder is accessed from Process Studio and supports 4 process types:
- Sales Process (deals)
- Onboarding Milestones (new customers)
- Support Playbooks (tickets)
- Engagement Plays (existing customers)

---

## Phase 1: Core Canvas Infrastructure

### Prompt 1.1: Canvas Foundation

```
I need to build a visual workflow builder for our Process Studio feature. This editor is accessed when clicking "Configure process" on any of the four process types (Sales, Onboarding, Support, Engagement) within a product.

**Create the core canvas infrastructure:**

1. **New route**: `/process-studio/:productId/:processType/builder`
   - processType is one of: 'sales', 'onboarding', 'support', 'engagement'
   - The builder should know which type it's editing and adapt accordingly

2. **Page layout** (three columns):
   - Left: Toolbox panel (260px fixed width)
   - Center: Infinite canvas with pan/zoom
   - Right: Config panel (320px, shows when node selected)

3. **Canvas features**:
   - Use React Flow (https://reactflow.dev/) for the node-based canvas, or build custom if you prefer more control
   - Dot grid background (24px spacing)
   - Pan with mouse drag on empty space
   - Zoom with scroll wheel (50% - 200% range)
   - Zoom controls in bottom-left corner (-, %, +, fit)

4. **Header**:
   - Back link: "← Process Studio"
   - Breadcrumb: [Product Name] › [Process Type Name]
   - Process name (editable inline)
   - Status badge showing count (adapts by type):
     - Sales: "X active deals"
     - Onboarding: "X customers onboarding"
     - Support: "X open tickets"
     - Engagement: "X monitored accounts"
   - Test button (disabled for now)
   - Publish button (disabled for now)

5. **State management**:
   - Use React context or Zustand for process state
   - Track: processType, nodes[], connections[], selectedNodeId, zoom, pan position

6. **Process type context**:
   - Create a ProcessTypeContext that provides:
     - processType: string
     - entityName: string (deal/customer/ticket/account)
     - entityNamePlural: string
     - defaultNodes: filtered by process type
     - metrics configuration

Follow our existing design system (light mode):
- Background: #f8fafc
- Cards: #ffffff with border #e2e8f0
- Use existing component patterns from the codebase

Don't implement node types or toolbox items yet - just get the canvas infrastructure working with placeholder content.
```

### Prompt 1.2: Node System

```
Now let's implement the node system for the workflow builder with process-type awareness.

**Node type definitions** - Create a configuration file with process-specific nodes:

```typescript
// Core node categories (same across all process types)
const nodeCategories = {
  trigger: { 
    label: 'Triggers', 
    color: '#f97316', 
    bg: 'rgba(249, 115, 22, 0.12)',
    icon: '⚡'
  },
  stage: { 
    label: 'Stages', 
    color: '#3b82f6', 
    bg: 'rgba(59, 130, 246, 0.12)',
    icon: '📋'
  },
  condition: { 
    label: 'Conditions', 
    color: '#eab308', 
    bg: 'rgba(234, 179, 8, 0.12)',
    icon: '🔀'
  },
  aiAction: { 
    label: 'AI Actions', 
    color: '#a855f7', 
    bg: 'rgba(168, 85, 247, 0.12)',
    icon: '✨'
  },
  humanAction: { 
    label: 'Human Actions', 
    color: '#06b6d4', 
    bg: 'rgba(6, 182, 212, 0.12)',
    icon: '👤'
  },
  exit: { 
    label: 'Exits', 
    color: '#10b981', 
    bg: 'rgba(16, 185, 129, 0.12)',
    icon: '🏁'
  },
};

// Process-specific node items
const processNodes = {
  sales: {
    triggers: [
      { id: 'new_lead', label: 'New Lead Created', icon: '📥' },
      { id: 'form_submit', label: 'Form Submitted', icon: '📝' },
      { id: 'call_complete', label: 'Call Completed', icon: '📞' },
      { id: 'email_replied', label: 'Email Replied', icon: '📧' },
      { id: 'meeting_complete', label: 'Meeting Completed', icon: '🤝' },
      { id: 'trial_started', label: 'Trial Started', icon: '🚀' },
    ],
    stages: [
      { id: 'engaging', label: 'Actively Engaging', icon: '1' },
      { id: 'demo_scheduled', label: 'Demo Scheduled', icon: '2' },
      { id: 'demo_complete', label: 'Demo Complete', icon: '3' },
      { id: 'trial', label: 'Trial', icon: '4' },
      { id: 'proposal', label: 'Proposal', icon: '5' },
    ],
    conditions: [
      { id: 'lead_score', label: 'Lead Score Check', icon: '📊' },
      { id: 'company_size', label: 'Company Size', icon: '🏢' },
      { id: 'response_time', label: 'Response Time', icon: '⏱️' },
      { id: 'decision_maker', label: 'Decision Maker?', icon: '👔' },
    ],
    aiActions: [
      { id: 'ai_scheduler', label: 'AI Scheduler', icon: '📅' },
      { id: 'ai_followup', label: 'AI Follow-up', icon: '📧' },
      { id: 'ai_objection', label: 'AI Objection Handler', icon: '🛡️' },
      { id: 'ai_analysis', label: 'AI Call Analysis', icon: '🎯' },
    ],
    exits: [
      { id: 'won', label: 'Closed Won', icon: '🎉' },
      { id: 'lost', label: 'Closed Lost', icon: '📉', color: '#ef4444' },
      { id: 'disqualified', label: 'Disqualified', icon: '🚫', color: '#ef4444' },
      { id: 'nurture', label: 'Send to Nurture', icon: '🌱' },
    ],
  },
  
  onboarding: {
    triggers: [
      { id: 'contract_signed', label: 'Contract Signed', icon: '✍️' },
      { id: 'account_created', label: 'Account Created', icon: '👤' },
      { id: 'first_login', label: 'First Login', icon: '🔑' },
      { id: 'integration_connected', label: 'Integration Connected', icon: '🔗' },
      { id: 'milestone_completed', label: 'Milestone Completed', icon: '✅' },
    ],
    stages: [
      { id: 'welcome', label: 'Welcome / Kickoff', icon: '1' },
      { id: 'technical_setup', label: 'Technical Setup', icon: '2' },
      { id: 'training_scheduled', label: 'Training Scheduled', icon: '3' },
      { id: 'training_complete', label: 'Training Complete', icon: '4' },
      { id: 'go_live', label: 'Go-Live', icon: '5' },
      { id: 'adoption_review', label: 'Adoption Review', icon: '6' },
    ],
    aiActions: [
      { id: 'ai_training_rec', label: 'AI Training Recommendation', icon: '📚' },
      { id: 'ai_setup_assist', label: 'AI Setup Assistant', icon: '🔧' },
      { id: 'ai_health_check', label: 'AI Health Check', icon: '💊' },
    ],
    exits: [
      { id: 'onboarded', label: 'Successfully Onboarded', icon: '🎉' },
      { id: 'stalled', label: 'Onboarding Stalled', icon: '⏸️', color: '#f97316' },
      { id: 'churned', label: 'Churned During Onboarding', icon: '📉', color: '#ef4444' },
    ],
  },
  
  support: {
    triggers: [
      { id: 'ticket_created', label: 'Ticket Created', icon: '🎫' },
      { id: 'severity_changed', label: 'Severity Changed', icon: '⚠️' },
      { id: 'sla_warning', label: 'SLA Warning', icon: '⏰' },
      { id: 'sla_breach', label: 'SLA Breach', icon: '🚨' },
      { id: 'customer_replied', label: 'Customer Replied', icon: '💬' },
      { id: 'escalation_requested', label: 'Escalation Requested', icon: '📢' },
    ],
    stages: [
      { id: 'triage', label: 'New / Triage', icon: '1' },
      { id: 'assigned', label: 'Assigned', icon: '2' },
      { id: 'in_progress', label: 'In Progress', icon: '3' },
      { id: 'waiting_customer', label: 'Waiting on Customer', icon: '4' },
      { id: 'waiting_internal', label: 'Waiting on Internal', icon: '5' },
      { id: 'pending_resolution', label: 'Pending Resolution', icon: '6' },
    ],
    conditions: [
      { id: 'severity', label: 'Severity Level', icon: '🔴' },
      { id: 'customer_tier', label: 'Customer Tier', icon: '⭐' },
      { id: 'issue_category', label: 'Issue Category', icon: '📁' },
      { id: 'sla_status', label: 'SLA Status', icon: '⏱️' },
    ],
    aiActions: [
      { id: 'ai_classifier', label: 'AI Ticket Classifier', icon: '🏷️' },
      { id: 'ai_solution', label: 'AI Solution Suggester', icon: '💡' },
      { id: 'ai_response', label: 'AI Response Drafter', icon: '✍️' },
      { id: 'ai_escalation', label: 'AI Escalation Predictor', icon: '📈' },
    ],
    exits: [
      { id: 'resolved', label: 'Resolved', icon: '✅' },
      { id: 'closed_no_response', label: 'Closed - No Response', icon: '🔇' },
      { id: 'escalated', label: 'Escalated to Engineering', icon: '👨‍💻' },
      { id: 'duplicate', label: 'Merged / Duplicate', icon: '🔗' },
    ],
  },
  
  engagement: {
    triggers: [
      { id: 'health_changed', label: 'Health Score Changed', icon: '💓' },
      { id: 'usage_dropped', label: 'Usage Dropped', icon: '📉' },
      { id: 'nps_received', label: 'NPS Response Received', icon: '📊' },
      { id: 'renewal_approaching', label: 'Renewal Approaching', icon: '📅' },
      { id: 'tickets_spike', label: 'Support Tickets Spike', icon: '🎫' },
      { id: 'champion_left', label: 'Champion Left Company', icon: '👋' },
      { id: 'expansion_opportunity', label: 'Expansion Opportunity', icon: '🚀' },
    ],
    stages: [
      { id: 'monitoring', label: 'Monitoring', icon: '👁️' },
      { id: 'at_risk', label: 'At Risk Identified', icon: '⚠️' },
      { id: 'intervention', label: 'Intervention Active', icon: '🩹' },
      { id: 'stabilizing', label: 'Stabilizing', icon: '📈' },
      { id: 'expansion', label: 'Expansion Discussion', icon: '💰' },
      { id: 'renewal', label: 'Renewal Negotiation', icon: '📝' },
    ],
    conditions: [
      { id: 'health_score', label: 'Health Score Range', icon: '💓' },
      { id: 'days_to_renewal', label: 'Days Until Renewal', icon: '📅' },
      { id: 'usage_trend', label: 'Usage Trend', icon: '📊' },
      { id: 'nps_score', label: 'NPS Score', icon: '⭐' },
    ],
    aiActions: [
      { id: 'ai_churn_predictor', label: 'AI Churn Predictor', icon: '🔮' },
      { id: 'ai_expansion', label: 'AI Expansion Identifier', icon: '🎯' },
      { id: 'ai_health_calc', label: 'AI Health Calculator', icon: '💊' },
      { id: 'ai_winback', label: 'AI Win-Back Campaign', icon: '🔄' },
    ],
    exits: [
      { id: 'renewed', label: 'Renewed', icon: '🎉' },
      { id: 'expanded', label: 'Expanded', icon: '📈' },
      { id: 'churned', label: 'Churned', icon: '📉', color: '#ef4444' },
      { id: 'downgraded', label: 'Downgraded', icon: '📉', color: '#f97316' },
      { id: 'saved', label: 'Saved (was at-risk)', icon: '💪' },
    ],
  },
};

// Common nodes available to all process types
const commonNodes = {
  conditions: [
    { id: 'time_in_stage', label: 'Time in Stage', icon: '⏱️' },
    { id: 'custom_field', label: 'Custom Field Check', icon: '📋' },
    { id: 'tag_check', label: 'Tag Check', icon: '🏷️' },
  ],
  humanActions: [
    { id: 'create_task', label: 'Create Task', icon: '✅' },
    { id: 'send_notification', label: 'Send Notification', icon: '🔔' },
    { id: 'assign_user', label: 'Assign to User', icon: '👤' },
    { id: 'send_email', label: 'Send Email Template', icon: '📧' },
    { id: 'add_tag', label: 'Add Tag', icon: '🏷️' },
  ],
  aiActions: [
    { id: 'ai_followup', label: 'AI Follow-up', icon: '📧' },
    { id: 'ai_summary', label: 'AI Summary', icon: '📝' },
    { id: 'ai_sentiment', label: 'AI Sentiment Analysis', icon: '😊' },
  ],
};

// Function to get nodes for a process type
function getNodesForProcessType(processType: string) {
  const specific = processNodes[processType];
  return {
    triggers: specific.triggers,
    stages: specific.stages,
    conditions: [...(specific.conditions || []), ...commonNodes.conditions],
    aiActions: [...specific.aiActions, ...commonNodes.aiActions],
    humanActions: commonNodes.humanActions,
    exits: specific.exits,
  };
}
```

**Node component**:

Create a reusable WorkflowNode component that:
- Has a colored header bar based on node type
- Shows icon and type label in header
- Shows node label in body
- Has connection ports (left input, right output)
- Shows entity count for stage nodes (uses context to show "deals" vs "tickets" vs "customers")
- Has selected state with colored border and shadow
- Is draggable on the canvas
```

### Prompt 1.3: Toolbox Panel

```
Implement the Toolbox panel on the left side of the pipeline builder.

**Structure:**

1. **Header section**:
   - Title: "Pipeline Builder"
   - Subtitle: "Drag nodes to canvas"

2. **Collapsible categories**:
   - Each category (Triggers, Stages, etc.) is a collapsible section
   - Click header to expand/collapse
   - Show category icon and label
   - When expanded, show all node items in that category

3. **Node items** (draggable):
   - Each item shows: icon, label, short description
   - Styled as a card within the category
   - cursor: grab
   - Implement drag-and-drop to canvas using HTML5 drag API or react-dnd

4. **Drag behavior**:
   - On drag start: set dataTransfer with node type and item data
   - On canvas drop: create new node at drop position
   - Visual feedback during drag

5. **Bottom section** (fixed at bottom of toolbox):
   - Divider line
   - "+ Create Custom" button (disabled for now, will implement later)
   - Divider line
   - "AI Pipeline Assistant" card:
     - Purple gradient background
     - Icon ✨
     - Title "AI Pipeline Assistant"
     - Description "Analyze your transcripts to auto-generate optimal pipeline paths."
     - "Analyze & Suggest" button (disabled for now)

**Styling:**
- 260px fixed width
- Background: white
- Border-right: 1px solid #e2e8f0
- Categories have 8px gap between them
- Smooth expand/collapse animation (150ms)
```

### Prompt 1.4: Connections

```
Implement the connection system between nodes.

**Connection creation:**

1. Each node has connection ports:
   - Input port on left side (except Triggers which have no input)
   - Output port on right side (except Exits which have no output)
   - Ports are 12px circles, visible on hover or when connecting

2. To create a connection:
   - Click and drag from an output port
   - Show a temporary line following the cursor
   - Drop on another node's input port to complete
   - Validate: can't connect output to output, must follow connection rules

3. **Connection rules:**
   - Triggers: output only
   - Exits: input only
   - Stages: one input, one default output, plus can branch to exits
   - Conditions: one input, multiple outputs (one per branch)
   - Actions: one input, one output

**Connection rendering:**

- Use SVG for connection lines
- Bezier curves (not straight lines) for smooth appearance
- Default color: #e2e8f0
- Can be colored (for conditional branches)
- Can have labels (shown on a small pill at midpoint)
- Hover state: highlight the connection
- Click to select a connection (show delete option)

**Connection data structure:**
```typescript
interface Connection {
  id: string;
  fromNodeId: string;
  fromPort: string; // 'default' or branch id
  toNodeId: string;
  toPort: 'input';
  label?: string;
  color?: string;
}
```

**Visual states:**
- Default: gray line
- Hover: slightly thicker, darker
- Selected: blue highlight
- Dragging new connection: dashed line following cursor
```

### Prompt 1.5: Basic Persistence

```
Add save/load functionality for processes.

**Data model:**

Create database schema (or update existing):

```sql
-- Processes table (one per product per type)
CREATE TABLE processes (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  process_type VARCHAR(50) NOT NULL, -- 'sales', 'onboarding', 'support', 'engagement'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, archived
  version INT DEFAULT 1,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(product_id, process_type) -- One process per type per product
);

-- Process nodes
CREATE TABLE process_nodes (
  id UUID PRIMARY KEY,
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- trigger, stage, condition, aiAction, humanAction, exit
  item_id VARCHAR(100) NOT NULL, -- Reference to node template
  label VARCHAR(255) NOT NULL,
  position_x INT NOT NULL,
  position_y INT NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Process connections
CREATE TABLE process_connections (
  id UUID PRIMARY KEY,
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  from_node_id UUID REFERENCES process_nodes(id) ON DELETE CASCADE,
  from_port VARCHAR(100) DEFAULT 'default',
  to_node_id UUID REFERENCES process_nodes(id) ON DELETE CASCADE,
  to_port VARCHAR(100) DEFAULT 'input',
  label VARCHAR(255),
  color VARCHAR(50),
  style VARCHAR(50) DEFAULT 'solid'
);
```

**API endpoints:**

- GET /api/products/:productId/processes/:processType - Get process for product/type
- POST /api/products/:productId/processes/:processType - Create process
- PUT /api/products/:productId/processes/:processType - Update process (nodes, connections, settings)
- POST /api/products/:productId/processes/:processType/publish - Set status to active

**Auto-save:**

- Debounced save (500ms after last change)
- Show "Saving..." / "Saved" indicator in header
- Save node positions, connections, and config on change

**Load on mount:**

- Fetch process data when page loads using productId and processType from URL
- If no process exists for this product/type, start with empty canvas
- Restore all nodes and connections to canvas
- Set process type context so toolbox shows correct nodes
```

---

## Phase 2: Configuration Panels

### Prompt 2.1: Config Panel Framework

```
Implement the right-side configuration panel that appears when a node is selected.

**Panel structure:**

1. **Container:**
   - 320px fixed width
   - Slides in from right when node selected
   - Closes when clicking canvas or X button
   - White background, left border

2. **Header:**
   - Node icon and type badge (colored)
   - Node label (larger text)
   - Close button (X)

3. **Content area:**
   - Scrollable
   - Different content based on node type
   - Padding: 20px

4. **Footer:**
   - Delete button (red, outline style)
   - Save Changes button (primary blue)
   - Sticky at bottom

**Create a base ConfigPanel component that:**
- Receives the selected node
- Renders the appropriate config form based on node.type
- Handles save and delete actions
- Shows unsaved changes indicator

**Placeholder forms for each type:**
- TriggerConfig
- StageConfig
- ConditionConfig
- AIActionConfig
- HumanActionConfig
- ExitConfig

For now, just implement name editing for all types. We'll add type-specific fields in the next prompts.
```

### Prompt 2.2: Stage Configuration

```
Implement the full configuration panel for Stage nodes.

**Fields:**

1. **Stage Name** (text input)
   - The display label for this stage

2. **Goal** (text input)
   - What should be accomplished at this stage
   - Placeholder: "e.g., Get their attention and schedule a demo"

3. **Exit Criteria** (text input)
   - What triggers moving to the next stage
   - Placeholder: "e.g., Demo scheduled"

4. **AI Automation toggle section:**
   - Purple background card
   - Toggle switch (on/off)
   - Title: "AI Automation"
   - Description: "AI will automatically send follow-ups and analyze calls for deals in this stage"
   - When enabled, show additional options:
     - Days before AI follow-up (number input, default 3)
     - Auto-analyze calls (checkbox)

5. **Stage Content section:**
   - Header: "STAGE CONTENT"
   - Three clickable rows:
     - 💬 Pitch Points (count badge) →
     - 🛡️ Objection Handlers (count badge) →
     - 📎 Resources (count badge) →
   - Clicking opens a sub-panel or modal to manage that content

6. **Generate from Transcripts button:**
   - Full width
   - Purple gradient background
   - Icon ✨
   - Text: "Generate from Transcripts"
   - Disabled for now (will implement in AI phase)

**Stage Content sub-panels:**

When clicking Pitch Points, Objection Handlers, or Resources:

- Show list of existing items
- Each item has: title, content preview, edit/delete buttons
- "Add" button at bottom
- Back button to return to main config

**Data structure for stage config:**
```typescript
interface StageConfig {
  goal: string;
  exitCriteria: string;
  aiAutomation: {
    enabled: boolean;
    followUpDays: number;
    autoAnalyzeCalls: boolean;
  };
  pitchPoints: Array<{ id: string; title: string; content: string }>;
  objectionHandlers: Array<{ id: string; objection: string; response: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
}
```
```

### Prompt 2.3: Condition Configuration

```
Implement the configuration panel for Condition nodes with a rule builder.

**Fields:**

1. **Condition Name** (text input)

2. **Logic selector:**
   - Toggle between AND / OR
   - Affects how multiple rules combine

3. **Rules section:**
   - Header: "RULES"
   - List of rule rows, each containing:
     - Field dropdown (Lead Score, Company Size, Days Since Contact, etc.)
     - Operator dropdown (depends on field type)
     - Value input (type depends on field)
     - Delete button (×)
   - "+ Add Rule" button at bottom

4. **Output Branches section:**
   - Header: "OUTPUT BRANCHES"
   - List of branch rows:
     - Color dot (editable, color picker)
     - Label input (e.g., "Hot (80+)")
     - Delete button (×, minimum 2 branches)
   - "+ Add Branch" button

**Available fields for rules:**

```typescript
const conditionFields = [
  { id: 'lead_score', label: 'Lead Score', type: 'number' },
  { id: 'company_size', label: 'Company Size (employees)', type: 'number' },
  { id: 'deal_value', label: 'Deal Value', type: 'currency' },
  { id: 'days_in_stage', label: 'Days in Current Stage', type: 'number' },
  { id: 'days_since_contact', label: 'Days Since Last Contact', type: 'number' },
  { id: 'response_time', label: 'Response Time (hours)', type: 'number' },
  { id: 'decision_maker', label: 'Is Decision Maker', type: 'boolean' },
  { id: 'budget_confirmed', label: 'Budget Confirmed', type: 'boolean' },
  { id: 'has_competitor', label: 'Competitor Mentioned', type: 'boolean' },
  { id: 'industry', label: 'Industry', type: 'select', options: ['Pest Control', 'Lawn Care', 'Both'] },
  { id: 'source', label: 'Lead Source', type: 'select', options: ['Website', 'Referral', 'Trade Show', 'Cold Outreach'] },
];
```

**Operators by type:**
- number: =, ≠, >, ≥, <, ≤, between
- currency: same as number
- boolean: is true, is false
- select: is, is not, is one of

**Data structure:**
```typescript
interface ConditionConfig {
  logic: 'AND' | 'OR';
  rules: Array<{
    id: string;
    field: string;
    operator: string;
    value: any;
  }>;
  outputs: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}
```

**Important:** When a condition node has multiple outputs, each output becomes a separate connection port. The canvas needs to show these ports and allow connecting each to different downstream nodes.
```

### Prompt 2.4: AI Action Configuration

```
Implement the configuration panel for AI Action nodes.

**Common fields for all AI actions:**

1. **Action Name** (text input)

2. **AI Enabled toggle:**
   - Purple card background
   - Toggle switch
   - When ON: "This action runs automatically"
   - When OFF: "Creates a task for rep review"

**Type-specific fields:**

**AI Scheduler:**
- Meeting Type dropdown: Discovery Call, Product Demo, Follow-up, Technical Discussion, Executive Briefing
- Duration dropdown: 15 min, 30 min, 45 min, 60 min
- Scheduling Window: Next 7 days, Next 14 days, Next 30 days
- Preferred Times (multi-select): Morning, Afternoon, Evening
- Days to Avoid (multi-select): Mon, Tue, Wed, Thu, Fri
- Fallback Action: Create task for rep, Skip, Retry in X days

**AI Follow-up:**
- Email Type: Check-in, Value reminder, Urgency, Re-engagement
- Tone: Professional, Friendly, Direct
- Include: (checkboxes) Meeting link, Case studies, Pricing info
- Delay: Send immediately, Wait 1 day, Wait 3 days

**AI Nurture:**
- Sequence Length: 4 emails, 8 emails, 12 emails
- Frequency: Weekly, Bi-weekly, Monthly
- Content Focus: Educational, Product updates, Success stories, Mixed
- Exit on: Reply received, Meeting scheduled, Unsubscribe

**AI Call Analysis:**
- Analyze for: (checkboxes) Objections, Sentiment, Next steps, Competitor mentions, Buying signals
- Auto-update: Lead score, Deal notes, Tags
- Alert on: Negative sentiment, Competitor mention, Urgent request

**AI Meeting Prep:**
- Include: (checkboxes) Company research, Contact history, Suggested talking points, Objection prep
- Delivery: Email to rep, In-app notification, Both

**Data structure:**
```typescript
interface AIActionConfig {
  enabled: boolean;
  // Type-specific config varies
  [key: string]: any;
}
```

**Advanced Settings link:**
- Expands to show:
  - Custom prompt override (textarea)
  - Model selection (if we want to expose this)
  - Timeout settings
```

### Prompt 2.5: Human Action and Exit Configuration

```
Implement configuration panels for Human Action and Exit nodes.

**Human Action Config:**

1. **Action Name** (text input)

2. **Task Type dropdown:**
   - Call
   - Email
   - Meeting
   - Review
   - Custom

3. **Assignment section:**
   - Assign To dropdown:
     - Deal Owner (default)
     - Specific User (shows user picker)
     - Role (shows role picker: Sales Rep, Manager, Solutions Engineer)
     - Round Robin

4. **Task Details:**
   - Due In: (number + unit) e.g., "2 days", "4 hours"
   - Priority: Low, Medium, High, Urgent
   - Description template (textarea with variable support: {{contact.name}}, {{deal.name}}, etc.)

5. **Notifications:**
   - Notify via: (checkboxes) Email, In-app, Slack
   - Escalate if not completed in: (number + unit)

**Exit Config:**

1. **Exit Name** (text input)

2. **Exit Type dropdown:**
   - Won
   - Lost
   - Disqualified
   - Nurture
   - Custom

3. **For Won:**
   - Celebration notification (toggle)
   - Auto-create onboarding task (toggle)
   - Update CRM status to: (dropdown)

4. **For Lost:**
   - Require loss reason (toggle)
   - Loss reason options: (editable list) Price, Timing, Competitor, No Decision, Not a Fit, Other
   - Send to win-back campaign after: Never, 30 days, 60 days, 90 days

5. **For Disqualified:**
   - Require reason (toggle)
   - Disqualification reasons: (editable list)
   - Allow re-qualification (toggle)

6. **For Nurture:**
   - Nurture sequence to use: (dropdown of AI Nurture sequences)
   - Re-entry point: (dropdown of stages in this pipeline)
   - Re-entry trigger: Reply received, Meeting scheduled, Score increase

**Color picker** for custom exits (small color swatches to choose from)
```

---

## Phase 3: Custom Node Creation

### Prompt 3.1: Custom Node Creator Modal

```
Implement the ability to create custom nodes.

**Trigger:** Click "+ Create Custom" button in toolbox

**Modal flow (multi-step):**

**Step 1: Choose Type**
- Title: "Create Custom Node"
- Radio buttons for each node type:
  - ⚡ Trigger - "Start a flow when something happens"
  - 📋 Stage - "A step where deals wait"
  - 🔀 Condition - "Route deals based on rules"
  - ✨ AI Action - "Automated AI operation"
  - 👤 Human Action - "Task for your team"
  - 🏁 Exit - "End state for deals"
- Next button

**Step 2: Basic Info**
- Name (required)
- Description (optional)
- Icon picker:
  - Grid of emoji options (common business/sales emojis)
  - Or "Upload custom" option
- Color override (optional, otherwise uses category default)
- Back / Next buttons

**Step 3: Configuration (varies by type)**

For Custom Trigger:
- Source type: Webhook, Integration, Manual, Scheduled
- If Webhook: show generated webhook URL
- If Scheduled: cron expression or simple scheduler (daily at X, weekly on Y)
- Filter conditions (optional): only trigger if [field] [operator] [value]

For Custom Condition:
- Pre-populate rule builder (same as condition config)
- Define default outputs

For Custom AI Action:
- Prompt template (textarea with variable hints)
- Input variables needed
- Output format
- Auto-execute or require approval

For Custom Human Action:
- Default task type
- Default assignment
- Template fields

For Custom Exit:
- Exit behavior (same as exit config)

**Step 4: Review & Create**
- Summary of what will be created
- "Create Node" button
- Success: modal closes, new node appears in toolbox under its category with a "Custom" badge

**Storage:**
- Save to custom_node_templates table
- Filter by organization_id so each org has their own custom nodes
```

### Prompt 3.2: Custom Templates Management

```
Add ability to manage custom node templates.

**In Toolbox:**
- Custom nodes appear in their category with a "Custom" badge
- Hover shows edit/delete icons
- Click edit opens the creator modal in edit mode
- Click delete shows confirmation, then removes

**Custom Templates Page:**

Add a new page: `/settings/pipeline-templates` (or under Products settings)

**Layout:**
- Header: "Custom Pipeline Nodes"
- Description: "Create and manage custom nodes for your pipelines"

- Tabs: Triggers | Stages | Conditions | AI Actions | Human Actions | Exits

- Each tab shows:
  - Grid or list of custom templates for that type
  - Each card shows: icon, name, description, created date, usage count
  - Edit and Delete actions
  - "Create New" button

**API endpoints:**
- GET /api/pipeline-templates - List all custom templates
- POST /api/pipeline-templates - Create new template
- PUT /api/pipeline-templates/:id - Update template
- DELETE /api/pipeline-templates/:id - Delete template

**Database:**
```sql
CREATE TABLE custom_node_templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(50),
  config_schema JSONB, -- Defines available config options
  default_config JSONB,
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

**When template is used:**
- Increment usage_count
- Track which pipelines use this template

**When template is deleted:**
- Check if used in any active pipelines
- If yes: show warning "This template is used in X pipelines. Deleting will not remove existing nodes but will prevent creating new ones."
- Soft delete (is_active = false) rather than hard delete
```

---

## Phase 4: Runtime & Analytics

### Prompt 4.1: Live Entity Counts

```
Add live entity counts to stage nodes on the canvas, adapting to process type.

**Requirements:**

1. **Fetch entity counts per stage:**
   - API endpoint: GET /api/processes/:id/stage-counts
   - Returns: { stageNodeId: count }
   - Based on entities currently in each stage

2. **Display on stage nodes:**
   - Large number (24px font, light weight)
   - Entity label below (from process context: "deals" / "customers" / "tickets" / "accounts")
   - Update in real-time (poll every 30 seconds or use websocket)

3. **Metrics bar (bottom of canvas):**
   - Collapsible bar showing process-specific metrics
   - Adapts based on processType:
   
   **Sales:**
   - Active Deals: X
   - Conversion Rate: X%
   - Avg Cycle Time: X days
   - Pipeline Value: $X
   
   **Onboarding:**
   - In Progress: X
   - Completion Rate: X%
   - Avg Time to Value: X days
   - Stalled: X
   
   **Support:**
   - Open Tickets: X
   - Avg Resolution: X hrs
   - SLA Compliance: X%
   - Escalation Rate: X%
   
   **Engagement:**
   - Monitored: X
   - At Risk: X
   - Avg Health Score: X
   - Renewal Pipeline: $X

**API:**
```typescript
GET /api/processes/:id/analytics

Response varies by process type:
{
  processType: 'sales',
  overview: {
    activeCount: 30,
    conversionRate: 68,
    avgCycleTime: 26,
    pipelineValue: 24500
  },
  stages: {
    [nodeId]: {
      entityCount: 12,
      avgTimeInStage: 3.2,
      conversionRate: 75
    }
  }
}
```
```

### Prompt 4.2: Test Mode

```
Implement Test Mode to simulate an entity flowing through the workflow.

**Trigger:** Click "Test" button in header

**Test Mode UI:**

1. **Test Panel** (slides in from right, replaces config panel):
   - Header: "Test Mode" with close button
   - "Create Test [Entity]" section (adapts to process type):
     
     **Sales:** Create Test Deal
     - Deal Name (auto-generated or custom)
     - Lead Score (slider 0-100)
     - Company Size (number)
     - Deal Value (currency)
     
     **Onboarding:** Create Test Customer
     - Customer Name
     - Contract Value
     - Plan Type
     - Integration Count
     
     **Support:** Create Test Ticket
     - Ticket Subject
     - Severity (P1/P2/P3/P4)
     - Customer Tier
     - Issue Category
     
     **Engagement:** Create Test Account
     - Account Name
     - Health Score (0-100)
     - Days Until Renewal
     - Contract Value
   
   - "Start Test" button

2. **Running Test:**
   - Canvas shows the test entity as a pulsing dot
   - Current node highlighted
   - "Step" button to advance manually
   - "Auto-run" toggle to advance automatically (1 step/second)
   - Log panel showing: "Entered [Node Name]" → "Evaluated [Condition]" → "Result: [Branch]" → "Moving to [Next Node]"

3. **At Condition Nodes:**
   - Show which branch was taken and why
   - Display the rule evaluation: "Lead Score (85) >= 80 ✓" or "Severity (P1) = P1 ✓"

4. **At AI Action Nodes:**
   - Show "AI Action would execute: [Action Name]"
   - Don't actually execute (no emails sent, etc.)
   - Show what the action would do

5. **At Exit Node:**
   - Show "Test Complete - [Entity] would be marked as [Exit Type]"
   - Summary of path taken
   - "Run Another Test" button

**Visual feedback:**
- Highlight current node with pulsing border
- Animate connection when entity moves through it
- Gray out branches not taken
- Show checkmarks on completed nodes

**Test Log:**
- Scrollable log of each step
- Timestamp for each action
- Expandable details for condition evaluations
```

---

## Phase 5: AI Features (Future)

### Prompt 5.1: AI Pipeline Assistant

```
Implement the AI Pipeline Assistant that analyzes transcripts and suggests pipeline improvements.

**Trigger:** Click "Analyze & Suggest" button in toolbox

**Modal flow:**

1. **Select Data Source:**
   - "Analyze calls from the last: 30 days / 60 days / 90 days"
   - Filter by: All deals, Won deals only, Lost deals only
   - Minimum calls to analyze: X (show count available)
   - "Start Analysis" button

2. **Analysis Progress:**
   - Progress bar
   - "Analyzing 47 call transcripts..."
   - Show sample insights as they're found

3. **Results:**

   **Suggested Pipeline Structure:**
   - Visual mini-preview of suggested node arrangement
   - "Apply to Canvas" button (adds suggested nodes)
   
   **Condition Suggestions:**
   - "Add 'Lead Score Check' after 'New Lead' - High-scoring leads convert 2.3x faster"
   - "Add 'Response Time' condition - Leads who respond within 24h have 40% higher close rate"
   - Each suggestion has "Add" button
   
   **AI Action Suggestions:**
   - "Add 'AI Follow-up' after 'Demo Scheduled' - 35% of demos have no follow-up within 3 days"
   - "Add 'AI Nurture' for cold leads - Currently 60% of cold leads get no engagement"
   
   **Stage Content Suggestions:**
   - "For 'Actively Engaging' stage:"
     - Pitch Points: [list of suggested]
     - Objections Found: [list with frequency]
   - Each expandable with "Add All" or individual add buttons

4. **Review Applied:**
   - Show what was added
   - Allow undo

**AI Prompt Structure:**

Send to Claude:
- All transcripts from the selected period
- Current pipeline structure
- Ask for:
  1. Patterns in successful vs unsuccessful deals
  2. Common bottlenecks
  3. Suggested conditions and thresholds
  4. Suggested automation points
  5. Pitch points and objections by stage
```

### Prompt 5.2: Generate Stage Content

```
Implement "Generate from Transcripts" for individual stages.

**Trigger:** Click "Generate from Transcripts" button in stage config

**Flow:**

1. **Select Transcripts:**
   - Auto-filter to calls where deal was in this stage
   - Show list with checkboxes to include/exclude
   - Date range filter
   - "Analyze Selected" button

2. **Generation Progress:**
   - "Analyzing 23 calls at [Stage Name] stage..."
   - Progress indicator

3. **Results Panel:**

   **Pitch Points Found:**
   - List of suggested pitch points
   - Each shows:
     - Title
     - Content
     - Confidence score (High/Medium/Low)
     - "Mentioned in X calls"
   - Checkbox to select
   - "Add Selected" button

   **Objections Identified:**
   - List of objections with suggested responses
   - Each shows:
     - Objection text
     - Suggested response
     - Frequency
   - Checkbox to select
   - "Add Selected" button

   **Resources Mentioned:**
   - Case studies, links, docs mentioned in successful calls
   - With frequency count

4. **After Adding:**
   - Items appear in the stage's content lists
   - Can edit individually

**Backend:**
- Use Claude to analyze transcripts
- Extract patterns with confidence scoring
- Return structured data for pitch points, objections, resources
```

---

## Final Integration Notes

### Prompt: Integration Checklist

```
Before considering the Workflow Builder complete, ensure:

**Functionality:**
- [ ] Can access builder from Process Studio for any process type
- [ ] Toolbox shows correct nodes for each process type (sales, onboarding, support, engagement)
- [ ] Can add all node types from toolbox
- [ ] Can connect nodes with proper validation
- [ ] Can configure each node type fully
- [ ] Can create custom node templates (scoped to process types)
- [ ] Saves automatically and reliably
- [ ] Can publish/unpublish process
- [ ] Test mode works correctly with process-specific test entities

**Process Type Awareness:**
- [ ] Header shows correct breadcrumb and entity count
- [ ] Nodes display correct entity terminology (deals/customers/tickets/accounts)
- [ ] Metrics bar shows process-specific metrics
- [ ] Conditions offer process-relevant fields
- [ ] AI actions are appropriate for the process type

**UI/UX:**
- [ ] Follows X-RAI design system (light mode)
- [ ] Responsive toolbox (collapsible on smaller screens)
- [ ] Smooth animations and transitions
- [ ] Clear visual feedback for all actions
- [ ] Keyboard shortcuts (delete, undo, redo)
- [ ] Zoom and pan work smoothly

**Data:**
- [ ] Process data model is complete (includes process_type)
- [ ] API endpoints all working
- [ ] Proper error handling
- [ ] Loading states throughout

**Navigation:**
- [ ] Accessible from Process Studio page
- [ ] Back navigation returns to Process Studio
- [ ] URL reflects product and process type
- [ ] Browser back/forward work

**Future-proofing:**
- [ ] Node type system is extensible
- [ ] Custom nodes can be scoped to specific process types
- [ ] Analytics data structure supports all process types
- [ ] AI features have clear integration points
```

---

## Process Studio Hub Updates

### Prompt: Update Process Studio Page

```
Update the Process Studio page to integrate with the new Workflow Builder.

**Current state:** Process Studio shows products with four process type cards each, clicking "Configure process" goes to the old Proven Process page.

**Changes needed:**

1. **Update "Configure process" click handler:**
   - Instead of going to Proven Process page, navigate to:
   - `/process-studio/:productId/:processType/builder`

2. **Show process status on cards:**
   - If process exists and is active: Show green "Active" badge
   - If process exists but draft: Show yellow "Draft" badge
   - If no process configured: Show "Not configured" in muted text

3. **Show quick metrics on hover or always:**
   - Sales: "X active deals"
   - Onboarding: "X in progress"
   - Support: "X open tickets"
   - Engagement: "X monitored"

4. **Add "View" vs "Configure" actions:**
   - If process is active: Primary action is "View" (read-only canvas)
   - Secondary action: "Edit" (goes to builder)
   - If draft or not configured: Primary action is "Configure"

5. **Process type icons and colors:**
   - Sales: 🟠 Orange
   - Onboarding: 🔵 Blue
   - Support: 🔴 Red
   - Engagement: 💜 Purple

Keep the "By Product" and "By Type" toggle - when viewing "By Type", show all Sales Processes together, etc.
```

---

## Recommended Implementation Order

1. **Phase 1.1**: Canvas Foundation with process type context (2-3 days)
2. **Phase 1.2**: Node System with process-specific nodes (2-3 days)
3. **Phase 1.3**: Toolbox Panel (1 day)
4. **Phase 1.4**: Connections (2 days)
5. **Phase 1.5**: Basic Persistence with process_type (1-2 days)
6. **Process Studio Update**: Update hub page to link to builder (0.5 day)
7. **Phase 2.1**: Config Panel Framework (1 day)
8. **Phase 2.2**: Stage Configuration (1-2 days)
9. **Phase 2.3**: Condition Configuration (2 days)
10. **Phase 2.4**: AI Action Configuration (1-2 days)
11. **Phase 2.5**: Human Action & Exit Configuration (1 day)
12. **Phase 3**: Custom Nodes with process type scoping (2-3 days)
13. **Phase 4**: Runtime & Analytics with process-specific metrics (2-3 days)
14. **Phase 5**: AI Features (3-5 days)

Total estimated: 3-4 weeks for full implementation
