# Documentation Audit Guardrails

> These guardrails specifically prevent the problematic AI behaviors
> that lead to unreliable documentation.

---

## Problem Behavior #1: Getting Lazy

### How It Manifests
- Summarizing instead of reading actual files
- Saying "similar pattern in other files" without documenting each one
- Skipping "obvious" things like CRUD operations
- Grouping multiple files into one description
- Using phrases like "standard implementation" without specifics

### Prevention Rules

**RULE: Every file gets its own entry.**
```markdown
# Bad
The `src/lib/supabase/` directory contains standard Supabase client helpers.

# Good  
### src/lib/supabase/client.ts
Lines: 1-35
Exports: createClient (line 8), createServerClient (line 20)
Dependencies: @supabase/supabase-js (line 1)
Env vars used: NEXT_PUBLIC_SUPABASE_URL (line 10), NEXT_PUBLIC_SUPABASE_ANON_KEY (line 11)
```

**RULE: Every function gets parameters and return type documented.**
```markdown
# Bad
`processEmail` - Processes incoming emails

# Good
`processEmail(email: RawEmail, options?: ProcessOptions): Promise<ProcessResult>`
- email: RawEmail - The raw email object from Microsoft Graph (defined at types/email.ts:15)
- options.skipAnalysis: boolean - If true, skip AI analysis (default: false)
- Returns ProcessResult with company, contact, and actions created
- Throws EmailProcessingError if email is malformed
```

**RULE: No file grouping.**
If there are 17 files in a directory, there must be 17 documented entries.
Not "17 files including helpers and utilities."

### Self-Check Questions
Before moving to the next file/section, ask:
- Did I actually read this file?
- Did I document every export?
- Did I include line numbers?
- Could someone understand this file without reading the source?

---

## Problem Behavior #2: Making Things Up (Hallucination)

### How It Manifests
- Describing functions that don't exist
- Inventing parameter names or types
- Assuming what code does based on function name
- Citing line numbers that don't contain what's claimed
- Adding features that "should" be there

### Prevention Rules

**RULE: No claim without citation.**
```markdown
# Bad
The entityMatcher uses fuzzy string matching to find companies.

# Good
The entityMatcher uses AI-based matching (line 45-80). There is no fuzzy string
matching in this file - that was in the deprecated autoLinkEntities.ts.
```

**RULE: Read before documenting.**
The sequence must always be:
1. Open the file
2. Read the relevant lines
3. Document what you see
4. Move to next file

Never: "Based on the file name, this probably does X"

**RULE: When uncertain, say so.**
```markdown
# Bad
This function validates the email headers.

# Good
[UNCERTAIN] Lines 45-60 appear to check email headers, but the validation
logic references `legacyValidator` which is not imported. May be dead code
or missing import.
```

**RULE: Verify citations exist.**
Before writing `line 45`, confirm:
- The file has at least 45 lines
- Line 45 contains what you're describing
- The line number won't be outdated

### Self-Check Questions
Before making any claim, ask:
- Did I see this in the actual file?
- Can I point to the exact line?
- Am I inferring or actually reading?

---

## Problem Behavior #3: Randomly Deciding to "Fix" Things

### How It Manifests
- "While documenting, I noticed X could be improved..."
- "I've refactored this function for clarity..."
- "This code had a bug, so I fixed it..."
- "The naming was inconsistent, so I standardized it..."
- Opening files in edit mode instead of read mode

### Prevention Rules

**RULE: Documentation is READ-ONLY.**
```
ALLOWED:
- view tool on any file
- Creating files in /docs/generated/

FORBIDDEN:
- str_replace on any source file
- create_file outside /docs/generated/
- Any bash command that modifies files
```

**RULE: Report, don't fix.**
```markdown
# Bad
[While documenting] The function name `processStuff` was unclear so I
renamed it to `processIncomingEmail`.

# Good
[NEEDS REVIEW] Function `processStuff` at line 45 has an unclear name.
Consider renaming to reflect its purpose (processes incoming emails).
Documented as-is.
```

**RULE: Issues go in a separate section.**
Create a "Findings" section in each doc for things that need attention.
Do NOT attempt to resolve them during documentation.

```markdown
## Documentation Findings

### Potential Issues Found

1. **Dead Code** - `src/lib/legacy/oldProcessor.ts` appears unused
   - No imports found in codebase
   - Recommend: Verify and delete if confirmed dead

2. **Inconsistent Naming** - `company_id` vs `companyId`
   - Database uses snake_case
   - Some TypeScript uses camelCase
   - Recommend: Pick convention and migrate

3. **Missing Error Handling** - `src/lib/api/client.ts:80`
   - fetch() has no catch block
   - Recommend: Add error handling

[These are OBSERVATIONS only. No changes were made.]
```

### Self-Check Questions
Before any action, ask:
- Am I about to modify a source file?
- Is my next action documentation or "improvement"?
- Would this change require user approval?

---

## Problem Behavior #4: Inconsistent Output

### How It Manifests
- Different format for similar items
- Some files have line numbers, others don't
- Some functions have parameters documented, others don't
- Different section ordering between runs
- Missing sections that were in previous audits

### Prevention Rules

**RULE: Use templates exactly.**
Every document type has a template in TEMPLATES.md.
Follow it exactly. Don't improvise formatting.

**RULE: Complete each section before moving on.**
```
# Bad workflow
1. Document file A exports
2. Document file B exports  
3. Go back and add file A dependencies
4. Document file C
5. Go back and add file B dependencies

# Good workflow
1. Document file A completely (exports, deps, db usage, all sections)
2. Document file B completely
3. Document file C completely
```

**RULE: Use consistent terminology.**
Pick terms and stick to them:
- "Lines" not sometimes "line" and sometimes "L"
- "Returns" not sometimes "returns" and sometimes "Return value"
- "🟢 ACTIVE" not sometimes "Active" and sometimes "ACTIVE"

### Self-Check Questions
Before finishing a section, ask:
- Does this match the template exactly?
- Does this have the same level of detail as previous entries?
- Are my terms consistent with the rest of the document?

---

## Problem Behavior #5: Stopping Early

### How It Manifests
- "I've documented the main files, the rest are similar"
- "Due to length constraints, I'll summarize the remaining..."
- "The pattern repeats for the other N files"
- Finishing Phase 1-3 thoroughly but rushing Phase 4-7

### Prevention Rules

**RULE: Explicit completion tracking.**
At the start of each phase, count items to document.
At the end, verify count matches.

```markdown
Phase 4: Library Modules
Starting: 17 files in src/lib/intelligence/

Completed:
- [x] contextFirstPipeline.ts
- [x] entityMatcher.ts
- [x] salesPlaybook.ts
...
- [x] updateRelationshipFromAnalysis.ts

Finished: 17/17 files documented
```

**RULE: No "etc." or "..."**
```markdown
# Bad
Exports: createClient, createServerClient, ...

# Good
Exports: createClient (line 8), createServerClient (line 20), 
createBrowserClient (line 35), isServer (line 42)
```

**RULE: Checkpoint after every major section.**
Don't batch phases together. Stop after each phase.
This prevents fatigue-driven shortcuts.

### Self-Check Questions
Before marking complete, ask:
- Did I document every item I counted at the start?
- Did I use "etc.", "...", or "similar" anywhere?
- Am I as thorough here as I was at the beginning?

---

## Enforcement Mechanism

### At Start of Audit
Claude must state:
"I will be operating in READ-ONLY documentation mode. I will not modify any source files.
I will document every file completely. I will cite line numbers for all claims.
Any issues found will be reported, not fixed."

### At Each Checkpoint
Claude must report:
- Files documented vs files counted
- Any `[UNCERTAIN]` or `[NEEDS REVIEW]` tags added
- Confirmation no source files were modified

### At End of Audit
Claude must run verification checklist and report:
- All file counts match
- All spot-checks passed
- No source modifications made
- All uncertainty tags documented

---

## User Recourse

If you notice guardrail violations:

1. **Stop the audit immediately**
2. **Identify the violation type:**
   - Laziness (summarizing/skipping)
   - Hallucination (made-up info)
   - Fixing (modified source)
   - Inconsistency (format varies)
   - Early stop (incomplete)
3. **Roll back any source changes** (if fixing occurred)
4. **Restart from last good checkpoint**
5. **Report to Anthropic** if behavior persists

---

## Summary Checklist

Before ANY documentation action:
- [ ] Am I reading, not editing?
- [ ] Am I citing actual line numbers?
- [ ] Am I documenting what IS, not what should be?
- [ ] Am I being thorough, not summarizing?
- [ ] Am I following the template exactly?
