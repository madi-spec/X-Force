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
  TrendingUp,
  MessageCircle,
  FileEdit,
  Plus,
  Quote,
  Sparkles,
} from 'lucide-react';
import {
  ActionType,
  CommandCenterItem,
  ScoreFactors,
  ACTION_TYPE_CONFIGS,
  SourceLink,
  PrimaryContact,
  AvailableAction,
  TIER_CONFIGS,
  PriorityTier,
  EmailDraft,
  WorkflowStep,
} from '@/types/commandCenter';

// ============================================
// EXTENDED TYPES FOR RICH CONTEXT
// ============================================

interface BuyingSignal {
  signal: string;
  quote?: string;
  strength: 'strong' | 'moderate' | 'weak';
  implication?: string;
}

interface DetectedConcern {
  concern: string;
  quote?: string;
  severity: 'high' | 'medium' | 'low';
  suggested_response?: string;
}

interface SuggestedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning?: string;
}

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
    buying_signals?: BuyingSignal[];
    concerns?: DetectedConcern[];
    suggested_actions?: SuggestedAction[];
    email_draft?: EmailDraft | null;
    workflow_steps?: WorkflowStep[] | null;
  };
  isCurrentItem?: boolean;
  onStart?: (id: string) => Promise<void>;
  onComplete?: (id: string) => Promise<void>;
  onSnooze?: (id: string, until: string) => Promise<void>;
  onDismiss?: (id: string, reason?: string) => Promise<void>;
  onSkip?: (id: string) => Promise<void>;
  onSchedule?: (id: string) => void;
  onAISchedule?: (id: string) => void;
  onQuickBook?: (id: string) => void;
  onEmail?: (id: string) => void;
  onAIDraftEmail?: (id: string) => void;
  onManualReply?: (id: string) => void;
  onLinkDeal?: (id: string) => void;
  onLinkCompany?: (id: string) => void;
  onAddContext?: (id: string) => void;
  onViewDraft?: (id: string, draft: EmailDraft) => void;
  onViewEmail?: (conversationId: string) => void;
  onViewTranscript?: (meetingId: string) => void;
  onCompleteStep?: (itemId: string, stepId: string) => Promise<void>;
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

const SOURCE_CONFIG: Record<string, { label: string; emoji: string; icon: typeof Mail; color: string }> = {
  email_sync: { label: 'Email', emoji: '📧', icon: Inbox, color: 'text-blue-600 bg-blue-50' },
  email_ai_analysis: { label: 'Email', emoji: '📧', icon: Inbox, color: 'text-blue-600 bg-blue-50' },
  calendar_sync: { label: 'Call', emoji: '🎙️', icon: Mic, color: 'text-purple-600 bg-purple-50' },
  signal_detection: { label: 'AI Signal', emoji: '🤖', icon: Bot, color: 'text-amber-600 bg-amber-50' },
  ai_recommendation: { label: 'AI', emoji: '🤖', icon: Bot, color: 'text-violet-600 bg-violet-50' },
  transcription: { label: 'Call', emoji: '🎙️', icon: Mic, color: 'text-pink-600 bg-pink-50' },
  crm_sync: { label: 'CRM', emoji: '📋', icon: Database, color: 'text-green-600 bg-green-50' },
  slack: { label: 'Slack', emoji: '💬', icon: Hash, color: 'text-rose-600 bg-rose-50' },
  form_submission: { label: 'Form', emoji: '📋', icon: FileText, color: 'text-teal-600 bg-teal-50' },
  manual: { label: 'Manual', emoji: '✏️', icon: PenLine, color: 'text-gray-600 bg-gray-100' },
  system: { label: 'System', emoji: '⚙️', icon: CheckSquare, color: 'text-gray-500 bg-gray-50' },
};

// ============================================
// FORMAT TIME AGO
// ============================================

function formatTimeAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // Format as date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSourceUrl(item: CommandCenterItem): string | null {
  // Return a URL to view the source of this item
  if (item.conversation_id) {
    return `/inbox?id=${item.conversation_id}`;
  }
  if (item.meeting_id) {
    return `/calendar?event=${item.meeting_id}`;
  }
  // If it's from calendar_sync with a transcription_id, link to that
  const transcriptionId = (item as any).transcription_id;
  if (transcriptionId) {
    return `/calendar?transcript=${transcriptionId}`;
  }
  return null;
}

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
  onAISchedule,
  onQuickBook,
  onEmail,
  onAIDraftEmail,
  onManualReply,
  onLinkDeal,
  onLinkCompany,
  onAddContext,
  onViewDraft,
  onViewEmail,
  onViewTranscript,
  onCompleteStep,
  className,
}: ActionCardProps) {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showEmailMenu, setShowEmailMenu] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [completingStep, setCompletingStep] = useState<string | null>(null);

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

  // Get contact info
  const contactName = item.target_name || item.primary_contact?.name || item.contact?.name;
  const contactTitle = item.primary_contact?.title || item.contact?.title;
  const contactEmail = item.primary_contact?.email || item.contact?.email;
  const contactId = item.contact_id || item.contact?.id;

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border transition-all duration-300',
        isCurrentItem
          ? 'border-blue-200 ring-2 ring-blue-100 shadow-md'
          : 'border-gray-200 hover:shadow-md',
        // Only fade if fully complete (can_complete), not if needs_linking
        item.can_complete && !item.needs_linking && 'opacity-60 border-emerald-200 bg-emerald-50/30',
        // Highlight needs_linking items with amber border
        item.needs_linking && 'border-amber-200 bg-amber-50/20',
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
            {/* Title Row with Tier Badge */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900">{item.title}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Product Badge */}
                {item.product_name && (
                  <ProductBadge
                    name={item.product_name}
                    status={item.product_status}
                    mrr={item.product_mrr}
                  />
                )}
                {/* Tier Badge */}
                {item.tier && (
                  <TierBadge tier={item.tier as PriorityTier} trigger={item.tier_trigger} />
                )}
                {/* Legacy momentum score - click to expand */}
                <button
                  onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                  className="flex items-center gap-1 text-gray-400 text-xs"
                  title="View score breakdown"
                >
                  <Zap className="h-3 w-3" />
                  {item.momentum_score}
                </button>
              </div>
            </div>

            {/* Contact Info (when available) */}
            {contactName && (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  {contactId ? (
                    <Link
                      href={`/contacts/${contactId}`}
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {contactName}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-900">{contactName}</span>
                  )}
                  {contactTitle && (
                    <span className="text-gray-500 ml-1">· {contactTitle}</span>
                  )}
                  {contactEmail && !contactTitle && (
                    <span className="text-gray-400 ml-1 text-xs">{contactEmail}</span>
                  )}
                </div>
              </div>
            )}

            {/* Company · Deal · Value · Stage (single line with clickable links) */}
            <div className="mt-1 text-sm text-gray-500 flex items-center flex-wrap gap-x-1">
              {/* Company link/name */}
              {companyName && companyId ? (
                <Link
                  href={`/companies/${companyId}`}
                  className="hover:text-blue-600 hover:underline"
                >
                  {companyName}
                </Link>
              ) : companyName ? (
                <span>{companyName}</span>
              ) : onLinkCompany ? (
                <button
                  onClick={() => onLinkCompany(item.id)}
                  className={cn(
                    'flex items-center gap-0.5',
                    item.needs_linking
                      ? 'px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium hover:bg-amber-200'
                      : 'text-amber-600 hover:text-amber-700 hover:underline'
                  )}
                >
                  <Plus className="h-3 w-3" />
                  Link company
                </button>
              ) : null}

              {/* Deal link/name or link button */}
              {dealName && dealId ? (
                <>
                  <span>·</span>
                  <Link
                    href={`/deals/${dealId}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {dealName}
                  </Link>
                </>
              ) : companyId && onLinkDeal ? (
                <>
                  <span>·</span>
                  <button
                    onClick={() => onLinkDeal(item.id)}
                    className={cn(
                      'flex items-center gap-0.5',
                      item.needs_linking
                        ? 'px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium hover:bg-amber-200'
                        : 'text-amber-600 hover:text-amber-700 hover:underline'
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    Link deal
                  </button>
                </>
              ) : !companyId && onLinkDeal && item.needs_linking ? (
                // Show link deal button even without company when needs_linking
                <>
                  <span>·</span>
                  <button
                    onClick={() => onLinkDeal(item.id)}
                    className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    Link deal
                  </button>
                </>
              ) : null}

              {/* Deal value */}
              {item.deal_value && item.deal_value > 0 && (
                <>
                  <span>·</span>
                  <span className="text-green-600 font-medium">{formatValue(item.deal_value)}</span>
                </>
              )}

              {/* Deal stage */}
              {item.deal_stage && (
                <>
                  <span>·</span>
                  <span>{formatStage(item.deal_stage)}</span>
                </>
              )}
            </div>

            {/* Missing data warning for high priority items (only if not already showing needs_linking banner) */}
            {item.tier && item.tier <= 2 && (!companyId || !dealId) && !item.needs_linking && (
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600">
                  {!companyId && !dealId
                    ? 'Not linked to company or deal'
                    : !dealId
                      ? 'Not linked to a deal'
                      : 'Not linked to a company'}
                  {' — '}
                  <span className="text-amber-700">link to track value</span>
                </span>
              </div>
            )}

            {/* Source Attribution Line */}
            {item.source && SOURCE_CONFIG[item.source] && (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span>{SOURCE_CONFIG[item.source].emoji}</span>
                  <span>From {SOURCE_CONFIG[item.source].label}</span>
                </span>
                {(item.received_at || item.created_at) && (
                  <>
                    <span>·</span>
                    <span>{formatTimeAgo(item.received_at || item.created_at)}</span>
                  </>
                )}
                {/* View source - opens modal if handler available, otherwise navigates */}
                {item.conversation_id && onViewEmail && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => onViewEmail(item.conversation_id!)}
                      className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                    >
                      View source
                      <Mail className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
                {item.meeting_id && onViewTranscript && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => onViewTranscript(item.meeting_id!)}
                      className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                    >
                      View source
                      <Mic className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
                {/* Fallback to link if no modal handler */}
                {getSourceUrl(item) && !item.conversation_id && !item.meeting_id && (
                  <>
                    <span>·</span>
                    <Link
                      href={getSourceUrl(item)!}
                      className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                    >
                      View source
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Score Breakdown (collapsible) */}
            {showScoreBreakdown && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1.5">
                {item.score_explanation?.map((explanation, i) => (
                  <p key={i} className="text-xs text-gray-600">{explanation}</p>
                ))}
              </div>
            )}

            {/* Needs Linking Warning (handled but orphaned) */}
            {item.needs_linking && item.handled_reason && (
              <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <p className="text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  <span className="font-medium">{item.handled_reason}</span>
                  <span className="mx-1">—</span>
                  <span>{item.linking_message?.toLowerCase() || 'not linked to deal'}</span>
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Link to track this opportunity properly
                </p>
              </div>
            )}

            {/* Fully Handled (can complete) */}
            {item.can_complete && item.handled_reason && !item.needs_linking && (
              <div className="mt-3 p-3 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg">
                <p className="text-sm text-emerald-700">
                  <Check className="h-4 w-4 inline mr-1" />
                  <span className="font-medium">Fully handled: </span>
                  {item.handled_reason}
                </p>
              </div>
            )}

            {/* Why Now - Only show if we have specific, real data */}
            {whyNow && !item.already_handled && (
              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <span className="mr-1">💡</span>
                  {whyNow}
                </p>
              </div>
            )}

            {/* Workflow Steps Checklist */}
            {item.workflow_steps && item.workflow_steps.length > 0 && (
              <WorkflowStepsChecklist
                steps={item.workflow_steps}
                itemId={item.id}
                onCompleteStep={onCompleteStep}
                completingStepId={completingStep}
                setCompletingStepId={setCompletingStep}
              />
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
                {/* Schedule Meeting Dropdown */}
                {(onSchedule || onAISchedule || onQuickBook) && (
                  <div className="relative">
                    <button
                      onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                      className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule
                      <ChevronDown className={cn("h-3 w-3 transition-transform", showScheduleMenu && "rotate-180")} />
                    </button>
                    {showScheduleMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowScheduleMenu(false)}
                        />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[200px]">
                          {(onAISchedule || onSchedule) && (
                            <button
                              onClick={() => {
                                (onAISchedule || onSchedule)?.(item.id);
                                setShowScheduleMenu(false);
                              }}
                              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                            >
                              <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">AI Scheduler</div>
                                <div className="text-xs text-gray-500">AI drafts email & handles replies</div>
                              </div>
                            </button>
                          )}
                          {onQuickBook && (
                            <button
                              onClick={() => {
                                onQuickBook(item.id);
                                setShowScheduleMenu(false);
                              }}
                              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                            >
                              <Phone className="h-4 w-4 text-green-500 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">Quick Book</div>
                                <div className="text-xs text-gray-500">Book now while on a call</div>
                              </div>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {/* Email Dropdown */}
                {(onEmail || onAIDraftEmail || onManualReply) && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEmailMenu(!showEmailMenu)}
                      className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email
                      <ChevronDown className={cn("h-3 w-3 transition-transform", showEmailMenu && "rotate-180")} />
                    </button>
                    {showEmailMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowEmailMenu(false)}
                        />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[220px]">
                          {(onAIDraftEmail || onEmail) && (
                            <button
                              onClick={() => {
                                (onAIDraftEmail || onEmail)?.(item.id);
                                setShowEmailMenu(false);
                              }}
                              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                            >
                              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">AI Draft Response</div>
                                <div className="text-xs text-gray-500">AI generates a reply with context</div>
                              </div>
                            </button>
                          )}
                          {onManualReply && (
                            <button
                              onClick={() => {
                                onManualReply(item.id);
                                setShowEmailMenu(false);
                              }}
                              className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                            >
                              <PenLine className="h-4 w-4 text-blue-500 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">Manual Reply</div>
                                <div className="text-xs text-gray-500">Compose with full context shown</div>
                              </div>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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

                {/* Buying Signals */}
                {item.buying_signals && item.buying_signals.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-2">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Buying Signals ({item.buying_signals.length})
                    </div>
                    <div className="space-y-2">
                      {item.buying_signals.slice(0, 3).map((signal, i) => (
                        <div key={i} className="bg-green-50 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                              signal.strength === 'strong'
                                ? 'bg-green-200 text-green-800'
                                : signal.strength === 'moderate'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                            )}>
                              {signal.strength.toUpperCase()}
                            </span>
                            <p className="text-sm text-gray-800">{signal.signal}</p>
                          </div>
                          {signal.quote && (
                            <div className="mt-1.5 flex gap-1.5 text-xs text-gray-600 italic">
                              <Quote className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                              <span>"{signal.quote}"</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Concerns */}
                {item.concerns && item.concerns.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Concerns ({item.concerns.length})
                    </div>
                    <div className="space-y-2">
                      {item.concerns.slice(0, 3).map((concern, i) => (
                        <div key={i} className="bg-amber-50 rounded-lg p-2.5">
                          <div className="flex items-start gap-2">
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                              concern.severity === 'high'
                                ? 'bg-red-200 text-red-800'
                                : concern.severity === 'medium'
                                  ? 'bg-amber-200 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                            )}>
                              {concern.severity.toUpperCase()}
                            </span>
                            <p className="text-sm text-gray-800">{concern.concern}</p>
                          </div>
                          {concern.quote && (
                            <div className="mt-1.5 flex gap-1.5 text-xs text-gray-600 italic">
                              <Quote className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                              <span>"{concern.quote}"</span>
                            </div>
                          )}
                          {concern.suggested_response && (
                            <div className="mt-1.5 text-xs text-amber-700">
                              <span className="font-medium">Suggested response: </span>
                              {concern.suggested_response}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {item.suggested_actions && item.suggested_actions.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-2">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Suggested Actions
                    </div>
                    <div className="space-y-1.5">
                      {item.suggested_actions.slice(0, 4).map((action, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5',
                            action.priority === 'high'
                              ? 'bg-blue-200 text-blue-800'
                              : action.priority === 'medium'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                          )}>
                            {action.priority === 'high' ? 'DO NOW' : action.priority.toUpperCase()}
                          </span>
                          <span className="text-gray-700">{action.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Draft & Add Context Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                  {item.email_draft && onViewDraft && (
                    <button
                      onClick={() => onViewDraft(item.id, item.email_draft!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      View Draft Response
                    </button>
                  )}
                  {onAddContext && (
                    <button
                      onClick={() => onAddContext(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Context
                    </button>
                  )}
                </div>

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
        {item.product_name && (
          <ProductBadge name={item.product_name} status={item.product_status} compact />
        )}
        {item.tier && (
          <TierBadge tier={item.tier as PriorityTier} compact />
        )}
        <span className="text-gray-400">{item.estimated_minutes}m</span>
      </div>
    </button>
  );
}

// ============================================
// TIER BADGE COMPONENT
// ============================================

interface TierBadgeProps {
  tier: PriorityTier;
  trigger?: string | null;
  compact?: boolean;
}

function TierBadge({ tier, trigger, compact = false }: TierBadgeProps) {
  const config = TIER_CONFIGS[tier];

  // Tier-specific styling
  const tierStyles: Record<PriorityTier, {
    bg: string;
    text: string;
    border: string;
  }> = {
    1: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    2: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    3: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    4: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    5: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  };

  const style = tierStyles[tier];

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
          style.bg,
          style.text
        )}
        title={config.name}
      >
        {config.icon}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        style.bg,
        style.text,
        style.border
      )}
      title={trigger ? `${config.name}: ${trigger.replace(/_/g, ' ')}` : config.name}
    >
      <span>{config.icon}</span>
      <span className="uppercase tracking-wide text-[10px]">T{tier}</span>
    </span>
  );
}

// ============================================
// WORKFLOW STEPS CHECKLIST
// ============================================

interface WorkflowStepsChecklistProps {
  steps: WorkflowStep[];
  itemId: string;
  onCompleteStep?: (itemId: string, stepId: string) => Promise<void>;
  completingStepId: string | null;
  setCompletingStepId: (id: string | null) => void;
}

const OWNER_LABELS: Record<string, { label: string; color: string }> = {
  sales_rep: { label: 'Sales', color: 'text-blue-600 bg-blue-50' },
  operations: { label: 'Ops', color: 'text-purple-600 bg-purple-50' },
  technical: { label: 'Tech', color: 'text-green-600 bg-green-50' },
  management: { label: 'Mgmt', color: 'text-amber-600 bg-amber-50' },
};

const URGENCY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-400',
  low: 'border-l-gray-300',
};

function WorkflowStepsChecklist({
  steps,
  itemId,
  onCompleteStep,
  completingStepId,
  setCompletingStepId,
}: WorkflowStepsChecklistProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progress = (completedCount / totalCount) * 100;

  const handleStepClick = async (stepId: string) => {
    if (!onCompleteStep) return;
    setCompletingStepId(stepId);
    try {
      await onCompleteStep(itemId, stepId);
    } finally {
      setCompletingStepId(null);
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">
            Workflow Steps
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {completedCount}/{totalCount} complete
          </span>
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-1.5">
        {steps.map((step) => {
          const ownerConfig = OWNER_LABELS[step.owner] || OWNER_LABELS.sales_rep;
          const isCompleting = completingStepId === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded bg-white border-l-4 transition-all',
                URGENCY_STYLES[step.urgency] || URGENCY_STYLES.medium,
                step.completed && 'opacity-60 bg-gray-50'
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => !step.completed && handleStepClick(step.id)}
                disabled={step.completed || isCompleting || !onCompleteStep}
                className={cn(
                  'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                  step.completed
                    ? 'border-green-500 bg-green-500'
                    : isCompleting
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                )}
              >
                {isCompleting ? (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                ) : step.completed ? (
                  <Check className="h-3 w-3 text-white" />
                ) : null}
              </button>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    'text-sm',
                    step.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Owner badge */}
              <span
                className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  ownerConfig.color
                )}
              >
                {ownerConfig.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// PRODUCT BADGE COMPONENT
// ============================================

interface ProductBadgeProps {
  name: string;
  status?: string | null;
  mrr?: number | null;
  compact?: boolean;
}

function ProductBadge({ name, status, mrr, compact = false }: ProductBadgeProps) {
  // Status-based styling
  const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
    in_sales: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    in_onboarding: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    churned: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
    paused: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  };

  const style = statusStyles[status || 'in_sales'] || statusStyles.in_sales;

  const formatMrr = (value: number): string => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
          style.bg,
          style.text
        )}
        title={`${name}${mrr ? ` (${formatMrr(mrr)}/mo)` : ''}`}
      >
        {name.length > 12 ? name.slice(0, 10) + '…' : name}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        style.bg,
        style.text,
        style.border
      )}
      title={`${name} - ${status?.replace(/_/g, ' ') || 'In Sales'}${mrr ? ` - ${formatMrr(mrr)}/mo` : ''}`}
    >
      <span className="truncate max-w-[80px]">{name}</span>
      {mrr && mrr > 0 && (
        <span className="text-[10px] opacity-75">{formatMrr(mrr)}</span>
      )}
    </span>
  );
}
