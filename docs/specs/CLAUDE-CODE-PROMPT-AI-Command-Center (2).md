# X-FORCE AI Command Center — v3.1 "Momentum Engine"

## Vision: The 100x Sales Rep

The AI Command Center isn't a task list — it's **an AI co-pilot that plans your entire day and tells you exactly what to do with every available hour.** The goal: one rep effectively working 100 accounts with the precision of a dedicated account team.

**Core Philosophy:**
- AI knows your calendar and plans around it
- AI estimates action duration and fills your available time
- AI prioritizes for maximum pipeline impact, not just urgency
- Rep executes; AI thinks

---

## Time-Aware Daily Planning

The system doesn't use arbitrary limits. Instead, it **calculates your actual available work time** and fills it with the highest-impact actions.

### How It Works

```
8:00 AM: Rep opens Command Center

AI calculates:
├── Total work day: 8 hours
├── Meetings today: 2.5 hours (3 meetings)
├── Available execution time: 5.5 hours
├── Buffer for reactive work: 1 hour (configurable)
└── Plannable time: 4.5 hours

AI fills 4.5 hours with highest-momentum actions:
├── Hour 1 (9:00-10:00): 2 calls + 3 quick emails
├── Hour 2 (10:30-11:30): Meeting prep + 1 important email
├── [11:30-12:30: MEETING - Acme Corp Q4 Review]
├── Hour 3 (1:00-2:00): Post-meeting follow-up + 2 calls
├── [2:00-3:00: MEETING - TechCorp Demo]
├── Hour 4 (3:00-4:00): Proposal review + 3 outreach emails
└── Hour 5 (4:00-5:00): LinkedIn touches + admin tasks
```

### The Daily View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI Command Center                                         Dec 19 • 9:14 AM │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  YOUR DAY                                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Available: 4.5 hrs │ Meetings: 2.5 hrs │ Potential value: $892K           │
│                                                                             │
│  [Currently: 9:00 AM - 10:00 AM] ◀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ⚡ DO NOW ─────────────────────────────────────────────────────────────────│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 📞 CALL John Smith (Acme Corp)                    ~15 min │ 🎯 $150K   ││
│  │                                                                         ││
│  │ Why now: He opened your proposal 3x in last hour. Strike while hot.    ││
│  │                                                                         ││
│  │ Score: 94 ────────────────────────────────────────────────────────────  ││
│  │ ├ +20 proposal viewed (10 min ago)                                      ││
│  │ ├ +18 $150K weighted value                                              ││
│  │ ├ +15 deal in negotiation stage                                         ││
│  │ ├ +12 optimal contact time (he responds 9-11 AM)                        ││
│  │ └ +29 base priority (buying signal)                                     ││
│  │                                                                         ││
│  │ [████████ CALL NOW ████████]  [📧 If No Answer]  [→ Next]     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  UP NEXT (This Hour) ───────────────────────────────────────────────────────│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ✉️ SEND Follow-up: Q4 Planning                    ~3 min │ 🎯 $85K     ││
│  │ Draft ready (92% confidence) • Meeting was 2 hrs ago                   ││
│  │ [Review & Send]                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ✉️ SEND Response: Security questionnaire         ~5 min │ 🎯 $120K    ││
│  │ They asked 3 days ago • SLA at risk                                    ││
│  │ [Review & Send]                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  📅 10:30 AM ─ Prep for Acme Corp Q4 Review ────────────────────────────────│
│  📅 11:30 AM ─ MEETING: Acme Corp Q4 Review (1 hr) ─────────────────────────│
│                                                                             │
│  LATER TODAY ───────────────────────────────────────────────────────────────│
│  ▸ 1:00 PM: Post-meeting follow-up + 2 calls (1 hr planned)                │
│  ▸ 3:00 PM: Proposal work + outreach (1.5 hrs planned)                     │
│                                                                             │
│  ⚠️ AT RISK (needs attention) ──────────────────────────────────────────────│
│  │ 3 deals showing warning signs — review when you have time              │
│  └──────────────────────────────────────────────────────────────────────────│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Time-Aware Planning Engine

### Action Duration Estimates

Every action type has an estimated duration so the AI can plan realistically:

```typescript
const ACTION_DURATIONS: Record<string, { min: number; typical: number; max: number }> = {
  // Minutes
  'call': { min: 5, typical: 15, max: 30 },
  'call_with_prep': { min: 15, typical: 25, max: 45 },
  'email_send_draft': { min: 2, typical: 3, max: 5 },          // AI draft ready
  'email_compose': { min: 5, typical: 10, max: 20 },           // Writing from scratch
  'email_respond': { min: 3, typical: 8, max: 15 },
  'meeting_prep': { min: 10, typical: 15, max: 30 },
  'meeting_follow_up': { min: 5, typical: 10, max: 20 },
  'proposal_review': { min: 15, typical: 30, max: 60 },
  'linkedin_touch': { min: 2, typical: 3, max: 5 },
  'research_account': { min: 10, typical: 20, max: 45 },
  'internal_sync': { min: 5, typical: 15, max: 30 },
  'task_simple': { min: 2, typical: 5, max: 10 },
  'task_complex': { min: 15, typical: 30, max: 60 },
};

// Learn from actual rep behavior over time
interface RepTimeProfile {
  user_id: string;
  action_durations: Record<string, number>;  // Learned averages
  typical_start_time: string;                 // When they start working
  typical_end_time: string;                   // When they stop
  meeting_buffer_minutes: number;             // Time before/after meetings
  focus_block_preference: number;             // Preferred chunk size (minutes)
}
```

### Daily Capacity Calculation

```typescript
// lib/commandCenter/dailyPlanner.ts

interface DailyCapacity {
  total_work_minutes: number;           // e.g., 480 (8 hours)
  meeting_minutes: number;              // Time blocked by meetings
  prep_buffer_minutes: number;          // 15 min before each external meeting
  reactive_buffer_minutes: number;      // Time for unexpected items
  available_minutes: number;            // What's left for planned actions
  time_blocks: TimeBlock[];             // Chunked availability
}

interface TimeBlock {
  start: Date;
  end: Date;
  duration_minutes: number;
  type: 'available' | 'meeting' | 'prep' | 'buffer';
  meeting_id?: string;
  suggested_actions?: PlannedAction[];
}

interface PlannedAction {
  item_id: string;
  action_type: string;
  estimated_minutes: number;
  momentum_score: number;
  potential_value: number;
}

export async function calculateDailyCapacity(userId: string, date: Date): Promise<DailyCapacity> {
  const repProfile = await getRepTimeProfile(userId);
  
  // Get calendar for the day
  const meetings = await getCalendarEvents(userId, startOfDay(date), endOfDay(date));
  const externalMeetings = meetings.filter(m => hasExternalAttendees(m));
  
  // Calculate work window
  const workStart = parse(repProfile.typical_start_time || '09:00', 'HH:mm', date);
  const workEnd = parse(repProfile.typical_end_time || '17:00', 'HH:mm', date);
  const totalWorkMinutes = differenceInMinutes(workEnd, workStart);
  
  // Calculate meeting time
  const meetingMinutes = meetings.reduce((sum, m) => 
    sum + differenceInMinutes(m.end, m.start), 0);
  
  // Add prep buffer (15 min before each external meeting)
  const prepBufferMinutes = externalMeetings.length * 15;
  
  // Reactive buffer (configurable, default 60 min)
  const reactiveBuffer = repProfile.reactive_buffer_minutes || 60;
  
  // Available time
  const availableMinutes = Math.max(0, 
    totalWorkMinutes - meetingMinutes - prepBufferMinutes - reactiveBuffer
  );
  
  // Build time blocks
  const timeBlocks = buildTimeBlocks(workStart, workEnd, meetings, repProfile);
  
  return {
    total_work_minutes: totalWorkMinutes,
    meeting_minutes: meetingMinutes,
    prep_buffer_minutes: prepBufferMinutes,
    reactive_buffer_minutes: reactiveBuffer,
    available_minutes: availableMinutes,
    time_blocks: timeBlocks
  };
}

function buildTimeBlocks(
  workStart: Date,
  workEnd: Date,
  meetings: CalendarEvent[],
  repProfile: RepTimeProfile
): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let currentTime = workStart;
  
  // Sort meetings by start time
  const sortedMeetings = [...meetings].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );
  
  for (const meeting of sortedMeetings) {
    // Add prep block before external meetings
    if (hasExternalAttendees(meeting)) {
      const prepStart = subMinutes(meeting.start, 15);
      
      // Available block before prep
      if (currentTime < prepStart) {
        blocks.push({
          start: currentTime,
          end: prepStart,
          duration_minutes: differenceInMinutes(prepStart, currentTime),
          type: 'available'
        });
      }
      
      // Prep block
      blocks.push({
        start: prepStart,
        end: meeting.start,
        duration_minutes: 15,
        type: 'prep',
        meeting_id: meeting.id
      });
    } else {
      // Available block before internal meeting
      if (currentTime < meeting.start) {
        blocks.push({
          start: currentTime,
          end: meeting.start,
          duration_minutes: differenceInMinutes(meeting.start, currentTime),
          type: 'available'
        });
      }
    }
    
    // Meeting block
    blocks.push({
      start: meeting.start,
      end: meeting.end,
      duration_minutes: differenceInMinutes(meeting.end, meeting.start),
      type: 'meeting',
      meeting_id: meeting.id
    });
    
    currentTime = meeting.end;
  }
  
  // Final available block
  if (currentTime < workEnd) {
    blocks.push({
      start: currentTime,
      end: workEnd,
      duration_minutes: differenceInMinutes(workEnd, currentTime),
      type: 'available'
    });
  }
  
  return blocks;
}
```

### Filling Available Time with Actions

```typescript
// lib/commandCenter/actionPlanner.ts

export async function planDayActions(userId: string): Promise<DailyPlan> {
  const capacity = await calculateDailyCapacity(userId, new Date());
  const allItems = await getPendingCommandCenterItems(userId);
  
  // Sort by momentum score
  const sortedItems = [...allItems].sort((a, b) => b.momentum_score - a.momentum_score);
  
  // Fill each available block
  const plannedBlocks: PlannedTimeBlock[] = [];
  let totalPlannedValue = 0;
  
  for (const block of capacity.time_blocks.filter(b => b.type === 'available')) {
    const blockPlan = fillTimeBlock(block, sortedItems, plannedBlocks);
    plannedBlocks.push(blockPlan);
    totalPlannedValue += blockPlan.potential_value;
    
    // Mark items as planned so they're not double-scheduled
    for (const action of blockPlan.planned_actions) {
      const idx = sortedItems.findIndex(i => i.id === action.item_id);
      if (idx >= 0) sortedItems.splice(idx, 1);
    }
  }
  
  // Items that didn't fit today
  const overflow = sortedItems;
  
  return {
    date: new Date(),
    capacity,
    planned_blocks: plannedBlocks,
    total_planned_minutes: plannedBlocks.reduce((sum, b) => 
      sum + b.planned_actions.reduce((s, a) => s + a.estimated_minutes, 0), 0
    ),
    total_potential_value: totalPlannedValue,
    overflow_items: overflow,
    at_risk_items: allItems.filter(i => i.risk_level === 'high' || i.risk_level === 'critical')
  };
}

function fillTimeBlock(
  block: TimeBlock,
  availableItems: CommandCenterItem[],
  alreadyPlanned: PlannedTimeBlock[]
): PlannedTimeBlock {
  const plannedActions: PlannedAction[] = [];
  let remainingMinutes = block.duration_minutes;
  let potentialValue = 0;
  
  // Greedy fill: highest momentum items that fit
  for (const item of availableItems) {
    if (remainingMinutes <= 0) break;
    
    const duration = getActionDuration(item.action_type);
    
    // Check if it fits
    if (duration.typical <= remainingMinutes) {
      plannedActions.push({
        item_id: item.id,
        action_type: item.action_type,
        estimated_minutes: duration.typical,
        momentum_score: item.momentum_score,
        potential_value: item.deal_value || 0
      });
      
      remainingMinutes -= duration.typical;
      potentialValue += item.deal_value || 0;
    }
  }
  
  return {
    ...block,
    planned_actions: plannedActions,
    planned_minutes: block.duration_minutes - remainingMinutes,
    buffer_minutes: remainingMinutes,
    potential_value: potentialValue
  };
}
```

---

## The Momentum Score Algorithm (v3.1)

### Key Changes from v3.0
1. **Score explanations** in plain English (not just JSON)
2. **Risk as additive overlay** (not multiplicative — prevents weird explosions)
3. **Negative sentiment triggers routing**, not just score boost
4. **Win pattern gating** with strict sample size requirements
5. **Outcome tracking** to measure what actually worked

### Revised Formula

```
MS = BASE_SCORE + RISK_OVERLAY

Where:
BASE_SCORE = B + T + V + E + W    (0-100, capped)
RISK_OVERLAY = R                   (0-30, additive)

Final: MS = min(100, BASE_SCORE + RISK_OVERLAY)
```

This separates "this is valuable/urgent" from "this is fragile/risky" — both matter, but differently.

### Factor Definitions

```typescript
interface MomentumFactors {
  // ═══════════════════════════════════════════════════════════════════
  // BASE SCORE COMPONENTS (0-100 total cap)
  // ═══════════════════════════════════════════════════════════════════
  
  // B: Base Priority (0-35 points)
  base: {
    value: number;
    explanation: string;  // "Commitment you made → +40"
  };
  
  // T: Time Pressure (0-25 points)
  time: {
    value: number;
    explanation: string;  // "Due in 2 hours → +18"
  };
  
  // V: Value Score (0-20 points)
  value: {
    value: number;
    explanation: string;  // "$150K weighted value → +15"
  };
  
  // E: Engagement Signals (0-15 points)
  engagement: {
    value: number;
    explanation: string;  // "Proposal viewed 10 min ago → +12"
  };
  
  // W: Win Pattern Bonus (0-10 points, gated)
  winPattern: {
    value: number;
    explanation: string;  // "Similar action won 73% of deals (n=156) → +8"
    gated: boolean;       // Only applies if meets thresholds
  };
  
  // O: Optimal Timing Modifier (0.9-1.1 multiplier on base)
  optimalTiming: {
    multiplier: number;
    explanation: string;  // "Best time to reach (9-11 AM) → ×1.1"
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // RISK OVERLAY (0-30 points, additive)
  // ═══════════════════════════════════════════════════════════════════
  
  // R: Risk factors that demand attention
  risk: {
    value: number;
    components: Array<{
      factor: string;
      points: number;
      explanation: string;
    }>;
    // e.g., [
    //   { factor: 'single_threaded', points: 10, explanation: 'Only 1 contact engaged' },
    //   { factor: 'sentiment_declining', points: 8, explanation: 'Sentiment dropped last 2 emails' },
    //   { factor: 'ignored_twice', points: 6, explanation: 'Snoozed/skipped 2 times' }
    // ]
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // FINAL CALCULATION
  // ═══════════════════════════════════════════════════════════════════
  
  base_score: number;      // B + T + V + E + W, then × O, capped at 70
  risk_overlay: number;    // R, capped at 30
  final_score: number;     // base_score + risk_overlay, capped at 100
  
  // Human-readable summary
  score_explanation: string[];  // Array of plain English lines
}
```

### Calculating Each Factor

```typescript
// lib/commandCenter/momentumScoring.ts

export function calculateMomentumScore(item: CommandCenterItem): MomentumFactors {
  
  // ═══════════════════════════════════════════════════════════════════
  // B: BASE PRIORITY (0-35)
  // ═══════════════════════════════════════════════════════════════════
  const basePriorities: Record<string, number> = {
    'commitment_made': 35,
    'buying_signal': 32,
    'executive_engaged': 30,
    'meeting_follow_up': 28,
    'proposal_follow_up': 28,
    'sla_breach': 25,
    'competitor_mentioned': 25,
    'meeting_prep': 22,
    'response_needed': 20,
    'scheduled_outreach': 18,
    'ai_suggested': 15,
    'manual_task': 12
  };
  
  const baseValue = basePriorities[item.action_type] || 10;
  const baseExplanation = `${formatActionType(item.action_type)} → +${baseValue}`;
  
  // ═══════════════════════════════════════════════════════════════════
  // T: TIME PRESSURE (0-25)
  // ═══════════════════════════════════════════════════════════════════
  let timeValue = 0;
  let timeExplanation = '';
  
  if (item.due_at) {
    const hoursUntilDue = differenceInHours(new Date(item.due_at), new Date());
    
    if (hoursUntilDue < 0) {
      // Overdue: 15 + exponential growth, cap at 25
      const overdueHours = Math.abs(hoursUntilDue);
      timeValue = Math.min(25, 15 + Math.round(Math.pow(overdueHours, 0.8)));
      timeExplanation = `Overdue by ${overdueHours}h → +${timeValue}`;
    } else if (hoursUntilDue <= 2) {
      timeValue = 20;
      timeExplanation = `Due in ${hoursUntilDue}h → +${timeValue}`;
    } else if (hoursUntilDue <= 8) {
      timeValue = Math.round(18 - (hoursUntilDue - 2) * 2);
      timeExplanation = `Due in ${hoursUntilDue}h → +${timeValue}`;
    } else if (hoursUntilDue <= 24) {
      timeValue = Math.round(10 - (hoursUntilDue - 8) * 0.5);
      timeExplanation = `Due today → +${timeValue}`;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // V: VALUE SCORE (0-20)
  // ═══════════════════════════════════════════════════════════════════
  let valueScore = 0;
  let valueExplanation = '';
  
  if (item.deal_value && item.deal_probability) {
    const weightedValue = item.deal_value * item.deal_probability;
    const avgDealSize = await getAvgDealSize(item.user_id);
    
    // Normalize to 0-20 scale
    valueScore = Math.min(20, Math.round((weightedValue / avgDealSize) * 8));
    valueExplanation = `$${(weightedValue / 1000).toFixed(0)}K weighted value → +${valueScore}`;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // E: ENGAGEMENT SIGNALS (0-15)
  // ═══════════════════════════════════════════════════════════════════
  let engagementScore = 0;
  const engagementParts: string[] = [];
  
  const signals = item.engagement_signals || {};
  
  if (signals.proposal_viewed) {
    const minutesAgo = differenceInMinutes(new Date(), new Date(signals.proposal_viewed.at));
    if (minutesAgo <= 60) {
      const points = minutesAgo <= 15 ? 12 : minutesAgo <= 30 ? 10 : 8;
      engagementScore += points;
      engagementParts.push(`Proposal viewed ${minutesAgo}m ago → +${points}`);
    }
  }
  
  if (signals.forwarded_internally) {
    engagementScore += 10;
    engagementParts.push(`Forwarded internally → +10`);
  }
  
  if (signals.email_opened && signals.email_opened.count >= 3) {
    engagementScore += 5;
    engagementParts.push(`Email opened ${signals.email_opened.count}x → +5`);
  }
  
  if (signals.replied_quickly) {
    engagementScore += 5;
    engagementParts.push(`Fast responder pattern → +5`);
  }
  
  engagementScore = Math.min(15, engagementScore);
  const engagementExplanation = engagementParts.join(', ') || 'No recent signals';
  
  // ═══════════════════════════════════════════════════════════════════
  // W: WIN PATTERN BONUS (0-10, strictly gated)
  // ═══════════════════════════════════════════════════════════════════
  let winPatternScore = 0;
  let winPatternExplanation = '';
  let winPatternGated = true;
  
  const pattern = await findMatchingWinPattern(item);
  
  if (pattern && 
      pattern.sample_size >= 50 &&                    // Minimum sample
      pattern.confidence_level >= 0.7 &&              // 70%+ confidence
      pattern.segment_match_score >= 0.8) {           // Good segment fit
    
    winPatternScore = Math.round(pattern.win_correlation * 10);
    winPatternExplanation = `${pattern.pattern_name}: ${(pattern.win_correlation * 100).toFixed(0)}% win rate (n=${pattern.sample_size}) → +${winPatternScore}`;
    winPatternGated = false;
  } else if (pattern) {
    winPatternExplanation = `Pattern found but insufficient data (n=${pattern.sample_size})`;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // O: OPTIMAL TIMING MODIFIER (0.9-1.1)
  // ═══════════════════════════════════════════════════════════════════
  let timingMultiplier = 1.0;
  let timingExplanation = '';
  
  if (item.contact_id) {
    const contact = await getContactTimingProfile(item.contact_id);
    const currentHour = new Date().getHours();
    const currentDay = getDayOfWeek();
    
    const isOptimalHour = contact.best_hours?.includes(currentHour);
    const isOptimalDay = contact.best_days?.includes(currentDay);
    
    if (isOptimalHour && isOptimalDay) {
      timingMultiplier = 1.1;
      timingExplanation = `Optimal time to reach (${contact.best_hours.join('-')} on ${currentDay}) → ×1.1`;
    } else if (isOptimalHour || isOptimalDay) {
      timingMultiplier = 1.05;
      timingExplanation = `Good time to reach → ×1.05`;
    } else if (contact.worst_hours?.includes(currentHour)) {
      timingMultiplier = 0.9;
      timingExplanation = `Not ideal time (low response history) → ×0.9`;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // R: RISK OVERLAY (0-30, additive)
  // ═══════════════════════════════════════════════════════════════════
  const riskComponents: Array<{ factor: string; points: number; explanation: string }> = [];
  
  // Single-threaded risk
  if (item.thread_count === 1 && item.deal_value > 50000) {
    riskComponents.push({
      factor: 'single_threaded',
      points: 12,
      explanation: 'Single-threaded on $50K+ deal'
    });
  } else if (item.thread_count === 1) {
    riskComponents.push({
      factor: 'single_threaded',
      points: 8,
      explanation: 'Only 1 contact engaged'
    });
  }
  
  // Sentiment risk (NOTE: this triggers routing, not just boost)
  if (item.sentiment_score < -0.3) {
    riskComponents.push({
      factor: 'negative_sentiment',
      points: 10,
      explanation: 'Negative sentiment detected — review approach'
    });
    // Flag for special handling
    item.requires_human_review = true;
    item.sentiment_routing = 'human_leverage_brief';
  } else if (item.sentiment_trend === 'declining') {
    riskComponents.push({
      factor: 'sentiment_declining',
      points: 6,
      explanation: 'Sentiment trending down'
    });
  }
  
  // Inaction risk
  if (item.ignore_count >= 3) {
    riskComponents.push({
      factor: 'repeatedly_ignored',
      points: 10,
      explanation: `Skipped ${item.ignore_count} times — needs decision`
    });
  } else if (item.ignore_count >= 1) {
    riskComponents.push({
      factor: 'ignored',
      points: item.ignore_count * 3,
      explanation: `Skipped ${item.ignore_count} time(s)`
    });
  }
  
  // Ghosting risk
  if (item.ghosting_risk_score >= 70) {
    riskComponents.push({
      factor: 'ghost_risk_critical',
      points: 12,
      explanation: 'High risk of going dark'
    });
  } else if (item.ghosting_risk_score >= 50) {
    riskComponents.push({
      factor: 'ghost_risk_elevated',
      points: 6,
      explanation: 'Elevated ghost risk'
    });
  }
  
  // No champion risk
  if (!item.has_champion && item.deal_value > 75000) {
    riskComponents.push({
      factor: 'no_champion',
      points: 8,
      explanation: 'No champion identified on large deal'
    });
  }
  
  const riskOverlay = Math.min(30, riskComponents.reduce((sum, r) => sum + r.points, 0));
  
  // ═══════════════════════════════════════════════════════════════════
  // FINAL CALCULATION
  // ═══════════════════════════════════════════════════════════════════
  
  const rawBaseScore = baseValue + timeValue + valueScore + engagementScore + winPatternScore;
  const adjustedBaseScore = Math.min(70, Math.round(rawBaseScore * timingMultiplier));
  const finalScore = Math.min(100, adjustedBaseScore + riskOverlay);
  
  // Build human-readable explanation
  const scoreExplanation: string[] = [];
  if (baseValue > 0) scoreExplanation.push(baseExplanation);
  if (timeValue > 0) scoreExplanation.push(timeExplanation);
  if (valueScore > 0) scoreExplanation.push(valueExplanation);
  if (engagementScore > 0) scoreExplanation.push(engagementExplanation);
  if (winPatternScore > 0) scoreExplanation.push(winPatternExplanation);
  if (timingMultiplier !== 1.0) scoreExplanation.push(timingExplanation);
  for (const risk of riskComponents) {
    scoreExplanation.push(`⚠️ ${risk.explanation} → +${risk.points}`);
  }
  
  return {
    base: { value: baseValue, explanation: baseExplanation },
    time: { value: timeValue, explanation: timeExplanation },
    value: { value: valueScore, explanation: valueExplanation },
    engagement: { value: engagementScore, explanation: engagementExplanation },
    winPattern: { value: winPatternScore, explanation: winPatternExplanation, gated: winPatternGated },
    optimalTiming: { multiplier: timingMultiplier, explanation: timingExplanation },
    risk: { value: riskOverlay, components: riskComponents },
    base_score: adjustedBaseScore,
    risk_overlay: riskOverlay,
    final_score: finalScore,
    score_explanation: scoreExplanation
  };
}
```

---

## Negative Sentiment Routing (Not Just Boost)

When sentiment is negative, the system doesn't just boost priority — it changes the recommended approach:

```typescript
// lib/commandCenter/sentimentRouting.ts

interface SentimentRouting {
  action: 'proceed' | 'review_approach' | 'human_leverage' | 'manager_escalate' | 'pause';
  reason: string;
  suggested_approach?: string;
  suppress_auto_send: boolean;
  require_human_brief: boolean;
}

export function routeBysentiment(item: CommandCenterItem): SentimentRouting {
  const sentiment = item.sentiment_score;       // -1 to 1
  const trend = item.sentiment_trend;           // improving, stable, declining
  const dealValue = item.deal_value || 0;
  
  // Critical negative + high value = escalate
  if (sentiment < -0.5 && dealValue > 100000) {
    return {
      action: 'manager_escalate',
      reason: 'Strongly negative sentiment on high-value deal',
      suggested_approach: 'Consider executive sponsor involvement or strategic pivot',
      suppress_auto_send: true,
      require_human_brief: true
    };
  }
  
  // Negative + declining = pause and rethink
  if (sentiment < -0.3 && trend === 'declining') {
    return {
      action: 'review_approach',
      reason: 'Sentiment declining — current approach may not be working',
      suggested_approach: 'Try different channel, different message angle, or involve different stakeholder',
      suppress_auto_send: true,
      require_human_brief: true
    };
  }
  
  // Moderately negative = proceed with caution
  if (sentiment < 0) {
    return {
      action: 'human_leverage',
      reason: 'Some friction detected',
      suggested_approach: 'Address concerns directly, acknowledge past issues',
      suppress_auto_send: true,
      require_human_brief: false
    };
  }
  
  // Neutral or positive = proceed
  return {
    action: 'proceed',
    reason: 'Sentiment is neutral or positive',
    suppress_auto_send: false,
    require_human_brief: false
  };
}
```

### Human Leverage Brief

For high-risk situations, generate a strategic brief:

```typescript
interface HumanLeverageBrief {
  situation_summary: string;
  what_went_wrong: string[];
  their_concerns: string[];
  recommended_approach: string;
  talking_points: string[];
  what_to_avoid: string[];
  escalation_option?: string;
  alternative_contacts?: Contact[];
}

export async function generateHumanLeverageBrief(
  item: CommandCenterItem
): Promise<HumanLeverageBrief> {
  // Gather all context
  const deal = await getDeal(item.deal_id);
  const recentEmails = await getRecentEmails(item.deal_id, { days: 30 });
  const recentMeetings = await getRecentMeetingAnalyses(item.deal_id);
  const sentimentHistory = await getSentimentHistory(item.deal_id);
  
  const prompt = `This deal has negative/declining sentiment. Generate a Human Leverage Brief.

## Deal Context
${deal.name} - ${deal.stage} - $${deal.estimated_value}
Days since creation: ${deal.age_days}
Current health: ${deal.health_score}

## Sentiment History
${sentimentHistory.map(s => `${s.date}: ${s.score} (${s.source})`).join('\n')}

## Recent Emails (sentiment noted)
${recentEmails.map(e => `
[${e.sentiment}] ${e.subject}
${e.body_preview}
`).join('\n---\n')}

## Recent Meeting Notes
${recentMeetings.map(m => `
${m.date}: ${m.title}
Objections: ${m.objections?.join(', ') || 'None'}
Concerns: ${m.concerns?.join(', ') || 'None'}
`).join('\n')}

Generate a strategic brief. Return JSON:
{
  "situation_summary": "1-2 sentences on what's happening",
  "what_went_wrong": ["Issue 1", "Issue 2"],
  "their_concerns": ["Concern they've expressed or implied"],
  "recommended_approach": "How to turn this around",
  "talking_points": ["Point to make", "Point to make"],
  "what_to_avoid": ["Don't do this", "Don't mention this"],
  "escalation_option": "When to involve manager/exec",
  "alternative_contacts": ["Other people to engage if primary is cold"]
}`;

  const response = await callAI({ prompt, maxTokens: 800 });
  return JSON.parse(response.content);
}
```

---

## Outcome Tracking

Track whether actions actually worked — this is how the system learns:

```typescript
// Enhanced command_center_items columns
ALTER TABLE command_center_items

-- Outcome tracking
ADD COLUMN expected_outcome VARCHAR(100),
-- 'get_reply', 'book_meeting', 'advance_stage', 'get_commitment', 
-- 'resolve_objection', 'get_referral', 'close_deal'

ADD COLUMN outcome_status VARCHAR(30),
-- 'pending', 'positive', 'neutral', 'negative', 'unknown'

ADD COLUMN outcome_evidence JSONB,
-- { type: 'reply_received', evidence_id: '...', occurred_at: '...' }
-- { type: 'meeting_booked', evidence_id: '...', occurred_at: '...' }
-- { type: 'stage_changed', from: 'proposal', to: 'negotiation' }

ADD COLUMN outcome_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN outcome_check_count INTEGER DEFAULT 0;


-- Outcome definitions
CREATE TABLE outcome_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  action_type VARCHAR(50) NOT NULL,
  expected_outcome VARCHAR(100) NOT NULL,
  
  -- How to detect success
  positive_indicators JSONB,
  -- { reply_within_hours: 48, meeting_booked: true, sentiment_improved: true }
  
  -- How to detect failure
  negative_indicators JSONB,
  -- { no_reply_days: 7, meeting_cancelled: true, sentiment_declined: true }
  
  -- Timing
  check_after_hours INTEGER DEFAULT 48,
  max_check_days INTEGER DEFAULT 14
);

-- Seed outcome definitions
INSERT INTO outcome_definitions (action_type, expected_outcome, positive_indicators, negative_indicators, check_after_hours) VALUES
('call', 'advance_conversation', '{"connected": true, "next_step_agreed": true}', '{"no_answer": true, "no_callback": true}', 1),
('email_send_draft', 'get_reply', '{"reply_received": true}', '{"no_reply_days": 5}', 48),
('meeting_follow_up', 'get_reply', '{"reply_received": true, "action_items_acknowledged": true}', '{"no_reply_days": 3}', 24),
('proposal_follow_up', 'advance_stage', '{"reply_received": true, "meeting_booked": true}', '{"no_reply_days": 7}', 72);
```

### Outcome Checking Job

```typescript
// lib/jobs/checkOutcomes.ts

// Run every 4 hours
export async function checkActionOutcomes(): Promise<void> {
  // Get completed items that need outcome checking
  const itemsToCheck = await db.select()
    .from(commandCenterItems)
    .where(and(
      eq(commandCenterItems.status, 'completed'),
      isNotNull(commandCenterItems.expected_outcome),
      or(
        isNull(commandCenterItems.outcome_status),
        eq(commandCenterItems.outcome_status, 'pending')
      ),
      // Check timing
      sql`completed_at < NOW() - INTERVAL '2 hours'`,
      sql`(outcome_checked_at IS NULL OR outcome_checked_at < NOW() - INTERVAL '12 hours')`,
      sql`outcome_check_count < 10`
    ));
  
  for (const item of itemsToCheck) {
    const outcome = await evaluateOutcome(item);
    
    await db.update(commandCenterItems)
      .set({
        outcome_status: outcome.status,
        outcome_evidence: outcome.evidence,
        outcome_checked_at: new Date(),
        outcome_check_count: item.outcome_check_count + 1
      })
      .where(eq(commandCenterItems.id, item.id));
    
    // If positive, feed into win pattern learning
    if (outcome.status === 'positive') {
      await recordPositiveOutcome(item, outcome);
    }
  }
}

async function evaluateOutcome(item: CommandCenterItem): Promise<OutcomeResult> {
  const definition = await getOutcomeDefinition(item.action_type, item.expected_outcome);
  
  let status: 'positive' | 'neutral' | 'negative' | 'pending' = 'pending';
  let evidence: any = null;
  
  // Check for reply (if expected)
  if (definition.positive_indicators.reply_received) {
    const reply = await checkForReply(item);
    if (reply) {
      status = 'positive';
      evidence = { type: 'reply_received', message_id: reply.id, received_at: reply.received_at };
    } else {
      const daysSince = differenceInDays(new Date(), new Date(item.completed_at));
      if (daysSince >= (definition.negative_indicators.no_reply_days || 5)) {
        status = 'negative';
        evidence = { type: 'no_reply', days_waited: daysSince };
      }
    }
  }
  
  // Check for meeting booked
  if (definition.positive_indicators.meeting_booked) {
    const meeting = await checkForBookedMeeting(item);
    if (meeting) {
      status = 'positive';
      evidence = { type: 'meeting_booked', meeting_id: meeting.id, scheduled_for: meeting.start };
    }
  }
  
  // Check for stage change
  if (definition.positive_indicators.stage_advanced) {
    const stageChange = await checkForStageChange(item);
    if (stageChange && stageChange.direction === 'forward') {
      status = 'positive';
      evidence = { type: 'stage_changed', from: stageChange.from, to: stageChange.to };
    }
  }
  
  return { status, evidence };
}
```

---

## Updated Data Model

```sql
-- Enhanced command_center_items table
ALTER TABLE command_center_items

-- Time-aware planning
ADD COLUMN action_type VARCHAR(50),
ADD COLUMN estimated_minutes INTEGER,
ADD COLUMN planned_for_block UUID,                -- Which time block
ADD COLUMN planned_start_time TIMESTAMP WITH TIME ZONE,

-- Momentum scoring (v3.1)
ADD COLUMN momentum_score INTEGER DEFAULT 0,
ADD COLUMN score_factors JSONB DEFAULT '{}',      -- Detailed breakdown
ADD COLUMN score_explanation TEXT[],              -- Human-readable lines
ADD COLUMN risk_overlay INTEGER DEFAULT 0,        -- Separate risk score

-- Engagement tracking
ADD COLUMN engagement_signals JSONB DEFAULT '{}',
ADD COLUMN last_engagement_at TIMESTAMP WITH TIME ZONE,

-- Health & Sentiment (with routing)
ADD COLUMN sentiment_score FLOAT DEFAULT 0.0,
ADD COLUMN sentiment_trend VARCHAR(20),
ADD COLUMN sentiment_routing VARCHAR(50),         -- How to handle negative sentiment
ADD COLUMN requires_human_review BOOLEAN DEFAULT FALSE,
ADD COLUMN human_leverage_brief JSONB,            -- Generated brief for tough situations

-- Threading
ADD COLUMN thread_count INTEGER DEFAULT 1,
ADD COLUMN has_champion BOOLEAN DEFAULT FALSE,
ADD COLUMN has_economic_buyer BOOLEAN DEFAULT FALSE,

-- Risk tracking
ADD COLUMN ghosting_risk_score INTEGER DEFAULT 0,
ADD COLUMN risk_level VARCHAR(20),                -- low, medium, high, critical

-- Inaction tracking
ADD COLUMN ignore_count INTEGER DEFAULT 0,
ADD COLUMN snooze_count INTEGER DEFAULT 0,
ADD COLUMN last_viewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_snoozed_at TIMESTAMP WITH TIME ZONE,

-- Timing intelligence
ADD COLUMN optimal_contact_hours INTEGER[],
ADD COLUMN optimal_contact_days VARCHAR(10)[],

-- Win patterns (with gating info)
ADD COLUMN win_pattern_id UUID,
ADD COLUMN win_pattern_match_score FLOAT,
ADD COLUMN win_pattern_sample_size INTEGER,

-- Outcome tracking
ADD COLUMN expected_outcome VARCHAR(100),
ADD COLUMN outcome_status VARCHAR(30),
ADD COLUMN outcome_evidence JSONB,
ADD COLUMN outcome_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN outcome_check_count INTEGER DEFAULT 0,

-- AI enrichment
ADD COLUMN why_now TEXT,                          -- AI-generated explanation
ADD COLUMN context_brief TEXT,
ADD COLUMN win_tip TEXT,
ADD COLUMN landmine_warnings TEXT[];


-- Daily plans table
CREATE TABLE daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  
  -- Capacity
  total_work_minutes INTEGER,
  meeting_minutes INTEGER,
  available_minutes INTEGER,
  planned_minutes INTEGER,
  
  -- Content
  time_blocks JSONB,                              -- Array of time blocks
  planned_items UUID[],                           -- Items planned for today
  overflow_items UUID[],                          -- Didn't fit
  at_risk_items UUID[],                           -- Need attention
  
  -- Metrics
  total_potential_value DECIMAL(15,2),
  completed_value DECIMAL(15,2) DEFAULT 0,
  completion_rate FLOAT DEFAULT 0,
  
  -- Status
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(user_id, plan_date)
);

CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, plan_date);


-- Rep time profiles (learned)
CREATE TABLE rep_time_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Work schedule
  typical_start_time TIME DEFAULT '09:00',
  typical_end_time TIME DEFAULT '17:00',
  work_days VARCHAR(10)[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  
  -- Buffers
  meeting_prep_buffer_minutes INTEGER DEFAULT 15,
  reactive_buffer_minutes INTEGER DEFAULT 60,
  focus_block_preference_minutes INTEGER DEFAULT 60,
  
  -- Learned action durations (overrides defaults)
  action_durations JSONB DEFAULT '{}',
  
  -- Preferences
  prefer_calls_morning BOOLEAN DEFAULT TRUE,
  prefer_email_batching BOOLEAN DEFAULT TRUE,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Win Pattern Gating (Strict Requirements)

Per GPT's feedback, win patterns are only applied when they meet strict thresholds:

```typescript
// lib/winPatterns/gating.ts

interface WinPatternGatingCriteria {
  min_sample_size: 50;              // At least 50 similar deals
  min_confidence: 0.7;               // 70% statistical confidence
  min_segment_match: 0.8;            // 80% match on characteristics
  recency_weight: true;              // Recent wins count more
  exclude_outliers: true;            // Remove statistical outliers
}

async function findMatchingWinPattern(item: CommandCenterItem): Promise<WinPattern | null> {
  const dealCharacteristics = {
    industry: item.deal?.company?.industry,
    deal_size_band: getDealSizeBand(item.deal_value),
    stage: item.deal?.stage,
    persona_involved: item.contact?.persona,
    company_size: item.deal?.company?.employee_count_band
  };
  
  const candidates = await db.select()
    .from(winPatterns)
    .where(eq(winPatterns.action_type, item.action_type));
  
  for (const pattern of candidates) {
    // Check sample size
    if (pattern.sample_size < 50) continue;
    
    // Check confidence
    if (pattern.confidence_level < 0.7) continue;
    
    // Calculate segment match
    const segmentMatch = calculateSegmentMatch(
      dealCharacteristics,
      pattern.deal_characteristics
    );
    
    if (segmentMatch < 0.8) continue;
    
    // Passed all gates
    return {
      ...pattern,
      segment_match_score: segmentMatch
    };
  }
  
  return null;
}

function calculateSegmentMatch(
  deal: DealCharacteristics,
  pattern: PatternCharacteristics
): number {
  let matches = 0;
  let total = 0;
  
  // Industry match
  if (pattern.industry?.length > 0) {
    total++;
    if (pattern.industry.includes(deal.industry)) matches++;
  }
  
  // Deal size band
  if (pattern.deal_size_band) {
    total++;
    if (pattern.deal_size_band === deal.deal_size_band) matches++;
  }
  
  // Stage
  if (pattern.stage) {
    total++;
    if (pattern.stage === deal.stage) matches++;
  }
  
  // Persona
  if (pattern.persona_involved) {
    total++;
    if (pattern.persona_involved === deal.persona_involved) matches++;
  }
  
  // Company size
  if (pattern.company_size) {
    total++;
    if (pattern.company_size === deal.company_size) matches++;
  }
  
  return total > 0 ? matches / total : 0;
}
```

### Displaying Win Pattern Context

When a win pattern applies, show the evidence:

```typescript
// In the action card
{item.win_pattern_sample_size && (
  <div className="text-xs text-gray-500 mt-1">
    Based on {item.win_pattern_sample_size} similar deals 
    ({(item.win_pattern_match_score * 100).toFixed(0)}% match)
  </div>
)}
```

---

## Action Card Component (Updated)

```typescript
// components/commandCenter/ActionCard.tsx

function ActionCard({ item, isCurrentAction = false }: { item: CommandCenterItem; isCurrentAction?: boolean }) {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showHumanBrief, setShowHumanBrief] = useState(false);
  
  const Icon = ACTION_ICONS[item.action_type] || Zap;
  
  return (
    <Card className={cn(
      "border-l-4 transition-all",
      isCurrentAction && "ring-2 ring-blue-500 shadow-lg",
      item.risk_level === 'critical' && "border-l-red-500 bg-red-50/50",
      item.risk_level === 'high' && "border-l-orange-500 bg-orange-50/30",
      item.requires_human_review && "border-l-purple-500"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isCurrentAction ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm uppercase tracking-wide text-gray-500">
                  {item.action_type.replace(/_/g, ' ')}
                </span>
                <span className="font-medium">{item.target_name}</span>
              </div>
              <span className="text-sm text-gray-500">{item.company_name}</span>
            </div>
          </div>
          
          {/* Score + Time Estimate */}
          <div className="text-right">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded"
              >
                <span className={cn(
                  "font-bold",
                  item.momentum_score >= 80 && "text-red-600",
                  item.momentum_score >= 60 && item.momentum_score < 80 && "text-orange-600",
                  item.momentum_score < 60 && "text-gray-600"
                )}>
                  {item.momentum_score}
                </span>
                <ChevronDown className={cn(
                  "w-3 h-3 transition-transform",
                  showScoreBreakdown && "rotate-180"
                )} />
              </button>
              
              {item.deal_value && (
                <span className="text-sm text-gray-500">
                  🎯 ${(item.deal_value / 1000).toFixed(0)}K
                </span>
              )}
            </div>
            
            <span className="text-xs text-gray-400">
              ~{item.estimated_minutes} min
            </span>
          </div>
        </div>
        
        {/* Score Breakdown (expandable) */}
        {showScoreBreakdown && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="font-medium mb-2">Score Breakdown</div>
            {item.score_explanation?.map((line, i) => (
              <div key={i} className={cn(
                "text-gray-600",
                line.startsWith('⚠️') && "text-orange-600"
              )}>
                {line}
              </div>
            ))}
          </div>
        )}
        
        {/* Why Now - THE KEY ELEMENT */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm">
            <span className="font-medium text-blue-700">Why now: </span>
            {item.why_now}
          </p>
        </div>
        
        {/* Human Review Alert */}
        {item.requires_human_review && (
          <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 text-purple-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">Needs your judgment</span>
            </div>
            <p className="text-sm text-purple-600 mt-1">
              {item.sentiment_routing === 'human_leverage_brief' 
                ? 'Negative sentiment detected — review approach before acting'
                : 'This situation needs human decision-making'}
            </p>
            {item.human_leverage_brief && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setShowHumanBrief(true)}
              >
                View Strategic Brief
              </Button>
            )}
          </div>
        )}
        
        {/* Context */}
        {item.context_brief && (
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Context: </span>
            {item.context_brief}
          </p>
        )}
        
        {/* Win Tip */}
        {item.win_tip && (
          <div className="mt-2 flex items-start gap-2 text-sm">
            <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-gray-700">{item.win_tip}</span>
              {item.win_pattern_sample_size && (
                <span className="text-xs text-gray-400 ml-1">
                  (n={item.win_pattern_sample_size})
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Landmines */}
        {item.landmine_warnings?.length > 0 && (
          <div className="mt-2 p-2 bg-red-50 rounded text-sm">
            <span className="font-medium text-red-700">⚠️ Avoid: </span>
            <span className="text-red-600">{item.landmine_warnings.join(', ')}</span>
          </div>
        )}
        
        {/* Action Buttons - ONE DOMINANT CTA */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            {/* Primary Action - DOMINANT */}
            <Button 
              size={isCurrentAction ? "default" : "sm"}
              className={cn(
                isCurrentAction && "px-8 py-3 text-base",
                item.requires_human_review ? "bg-purple-600 hover:bg-purple-700" : ""
              )}
              onClick={() => executeAction(item)}
            >
              {item.primary_action_icon && <item.primary_action_icon className="w-4 h-4 mr-2" />}
              {item.primary_action_label || 'Do It'}
            </Button>
            
            {/* Secondary Actions - de-emphasized */}
            {item.fallback_action && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-gray-500"
                onClick={() => executeFallback(item)}
              >
                {item.fallback_action_label}
              </Button>
            )}
          </div>
          
          {/* Skip to next */}
          {isCurrentAction && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => skipToNext(item.id)}
            >
              → Next
            </Button>
          )}
        </div>
      </CardContent>
      
      {/* Human Leverage Brief Modal */}
      {showHumanBrief && item.human_leverage_brief && (
        <HumanLeverageBriefModal
          brief={item.human_leverage_brief}
          onClose={() => setShowHumanBrief(false)}
        />
      )}
    </Card>
  );
}
```

---

## Updated Cron Jobs

```typescript
// vercel.json
{
  "crons": [
    // Morning: Generate daily plan
    { 
      "path": "/api/cron/generate-daily-plans", 
      "schedule": "0 6 * * *" 
    },
    
    // Every 15 min: Recalculate momentum scores
    { 
      "path": "/api/cron/calculate-momentum", 
      "schedule": "*/15 * * * *" 
    },
    
    // Every 5 min: Process engagement signals
    { 
      "path": "/api/cron/process-engagement-signals", 
      "schedule": "*/5 * * * *" 
    },
    
    // Every 4 hours: Check action outcomes
    { 
      "path": "/api/cron/check-outcomes", 
      "schedule": "0 */4 * * *" 
    },
    
    // Every 6 hours: Calculate ghosting risk
    { 
      "path": "/api/cron/predict-ghosting", 
      "schedule": "0 */6 * * *" 
    },
    
    // Weekly: Learn win patterns
    { 
      "path": "/api/cron/learn-win-patterns", 
      "schedule": "0 2 * * 0" 
    },
    
    // Daily: Update rep time profiles from behavior
    { 
      "path": "/api/cron/learn-rep-profiles", 
      "schedule": "0 3 * * *" 
    }
  ]
}
```

---

## Implementation Phases (Updated)

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **Phase 1: Time-Aware Core** | Daily planning + basic scoring | Time block calculation, action duration estimates, Flow Feed UI, basic momentum score (B+T+V+I) |
| **Phase 2: Score Intelligence** | Full scoring + explanations | Engagement signals, risk overlay, score explanations, human-readable breakdowns |
| **Phase 3: Outcomes + Learning** | Feedback loops | Outcome tracking, outcome checking job, win pattern gating, pattern learning |
| **Phase 4: Advanced AI** | Sophisticated features | Ghostwriter style learning, ghosting prediction, Human Leverage Briefs, landmine detection |

### Phase 1 MVP (Ship This First)

The minimum to deliver "feels incredible":
- ✅ Calculate available time (8hr - meetings)
- ✅ Estimate action durations
- ✅ Fill available time with highest-momentum actions
- ✅ Show "Your Day" view with time blocks
- ✅ Basic momentum score: B + T + V + I
- ✅ "Why now" on every card
- ✅ One dominant CTA per card
- ✅ Activity logging (emails + meetings → deal timeline)

### What Waits for Phase 2+
- ⏳ Win patterns (need data + strict gating)
- ⏳ Style learning / Ghostwriter
- ⏳ Sentiment routing / Human Leverage Briefs
- ⏳ Engagement signals (need tracking infrastructure)
- ⏳ Ghosting prediction

---

## Testing Checklist

### Time-Aware Planning
- [ ] Available minutes calculated correctly (work day - meetings - buffers)
- [ ] Time blocks generated around meetings
- [ ] Prep time added before external meetings
- [ ] Actions fill available blocks by momentum score
- [ ] Estimated durations reasonable for each action type
- [ ] Overflow items tracked separately
- [ ] Daily plan regenerates when calendar changes

### Momentum Scoring
- [ ] Score explanation shows plain English breakdown
- [ ] Risk overlay additive (not multiplicative)
- [ ] Base score capped at 70
- [ ] Risk overlay capped at 30
- [ ] Final score capped at 100
- [ ] Engagement signals boost correctly
- [ ] Win patterns only apply when gated thresholds met
- [ ] Negative sentiment triggers routing, not just boost

### Sentiment Routing
- [ ] Negative sentiment flags requires_human_review
- [ ] Human Leverage Brief generated for critical situations
- [ ] Auto-send suppressed for negative sentiment items
- [ ] Different approach suggestions based on severity

### Outcome Tracking
- [ ] Expected outcome set when action created
- [ ] Outcome check job runs every 4 hours
- [ ] Reply detection works
- [ ] Meeting booked detection works
- [ ] Stage change detection works
- [ ] Positive outcomes feed into win pattern learning

### Activity Logging
- [ ] All sent emails logged to deal timeline
- [ ] All meetings logged with AI summary
- [ ] Completed tasks logged
- [ ] Last activity dates update on deal/contact/company
- [ ] Source tracking (command_center, email_sync, etc.)

---

## Feature Module: Win Strategy (Meeting Prep)

Enhanced meeting prep with tactical intelligence:

```typescript
interface WinStrategyBrief {
  // Basics
  meeting_title: string;
  meeting_time: Date;
  join_url: string;
  
  // Attendee Intelligence
  attendees: Array<{
    name: string;
    title: string;
    persona: 'champion' | 'economic_buyer' | 'technical' | 'blocker' | 'end_user' | 'unknown';
    influence_level: 'decision_maker' | 'influencer' | 'evaluator';
    relationship_strength: 'strong' | 'developing' | 'new' | 'at_risk';
    
    // What they care about
    priorities: string[];
    communication_style: string;
    
    // Interaction history
    last_interaction: string;
    sentiment_with_us: number;
    
    // NEW: Their internal influence
    reports_to?: string;
    influences?: string[];
  }>;
  
  // Tactical Intelligence
  meeting_objective: string;
  success_criteria: string[];                      // What does "win" look like?
  
  talking_points: Array<{
    point: string;
    why: string;
    evidence?: string;                             // Supporting data
  }>;
  
  // NEW: Landmine Alerts
  landmines: Array<{
    topic: string;
    reason: string;
    occurred_when: string;
    safe_alternative?: string;
  }>;
  
  // NEW: Questions to Answer
  questions_they_asked: Array<{
    question: string;
    asked_by: string;
    when: string;
    answered: boolean;
    our_answer?: string;
  }>;
  
  // NEW: Commitments Outstanding
  our_commitments: Array<{
    commitment: string;
    made_to: string;
    due: string;
    status: 'pending' | 'done' | 'overdue';
  }>;
  
  their_commitments: Array<{
    commitment: string;
    made_by: string;
    due: string;
    status: 'pending' | 'done' | 'overdue';
  }>;
  
  // Competitive Context
  competitors: Array<{
    name: string;
    threat_level: 'high' | 'medium' | 'low';
    their_angle: string;
    our_counter: string;
  }>;
  
  // NEW: Win Playbook
  win_playbook: {
    similar_deals_won: number;
    key_actions_that_won: string[];
    common_objections_overcome: string[];
    avg_days_to_close_from_here: number;
  };
  
  // NEW: Meeting Outcome Prediction
  predicted_outcome: {
    probability: number;                           // 0-100
    confidence: string;                            // 'high', 'medium', 'low'
    key_factors: string[];
    risks: string[];
    to_improve_odds: string[];
  };
}
```

### Landmine Detection

```typescript
// lib/ai/landmineDetection.ts

export async function detectLandmines(
  dealId: string,
  contactIds: string[]
): Promise<Landmine[]> {
  
  // Gather all interactions
  const emails = await getEmailThreads(dealId);
  const meetings = await getMeetingTranscripts(dealId);
  const activities = await getActivities(dealId);
  
  const prompt = `Analyze these sales interactions and identify "landmine" topics - 
subjects that caused friction, concern, or negative reactions from the prospect.

## Email Threads
${emails.map(e => `
Subject: ${e.subject}
${e.messages.map(m => `[${m.from}]: ${m.body_preview}`).join('\n')}
`).join('\n---\n')}

## Meeting Transcripts
${meetings.map(m => `
Meeting: ${m.subject}
Key moments: ${m.key_moments?.join(', ')}
Objections raised: ${m.objections?.join(', ')}
Sentiment drops: ${m.sentiment_drops?.map(s => s.context).join(', ')}
`).join('\n---\n')}

Identify landmines. Return JSON array:
[
  {
    "topic": "The specific topic",
    "reason": "Why it's sensitive",
    "occurred_when": "Date/context when it happened",
    "severity": "high|medium|low",
    "safe_alternative": "How to approach this topic safely"
  }
]`;

  const response = await callAI({ prompt, maxTokens: 1000 });
  return JSON.parse(response.content);
}
```

---

## Feature Module: Ghostwriter (Draft Emails)

AI-generated drafts with style mirroring and outcome calibration:

```typescript
// lib/ghostwriter/draftGenerator.ts

interface GhostwriterConfig {
  // Style learning
  learn_from_sent_folder: boolean;
  style_profile?: RepStyleProfile;
  
  // Outcome calibration
  optimize_for: 'response_rate' | 'meeting_booking' | 'deal_progression';
  
  // Guardrails
  require_human_review: boolean;
  confidence_threshold_for_auto_send: number;  // e.g., 95
}

interface RepStyleProfile {
  // Learned from sent emails
  avg_email_length: number;
  formality_level: 'formal' | 'professional' | 'casual';
  greeting_patterns: string[];
  sign_off_patterns: string[];
  
  // Tone markers
  uses_humor: boolean;
  uses_emojis: boolean;
  asks_questions: boolean;
  
  // Structure
  uses_bullet_points: boolean;
  paragraph_length: 'short' | 'medium' | 'long';
}

export async function generateDraft(
  context: DraftContext,
  config: GhostwriterConfig
): Promise<Draft> {
  
  // 1. Get rep's style profile
  const styleProfile = config.style_profile || 
    await learnRepStyle(context.userId);
  
  // 2. Get contact's preferences
  const contactPrefs = await analyzeContactPreferences(context.contactId);
  
  // 3. Get winning email patterns for this situation
  const winningPatterns = await getWinningEmailPatterns({
    trigger: context.trigger,
    dealStage: context.deal?.stage,
    contactPersona: context.contact?.persona,
    objective: config.optimize_for
  });
  
  // 4. Generate draft
  const prompt = buildGhostwriterPrompt(context, styleProfile, contactPrefs, winningPatterns);
  const response = await callAI({ prompt, maxTokens: 1000 });
  const draft = JSON.parse(response.content);
  
  // 5. Score confidence
  const confidence = calculateDraftConfidence(draft, context, winningPatterns);
  
  // 6. Identify what needs review
  const reviewItems = identifyReviewNeeds(draft, context);
  
  return {
    subject: draft.subject,
    body: draft.body,
    body_html: draft.body_html,
    confidence,
    review_items: reviewItems,
    style_match_score: calculateStyleMatch(draft, styleProfile),
    predicted_response_rate: predictResponseRate(draft, context),
    alternatives: draft.alternatives  // Different approaches
  };
}

async function learnRepStyle(userId: string): Promise<RepStyleProfile> {
  // Analyze last 100 sent emails
  const sentEmails = await getSentEmails(userId, { limit: 100 });
  
  const prompt = `Analyze these sent emails and extract the writer's style profile.

Emails:
${sentEmails.map(e => `
Subject: ${e.subject}
Body: ${e.body_text}
`).join('\n---\n')}

Return JSON:
{
  "avg_email_length": number,
  "formality_level": "formal|professional|casual",
  "greeting_patterns": ["Hey {name}", "Hi {name}"],
  "sign_off_patterns": ["Best,", "Thanks,"],
  "uses_humor": boolean,
  "uses_emojis": boolean,
  "asks_questions": boolean,
  "uses_bullet_points": boolean,
  "paragraph_length": "short|medium|long",
  "distinctive_phrases": ["Happy to...", "Looking forward to..."]
}`;

  const response = await callAI({ prompt, maxTokens: 500 });
  return JSON.parse(response.content);
}

async function getWinningEmailPatterns(criteria: object): Promise<WinningPattern[]> {
  // Query historical data for emails that led to desired outcomes
  const patterns = await db.select()
    .from(emailPatterns)
    .where(and(
      eq(emailPatterns.trigger, criteria.trigger),
      gte(emailPatterns.success_rate, 0.6),
      gte(emailPatterns.sample_size, 20)
    ))
    .orderBy(desc(emailPatterns.success_rate))
    .limit(3);
  
  return patterns;
}
```

### One-Click Send with Auto-Logging

```typescript
// When draft is sent from Command Center
export async function sendFromCommandCenter(
  itemId: string,
  draftId: string,
  modifications?: { subject?: string; body?: string }
): Promise<SendResult> {
  
  const item = await getCommandCenterItem(itemId);
  const draft = await getEmailDraft(draftId);
  
  // 1. Send the email
  const result = await sendEmail({
    to: draft.recipients,
    subject: modifications?.subject || draft.subject,
    body: modifications?.body || draft.body_html,
    dealId: item.deal_id
  });
  
  // 2. Auto-log to deal timeline
  await logActivity({
    userId: item.user_id,
    type: 'email_sent',
    title: `Email sent: ${draft.subject}`,
    description: draft.body_preview,
    dealId: item.deal_id,
    companyId: item.company_id,
    contactId: item.contact_id,
    source: 'command_center_ghostwriter',
    sourceId: result.messageId,
    occurredAt: new Date()
  });
  
  // 3. Mark command center item complete
  await markItemCompleted(itemId, 'email_sent', result.messageId);
  
  // 4. Track for pattern learning
  await trackEmailOutcome({
    draftId,
    messageId: result.messageId,
    trigger: draft.generation_trigger,
    dealId: item.deal_id,
    sentAt: new Date()
  });
  
  // 5. Queue follow-up check (did they respond?)
  await scheduleOutcomeCheck(result.messageId, addDays(new Date(), 3));
  
  return result;
}
```

---

## Feature Module: Predictive Follow-ups

AI-tracked commitments with ghosting prediction:

```typescript
// lib/followups/ghostingPrediction.ts

interface GhostingRisk {
  score: number;                   // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  signals: string[];
  days_until_predicted_ghost: number;
  recommended_action: string;
  action_urgency: string;
}

export async function calculateGhostingRisk(
  dealId: string,
  contactId: string
): Promise<GhostingRisk> {
  
  const contact = await getContact(contactId);
  const deal = await getDeal(dealId);
  const recentActivity = await getRecentActivity(dealId, { days: 30 });
  const emailVelocity = await getContactEmailVelocity(contactId);
  
  let score = 0;
  const signals: string[] = [];
  
  // Signal: Response time increasing
  if (emailVelocity.current_deviation === 'much_slower') {
    score += 25;
    signals.push('Response time significantly slower than usual');
  } else if (emailVelocity.current_deviation === 'slower') {
    score += 15;
    signals.push('Response time slower than usual');
  }
  
  // Signal: Sentiment declining
  const sentimentTrend = await getSentimentTrend(dealId);
  if (sentimentTrend === 'declining') {
    score += 20;
    signals.push('Communication sentiment declining');
  }
  
  // Signal: Engagement dropping
  const engagementTrend = await getEngagementTrend(dealId);
  if (engagementTrend.email_open_rate_change < -0.3) {
    score += 15;
    signals.push('Email open rate dropped significantly');
  }
  
  // Signal: Meeting cancellations
  const recentCancellations = await getRecentCancellations(dealId);
  if (recentCancellations > 0) {
    score += 20 * recentCancellations;
    signals.push(`${recentCancellations} recent meeting cancellation(s)`);
  }
  
  // Signal: Days since meaningful interaction
  const daysSinceContact = await getDaysSinceMeaningfulContact(dealId);
  if (daysSinceContact > 10) {
    score += Math.min(30, daysSinceContact * 2);
    signals.push(`${daysSinceContact} days since meaningful contact`);
  }
  
  // Signal: Competitor activity
  const competitorMentions = deal.signals?.competitor_mentions || [];
  if (competitorMentions.length > 0) {
    score += 15;
    signals.push('Competitor(s) mentioned recently');
  }
  
  // Signal: Stage regression indicators
  if (deal.stage_regression_risk) {
    score += 20;
    signals.push('Deal showing signs of stage regression');
  }
  
  // Calculate risk level and recommendations
  const risk_level = 
    score >= 70 ? 'critical' :
    score >= 50 ? 'high' :
    score >= 30 ? 'medium' : 'low';
  
  const recommended_action = getRecommendedAction(score, signals, deal);
  
  return {
    score: Math.min(100, score),
    risk_level,
    signals,
    days_until_predicted_ghost: Math.max(1, Math.round((100 - score) / 10)),
    recommended_action,
    action_urgency: risk_level === 'critical' ? 'today' : 
                    risk_level === 'high' ? 'this_week' : 'when_convenient'
  };
}

function getRecommendedAction(score: number, signals: string[], deal: Deal): string {
  if (score >= 70) {
    return 'Escalate: Request executive sponsor involvement or offer significant value add';
  }
  if (signals.includes('Meeting cancellation(s)')) {
    return 'Send value-add content with a soft reschedule offer';
  }
  if (signals.includes('Response time significantly slower than usual')) {
    return 'Try a different channel (call if emailing, LinkedIn if calling)';
  }
  if (signals.includes('Competitor(s) mentioned recently')) {
    return 'Request competitive positioning support and send differentiation content';
  }
  return 'Reach out with a relevant, personalized touch point';
}
```

### Commitment Auto-Extraction

```typescript
// lib/followups/commitmentExtraction.ts

export async function extractCommitments(
  transcriptText: string,
  participants: Participant[]
): Promise<Commitment[]> {
  
  const ourPeople = participants.filter(p => p.side === 'internal');
  const theirPeople = participants.filter(p => p.side === 'external');
  
  const prompt = `Extract all commitments made during this conversation.

Participants:
Our team: ${ourPeople.map(p => p.name).join(', ')}
Their team: ${theirPeople.map(p => p.name).join(', ')}

Transcript:
${transcriptText}

Extract commitments. A commitment is a promise to do something specific.
Return JSON array:
[
  {
    "party": "us" or "them",
    "person": "Name of person who made commitment",
    "commitment": "What they committed to do",
    "deadline": "ISO date if mentioned, null if not",
    "deadline_context": "e.g., 'by end of week', 'Tuesday'",
    "confidence": 0.0-1.0,
    "quote": "Exact quote if possible"
  }
]

Be specific. "I'll get back to you" is vague. "I'll send the security questionnaire by Tuesday" is specific.`;

  const response = await callAI({ prompt, maxTokens: 1000 });
  const commitments = JSON.parse(response.content);
  
  // Create follow-up items for "our" commitments
  for (const commitment of commitments.filter(c => c.party === 'us')) {
    await createCommitmentFollowUp(commitment);
  }
  
  // Track "their" commitments for follow-up if not delivered
  for (const commitment of commitments.filter(c => c.party === 'them')) {
    await trackTheirCommitment(commitment);
  }
  
  return commitments;
}
```

---

## Engagement Signal Processing

Real-time buyer activity triggers momentum boosts:

```typescript
// lib/engagement/signalProcessor.ts

// Webhook handler for email tracking events
export async function processEngagementSignal(signal: {
  type: string;
  contact_id: string;
  deal_id?: string;
  data: any;
}): Promise<void> {
  
  // Store the signal
  const [stored] = await db.insert(engagementSignals)
    .values({
      signal_type: signal.type,
      contact_id: signal.contact_id,
      deal_id: signal.deal_id,
      signal_data: signal.data,
      occurred_at: new Date()
    })
    .returning();
  
  // Calculate urgency boost
  const boostAmount = ENGAGEMENT_BOOST[signal.type] || 0;
  
  if (boostAmount > 0 && signal.deal_id) {
    // Find related command center items
    const items = await db.select()
      .from(commandCenterItems)
      .where(and(
        eq(commandCenterItems.deal_id, signal.deal_id),
        eq(commandCenterItems.status, 'pending')
      ));
    
    for (const item of items) {
      // Boost momentum score
      await db.update(commandCenterItems)
        .set({
          engagement_signals: sql`engagement_signals || ${JSON.stringify({
            [signal.type]: { at: new Date(), data: signal.data }
          })}::jsonb`,
          last_engagement_at: new Date(),
          momentum_score: sql`LEAST(100, momentum_score + ${boostAmount})`,
          why_now: generateWhyNow(signal, item)
        })
        .where(eq(commandCenterItems.id, item.id));
    }
    
    // Mark signal as processed
    await db.update(engagementSignals)
      .set({ 
        processed: true,
        boosted_items: items.map(i => i.id)
      })
      .where(eq(engagementSignals.id, stored.id));
    
    // If high-value signal, create notification
    if (['proposal_viewed', 'forwarded_internally'].includes(signal.type)) {
      await createRealTimeNotification({
        userId: items[0]?.user_id,
        type: 'hot_signal',
        title: `🔥 ${signal.contact?.name} ${SIGNAL_DESCRIPTIONS[signal.type]}`,
        dealId: signal.deal_id,
        actionUrl: `/command-center?deal=${signal.deal_id}`
      });
    }
  }
}

const ENGAGEMENT_BOOST: Record<string, number> = {
  'proposal_viewed': 20,
  'forwarded_internally': 25,
  'pricing_page_viewed': 15,
  'email_opened': 5,
  'link_clicked': 8,
  'replied_within_hour': 10,
  'meeting_accepted': 15,
  'attendee_added': 12,
  'document_downloaded': 10
};

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  'proposal_viewed': 'is viewing your proposal right now',
  'forwarded_internally': 'forwarded your email internally',
  'pricing_page_viewed': 'is looking at pricing',
  'meeting_accepted': 'accepted the meeting invite',
  'attendee_added': 'added someone to the meeting'
};
```

---

## Win Pattern Learning

Continuously learn what actions lead to wins:

```typescript
// lib/winPatterns/learner.ts

// Run weekly to update win patterns
export async function updateWinPatterns(): Promise<void> {
  
  // Get recently closed deals (last 90 days)
  const closedDeals = await db.select()
    .from(deals)
    .where(and(
      inArray(deals.stage, ['closed_won', 'closed_lost']),
      gte(deals.closed_at, subDays(new Date(), 90))
    ));
  
  const wonDeals = closedDeals.filter(d => d.stage === 'closed_won');
  const lostDeals = closedDeals.filter(d => d.stage === 'closed_lost');
  
  // Analyze action patterns
  const patterns = await analyzeActionPatterns(wonDeals, lostDeals);
  
  for (const pattern of patterns) {
    await db.insert(winPatterns)
      .values(pattern)
      .onConflictDoUpdate({
        target: [winPatterns.action_type, winPatterns.trigger_condition],
        set: {
          win_correlation: pattern.win_correlation,
          sample_size: pattern.sample_size,
          last_calculated_at: new Date()
        }
      });
  }
}

async function analyzeActionPatterns(
  wonDeals: Deal[],
  lostDeals: Deal[]
): Promise<WinPattern[]> {
  
  const patterns: WinPattern[] = [];
  
  // Pattern: Speed to respond after proposal view
  const proposalViewResponses = await analyzeProposalViewResponses(wonDeals, lostDeals);
  patterns.push({
    pattern_name: 'Strike While Hot',
    action_type: 'call',
    trigger_condition: 'proposal_viewed',
    win_correlation: proposalViewResponses.winRate,
    sample_size: proposalViewResponses.sampleSize,
    deal_characteristics: { stage: 'proposal' }
  });
  
  // Pattern: Multi-threading early
  const multiThreading = await analyzeMultiThreadingImpact(wonDeals, lostDeals);
  patterns.push({
    pattern_name: 'Multi-Thread Early',
    action_type: 'add_stakeholder',
    trigger_condition: 'after_first_meeting',
    win_correlation: multiThreading.winRate,
    sample_size: multiThreading.sampleSize,
    deal_characteristics: { value_min: 50000 }
  });
  
  // Add more patterns...
  
  return patterns;
}
```

