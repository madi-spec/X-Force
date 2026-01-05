# Meetings Page Redesign - Starter Prompt for Claude Code

## Initial Prompt

Copy and paste this into Claude Code to begin the implementation:

---

I need you to build a comprehensive Meetings page redesign for my Next.js CRM application. This will be a multi-phase implementation. I have detailed specification files for each phase.

**Project Context:**
- Next.js 14+ with App Router
- Supabase for database
- Tailwind CSS for styling
- TypeScript throughout
- The app already has authentication, organizations, customers, and users set up

**What we're building:**
A unified Meetings hub that combines:
1. Upcoming meetings with AI-powered prep
2. Past meetings with transcript analysis
3. Inline editable action items
4. Customer assignment for meetings
5. Ability to exclude irrelevant meetings
6. Transcript processing queue

**Implementation Approach:**
You will work through 9 phases. For each phase:
1. Read the phase file completely
2. Implement all required code
3. Run the specified tests
4. Verify everything works
5. Only then proceed to the next phase

**Phase Files Location:**
All phase files are in the `meetings-specs/` directory:
- `phase-1-database.md` - Database schema and migrations
- `phase-2-api.md` - Server actions and API routes  
- `phase-3-components.md` - Base UI components
- `phase-4-meeting-cards.md` - Meeting prep and past meeting cards
- `phase-5-action-items.md` - Inline editing for action items
- `phase-6-customer.md` - Customer assignment dropdown
- `phase-7-exclude.md` - Exclude meeting functionality
- `phase-8-queue.md` - Processing queue section
- `phase-9-integration.md` - Final integration and testing

**Start now by:**
1. Reading the main `SPECIFICATION.md` file for full context
2. Then reading and implementing `phase-1-database.md`
3. After phase 1 tests pass, continue to phase 2
4. Continue sequentially through all phases

Do not ask for confirmation between phases - proceed automatically once tests pass. If you encounter an error, fix it before moving on.

Begin by reading the specification file, then start phase 1.

---

## Expected Behavior

Claude Code will:
1. Read SPECIFICATION.md to understand the full scope
2. Work through each phase file sequentially
3. Create all necessary files
4. Run tests after each phase
5. Self-correct if tests fail
6. Move to next phase only when current phase passes
7. Complete all 9 phases without intervention

## Troubleshooting

If Claude Code stops or asks questions:
- Respond with "Continue with the next phase" or "Fix the error and continue"
- The phase files are designed to be self-contained with all needed context

## Estimated Time

- Phase 1 (Database): ~5 minutes
- Phase 2 (API): ~10 minutes
- Phase 3 (Components): ~10 minutes
- Phase 4 (Meeting Cards): ~15 minutes
- Phase 5 (Action Items): ~15 minutes
- Phase 6 (Customer): ~10 minutes
- Phase 7 (Exclude): ~5 minutes
- Phase 8 (Queue): ~10 minutes
- Phase 9 (Integration): ~10 minutes

**Total: ~90 minutes**
