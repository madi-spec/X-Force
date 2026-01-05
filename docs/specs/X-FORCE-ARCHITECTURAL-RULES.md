# X-FORCE ARCHITECTURAL RULES — NEVER VIOLATE

**This document MUST be read at the start of EVERY Claude Code session.**
**These rules are NON-NEGOTIABLE.**

---

## 🚫 ABSOLUTE PROHIBITIONS

### 1. NEVER USE KEYWORD MATCHING FOR INTELLIGENCE

```typescript
// ❌ FORBIDDEN — NEVER DO THIS:
const keywords = ['trial', 'demo', 'pricing', 'urgent'];
if (text.toLowerCase().includes(keyword)) { ... }

// ❌ FORBIDDEN — NEVER DO THIS:
if (subject.match(/trial|demo|pricing/i)) { ... }

// ❌ FORBIDDEN — NEVER DO THIS:
const tier1Keywords = ['immediately', 'asap', 'urgent'];
```

**WHY:** Keywords are dumb. They don't understand context. "I'm NOT interested in a trial" contains "trial" but means the opposite.

### 2. ALL INTELLIGENCE COMES FROM AI ANALYSIS

```typescript
// ✅ CORRECT — ALWAYS DO THIS:
// AI analyzes and returns command_center_classification
const analysis = await analyzeEmail(email);
const { tier, tier_trigger, sla_minutes, why_now } = analysis.command_center_classification;

// ✅ CORRECT — If classifying existing items:
const tierInfo = COMMUNICATION_TYPE_TIERS[item.tier_trigger];
const tier = tierInfo?.tier ?? 4;

// ✅ CORRECT — AI determines meaning:
// AI reads: "Can you send me pricing for 50 seats?"
// AI returns: { tier_trigger: 'pricing_request', tier: 1 }
// COMMUNICATION_TYPE_TIERS confirms: pricing_request → Tier 1
```

### 3. COMMUNICATION_TYPE_TIERS IS THE SINGLE SOURCE OF TRUTH FOR TIERS

```typescript
// Tier assignments ONLY come from COMMUNICATION_TYPE_TIERS in tierDetection.ts
// NEVER hardcode tier logic anywhere else

// ❌ WRONG:
if (source === 'email_inbound') return { tier: 1 };

// ✅ RIGHT:
const tierInfo = COMMUNICATION_TYPE_TIERS[item.tier_trigger];
return tierInfo?.tier ?? 4;
```

---

## 📐 THE CORRECT ARCHITECTURE (As Implemented)

```
Communication Arrives (Email/Call/Transcript)
         ↓
    processInboundEmail() or processIncomingCommunication()
         ↓
    AI Analyzes with Full Context
         ↓
    Returns: command_center_classification: {
      tier: 1,
      tier_trigger: 'demo_request',  // AI determined this
      sla_minutes: 15,
      why_now: 'Prospect requested a demo...'
    }
         ↓
    Command Center Item created with tier_trigger
         ↓
    classifyItem() uses COMMUNICATION_TYPE_TIERS mapping:
      COMMUNICATION_TYPE_TIERS['demo_request'].tier → 1
```

**Key Files:**
- `src/lib/commandCenter/tierDetection.ts` — COMMUNICATION_TYPE_TIERS mapping
- `src/lib/email/processInboundEmail.ts` — Uses AI's command_center_classification
- `src/lib/pipelines/index.ts` — runAllPipelines() uses processUnanalyzedEmails

**The tier NEVER comes from:** Keyword scanning, source type checks, or hardcoded rules

---

## 🔒 HOW TO VERIFY YOU'RE NOT VIOLATING THESE RULES

Before committing any code, check:

```bash
# This should return NOTHING in intelligence/commandCenter code:
grep -r "keywords\|\.includes\|\.match.*trial\|\.match.*demo" src/lib/intelligence src/lib/commandCenter --include="*.ts"
```

If the grep returns results, YOU ARE VIOLATING THE ARCHITECTURE.

**Verify correct implementation:**
```bash
# tierDetection.ts should import COMMUNICATION_TYPE_TIERS (not keywords)
grep "COMMUNICATION_TYPE_TIERS" src/lib/commandCenter/tierDetection.ts

# processInboundEmail.ts should use command_center_classification from AI
grep "command_center_classification" src/lib/email/processInboundEmail.ts
```

---

## 📋 WHEN FIXING BUGS, FOLLOW THIS CHECKLIST

- [ ] Did I add any keyword arrays? **If yes, DELETE THEM**
- [ ] Did I add any `.includes()` or `.match()` for classification? **If yes, DELETE THEM**
- [ ] Am I determining tier from AI analysis + playbook? **If no, FIX IT**
- [ ] Did I hardcode any tier assignments? **If yes, MOVE TO PLAYBOOK**

---

## 🚨 IF SOMETHING ISN'T WORKING

**WRONG response:** "I'll add keyword detection as a fallback"

**RIGHT response:** 
1. Find where AI analysis is failing or not being called
2. Fix the pipeline so AI analysis runs
3. Ensure communicationType is stored on the item
4. Ensure playbook lookup is working

**The fix is NEVER "add keywords." The fix is "make AI analysis work."**

---

## 💡 WHY THIS MATTERS

X-FORCE is an **AI-FIRST CRM**. The entire value proposition is that AI understands relationships and communications at a deep level. 

Keyword matching is what cheap, dumb software does. It's the opposite of our product.

Every time keyword matching is added:
- It undermines the product's core value
- It creates false positives and negatives
- It makes the system brittle
- It's technical debt that has to be removed

---

## 📎 COPY THIS INTO EVERY CLAUDE CODE SESSION

```
CRITICAL ARCHITECTURAL RULE:
NEVER use keyword matching for tier detection, classification, or any intelligence.
ALL intelligence comes from AI analysis → communicationType → Sales Playbook lookup.
If something isn't working, fix the AI pipeline, don't add keywords.
Read /docs/specs/X-FORCE-ARCHITECTURAL-RULES.md before making any changes.
```

---

## Files Where This Applies

- `src/lib/commandCenter/tierDetection.ts` — NO KEYWORDS, uses COMMUNICATION_TYPE_TIERS
- `src/lib/email/processInboundEmail.ts` — Uses AI's command_center_classification
- `src/lib/pipelines/index.ts` — Uses processUnanalyzedEmails (AI-based)
- `src/lib/intelligence/*.ts` — NO KEYWORDS  
- `src/lib/ai/*.ts` — NO KEYWORDS
- Any file doing classification — NO KEYWORDS

**Deprecated (do not use):**
- `src/lib/pipelines/detectInboundEmails.ts` — OLD keyword-based, kept for backwards compat only

The ONLY place keywords are acceptable is in user-facing search (e.g., searching emails by keyword).
