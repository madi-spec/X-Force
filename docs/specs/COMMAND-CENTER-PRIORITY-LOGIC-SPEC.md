# Command Center Priority Logic — Definitive Specification

## The Core Insight

**Salespeople don't think in tasks. They think in moments where momentum can be gained or lost.**

The Command Center's job is NOT to rank tasks.

It is to answer: **Which clock is about to expire — and what do I do about it?**

---

## The Six Clocks

Every deal has multiple clocks running simultaneously:

| Clock | What It Measures | When It Expires |
|-------|------------------|-----------------|
| **Response Clock** | Someone is waiting on you | Minutes/hours |
| **Decision Clock** | Buyer has a deadline | Days |
| **Competition Clock** | Rival might win first | Days |
| **Trust Clock** | You made a promise | Hours/days |
| **Decay Clock** | Interest fades without action | Days/weeks |
| **Value Clock** | Big deal deserves attention | Ongoing |

**The priority system surfaces whichever clock is closest to expiring.**

---

## The Hierarchy (Non-Negotiable)

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 RESPOND NOW                                                 │
│  Someone raised their hand. They are waiting for YOU.           │
│  Nothing else matters until this is empty.                      │
├─────────────────────────────────────────────────────────────────┤
│  🟠 DON'T LOSE THIS                                             │
│  Real deadline, active competition, or decision in progress.    │
│  Waiting costs you the deal.                                    │
├─────────────────────────────────────────────────────────────────┤
│  🟡 KEEP YOUR WORD                                              │
│  You promised something. Your credibility is on the line.       │
├─────────────────────────────────────────────────────────────────┤
│  🟢 MOVE BIG DEALS                                              │
│  High-value or strategic deals deserve proactive attention.     │
├─────────────────────────────────────────────────────────────────┤
│  🔵 BUILD PIPELINE                                              │
│  Important but not urgent. Do when other buckets are empty.     │
└─────────────────────────────────────────────────────────────────┘
```

**RULE: Items NEVER move up tiers. A Tier 3 item cannot become Tier 1 just because it's old.**

**RULE: Tier 1 being non-empty should feel uncomfortable. The UI should make it clear: "Why are you doing anything else?"**

---

## TIER 1: RESPOND NOW 🔴

### Definition
Someone reached out and is waiting for your response. The clock started when they hit send.

### What Triggers Tier 1

| Trigger | Detection Method | Response SLA |
|---------|------------------|--------------|
| **Trial/Demo request** | Inbound email with keywords OR form submission OR Calendly booking | 15 minutes |
| **Pricing/Quote request** | Inbound email with "pricing", "cost", "quote", "proposal" | 2 hours |
| **Direct question** | Inbound email ending with "?" or containing "can you", "could you", "do you" | 4 hours |
| **Reply to your email** | Email in existing thread, direction = inbound | 4 hours |
| **Meeting request** | "Can we talk", "are you free", "schedule a call" | 4 hours |
| **Missed meeting follow-up** | Calendar event marked no-show, no follow-up sent | 1 hour |

### Detection Logic

```typescript
function isTier1(item: ActionItem): { isTier1: boolean; sla_minutes: number; trigger: string } {
  
  // Check for inbound email
  if (item.source === 'email' && item.direction === 'inbound') {
    const content = (item.subject + ' ' + item.body).toLowerCase();
    
    // Trial/Demo - HIGHEST URGENCY
    if (['demo', 'trial', 'free trial', 'see a demo', 'book a demo', 'schedule a demo', 
         'interested in a demo', 'sign up', 'get started'].some(k => content.includes(k))) {
      return { isTier1: true, sla_minutes: 15, trigger: 'demo_request' };
    }
    
    // Pricing - HIGH URGENCY
    if (['pricing', 'price', 'cost', 'quote', 'proposal', 'how much', 
         'what does it cost', 'budget'].some(k => content.includes(k))) {
      return { isTier1: true, sla_minutes: 120, trigger: 'pricing_request' };
    }
    
    // Direct question - MEDIUM URGENCY
    if (content.includes('?') || ['can you', 'could you', 'do you', 'would you', 
         'is it possible', 'how do i', 'what is'].some(k => content.includes(k))) {
      return { isTier1: true, sla_minutes: 240, trigger: 'direct_question' };
    }
    
    // Any reply to your thread - MEDIUM URGENCY
    if (item.is_reply_to_your_email) {
      return { isTier1: true, sla_minutes: 240, trigger: 'email_reply' };
    }
  }
  
  // Form submission
  if (item.source === 'form_submission') {
    return { isTier1: true, sla_minutes: 15, trigger: 'form_submission' };
  }
  
  // Calendar booking
  if (item.source === 'calendly' || item.source === 'scheduling_link') {
    return { isTier1: true, sla_minutes: 15, trigger: 'meeting_booked' };
  }
  
  // Missed meeting
  if (item.source === 'calendar' && item.type === 'no_show') {
    return { isTier1: true, sla_minutes: 60, trigger: 'missed_meeting' };
  }
  
  return { isTier1: false, sla_minutes: 0, trigger: null };
}
```

### Sorting Within Tier 1
```typescript
// Sort by: SLA breach severity, then recency
function sortTier1(items: Tier1Item[]): Tier1Item[] {
  return items.sort((a, b) => {
    const aBreachMinutes = getMinutesSinceReceived(a) - a.sla_minutes;
    const bBreachMinutes = getMinutesSinceReceived(b) - b.sla_minutes;
    
    // Breached items first, sorted by how badly breached
    if (aBreachMinutes > 0 && bBreachMinutes > 0) {
      return bBreachMinutes - aBreachMinutes; // Most breached first
    }
    if (aBreachMinutes > 0) return -1;
    if (bBreachMinutes > 0) return 1;
    
    // Non-breached: closest to SLA first
    return (a.sla_minutes - getMinutesSinceReceived(a)) - 
           (b.sla_minutes - getMinutesSinceReceived(b));
  });
}
```

### UI for Tier 1

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔴 RESPOND NOW                                              2 items    │
│    People are waiting. Response speed = close rate.                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📧 Demo request from John Smith                          ⏱️ 12 min  │
│   Acme Corp · $0 (new)                                                 │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ 💡 "Hi, I'd like to schedule a demo of your platform..."     │    │
│   │    Respond in next 3 min to hit 15-min SLA.                  │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📧 Reply]  [📅 Send Calendly]  [📞 Call Now]                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📧 Reply: Sarah's question about API limits              ⏱️ 2h 15m  │
│   TechCorp · API Integration Deal · $85K                    ⚠️ OVERDUE │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ 💡 She asked: "What are the rate limits for the API?"        │    │
│   │    4-hour SLA breached. Respond now.                         │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📧 Reply]                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The "Nothing Else Matters" Rule

When Tier 1 is non-empty:
- Other tiers are **collapsed by default**
- Show message: "2 people are waiting for you"
- Other tiers have **reduced opacity** (30% grey)
- Clicking on other tiers shows warning: "Are you sure? Someone is waiting for a response."

```typescript
function shouldCollapseOtherTiers(tier1Items: ActionItem[]): boolean {
  return tier1Items.length > 0;
}
```

---

## TIER 2: DON'T LOSE THIS 🟠

### Definition
Deals with external pressure where inaction TODAY could cost you the deal.

### What Triggers Tier 2

| Trigger | Detection Method | Why Urgent |
|---------|------------------|------------|
| **Hard deadline within 14 days** | `deal.close_date` within 14 days | Budget expires, decision date |
| **Competitor mentioned** | AI extraction from transcript/email | You're in a race |
| **Proposal heavily viewed** | 3+ views in 48 hours | They're deciding NOW |
| **Champion went dark** | Key contact: 0 replies to last 2 emails | Inside access at risk |
| **Multi-stakeholder engaged** | 3+ contacts active in last week | Deal is heating up |
| **Verbal commit, no signature** | Stage = "Verbal Commit" for 5+ days | Close it or lose it |

### Detection Logic

```typescript
function isTier2(item: ActionItem): { isTier2: boolean; trigger: string; urgency_score: number } {
  const deal = item.deal;
  
  if (!deal) {
    return { isTier2: false, trigger: null, urgency_score: 0 };
  }
  
  let triggers: string[] = [];
  let urgency_score = 0;
  
  // Hard deadline approaching
  if (deal.close_date) {
    const daysUntil = getDaysUntil(deal.close_date);
    if (daysUntil <= 7) {
      triggers.push('deadline_critical');
      urgency_score += 30;
    } else if (daysUntil <= 14) {
      triggers.push('deadline_approaching');
      urgency_score += 20;
    }
  }
  
  // Competitor mentioned (from transcripts or deal notes)
  if (deal.competitors?.length > 0 || deal.competitive_risk) {
    triggers.push('competitive_risk');
    urgency_score += 25;
  }
  
  // Hot engagement signals
  if (item.engagement?.proposal_views >= 3 && item.engagement?.proposal_views_last_48h >= 2) {
    triggers.push('proposal_hot');
    urgency_score += 20;
  }
  
  // Champion dark (key contact not responding)
  const champion = deal.contacts?.find(c => c.role === 'champion');
  if (champion && champion.emails_without_reply >= 2 && champion.days_since_last_reply > 7) {
    triggers.push('champion_dark');
    urgency_score += 25;
  }
  
  // Multi-stakeholder momentum
  const activeContacts = deal.contacts?.filter(c => c.last_activity_days <= 7).length || 0;
  if (activeContacts >= 3) {
    triggers.push('multi_stakeholder_active');
    urgency_score += 15;
  }
  
  // Stalled at verbal commit
  if (deal.stage === 'Verbal Commit' && deal.days_in_stage >= 5) {
    triggers.push('stalled_commit');
    urgency_score += 20;
  }
  
  // Velocity keywords in notes/transcript
  const velocityKeywords = ['asap', 'urgent', 'this month', 'this quarter', 'before q1', 
                           'budget deadline', 'need by', 'must have by', 'end of year'];
  const notesLower = (deal.notes || '').toLowerCase();
  if (velocityKeywords.some(k => notesLower.includes(k))) {
    triggers.push('urgency_keywords');
    urgency_score += 15;
  }
  
  return {
    isTier2: triggers.length > 0,
    trigger: triggers[0], // Primary trigger for display
    urgency_score
  };
}
```

### Sorting Within Tier 2

```typescript
function sortTier2(items: Tier2Item[]): Tier2Item[] {
  return items.sort((a, b) => {
    // Primary: urgency score
    if (b.urgency_score !== a.urgency_score) {
      return b.urgency_score - a.urgency_score;
    }
    // Secondary: deal value
    return (b.deal?.value || 0) - (a.deal?.value || 0);
  });
}
```

### UI for Tier 2

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🟠 DON'T LOSE THIS                                          3 items    │
│    Deadlines, competition, or decisions in motion.                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📞 Follow up on TechCorp proposal                                    │
│   TechCorp · Platform Deal · $125K · Negotiation                       │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ 🔥 They're also evaluating Gong. Sarah viewed your proposal   │    │
│   │    4x yesterday. Decision expected this week.                 │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📞 Call Sarah]  [📧 Email]  [More ▼]                                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📧 Re-engage Mike at Acme                                            │
│   Acme Corp · Enterprise Deal · $200K · Proposal                       │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ ⚠️ Your champion went dark. 2 emails, no reply in 12 days.   │    │
│   │    This deal is at risk.                                      │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📞 Call Mike]  [📧 Try Different Angle]  [More ▼]                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TIER 3: KEEP YOUR WORD 🟡

### Definition
You made a commitment. Failing to deliver damages trust — the foundation of sales relationships.

### What Triggers Tier 3

| Trigger | Detection Method |
|---------|------------------|
| **"I'll send that by..."** | AI extraction from transcript |
| **"Let me get you a quote"** | AI extraction from transcript |
| **"I'll follow up tomorrow"** | AI extraction from transcript |
| **Meeting follow-up** | Calendar event ended 24+ hours ago, no follow-up email sent |
| **"By end of week"** | AI extraction with date inference |

### Detection Logic

```typescript
function isTier3(item: ActionItem): { isTier3: boolean; promise_date: Date; source: string } {
  
  // Transcript-extracted commitments
  if (item.source === 'transcript' && item.type === 'commitment') {
    return {
      isTier3: true,
      promise_date: item.due_at || item.extracted_deadline,
      source: 'transcript'
    };
  }
  
  // Sent email with commitment language
  if (item.source === 'sent_email') {
    const commitmentPatterns = [
      { pattern: /i'll send (?:that|this|it) (?:by |on |)(\w+)/i, type: 'send' },
      { pattern: /let me get you (?:a |)(\w+)/i, type: 'deliver' },
      { pattern: /i'll follow up (?:by |on |)(\w+)/i, type: 'follow_up' },
      { pattern: /by (?:end of |)(\w+)/i, type: 'deadline' },
      { pattern: /i will (\w+)/i, type: 'promise' }
    ];
    
    for (const { pattern } of commitmentPatterns) {
      if (pattern.test(item.content)) {
        return {
          isTier3: true,
          promise_date: inferDateFromText(item.content, item.sent_at),
          source: 'email'
        };
      }
    }
  }
  
  // Meeting follow-up (meeting ended, no follow-up sent)
  if (item.source === 'calendar' && item.type === 'meeting_ended') {
    const hoursSinceMeeting = getHoursSince(item.meeting_end_time);
    const followUpSent = await checkFollowUpSent(item.meeting_id, item.attendees);
    
    if (hoursSinceMeeting >= 4 && !followUpSent) {
      return {
        isTier3: true,
        promise_date: addHours(item.meeting_end_time, 24), // Implicit 24hr expectation
        source: 'meeting_follow_up'
      };
    }
  }
  
  return { isTier3: false, promise_date: null, source: null };
}
```

### Sorting Within Tier 3

```typescript
function sortTier3(items: Tier3Item[]): Tier3Item[] {
  return items.sort((a, b) => {
    // Most overdue first
    const aOverdue = getHoursSince(a.promise_date);
    const bOverdue = getHoursSince(b.promise_date);
    
    if (aOverdue > 0 && bOverdue > 0) {
      return bOverdue - aOverdue; // Most overdue first
    }
    if (aOverdue > 0) return -1;
    if (bOverdue > 0) return 1;
    
    // Then by promise date (soonest first)
    return new Date(a.promise_date).getTime() - new Date(b.promise_date).getTime();
  });
}
```

### UI for Tier 3

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🟡 KEEP YOUR WORD                                           4 items    │
│    You promised these. Your credibility is on the line.                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📄 Send pricing to Native Pest                                       │
│   Native Pest · AI Platform Deal · $45K                                │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ ⏰ You said "I'll send pricing by Friday" on your Dec 15 call.│    │
│   │    That was 5 days ago.                                       │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📧 Send Pricing]  [📅 Schedule Call Instead]                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ 📧 Meeting follow-up: Lawn Doctor call                               │
│   Lawn Doctor of Indiana · Onboarding · $35K                           │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ ⏰ Your call ended 28 hours ago. They expect a follow-up.     │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📧 Send Follow-up]  [View Call Notes]                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TIER 4: MOVE BIG DEALS 🟢

### Definition
High-value or strategic deals that deserve proactive attention even without external urgency.

### What Triggers Tier 4

| Trigger | Detection Method |
|---------|------------------|
| **Large deal value** | Top 20% of pipeline by ACV |
| **Strategic account** | Tagged as strategic OR logo value |
| **Influential buyer** | Contact is C-suite or known influencer |
| **Deal going stale** | No activity in 10+ days on active deal |
| **Multi-threaded opportunity** | 3+ stakeholders identified |

### Detection Logic

```typescript
function isTier4(item: ActionItem): { isTier4: boolean; value_score: number } {
  const deal = item.deal;
  
  if (!deal || deal.status !== 'active') {
    return { isTier4: false, value_score: 0 };
  }
  
  // Already in higher tier? Skip
  if (isTier1(item).isTier1 || isTier2(item).isTier2 || isTier3(item).isTier3) {
    return { isTier4: false, value_score: 0 };
  }
  
  let value_score = 0;
  
  // Large deal (top 20% of pipeline)
  const pipelinePercentile = await getDealValuePercentile(deal.value);
  if (pipelinePercentile >= 80) {
    value_score += 30;
  } else if (pipelinePercentile >= 60) {
    value_score += 15;
  }
  
  // Strategic account
  if (deal.company?.is_strategic || deal.company?.logo_value) {
    value_score += 20;
  }
  
  // C-suite contact
  const hasCsuite = deal.contacts?.some(c => 
    ['ceo', 'cfo', 'cto', 'coo', 'vp', 'svp', 'evp', 'chief'].some(title => 
      c.title?.toLowerCase().includes(title)
    )
  );
  if (hasCsuite) {
    value_score += 15;
  }
  
  // Deal going stale
  if (deal.days_since_last_activity >= 10) {
    value_score += 10;
  }
  
  // Multi-threaded
  if ((deal.contacts?.length || 0) >= 3) {
    value_score += 10;
  }
  
  return {
    isTier4: value_score >= 15,
    value_score
  };
}
```

### Sorting Within Tier 4

```typescript
function sortTier4(items: Tier4Item[]): Tier4Item[] {
  return items.sort((a, b) => {
    // Primary: value score
    if (b.value_score !== a.value_score) {
      return b.value_score - a.value_score;
    }
    // Secondary: deal value
    return (b.deal?.value || 0) - (a.deal?.value || 0);
  });
}
```

---

## TIER 5: BUILD PIPELINE 🔵

### Definition
Important work that builds future revenue, but has no immediate clock expiring.

### What Goes Here
- New outreach / prospecting
- Nurture touches (stay top of mind)
- Research / prep for future meetings
- CRM hygiene
- Internal tasks

### Rule
**This tier is only visible when Tiers 1-4 are empty or near-empty.**

Show message: "Pipeline work available when urgent items are handled."

---

## "Why Now" Generation

The "Why Now" must reference the specific clock that's expiring.

### Generation Rules by Tier

```typescript
function generateWhyNow(item: ActionItem, tier: number, trigger: string): string {
  
  // TIER 1: Show time waiting + what they asked
  if (tier === 1) {
    const waitTime = formatDuration(getMinutesSinceReceived(item));
    const slaStatus = getSlaStatus(item);
    
    if (trigger === 'demo_request') {
      return `They asked for a demo ${waitTime} ago. ${slaStatus}`;
    }
    if (trigger === 'pricing_request') {
      return `They asked about pricing ${waitTime} ago. First good response often wins.`;
    }
    if (trigger === 'email_reply') {
      return `They replied ${waitTime} ago. Conversation is live — keep momentum.`;
    }
    if (trigger === 'direct_question') {
      const question = extractQuestion(item.content);
      return `They asked: "${question}" — ${waitTime} waiting.`;
    }
  }
  
  // TIER 2: Show the specific risk
  if (tier === 2) {
    if (trigger === 'competitive_risk') {
      const competitor = item.deal?.competitors?.[0];
      return `They're evaluating ${competitor}. Decision expected soon.`;
    }
    if (trigger === 'deadline_critical') {
      const daysLeft = getDaysUntil(item.deal.close_date);
      return `Close date is ${formatDate(item.deal.close_date)} — ${daysLeft} days left.`;
    }
    if (trigger === 'champion_dark') {
      const champion = getChampion(item.deal);
      return `${champion.name} hasn't replied to your last 2 emails. Your inside access is at risk.`;
    }
    if (trigger === 'proposal_hot') {
      const views = item.engagement.proposal_views_last_48h;
      return `They viewed your proposal ${views}x in the last 48 hours. They're deciding.`;
    }
  }
  
  // TIER 3: Show the promise and how overdue
  if (tier === 3) {
    const promiseDate = formatDate(item.promise_date);
    const overdue = getOverdueText(item.promise_date);
    
    if (trigger === 'transcript') {
      return `You said "${item.commitment_text}" on ${promiseDate}. ${overdue}`;
    }
    if (trigger === 'meeting_follow_up') {
      const hoursSince = getHoursSince(item.meeting_end_time);
      return `Your call ended ${hoursSince} hours ago. They expect a follow-up.`;
    }
  }
  
  // TIER 4: Show value + staleness
  if (tier === 4) {
    const value = formatCurrency(item.deal?.value);
    const daysSilent = item.deal?.days_since_last_activity;
    
    if (daysSilent >= 10) {
      return `${value} deal with no activity in ${daysSilent} days. Re-engage before it dies.`;
    }
    return `${value} opportunity. Worth proactive attention.`;
  }
  
  return null; // No generic fluff
}
```

### Examples of Good vs Bad "Why Now"

| ❌ Bad (Generic AI Fluff) | ✅ Good (Specific, Clock-Based) |
|---------------------------|----------------------------------|
| "Voice builds trust faster than email" | "They asked for a demo 12 minutes ago. SLA is 15 min." |
| "Setting up the trial can help get a foot in the door" | "Sarah viewed your proposal 4x yesterday. She's deciding." |
| "This deal shows high intent" | "You said 'I'll send pricing by Friday' — that was 5 days ago." |
| "Following up could move the deal forward" | "They're also evaluating Gong. Decision this week." |
| "Timely response improves close rates" | "Mike hasn't replied to 2 emails in 12 days. Your champion is dark." |

**RULE: If we can't generate a specific, clock-based "Why Now", don't show one at all.**

---

## Data Sources Required

| Data Needed | Source | Priority |
|-------------|--------|----------|
| Inbound emails + direction | Microsoft Graph | Critical |
| Email content for keyword matching | Microsoft Graph | Critical |
| Meeting transcripts | Fireflies | Critical |
| Commitment extraction | AI on transcripts | Critical |
| Deal close date | Deals table | High |
| Competitor mentions | AI extraction from transcripts | High |
| Proposal view tracking | Future: tracking pixel or DocSend | Medium |
| Contact engagement history | Email logs | Medium |
| Deal value | Deals table | High |
| Contact roles | Contacts table | Medium |

---

## Database Schema

```sql
-- Items table extensions
ALTER TABLE command_center_items
ADD COLUMN tier INTEGER NOT NULL DEFAULT 5,
ADD COLUMN tier_trigger VARCHAR(50),
ADD COLUMN sla_minutes INTEGER,
ADD COLUMN sla_status VARCHAR(20) DEFAULT 'on_track', -- on_track, warning, breached
ADD COLUMN urgency_score INTEGER DEFAULT 0,
ADD COLUMN value_score INTEGER DEFAULT 0,
ADD COLUMN promise_date TIMESTAMPTZ,
ADD COLUMN commitment_text TEXT,
ADD COLUMN why_now TEXT,
ADD COLUMN time_waiting_minutes INTEGER;

-- Deals table extensions  
ALTER TABLE deals
ADD COLUMN competitors TEXT[],
ADD COLUMN competitive_risk BOOLEAN DEFAULT FALSE,
ADD COLUMN days_since_last_activity INTEGER,
ADD COLUMN is_strategic BOOLEAN DEFAULT FALSE;

-- Contacts table extensions
ALTER TABLE contacts
ADD COLUMN role VARCHAR(50), -- champion, decision_maker, influencer, blocker
ADD COLUMN emails_without_reply INTEGER DEFAULT 0,
ADD COLUMN days_since_last_reply INTEGER;
```

---

## Cron Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Classify items into tiers | Every 5 minutes | Assign tier, trigger, scores |
| Update SLA status | Every 1 minute | Mark warnings/breaches |
| Extract commitments from transcripts | On transcript received | Create Tier 3 items |
| Detect competitive mentions | On transcript received | Flag deals, create Tier 2 items |
| Calculate days since activity | Every hour | Update staleness for Tier 4 |
| Check for meeting follow-ups | Every 30 minutes | Create Tier 3 items for missed follow-ups |

---

## Testing: How to Know It's Right

Before shipping, validate against real sales behavior:

1. **Get a rep's last 10 working days of actual activity**
2. **Ask them: "What SHOULD you have done first each day?"**
3. **Run the prioritization logic on the same data**
4. **Compare lists**

If they look at the Command Center and say:
> "Yeah... that's exactly what I should've done"

You're there.

If they say:
> "Why is this above that?"

You're not.

### Specific Test Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Demo request comes in at 9:00 AM | Immediately Tier 1, top of list, 15-min SLA |
| Rep has 3 stale $100K deals | Tier 4, visible but below any active Tier 1-3 |
| Transcript shows "I'll send pricing tomorrow" | Tier 3 item created with promise date |
| Competitor mentioned in call | Deal flagged, related items boost to Tier 2 |
| Email reply at 2 PM, rep doesn't respond by 6 PM | SLA warning at 4h, breach highlighted |
| All Tier 1 empty | Other tiers fully visible, no collapse |

---

## Summary: The 5 Rules

1. **TIER 1 IS SACRED** — If someone is waiting, nothing else matters.

2. **CLOCKS, NOT SCORES** — Show which clock is expiring, not abstract numbers.

3. **SPECIFIC, NOT GENERIC** — "Why now" must reference real data or don't show it.

4. **ITEMS DON'T PROMOTE** — Old Tier 4 items don't become Tier 1 just from age.

5. **TEST AGAINST REALITY** — If reps disagree with the ranking, the system is wrong.
