/**
 * No Direct Projection Writes Test
 *
 * Verifies that projection tables are ONLY written by projectors,
 * not by commands, API routes, or other code.
 *
 * RULE: Projections are derived from events. Never write them directly.
 *
 * Run with: npx tsx __tests__/no-direct-projection-writes.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Projection tables that should ONLY be written by projectors
const PROJECTION_TABLES = [
  'company_product_read_model',
  'company_product_stage_facts',
  'product_pipeline_stage_counts',
];

// Allowed directories that CAN write to projections
const ALLOWED_PATHS = [
  'src/lib/lifecycle/projectors/',
  '__tests__/', // Tests can manipulate for cleanup
];

// Patterns that indicate a write operation
const WRITE_PATTERNS = [
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.upsert\s*\(/,
  /\.delete\s*\(/,
];

interface Violation {
  file: string;
  line: number;
  table: string;
  content: string;
}

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_PATHS.some((allowed) => filePath.includes(allowed.replace(/\//g, path.sep)));
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  // Skip non-TypeScript files
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return violations;
  }

  // Skip allowed paths
  if (isAllowedPath(filePath)) {
    return violations;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for each projection table
    for (const table of PROJECTION_TABLES) {
      // Check if line references the table
      if (line.includes(`'${table}'`) || line.includes(`"${table}"`)) {
        // Check if it's a write operation
        const hasWritePattern = WRITE_PATTERNS.some((pattern) => pattern.test(line));

        // Also check the context (previous lines might have .from())
        const contextStart = Math.max(0, i - 3);
        const context = lines.slice(contextStart, i + 1).join('\n');
        const hasWriteInContext = WRITE_PATTERNS.some((pattern) => pattern.test(context));

        if (hasWritePattern || hasWriteInContext) {
          violations.push({
            file: filePath,
            line: i + 1,
            table,
            content: line.trim(),
          });
        }
      }
    }
  }

  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules and hidden directories
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }

    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else {
      violations.push(...scanFile(fullPath));
    }
  }

  return violations;
}

async function runTest() {
  console.log('\n🔍 SCANNING FOR DIRECT PROJECTION WRITES\n');
  console.log('Projection tables protected:');
  PROJECTION_TABLES.forEach((t) => console.log(`  - ${t}`));
  console.log('\nAllowed write locations:');
  ALLOWED_PATHS.forEach((p) => console.log(`  - ${p}`));
  console.log('\n');

  // Start from src directory
  const srcDir = path.join(process.cwd(), 'src');
  const violations = scanDirectory(srcDir);

  if (violations.length === 0) {
    console.log('✅ No direct projection writes found outside projectors!\n');
    console.log('GUARDRAIL PASSED: All projection writes go through projector layer.\n');
    return true;
  }

  console.log(`❌ Found ${violations.length} potential violations:\n`);

  for (const v of violations) {
    console.log(`  📁 ${v.file}:${v.line}`);
    console.log(`     Table: ${v.table}`);
    console.log(`     Code: ${v.content.substring(0, 80)}${v.content.length > 80 ? '...' : ''}`);
    console.log('');
  }

  console.log('\n❌ GUARDRAIL FAILED: Projections must only be written by projectors.\n');
  console.log('Fix: Move write operations to the appropriate projector in src/lib/lifecycle/projectors/\n');

  return false;
}

// Run test
runTest()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
