'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, AlertTriangle, ChevronRight, RefreshCw, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MergeDuplicatesModal } from './MergeDuplicatesModal';
import type { DuplicateGroup, DuplicateEntityType, DuplicateConfidence } from '@/types/duplicates';

interface DuplicateManagerProps {
  entityType?: DuplicateEntityType;
  onClose?: () => void;
  isModal?: boolean;
}

const confidenceColors: Record<DuplicateConfidence, string> = {
  exact: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-700',
};

const confidenceLabels: Record<DuplicateConfidence, string> = {
  exact: 'EXACT',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

/**
 * DuplicateManager component
 * Lists pending duplicate groups with scan and review functionality
 */
export function DuplicateManager({ entityType, onClose, isModal = true }: DuplicateManagerProps) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: 'pending' });
      if (entityType) params.set('entityType', entityType);

      const res = await fetch(`/api/duplicates?${params}`);
      if (!res.ok) throw new Error('Failed to load duplicates');

      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const scanType = entityType || 'company';
      const res = await fetch('/api/duplicates/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: scanType }),
      });

      if (!res.ok) throw new Error('Scan failed');

      const data = await res.json();
      console.log('[DuplicateManager] Scan result:', data.message);

      // Refresh the list
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleMergeComplete = () => {
    setSelectedGroupId(null);
    fetchGroups();
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Copy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Duplicate Detection</h2>
            <p className="text-sm text-gray-500">
              {loading ? 'Loading...' : `${groups.length} pending duplicate groups`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg transition-colors',
              scanning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', scanning && 'animate-spin')} />
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Groups List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-pulse text-gray-400">Loading duplicates...</div>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No pending duplicates</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Scan" to check for new duplicates
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {group.members?.length || 0} potential duplicates
                      </p>
                      <p className="text-sm text-gray-500 truncate">{group.match_reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        confidenceColors[group.confidence]
                      )}
                    >
                      {confidenceLabels[group.confidence]}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Preview of members */}
                {group.members && group.members.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {group.members.slice(0, 3).map((member) => {
                      const snapshot = member.record_snapshot as Record<string, unknown>;
                      const displayName =
                        (snapshot.name as string) || (snapshot.email as string) || 'Unknown';
                      return (
                        <span
                          key={member.id}
                          className={cn(
                            'text-xs px-2 py-1 rounded truncate max-w-[150px]',
                            member.is_primary
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          )}
                          title={displayName}
                        >
                          {displayName}
                          {member.is_primary && ' (Primary)'}
                        </span>
                      );
                    })}
                    {group.members.length > 3 && (
                      <span className="text-xs text-gray-400 px-2 py-1">
                        +{group.members.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {selectedGroupId && (
        <MergeDuplicatesModal
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onMerge={handleMergeComplete}
        />
      )}
    </div>
  );

  // Return as modal or inline content
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  return <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{content}</div>;
}
