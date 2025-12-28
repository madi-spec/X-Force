/**
 * Event Sourcing Guardrail Tests
 *
 * Static analysis tests to ensure:
 * - No direct writes to projection tables outside projector files
 * - API routes don't mutate projections
 * - Commands are the only way to change state
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  PROJECTION_TABLES,
  findProjectionWriteViolations,
  isProjectorFile,
  assertNotProjectionWrite,
  ProjectionWriteViolationError,
} from '../src/lib/eventSourcing';

// Get all TypeScript files in a directory recursively
function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '__tests__') {
        getAllTsFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Event Sourcing Guardrails', () => {
  describe('Projector File Detection', () => {
    it('should identify projector files correctly', () => {
      const projectorPaths = [
        '/src/lib/lifecycle/projectors/readModelProjector.ts',
        '/src/lib/supportCase/projectors/supportCaseReadModelProjector.ts',
        '/lib/projectors/index.ts',
      ];

      for (const p of projectorPaths) {
        expect(isProjectorFile(p)).toBe(true);
      }
    });

    it('should not identify non-projector files', () => {
      const nonProjectorPaths = [
        '/src/app/api/cases/route.ts',
        '/src/lib/supportCase/commands.ts',
        '/src/components/cases/CaseDetail.tsx',
      ];

      for (const p of nonProjectorPaths) {
        expect(isProjectorFile(p)).toBe(false);
      }
    });
  });

  describe('Runtime Assertion', () => {
    it('should throw on projection table writes', () => {
      for (const table of PROJECTION_TABLES) {
        expect(() => assertNotProjectionWrite(table, 'insert')).toThrow(ProjectionWriteViolationError);
        expect(() => assertNotProjectionWrite(table, 'update')).toThrow(ProjectionWriteViolationError);
        expect(() => assertNotProjectionWrite(table, 'upsert')).toThrow(ProjectionWriteViolationError);
        expect(() => assertNotProjectionWrite(table, 'delete')).toThrow(ProjectionWriteViolationError);
      }
    });

    it('should allow writes to non-projection tables', () => {
      const nonProjectionTables = [
        'companies',
        'contacts',
        'event_store',
        'support_cases',
      ];

      for (const table of nonProjectionTables) {
        expect(() => assertNotProjectionWrite(table, 'insert')).not.toThrow();
        expect(() => assertNotProjectionWrite(table, 'update')).not.toThrow();
      }
    });
  });

  describe('Static Analysis: Violation Detection', () => {
    it('should detect .from().insert() violations', () => {
      const code = `
        const result = await supabase
          .from('support_case_read_model')
          .insert({ id: '123' });
      `;

      const violations = findProjectionWriteViolations(code, '/src/app/api/test/route.ts');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].table).toBe('support_case_read_model');
    });

    it('should detect .from().update() violations', () => {
      const code = `
        await supabase.from('company_product_read_model').update({ status: 'x' }).eq('id', id);
      `;

      const violations = findProjectionWriteViolations(code, '/src/lib/someService.ts');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].table).toBe('company_product_read_model');
    });

    it('should detect raw SQL INSERT violations', () => {
      const code = `
        INSERT INTO support_case_read_model (id, title) VALUES ('123', 'Test');
      `;

      const violations = findProjectionWriteViolations(code, '/src/lib/test.ts');
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should allow projector files to write', () => {
      const code = `
        await supabase.from('support_case_read_model').upsert({ id: '123' });
      `;

      const violations = findProjectionWriteViolations(
        code,
        '/src/lib/supportCase/projectors/readModelProjector.ts'
      );
      expect(violations.length).toBe(0);
    });

    it('should allow reads from projection tables', () => {
      const code = `
        const { data } = await supabase
          .from('support_case_read_model')
          .select('*')
          .eq('id', id);
      `;

      const violations = findProjectionWriteViolations(code, '/src/app/api/cases/route.ts');
      expect(violations.length).toBe(0);
    });
  });

  describe('Codebase Scan: No Direct Projection Writes', () => {
    it('should have no projection write violations in API routes', () => {
      const srcDir = path.join(process.cwd(), 'src', 'app', 'api');

      // Skip if directory doesn't exist (CI environment)
      if (!fs.existsSync(srcDir)) {
        console.log('Skipping codebase scan - src/app/api not found');
        return;
      }

      const files = getAllTsFiles(srcDir);
      const allViolations: Array<{ file: string; violations: ReturnType<typeof findProjectionWriteViolations> }> = [];

      for (const file of files) {
        // Skip admin rebuild endpoint (it's allowed to truncate for rebuilds)
        if (file.includes('admin/projections/rebuild')) {
          continue;
        }

        const code = fs.readFileSync(file, 'utf-8');
        const violations = findProjectionWriteViolations(code, file);

        if (violations.length > 0) {
          allViolations.push({ file, violations });
        }
      }

      if (allViolations.length > 0) {
        const report = allViolations.map(v =>
          `${v.file}:\n${v.violations.map(viol =>
            `  Line ${viol.lineNumber}: ${viol.message}\n    ${viol.line}`
          ).join('\n')}`
        ).join('\n\n');

        console.error('Projection write violations found:\n', report);
      }

      expect(allViolations.length).toBe(0);
    });

    it('should have no projection write violations in lib services', () => {
      const srcDir = path.join(process.cwd(), 'src', 'lib');

      // Skip if directory doesn't exist (CI environment)
      if (!fs.existsSync(srcDir)) {
        console.log('Skipping codebase scan - src/lib not found');
        return;
      }

      const files = getAllTsFiles(srcDir);
      const allViolations: Array<{ file: string; violations: ReturnType<typeof findProjectionWriteViolations> }> = [];

      for (const file of files) {
        // Skip projector files - they are allowed to write
        if (isProjectorFile(file)) {
          continue;
        }

        // Skip the eventSourcing module itself
        if (file.includes('eventSourcing')) {
          continue;
        }

        const code = fs.readFileSync(file, 'utf-8');
        const violations = findProjectionWriteViolations(code, file);

        if (violations.length > 0) {
          allViolations.push({ file, violations });
        }
      }

      if (allViolations.length > 0) {
        const report = allViolations.map(v =>
          `${v.file}:\n${v.violations.map(viol =>
            `  Line ${viol.lineNumber}: ${viol.message}\n    ${viol.line}`
          ).join('\n')}`
        ).join('\n\n');

        console.error('Projection write violations found:\n', report);
      }

      expect(allViolations.length).toBe(0);
    });
  });

  describe('Projection Table List Completeness', () => {
    it('should include all known projection tables', () => {
      const expectedTables = [
        'support_case_read_model',
        'support_case_sla_facts',
        'company_product_read_model',
        'company_product_stage_facts',
        'company_product_open_case_counts',
        'company_open_case_counts',
        'product_pipeline_stage_counts',
      ];

      for (const table of expectedTables) {
        expect(PROJECTION_TABLES).toContain(table);
      }
    });

    it('should not include authoritative tables in projection list', () => {
      const authoritativeTables = [
        'event_store',
        'projector_checkpoints',
        'companies',
        'contacts',
        'support_cases',
        'company_products',
      ];

      for (const table of authoritativeTables) {
        expect(PROJECTION_TABLES).not.toContain(table);
      }
    });
  });
});

describe('API Route Architecture', () => {
  it('should verify cases API uses projections for reads', () => {
    const casesRoutePath = path.join(process.cwd(), 'src', 'app', 'api', 'cases', 'route.ts');

    if (!fs.existsSync(casesRoutePath)) {
      console.log('Skipping - cases route not found');
      return;
    }

    const code = fs.readFileSync(casesRoutePath, 'utf-8');

    // Should read from projection
    expect(code).toContain('support_case_read_model');

    // Should NOT write to projection
    const violations = findProjectionWriteViolations(code, casesRoutePath);
    expect(violations.length).toBe(0);
  });

  it('should verify cases API uses commands for writes', () => {
    const casesIdRoutePath = path.join(process.cwd(), 'src', 'app', 'api', 'cases', '[id]', 'route.ts');

    if (!fs.existsSync(casesIdRoutePath)) {
      console.log('Skipping - cases/[id] route not found');
      return;
    }

    const code = fs.readFileSync(casesIdRoutePath, 'utf-8');

    // Should import from commands
    const usesCommands =
      code.includes('assignSupportCase') ||
      code.includes('changeSupportCaseStatus') ||
      code.includes('resolveSupportCase') ||
      code.includes('@/lib/supportCase/commands');

    expect(usesCommands).toBe(true);
  });
});
