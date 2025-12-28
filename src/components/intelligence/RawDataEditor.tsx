'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Check,
  X,
  Pencil,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Database,
  Shield,
  Loader2,
  Globe,
  Building2,
  Users,
  DollarSign,
  MapPin,
  Award,
  Cpu,
  TrendingUp,
  Heart,
  Phone,
  Link2,
  Star,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type {
  RawIntelligenceData,
  SourcedField,
  FieldDefinition,
  FieldCategory,
  DataConfidence,
  LeadershipPerson,
  AwardEntry,
  TechStackEntry,
  AcquisitionEntry,
} from '@/lib/intelligence/types/rawIntelligence';
import {
  FIELD_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/lib/intelligence/types/rawIntelligence';

// ============================================
// TYPES
// ============================================

interface RawDataEditorProps {
  companyId: string;
  companyName: string;
  initialDomain?: string | null;
}

// ============================================
// CATEGORY ICONS
// ============================================

const CATEGORY_ICONS: Record<FieldCategory, React.ElementType> = {
  identity: Building2,
  founding: Clock,
  ownership: Shield,
  size: TrendingUp,
  headquarters: MapPin,
  leadership: Users,
  services: Star,
  online_presence: Globe,
  reputation: Star,
  awards: Award,
  technology: Cpu,
  mna: TrendingUp,
  growth: TrendingUp,
  culture: Heart,
  contact: Phone,
  associations: Link2,
};

// ============================================
// COLLAPSIBLE SECTION
// ============================================

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
  onVerifyAll,
  verifying = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  onVerifyAll?: () => void;
  verifying?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="text-gray-500">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {badge}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {onVerifyAll && (
          <button
            onClick={onVerifyAll}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            Verify All
          </button>
        )}
      </div>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// SINGLE FIELD COMPONENT
// ============================================

function RawField({
  fieldDef,
  data,
  onUpdate,
  onVerify,
  isUpdating = false,
}: {
  fieldDef: FieldDefinition;
  data: SourcedField<unknown> | undefined;
  onUpdate: (value: unknown) => Promise<void>;
  onVerify: () => Promise<void>;
  isUpdating?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showSource, setShowSource] = useState(false);

  const value = data?.value;
  const hasValue = value !== null && value !== undefined && value !== '';
  const isVerified = data?.verified ?? false;
  const confidence = data?.confidence ?? 'low';
  const source = data?.source;

  const confidenceColors: Record<DataConfidence, string> = {
    high: 'text-green-600 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    low: 'text-red-600 bg-red-50',
  };

  const formatDisplayValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-';
    if (Array.isArray(val)) {
      if (val.length === 0) return '-';
      if (typeof val[0] === 'object') return `${val.length} items`;
      return val.join(', ');
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  };

  const handleStartEdit = () => {
    if (!fieldDef.editable) return;
    if (fieldDef.type === 'array' && Array.isArray(value)) {
      setEditValue(value.join(', '));
    } else if (fieldDef.type === 'boolean') {
      setEditValue(value ? 'true' : 'false');
    } else {
      setEditValue(value !== null ? String(value) : '');
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    let newValue: unknown = editValue;

    switch (fieldDef.type) {
      case 'number':
        newValue = editValue === '' ? null : parseFloat(editValue.replace(/[,$]/g, ''));
        break;
      case 'boolean':
        newValue = editValue.toLowerCase() === 'true' || editValue === 'yes';
        break;
      case 'array':
        newValue = editValue.split(',').map(s => s.trim()).filter(Boolean);
        break;
    }

    try {
      await onUpdate(newValue);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update field:', err);
    }
  };

  const getSourceDisplay = (src: string | null): string => {
    if (!src) return 'Unknown';
    const sourceNames: Record<string, string> = {
      website: 'Website',
      apollo: 'Apollo.io',
      google_places: 'Google',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      serper: 'Search',
      user_edit: 'Manual',
      database: 'Database',
    };
    return sourceNames[src] || src;
  };

  return (
    <div className="group relative py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Label Row */}
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {fieldDef.label}
            </label>
            {fieldDef.important && (
              <span className="px-1 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                Key
              </span>
            )}
          </div>

          {/* Value */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              {fieldDef.type === 'boolean' ? (
                <select
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border rounded bg-white"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : fieldDef.type === 'select' ? (
                <select
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border rounded bg-white"
                >
                  <option value="">Select...</option>
                  {fieldDef.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={fieldDef.type === 'number' ? 'number' : 'text'}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder={fieldDef.placeholder}
                  className="flex-1 px-2 py-1 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              )}
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm',
                  hasValue
                    ? 'text-gray-900'
                    : 'text-gray-400 italic'
                )}
              >
                {formatDisplayValue(value)}
              </span>

              {/* Edit button */}
              {fieldDef.editable && (
                <button
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right side - Source, Confidence, Verify */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Confidence Badge */}
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium',
              confidenceColors[confidence]
            )}
          >
            {confidence}
          </span>

          {/* Source Button */}
          {source && (
            <button
              onClick={() => setShowSource(!showSource)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              {isVerified ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-yellow-500" />
              )}
              <span>{getSourceDisplay(source)}</span>
            </button>
          )}

          {/* Verify Button */}
          {!isVerified && hasValue && (
            <button
              onClick={onVerify}
              className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-all"
            >
              Verify
            </button>
          )}
        </div>
      </div>

      {/* Source Popover */}
      {showSource && source && (
        <div className="absolute right-0 z-10 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs min-w-[200px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Database className="h-3 w-3" />
              <span className="font-medium">Source:</span>
              <span>{getSourceDisplay(source)}</span>
            </div>

            {data?.sourceUrl && (
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

            {data?.collectedAt && (
              <div className="flex items-center gap-2 text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Collected: {formatRelativeTime(new Date(data.collectedAt))}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              {isVerified ? (
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
// LEADERSHIP SECTION
// ============================================

function LeadershipSection({
  people,
  onUpdate,
}: {
  people: LeadershipPerson[];
  onUpdate: (updated: LeadershipPerson[]) => Promise<void>;
}) {
  if (people.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400 italic">
        No leadership team data collected
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-3">
      {people.map((person, index) => (
        <div
          key={index}
          className="p-4 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {person.name}
                </span>
                {person.isOwner && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
                    Owner
                  </span>
                )}
                {person.isDecisionMaker && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                    DM
                  </span>
                )}
                {person.isFamily && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">
                    Family
                  </span>
                )}
              </div>
              {person.title && (
                <p className="text-xs text-gray-500">{person.title}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="hover:text-blue-600"
                  >
                    {person.email}
                  </a>
                )}
                {person.phone && <span>{person.phone}</span>}
                {person.linkedin && (
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center gap-1"
                  >
                    LinkedIn <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// AWARDS SECTION
// ============================================

function AwardsSection({ awards }: { awards: AwardEntry[] }) {
  if (awards.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400 italic">
        No awards data collected
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-2">
      {awards.map((award, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <Award className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-sm font-medium text-gray-900">
                {award.name}
              </span>
              {award.issuer && (
                <span className="text-xs text-gray-500 ml-2">
                  by {award.issuer}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {award.rank && <span>#{award.rank}</span>}
            {award.year && <span>{award.year}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// TECH STACK SECTION
// ============================================

function TechStackSection({ tech }: { tech: TechStackEntry[] }) {
  if (tech.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400 italic">
        No technology data collected
      </div>
    );
  }

  const categoryColors: Record<string, string> = {
    crm: 'bg-purple-100 text-purple-700',
    phone: 'bg-blue-100 text-blue-700',
    routing: 'bg-green-100 text-green-700',
    marketing: 'bg-pink-100 text-pink-700',
    scheduling: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="pt-4 flex flex-wrap gap-2">
      {tech.map((item, index) => (
        <div
          key={index}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium',
            categoryColors[item.category] || categoryColors.other
          )}
        >
          {item.name}
          <span className="ml-2 text-xs opacity-70">{item.category}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// COMPLETENESS BAR
// ============================================

function CompletenessBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600 tabular-nums">
        {score}%
      </span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RawDataEditor({ companyId, companyName, initialDomain }: RawDataEditorProps) {
  const [rawData, setRawData] = useState<RawIntelligenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState(initialDomain || '');
  const [isEditingDomain, setIsEditingDomain] = useState(false);

  // Fetch raw data
  const fetchRawData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v3/${companyId}/raw`);
      if (!res.ok) {
        throw new Error('Failed to fetch raw data');
      }

      const data = await res.json();
      if (data.exists) {
        setRawData(data.data);
      } else {
        setRawData(null);
      }
    } catch (err) {
      console.error('Error fetching raw data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Initial fetch
  useEffect(() => {
    fetchRawData();
  }, [fetchRawData]);

  // Collect data
  const handleCollect = async () => {
    try {
      setIsCollecting(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v3/${companyId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to collect data');
      }

      const data = await res.json();
      if (data.success) {
        setRawData(data.data);
      }
    } catch (err) {
      console.error('Error collecting data:', err);
      setError(err instanceof Error ? err.message : 'Collection failed');
    } finally {
      setIsCollecting(false);
    }
  };

  // Update a field
  const handleUpdateField = async (fieldName: string, newValue: unknown) => {
    try {
      setIsUpdating(true);

      const res = await fetch(`/api/intelligence-v3/${companyId}/raw`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName,
          newValue,
          reason: 'User edit',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update field');
      }

      // Refresh data
      await fetchRawData();
    } catch (err) {
      console.error('Error updating field:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  // Verify fields
  const handleVerifyAll = async (category?: FieldCategory) => {
    try {
      setIsVerifying(true);

      const fieldsToVerify = category
        ? FIELD_DEFINITIONS.filter(f => f.category === category).map(f => f.key)
        : 'all';

      const res = await fetch(`/api/intelligence-v3/${companyId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsToVerify }),
      });

      if (!res.ok) {
        throw new Error('Failed to verify fields');
      }

      // Refresh data
      await fetchRawData();
    } catch (err) {
      console.error('Error verifying fields:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Group fields by category
  const fieldsByCategory = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = FIELD_DEFINITIONS.filter(f => f.category === category);
    return acc;
  }, {} as Record<FieldCategory, FieldDefinition[]>);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading raw data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-normal text-gray-900">
            Raw Intelligence Data
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {rawData?.collected_at
              ? `Collected ${formatRelativeTime(new Date(rawData.collected_at))}`
              : 'No data collected yet'}
            {rawData?.collection_status && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 rounded">
                {rawData.collection_status}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Verify All */}
          {rawData && (
            <button
              onClick={() => handleVerifyAll()}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Verify All Data
            </button>
          )}

          {/* Collect Button */}
          <button
            onClick={handleCollect}
            disabled={isCollecting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border',
              isCollecting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isCollecting && 'animate-spin')} />
            {isCollecting ? 'Collecting...' : rawData ? 'Re-collect' : 'Collect Data'}
          </button>
        </div>
      </div>

      {/* Domain Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Globe className="h-4 w-4" />
            <span className="font-medium">Domain:</span>
          </div>

          {isEditingDomain || !domain ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
              {domain && (
                <button
                  onClick={() => setIsEditingDomain(false)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {domain}
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => setIsEditingDomain(true)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-500">
            ×
          </button>
        </div>
      )}

      {/* Data Completeness */}
      {rawData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Data Completeness
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {rawData.data_completeness >= 80
                ? 'Excellent'
                : rawData.data_completeness >= 50
                ? 'Good'
                : 'Needs Data'}
            </span>
          </div>
          <CompletenessBar score={rawData.data_completeness || 0} />
        </div>
      )}

      {/* Data Sections */}
      {rawData && (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(category => {
            const fields = fieldsByCategory[category];
            if (!fields || fields.length === 0) return null;

            // Skip object_array types for now (handled separately)
            const simpleFields = fields.filter(
              f => f.type !== 'object_array'
            );
            const objectArrayFields = fields.filter(
              f => f.type === 'object_array'
            );

            const Icon = CATEGORY_ICONS[category];

            return (
              <Section
                key={category}
                title={CATEGORY_LABELS[category]}
                icon={Icon}
                defaultOpen={category === 'identity' || category === 'ownership' || category === 'size'}
                onVerifyAll={() => handleVerifyAll(category)}
                verifying={isVerifying}
              >
                <div className="pt-2">
                  {/* Simple fields */}
                  {simpleFields.map(fieldDef => {
                    const fieldData = rawData[fieldDef.key] as SourcedField<unknown> | undefined;
                    return (
                      <RawField
                        key={fieldDef.key}
                        fieldDef={fieldDef}
                        data={fieldData}
                        onUpdate={value => handleUpdateField(fieldDef.key, value)}
                        onVerify={async () => {
                          await fetch(`/api/intelligence-v3/${companyId}/verify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: [fieldDef.key] }),
                          });
                          await fetchRawData();
                        }}
                        isUpdating={isUpdating}
                      />
                    );
                  })}

                  {/* Object array fields - special rendering */}
                  {objectArrayFields.map(fieldDef => {
                    const fieldData = rawData[fieldDef.key] as SourcedField<unknown> | undefined;
                    const arrayValue = fieldData?.value;

                    if (fieldDef.key === 'leadership_team') {
                      return (
                        <div key={fieldDef.key} className="mt-4">
                          <LeadershipSection
                            people={(arrayValue as LeadershipPerson[]) || []}
                            onUpdate={async updated => {
                              await handleUpdateField(fieldDef.key, updated);
                            }}
                          />
                        </div>
                      );
                    }

                    if (fieldDef.key === 'awards') {
                      return (
                        <div key={fieldDef.key} className="mt-4">
                          <AwardsSection awards={(arrayValue as AwardEntry[]) || []} />
                        </div>
                      );
                    }

                    if (fieldDef.key === 'tech_stack') {
                      return (
                        <div key={fieldDef.key} className="mt-4">
                          <TechStackSection tech={(arrayValue as TechStackEntry[]) || []} />
                        </div>
                      );
                    }

                    if (fieldDef.key === 'acquisitions_made') {
                      const acquisitions = (arrayValue as AcquisitionEntry[]) || [];
                      if (acquisitions.length === 0) return null;
                      return (
                        <div key={fieldDef.key} className="mt-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Acquisitions
                          </p>
                          <div className="space-y-2">
                            {acquisitions.map((acq, i) => (
                              <div
                                key={i}
                                className="p-3 bg-gray-50 rounded-lg text-sm"
                              >
                                <span className="font-medium">{acq.companyName}</span>
                                {acq.year && <span className="ml-2 text-gray-500">({acq.year})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </Section>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!rawData && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Database className="h-12 w-12 text-gray-300" />
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900">
              No Data Collected
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Start collecting raw intelligence data about {companyName}
            </p>
          </div>
          <button
            onClick={handleCollect}
            disabled={isCollecting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className={cn('h-4 w-4', isCollecting && 'animate-spin')} />
            {isCollecting ? 'Collecting...' : 'Collect Intelligence'}
          </button>
        </div>
      )}

      {/* Collection Notes */}
      {rawData?.collection_notes && rawData.collection_notes.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Collection Notes
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            {rawData.collection_notes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Collection Errors */}
      {rawData?.collection_errors && rawData.collection_errors.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">
            Collection Errors
          </h4>
          <ul className="text-xs text-red-700 space-y-1">
            {rawData.collection_errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default RawDataEditor;
