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
  MessageSquareReply,
  Reply,
  FileText,
  Video,
  UserX,
  MoreHorizontal,
  Building2,
  Calendar,
  Package,
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
import { TranscriptPreviewModal } from '@/components/commandCenter/TranscriptPreviewModal';
import { ComposeModal } from '@/components/inbox/ComposeModal';
import { CommunicationPreviewModal } from './CommunicationPreviewModal';
import { AssignCompanyModal } from './AssignCompanyModal';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { ManageProductsModal } from './ManageProductsModal';

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
    product_name?: string | null;
    stage_name?: string | null;
    flag_type?: AttentionFlagType;
    reason?: string;
    original_subject?: string | null;
    original_preview?: string | null;
  };
}

interface DraftModalState {
  isOpen: boolean;
  isLoading: boolean;
  data: DraftData | null;
  error: string | null;
  flagId: string | null;
  communicationId: string | null; // For communication draft replies
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
// ACTION DROPDOWN
// ============================================

interface ActionDropdownProps {
  item: DailyDriverItem;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAssignCompany: () => void;
  onScheduleMeeting: () => void;
  onManageProducts: () => void;
}

function ActionDropdown({
  item,
  isOpen,
  onToggle,
  onClose,
  onAssignCompany,
  onScheduleMeeting,
  onManageProducts,
}: ActionDropdownProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded',
          'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
          'transition-colors',
          isOpen && 'bg-gray-100 text-gray-600'
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={onClose}
          />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={() => {
                onAssignCompany();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Building2 className="h-4 w-4 text-gray-400" />
              {item.company_id ? 'Change Company' : 'Assign Company'}
            </button>
            <button
              onClick={() => {
                onScheduleMeeting();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Calendar className="h-4 w-4 text-gray-400" />
              Schedule Meeting
            </button>
            <button
              onClick={() => {
                onManageProducts();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <Package className="h-4 w-4 text-gray-400" />
              Manage Products
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
  onMarkCommunicationResponded?: (communicationId: string) => Promise<void>;
}

function DraftModal({ state, onClose, onMarkSent, onResolve, onSendEmail, onMarkCommunicationResponded }: DraftModalProps) {
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | 'all' | null>(null);
  const [actionLoading, setActionLoading] = useState<'markSent' | 'resolve' | 'send' | 'markResponded' | null>(null);

  // Determine if this is a communication draft (no flagId, has communicationId)
  const isCommunicationDraft = !state.flagId && !!state.communicationId;
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
    if (!editedTo || !editedSubject || !editedBody) return;
    // For communication drafts, flagId is null - pass empty string to trigger special handling
    if (!state.flagId && !state.communicationId) return;
    setActionLoading('send');
    setActionError(null);
    try {
      await onSendEmail(state.flagId || '', {
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

  // For communication drafts: mark as responded without sending
  const handleMarkResponded = async () => {
    if (!state.communicationId || !onMarkCommunicationResponded) return;
    setActionLoading('markResponded');
    setActionError(null);
    try {
      await onMarkCommunicationResponded(state.communicationId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as responded');
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
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">
                Draft Follow-up
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
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
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {state.data.context.company_name}
                  </span>
                  {state.data.context.contact_name && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {state.data.context.contact_name}
                    </span>
                  )}
                  {state.data.context.stage_name && (
                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700">
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
                      'bg-white',
                      'border-gray-200',
                      'text-gray-900',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                  {!editedTo && (
                    <p className="mt-1 text-xs text-amber-600">
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
                      'bg-white',
                      'border-gray-200',
                      'text-gray-900',
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
                      'bg-white',
                      'border-gray-200',
                      'text-gray-900',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {state.data && !state.isLoading && (
            <div className="px-6 py-4 border-t border-gray-200 space-y-3">
              {/* Error display */}
              {actionError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600">{actionError}</p>
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

                  {/* Mark Sent (for flags - manual send outside CRM) */}
                  {!isCommunicationDraft && (
                    <button
                      onClick={handleMarkSent}
                      disabled={actionLoading !== null}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                        'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        '',
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
                  )}

                  {/* Mark Responded (for communication drafts - mark as done without sending) */}
                  {isCommunicationDraft && (
                    <button
                      onClick={handleMarkResponded}
                      disabled={actionLoading !== null}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                        'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        '',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                      )}
                    >
                      {actionLoading === 'markResponded' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Done
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Resolve without scheduling (for flags only) */}
                  {!isCommunicationDraft && (
                    <button
                      onClick={handleResolveOnly}
                      disabled={actionLoading !== null}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                        'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
                        '',
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
                  )}

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
    communicationId: null,
  });

  // Source preview modal state (for viewing the triggering email/transcript)
  const [sourcePreview, setSourcePreview] = useState<{
    isOpen: boolean;
    type: 'email' | 'transcript' | null;
    id: string | null;
  }>({
    isOpen: false,
    type: null,
    id: null,
  });

  // Compose modal state (for Reply button)
  const [composeModal, setComposeModal] = useState<{
    isOpen: boolean;
    toEmail?: string;
    toName?: string;
    subject?: string;
    contactId?: string;
    companyId?: string;
  }>({
    isOpen: false,
  });

  // Action modals state
  const [assignCompanyModal, setAssignCompanyModal] = useState<{
    isOpen: boolean;
    currentCompanyId: string | null;
    currentCompanyName: string | null;
    communicationId?: string;
  }>({
    isOpen: false,
    currentCompanyId: null,
    currentCompanyName: null,
  });

  const [scheduleMeetingModal, setScheduleMeetingModal] = useState<{
    isOpen: boolean;
    companyId: string;
    companyName: string;
    contactName?: string | null;
    contactEmail?: string | null;
    sourceCommunicationId?: string | null;
  }>({
    isOpen: false,
    companyId: '',
    companyName: '',
  });

  const [manageProductsModal, setManageProductsModal] = useState<{
    isOpen: boolean;
    companyId: string;
    companyName: string;
  }>({
    isOpen: false,
    companyId: '',
    companyName: '',
  });

  // Action dropdown state (which item has dropdown open)
  const [openActionDropdown, setOpenActionDropdown] = useState<string | null>(null);

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
      communicationId: null,
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
      communicationId: null,
    });
  };

  // Draft reply handler for communications (needs reply items)
  const handleDraftReply = async (communicationId: string) => {
    setDraftModal({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null,
      flagId: null,
      communicationId,
    });

    try {
      const res = await fetch(`/api/communications/${communicationId}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          context: {
            company_name: json.context.company_name,
            contact_name: json.context.contact_name,
            contact_email: json.context.contact_email,
            original_subject: json.context.original_subject,
            original_preview: json.context.original_preview,
          },
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
    // Check if this is a communication draft (not a flag draft)
    if (draftModal.communicationId && !flagId) {
      // Handle communication draft send
      const res = await fetch('/api/communications/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId: draftModal.communicationId,
          ...data,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to send email');
      }

      // Success - close modal, refresh list, show toast
      closeDraftModal();
      toast.success('Reply sent successfully');
      fetchData();
      return;
    }

    // Handle flag draft send (original behavior)
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

  // Mark communication as responded handler (for draft modal)
  const handleMarkCommunicationResponded = async (communicationId: string) => {
    const res = await fetch(`/api/communications/${communicationId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responded_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      throw new Error('Failed to mark as responded');
    }

    // Success - close modal, refresh list, show toast
    closeDraftModal();
    toast.success('Marked as responded');
    fetchData();
  };

  // Open source preview modal (for viewing the email/transcript that triggered a flag)
  const openSourcePreview = (item: DailyDriverItem) => {
    // Determine source type and ID
    if (item.source_type === 'communication' && item.source_id) {
      // For communication sources, we use the source_id as conversation ID
      setSourcePreview({
        isOpen: true,
        type: 'email',
        id: item.source_id,
      });
    } else if (item.communication_id) {
      // For needsReply items, use communication_id
      setSourcePreview({
        isOpen: true,
        type: 'email',
        id: item.communication_id,
      });
    } else if (item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING' && item.source_id) {
      // For transcript-related flags
      setSourcePreview({
        isOpen: true,
        type: 'transcript',
        id: item.source_id,
      });
    }
  };

  // Close source preview modal
  const closeSourcePreview = () => {
    setSourcePreview({
      isOpen: false,
      type: null,
      id: null,
    });
  };

  // Open compose modal for reply
  const openComposeForReply = (item: DailyDriverItem) => {
    setComposeModal({
      isOpen: true,
      toEmail: item.contact_email || undefined,
      toName: item.contact_name || undefined,
      subject: item.communication_subject ? `Re: ${item.communication_subject}` : undefined,
      contactId: item.contact_id || undefined,
      companyId: item.company_id,
    });
  };

  // Close compose modal
  const closeComposeModal = () => {
    setComposeModal({ isOpen: false });
  };

  // Handle compose sent successfully
  const handleComposeSent = () => {
    toast.success('Reply sent successfully');
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

    // Determine if we have a viewable source
    const hasViewableSource =
      (item.source_type === 'communication' && item.source_id) ||
      item.communication_id ||
      (item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING' && item.source_id);

    // Get source icon
    const getSourceIcon = () => {
      if (item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING') {
        return <Video className="h-3 w-3" />;
      }
      return <Mail className="h-3 w-3" />;
    };

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

          {/* Reason - more prominent with background */}
          {item.reason && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{item.reason}</p>
              </div>
            </div>
          )}

          {/* Recommended action */}
          {item.recommended_action && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">
              <span className="font-medium">Recommended:</span> {item.recommended_action}
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-1 text-xs text-gray-400">
            Created {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View Source button */}
          {hasViewableSource && (
            <button
              onClick={() => openSourcePreview(item)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                'bg-purple-100 text-purple-700 hover:bg-purple-200',
                'transition-colors'
              )}
            >
              {getSourceIcon()}
              View Source
            </button>
          )}

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

          <ActionDropdown
            item={item}
            isOpen={openActionDropdown === item.id}
            onToggle={() => setOpenActionDropdown(openActionDropdown === item.id ? null : item.id)}
            onClose={() => setOpenActionDropdown(null)}
            onAssignCompany={() => {
              setAssignCompanyModal({
                isOpen: true,
                currentCompanyId: item.company_id,
                currentCompanyName: item.company_name,
                communicationId: item.communication_id || undefined,
              });
            }}
            onScheduleMeeting={() => {
              setScheduleMeetingModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
                contactName: item.contact_name,
                contactEmail: item.contact_email,
                sourceCommunicationId: item.communication_id || null,
              });
            }}
            onManageProducts={() => {
              setManageProductsModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
              });
            }}
          />
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

    // Determine if we have a viewable source
    const hasViewableSource =
      (item.source_type === 'communication' && item.source_id) ||
      item.communication_id ||
      (item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING' && item.source_id);

    // Get source icon
    const getSourceIcon = () => {
      if (item.flag_type === 'NO_NEXT_STEP_AFTER_MEETING') {
        return <Video className="h-3 w-3" />;
      }
      return <Mail className="h-3 w-3" />;
    };

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

          {/* Reason - more prominent with background */}
          {item.reason && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{item.reason}</p>
              </div>
            </div>
          )}

          {/* Recommended action */}
          {item.recommended_action && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">
              <span className="font-medium">Recommended:</span> {item.recommended_action}
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-1 text-xs text-gray-400">
            Created {formatRelativeTime(item.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View Source button */}
          {hasViewableSource && (
            <button
              onClick={() => openSourcePreview(item)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                'bg-purple-100 text-purple-700 hover:bg-purple-200',
                'transition-colors'
              )}
            >
              {getSourceIcon()}
              View Source
            </button>
          )}

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

          <ActionDropdown
            item={item}
            isOpen={openActionDropdown === item.id}
            onToggle={() => setOpenActionDropdown(openActionDropdown === item.id ? null : item.id)}
            onClose={() => setOpenActionDropdown(null)}
            onAssignCompany={() => {
              setAssignCompanyModal({
                isOpen: true,
                currentCompanyId: item.company_id,
                currentCompanyName: item.company_name,
                communicationId: item.communication_id || undefined,
              });
            }}
            onScheduleMeeting={() => {
              setScheduleMeetingModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
                contactName: item.contact_name,
                contactEmail: item.contact_email,
                sourceCommunicationId: item.communication_id || null,
              });
            }}
            onManageProducts={() => {
              setManageProductsModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
              });
            }}
          />
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

          <ActionDropdown
            item={item}
            isOpen={openActionDropdown === item.id}
            onToggle={() => setOpenActionDropdown(openActionDropdown === item.id ? null : item.id)}
            onClose={() => setOpenActionDropdown(null)}
            onAssignCompany={() => {
              setAssignCompanyModal({
                isOpen: true,
                currentCompanyId: item.company_id,
                currentCompanyName: item.company_name,
                communicationId: item.communication_id || undefined,
              });
            }}
            onScheduleMeeting={() => {
              setScheduleMeetingModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
                contactName: item.contact_name,
                contactEmail: item.contact_email,
                sourceCommunicationId: item.communication_id || null,
              });
            }}
            onManageProducts={() => {
              setManageProductsModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
              });
            }}
          />
        </div>
      </div>
    );
  };

  // Render a needs reply row (from response queue)
  const renderNeedsReplyRow = (item: DailyDriverItem) => {
    const isOverdue = item.response_due_by && new Date(item.response_due_by) < new Date();
    const hasEmail = item.contact_email && item.contact_email.includes('@');
    const isDraftLoading = draftModal.isLoading && draftModal.communicationId === item.communication_id;

    return (
      <div className="flex items-start justify-between gap-4">
        {/* Left: Communication info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Reply className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <Link
              href={`/companies/${item.company_id}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
            >
              {item.company_name}
            </Link>
            {item.contact_name && (
              <span className="text-xs text-gray-500">
                from {item.contact_name}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                Overdue
              </span>
            )}
          </div>

          {item.communication_subject && (
            <p className="text-sm text-gray-700 mb-1 truncate">
              Re: {item.communication_subject}
            </p>
          )}

          {item.communication_preview && (
            <p className="text-xs text-gray-500 line-clamp-2">
              {item.communication_preview}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {item.contact_email && (
              <span className="text-xs text-gray-500">
                {item.contact_email}
              </span>
            )}
            {!hasEmail && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <UserX className="h-3 w-3" />
                No email on file - check source
              </span>
            )}
            {item.response_due_by && (
              <span className={cn(
                'text-xs',
                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
              )}>
                Due: {formatRelativeTime(item.response_due_by)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View Source button - view the original email */}
          {item.communication_id && (
            <button
              onClick={() => openSourcePreview(item)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                'bg-purple-100 text-purple-700 hover:bg-purple-200',
                'transition-colors'
              )}
            >
              <Mail className="h-3 w-3" />
              View Email
            </button>
          )}

          {/* Draft Reply button - generates AI draft */}
          {item.communication_id && (
            <button
              onClick={() => handleDraftReply(item.communication_id!)}
              disabled={isDraftLoading}
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
                <FileText className="h-3 w-3" />
              )}
              Draft Reply
            </button>
          )}

          {/* Reply button - always active, opens compose modal */}
          <button
            onClick={() => openComposeForReply(item)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded',
              'bg-blue-600 text-white hover:bg-blue-700',
              'transition-colors'
            )}
          >
            <Send className="h-3 w-3" />
            Reply
          </button>

          {item.communication_id && (
            <button
              onClick={() => handleMarkResponded(item)}
              disabled={actionStates[item.id] === 'loading'}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded',
                actionStates[item.id] === 'success'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                'disabled:opacity-50',
                'transition-colors'
              )}
            >
              {actionStates[item.id] === 'loading' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : actionStates[item.id] === 'success' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {actionStates[item.id] === 'success' ? 'Done' : 'Mark Done'}
            </button>
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

          <ActionDropdown
            item={item}
            isOpen={openActionDropdown === item.id}
            onToggle={() => setOpenActionDropdown(openActionDropdown === item.id ? null : item.id)}
            onClose={() => setOpenActionDropdown(null)}
            onAssignCompany={() => {
              setAssignCompanyModal({
                isOpen: true,
                currentCompanyId: item.company_id,
                currentCompanyName: item.company_name,
                communicationId: item.communication_id || undefined,
              });
            }}
            onScheduleMeeting={() => {
              setScheduleMeetingModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
                contactName: item.contact_name,
                contactEmail: item.contact_email,
                sourceCommunicationId: item.communication_id || null,
              });
            }}
            onManageProducts={() => {
              setManageProductsModal({
                isOpen: true,
                companyId: item.company_id,
                companyName: item.company_name,
              });
            }}
          />
        </div>
      </div>
    );
  };

  // Handle marking a communication as responded
  const handleMarkResponded = async (item: DailyDriverItem) => {
    if (!item.communication_id) return;

    setActionStates((prev) => ({ ...prev, [item.id]: 'loading' }));

    try {
      const res = await fetch(`/api/communications/${item.communication_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responded_at: new Date().toISOString() }),
      });

      if (!res.ok) {
        throw new Error('Failed to mark as responded');
      }

      setActionStates((prev) => ({ ...prev, [item.id]: 'success' }));
      toast.success('Marked as responded');

      // Refresh data
      setTimeout(() => {
        fetchData();
        setActionStates((prev) => {
          const newState = { ...prev };
          delete newState[item.id];
          return newState;
        });
      }, 1000);
    } catch (error) {
      console.error('Error marking as responded:', error);
      setActionStates((prev) => ({ ...prev, [item.id]: 'error' }));
      toast.error('Failed to mark as responded');
    }
  };

  // Unified item renderer - determines which style to use based on item type
  const renderUnifiedItem = (item: DailyDriverItem) => {
    // Check if it's a needs reply item (from response queue)
    if (item.communication_id) {
      return renderNeedsReplyRow(item);
    }

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
            {data.counts.needsReply > 0 && (
              <>
                <span className="mx-2">|</span>
                <span className="text-blue-600">{data.counts.needsReply} replies needed</span>
              </>
            )}
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
        onMarkCommunicationResponded={handleMarkCommunicationResponded}
      />

      {/* Source Preview Modals */}
      {sourcePreview.type === 'email' && sourcePreview.id && (
        <CommunicationPreviewModal
          isOpen={sourcePreview.isOpen}
          onClose={closeSourcePreview}
          communicationId={sourcePreview.id}
          onReply={(email, subject) => {
            closeSourcePreview();
            setComposeModal({
              isOpen: true,
              toEmail: email,
              subject: subject ? `Re: ${subject}` : undefined,
            });
          }}
        />
      )}

      {sourcePreview.type === 'transcript' && sourcePreview.id && (
        <TranscriptPreviewModal
          isOpen={sourcePreview.isOpen}
          onClose={closeSourcePreview}
          meetingId={sourcePreview.id}
        />
      )}

      {/* Compose Modal for Reply */}
      <ComposeModal
        isOpen={composeModal.isOpen}
        onClose={closeComposeModal}
        onSent={handleComposeSent}
        toEmail={composeModal.toEmail}
        toName={composeModal.toName}
        subject={composeModal.subject}
        contactId={composeModal.contactId}
        companyId={composeModal.companyId}
      />

      {/* Assign Company Modal */}
      <AssignCompanyModal
        isOpen={assignCompanyModal.isOpen}
        onClose={() => setAssignCompanyModal({ isOpen: false, currentCompanyId: null, currentCompanyName: null })}
        currentCompanyId={assignCompanyModal.currentCompanyId}
        currentCompanyName={assignCompanyModal.currentCompanyName}
        communicationId={assignCompanyModal.communicationId}
        onAssigned={(companyId, companyName) => {
          toast.success(`Assigned to ${companyName}`);
          fetchData();
        }}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={scheduleMeetingModal.isOpen}
        onClose={() => setScheduleMeetingModal({ isOpen: false, companyId: '', companyName: '' })}
        companyId={scheduleMeetingModal.companyId}
        companyName={scheduleMeetingModal.companyName}
        contactName={scheduleMeetingModal.contactName}
        contactEmail={scheduleMeetingModal.contactEmail}
        sourceCommunicationId={scheduleMeetingModal.sourceCommunicationId}
        onScheduled={() => {
          toast.success('Scheduling request created');
          fetchData();
        }}
      />

      {/* Manage Products Modal */}
      <ManageProductsModal
        isOpen={manageProductsModal.isOpen}
        onClose={() => setManageProductsModal({ isOpen: false, companyId: '', companyName: '' })}
        companyId={manageProductsModal.companyId}
        companyName={manageProductsModal.companyName}
        onUpdated={() => {
          toast.success('Products updated');
          fetchData();
        }}
      />
    </div>
  );
}
