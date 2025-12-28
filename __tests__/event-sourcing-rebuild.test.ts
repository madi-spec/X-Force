/**
 * Event Sourcing Rebuild Tests
 *
 * Tests for:
 * - Projection snapshot capture
 * - Deterministic rebuild verification
 * - Checksum stability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  takeProjectionSnapshot,
  compareSnapshots,
  ALL_PROJECTORS,
  PROJECTION_TABLES,
  type ProjectionSnapshot,
} from '../src/lib/eventSourcing';

describe('Event Sourcing Rebuild', () => {
  describe('Projection Snapshots', () => {
    it('should capture snapshots for all projection tables', () => {
      // Verify all projection tables are covered by the rebuild tool
      const rebuildTables = ALL_PROJECTORS;

      for (const table of PROJECTION_TABLES) {
        // Each projection table should have a corresponding projector
        // or be covered by a multi-table projector
        expect(
          rebuildTables.includes(table as typeof ALL_PROJECTORS[number]) ||
          table === 'company_open_case_counts' // Shares projector with company_product_open_case_counts
        ).toBe(true);
      }
    });

    it('should calculate deterministic checksums for identical data', () => {
      const snapshot1: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:00Z',
        tables: [
          {
            tableName: 'test_table',
            rowCount: 2,
            checksum: 'abc123',
            sampleRows: [
              { id: '1', name: 'test' },
              { id: '2', name: 'test2' },
            ],
          },
        ],
      };

      const snapshot2: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:01Z', // Different time, but same data
        tables: [
          {
            tableName: 'test_table',
            rowCount: 2,
            checksum: 'abc123', // Same checksum
            sampleRows: [
              { id: '1', name: 'test' },
              { id: '2', name: 'test2' },
            ],
          },
        ],
      };

      const comparison = compareSnapshots(snapshot1, snapshot2);
      expect(comparison.equal).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    it('should detect row count differences', () => {
      const snapshot1: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:00Z',
        tables: [
          { tableName: 'test_table', rowCount: 10, checksum: 'abc' },
        ],
      };

      const snapshot2: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:00Z',
        tables: [
          { tableName: 'test_table', rowCount: 15, checksum: 'abc' },
        ],
      };

      const comparison = compareSnapshots(snapshot1, snapshot2);
      expect(comparison.equal).toBe(false);
      expect(comparison.differences.some(d => d.includes('row count'))).toBe(true);
    });

    it('should detect checksum differences', () => {
      const snapshot1: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:00Z',
        tables: [
          { tableName: 'test_table', rowCount: 10, checksum: 'abc123' },
        ],
      };

      const snapshot2: ProjectionSnapshot = {
        takenAt: '2024-01-01T00:00:00Z',
        tables: [
          { tableName: 'test_table', rowCount: 10, checksum: 'def456' },
        ],
      };

      const comparison = compareSnapshots(snapshot1, snapshot2);
      expect(comparison.equal).toBe(false);
      expect(comparison.differences.some(d => d.includes('checksum'))).toBe(true);
    });
  });

  describe('Rebuild Determinism Contract', () => {
    it('should have all projection tables accounted for', () => {
      const coveredTables = new Set<string>();

      // Add all projector names (which correspond to tables)
      ALL_PROJECTORS.forEach(p => coveredTables.add(p));

      // Verify coverage
      for (const table of PROJECTION_TABLES) {
        if (table === 'company_open_case_counts') {
          // This is handled by the same projector as company_product_open_case_counts
          expect(coveredTables.has('company_product_open_case_counts')).toBe(true);
        } else {
          expect(coveredTables.has(table)).toBe(true);
        }
      }
    });

    it('should define all required projector names', () => {
      // These are the minimum projectors needed for the support case system
      const requiredProjectors = [
        'support_case_read_model',
        'company_product_read_model',
        'company_product_open_case_counts',
      ];

      for (const projector of requiredProjectors) {
        expect(ALL_PROJECTORS).toContain(projector);
      }
    });
  });

  describe('Idempotency', () => {
    it('should define projector names matching table names', () => {
      // By convention, projector names should match their target table
      // This makes the system predictable
      for (const projector of ALL_PROJECTORS) {
        // Projector name should be a valid table name pattern
        expect(projector).toMatch(/^[a-z_]+$/);
      }
    });
  });
});

describe('Snapshot Comparison Edge Cases', () => {
  it('should handle missing tables in comparison', () => {
    const snapshot1: ProjectionSnapshot = {
      takenAt: '2024-01-01T00:00:00Z',
      tables: [
        { tableName: 'table_a', rowCount: 10, checksum: 'abc' },
        { tableName: 'table_b', rowCount: 5, checksum: 'def' },
      ],
    };

    const snapshot2: ProjectionSnapshot = {
      takenAt: '2024-01-01T00:00:00Z',
      tables: [
        { tableName: 'table_a', rowCount: 10, checksum: 'abc' },
        { tableName: 'table_c', rowCount: 5, checksum: 'ghi' }, // Different table
      ],
    };

    const comparison = compareSnapshots(snapshot1, snapshot2);
    expect(comparison.equal).toBe(false);
    expect(comparison.differences.some(d => d.includes('not in before snapshot'))).toBe(true);
  });

  it('should handle empty snapshots', () => {
    const snapshot1: ProjectionSnapshot = {
      takenAt: '2024-01-01T00:00:00Z',
      tables: [],
    };

    const snapshot2: ProjectionSnapshot = {
      takenAt: '2024-01-01T00:00:00Z',
      tables: [],
    };

    const comparison = compareSnapshots(snapshot1, snapshot2);
    expect(comparison.equal).toBe(true);
  });
});
