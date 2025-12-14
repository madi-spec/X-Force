'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, AlertCircle } from 'lucide-react';

interface OwnerMapperProps {
  rawData: Record<string, string>[];
  columnMapping: Record<string, string>;
  users: Array<{ id: string; name: string; email: string }>;
  currentUserId: string;
  initialMapping: Record<string, string>;
  onComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

export function OwnerMapper({
  rawData,
  columnMapping,
  users,
  currentUserId,
  initialMapping,
  onComplete,
  onBack,
}: OwnerMapperProps) {
  // Find the column mapped to deal_owner
  const ownerColumn = useMemo(() => {
    return Object.entries(columnMapping).find(([, value]) => value === 'deal_owner')?.[0];
  }, [columnMapping]);

  // Get unique owner values from the data
  const uniqueOwners = useMemo(() => {
    if (!ownerColumn) return [];
    const owners = new Set<string>();
    rawData.forEach((row) => {
      const value = row[ownerColumn]?.trim();
      if (value) {
        owners.add(value);
      }
    });
    return Array.from(owners).sort();
  }, [rawData, ownerColumn]);

  // Try to auto-match owner names to users
  const suggestOwnerMapping = (csvOwner: string): string => {
    const normalized = csvOwner.toLowerCase().trim();

    // Try exact match on name
    const exactMatch = users.find(u => u.name.toLowerCase() === normalized);
    if (exactMatch) return exactMatch.id;

    // Try partial match (first name or last name)
    const partialMatch = users.find(u => {
      const nameParts = u.name.toLowerCase().split(' ');
      return nameParts.some(part => part === normalized || normalized.includes(part));
    });
    if (partialMatch) return partialMatch.id;

    // Try email match
    const emailMatch = users.find(u =>
      u.email.toLowerCase().includes(normalized) ||
      normalized.includes(u.email.split('@')[0].toLowerCase())
    );
    if (emailMatch) return emailMatch.id;

    return '_unassigned';
  };

  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    if (Object.keys(initialMapping).length > 0) {
      return initialMapping;
    }

    // Auto-suggest mappings
    const suggested: Record<string, string> = {};
    uniqueOwners.forEach((owner) => {
      suggested[owner] = suggestOwnerMapping(owner);
    });
    return suggested;
  });

  const [defaultOwner, setDefaultOwner] = useState(currentUserId);

  // Count how many rows have each owner value
  const ownerCounts = useMemo(() => {
    if (!ownerColumn) return {};
    const counts: Record<string, number> = {};
    rawData.forEach((row) => {
      const value = row[ownerColumn]?.trim();
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    return counts;
  }, [rawData, ownerColumn]);

  // Count unmatched owners
  const unmatchedCount = useMemo(() => {
    return uniqueOwners.filter(o => mapping[o] === '_unassigned').length;
  }, [uniqueOwners, mapping]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Map Deal Owners</h3>
        <p className="text-sm text-gray-500 mt-1">
          Match owner names from your CSV to X-FORCE users
        </p>
      </div>

      {/* Auto-match summary */}
      {uniqueOwners.length > 0 && (
        <div className={`flex items-start gap-3 p-4 rounded-lg ${
          unmatchedCount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
        }`}>
          {unmatchedCount > 0 ? (
            <>
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  {unmatchedCount} owner{unmatchedCount !== 1 ? 's' : ''} could not be automatically matched
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Please review the mappings below and assign them manually
                </p>
              </div>
            </>
          ) : (
            <>
              <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">
                  All owners automatically matched!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Review the mappings below to confirm they are correct
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mapping Table */}
      {uniqueOwners.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CSV Owner Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  X-FORCE User
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {uniqueOwners.map((owner) => (
                <tr
                  key={owner}
                  className={`hover:bg-gray-50 ${
                    mapping[owner] === '_unassigned' ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">&quot;{owner}&quot;</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {ownerCounts[owner] || 0} rows
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping[owner] || '_unassigned'}
                      onChange={(e) => setMapping({ ...mapping, [owner]: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        mapping[owner] === '_unassigned'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="_unassigned">-- Select User --</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
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
          No owner values found in your data
        </div>
      )}

      {/* Default Owner */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default owner for unmatched or empty values
        </label>
        <select
          value={defaultOwner}
          onChange={(e) => setDefaultOwner(e.target.value)}
          className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} {user.id === currentUserId ? '(You)' : ''}
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
          onClick={() => onComplete({ ...mapping, _default: defaultOwner })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
