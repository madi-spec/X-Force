'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PIPELINE_STAGES } from '@/types';

interface StageMapperProps {
  rawData: Record<string, string>[];
  columnMapping: Record<string, string>;
  initialMapping: Record<string, string>;
  onComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

export function StageMapper({
  rawData,
  columnMapping,
  initialMapping,
  onComplete,
  onBack,
}: StageMapperProps) {
  // Find the column mapped to deal_stage
  const stageColumn = useMemo(() => {
    return Object.entries(columnMapping).find(([_, value]) => value === 'deal_stage')?.[0];
  }, [columnMapping]);

  // Get unique stage values from the data
  const uniqueStages = useMemo(() => {
    if (!stageColumn) return [];
    const stages = new Set<string>();
    rawData.forEach((row) => {
      const value = row[stageColumn]?.trim();
      if (value) {
        stages.add(value);
      }
    });
    return Array.from(stages).sort();
  }, [rawData, stageColumn]);

  // Auto-suggest stage mappings
  const suggestStageMapping = (csvStage: string): string => {
    const normalized = csvStage.toLowerCase().trim();

    // Common mappings
    const suggestions: Record<string, string> = {
      'new': 'new_lead',
      'new lead': 'new_lead',
      'lead': 'new_lead',
      'qualified': 'qualifying',
      'qualifying': 'qualifying',
      'qualification': 'qualifying',
      'discovery': 'discovery',
      'discovery call': 'discovery',
      'demo': 'demo',
      'demo scheduled': 'demo',
      'demo complete': 'demo',
      'demonstration': 'demo',
      'data review': 'data_review',
      'review': 'data_review',
      'trial': 'trial',
      'pilot': 'trial',
      'poc': 'trial',
      'proof of concept': 'trial',
      'negotiation': 'negotiation',
      'negotiating': 'negotiation',
      'proposal': 'negotiation',
      'proposal sent': 'negotiation',
      'contract': 'negotiation',
      'closed won': 'closed_won',
      'won': 'closed_won',
      'closed': 'closed_won',
      'closed lost': 'closed_lost',
      'lost': 'closed_lost',
    };

    return suggestions[normalized] || 'new_lead';
  };

  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    if (Object.keys(initialMapping).length > 0) {
      return initialMapping;
    }

    // Auto-suggest mappings
    const suggested: Record<string, string> = {};
    uniqueStages.forEach((stage) => {
      suggested[stage] = suggestStageMapping(stage);
    });
    return suggested;
  });

  const [defaultStage, setDefaultStage] = useState('new_lead');

  // Count how many rows have each stage value
  const stageCounts = useMemo(() => {
    if (!stageColumn) return {};
    const counts: Record<string, number> = {};
    rawData.forEach((row) => {
      const value = row[stageColumn]?.trim();
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    return counts;
  }, [rawData, stageColumn]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Map Pipeline Stages</h3>
        <p className="text-sm text-gray-500 mt-1">
          Match your CSV stage values to X-FORCE pipeline stages
        </p>
      </div>

      {/* Mapping Table */}
      {uniqueStages.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Your Stage Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  X-FORCE Stage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {uniqueStages.map((stage) => (
                <tr key={stage} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">"{stage}"</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {stageCounts[stage] || 0} rows
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping[stage] || defaultStage}
                      onChange={(e) => setMapping({ ...mapping, [stage]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No stage values found in your data
        </div>
      )}

      {/* Default Stage */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default stage for unmapped or empty values
        </label>
        <select
          value={defaultStage}
          onChange={(e) => setDefaultStage(e.target.value)}
          className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() => onComplete({ ...mapping, _default: defaultStage })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
