'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Mail,
  X,
  Loader2,
  Send,
  Zap,
  Eye,
  CalendarClock,
} from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import {
  DailyDriverItem,
  DailyDriverResponse,
  AttentionFlagSeverity,
  AttentionFlagType,
  AttentionLevel,
  ATTENTION_FLAG_TYPES,
  SEVERITY_LEVELS,
  ATTENTION_LEVELS,
} from '@/types/operatingLayer';

// ============================================
// DRAFT MODAL TYPES
// ============================================

interface DraftData {
  subject: string;
  body: string;
  channel: 'email' | 'sms';
  context: {
    company_name: string;
    contact_name: string | null;
    contact_email: string | null;
    product_name: string | null;
    stage_name: string | null;
    flag_type: AttentionFlagType;
    reason: string;
  };
}

interface DraftModalState {
  isOpen: boolean;
  isLoading: boolean;
  data: DraftData | null;
  error: string | null;
  flagId: string | null;
}

// ============================================
// TYPES
// ============================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  items: DailyDriverItem[];
  emptyMessage: string;
  renderItem: (item: DailyDriverItem) => React.ReactNode;
  headerColor: string;
  count: number;
}

// ============================================
// HELPERS
// ============================================

function getSeverityStyles(severity: AttentionFlagSeverity | null): string {
  const info = SEVERITY_LEVELS.find((s) => s.level === severity);
  return info ? `${info.bgColor} ${info.color}` : 'bg-gray-100 text-gray-700';
}

function getFlagTypeLabel(type: AttentionFlagType | null): string {
  if (!type) return '';
  const info = ATTENTION_FLAG_TYPES.find((t) => t.type === type);
  return info?.label || type.replace(/_/g, ' ');
}

function computeSnoozeTimestamps() {
  const now = new Date();

  // 1 hour from now
  const oneHour = new Date(now.getTime() + 60 * 60 * 1000);

  // 4 hours from now
  const fourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  // Tomorrow 9am
  const tomorrow9am = new Date(now);
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  return {
    oneHour: oneHour.toISOString(),
    fourHours: fourHours.toISOString(),
    tomorrow9am: tomorrow9am.toISOString(),
  };
}

// ============================================
// SNOOZE DROPDOWN
// ============================================

interface SnoozeDropdownProps {
  flagId: string;
  onSnooze: (flagId: string, until: string) => Promise<void>;
  disabled?: boolean;
}

function SnoozeDropdown({ flagId, onSnooze, disabled }: SnoozeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const timestamps = computeSnoozeTimestamps();

  const handleSnooze = async (until: string) => {
    setIsLoading(true);
    try {
      await onSnooze(flagId, until);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
          'bg-gray-100 text-gray-700 hover:bg-gray-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        <Clock className="h-3 w-3" />
        Snooze
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={() => handleSnooze(timestamps.oneHour)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              1 hour
            </button>
            <button
              onClick={() => handleSnooze(timestamps.fourHours)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              4 hours
            </button>
            <button
              onClick={() => handleSnooze(timestamps.tomorrow9am)}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Tomorrow 9am
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// DRAFT FOLLOW-UP MODAL
// ============================================

interface DraftModalProps {
  state: DraftModalState;
  onClose: () => void;
  onMarkSent: (flagId: string, data: { channel: string; to: string; subject: string; body: string; next_step_days: number }) => Promise<void>;
  onResolve: (flagId: string) => Promise<void>;
  onSendEmail: (flagId: string, data: { to: string; subject: string; body: string }) => Promise<void>;
}

function DraftModal({ state, onClose, onMarkSent, onResolve, onSendEmail }: DraftModalProps) {
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | 'all' | null>(null);
  const [actionLoading, setActionLoading] = useState<'markSent' | 'resolve' | 'send' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Editable fields
  const [editedTo, setEditedTo] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const initializedRef = useRef(false);

  // Initialize editable fields when draft data loads
  useEffect(() => {
    if (state.data && !initializedRef.current) {
      setEditedTo(state.data.context.contact_email || '');
      setEditedSubject(state.data.subject);
      setEditedBody(state.data.body);
      initializedRef.current = true;
    }
    // Reset when modal closes
    if (!state.isOpen) {
      initializedRef.current = false;
      setEditedTo('');
      setEditedSubject('');
      setEditedBody('');
      setActionError(null);
    }
  }, [state.data, state.isOpen]);

  const handleSendEmail = async () => {
    if (!state.flagId || !editedTo || !editedSubject || !editedBody) return;
    setActionLoading('send');
    setActionError(null);
    try {
      await onSendEmail(state.flagId, {
        to: editedTo,
        subject: editedSubject,
        body: editedBody,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkSent = async () => {
    if (!state.flagId || !editedTo) return;
    setActionLoading('markSent');
    setActionError(null);
    try {
      await onMarkSent(state.flagId, {
        channel: 'email',
        to: editedTo,
        subject: editedSubject,
        body: editedBody,
        next_step_days: 3,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as sent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveOnly = async () => {
    if (!state.flagId) return;
    setActionLoading('resolve');
    setActionError(null);
    try {
      await onResolve(state.flagId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = async (field: 'subject' | 'body' | 'all') => {
    let textToCopy = '';
    if (field === 'subject') {
      textToCopy = editedSubject;
    } else if (field === 'body') {
      textToCopy = editedBody;
    } else {
      textToCopy = `Subject: ${editedSubject}\n\n${editedBody}`;
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const canSend = editedTo && editedTo.includes('@') && editedSubject && editedBody;

  if (!state.isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Draft Follow-up
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {state.isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Generating draft...</p>
              </div>
            )}

            {state.error && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-sm text-red-600">{state.error}</p>
              </div>
            )}

            {state.data && !state.isLoading && (
              <div className="space-y-4">
                {/* Context Info */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {state.data.context.company_name}
                  </span>
                  {state.data.context.contact_name && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {state.data.context.contact_name}
                    </span>
                  )}
                  {state.data.context.stage_name && (
                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {state.data.context.stage_name}
                    </span>
                  )}
                </div>

                {/* To Field */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    To
                  </label>
                  <input
                    type="email"
                    value={editedTo}
                    onChange={(e) => setEditedTo(e.target.value)}
                    placeholder="recipient@company.com"
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                  {!editedTo && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      No contact email on file. Enter recipient email to send.
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </label>
                    <button
                      onClick={() => handleCopy('subject')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                        copiedField === 'subject'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        'transition-colors'
                      )}
                    >
                      {copiedField === 'subject' ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Body
                    </label>
                    <button
                      onClick={() => handleCopy('body')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                        copiedField === 'body'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        'transition-colors'
                      )}
                    >
                      {copiedField === 'body' ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={8}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border resize-none',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {state.data && !state.isLoading && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2a2a2a] space-y-3">
              {/* Error display */}
              {actionError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Copy All */}
                  <button
                    onClick={() => handleCopy('all')}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                      copiedField === 'all'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      'transition-colors'
                    )}
                  >
                    {copiedField === 'all' ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy All
                      </>
                    )}
                  </button>

                  {/* Mark Sent (for manual send outside CRM) */}
                  <button
                    onClick={handleMarkSent}
                    disabled={actionLoading !== null}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                      'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      'dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-colors'
                    )}
                  >
                    {actionLoading === 'markSent' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Sent
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Resolve without scheduling */}
                  <button
                    onClick={handleResolveOnly}
                    disabled={actionLoading !== null}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                      'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
                      'dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-colors'
                    )}
                  >
                    {actionLoading === 'resolve' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Resolve Only'
                    )}
                  </button>

                  {/* Send Email (primary) */}
                  <button
                    onClick={handleSendEmail}
                    disabled={actionLoading !== null || !canSend}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                      'bg-blue-600 text-white hover:bg-blue-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-colors'
                    )}
                  >
                    {actionLoading === 'send' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// SECTION COMPONENT
// ============================================

function Section({
  title,
  icon,
  items,
  emptyMessage,
  renderItem,
  headerColor,
  count,
}: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-gray-50 transition-colors',
          headerColor
        )}
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-gray-900 text-white">
            {count}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ATTENTION LEVEL SECTION
// ============================================

interface AttentionLevelSectionProps {
  level: AttentionLevel;
  items: DailyDriverItem[];
  renderItem: (item: DailyDriverItem) => React.ReactNode;
  defaultExpanded?: boolean;
}

function AttentionLevelSection({
  level,
  items,
  renderItem,
  defaultExpanded = true,
}: AttentionLevelSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const levelInfo = ATTENTION_LEVELS.find((l) => l.level === level);
  if (!levelInfo) return null;

  // Icons for each level
  const levelIcons: Record<AttentionLevel, React.ReactNode> = {
    now: <Zap className="h-5 w-5 text-red-500" />,
    soon: <CalendarClock className="h-5 w-5 text-amber-500" />,
    monitor: <Eye className="h-5 w-5 text-gray-400" />,
  };

  // Background colors for header
  const headerBgColors: Record<AttentionLevel, string> = {
    now: 'bg-red-50 border-l-4 border-l-red-500',
    soon: 'bg-amber-50 border-l-4 border-l-amber-500',
    monitor: 'bg-gray-50 border-l-4 border-l-gray-300',
  };

  // Count badge colors
  const countBadgeColors: Record<AttentionLevel, string> = {
    now: 'bg-red-600 text-white',
    soon: 'bg-amber-600 text-white',
    monitor: 'bg-gray-500 text-white',
  };

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 overflow-hidden',
      level === 'monitor' && !isExpanded && 'opacity-75'
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-opacity-80 transition-colors',
          headerBgColors[level]
        )}
      >
        <div className="flex items-center gap-3">
          {levelIcons[level]}
          <h2 className={cn(
            'text-sm font-semibold',
            level === 'now' ? 'text-red-900' :
            level === 'soon' ? 'text-amber-900' :
            'text-gray-700'
          )}>
            {levelInfo.label}
          </h2>
          <span className={cn(
            'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full',
            countBadgeColors[level]
          )}>
            {items.length}
          </span>
          <span className={cn(
            'text-xs',
            level === 'now' ? 'text-red-600' :
            level === 'soon' ? 'text-amber-600' :
            'text-gray-500'
          )}>
            {levelInfo.description}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            level === 'now' ? 'text-red-500' :
            level === 'soon' ? 'text-amber-500' :
            'text-gray-400',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No items at this level
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={cn(
                'px-4 py-3',
                level === 'now' ? 'hover:bg-red-50/50' :
                level === 'soon' ? 'hover:bg-amber-50/50' :
                'hover:bg-gray-50'
              )}>
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DailyDriverView() {
  const toast = useToast();
  const [data, setData] = useState<DailyDriverResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, 'loading' | 'success' | 'error'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draftModal, setDraftModal] = useState<DraftModalState>({
    isOpen: false,
    isLoading: false,
    data: null,
    error: null,
    flagId: null,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/daily-driver');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resolve handler
  const handleResolve = async (flagId: string) => {
    setActionStates((prev) => ({ ...prev, [flagId]: 'loading' }));
    try {
      const res = await fetch(`/api/attention-flags/${flagId}/resolve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to resolve');
      setActionStates((prev) => ({ ...prev, [flagId]: 'success' }));
      // Refresh data after short delay
      setTimeout(() => fetchData(), 500);
    } catch {
      setActionStates((prev) => ({ ...prev, [flagId]: 'error' }));
    }
  };

  // Snooze handler
  const handleSnooze = async (flagId: string, until: string) => {
    setActionStates((prev) => ({ ...prev, [flagId]: 'loading' }));
    try {
      const res = await fetch(`/api/attention-flags/${flagId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snooze_until: until }),
      });
      if (!res.ok) throw new Error('Failed to snooze');
      setActionStates((prev) => ({ ...prev, [flagId]: 'success' }));
      setTimeout(() => fetchData(), 500);
    } catch {
      setActionStates((prev) => ({ ...prev, [flagId]: 'error' }));
    }
  };

  // Draft follow-up handler
  const handleDraftFollowUp = async (flagId: string) => {
    setDraftModal({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null,
      flagId,
    });

    try {
      const res = await fetch(`/api/attention-flags/${flagId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to generate draft');
      }

      setDraftModal((prev) => ({
        ...prev,
        isLoading: false,
        data: {
          subject: json.draft.subject,
          body: json.draft.body,
          channel: json.draft.channel,
          context: json.context,
        },
      }));
    } catch (err) {
      setDraftModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to generate draft',
      }));
    }
  };

  // Close draft modal
  const closeDraftModal = () => {
    setDraftModal({
      isOpen: false,
      isLoading: false,
      data: null,
      error: null,
      flagId: null,
    });
  };

  // Mark sent + resolve handler (for modal)
  const handleMarkSent = async (
    flagId: string,
    data: { channel: string; to: string; subject: string; body: string; next_step_days: number }
  ) => {
    const res = await fetch(`/api/attention-flags/${flagId}/mark-sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to mark as sent');
    }

    // Success - close modal, refresh list, show toast
    closeDraftModal();
    toast.success('Resolved and next step set for 3 days');
    fetchData();
  };

  // Resolve handler for modal (with toast and refresh)
  const handleResolveFromModal = async (flagId: string) => {
    const res = await fetch(`/api/attention-flags/${flagId}/resolve`, {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error('Failed to resolve');
    }

    // Success - close modal, refresh list, show toast
    closeDraftModal();
    toast.success('Flag resolved');
    fetchData();
  };

  // Send email handler for modal (sends via Microsoft Graph)
  const handleSendEmailFromModal = async (
    flagId: string,
    data: { to: string; subject: string; body: string }
  ) => {
    const res = await fetch(`/api/attention-flags/${flagId}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const responseData = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(responseData.error || 'Failed to send email');
    }

    // Success - close modal, refresh list, show toast
    closeDraftModal();
    toast.success('Email sent and flag resolved');
    fetchData();
  };

  // Copy close message
  const handleCopyCloseMessage = (item: DailyDriverItem) => {
    const message = `Ready to close: ${item.company_name}${item.product_name ? ` - ${item.product_name}` : ''}

Close Confidence: ${item.close_confidence || 'N/A'}%
Estimated MRR: ${formatCurrency(item.mrr_estimate || 0)}

Next Steps:
- Confirm final terms
- Send contract for signature
- Schedule onboarding kickoff`;

    navigator.clipboard.writeText(message);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Render attention flag row (for needsHuman and stalled)
  const renderFlagRow = (item: DailyDriverItem) => {
    const flagId = item.attention_flag_id;
    const actionState = flagId ? actionStates[flagId] : undefined;
    const isActionLoading = actionState === 'loading';

    return (
      <div className="flex items-start gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Company + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/companies/${item.company_id}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
            >
              {item.company_name}
            </Link>

            {item.product_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {item.product_name}
              </span>
            )}

            {item.stage_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                {item.stage_name}
              </span>
            )}

            {item.severity && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full uppercase',
                  getSeverityStyles(item.severity)
                )}
              >
                {item.severity}
              </span>
            )}

            {item.flag_type && (
              <span className="text-xs text-gray-500">
                {getFlagTypeLabel(item.flag_type)}
              </span>
            )}
          </div>

          {/* Reason + recommended action */}
          <div className="mt-1 space-y-0.5">
            {item.reason && (
              <p className="text-sm text-gray-600 line-clamp-1">{item.reason}</p>
            )}
            {item.recommended_action && (
              <p className="text-xs text-gray-500 line-clamp-1">
                <span className="font-medium">Action:</span> {item.recommended_action}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <p className="mt-1 text-xs text-gray-400">
            Created {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {flagId && (
            <>
              <button
                onClick={() => handleResolve(flagId)}
                disabled={isActionLoading}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                  'bg-green-100 text-green-700 hover:bg-green-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                Resolve
              </button>

              <SnoozeDropdown
                flagId={flagId}
                onSnooze={handleSnooze}
                disabled={isActionLoading}
              />
            </>
          )}

          <Link
            href={`/companies/${item.company_id}`}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'transition-colors'
            )}
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </Link>
        </div>
      </div>
    );
  };

  // Render stalled flag row (with Draft Follow-up button)
  const renderStalledRow = (item: DailyDriverItem) => {
    const flagId = item.attention_flag_id;
    const actionState = flagId ? actionStates[flagId] : undefined;
    const isActionLoading = actionState === 'loading';
    const isDraftLoading = draftModal.isLoading && draftModal.flagId === flagId;

    return (
      <div className="flex items-start gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Company + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/companies/${item.company_id}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
            >
              {item.company_name}
            </Link>

            {item.product_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {item.product_name}
              </span>
            )}

            {item.stage_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                {item.stage_name}
              </span>
            )}

            {item.severity && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full uppercase',
                  getSeverityStyles(item.severity)
                )}
              >
                {item.severity}
              </span>
            )}

            {item.flag_type && (
              <span className="text-xs text-gray-500">
                {getFlagTypeLabel(item.flag_type)}
              </span>
            )}
          </div>

          {/* Reason + recommended action */}
          <div className="mt-1 space-y-0.5">
            {item.reason && (
              <p className="text-sm text-gray-600 line-clamp-1">{item.reason}</p>
            )}
            {item.recommended_action && (
              <p className="text-xs text-gray-500 line-clamp-1">
                <span className="font-medium">Action:</span> {item.recommended_action}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <p className="mt-1 text-xs text-gray-400">
            Created {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {flagId && (
            <>
              {/* Draft Follow-up button */}
              <button
                onClick={() => handleDraftFollowUp(flagId)}
                disabled={isActionLoading || isDraftLoading}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                  'bg-blue-100 text-blue-700 hover:bg-blue-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {isDraftLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Mail className="h-3 w-3" />
                )}
                Draft Follow-up
              </button>

              <button
                onClick={() => handleResolve(flagId)}
                disabled={isActionLoading}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                  'bg-green-100 text-green-700 hover:bg-green-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                Resolve
              </button>

              <SnoozeDropdown
                flagId={flagId}
                onSnooze={handleSnooze}
                disabled={isActionLoading}
              />
            </>
          )}

          <Link
            href={`/companies/${item.company_id}`}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'transition-colors'
            )}
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </Link>
        </div>
      </div>
    );
  };

  // Render ready to close row
  const renderCloseRow = (item: DailyDriverItem) => {
    const isCopied = copiedId === item.id;

    return (
      <div className="flex items-start gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Company + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/companies/${item.company_id}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
            >
              {item.company_name}
            </Link>

            {item.product_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {item.product_name}
              </span>
            )}

            {item.stage_name && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                {item.stage_name}
              </span>
            )}
          </div>

          {/* Close confidence + MRR */}
          <div className="mt-1 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Confidence:</span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  (item.close_confidence || 0) >= 90
                    ? 'text-green-600'
                    : (item.close_confidence || 0) >= 75
                    ? 'text-yellow-600'
                    : 'text-gray-600'
                )}
              >
                {item.close_confidence || 0}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">MRR:</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(item.mrr_estimate || 0)}
              </span>
            </div>

            {item.close_ready && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                Ready
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleCopyCloseMessage(item)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              isCopied
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'transition-colors'
            )}
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy close message
              </>
            )}
          </button>

          <Link
            href={`/companies/${item.company_id}`}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'transition-colors'
            )}
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </Link>
        </div>
      </div>
    );
  };

  // Unified item renderer - determines which style to use based on item type
  const renderUnifiedItem = (item: DailyDriverItem) => {
    // Check if it's a ready-to-close item (has close_confidence or close_ready, no flag)
    if (!item.attention_flag_id && (item.close_confidence !== null || item.close_ready)) {
      return renderCloseRow(item);
    }

    // Check if it's a stalled flag (use stalled row with Draft Follow-up)
    if (
      item.flag_type === 'STALE_IN_STAGE' ||
      item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING' ||
      item.flag_type === 'GHOSTING_AFTER_PROPOSAL'
    ) {
      return renderStalledRow(item);
    }

    // Default to flag row (for needs human attention items)
    return renderFlagRow(item);
  };

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 h-32 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Daily Driver</h1>
          <p className="text-xs text-gray-500">
            {data.counts.total} items requiring attention
            <span className="mx-2">•</span>
            <span className="text-red-600 font-medium">{data.counts.now} now</span>
            <span className="mx-1.5">·</span>
            <span className="text-amber-600">{data.counts.soon} soon</span>
            <span className="mx-1.5">·</span>
            <span className="text-gray-400">{data.counts.monitor} monitor</span>
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg',
            'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
            'disabled:opacity-50',
            'transition-colors'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Action Now - Items needing immediate attention */}
      <AttentionLevelSection
        level="now"
        items={data.byAttentionLevel.now}
        renderItem={renderUnifiedItem}
        defaultExpanded={true}
      />

      {/* This Week - Items to handle soon */}
      <AttentionLevelSection
        level="soon"
        items={data.byAttentionLevel.soon}
        renderItem={renderUnifiedItem}
        defaultExpanded={true}
      />

      {/* Monitor - Informational items */}
      <AttentionLevelSection
        level="monitor"
        items={data.byAttentionLevel.monitor}
        renderItem={renderUnifiedItem}
        defaultExpanded={false}
      />

      {/* Draft Follow-up Modal */}
      <DraftModal
        state={draftModal}
        onClose={closeDraftModal}
        onMarkSent={handleMarkSent}
        onResolve={handleResolveFromModal}
        onSendEmail={handleSendEmailFromModal}
      />
    </div>
  );
}
