'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import {
  ALL_FIELDS,
  COMPANY_FIELDS,
  CONTACT_FIELDS,
  DEAL_FIELDS,
  ACTIVITY_FIELDS,
  COLUMN_SUGGESTIONS,
  type ImportType,
} from '@/lib/import/types';

interface ColumnMapperProps {
  columns: string[];
  sampleData: Record<string, string>[];
  importType: ImportType;
  initialMapping: Record<string, string>;
  onComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

export function ColumnMapper({
  columns,
  sampleData,
  importType,
  initialMapping,
  onComplete,
  onBack,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    // Start with initial mapping or auto-suggest
    if (Object.keys(initialMapping).length > 0) {
      return initialMapping;
    }

    // Auto-suggest based on column names
    const suggested: Record<string, string> = {};
    columns.forEach((col) => {
      const normalizedCol = col.toLowerCase().trim();
      if (COLUMN_SUGGESTIONS[normalizedCol]) {
        suggested[col] = COLUMN_SUGGESTIONS[normalizedCol];
      } else {
        suggested[col] = 'skip';
      }
    });
    return suggested;
  });

  const [showAllColumns, setShowAllColumns] = useState(columns.length <= 15);

  // Get available fields based on import type
  const availableFields = useMemo(() => {
    const fields: Array<{ id: string; label: string; disabled?: boolean; required?: boolean }> = [
      { id: 'skip', label: 'Skip this field' }
    ];

    if (importType === 'deals') {
      fields.push(
        { id: 'separator_company', label: '── Company ──', disabled: true },
        ...COMPANY_FIELDS,
        { id: 'separator_contact', label: '── Contact ──', disabled: true },
        ...CONTACT_FIELDS,
        { id: 'separator_deal', label: '── Deal ──', disabled: true },
        ...DEAL_FIELDS,
        { id: 'separator_activity', label: '── Activity ──', disabled: true },
        ...ACTIVITY_FIELDS
      );
    } else if (importType === 'companies') {
      fields.push(...COMPANY_FIELDS);
    } else if (importType === 'contacts') {
      fields.push(
        { id: 'separator_company', label: '── Company ──', disabled: true },
        { id: 'company_name', label: 'Company Name (for matching)', required: true },
        { id: 'separator_contact', label: '── Contact ──', disabled: true },
        ...CONTACT_FIELDS
      );
    }

    return fields;
  }, [importType]);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];

    // Check for required company name
    const hasCompanyName = Object.values(mapping).includes('company_name');
    if (!hasCompanyName) {
      errors.push('Company Name is required');
    }

    // For contacts import, we also need contact email or name
    if (importType === 'contacts') {
      const hasContactInfo = Object.values(mapping).includes('contact_name') ||
        Object.values(mapping).includes('contact_email');
      if (!hasContactInfo) {
        errors.push('Contact Name or Email is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [mapping, importType]);

  // Get sample value for a column
  const getSampleValue = (column: string): string => {
    for (const row of sampleData) {
      if (row[column] && row[column].trim()) {
        const value = row[column].trim();
        return value.length > 50 ? value.substring(0, 50) + '...' : value;
      }
    }
    return '(empty)';
  };

  const displayedColumns = showAllColumns ? columns : columns.slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Map Your Fields</h3>
          <p className="text-sm text-gray-500 mt-1">
            {columns.length} columns found • Match each column to an X-FORCE field
          </p>
        </div>
        <span className="text-sm text-gray-500">
          {sampleData.length > 0 ? `${sampleData[0] ? Object.keys(sampleData[0]).length : 0} rows in file` : ''}
        </span>
      </div>

      {/* Mapping Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CSV Column
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sample Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map To
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayedColumns.map((column) => (
              <tr key={column} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{column}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 font-mono">
                    {getSampleValue(column)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={mapping[column] || 'skip'}
                    onChange={(e) => setMapping({ ...mapping, [column]: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      mapping[column] && mapping[column] !== 'skip'
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                  >
                    {availableFields.map((field) => (
                      <option
                        key={field.id}
                        value={field.id}
                        disabled={'disabled' in field && field.disabled}
                      >
                        {field.label}
                        {'required' in field && field.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show More */}
      {columns.length > 15 && !showAllColumns && (
        <button
          onClick={() => setShowAllColumns(true)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Show all {columns.length} columns
        </button>
      )}

      {/* Validation Errors */}
      {!validation.isValid && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Required fields missing</p>
            <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Mapped Fields Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Mapping Summary</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(mapping)
            .filter(([, value]) => value !== 'skip')
            .map(([col, field]) => {
              const fieldDef = ALL_FIELDS.find(f => f.id === field);
              return (
                <span
                  key={col}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                >
                  {fieldDef?.label || field}
                </span>
              );
            })}
          {Object.values(mapping).filter(v => v !== 'skip').length === 0 && (
            <span className="text-sm text-gray-500">No fields mapped yet</span>
          )}
        </div>
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
          onClick={() => onComplete(mapping)}
          disabled={!validation.isValid}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
