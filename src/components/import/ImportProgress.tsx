'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { importData } from '@/lib/import/importService';

interface ImportProgressProps {
  rawData: Record<string, string>[];
  columnMapping: Record<string, string>;
  stageMapping: Record<string, string>;
  ownerMapping: Record<string, string>;
  existingCompanies: Array<{ id: string; name: string }>;
  currentUserId: string;
  onComplete: (
    results: { companies: number; contacts: number; deals: number; activities: number },
    errors: Array<{ row: number; message: string }>
  ) => void;
}

interface ProgressState {
  phase: 'companies' | 'contacts' | 'deals' | 'activities' | 'complete';
  current: number;
  total: number;
  recentActions: string[];
  errors: Array<{ row: number; message: string }>;
}

export function ImportProgress({
  rawData,
  columnMapping,
  stageMapping,
  ownerMapping,
  existingCompanies,
  currentUserId,
  onComplete,
}: ImportProgressProps) {
  const hasStartedImport = useRef(false);
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'companies',
    current: 0,
    total: rawData.length,
    recentActions: [],
    errors: [],
  });

  const [results, setResults] = useState({
    companies: 0,
    contacts: 0,
    deals: 0,
    activities: 0,
  });

  // Run import once on mount (guard against React Strict Mode double-invoke)
  useEffect(() => {
    if (hasStartedImport.current) return;
    hasStartedImport.current = true;

    const runImport = async () => {
      try {
        const result = await importData({
          rawData,
          columnMapping,
          stageMapping,
          ownerMapping,
          existingCompanies,
          currentUserId,
          onProgress: (update) => {
            setProgress((prev) => ({
              ...prev,
              phase: update.phase,
              current: update.current,
              total: update.total,
              recentActions: [
                update.action,
                ...prev.recentActions.slice(0, 4),
              ],
            }));
          },
        });

        setResults(result.results);
        setProgress((prev) => ({ ...prev, phase: 'complete', errors: result.errors }));
        onComplete(result.results, result.errors);
      } catch (error) {
        console.error('Import failed:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setProgress((prev) => ({
          ...prev,
          errors: [{ row: 0, message: `Import failed: ${errorMsg}` }],
        }));
      }
    };

    runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseLabels = {
    companies: 'Importing companies...',
    contacts: 'Importing contacts...',
    deals: 'Importing deals...',
    activities: 'Importing activities...',
    complete: 'Import complete!',
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        {progress.phase !== 'complete' ? (
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
        ) : (
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        )}
        <h3 className="text-lg font-semibold text-gray-900">
          {phaseLabels[progress.phase]}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {progress.current} of {progress.total} rows processed
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-blue-600">{results.companies}</p>
          <p className="text-xs text-gray-500">Companies</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-600">{results.contacts}</p>
          <p className="text-xs text-gray-500">Contacts</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-purple-600">{results.deals}</p>
          <p className="text-xs text-gray-500">Deals</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-orange-600">{results.activities}</p>
          <p className="text-xs text-gray-500">Activities</p>
        </div>
      </div>

      {/* Recent Actions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
        <div className="space-y-1">
          {progress.recentActions.length > 0 ? (
            progress.recentActions.map((action, i) => (
              <p key={i} className={`text-sm ${i === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {action}
              </p>
            ))
          ) : (
            <p className="text-sm text-gray-400">Starting import...</p>
          )}
        </div>
      </div>

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h4 className="font-medium text-red-800">
              {progress.errors.length} error{progress.errors.length !== 1 ? 's' : ''}
            </h4>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {progress.errors.slice(0, 10).map((err, i) => (
              <p key={i} className="text-sm text-red-700">
                Row {err.row}: {err.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
