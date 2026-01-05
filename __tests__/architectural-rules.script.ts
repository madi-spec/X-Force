/**
 * Architectural Rules Tests
 *
 * These tests verify that the codebase follows X-FORCE architectural rules.
 * See /docs/X-FORCE-ARCHITECTURAL-RULES.md for details.
 *
 * Run with: npx tsx __tests__/architectural-rules.test.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_PATTERNS = [
  // Keyword arrays for tier detection
  { pattern: 'tier1Keywords', description: 'Tier 1 keyword arrays' },
  { pattern: 'tier2Keywords', description: 'Tier 2 keyword arrays' },
  { pattern: 'TIER1_TRIGGERS.*keywords', description: 'TIER1_TRIGGERS with keywords property' },
  { pattern: 'TIER2_TRIGGERS.*keywords', description: 'TIER2_TRIGGERS with keywords property' },
];

const FORBIDDEN_DIRS = [
  'src/lib/commandCenter',
  'src/lib/intelligence',
  'src/lib/ai',
];

interface TestResult {
  passed: boolean;
  name: string;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ passed: true, name });
    console.log(`✅ ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ passed: false, name, error: errorMsg });
    console.log(`❌ ${name}`);
    console.log(`   ${errorMsg}`);
  }
}

function expect(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

// Test 1: No keyword arrays in intelligence/classification code
test('No forbidden keyword patterns in intelligence code', () => {
  for (const dir of FORBIDDEN_DIRS) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) continue;

    for (const pattern of FORBIDDEN_PATTERNS) {
      try {
        const result = execSync(
          `grep -r "${pattern.pattern}" "${fullPath}" --include="*.ts" 2>/dev/null || true`,
          { encoding: 'utf-8' }
        );

        if (result.trim()) {
          throw new Error(
            `Found ${pattern.description} in ${dir}:\n${result.trim()}`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Found')) {
          throw error;
        }
        // grep returned no results - this is expected
      }
    }
  }
});

// Test 2: No .includes() with classification keywords in tier detection (excluding comments)
test('No keyword .includes() in tierDetection.ts', () => {
  const tierDetectionPath = path.join(
    process.cwd(),
    'src/lib/commandCenter/tierDetection.ts'
  );

  if (!fs.existsSync(tierDetectionPath)) {
    throw new Error('tierDetection.ts not found');
  }

  const content = fs.readFileSync(tierDetectionPath, 'utf-8');

  // Remove comments from the content before checking
  // This allows examples of forbidden patterns in comments (like the header warning)
  const lines = content.split('\n');
  const codeLines = lines.filter(line => {
    const trimmed = line.trim();
    // Skip comment lines
    if (trimmed.startsWith('//')) return false;
    if (trimmed.startsWith('*')) return false;
    if (trimmed.startsWith('/*')) return false;
    return true;
  });
  const codeContent = codeLines.join('\n');

  // Check for forbidden patterns in actual code (not comments)
  // These patterns detect keyword-based tier detection which is forbidden
  const forbiddenIncludes = [
    { pattern: /\.includes\s*\(\s*['"]demo['"]/i, name: '.includes("demo")' },
    { pattern: /\.includes\s*\(\s*['"]trial['"]/i, name: '.includes("trial")' },
    { pattern: /\.includes\s*\(\s*['"]pricing['"]/i, name: '.includes("pricing")' },
    { pattern: /\.includes\s*\(\s*['"]urgent['"]/i, name: '.includes("urgent")' },
    { pattern: /\.includes\s*\(\s*['"]asap['"]/i, name: '.includes("asap")' },
    { pattern: /text\.match\s*\(/i, name: 'text.match()' },
    { pattern: /subject\.match\s*\(/i, name: 'subject.match()' },
    { pattern: /body\.match\s*\(/i, name: 'body.match()' },
    { pattern: /for\s*\(\s*const\s+keyword\s+of/i, name: 'for (const keyword of ...' },
    { pattern: /keywords\s*:\s*\[/i, name: 'keywords: [...]' },
  ];

  for (const { pattern, name } of forbiddenIncludes) {
    expect(
      !pattern.test(codeContent),
      `Found forbidden keyword detection pattern: ${name}`
    );
  }
});

// Test 3: Tier detection uses COMMUNICATION_TYPE_TIERS mapping
test('tierDetection.ts uses COMMUNICATION_TYPE_TIERS mapping', () => {
  const tierDetectionPath = path.join(
    process.cwd(),
    'src/lib/commandCenter/tierDetection.ts'
  );

  const content = fs.readFileSync(tierDetectionPath, 'utf-8');

  expect(
    content.includes('COMMUNICATION_TYPE_TIERS'),
    'tierDetection.ts must use COMMUNICATION_TYPE_TIERS mapping'
  );

  expect(
    content.includes('item.tier_trigger'),
    'tierDetection.ts must use item.tier_trigger for classification'
  );
});

// Test 4: Architectural rules header is present
test('tierDetection.ts has architectural rules header', () => {
  const tierDetectionPath = path.join(
    process.cwd(),
    'src/lib/commandCenter/tierDetection.ts'
  );

  const content = fs.readFileSync(tierDetectionPath, 'utf-8');

  expect(
    content.includes('NEVER USE KEYWORD MATCHING'),
    'tierDetection.ts must have architectural rules header warning against keywords'
  );
});

// Test 5: detectInboundEmails.ts is deprecated and uses AI
test('detectInboundEmails.ts is deprecated and redirects to AI pipeline', () => {
  const detectInboundPath = path.join(
    process.cwd(),
    'src/lib/pipelines/detectInboundEmails.ts'
  );

  if (!fs.existsSync(detectInboundPath)) {
    // File doesn't exist, which is also acceptable
    return;
  }

  const content = fs.readFileSync(detectInboundPath, 'utf-8');

  expect(
    content.includes('@deprecated') || content.includes('DEPRECATED'),
    'detectInboundEmails.ts must be marked as deprecated'
  );

  expect(
    content.includes('processUnanalyzedEmails'),
    'detectInboundEmails.ts must redirect to processUnanalyzedEmails'
  );

  // Ensure no keyword arrays
  expect(
    !content.includes("keywords: ['demo"),
    'detectInboundEmails.ts must not contain keyword arrays'
  );
});

// Print summary
console.log('\n' + '='.repeat(60));
console.log('ARCHITECTURAL RULES TEST SUMMARY');
console.log('='.repeat(60));

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`\nPassed: ${passed}/${results.length}`);
console.log(`Failed: ${failed}/${results.length}`);

if (failed > 0) {
  console.log('\n❌ ARCHITECTURAL VIOLATIONS DETECTED');
  console.log('Please fix the issues above before committing.');
  console.log('See /docs/X-FORCE-ARCHITECTURAL-RULES.md for guidelines.');
  process.exit(1);
} else {
  console.log('\n✅ All architectural rules passed!');
  process.exit(0);
}
