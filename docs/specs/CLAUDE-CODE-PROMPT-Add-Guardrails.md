# Add Permanent Guardrails to Codebase

## Problem

Claude Code keeps adding keyword-based detection despite clear architectural rules. 
Documentation alone isn't preventing this. We need **code-level guardrails**.

## Solution: Add Guardrails Directly in Code

### 1. Add Header Comment to tierDetection.ts

```typescript
/**
 * TIER DETECTION - ARCHITECTURAL RULES
 * =====================================
 * 
 * 🚫 NEVER use keyword matching in this file.
 * 🚫 NEVER scan text for words like 'trial', 'demo', 'urgent'.
 * 🚫 NEVER hardcode tier assignments based on source type.
 * 
 * ✅ Tier MUST come from: AI Analysis → communicationType → Sales Playbook
 * ✅ Use: SALES_PLAYBOOK.communication_types[communicationType].tier
 * ✅ If analysis is missing, default to Tier 4 (not keyword scan)
 * 
 * WHY: X-FORCE is AI-first. Keywords are dumb. AI understands context.
 * "I'm NOT interested in a trial" contains 'trial' but means the opposite.
 * 
 * If you're tempted to add keywords, STOP. Fix the AI pipeline instead.
 */
```

### 2. Add Runtime Check Against Keywords

Add this function that throws an error if keywords are detected:

```typescript
// Add to tierDetection.ts

const FORBIDDEN_PATTERNS = [
  /keywords?\s*=\s*\[/i,
  /\.includes\s*\(\s*['"][^'"]*trial/i,
  /\.includes\s*\(\s*['"][^'"]*demo/i,
  /\.match\s*\(/i,
];

// This is a compile-time/test-time check
// Add to your test suite:
export function validateNoKeywordMatching() {
  const fs = require('fs');
  const content = fs.readFileSync(__filename, 'utf8');
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(
        `ARCHITECTURAL VIOLATION: Keyword matching detected in tierDetection.ts. ` +
        `This is forbidden. Use AI analysis + Sales Playbook instead.`
      );
    }
  }
}
```

### 3. Add Type That Forces Playbook Usage

```typescript
// In types.ts or tierDetection.ts

import { SALES_PLAYBOOK } from '@/lib/intelligence/salesPlaybook';

// Type that only allows valid communication types from playbook
type ValidCommunicationType = keyof typeof SALES_PLAYBOOK.communication_types;

// Function signature that enforces playbook usage
function getTierFromPlaybook(communicationType: ValidCommunicationType): number {
  return SALES_PLAYBOOK.communication_types[communicationType].tier;
}

// This makes it impossible to pass arbitrary strings
// Must be a valid playbook communication type
```

### 4. Add ESLint Rule (if using ESLint)

```javascript
// .eslintrc.js - add custom rule
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'VariableDeclarator[id.name=/keyword/i]',
        message: 'Keyword arrays are forbidden. Use AI analysis + Sales Playbook.'
      },
      {
        selector: 'CallExpression[callee.property.name="includes"][arguments.0.value=/trial|demo|pricing|urgent/i]',
        message: 'Keyword matching is forbidden. Use AI analysis + Sales Playbook.'
      }
    ]
  }
};
```

### 5. Add Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for keyword patterns in intelligence code
if grep -r "keywords\s*=" src/lib/commandCenter src/lib/intelligence --include="*.ts"; then
  echo "❌ COMMIT BLOCKED: Keyword arrays detected in intelligence code."
  echo "This violates X-FORCE architectural rules."
  echo "Use AI analysis + Sales Playbook instead."
  exit 1
fi

if grep -rE "\.includes\(['\"].*trial|\.includes\(['\"].*demo" src/lib/commandCenter src/lib/intelligence --include="*.ts"; then
  echo "❌ COMMIT BLOCKED: Keyword matching detected in intelligence code."
  echo "This violates X-FORCE architectural rules."
  echo "Use AI analysis + Sales Playbook instead."
  exit 1
fi
```

### 6. Add Test That Fails on Keywords

```typescript
// __tests__/architectural-rules.test.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

describe('Architectural Rules', () => {
  it('should not have keyword arrays in intelligence code', async () => {
    const files = await glob('src/lib/{intelligence,commandCenter}/**/*.ts');
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for keyword arrays
      expect(content).not.toMatch(/const\s+\w*keywords?\w*\s*=/i);
      
      // Check for keyword-based includes
      expect(content).not.toMatch(/\.includes\s*\(\s*['"].*(?:trial|demo|pricing|urgent)/i);
    }
  });
  
  it('should derive tier from Sales Playbook', async () => {
    const tierDetection = fs.readFileSync(
      'src/lib/commandCenter/tierDetection.ts', 
      'utf8'
    );
    
    // Must import playbook
    expect(tierDetection).toMatch(/import.*SALES_PLAYBOOK/);
    
    // Must use playbook for tier
    expect(tierDetection).toMatch(/SALES_PLAYBOOK\.communication_types/);
  });
});
```

## Implementation Order

1. **First:** Add the header comment to tierDetection.ts (immediate)
2. **Second:** Add the architectural test (catches future violations)
3. **Third:** Add pre-commit hook (blocks commits with violations)
4. **Optional:** Add ESLint rule (IDE-level warnings)

## Prompt for Claude Code

```
Add permanent guardrails to prevent keyword-based tier detection.

1. Add this header comment to src/lib/commandCenter/tierDetection.ts:
   [paste the header comment from above]

2. Create __tests__/architectural-rules.test.ts with tests that:
   - Fail if keyword arrays exist in intelligence/commandCenter code
   - Verify tierDetection imports and uses SALES_PLAYBOOK

3. Add a pre-commit hook in .git/hooks/pre-commit that blocks
   commits containing keyword patterns in intelligence code.

4. While you're there, REMOVE any existing keyword matching and
   ensure tier detection uses SALES_PLAYBOOK.communication_types[].tier

This is a permanent fix to prevent architectural violations.
```
