/**
 * Event Sourcing Guardrails
 *
 * Enforces architectural rules:
 * - No direct writes to projection tables outside projectors
 * - All state mutations must go through commands/events
 * - Projection tables are read-only for API routes
 */

// List of projection tables that should NEVER be written to directly
export const PROJECTION_TABLES = [
  'support_case_read_model',
  'support_case_sla_facts',
  'company_product_read_model',
  'company_product_stage_facts',
  'company_product_open_case_counts',
  'company_open_case_counts',
  'product_pipeline_stage_counts',
] as const;

export type ProjectionTable = typeof PROJECTION_TABLES[number];

// Tables that store authoritative state (source of truth)
export const AUTHORITATIVE_TABLES = [
  'event_store',
  'projector_checkpoints',
] as const;

/**
 * Runtime assertion: Throws if attempting to write to a projection table
 * Use in API routes to prevent accidental direct writes
 */
export function assertNotProjectionWrite(tableName: string, operation: 'insert' | 'update' | 'delete' | 'upsert'): void {
  if (PROJECTION_TABLES.includes(tableName as ProjectionTable)) {
    throw new ProjectionWriteViolationError(
      `Direct ${operation} to projection table '${tableName}' is forbidden. ` +
      `Use commands to emit events, which projectors will process.`
    );
  }
}

/**
 * Custom error for projection write violations
 */
export class ProjectionWriteViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionWriteViolationError';
  }
}

/**
 * Wrapper that creates a "read-only projections" Supabase client
 * Intercepts and blocks writes to projection tables
 */
export function createReadOnlyProjectionsClient<T extends { from: (table: string) => unknown }>(
  supabase: T,
  context: string = 'unknown'
): T {
  const originalFrom = supabase.from.bind(supabase);

  const wrappedFrom = (tableName: string) => {
    const queryBuilder = originalFrom(tableName);

    if (PROJECTION_TABLES.includes(tableName as ProjectionTable)) {
      // Wrap mutation methods to throw
      const wrapMutation = (method: string) => {
        const original = (queryBuilder as Record<string, unknown>)[method];
        if (typeof original === 'function') {
          (queryBuilder as Record<string, unknown>)[method] = (...args: unknown[]) => {
            throw new ProjectionWriteViolationError(
              `[${context}] Attempted ${method} on projection table '${tableName}'. ` +
              `Projections are read-only. Use command handlers to mutate state.`
            );
          };
        }
      };

      wrapMutation('insert');
      wrapMutation('update');
      wrapMutation('upsert');
      wrapMutation('delete');
    }

    return queryBuilder;
  };

  return {
    ...supabase,
    from: wrappedFrom,
  } as T;
}

/**
 * Validates that a file path is allowed to write to projections
 * Used in static analysis / linting
 */
export function isProjectorFile(filePath: string): boolean {
  const projectorPatterns = [
    /\/projectors\//,
    /projector\.ts$/,
    /Projector\.ts$/,
  ];

  return projectorPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Static analysis helper: Finds projection writes in code
 * Returns violations found
 */
export function findProjectionWriteViolations(
  code: string,
  filePath: string
): ProjectionWriteViolation[] {
  if (isProjectorFile(filePath)) {
    return []; // Projector files are allowed to write
  }

  const violations: ProjectionWriteViolation[] = [];
  const lines = code.split('\n');

  // First pass: check each line individually
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const table of PROJECTION_TABLES) {
      // Check for .from('table').insert/update/upsert/delete patterns on same line
      const fromPattern = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`);
      const mutationPattern = /\.(insert|update|upsert|delete)\s*\(/;

      if (fromPattern.test(line) && mutationPattern.test(line)) {
        violations.push({
          filePath,
          lineNumber,
          table,
          line: line.trim(),
          message: `Direct write to projection table '${table}' detected`,
        });
      }

      // Check for raw SQL writes
      const sqlPatterns = [
        new RegExp(`INSERT\\s+INTO\\s+${table}`, 'i'),
        new RegExp(`UPDATE\\s+${table}\\s+SET`, 'i'),
        new RegExp(`DELETE\\s+FROM\\s+${table}`, 'i'),
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(line)) {
          violations.push({
            filePath,
            lineNumber,
            table,
            line: line.trim(),
            message: `Raw SQL write to projection table '${table}' detected`,
          });
        }
      }
    }
  }

  // Second pass: check for multi-line chained patterns
  // Look for .from('projection_table') followed by .insert/.update/.upsert/.delete within 5 lines
  for (const table of PROJECTION_TABLES) {
    const fromPattern = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`);

    for (let i = 0; i < lines.length; i++) {
      if (fromPattern.test(lines[i])) {
        // Look ahead up to 5 lines for a mutation
        const windowEnd = Math.min(i + 5, lines.length);
        for (let j = i; j < windowEnd; j++) {
          const mutationMatch = lines[j].match(/\.(insert|update|upsert|delete)\s*\(/);
          if (mutationMatch && j !== i) {
            // Check if this violation was already caught
            const alreadyCaught = violations.some(
              v => v.table === table && (v.lineNumber === i + 1 || v.lineNumber === j + 1)
            );
            if (!alreadyCaught) {
              violations.push({
                filePath,
                lineNumber: i + 1,
                table,
                line: lines[i].trim() + ' ... ' + lines[j].trim(),
                message: `Direct write to projection table '${table}' detected (chained across lines)`,
              });
            }
            break;
          }
        }
      }
    }
  }

  return violations;
}

export interface ProjectionWriteViolation {
  filePath: string;
  lineNumber: number;
  table: string;
  line: string;
  message: string;
}

/**
 * Decorator-style function for API route handlers
 * Ensures the handler uses a read-only projections client
 */
export function withProjectionGuard<T>(
  handler: (supabase: T) => Promise<unknown>,
  supabase: T,
  context: string
): Promise<unknown> {
  const guardedClient = createReadOnlyProjectionsClient(supabase as T & { from: (table: string) => unknown }, context);
  return handler(guardedClient as T);
}
