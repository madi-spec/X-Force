# X-FORCE Consolidation: Dependency Map

> **Generated:** 2026-01-01

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Microsoft Graph API          Fireflies API         User Input       │
│         │                          │                     │           │
└─────────┼──────────────────────────┼─────────────────────┼───────────┘
          │                          │                     │
          ▼                          ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SYNC LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌──────────────────────┐                │
│  │ communicationHub/   │    │ fireflies/           │                │
│  │ sync/directGraph    │    │ sync.ts              │                │
│  │ Sync.ts             │    │                      │                │
│  │ [CANONICAL]         │    │ Uses: entityMatcher  │                │
│  └──────────┬──────────┘    └──────────┬───────────┘                │
│             │                          │                             │
│  ┌──────────┴──────────┐               │                             │
│  │ microsoft/          │               │                             │
│  │ emailSync.ts        │               │                             │
│  │ [DEPRECATED sync]   │               │                             │
│  │ [KEEP sendEmail]    │               │                             │
│  └─────────────────────┘               │                             │
│                                        │                             │
└────────────────────┬───────────────────┴─────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ENTITY MATCHING                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ intelligence/entityMatcher.ts [CANONICAL - 933 lines]       │    │
│  │                                                              │    │
│  │   extractRawIdentifiers()        findCandidateCompanies()   │    │
│  │   extractCompaniesFromContent()  findCandidateContacts()    │    │
│  │   matchExtractedCompanies()      callAIForMatching()        │    │
│  │                                                              │    │
│  │                 intelligentEntityMatch() ← MAIN ENTRY       │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             │ Used by:                               │
│                             │ ├── intelligence/contextFirstPipeline  │
│                             │ ├── email/processInboundEmail          │
│                             │ └── fireflies/sync                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTEXT BUILDING                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ ai/core/            │    │ commandCenter/      │                 │
│  │ contextBuilder.ts   │    │ contextEnrichment   │                 │
│  │                     │    │ .ts                 │                 │
│  │ buildDealContext()  │    │ gatherContext()     │                 │
│  │ buildCompanyContext │    │ enrichItem()        │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│           │                          │                               │
│           └──────────┬───────────────┘                               │
│                      │                                               │
│                      ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ intelligence/contextFirstPipeline.ts                         │    │
│  │                                                              │    │
│  │   buildFullRelationshipContext() ← MOST COMPREHENSIVE       │    │
│  │   analyzeWithFullContext()                                   │    │
│  │   processIncomingCommunication()                             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ANALYSIS & ACTIONS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ communicationHub/   │    │ commandCenter/      │                 │
│  │ analysis/           │    │ tierDetection.ts    │                 │
│  │ analyzeCommunication│    │ itemGenerator.ts    │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ pipelines/          │    │ autopilot/          │                 │
│  │ processTranscript   │    │ *Autopilot.ts       │                 │
│  │ Analysis.ts         │    │                     │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OUTPUT DESTINATIONS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ communications      │    │ command_center_     │                 │
│  │ (table)             │    │ items (table)       │                 │
│  │                     │    │                     │                 │
│  │ FACTS only          │    │ Actionable work     │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │ relationship_       │    │ activities          │                 │
│  │ intelligence        │    │ (table)             │                 │
│  │ (table)             │    │                     │                 │
│  │                     │    │ [LEGACY]            │                 │
│  │ OPINIONS/Analysis   │    │                     │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Import Dependency Map

### `sendEmail` Consumers (KEEP)
```
src/app/api/microsoft/send/route.ts
    └── import { sendEmail } from '@/lib/microsoft/emailSync'

src/app/api/communications/send-reply/route.ts
    └── import { sendEmail } from '@/lib/microsoft/emailSync'

src/app/api/attention-flags/[id]/send-email/route.ts
    └── import { sendEmail } from '@/lib/microsoft/emailSync'

src/app/api/scheduler/requests/[id]/send/route.ts
    └── import { sendEmail } from '@/lib/microsoft/emailSync'
```

### `intelligentEntityMatch` Consumers (CANONICAL)
```
src/lib/intelligence/contextFirstPipeline.ts
    └── import { intelligentEntityMatch } from '@/lib/intelligence/entityMatcher'

src/lib/fireflies/sync.ts
    └── (should use intelligentEntityMatch)
```

### `syncEmailsDirectToCommunications` Consumers (CANONICAL)
```
src/lib/communicationHub/index.ts
    └── export { syncEmailsDirectToCommunications } from './sync/directGraphSync'

src/app/api/cron/sync-communications/route.ts
    └── (should use this)
```

---

## Cross-Module Relationships

| Module A | Depends On | Module B |
|----------|------------|----------|
| `commandCenter/itemGenerator` | uses | `intelligence/contextFirstPipeline` |
| `intelligence/contextFirstPipeline` | uses | `intelligence/entityMatcher` |
| `email/processInboundEmail` | uses | `intelligence/contextFirstPipeline` |
| `communicationHub/sync` | uses | `microsoft/graph` |
| `fireflies/sync` | uses | `intelligence/entityMatcher` |
| `autopilot/*` | uses | `scheduler/schedulingService` |
| `scheduler/*` | uses | `microsoft/emailSync:sendEmail` |

---

## Database Table Relationships

```
microsoft_connections
    │
    ├──→ email_messages (legacy)
    │        │
    │        └──→ activities (legacy)
    │
    └──→ communications (canonical)
             │
             ├──→ command_center_items
             │        │
             │        └──→ Work Queue UI
             │
             └──→ relationship_intelligence
                      │
                      └──→ Company Detail UI
```

