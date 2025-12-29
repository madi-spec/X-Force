/**
 * Duplicate Detection System Types
 */

export type DuplicateGroupStatus = 'pending' | 'merged' | 'marked_separate' | 'auto_dismissed';
export type DuplicateEntityType = 'company' | 'contact' | 'customer';
export type DuplicateConfidence = 'exact' | 'high' | 'medium' | 'low';

/**
 * A group of records detected as potential duplicates
 */
export interface DuplicateGroup {
  id: string;
  entity_type: DuplicateEntityType;
  confidence: DuplicateConfidence;
  status: DuplicateGroupStatus;
  match_reason: string;
  match_fields: Record<string, unknown>;
  match_score: number | null;
  primary_record_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  detected_at: string;
  detected_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  members?: DuplicateGroupMember[];
}

/**
 * A member record within a duplicate group
 */
export interface DuplicateGroupMember {
  id: string;
  group_id: string;
  record_id: string;
  field_count: number;
  completeness_score: number | null;
  is_primary: boolean;
  record_snapshot: Record<string, unknown>;
  created_at: string;
}

/**
 * Audit log entry for a merge operation
 */
export interface DuplicateMergeLog {
  id: string;
  group_id: string;
  primary_record_id: string;
  merged_record_ids: string[];
  merged_data: Record<string, unknown>;
  deleted_data: Record<string, unknown>;
  relocation_counts: RelocationCounts | null;
  merged_at: string;
  merged_by: string | null;
  can_undo: boolean;
  undo_expires_at: string | null;
}

/**
 * Counts of related records relocated during merge
 */
export interface RelocationCounts {
  contacts?: number;
  deals?: number;
  activities?: number;
  company_products?: number;
  communications?: number;
}

/**
 * A detected match between records (before storage)
 */
export interface DuplicateMatch {
  recordIds: string[];
  confidence: DuplicateConfidence;
  matchReason: string;
  matchFields: Record<string, unknown>;
  matchScore: number;
}

/**
 * Options for duplicate detection
 */
export interface DetectionOptions {
  entityType: DuplicateEntityType;
  minConfidence?: DuplicateConfidence;
  limit?: number;
  includeResolved?: boolean;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  success: boolean;
  primaryRecordId: string;
  mergedRecordIds: string[];
  mergedFields: Record<string, unknown>;
  relocationCounts: RelocationCounts;
  error?: string;
}

/**
 * Result of a duplicate scan
 */
export interface ScanResult {
  success: boolean;
  detected: number;
  created: number;
  message: string;
}

/**
 * Completeness score result
 */
export interface CompletenessResult {
  fieldCount: number;
  score: number;
}

/**
 * Field weights for completeness scoring
 */
export type FieldWeights = Record<string, number>;
