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
  Zap,
  AlertTriangle,
  Check,
  Lightbulb,
  ExternalLink,
  Inbox,
  Bot,
  Mic,
  Database,
  Hash,
  PenLine,
  User,
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
// SOURCE CONFIG (for expanded section)
// ============================================

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  email_sync: { label: 'Email', icon: Inbox, color: 'text-blue-600 bg-blue-50' },
  calendar_sync: { label: 'Calendar', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
  signal_detection: { label: 'AI Signal', icon: Bot, color: 'text-amber-600 bg-amber-50' },
  ai_recommendation: { label: 'AI Suggested', icon: Bot, color: 'text-violet-600 bg-violet-50' },
  transcription: { label: 'Meeting Notes', icon: Mic, color: 'text-pink-600 bg-pink-50' },
  crm_sync: { label: 'CRM', icon: Database, color: 'text-green-600 bg-green-50' },
  slack: { label: 'Slack', icon: Hash, color: 'text-rose-600 bg-rose-50' },
  manual: { label: 'Manual', icon: PenLine, color: 'text-gray-600 bg-gray-100' },
  system: { label: 'System', icon: CheckSquare, color: 'text-gray-500 bg-gray-50' },
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
// GENERIC AI FLUFF PATTERNS TO FILTER OUT
// ============================================

const GENERIC_FLUFF_PATTERNS = [
  // Generic motivational
  /voice builds trust/i,
  /faster than email/i,
  /get a foot in the door/i,
  /if we don't act soon/i,
  /risk losing this chance/i,
  /setting up.*quickly/i,
  /important to follow up/i,
  /maintain momentum/i,
  /keep the conversation going/i,
  /stay top of mind/i,
  /timely follow-up/i,
  /strike while.*hot/i,
  /don't let this slip/i,
  /capitalize on/i,
  /seize the opportunity/i,
  /time is of the essence/i,
  /act now/i,
  /don't delay/i,

  // Generic sales advice
  /proposals? move deals? forward/i,
  /move the deal forward/i,
  /advance the opportunity/i,
  /build on the momentum/i,
  /show you're serious/i,
  /demonstrate your commitment/i,
  /establish credibility/i,
  /show your value/i,
  /reinforce the relationship/i,
  /strengthen the partnership/i,
  /deepen the connection/i,
  /nurture the lead/i,
  /warm up the prospect/i,
  /keep them engaged/i,
  /build rapport/i,
  /establish trust/i,
  /show you care/i,
  /personalized touch/i,
  /personal touch/i,
  /human touch/i,

  // Generic urgency without specifics
  /time-sensitive/i,
  /window of opportunity/i,
  /limited window/i,
  /closing window/i,
  /now is the time/i,
  /perfect timing/i,
  /right moment/i,
  /opportune time/i,
  /ideal moment/i,
  /while it's fresh/i,
  /before they forget/i,
  /while they remember/i,
  /before interest wanes/i,
  /interest is high/i,
  /excitement is still/i,
  /enthusiasm is/i,

  // Generic process statements
  /next logical step/i,
  /natural next step/i,
  /expected follow-up/i,
  /standard practice/i,
  /best practice/i,
  /industry standard/i,
  /proven approach/i,
  /recommended action/i,
  /strategic move/i,
  /tactical advantage/i,

  // Vague relationship statements
  /relationship building/i,
  /keep the dialogue open/i,
  /continue the conversation/i,
  /follow up on previous/i,
  /circle back/i,
  /touch base/i,
  /check in with/i,
];

// Check if text is specific enough (has concrete data points)
function hasSpecificData(text: string): boolean {
  if (!text) return false;

  // Specific indicators: dates, numbers, names, quotes, concrete actions
  const specificPatterns = [
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d+/i, // Date mentions
    /\d+\s*(times?|x)\b/i, // View counts like "3 times" or "3x"
    /viewed.*(proposal|quote|pricing|document)/i, // Specific viewing actions
    /\d+\s*days?\s+(ago|since|silent|overdue)/i, // Days since something
    /promised|committed|agreed|asked for|requested/i, // Commitments
    /trial\s+(access|period|started|ending)/i, // Trial specifics
    /you said|they said|mentioned|discussed/i, // Conversation references
    /\$[\d,]+[kKmM]?/i, // Dollar amounts
    /replied|responded|sent|received|opened|clicked/i, // Email actions
    /(yesterday|last\s+(week|monday|tuesday|wednesday|thursday|friday))/i, // Time references
    /EOW|EOD|end of (week|day|month|quarter)/i, // Deadline references
    /at\s+\d+:\d+\s*(am|pm)?/i, // Time stamps
  ];

  return specificPatterns.some(pattern => pattern.test(text));
}

function isGenericFluff(text: string): boolean {
  if (!text) return true;

  // If it matches a fluff pattern, it's fluff
  if (GENERIC_FLUFF_PATTERNS.some(pattern => pattern.test(text))) {
    return true;
  }

  // If it doesn't have specific data points, treat as fluff
  if (!hasSpecificData(text)) {
    return true;
  }

  return false;
}

// ============================================
// GENERATE WHY NOW - Only specific, real data
// No date math fallbacks. No generic urgency.
// If we don't have SPECIFIC context, show nothing.
// ============================================

function generateWhyNow(item: CommandCenterItem): string | null {
  // Only use why_now from the database if it contains specific data
  // This should be populated by AI with real context from transcripts,
  // engagement signals, email history, etc.
  if (item.why_now && !isGenericFluff(item.why_now)) {
    return item.why_now;
  }

  // We intentionally do NOT generate fallback "Why Now" messages.
  // Generic date-based reasons like "Due today" or "Deal close in 5 days"
  // are not the specific, contextual urgency we want to show.
  //
  // The "Why Now" should only show when we have REAL context like:
  // - "They asked for trial access on your Dec 15 call — you promised by EOW"
  // - "Sarah viewed your proposal 3x yesterday, last at 11pm"
  // - "They've gone silent for 8 days after your pricing email"
  //
  // If the AI/backend didn't populate why_now with specific context,
  // we don't show the section at all. This is better than showing noise.

  return null;
}

// ============================================
// HELPERS
// ============================================

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

function formatStage(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ActionCard({
  item,
  isCurrentItem = false,
  onComplete,
  onSnooze,
  onDismiss,
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

  const config = ACTION_TYPE_CONFIGS[item.action_type];
  const Icon = iconMap[config?.icon || 'CheckSquare'] || CheckSquare;

  // Generate why now - filters out generic fluff
  const whyNow = generateWhyNow(item);

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

  // Get company and deal info
  const companyName = item.company_name || item.company?.name;
  const companyId = item.company_id || item.company?.id;
  const dealName = item.deal?.name;
  const dealId = item.deal_id || item.deal?.id;

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border transition-all duration-300',
        isCurrentItem
          ? 'border-blue-200 ring-2 ring-blue-100 shadow-md'
          : 'border-gray-200 hover:shadow-md',
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Completion Checkbox */}
          <button
            onClick={() => onComplete && handleAction('complete', () => onComplete(item.id))}
            disabled={loading === 'complete'}
            className={cn(
              'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all mt-1',
              loading === 'complete'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
            )}
            title="Mark as complete"
          >
            {loading === 'complete' ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            ) : (
              <Check className="h-3 w-3 text-transparent group-hover:text-green-500" />
            )}
          </button>

          {/* Icon */}
          <div className={cn('p-2 rounded-lg flex-shrink-0', config?.color || 'bg-gray-100 text-gray-700')}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row with Score */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900">{item.title}</h3>
              <button
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="flex items-center gap-1 text-orange-500 font-semibold text-sm flex-shrink-0"
                title="View score breakdown"
              >
                <Zap className="h-3.5 w-3.5" />
                {item.momentum_score}
              </button>
            </div>

            {/* Company · Deal · Value · Stage (single line with clickable links) */}
            <div className="mt-1 text-sm text-gray-500 flex items-center flex-wrap gap-x-1">
              {companyName && companyId ? (
                <Link
                  href={`/companies/${companyId}`}
                  className="hover:text-blue-600 hover:underline"
                >
                  {companyName}
                </Link>
              ) : companyName ? (
                <span>{companyName}</span>
              ) : (
                <button
                  onClick={() => onLinkCompany?.(item.id)}
                  className="text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Link company
                </button>
              )}

              {dealName && dealId && (
                <>
                  <span>·</span>
                  <Link
                    href={`/deals/${dealId}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {dealName}
                  </Link>
                </>
              )}

              {item.deal_value && item.deal_value > 0 && (
                <>
                  <span>·</span>
                  <span className="text-green-600 font-medium">{formatValue(item.deal_value)}</span>
                </>
              )}

              {item.deal_stage && (
                <>
                  <span>·</span>
                  <span>{formatStage(item.deal_stage)}</span>
                </>
              )}
            </div>

            {/* Score Breakdown (collapsible) */}
            {showScoreBreakdown && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1.5">
                {item.score_explanation?.map((explanation, i) => (
                  <p key={i} className="text-xs text-gray-600">{explanation}</p>
                ))}
              </div>
            )}

            {/* Why Now - Only show if we have specific, real data */}
            {whyNow && (
              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <span className="mr-1">💡</span>
                  {whyNow}
                </p>
              </div>
            )}

            {/* Human Review Alert (Negative Sentiment) */}
            {item.requires_human_review && (
              <div className="mt-3 p-3 bg-purple-50 border-l-4 border-purple-400 rounded-r-lg">
                <p className="text-sm text-purple-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  <span className="font-medium">Needs your judgment</span>
                  {item.sentiment_routing === 'human_leverage_brief' && (
                    <span className="ml-1">— review approach before acting</span>
                  )}
                </p>
              </div>
            )}

            {/* Landmine Warnings */}
            {item.landmine_warnings && item.landmine_warnings.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                <p className="text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  <span className="font-medium">Avoid: </span>
                  {item.landmine_warnings.join(', ')}
                </p>
              </div>
            )}

            {/* Win Tip */}
            {item.win_tip && (
              <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
                <p className="text-sm text-green-800">
                  <Lightbulb className="h-4 w-4 inline mr-1" />
                  {item.win_tip}
                  {item.win_pattern_sample_size && (
                    <span className="ml-2 text-xs text-green-600">(n={item.win_pattern_sample_size})</span>
                  )}
                </p>
              </div>
            )}

            {/* Actions Row */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onSchedule && (
                  <button
                    onClick={() => onSchedule(item.id)}
                    className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule
                  </button>
                )}
                {onEmail && (
                  <button
                    onClick={() => onEmail(item.id)}
                    className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </button>
                )}
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="h-8 px-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1 transition-colors"
                >
                  More {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              <span className="text-xs text-gray-400">~{item.estimated_minutes} min</span>
            </div>

            {/* Expanded Section */}
            {showMore && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                {/* Context Summary */}
                {(item.context_summary || item.context_brief) && (
                  <p className="text-sm text-gray-600">{item.context_summary || item.context_brief}</p>
                )}

                {/* Considerations */}
                {item.considerations && item.considerations.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium text-gray-700 mb-1">Consider:</p>
                    <ul className="ml-4 list-disc text-gray-600 space-y-0.5">
                      {item.considerations.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Source Links */}
                {item.source_links && item.source_links.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Sources:</span>
                    {item.source_links.map((link, i) => (
                      <Link
                        key={i}
                        href={link.url}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Source Type (moved from main view) */}
                {item.source && SOURCE_CONFIG[item.source] && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Source:</span>
                    <span className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded',
                      SOURCE_CONFIG[item.source].color
                    )}>
                      {(() => {
                        const SourceIcon = SOURCE_CONFIG[item.source].icon;
                        return <SourceIcon className="h-3 w-3" />;
                      })()}
                      {SOURCE_CONFIG[item.source].label}
                    </span>
                    {(item.meeting_id || item.conversation_id) && (
                      <Link
                        href={item.meeting_id
                          ? `/calendar?event=${item.meeting_id}`
                          : `/inbox?id=${item.conversation_id}`
                        }
                        className="text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        View <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                )}

                {/* Primary Contact */}
                {item.primary_contact && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {item.primary_contact.name}
                    {item.primary_contact.title && (
                      <span className="text-gray-400">({item.primary_contact.title})</span>
                    )}
                    {item.primary_contact.email && (
                      <span className="text-gray-400 ml-1">{item.primary_contact.email}</span>
                    )}
                  </div>
                )}

                {/* Snooze/Dismiss Actions */}
                <div className="flex items-center gap-2 pt-2">
                  {/* Snooze */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                      disabled={loading === 'snooze'}
                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50"
                    >
                      {loading === 'snooze' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <AlarmClockOff className="h-3 w-3" />
                          Snooze
                        </>
                      )}
                    </button>
                    {showSnoozeOptions && (
                      <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px] z-10">
                        {snoozeOptions.map((option) => (
                          <button
                            key={option.label}
                            onClick={() => handleSnooze(option.minutes)}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
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
                    className="h-7 px-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50"
                  >
                    {loading === 'dismiss' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        Dismiss
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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

  // Build context line
  const parts: string[] = [];
  const companyName = item.company_name || item.company?.name;
  if (companyName) parts.push(companyName);
  if (item.deal?.name) parts.push(item.deal.name);
  const contextLine = parts.join(' · ');

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
        {contextLine && (
          <p className="text-xs text-gray-500 truncate">{contextLine}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs flex-shrink-0">
        <span className="text-gray-400">{item.estimated_minutes}m</span>
        <span className="text-orange-500 font-medium flex items-center gap-0.5">
          <Zap className="h-3 w-3" />
          {item.momentum_score}
        </span>
      </div>
    </button>
  );
}
