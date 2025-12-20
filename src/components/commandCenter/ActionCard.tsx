'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Phone,
  Mail,
  Send,
  Reply,
  Calendar,
  MessageSquare,
  FileText,
  Linkedin,
  Search,
  Users,
  CheckSquare,
  ClipboardList,
  Clock,
  ChevronDown,
  ChevronUp,
  AlarmClockOff,
  X,
  Loader2,
  Play,
  DollarSign,
  Building2,
  User,
  Zap,
  AlertTriangle,
  Check,
  Circle,
  Inbox,
  Bot,
  Mic,
  Database,
  Hash,
  PenLine,
  Lightbulb,
  ExternalLink,
  Briefcase,
} from 'lucide-react';
import {
  ActionType,
  CommandCenterItem,
  ScoreFactors,
  ACTION_TYPE_CONFIGS,
  SourceLink,
  PrimaryContact,
  AvailableAction,
} from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface ActionCardProps {
  item: CommandCenterItem & {
    // Rich context fields (may be present if enriched)
    context_summary?: string;
    considerations?: string[];
    source_links?: SourceLink[];
    primary_contact?: PrimaryContact;
    available_actions?: AvailableAction[];
  };
  isCurrentItem?: boolean;
  onStart?: (id: string) => Promise<void>;
  onComplete?: (id: string) => Promise<void>;
  onSnooze?: (id: string, until: string) => Promise<void>;
  onDismiss?: (id: string, reason?: string) => Promise<void>;
  onSkip?: (id: string) => Promise<void>;
  onSchedule?: (id: string) => void;
  onEmail?: (id: string) => void;
  onLinkDeal?: (id: string) => void;
  onLinkCompany?: (id: string) => void;
  className?: string;
}

// ============================================
// ICON MAP
// ============================================

const iconMap: Record<string, typeof Phone> = {
  Phone,
  PhoneOutgoing: Phone,
  Mail,
  Send,
  Reply,
  Calendar,
  MessageSquare,
  FileText,
  Linkedin,
  Search,
  Users,
  CheckSquare,
  ClipboardList,
};

// ============================================
// SOURCE CONFIG
// ============================================

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  email_sync: {
    label: 'Email',
    icon: Inbox,
    color: 'text-blue-600 bg-blue-50',
  },
  calendar_sync: {
    label: 'Calendar',
    icon: Calendar,
    color: 'text-purple-600 bg-purple-50',
  },
  signal_detection: {
    label: 'AI Signal',
    icon: Bot,
    color: 'text-amber-600 bg-amber-50',
  },
  ai_recommendation: {
    label: 'AI Suggested',
    icon: Bot,
    color: 'text-violet-600 bg-violet-50',
  },
  transcription: {
    label: 'Meeting Notes',
    icon: Mic,
    color: 'text-pink-600 bg-pink-50',
  },
  crm_sync: {
    label: 'CRM',
    icon: Database,
    color: 'text-green-600 bg-green-50',
  },
  slack: {
    label: 'Slack',
    icon: Hash,
    color: 'text-rose-600 bg-rose-50',
  },
  manual: {
    label: 'Manual',
    icon: PenLine,
    color: 'text-gray-600 bg-gray-100',
  },
  system: {
    label: 'System',
    icon: CheckSquare,
    color: 'text-gray-500 bg-gray-50',
  },
};

// ============================================
// SNOOZE OPTIONS
// ============================================

const snoozeOptions = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Tomorrow', minutes: 'tomorrow' as const },
];

// ============================================
// STAGE COLORS
// ============================================

const STAGE_COLORS: Record<string, string> = {
  'new_lead': 'bg-gray-100 text-gray-700',
  'qualifying': 'bg-blue-100 text-blue-700',
  'discovery': 'bg-cyan-100 text-cyan-700',
  'demo': 'bg-purple-100 text-purple-700',
  'data_review': 'bg-indigo-100 text-indigo-700',
  'trial': 'bg-amber-100 text-amber-700',
  'negotiation': 'bg-orange-100 text-orange-700',
  'closed_won': 'bg-green-100 text-green-700',
  'closed_lost': 'bg-red-100 text-red-700',
};

// ============================================
// SOURCE LINKS
// ============================================

function getSourceLink(item: CommandCenterItem): string | null {
  switch (item.source) {
    case 'email_sync':
      return item.conversation_id ? `/inbox?id=${item.conversation_id}` : '/inbox';
    case 'calendar_sync':
      return item.meeting_id ? `/calendar?event=${item.meeting_id}` : null;
    case 'signal_detection':
    case 'ai_recommendation':
      return item.signal_id ? `/signals?id=${item.signal_id}` : null;
    case 'crm_sync':
      return item.deal_id ? `/deals/${item.deal_id}` : null;
    default:
      return null;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ActionCard({
  item,
  isCurrentItem = false,
  onStart,
  onComplete,
  onSnooze,
  onDismiss,
  onSkip,
  onSchedule,
  onEmail,
  onLinkDeal,
  onLinkCompany,
  className,
}: ActionCardProps) {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Determine available actions based on item data
  const availableActions = item.available_actions || ['complete'];
  // Check for contact email from joined data or primary_contact
  const contactEmail = item.primary_contact?.email || (item as any).contact?.email;
  const hasContact = !!contactEmail || !!item.contact_id;

  // Always show action buttons - they're useful even without a pre-linked contact
  // The popouts will handle the case where no contact is available
  const canSchedule = true;
  const canEmail = true;

  const config = ACTION_TYPE_CONFIGS[item.action_type];
  const Icon = iconMap[config?.icon || 'CheckSquare'] || CheckSquare;

  // Handle actions
  const handleAction = async (action: string, callback: () => Promise<void>) => {
    setLoading(action);
    try {
      await callback();
    } finally {
      setLoading(null);
    }
  };

  const handleSnooze = async (minutes: number | 'tomorrow') => {
    if (!onSnooze) return;
    let until: string;
    if (minutes === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      until = tomorrow.toISOString();
    } else {
      const snoozeDate = new Date();
      snoozeDate.setMinutes(snoozeDate.getMinutes() + minutes);
      until = snoozeDate.toISOString();
    }
    setShowSnoozeOptions(false);
    await handleAction('snooze', () => onSnooze(item.id, until));
  };

  // Score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-blue-600 bg-blue-50';
    if (score >= 25) return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
  };

  // Format deal value
  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${value}`;
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border transition-all duration-300',
        isCurrentItem
          ? 'border-blue-200 ring-2 ring-blue-100 shadow-md'
          : 'border-gray-200 hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Completion Checkbox */}
          <button
            onClick={() => onComplete && handleAction('complete', () => onComplete(item.id))}
            disabled={loading === 'complete'}
            className={cn(
              'w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all mt-0.5',
              loading === 'complete'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
            )}
            title="Mark as complete"
          >
            {loading === 'complete' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
            ) : (
              <Check className="h-3.5 w-3.5 text-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
            )}
          </button>

          {/* Icon */}
          <div className={cn('p-2.5 rounded-lg flex-shrink-0', config?.color || 'bg-gray-100 text-gray-700')}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {/* Title */}
                <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>

                {/* Data Quality Warnings */}
                {!item.company_id && !item.deal_id && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        Unknown origin - link to a company or deal, or dismiss
                      </span>
                    </div>
                  </div>
                )}
                {item.deal_id && (!item.deal_value || item.deal_value <= 0) && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        $0 deal - add value to this deal or close it
                      </span>
                    </div>
                  </div>
                )}
                {!item.deal_id && item.company_id && (
                  <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-700">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        Not pipeline - link to a deal or move to prospecting
                      </span>
                    </div>
                  </div>
                )}

                {/* Company & Contact Bar - Always prominent */}
                <div className="flex items-center gap-3 mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Company - Primary identifier */}
                  {(item.company_name || item.company?.name) ? (
                    <Link
                      href={item.company_id ? `/companies/${item.company_id}` : '#'}
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                    >
                      <Building2 className="h-4 w-4 text-blue-600" />
                      {item.company_name || item.company?.name}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onLinkCompany?.(item.id)}
                      className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 hover:underline"
                    >
                      <Building2 className="h-4 w-4" />
                      Link Company
                    </button>
                  )}

                  {/* Contact */}
                  {item.target_name && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-600 border-l border-gray-300 pl-3">
                      <User className="h-3.5 w-3.5 text-gray-500" />
                      {item.target_name}
                    </span>
                  )}
                </div>

                {/* Deal Snapshot Bar - Prominent deal context */}
                {(item.deal || item.deal_value) ? (
                  <div className="flex items-center flex-wrap gap-3 mt-2 p-2 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-100">
                    {/* Deal Name */}
                    {item.deal?.name && (
                      <Link
                        href={`/deals/${item.deal.id}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                      >
                        <Briefcase className="h-4 w-4 text-blue-600" />
                        {item.deal.name}
                      </Link>
                    )}

                    {/* Deal Value - Large and prominent */}
                    {item.deal_value && item.deal_value > 0 && (
                      <div className="flex items-center gap-1 border-l border-gray-300 pl-3">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-lg font-semibold text-green-700">
                          {formatValue(item.deal_value)}
                        </span>
                      </div>
                    )}

                    {/* Weighted Value */}
                    {item.deal_value && item.deal_probability && (
                      <div className="text-xs text-gray-600 border-l border-gray-300 pl-3">
                        <span className="font-medium text-green-600">
                          {formatValue(item.deal_value * item.deal_probability)}
                        </span>
                        {' '}weighted ({Math.round((item.deal_probability || 0) * 100)}%)
                      </div>
                    )}

                    {/* Stage Badge */}
                    {item.deal_stage && (
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium capitalize border-l border-gray-300 pl-3',
                        STAGE_COLORS[item.deal_stage] || 'bg-gray-100 text-gray-600'
                      )}>
                        {item.deal_stage.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                ) : (
                  /* No Deal - Show Link Deal button */
                  <button
                    onClick={() => onLinkDeal?.(item.id)}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    Link to Deal
                  </button>
                )}
              </div>

              {/* Momentum Score */}
              <button
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-colors',
                  getScoreColor(item.momentum_score)
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                {item.momentum_score}
                {showScoreBreakdown ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Meta Row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {/* Source Badge with link to origin */}
              {item.source && SOURCE_CONFIG[item.source] && (
                item.meeting_id || item.conversation_id ? (
                  <Link
                    href={item.meeting_id
                      ? `/calendar?event=${item.meeting_id}`
                      : `/inbox?id=${item.conversation_id}`
                    }
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium hover:underline',
                      SOURCE_CONFIG[item.source].color
                    )}
                  >
                    {(() => {
                      const SourceIcon = SOURCE_CONFIG[item.source].icon;
                      return <SourceIcon className="h-2.5 w-2.5" />;
                    })()}
                    View {SOURCE_CONFIG[item.source].label}
                    <ExternalLink className="h-2 w-2" />
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                      SOURCE_CONFIG[item.source].color
                    )}
                  >
                    {(() => {
                      const SourceIcon = SOURCE_CONFIG[item.source].icon;
                      return <SourceIcon className="h-2.5 w-2.5" />;
                    })()}
                    {SOURCE_CONFIG[item.source].label}
                  </span>
                )
              )}

              {/* Duration */}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.estimated_minutes} min
              </span>

              {/* Due indicator */}
              {item.due_at && (
                <span
                  className={cn(
                    'flex items-center gap-1',
                    new Date(item.due_at) < new Date() && 'text-red-600'
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {formatDueDate(item.due_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Score Breakdown (collapsible) */}
        {showScoreBreakdown && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Score Breakdown
            </h4>
            <div className="space-y-1.5">
              {item.score_explanation?.map((explanation, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {explanation}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Context Summary (AI Generated - Always Visible) */}
        {(item.context_summary || item.context_brief) && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">{item.context_summary || item.context_brief}</p>
          </div>
        )}

        {/* Win Tip (Tactical Consideration) */}
        {item.win_tip && (
          <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-green-800 font-medium uppercase tracking-wider mb-1">
                  Tip
                </p>
                <p className="text-sm text-green-900">{item.win_tip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 flex items-center gap-2">
          {canSchedule && onSchedule && (
            <button
              onClick={() => onSchedule(item.id)}
              className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
          )}
          {canEmail && onEmail && (
            <button
              onClick={() => onEmail(item.id)}
              className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1.5"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
          )}
          <button
            onClick={() => setShowMore(!showMore)}
            className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1 transition-colors"
          >
            {showMore ? (
              <>Less <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>More <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        </div>

        {/* Expanded Section */}
        {showMore && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {/* Why Now */}
            {item.why_now && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-800 font-medium uppercase tracking-wider mb-1">
                  Why Now
                </p>
                <p className="text-sm text-amber-900">{item.why_now}</p>
              </div>
            )}

            {/* Considerations */}
            {item.considerations && item.considerations.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Key Considerations
                </p>
                <ul className="ml-5 list-disc text-gray-600 space-y-1">
                  {item.considerations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Links */}
            {item.source_links && item.source_links.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Sources:
                </span>
                {item.source_links.map((link, i) => (
                  <Link
                    key={i}
                    href={link.url}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline px-2 py-1 bg-blue-50 rounded"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Primary Contact */}
            {item.primary_contact && (
              <div className="text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {item.primary_contact.name}
                  {item.primary_contact.title && (
                    <span className="text-gray-400">({item.primary_contact.title})</span>
                  )}
                </span>
                {item.primary_contact.email && (
                  <span className="ml-5 text-gray-400">{item.primary_contact.email}</span>
                )}
              </div>
            )}

            {/* Legacy Source Link */}
            {!item.source_links?.length && (() => {
              const sourceLink = getSourceLink(item);
              return sourceLink ? (
                <Link
                  href={sourceLink}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  View source
                </Link>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        {/* Snooze */}
        <div className="relative">
          <button
            onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
            disabled={loading === 'snooze'}
            className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading === 'snooze' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <AlarmClockOff className="h-4 w-4" />
                Snooze
              </>
            )}
          </button>

          {/* Snooze Dropdown */}
          {showSnoozeOptions && (
            <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
              {snoozeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleSnooze(option.minutes)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss && handleAction('dismiss', () => onDismiss(item.id))}
          disabled={loading === 'dismiss'}
          className="h-8 px-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          title="Dismiss"
        >
          {loading === 'dismiss' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPACT VARIANT
// ============================================

interface ActionCardCompactProps {
  item: CommandCenterItem;
  onClick?: () => void;
  className?: string;
}

export function ActionCardCompact({ item, onClick, className }: ActionCardCompactProps) {
  const config = ACTION_TYPE_CONFIGS[item.action_type];
  const Icon = iconMap[config?.icon || 'CheckSquare'] || CheckSquare;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white',
        'hover:border-gray-300 hover:shadow-sm transition-all text-left',
        className
      )}
    >
      <div className={cn('p-2 rounded-lg flex-shrink-0', config?.color || 'bg-gray-100 text-gray-700')}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {item.source && SOURCE_CONFIG[item.source] && (
            <span
              className={cn(
                'flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium',
                SOURCE_CONFIG[item.source].color
              )}
            >
              {(() => {
                const SourceIcon = SOURCE_CONFIG[item.source].icon;
                return <SourceIcon className="h-2 w-2" />;
              })()}
              {SOURCE_CONFIG[item.source].label}
            </span>
          )}
          <span className="truncate">
            {item.company_name || item.target_name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {item.estimated_minutes}m
        </span>
        <span className={cn('px-1.5 py-0.5 rounded', getScoreColorMini(item.momentum_score))}>
          {item.momentum_score}
        </span>
      </div>
    </button>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDueDate(dueAt: string): string {
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMs < 0) {
    const overdueHours = Math.abs(diffHours);
    if (overdueHours < 1) return 'Overdue';
    if (overdueHours < 24) return `${overdueHours}h overdue`;
    return `${Math.ceil(overdueHours / 24)}d overdue`;
  }

  if (diffMins < 60) return `Due in ${diffMins}m`;
  if (diffHours < 24) return `Due in ${diffHours}h`;
  return `Due in ${Math.ceil(diffHours / 24)}d`;
}

function getScoreColorMini(score: number): string {
  if (score >= 75) return 'text-green-700 bg-green-50';
  if (score >= 50) return 'text-blue-700 bg-blue-50';
  if (score >= 25) return 'text-amber-700 bg-amber-50';
  return 'text-gray-600 bg-gray-100';
}
