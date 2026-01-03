'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { QueueItem, QueueConfig } from '@/lib/work';
import { CustomerHubData } from '@/components/customerHub/types';
import { X, Maximize2, Minimize2, Mail, Calendar, CheckCircle, MessageSquare } from 'lucide-react';

interface WorkItemContextPanelProps {
  queueItem: QueueItem;
  queueConfig: QueueConfig | null;
  customerHubData: CustomerHubData | null;
  isLoading: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onOpenComms: () => void;
  onOpenScheduler: () => void;
  onOpenQuickBook?: () => void;
  onResolve?: (item: QueueItem, action: string) => Promise<void>;
  className?: string;
}

// Generate "why here" explanation from queue item
function generateWhyHere(item: QueueItem, queueConfig: QueueConfig | null): string {
  if (item.urgency_reason) {
    return item.urgency_reason;
  }

  const templates: Record<string, string> = {
    at_risk: 'Customer health has declined and may need immediate attention',
    expansion_ready: 'This customer shows strong engagement and potential for growth',
    unresolved_issues: 'There\'s an open support case requiring resolution',
    follow_ups: 'This opportunity needs your follow-up to keep momentum',
    stalled_deals: 'No activity on this deal — time to re-engage',
    new_leads: 'New opportunity to qualify and move forward',
    blocked: 'Onboarding is stuck and needs your intervention',
    due_this_week: 'Go-live is approaching — ensure everything is ready',
    new_kickoffs: 'New customer ready to start their journey',
    sla_breaches: 'Service level has been breached — urgent attention needed',
    high_severity: 'High severity issue requires priority handling',
    unassigned: 'Case needs an owner to take responsibility',
  };

  return templates[item.queue_id] || 'This item needs your attention';
}

// Derive primary action from queue
function getPrimaryAction(queueId: string): 'reply' | 'schedule' | 'resolve' {
  const replyQueues = ['follow_ups', 'unresolved_issues', 'sla_breaches', 'blocked'];
  const scheduleQueues = ['stalled_deals', 'new_leads', 'new_kickoffs', 'due_this_week'];

  if (replyQueues.includes(queueId)) return 'reply';
  if (scheduleQueues.includes(queueId)) return 'schedule';
  return 'resolve';
}

// Get CC category from metadata or derive from queue
function getCCCategory(item: QueueItem): string {
  if (item.metadata?.cc_category) {
    return item.metadata.cc_category as string;
  }

  const categoryMap: Record<string, string> = {
    at_risk: 'Churn signal',
    expansion_ready: 'Growth signal',
    unresolved_issues: 'Open issue',
    follow_ups: 'Needs response',
    stalled_deals: 'Follow-up due',
    new_leads: 'New opportunity',
    blocked: 'Needs customer action',
    due_this_week: 'Milestone due',
    new_kickoffs: 'New kickoff',
    sla_breaches: 'SLA breach',
    high_severity: 'Escalation signal',
    unassigned: 'Needs owner',
  };

  return categoryMap[item.queue_id] || 'Work item';
}

// Derive signal type from queue
function deriveSignalType(queueId: string): string {
  const signalMap: Record<string, string> = {
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

export function WorkItemContextPanel({
  queueItem,
  queueConfig,
  customerHubData,
  isLoading,
  isExpanded,
  onToggleExpand,
  onClose,
  onOpenComms,
  onOpenScheduler,
  onOpenQuickBook,
  onResolve,
  className,
}: WorkItemContextPanelProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);

  // Derive work item context
  const primaryAction = getPrimaryAction(queueItem.queue_id);
  const ccCategory = getCCCategory(queueItem);
  const whyHere = generateWhyHere(queueItem, queueConfig);
  const signalType = deriveSignalType(queueItem.queue_id);

  // Extract trigger communication from metadata
  const triggerFrom = queueItem.metadata?.trigger_from as string ||
                      (queueItem.source_type === 'communication' ? 'Contact' : 'System');
  const triggerWhen = queueItem.metadata?.trigger_when as string ||
                      (queueItem.days_in_queue > 0 ? `${queueItem.days_in_queue}d ago` : 'Today');
  const triggerText = queueItem.metadata?.trigger_text as string ||
                      queueItem.subtitle ||
                      'Communication or signal that requires attention';

  // AI interpretation (from metadata or generate)
  const aiSummary = queueItem.metadata?.ai_summary as string ||
                    `${queueItem.title}. Best action: ${primaryAction === 'reply' ? 'respond to message' : primaryAction === 'schedule' ? 'schedule meeting' : 'resolve issue'}.`;
  const aiBullets = (queueItem.metadata?.ai_bullets as string[][] || [
    ['communicationType', signalType.replace(/_/g, ' ')],
    ['playbook', queueConfig?.name || 'Standard workflow'],
    ['CC category', ccCategory],
  ]);

  // Handle primary action
  const handlePrimaryAction = useCallback(async () => {
    if (primaryAction === 'reply') {
      onOpenComms();
    } else if (primaryAction === 'schedule') {
      onOpenScheduler();
    } else if (onResolve) {
      setIsActionLoading(true);
      try {
        await onResolve(queueItem, 'resolved');
      } finally {
        setIsActionLoading(false);
      }
    }
  }, [primaryAction, onOpenComms, onOpenScheduler, onResolve, queueItem]);

  // Priority label
  const priorityLabel = queueItem.urgency.charAt(0).toUpperCase() + queueItem.urgency.slice(1);

  return (
    <div className={cn('flex flex-col h-full', className)} style={{ background: '#f6f8fb' }}>
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          padding: '14px',
          borderBottom: '1px solid #eef2f7',
          background: '#ffffff',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {/* Breadcrumbs */}
            <div style={{ fontSize: '12px', color: '#667085' }}>
              {queueConfig?.name || 'Queue'} › {ccCategory}
            </div>
            {/* Company Name */}
            <h1 style={{ marginTop: '6px', fontSize: '15px', fontWeight: 600, color: '#0b1220' }} className="truncate">
              {queueItem.company_name}
            </h1>
            {/* KV Pills */}
            <div className="flex gap-2 flex-wrap" style={{ marginTop: '10px' }}>
              <span
                className="inline-flex items-center"
                style={{
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: '1px solid #e6eaf0',
                  background: '#fbfcff',
                  fontSize: '12px',
                  color: '#667085',
                }}
              >
                <strong style={{ color: '#0b1220' }}>Primary</strong>
                {primaryAction.toUpperCase()}
              </span>
              <span
                className="inline-flex items-center"
                style={{
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: '1px solid #e6eaf0',
                  background: '#fbfcff',
                  fontSize: '12px',
                  color: '#667085',
                }}
              >
                <strong style={{ color: '#0b1220' }}>Priority</strong>
                {priorityLabel}
              </span>
              {queueItem.days_in_queue > 0 && (
                <span
                  className="inline-flex items-center"
                  style={{
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: '1px solid #e6eaf0',
                    background: '#fbfcff',
                    fontSize: '12px',
                    color: '#667085',
                  }}
                >
                  <strong style={{ color: '#0b1220' }}>Age</strong>
                  {queueItem.days_in_queue}d
                </span>
              )}
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 ml-4">
            <button
              onClick={onToggleExpand}
              style={{
                padding: '8px',
                borderRadius: '12px',
                border: '1px solid #e6eaf0',
                background: '#ffffff',
                color: '#667085',
                cursor: 'pointer',
              }}
              title={isExpanded ? 'Minimize' : 'Maximize'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '12px',
                border: '1px solid #e6eaf0',
                background: '#ffffff',
                color: '#667085',
                cursor: 'pointer',
              }}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px', background: '#f6f8fb' }}>
        <div className="flex flex-col" style={{ gap: '14px' }}>

          {/* Section 1: Triggering Communication */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e6eaf0',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Section Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #eef2f7',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#0b1220',
              }}
            >
              <span>Triggering communication</span>
              <span style={{ fontWeight: 400, color: '#667085' }}>opens at exact message</span>
            </div>
            {/* Section Body */}
            <div style={{ padding: '12px' }}>
              {/* Message Card */}
              <div
                style={{
                  border: '1px solid #e6eaf0',
                  borderRadius: '14px',
                  padding: '10px',
                  background: '#fbfcff',
                }}
              >
                {/* Message Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0b1220' }}>{triggerFrom}</div>
                  <div style={{ fontSize: '12px', color: '#667085' }}>{triggerWhen}</div>
                </div>
                {/* Message Text */}
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
                  {triggerText}
                </div>
                {/* Why it triggered box */}
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                    fontSize: '12px',
                    color: '#7c2d12',
                  }}
                >
                  <strong>Why it triggered Work:</strong> {whyHere}
                </div>
              </div>
              {/* View full conversation button */}
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={onOpenComms}
                  style={{
                    border: '1px solid #e6eaf0',
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#0b1220',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f7f9ff';
                    e.currentTarget.style.borderColor = '#d7deea';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#e6eaf0';
                  }}
                >
                  View full conversation
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Command Center Signal */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e6eaf0',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Section Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #eef2f7',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#0b1220',
              }}
            >
              <span>Command Center signal</span>
              <span style={{ fontWeight: 400, color: '#667085' }}>drives urgency + category</span>
            </div>
            {/* Section Body */}
            <div style={{ padding: '12px', fontSize: '12px', color: '#334155', lineHeight: 1.55 }}>
              <strong>{ccCategory}</strong> • {priorityLabel} priority • {queueItem.days_in_queue > 0 ? `${queueItem.days_in_queue}d in queue` : 'New today'}
            </div>
          </div>

          {/* Section 3: AI Interpretation */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e6eaf0',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Section Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #eef2f7',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#0b1220',
              }}
            >
              <span>AI interpretation (explainable)</span>
              <span style={{ fontWeight: 400, color: '#667085' }}>no keyword matching</span>
            </div>
            {/* Section Body */}
            <div style={{ padding: '12px' }}>
              {/* AI Box */}
              <div
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: '14px',
                  padding: '10px',
                  fontSize: '12px',
                  color: '#3b0764',
                }}
              >
                {aiSummary}
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', color: '#4c1d95' }}>
                  {aiBullets.map((bullet, idx) => (
                    <li key={idx}>
                      {bullet[0]}: <strong>{bullet[1]}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Resolver */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e6eaf0',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Section Header */}
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #eef2f7',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#0b1220',
              }}
            >
              <span>Resolver</span>
              <span style={{ fontWeight: 400, color: '#667085' }}>closes loop</span>
            </div>
            {/* Section Body */}
            <div style={{ padding: '12px' }}>
              {/* Resolver Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={onOpenComms}
                  style={{
                    border: '1px solid #e6eaf0',
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#0b1220',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f7f9ff';
                    e.currentTarget.style.borderColor = '#d7deea';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#e6eaf0';
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  View comms
                </button>

                {/* Schedule dropdown with two options */}
                {primaryAction === 'schedule' ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                      style={{
                        background: '#2563eb',
                        border: '1px solid #2563eb',
                        borderRadius: '12px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#1d4ed8';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#2563eb';
                      }}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: '2px' }}>
                        <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {showScheduleDropdown && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e6eaf0',
                          boxShadow: '0 10px 25px rgba(16, 24, 40, 0.15)',
                          zIndex: 100,
                          minWidth: '160px',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          onClick={() => {
                            setShowScheduleDropdown(false);
                            onOpenScheduler();
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'left',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontWeight: 500, color: '#0b1220' }}>AI Scheduler</span>
                          <span style={{ fontSize: '11px', color: '#667085' }}>Let AI handle scheduling</span>
                        </button>
                        <div style={{ height: '1px', background: '#e6eaf0' }} />
                        <button
                          onClick={() => {
                            setShowScheduleDropdown(false);
                            onOpenQuickBook?.();
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '12px',
                            textAlign: 'left',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontWeight: 500, color: '#0b1220' }}>Quick Book</span>
                          <span style={{ fontSize: '11px', color: '#667085' }}>Manually create meeting</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handlePrimaryAction}
                    disabled={isActionLoading}
                    style={{
                      background: '#2563eb',
                      border: '1px solid #2563eb',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      cursor: isActionLoading ? 'not-allowed' : 'pointer',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: isActionLoading ? 0.5 : 1,
                    }}
                    onMouseOver={(e) => {
                      if (!isActionLoading) {
                        e.currentTarget.style.background = '#1d4ed8';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#2563eb';
                    }}
                  >
                    {primaryAction === 'reply' && <Mail className="h-3.5 w-3.5" />}
                    {primaryAction === 'resolve' && <CheckCircle className="h-3.5 w-3.5" />}
                    {primaryAction === 'reply' ? 'Reply' : 'Resolve'}
                  </button>
                )}
              </div>
              {/* Resolver Note */}
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#667085', lineHeight: 1.5 }}>
                Resolver actions automatically resolve the Work item and emit lifecycle events.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
