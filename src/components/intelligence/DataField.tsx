'use client';

import { useState, useCallback } from 'react';
import {
  Pencil,
  Check,
  X,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourcedField, FieldDefinition } from '@/lib/intelligence/dataLayerTypes';

// ============================================
// TYPES
// ============================================

interface DataFieldProps {
  field: FieldDefinition;
  data: SourcedField<unknown>;
  onUpdate?: (value: unknown, source?: string, sourceUrl?: string, reason?: string) => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

// ============================================
// VALUE FORMATTERS
// ============================================

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return '-';
  }

  switch (type) {
    case 'currency':
      return typeof value === 'number'
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
        : String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      if (typeof value === 'string') {
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return value;
        }
      }
      return String(value);
    case 'list':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'url':
      return typeof value === 'string' ? value : String(value);
    default:
      return String(value);
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DataField({
  field,
  data,
  onUpdate,
  isUpdating = false,
  className,
}: DataFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [showSource, setShowSource] = useState(false);

  const hasValue = data.value !== null && data.value !== undefined && data.value !== '';
  const hasSource = data.source !== null;
  const isVerified = data.verified;
  const confidence = (data as { confidence?: 'high' | 'medium' | 'low' }).confidence;

  // Get confidence display styling
  const getConfidenceStyle = (conf: 'high' | 'medium' | 'low' | undefined) => {
    switch (conf) {
      case 'high':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-red-600 bg-red-50';
      default:
        return '';
    }
  };

  // Start editing
  const handleStartEdit = useCallback(() => {
    if (!field.editable || !onUpdate) return;

    if (field.type === 'list' && Array.isArray(data.value)) {
      setEditValue(data.value.join(', '));
    } else if (field.type === 'boolean') {
      setEditValue(data.value ? 'true' : 'false');
    } else {
      setEditValue(data.value !== null ? String(data.value) : '');
    }
    setIsEditing(true);
  }, [field, data.value, onUpdate]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  // Save edit
  const handleSave = useCallback(async () => {
    if (!onUpdate) return;

    let newValue: unknown = editValue;

    // Parse value based on type
    switch (field.type) {
      case 'number':
      case 'currency':
        newValue = editValue === '' ? null : parseFloat(editValue.replace(/[,$]/g, ''));
        break;
      case 'boolean':
        newValue = editValue.toLowerCase() === 'true' || editValue === 'yes' || editValue === '1';
        break;
      case 'list':
        newValue = editValue.split(',').map((s) => s.trim()).filter(Boolean);
        break;
    }

    try {
      await onUpdate(newValue, 'manual', undefined, 'User edit');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update field:', err);
    }
  }, [editValue, field.type, onUpdate]);

  // Get source display name
  const getSourceDisplay = (source: string | null): string => {
    if (!source) return 'Unknown';
    const sourceNames: Record<string, string> = {
      website: 'Website',
      apollo: 'Apollo.io',
      google_places: 'Google Places',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      builtwith: 'BuiltWith',
      manual: 'Manual Entry',
    };
    return sourceNames[source] || source;
  };

  return (
    <div className={cn('group relative', className)}>
      {/* Label Row */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {field.label}
        </label>

        {/* Source and Confidence indicators */}
        <div className="flex items-center gap-2">
          {confidence && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium',
              getConfidenceStyle(confidence)
            )}>
              {confidence}
            </span>
          )}
          {hasSource && (
            <button
              onClick={() => setShowSource(!showSource)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              {isVerified ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-yellow-500" />
              )}
              <span>{getSourceDisplay(data.source)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Value Row */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            {field.type === 'boolean' ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded bg-white"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={field.placeholder}
                className="flex-1 px-2 py-1 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            )}

            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Display value */}
            <div className={cn(
              'flex-1 text-sm',
              hasValue ? 'text-gray-900' : 'text-gray-400 italic'
            )}>
              {field.type === 'url' && hasValue ? (
                <a
                  href={String(data.value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {formatValue(data.value, field.type)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                formatValue(data.value, field.type)
              )}
            </div>

            {/* Edit button */}
            {field.editable && onUpdate && (
              <button
                onClick={handleStartEdit}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Source Details Popover */}
      {showSource && hasSource && (
        <div className="absolute z-10 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs min-w-[200px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Link2 className="h-3 w-3" />
              <span className="font-medium">Source:</span>
              <span>{getSourceDisplay(data.source)}</span>
            </div>

            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Source
              </a>
            )}

            {data.lastChecked && (
              <div className="flex items-center gap-2 text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Last checked: {new Date(data.lastChecked).toLocaleDateString()}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {data.verified ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-3 w-3" />
                  Unverified
                </span>
              )}
            </div>

            {/* Confidence indicator in popover */}
            {confidence && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200 mt-2">
                <span className="text-gray-500">Confidence:</span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-medium capitalize',
                  getConfidenceStyle(confidence)
                )}>
                  {confidence}
                </span>
                {confidence === 'low' && (
                  <span className="text-xs text-gray-400">
                    (estimate may be inaccurate)
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSource(false)}
            className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// LIST FIELD VARIANT
// ============================================

interface ListDataFieldProps {
  field: FieldDefinition;
  data: SourcedField<string[]>;
  onUpdate?: (value: string[], source?: string) => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

export function ListDataField({
  field,
  data,
  onUpdate,
  isUpdating = false,
  className,
}: ListDataFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const items = data.value || [];
  const hasValue = items.length > 0;

  const handleStartEdit = () => {
    setEditValue(items.join(', '));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    const newItems = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await onUpdate(newItems, 'manual');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  };

  return (
    <div className={cn('group', className)}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {field.label}
        </label>
        {field.editable && onUpdate && !isEditing && (
          <button
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Enter items separated by commas"
            className="w-full px-2 py-1 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 min-h-[60px]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasValue ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-gray-400 italic">
          No items
        </span>
      )}
    </div>
  );
}

export default DataField;
