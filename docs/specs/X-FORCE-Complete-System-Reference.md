# X-FORCE: AI-First Sales Operating System

## Vision

X-FORCE is not a CRM. It's a **Sales Decision System** that:

- **AI runs the process** — monitoring, analyzing, drafting, executing
- **Humans handle high-leverage moments** — calls, negotiations, relationships
- **System learns from outcomes** — gets smarter with every deal

The AI should feel like a tireless sales partner that never sleeps, never forgets, and always knows what needs attention.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DECISION INTELLIGENCE LAYER                            │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │ Deal Intelligence │  │ Human Leverage   │  │ Account Memory   │              │
│  │ Engine           │  │ System           │  │                  │              │
│  │                  │  │                  │  │ • What resonates │              │
│  │ • Momentum       │  │ • Trigger detect │  │ • What to avoid  │              │
│  │ • Confidence     │  │ • Stop rules     │  │ • Preferences    │              │
│  │ • Win probability│  │ • Brief generate │  │ • Objections     │              │
│  │ • Economics      │  │ • Outcome track  │  │ • Rapport        │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           AI EXECUTION LAYER                                     │
│                                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Research  │ │    Sales    │ │    Deal     │ │   Content   │              │
│  │   Analyst   │ │  Assistant  │ │   Analyst   │ │  Generator  │              │
│  │             │ │             │ │             │ │             │              │
│  │ • Company   │ │ • Meeting   │ │ • Oppty     │ │ • Emails    │              │
│  │   Research  │ │   Analysis  │ │   Analysis  │ │ • Follow-ups│              │
│  │ • Contact   │ │ • Memory    │ │ • Threat    │ │ • Proposals │              │
│  │   Enrich    │ │   Update    │ │   Analysis  │ │ • Meeting   │              │
│  │             │ │ • Email     │ │ • Postmortem│ │   Prep      │              │
│  │             │ │   Analysis  │ │             │ │             │              │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           LEARNING LAYER                                         │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ Rep Trust       │  │ Trigger         │  │ Pattern         │                 │
│  │ Profiles        │  │ Calibration     │  │ Learnings       │                 │
│  │                 │  │                 │  │                 │                 │
│  │ Weights feedback│  │ Adjusts accuracy│  │ What works by   │                 │
│  │ by rep behavior │  │ over time       │  │ segment         │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                             │
│                                                                                  │
│  INPUTS                              OUTPUTS                                     │
│  ├── Emails (Microsoft)              ├── Human Leverage Briefs                  │
│  ├── Calendar (Microsoft)            ├── Deal Intelligence                      │
│  ├── Meeting transcripts (Fireflies) ├── Email drafts                           │
│  ├── CRM data (companies, deals)     ├── Meeting prep                           │
│  ├── Research (web scraping)         ├── Account strategies                     │
│  └── User actions                    ├── Risk alerts                            │
│                                      └── Win/Loss postmortems                   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Computed Logic Over LLM Orchestration

The Deal Intelligence Engine uses **deterministic code**, not meta-agents:
- Fast (milliseconds, not seconds)
- Predictable (same inputs = same outputs)
- Debuggable (can trace every decision)
- Trustworthy (no hallucinated reasoning)

### 2. Economic Reasoning Everywhere

Every decision is ACV-aware:
- Expected Value = ACV × Win Probability
- Max Human Hours = Expected Value / Rep Hourly Rate
- Investment Level determines automation vs human action

### 3. Human Leverage, Not Human Labor

AI handles 90% of work. Humans handle the 10% that matters:
- Relationship repair
- Executive introductions
- Competitive positioning
- Negotiation

### 4. Visible Learning

The system shows its work:
- Confidence bands, not false precision
- Trust basis for every recommendation
- "What We've Learned" per account
- Knows when it doesn't know

### 5. Stop Rules Prevent Nagging

Strict limits on AI interruptions:
- Max 2 leverage moments per day
- Cooldowns after human action
- Economic thresholds
- Dismissal tracking

---

## Database Schema

### Core CRM Tables

```sql
-- Companies (pest control / lawn care businesses)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  
  -- Classification
  industry TEXT DEFAULT 'pest_control',
  ownership_type TEXT, -- 'family' | 'pe_backed' | 'franchise' | 'independent'
  employee_count INTEGER,
  location_count INTEGER,
  
  -- Status
  status TEXT DEFAULT 'prospect', -- 'prospect' | 'qualified' | 'customer' | 'churned'
  
  -- Recognition
  pct_top_100 BOOLEAN DEFAULT false,
  
  -- Owner info (if known)
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts at companies
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  
  -- Role flags
  is_owner BOOLEAN DEFAULT false,
  is_decision_maker BOOLEAN DEFAULT false,
  is_champion BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  
  -- LinkedIn
  linkedin_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deals (opportunities)
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id),
  
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'prospecting',
  
  -- Value
  amount NUMERIC,
  estimated_value NUMERIC,
  
  -- Dates
  close_date DATE,
  stage_changed_at TIMESTAMP WITH TIME ZONE,
  
  -- Products
  products TEXT[],
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities (emails, calls, meetings, notes)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  
  type TEXT NOT NULL, -- 'email' | 'call' | 'meeting' | 'note' | 'task'
  direction TEXT, -- 'inbound' | 'outbound'
  
  subject TEXT,
  notes TEXT,
  
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Email specific
  email_message_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting transcripts (from Fireflies)
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  activity_id UUID REFERENCES activities(id),
  
  -- Fireflies data
  fireflies_id TEXT,
  title TEXT,
  date TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  -- Content
  content TEXT,
  summary TEXT,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### AI Infrastructure Tables

```sql
-- AI Roles (categories of AI agents)
CREATE TABLE ai_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  persona TEXT, -- Personality/approach for this role
  icon TEXT,
  category TEXT, -- 'research' | 'sales' | 'admin' | 'analysis'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Jobs (editable prompts)
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES ai_roles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- The prompt (editable in app)
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,
  
  -- Output configuration
  response_schema JSONB,
  response_format TEXT DEFAULT 'json', -- 'json' | 'markdown' | 'text'
  
  -- Execution configuration
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4000,
  temperature NUMERIC DEFAULT 0,
  
  -- Variables
  available_variables TEXT[], -- What can be injected
  required_variables TEXT[], -- What must be present
  computed_context_required TEXT[], -- ['dealIntelligence', 'economicContext', 'accountMemory', 'triggerData', 'trustBasis']
  
  -- Triggers
  trigger_type TEXT DEFAULT 'manual', -- 'manual' | 'auto' | 'scheduled' | 'computed_trigger'
  trigger_config JSONB, -- { event: 'transcript.created' } or { cron: '0 8 * * *' }
  
  -- Context sources
  context_sources TEXT[], -- ['company', 'contacts', 'deal', 'activities', 'research', 'transcript']
  
  -- UI placement
  button_label TEXT,
  icon TEXT,
  show_in_company_card BOOLEAN DEFAULT false,
  show_in_contact_card BOOLEAN DEFAULT false,
  show_in_deal_card BOOLEAN DEFAULT false,
  show_in_inbox BOOLEAN DEFAULT false,
  
  -- Classification
  job_category TEXT DEFAULT 'general', -- 'general' | 'leverage_brief' | 'memory_update' | 'deal_analysis' | 'transcript' | 'email'
  
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(role_id, slug)
);

-- Map computed triggers to jobs
CREATE TABLE computed_trigger_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL, -- 'relationship_repair', 'exec_intro', 'competitive_threat'
  job_id UUID REFERENCES ai_jobs(id) ON DELETE CASCADE,
  min_confidence INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job execution history
CREATE TABLE ai_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ai_jobs(id),
  
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  
  input_context JSONB,
  output JSONB,
  output_raw TEXT,
  
  status TEXT DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  error_message TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  tokens_used INTEGER,
  
  triggered_by UUID REFERENCES users(id),
  trigger_type TEXT,
  trigger_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Deal Intelligence Tables

```sql
-- Computed deal state (replaces simple health scores)
CREATE TABLE deal_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  
  -- Stage & Time
  stage TEXT NOT NULL,
  days_in_stage INTEGER,
  total_days INTEGER,
  
  -- Momentum
  momentum TEXT CHECK (momentum IN ('accelerating', 'stable', 'stalling', 'dead')),
  momentum_score INTEGER, -- -100 to +100
  momentum_signals JSONB DEFAULT '[]',
  
  -- Confidence Factors (MEDDIC-aligned, 0-100 each)
  confidence_engagement INTEGER DEFAULT 0,
  confidence_champion INTEGER DEFAULT 0,
  confidence_authority INTEGER DEFAULT 0,
  confidence_need INTEGER DEFAULT 0,
  confidence_timeline INTEGER DEFAULT 0,
  
  -- Win Probability with confidence bands
  win_probability INTEGER DEFAULT 25,
  win_probability_low INTEGER,
  win_probability_high INTEGER,
  win_probability_trend TEXT, -- 'up' | 'down' | 'stable'
  probability_factors JSONB DEFAULT '[]', -- What's driving uncertainty
  
  -- Uncertainty state
  is_uncertain BOOLEAN DEFAULT false,
  uncertainty_reason TEXT,
  uncertainty_suggested_action TEXT,
  
  -- Economics
  estimated_acv NUMERIC,
  expected_value NUMERIC,
  investment_level TEXT, -- 'high' | 'medium' | 'low' | 'minimal'
  max_human_hours NUMERIC,
  human_hours_spent NUMERIC DEFAULT 0,
  cost_of_delay_per_week NUMERIC,
  
  -- Risk
  risk_factors JSONB DEFAULT '[]',
  stall_reasons JSONB DEFAULT '[]',
  
  -- Next actions
  next_actions JSONB DEFAULT '[]',
  
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company research cache
CREATE TABLE company_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  
  researched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  agent_version TEXT DEFAULT '6.1',
  confidence_score INTEGER,
  duration_seconds INTEGER,
  tool_calls INTEGER,
  findings_count INTEGER,
  
  status TEXT DEFAULT 'complete',
  error_message TEXT,
  research_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Human Leverage Tables

```sql
-- Human leverage moments (the killer feature)
CREATE TABLE human_leverage_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Classification
  type TEXT NOT NULL, -- 'relationship_repair', 'exec_intro', 'competitive_threat', 'pricing_exception'
  urgency TEXT CHECK (urgency IN ('immediate', 'today', 'this_week', 'before_next_milestone')),
  required_role TEXT CHECK (required_role IN ('rep', 'sales_manager', 'exec', 'founder')),
  
  -- Confidence with bands
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  confidence_low INTEGER,
  confidence_high INTEGER,
  confidence_label TEXT, -- "Most likely 72% (ranges 55-88%)"
  confidence_factors JSONB DEFAULT '[]',
  
  -- Trust basis (why rep should listen)
  trust_basis JSONB NOT NULL, -- { historical_accuracy, similar_outcomes, signal_sources, data_points }
  
  -- The Brief
  situation TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  what_ai_did TEXT NOT NULL,
  what_human_must_do TEXT NOT NULL,
  why_human TEXT NOT NULL,
  talking_points JSONB DEFAULT '[]',
  data_points JSONB DEFAULT '[]',
  avoid JSONB DEFAULT '[]',
  success_criteria TEXT,
  if_unsuccessful TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending' | 'acknowledged' | 'completed' | 'dismissed'
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,
  
  -- Outcome (for learning)
  outcome TEXT CHECK (outcome IN ('successful', 'unsuccessful', 'unknown')),
  outcome_notes TEXT,
  
  -- Generation
  generated_by_job_id UUID REFERENCES ai_jobs(id),
  trigger_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);
```

### Account Memory Tables

```sql
-- What we've learned about each account
CREATE TABLE account_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  -- What works
  resonates JSONB DEFAULT '[]', -- ["growth story", "tech modernization", "competitor displacement"]
  effective_angles JSONB DEFAULT '[]',
  
  -- What doesn't work
  avoided JSONB DEFAULT '[]', -- ["cost savings framing", "cold ROI numbers"]
  failed_approaches JSONB DEFAULT '[]',
  
  -- Communication preferences
  preferred_channel TEXT, -- 'phone' | 'email' | 'linkedin' | 'video'
  response_pattern TEXT, -- 'quick' | 'deliberate' | 'sporadic'
  formality_level TEXT, -- 'formal' | 'casual' | 'mixed'
  best_time_to_reach TEXT,
  
  -- Decision style
  decision_style TEXT, -- 'owner_led' | 'consensus' | 'committee' | 'financial'
  typical_timeline TEXT,
  key_concerns TEXT[],
  
  -- Objections & what worked
  objections_encountered JSONB DEFAULT '[]', -- [{ objection, response_that_worked, date, resolved }]
  
  -- Rapport builders
  rapport_builders TEXT[], -- ["golf", "kids same school", "UNC fan", "ex-military"]
  personal_notes JSONB DEFAULT '[]',
  
  -- From outcomes
  last_win_theme TEXT,
  last_loss_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trail for memory updates
CREATE TABLE account_memory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_memory_id UUID REFERENCES account_memory(id) ON DELETE CASCADE,
  
  field_updated TEXT,
  old_value JSONB,
  new_value JSONB,
  
  source TEXT, -- 'meeting_analysis' | 'email_analysis' | 'manual' | 'postmortem'
  source_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Learning System Tables

```sql
-- Rep trust profiles (hidden from reps, used to weight feedback)
CREATE TABLE rep_trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Behavior metrics (rolling 90 days)
  moments_received INTEGER DEFAULT 0,
  moments_completed INTEGER DEFAULT 0,
  moments_dismissed INTEGER DEFAULT 0,
  moments_ignored INTEGER DEFAULT 0,
  
  -- Outcome tracking
  completions_successful INTEGER DEFAULT 0,
  completions_unsuccessful INTEGER DEFAULT 0,
  
  -- Override tracking
  overrides_total INTEGER DEFAULT 0,
  overrides_correct INTEGER DEFAULT 0,
  
  -- Computed scores (0-100)
  engagement_score INTEGER,
  accuracy_score INTEGER,
  follow_through_score INTEGER,
  
  -- Trust weight (0.5 to 1.5)
  trust_weight NUMERIC DEFAULT 1.0,
  
  -- Exclude from learning if behavior is poor
  is_learning_excluded BOOLEAN DEFAULT false,
  
  last_computed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI overrides (when humans disagree)
CREATE TABLE ai_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  override_type TEXT NOT NULL, -- 'leverage_moment_dismissed', 'recommendation_rejected', 'stage_override'
  source_type TEXT,
  source_id UUID,
  
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES users(id),
  
  ai_recommendation JSONB,
  human_action JSONB,
  override_reason TEXT,
  
  outcome TEXT, -- 'better' | 'worse' | 'same' | 'unknown'
  outcome_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger accuracy (for calibration)
CREATE TABLE trigger_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL UNIQUE,
  
  total_fired INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,
  
  accuracy_rate NUMERIC,
  completion_rate NUMERIC,
  
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Win/loss postmortems
CREATE TABLE deal_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  
  summary TEXT,
  what_worked JSONB,
  what_didnt_work JSONB,
  turning_points JSONB,
  prediction_accuracy JSONB, -- { predicted, actual, assessment }
  
  full_analysis JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pattern learnings (what works by segment)
CREATE TABLE pattern_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),
  
  ownership_type TEXT,
  company_size_bucket TEXT, -- 'small' | 'medium' | 'large'
  deal_size_bucket TEXT,
  outcome TEXT, -- 'won' | 'lost'
  
  learning TEXT,
  what_worked JSONB,
  what_didnt_work JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_jobs_role ON ai_jobs(role_id);
CREATE INDEX idx_ai_jobs_trigger ON ai_jobs(trigger_type);
CREATE INDEX idx_ai_job_runs_job ON ai_job_runs(job_id);
CREATE INDEX idx_ai_job_runs_company ON ai_job_runs(company_id);
CREATE INDEX idx_ai_job_runs_status ON ai_job_runs(status);
CREATE INDEX idx_deal_intelligence_deal ON deal_intelligence(deal_id);
CREATE INDEX idx_deal_intelligence_momentum ON deal_intelligence(momentum);
CREATE INDEX idx_hlm_company ON human_leverage_moments(company_id);
CREATE INDEX idx_hlm_status ON human_leverage_moments(status);
CREATE INDEX idx_hlm_urgency ON human_leverage_moments(urgency);
CREATE INDEX idx_account_memory_company ON account_memory(company_id);
CREATE INDEX idx_company_research_company ON company_research(company_id);
CREATE INDEX idx_rep_trust_user ON rep_trust_profiles(user_id);
CREATE INDEX idx_pattern_learnings_ownership ON pattern_learnings(ownership_type);
CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_date ON activities(date);
```

---

## AI Roles & Jobs

### Roles

| Role | Slug | Category | Purpose |
|------|------|----------|---------|
| Research Analyst | `research-analyst` | research | Deep company and contact research |
| Sales Assistant | `sales-assistant` | admin | Meeting analysis, email handling, CRM updates |
| Deal Analyst | `deal-analyst` | analysis | Opportunity/threat analysis, postmortems |
| Sales Strategist | `sales-strategist` | sales | Account strategy, meeting prep, leverage briefs |
| SDR | `sdr` | sales | Cold outreach, follow-ups |

### Jobs by Role

#### Research Analyst
| Job | Trigger | Purpose |
|-----|---------|---------|
| Company Deep Research | Manual | Full v6.1 research protocol |
| Contact Enrichment | Manual/Auto | Find email, LinkedIn, background |
| Competitor Research | Manual | Analyze specific competitor |

#### Sales Assistant
| Job | Trigger | Purpose |
|-----|---------|---------|
| Meeting Analysis | Auto (transcript created) | Summarize, extract action items, signals |
| Update Account Memory | Auto (after meeting analysis) | Learn what resonates, objections, preferences |
| Email Analysis | Auto (email received) | Classify, extract intent, suggest response |
| Draft Email Reply | Manual | Write personalized response |

#### Deal Analyst
| Job | Trigger | Purpose |
|-----|---------|---------|
| Deal Opportunity Analysis | Scheduled (daily) | Find upsell, expansion, acceleration |
| Deal Threat Analysis | Scheduled (daily) | Identify risks, stalls, competition |
| Deal Stage Readiness | Manual | Check if ready to advance stage |
| Win/Loss Postmortem | Auto (deal closed) | Extract learnings, update memory |

#### Sales Strategist
| Job | Trigger | Purpose |
|-----|---------|---------|
| Human Leverage Brief | Computed trigger | Frame human action with trust basis |
| Meeting Prep | Auto (day before meeting) | Full prep brief with strategy |
| Account Strategy | Manual | Comprehensive strategic plan |
| Competitive Positioning | Manual | How to win against specific competitor |

#### SDR
| Job | Trigger | Purpose |
|-----|---------|---------|
| Draft Cold Email | Manual | Personalized first-touch email |
| Draft Follow-Up | Auto (no response X days) | Pattern-interrupt follow-up |
| Draft LinkedIn Message | Manual | Connection request / InMail |

---

## Deal Intelligence Engine

### What It Computes

```typescript
interface DealIntelligence {
  // Stage & Time
  stage: string;
  days_in_stage: number;
  total_days: number;
  
  // Momentum
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  momentum_score: number; // -100 to +100
  momentum_signals: MomentumSignal[];
  
  // Confidence Factors (MEDDIC-aligned, 0-100 each)
  confidence: {
    engagement: number;  // Are they responding?
    champion: number;    // Do we have internal advocate?
    authority: number;   // Talking to decision maker?
    need: number;        // Is pain confirmed?
    timeline: number;    // Is there urgency?
  };
  
  // Win Probability with confidence bands
  win_probability: number;
  win_probability_low: number;
  win_probability_high: number;
  probability_factors: string[];
  
  // Uncertainty state
  is_uncertain: boolean;
  uncertainty_reason?: string;
  uncertainty_suggested_action?: string;
  
  // Economics
  economics: {
    estimated_acv: number;
    expected_value: number;
    investment_level: 'high' | 'medium' | 'low' | 'minimal';
    max_human_hours: number;
    human_hours_spent: number;
    cost_of_delay_per_week: number;
  };
  
  // Risk & Actions
  risk_factors: RiskFactor[];
  next_actions: NextAction[];
}
```

### Momentum Calculation

```typescript
// Positive signals
if (inbound_this_week > 2) score += 25;
if (meeting_scheduled) score += 25;
if (stakeholders_engaged >= 3) score += 20;
if (recent_meeting_held) score += 15;

// Negative signals
if (no_inbound_14_days) score -= 30;
if (meetings_cancelled) score -= 20;

// Classification
score >= 30  → 'accelerating'
score >= 0   → 'stable'
score >= -30 → 'stalling'
score < -30  → 'dead'
```

### Economic Context

```typescript
// ACV Multipliers
if (employee_count > 50) mult += 0.3;
if (employee_count > 100) mult += 0.3;
if (location_count > 5) mult += 0.2;
if (location_count > 10) mult += 0.3;
if (ownership_type === 'pe_backed') mult += 0.5;
if (ownership_type === 'franchise') mult -= 0.2;
if (pct_top_100) mult += 0.3;

estimated_acv = base_acv × min(mult, 3.0);
expected_value = estimated_acv × win_probability;
max_human_hours = expected_value / rep_hourly_value;
```

---

## Human Leverage System

### Trigger Types

| Type | Detection | Confidence Range |
|------|-----------|------------------|
| `relationship_repair` | No inbound 10+ days + 2+ outbound attempts | 60-95% |
| `exec_intro` | Authority confidence <50% + not prospecting | 65-95% |
| `competitive_threat` | Competitor mentions + evaluation/proposal stage | 70-85% |
| `pricing_exception` | Price objection + high-value deal | 65-80% |

### Stop Rules

```typescript
const STOP_RULES = {
  max_leverage_flags_per_day: 2,
  max_active_moments_per_deal: 3,
  cooldown_after_human_action_hours: 24,
  cooldown_after_dismiss_hours: 48,
  min_confidence_threshold: 60,
  economic_threshold: 2000, // Don't flag for low-value deals
};
```

### The Brief Structure

Every Human Leverage Brief answers in <60 seconds:

1. **Situation** - What happened? (2-3 sentences with numbers/dates)
2. **Why It Matters** - Business impact with trust basis ("In 83% of similar deals...")
3. **What AI Did** - What automation already tried
4. **What You Should Do** - ONE clear action (WHO and HOW)
5. **Why This Needs You** - Why AI can't do this
6. **Talking Points** (4-5) - Specific things to say, using account memory
7. **What to Avoid** (3-4) - Things NOT to say
8. **Success Criteria** - How to know it worked
9. **If Unsuccessful** - Fallback plan

### Trust Basis

Every recommendation includes historical accuracy:

```typescript
interface TrustBasis {
  historical_accuracy: number; // "78% accuracy"
  similar_outcomes: string;    // "In 78% of deals that went dark, a call re-engaged"
  signal_sources: string[];    // What triggered this
  data_points: any[];         // Supporting data
}
```

---

## Account Memory

### What's Stored

```typescript
interface AccountMemory {
  // What works
  resonates: string[];      // ["growth story", "tech modernization"]
  effective_angles: any[];
  
  // What doesn't work
  avoided: string[];        // ["cost savings framing"]
  failed_approaches: any[];
  
  // Communication
  preferred_channel: 'phone' | 'email' | 'linkedin' | 'video';
  response_pattern: 'quick' | 'deliberate' | 'sporadic';
  formality_level: 'formal' | 'casual' | 'mixed';
  best_time_to_reach: string;
  
  // Decision style
  decision_style: 'owner_led' | 'consensus' | 'committee' | 'financial';
  typical_timeline: string;
  key_concerns: string[];
  
  // Objections
  objections_encountered: Objection[];
  
  // Rapport
  rapport_builders: string[]; // ["golf", "kids same school"]
  personal_notes: any[];
  
  // Outcomes
  last_win_theme: string;
  last_loss_reason: string;
}
```

### Update Sources

| Source | When | What's Extracted |
|--------|------|------------------|
| Meeting Analysis | After every meeting | What resonated, objections, preferences |
| Email Analysis | Ongoing | Communication style, concerns |
| Win/Loss Postmortem | Deal closes | Themes, reasons, patterns |
| Manual | User input | Corrections, additions |

---

## Learning System

### Rep Trust Profiles (Hidden)

Tracks per-rep behavior to weight feedback:

```typescript
interface RepTrustProfile {
  engagement_score: number;     // Do they act on moments?
  accuracy_score: number;       // When they override, are they right?
  follow_through_score: number; // Do they close the loop?
  
  trust_weight: number;         // 0.5 to 1.5
  is_learning_excluded: boolean; // Exclude from calibration if too noisy
}
```

### Calibration

- Track outcomes for every leverage moment
- Update trigger accuracy weekly
- Weight feedback by rep trust
- Adjust thresholds based on data

### Pattern Learnings

After every deal closes, extract:
- What worked for this ownership type
- What worked for this company size
- What worked for this deal size
- Common objections and effective responses

---

## Directory Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── core/
│   │   │   ├── aiClient.ts           # Anthropic client
│   │   │   └── contextBuilder.ts     # Build context for AI calls
│   │   │
│   │   ├── intelligence/
│   │   │   ├── dealIntelligenceEngine.ts  # Computed deal state
│   │   │   ├── momentumCalculator.ts      # Momentum scoring
│   │   │   ├── confidenceCalculator.ts    # Confidence factors
│   │   │   ├── economicsCalculator.ts     # ACV, expected value
│   │   │   └── uncertaintyChecker.ts      # Knows when it doesn't know
│   │   │
│   │   ├── leverage/
│   │   │   ├── stopRules.ts               # Prevent nagging
│   │   │   ├── triggerDetection.ts        # Find leverage moments
│   │   │   ├── briefGenerator.ts          # Generate briefs
│   │   │   └── trustBasis.ts              # Historical accuracy
│   │   │
│   │   ├── memory/
│   │   │   ├── accountMemory.ts           # Read/write memory
│   │   │   └── memoryUpdater.ts           # Apply updates
│   │   │
│   │   ├── jobs/
│   │   │   ├── contextAssembler.ts        # Assemble context for jobs
│   │   │   ├── jobExecutor.ts             # Execute AI jobs
│   │   │   └── variableInjector.ts        # Inject variables into prompts
│   │   │
│   │   ├── learning/
│   │   │   ├── repTrust.ts                # Calculate rep trust
│   │   │   ├── calibration.ts             # Update accuracy
│   │   │   ├── postmortem.ts              # Process win/loss
│   │   │   └── patterns.ts                # Extract patterns
│   │   │
│   │   └── research/
│   │       └── researchAgent.ts           # Company research v6.1
│   │
│   └── schedulers/
│       ├── dealIntelligence.ts            # Hourly deal refresh
│       ├── transcriptProcessor.ts         # Process new transcripts
│       └── dailyAnalysis.ts               # Daily opportunity/threat
│
├── app/
│   └── api/
│       ├── deals/
│       │   └── [dealId]/
│       │       └── intelligence/
│       │           └── route.ts           # GET deal intelligence
│       │
│       ├── leverage-moments/
│       │   ├── route.ts                   # GET pending moments
│       │   └── [id]/
│       │       ├── complete/route.ts      # POST complete
│       │       └── dismiss/route.ts       # POST dismiss
│       │
│       ├── companies/
│       │   └── [companyId]/
│       │       └── memory/
│       │           └── route.ts           # GET account memory
│       │
│       └── ai/
│           └── jobs/
│               └── [jobSlug]/
│                   └── execute/
│                       └── route.ts       # POST execute job
│
└── components/
    ├── deals/
    │   └── DealIntelligenceCard.tsx       # Show intelligence
    │
    ├── dashboard/
    │   └── HumanLeverageMoments.tsx       # Leverage moments list
    │
    └── companies/
        └── AccountMemoryCard.tsx          # "What We've Learned"
```

---

## UI Components

### Deal Intelligence Card

Shows on deal page:
- Win probability with confidence band
- Momentum indicator (accelerating/stable/stalling/dead)
- Confidence factor bars
- Economic context (expected value, max hours)
- Uncertainty state if applicable

### Human Leverage Moments Dashboard

Shows on main dashboard:
```
🚨 HUMAN LEVERAGE NEEDED (2)

1. RELATIONSHIP REPAIR - Acme Pest (Today) [72% confidence]
   "No response in 12 days. Call needed."
   [View Brief] [Mark Done] [Dismiss]

2. EXEC INTRO - ABC Exterminators (This Week) [83% confidence]
   "Need to reach owner. Ask champion for intro."
   [View Brief] [Mark Done] [Dismiss]
```

### Human Leverage Brief (Expanded)

When "View Brief" is clicked:
- Situation (what happened)
- Why It Matters (with trust basis)
- What AI Did
- What You Should Do
- Talking Points (4-5 bullets)
- What to Avoid (3-4 bullets)
- Success Criteria

### Account Memory Card ("What We've Learned")

Shows on company page sidebar:
```
🧠 What We've Learned

✓ What resonates: growth story, tech modernization
✗ What to avoid: cost savings framing

Prefers: phone • quick responder
Decides: owner_led

⚡ Objections raised:
  "Too expensive" → Showed ROI calculator ✓

Rapport: golf, UNC fan
```

---

## Integration Points

### Fireflies (Transcripts)

1. Webhook receives new transcript
2. Match to company/deal
3. Run "Meeting Analysis" job
4. Run "Update Account Memory" job
5. Check for leverage triggers

### Microsoft (Email/Calendar)

1. Sync emails to activities
2. On new inbound email, run "Email Analysis"
3. Sync calendar events
4. Trigger "Meeting Prep" day before meetings

### Research

1. Manual trigger or auto on company create
2. Run v6.1 research protocol
3. Store in company_research
4. Inject into relevant AI jobs

---

## Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Deal Intelligence Refresh | Hourly | Recompute all active deals |
| Leverage Trigger Check | Hourly | Detect new leverage moments |
| Transcript Processing | On webhook | Process new transcripts |
| Meeting Prep | Daily 6am | Prep for today's meetings |
| Deal Analysis | Daily 8am | Opportunity/threat analysis |
| Rep Trust Calculation | Weekly | Update rep profiles |
| Calibration Report | Weekly | Track accuracy |

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Leverage moment completion rate | >70% | Reps find them valuable |
| Leverage moment dismiss rate | <20% | System isn't nagging |
| Brief view time | <60 seconds | Brief is scannable |
| Win rate on flagged deals | +15% vs unflagged | System identifies right moments |
| Rep NPS for AI system | >50 | Reps love it |
| Win probability accuracy | ±10% | Predictions are reliable |

---

## The North Star

> **"Would a top 10% pest control AE use this instead of their notebook?"**

If the answer is "Yes, because I'd be stupid not to" → Success.

The Human Leverage Brief is the wedge. If reps love that one screen, everything else follows.

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database migrations
- Deal Intelligence Engine
- Deal Intelligence UI card

### Phase 2: Human Leverage MVP (Week 3-4)
- Stop rules
- Trigger detection
- Brief generation
- Leverage moments dashboard

### Phase 3: Account Memory (Week 5)
- Account memory storage
- "What We've Learned" UI
- Memory injection into jobs
- Post-meeting memory updates

### Phase 4: Learning (Week 6)
- Rep trust profiles
- Win/Loss postmortems
- Calibration tracking
- Pattern learnings

### Phase 5: Polish (Week 7-8)
- Performance optimization
- Error handling
- Mobile responsive
- User testing
