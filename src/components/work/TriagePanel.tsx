'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { cn } from '@/lib/utils';
import { Folder, Mail, Calendar, ChevronRight, X, Building2, Search, Loader2 } from 'lucide-react';
import { TriageItem } from '@/app/api/triage/route';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Clean up email body text by removing forwarding headers and metadata
 */
function cleanEmailBody(text: string | null): string {
  if (!text) return '';

  let cleaned = text;

  // Remove forwarding header blocks (underscores followed by From/Sent/To headers)
  // Using [\s\S] instead of . with s flag for cross-line matching
  cleaned = cleaned.replace(
    /_{10,}[\s\S]*?From:[\s\S]*?(?:Sent|Date):[\s\S]*?To:[\s\S]*?(?:Subject|Cc):[^\n]*\n/gi,
    '\n---\n'
  );

  // Remove standalone header blocks at the start
  cleaned = cleaned.replace(
    /^From:[^\n]*\n(?:Sent|Date):[^\n]*\n(?:To:[^\n]*\n)?(?:Cc:[^\n]*\n)?(?:Subject:[^\n]*\n)?/gim,
    ''
  );

  // Remove email signature delimiters and common signatures
  cleaned = cleaned.replace(/\n--\s*\n[\s\S]*$/g, '');

  // Remove excessive underscores (often used as dividers)
  cleaned = cleaned.replace(/_{5,}/g, '---');

  // Remove excessive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get icon for message type
 */
function getMessageTypeIcon(type: string) {
  switch (type) {
    case 'meeting':
      return Calendar;
    default:
      return Mail;
  }
}

interface Company {
  id: string;
  name: string;
  domain?: string;
}

interface TriagePanelProps {
  className?: string;
  onItemSelect?: (item: TriageItem) => void;
}

/**
 * TriagePanel - Right sidebar for unassigned communications
 *
 * Shows communications without company_id for triage.
 * Users can view, ignore, or assign items to companies.
 */
export function TriagePanel({ className, onItemSelect }: TriagePanelProps) {
  const { data, error, isLoading } = useSWR<{ items: TriageItem[]; count: number }>(
    '/api/triage',
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<TriageItem | null>(null);
  const [viewingDetails, setViewingDetails] = useState<{
    body_text: string | null;
    occurred_at: string;
    channel: string;
    direction: string;
    subject: string;
    their_participants: Array<{ email?: string; name?: string }>;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [assigningItem, setAssigningItem] = useState<TriageItem | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  // Search companies when typing
  useEffect(() => {
    if (!companySearch.trim() || companySearch.length < 2) {
      setCompanies([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const res = await fetch(`/api/companies?search=${encodeURIComponent(companySearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || data || []);
        }
      } catch (err) {
        console.error('[TriagePanel] Error searching companies:', err);
      } finally {
        setSearchingCompanies(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [companySearch]);

  const handleIgnore = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communicationId: id, action: 'ignore' }),
      });

      if (res.ok) {
        // Refresh the list
        mutate('/api/triage');
      }
    } catch (err) {
      console.error('[TriagePanel] Error ignoring item:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAssign = async (communicationId: string, companyId: string) => {
    setProcessingId(communicationId);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communicationId, companyId, action: 'assign' }),
      });

      if (res.ok) {
        // Refresh the list and close modal
        mutate('/api/triage');
        setAssigningItem(null);
        setCompanySearch('');
        setCompanies([]);
      }
    } catch (err) {
      console.error('[TriagePanel] Error assigning item:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleView = async (item: TriageItem) => {
    if (onItemSelect) {
      onItemSelect(item);
      return;
    }

    // Fetch full communication details
    setViewingItem(item);
    setLoadingDetails(true);
    setViewingDetails(null);

    try {
      const res = await fetch(`/api/communications?id=${item.id}`);
      if (res.ok) {
        const data = await res.json();
        // API returns { communications: [...] }
        const comm = data.communications?.[0] || data.data?.[0] || data[0];
        if (comm) {
          setViewingDetails({
            // Try full_content first (full email body), then body_text, then content_preview
            body_text: comm.full_content || comm.body_text || comm.content_preview || null,
            occurred_at: comm.occurred_at,
            channel: comm.channel || 'email',
            direction: comm.direction || 'inbound',
            subject: comm.subject || '(No Subject)',
            their_participants: comm.their_participants || [],
          });
        }
      }
    } catch (err) {
      console.error('[TriagePanel] Error fetching communication:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const items = data?.items || [];
  const count = data?.count || 0;

  return (
    <div className={cn('h-full flex flex-col bg-white', className)}>
      {/* Header */}
      <div className="shrink-0 p-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Folder className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Triage</h3>
              <p className="text-xs text-gray-500">Unassigned communications</p>
            </div>
          </div>
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
            {count}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-gray-50 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-red-500">
            Failed to load triage items
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <Folder className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">All caught up!</p>
            <p className="text-xs text-gray-500 mt-1">No unassigned communications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <TriageItemCard
                key={item.id}
                item={item}
                isProcessing={processingId === item.id}
                onIgnore={() => handleIgnore(item.id)}
                onView={() => handleView(item)}
                onAssign={() => setAssigningItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
        Clear triage items daily to keep your CRM data complete
      </div>

      {/* View Modal - Full Communication */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex items-start justify-between shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded',
                    viewingDetails?.direction === 'outbound'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  )}>
                    {viewingDetails?.direction === 'outbound' ? 'Sent' : 'Received'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {viewingDetails?.channel || 'email'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  {viewingDetails?.subject || viewingItem.subject}
                </h3>
              </div>
              <button
                onClick={() => {
                  setViewingItem(null);
                  setViewingDetails(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Sender Info */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {(viewingItem.sender_name || viewingItem.sender_email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {viewingItem.sender_name || viewingItem.sender_email}
                    </p>
                    {viewingItem.sender_name && (
                      <p className="text-xs text-gray-500">{viewingItem.sender_email}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {viewingDetails
                    ? new Date(viewingDetails.occurred_at).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : new Date(viewingItem.received_at).toLocaleString()
                  }
                </p>
              </div>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : viewingDetails?.body_text ? (
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                >
                  {cleanEmailBody(viewingDetails.body_text)}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {viewingItem.body_preview || 'No content available'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 flex gap-3 shrink-0 bg-gray-50">
              <button
                onClick={() => {
                  const item = viewingItem;
                  setViewingItem(null);
                  setViewingDetails(null);
                  setAssigningItem(item);
                }}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Building2 className="w-4 h-4 inline-block mr-2" />
                Assign to Company
              </button>
              <button
                onClick={() => {
                  handleIgnore(viewingItem.id);
                  setViewingItem(null);
                  setViewingDetails(null);
                }}
                className="py-2.5 px-4 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4 inline-block mr-2" />
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Assign to Company</h3>
              <button
                onClick={() => {
                  setAssigningItem(null);
                  setCompanySearch('');
                  setCompanies([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                Assign &quot;{assigningItem.subject}&quot; to:
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {searchingCompanies && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
              {companies.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleAssign(assigningItem.id, company.id)}
                      disabled={processingId === assigningItem.id}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-900">{company.name}</span>
                      {company.domain && (
                        <span className="text-gray-500 ml-2">{company.domain}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {companySearch.length >= 2 && companies.length === 0 && !searchingCompanies && (
                <p className="mt-2 text-sm text-gray-500 text-center py-4">
                  No companies found matching &quot;{companySearch}&quot;
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TriageItemCardProps {
  item: TriageItem;
  isProcessing: boolean;
  onIgnore: () => void;
  onView: () => void;
  onAssign: () => void;
}

function TriageItemCard({ item, isProcessing, onIgnore, onView, onAssign }: TriageItemCardProps) {
  const Icon = getMessageTypeIcon(item.message_type);

  return (
    <div
      className={cn(
        'p-3 rounded-lg border bg-white border-gray-200',
        'transition-all duration-200',
        isProcessing && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 truncate max-w-[200px]">
            {item.sender_name || item.sender_email}
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {formatRelativeTime(item.received_at)}
        </span>
      </div>

      {/* Subject */}
      <p className="text-sm font-medium text-gray-900 truncate mb-1">
        {item.subject}
      </p>

      {/* Preview */}
      {item.body_preview && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
          {item.body_preview}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={onView}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
          View
        </button>
        <button
          onClick={onIgnore}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-3 h-3" />
          Ignore
        </button>
        <button
          onClick={onAssign}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors"
        >
          <Building2 className="w-3 h-3" />
          Assign
        </button>
      </div>
    </div>
  );
}

export default TriagePanel;
