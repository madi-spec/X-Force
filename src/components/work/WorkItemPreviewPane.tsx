'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { QueueItem, QueueConfig } from '@/lib/work';
import { ResolverCTA, getAllCTAs, actionResolvesItem, actionToResolvedBy } from '@/lib/work/resolvers';
import { WorkItemDetailProjection } from '@/lib/work/projections';
import { WorkItemSourceType, WorkItemSignalType } from '@/lib/work/events';
import { CustomerHub, CustomerHubTab } from '@/components/customerHub';
import { CustomerHubData } from '@/components/customerHub/types';
import { CommunicationsDrawer } from './CommunicationsDrawer';
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLens } from '@/lib/lens';
import Link from 'next/link';
import {
  X,
  Maximize2,
  Minimize2,
  Lightbulb,
  MessageSquare,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  Info,
  Reply,
  Phone,
  CheckCircle,
  UserPlus,
  FileText,
  ListTodo,
  ExternalLink,
  Target,
  RefreshCw,
  CheckSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  Mail,
  Building,
} from 'lucide-react';

// Map queue to default CustomerHub tab
const QUEUE_TO_TAB: Record<string, CustomerHubTab> = {
  // CS queues
  at_risk: 'overview',
  expansion_ready: 'sales',
  unresolved_issues: 'support',
  // Sales queues
  follow_ups: 'sales',
  stalled_deals: 'sales',
  new_leads: 'sales',
  // Onboarding queues
  blocked: 'onboarding',
  due_this_week: 'onboarding',
  new_kickoffs: 'onboarding',
  // Support queues
  sla_breaches: 'support',
  high_severity: 'support',
  unassigned: 'support',
};

interface WorkItemPreviewPaneProps {
  queueItem: QueueItem;
  queueConfig: QueueConfig | null;
  customerHubData: CustomerHubData | null;
  isLoading: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onResolve?: (item: QueueItem, action: string) => Promise<void>;
  className?: string;
}

// Map QueueItem source_type to WorkItemSourceType
function mapSourceType(source: QueueItem['source_type']): WorkItemSourceType {
  switch (source) {
    case 'communication': return 'communication';
    case 'support_case': return 'command_center';
    case 'company_product': return 'lifecycle_stage';
    case 'derived': return 'command_center';
    default: return 'command_center';
  }
}

// Derive signal type from queue and urgency
function deriveSignalType(queueId: string, urgency: string): WorkItemSignalType {
  const signalMap: Record<string, WorkItemSignalType> = {
    at_risk: 'churn_risk',
    expansion_ready: 'expansion_ready',
    unresolved_issues: 'case_opened',
    follow_ups: 'follow_up_due',
    stalled_deals: 'deal_stalled',
    new_leads: 'follow_up_due',
    blocked: 'onboarding_blocked',
    due_this_week: 'milestone_due',
    new_kickoffs: 'milestone_due',
    sla_breaches: 'sla_breach',
    high_severity: 'case_escalated',
    unassigned: 'case_opened',
  };

  return signalMap[queueId] || 'follow_up_due';
}

// Generate "why here" explanation from queue item
function generateWhyHere(item: QueueItem, queueConfig: QueueConfig | null): string {
  if (item.urgency_reason) {
    return item.urgency_reason;
  }

  const templates: Record<string, string> = {
    at_risk: `Customer health has declined and may need immediate attention`,
    expansion_ready: `This customer shows strong engagement and potential for growth`,
    unresolved_issues: `There's an open support case requiring resolution`,
    follow_ups: `This opportunity needs your follow-up to keep momentum`,
    stalled_deals: `No activity on this deal - time to re-engage`,
    new_leads: `New opportunity to qualify and move forward`,
    blocked: `Onboarding is stuck and needs your intervention`,
    due_this_week: `Go-live is approaching - ensure everything is ready`,
    new_kickoffs: `New customer ready to start their journey`,
    sla_breaches: `Service level has been breached - urgent attention needed`,
    high_severity: `High severity issue requires priority handling`,
    unassigned: `Case needs an owner to take responsibility`,
  };

  return templates[item.queue_id] || 'This item needs your attention';
}

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
  high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  medium: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200' },
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
};

const signalIcons: Record<string, typeof AlertTriangle> = {
  message_needs_reply: MessageSquare,
  meeting_scheduled: Calendar,
  follow_up_due: Clock,
  promise_at_risk: AlertTriangle,
  sla_breach: AlertTriangle,
  churn_risk: TrendingUp,
  expansion_ready: TrendingUp,
  deal_stalled: Clock,
  onboarding_blocked: AlertTriangle,
  case_escalated: AlertTriangle,
  case_opened: MessageSquare,
  milestone_due: Calendar,
};

const ctaIcons: Record<string, typeof Reply> = {
  Reply: Reply,
  Calendar: Calendar,
  Phone: Phone,
  MessageSquare: MessageSquare,
  ArrowRight: TrendingUp,
  CheckCircle: CheckCircle,
  AlertTriangle: AlertTriangle,
  UserPlus: UserPlus,
  FileText: FileText,
  ListTodo: ListTodo,
  ExternalLink: ExternalLink,
  Check: CheckCircle,
  CheckSquare: CheckSquare,
  Target: Target,
  RefreshCw: RefreshCw,
  TrendingUp: TrendingUp,
};

function CTAButton({
  cta,
  onClick,
  variant = 'primary',
  isLoading = false,
}: {
  cta: ResolverCTA;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'quick';
  isLoading?: boolean;
}) {
  const Icon = ctaIcons[cta.icon] || Zap;

  if (variant === 'primary') {
    return (
      <Button
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          'flex-1 justify-center gap-2',
          cta.variant === 'destructive' && 'bg-red-600 hover:bg-red-700'
        )}
      >
        <Icon className="h-4 w-4" />
        {cta.label}
      </Button>
    );
  }

  if (variant === 'secondary') {
    return (
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading}
        className="justify-center gap-2"
      >
        <Icon className="h-4 w-4" />
        {cta.shortLabel}
      </Button>
    );
  }

  // Quick action
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {cta.shortLabel}
    </button>
  );
}

function CustomerHubSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-gray-200 rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-4 w-20 bg-gray-200 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkItemPreviewPane({
  queueItem,
  queueConfig,
  customerHubData,
  isLoading,
  isExpanded,
  onToggleExpand,
  onClose,
  onResolve,
  className,
}: WorkItemPreviewPaneProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  const [isCommsDrawerOpen, setIsCommsDrawerOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const { config: lensConfig } = useLens();

  // Determine default tab for customer hub link
  const customerHubTab = QUEUE_TO_TAB[queueItem.queue_id] || (lensConfig.defaultCustomerTab as CustomerHubTab);
  const customerHubUrl = `/companies/${queueItem.company_id}?tab=${customerHubTab}&from_work=${queueItem.id}`;

  // Extract communication references from metadata for deep linking
  const triggerCommunicationId = queueItem.metadata?.trigger_communication_id as string | undefined ||
                                  queueItem.metadata?.communication_id as string | undefined ||
                                  (queueItem.source_type === 'communication' ? queueItem.source_id : undefined);
  const triggerMessageId = queueItem.metadata?.trigger_message_id as string | undefined;

  // Convert QueueItem to WorkItemDetailProjection-like structure for CTA resolution
  const workItemLike: WorkItemDetailProjection = {
    work_item_id: queueItem.id,
    focus_lens: queueConfig?.lens || 'customer_success',
    queue_id: queueItem.queue_id,
    company_id: queueItem.company_id,
    company_name: queueItem.company_name,
    deal_id: null,
    case_id: queueItem.metadata?.case_id as string || null,
    communication_id: triggerCommunicationId || null,
    contact_id: null,
    // Deep linking references
    trigger_communication_id: triggerCommunicationId || null,
    trigger_message_id: triggerMessageId || null,
    source_type: mapSourceType(queueItem.source_type),
    signal_type: deriveSignalType(queueItem.queue_id, queueItem.urgency),
    signal_id: queueItem.source_id,
    title: queueItem.title,
    subtitle: queueItem.subtitle || '',
    why_here: generateWhyHere(queueItem, queueConfig),
    priority: queueItem.urgency,
    priority_score: queueItem.priority_score,
    status: 'open',
    snoozed_until: null,
    assigned_to_user_id: null,
    assigned_to_team_id: null,
    resolution_type: null,
    resolution_notes: null,
    resolved_by_action: null,
    resolved_at: null,
    attached_signals: [],
    analysis_artifact_id: null,
    created_at: queueItem.created_at,
    updated_at: queueItem.last_activity_at || queueItem.created_at,
    last_event_sequence: 0,
  };

  // Handle successful reply (may resolve work item)
  const handleReplySuccess = useCallback(async () => {
    // If this work item can be resolved by a reply, trigger resolution
    if (onResolve && workItemLike.signal_type === 'message_needs_reply') {
      await onResolve(queueItem, 'replied');
    }
    setIsCommsDrawerOpen(false);
  }, [onResolve, queueItem, workItemLike.signal_type]);

  // Handle successful scheduling (may resolve work item when meeting is booked)
  const handleSchedulingSuccess = useCallback(async (schedulingRequestId: string, meetingBooked: boolean) => {
    console.log('Scheduling request created:', schedulingRequestId, 'Meeting booked:', meetingBooked);
    // Resolution happens when meeting is actually booked (not just requested for most signal types)
    // The scheduler system will emit MeetingBooked event when confirmed
    // For now, we close the modal - resolution will be handled by the event processor
    setIsSchedulerModalOpen(false);
  }, []);

  const { primary, secondary, quickActions } = getAllCTAs(workItemLike);
  const priority = priorityConfig[queueItem.urgency];
  const SignalIcon = signalIcons[workItemLike.signal_type] || Info;

  const handleAction = useCallback(async (cta: ResolverCTA) => {
    if (!onResolve) {
      // Just log for now if no resolver provided
      console.log('Action:', cta.action, 'on item:', queueItem.id);
      return;
    }

    setIsActionLoading(true);
    try {
      await onResolve(queueItem, cta.action);
    } finally {
      setIsActionLoading(false);
    }
  }, [queueItem, onResolve]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {queueItem.company_name}
            </p>
            <Badge
              variant="outline"
              className={cn('shrink-0', priority.bgColor, priority.color, priority.borderColor)}
            >
              {priority.label}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {queueConfig?.name} → {queueConfig?.defaultTab}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={isDetailsCollapsed ? 'Show details' : 'Hide details'}
          >
            {isDetailsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={onToggleExpand}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Details Section */}
      {!isDetailsCollapsed && (
        <div className="bg-white border-b border-gray-200 shrink-0">
          {/* Why Here */}
          <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">
                  Why This Is Here
                </p>
                <p className="text-sm text-amber-900 mt-0.5">
                  {workItemLike.why_here}
                </p>
              </div>
            </div>
          </div>

          {/* Trigger Signal */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded border border-gray-200">
                <SignalIcon className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 capitalize">
                  {workItemLike.signal_type.replace(/_/g, ' ')}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {queueItem.days_in_queue > 0 ? `${queueItem.days_in_queue}d ago` : 'Today'}
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <CTAButton
                cta={primary}
                onClick={() => handleAction(primary)}
                variant="primary"
                isLoading={isActionLoading}
              />
              {secondary.slice(0, 2).map((cta) => (
                <CTAButton
                  key={cta.action}
                  cta={cta}
                  onClick={() => handleAction(cta)}
                  variant="secondary"
                  isLoading={isActionLoading}
                />
              ))}
            </div>
            {/* Quick actions + View Communications */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1">
                {quickActions.map((cta) => (
                  <CTAButton
                    key={cta.action}
                    cta={cta}
                    onClick={() => handleAction(cta)}
                    variant="quick"
                    isLoading={isActionLoading}
                  />
                ))}
              </div>
              {/* Open Customer Hub button */}
              <Link
                href={customerHubUrl}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-md transition-colors"
              >
                <Building className="h-3.5 w-3.5" />
                Open Customer
              </Link>
              {/* View Communications button */}
              <button
                onClick={() => setIsCommsDrawerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                View Comms
              </button>
              {/* Schedule Meeting button */}
              <button
                onClick={() => setIsSchedulerModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Hub */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {customerHubData ? (
          <CustomerHub data={customerHubData} isLoading={isLoading} />
        ) : isLoading ? (
          <CustomerHubSkeleton />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">Loading customer data...</p>
          </div>
        )}
      </div>

      {/* Communications Drawer - opens to triggering message for deep linking */}
      <CommunicationsDrawer
        isOpen={isCommsDrawerOpen}
        onClose={() => setIsCommsDrawerOpen(false)}
        companyId={queueItem.company_id}
        companyName={queueItem.company_name}
        highlightCommunicationId={triggerCommunicationId}
        highlightMessageId={triggerMessageId}
        workItemId={queueItem.id}
        workItemSignalType={workItemLike.signal_type}
        onReplySuccess={handleReplySuccess}
      />

      {/* Scheduler Modal - opens with prefilled context from work item */}
      <ScheduleMeetingModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setIsSchedulerModalOpen(false)}
        onSuccess={(requestId) => handleSchedulingSuccess(requestId, false)}
        companyId={queueItem.company_id}
        workItem={{
          id: queueItem.id,
          company_id: queueItem.company_id,
          company_name: queueItem.company_name,
          signal_type: workItemLike.signal_type,
          metadata: queueItem.metadata as Record<string, unknown>,
        }}
        linkedCommunication={
          triggerCommunicationId ? {
            id: triggerCommunicationId,
          } : undefined
        }
        onWorkItemResolved={() => onResolve?.(queueItem, 'meeting_scheduled')}
      />
    </div>
  );
}
