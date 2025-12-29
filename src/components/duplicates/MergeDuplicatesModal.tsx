'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, GitMerge, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DuplicateGroup, DuplicateGroupMember, DuplicateEntityType } from '@/types/duplicates';

interface MergeDuplicatesModalProps {
  groupId: string;
  onClose: () => void;
  onMerge: () => void;
}

// Fields to display for each entity type
const COMPANY_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'domain', label: 'Domain' },
  { key: 'status', label: 'Status' },
  { key: 'segment', label: 'Segment' },
  { key: 'industry', label: 'Industry' },
  { key: 'agent_count', label: 'Agents' },
  { key: 'vfp_customer_id', label: 'VFP ID' },
  { key: 'ats_id', label: 'ATS ID' },
  { key: 'crm_platform', label: 'CRM' },
];

const CONTACT_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'title', label: 'Title' },
  { key: 'role', label: 'Role' },
  { key: 'is_primary', label: 'Primary' },
  { key: 'is_decision_maker', label: 'Decision Maker' },
];

/**
 * MergeDuplicatesModal component
 * Side-by-side comparison with merge/separate actions
 */
export function MergeDuplicatesModal({ groupId, onClose, onMerge }: MergeDuplicatesModalProps) {
  const [group, setGroup] = useState<DuplicateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [markingSeparate, setMarkingSeparate] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroup = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/duplicates?groupId=${groupId}`);
        if (!res.ok) throw new Error('Failed to load group');

        const data = await res.json();
        if (data.groups?.[0]) {
          const fetchedGroup = data.groups[0] as DuplicateGroup;
          setGroup(fetchedGroup);

          // Set initial primary from the group
          const primaryMember = fetchedGroup.members?.find((m) => m.is_primary);
          if (primaryMember) {
            setSelectedPrimary(primaryMember.record_id);
          } else if (fetchedGroup.primary_record_id) {
            setSelectedPrimary(fetchedGroup.primary_record_id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId]);

  const handleMerge = async () => {
    if (!selectedPrimary) return;

    setMerging(true);
    setError(null);
    try {
      const res = await fetch(`/api/duplicates/${groupId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryRecordId: selectedPrimary }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Merge failed');
      }

      onMerge();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleMarkSeparate = async () => {
    setMarkingSeparate(true);
    setError(null);
    try {
      const res = await fetch(`/api/duplicates/${groupId}/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'User marked as intentionally separate' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      onMerge();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setMarkingSeparate(false);
    }
  };

  // Determine which fields to display
  const getFields = (entityType: DuplicateEntityType) => {
    if (entityType === 'contact') return CONTACT_FIELDS;
    return COMPANY_FIELDS;
  };

  // Format field value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-white rounded-xl p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state or no group
  if (!group || !group.members) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl p-8 max-w-md">
          <p className="text-red-600">{error || 'Failed to load duplicate group'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const fields = getFields(group.entity_type);
  const members = group.members as DuplicateGroupMember[];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Review Duplicates</h2>
              <p className="text-sm text-gray-500">{group.match_reason}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Side by side comparison */}
        <div className="flex-1 overflow-auto p-4">
          {/* Instructions */}
          <p className="text-sm text-gray-600 mb-4">
            Select the primary record to keep. Empty fields will be filled from other records, and
            all related data (contacts, deals, activities) will be transferred.
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Records grid */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(members.length, 3)}, minmax(200px, 1fr))`,
            }}
          >
            {members.map((member) => {
              const snapshot = member.record_snapshot as Record<string, unknown>;
              const isSelected = selectedPrimary === member.record_id;

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedPrimary(member.record_id)}
                  className={cn(
                    'border rounded-xl p-4 cursor-pointer transition-all',
                    isSelected
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {/* Header with primary badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                        isSelected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {isSelected ? 'PRIMARY' : 'DUPLICATE'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {Math.round(member.completeness_score || 0)}% complete
                    </span>
                  </div>

                  {/* Fields */}
                  <div className="space-y-2">
                    {fields.map((field) => {
                      const value = snapshot[field.key];
                      const hasValue = value !== null && value !== undefined && value !== '';

                      return (
                        <div key={field.key}>
                          <label className="text-xs text-gray-500 uppercase tracking-wider">
                            {field.label}
                          </label>
                          <p
                            className={cn(
                              'text-sm truncate',
                              hasValue ? 'text-gray-900' : 'text-gray-400 italic'
                            )}
                            title={hasValue ? formatValue(value) : undefined}
                          >
                            {hasValue ? formatValue(value) : 'Empty'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Merge preview */}
          {selectedPrimary && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Merge Preview</span>
              </div>
              <p className="text-sm text-blue-600">
                {members.length - 1} record(s) will be merged into the primary. All contacts, deals,
                activities, and products will be transferred. This action cannot be easily undone.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleMarkSeparate}
            disabled={markingSeparate || merging}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              markingSeparate || merging
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-200'
            )}
          >
            {markingSeparate ? 'Updating...' : 'Mark as Separate'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={merging}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={merging || !selectedPrimary}
              className={cn(
                'flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors',
                merging || !selectedPrimary
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              {merging && <Loader2 className="h-4 w-4 animate-spin" />}
              <GitMerge className="h-4 w-4" />
              Merge Records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
