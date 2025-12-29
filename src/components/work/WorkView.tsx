'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLens } from '@/lib/lens';
import { createClient } from '@/lib/supabase/client';
import { CommunicationsDrawer } from './CommunicationsDrawer';
import { WorkSchedulerModal } from './WorkSchedulerModal';
import { QuickBookModal } from '@/components/scheduler/QuickBookModal';
import { CustomerContext } from '@/components/communications/CustomerContext';
import { ConversationThread } from '@/components/communications/ConversationThread';
import { WorkItemDetailProjection } from '@/lib/work/projections';
import { WorkItemSourceType, WorkItemSignalType } from '@/lib/work/events';
import {
  QueueId,
  QueueItem,
  QueueResult,
  QueueStats,
  QueueConfig,
  QUEUE_CONFIGS,
  getQueuesForLens,
  getDefaultQueue,
  getQueueConfig,
  fetchQueueItems,
} from '@/lib/work';
import { DailyDriverItem, DailyDriverResponse } from '@/types/operatingLayer';
import { TimeBlock, GetDailyPlanResponse } from '@/types/commandCenter';
import { MeetingPrepPopout } from '@/components/commandCenter/MeetingPrepPopout';

// Map DailyDriverItem to QueueItem format
function mapDailyDriverToQueueItem(item: DailyDriverItem): QueueItem {
  const urgencyMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  return {
    id: item.id,
    company_id: item.company_id,
    company_name: item.company_name,
    company_domain: null,
    queue_id: 'action_now',
    title: item.company_name,
    subtitle: item.reason || item.recommended_action || null,
    urgency: urgencyMap[item.severity || 'medium'] || 'medium',
    urgency_reason: item.reason || null,
    priority_score: item.severity === 'critical' ? 100 : item.severity === 'high' ? 80 : item.severity === 'medium' ? 50 : 20,
    days_in_queue: 0,
    mrr: item.mrr_estimate || null,
    health_score: null,
    owner_name: item.owner_name || null,
    source_type: item.source_type === 'communication' ? 'communication' : 'derived',
    source_id: item.source_id || null,
    created_at: item.created_at,
    last_activity_at: item.updated_at || null,
    metadata: {
      attention_level: item.attention_level,
      flag_type: item.flag_type,
      attention_flag_id: item.attention_flag_id,
      product_name: item.product_name,
      stage_name: item.stage_name,
      communication_id: item.communication_id,
      communication_subject: item.communication_subject,
      communication_preview: item.communication_preview,
      contact_name: item.contact_name,
      contact_email: item.contact_email,
      recommended_action: item.recommended_action,
      cc_category: item.flag_type ? item.flag_type.replace(/_/g, ' ').toLowerCase() : 'action item',
      ai_summary: item.reason || item.recommended_action,
    },
  };
}

// Fetch Action Now items from Daily Driver API
async function fetchActionNowItems(): Promise<QueueResult> {
  const actionNowConfig = QUEUE_CONFIGS.find(q => q.id === 'action_now')!;

  try {
    const res = await fetch('/api/daily-driver');
    if (!res.ok) throw new Error('Failed to fetch daily driver');

    const data: DailyDriverResponse = await res.json();

    // Map "now" items to QueueItems
    const items = data.byAttentionLevel.now.map(mapDailyDriverToQueueItem);

    // Calculate stats
    const stats: QueueStats = {
      total: items.length,
      critical: items.filter(i => i.urgency === 'critical').length,
      high: items.filter(i => i.urgency === 'high').length,
      medium: items.filter(i => i.urgency === 'medium').length,
      low: items.filter(i => i.urgency === 'low').length,
    };

    return {
      queue: actionNowConfig,
      items,
      stats,
      hasMore: false,
    };
  } catch (error) {
    console.error('Error fetching action now items:', error);
    return {
      queue: actionNowConfig,
      items: [],
      stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      hasMore: false,
    };
  }
}

// Map TimeBlock (meeting) to QueueItem format
function mapMeetingToQueueItem(meeting: TimeBlock): QueueItem {
  const startTime = new Date(meeting.start);
  const now = new Date();
  const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));

  // Determine urgency based on how soon the meeting is
  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'medium';
  if (minutesUntil < 0) urgency = 'low'; // Already started/passed
  else if (minutesUntil <= 15) urgency = 'critical'; // Starting very soon
  else if (minutesUntil <= 60) urgency = 'high'; // Starting within an hour
  else if (minutesUntil <= 120) urgency = 'medium'; // Starting within 2 hours

  const timeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    id: `meeting-${meeting.meeting_id || meeting.start}`,
    company_id: '', // Will be enriched from meeting prep if available
    company_name: meeting.meeting_title || 'Meeting',
    company_domain: null,
    queue_id: 'meeting_prep',
    title: meeting.meeting_title || 'Meeting',
    subtitle: `${timeStr} · ${meeting.duration_minutes} min${meeting.is_external ? ' · External' : ''}`,
    urgency,
    urgency_reason: minutesUntil <= 0 ? 'Meeting in progress' : `Starts in ${minutesUntil} minutes`,
    priority_score: Math.max(0, 100 - minutesUntil),
    days_in_queue: 0,
    mrr: null,
    health_score: null,
    owner_name: null,
    source_type: 'derived',
    source_id: meeting.meeting_id || null,
    created_at: meeting.start,
    last_activity_at: null,
    metadata: {
      meeting_id: meeting.meeting_id,
      meeting_title: meeting.meeting_title,
      start: meeting.start,
      end: meeting.end,
      duration_minutes: meeting.duration_minutes,
      is_external: meeting.is_external,
      cc_category: 'meeting prep',
      ai_summary: `Prepare for ${meeting.meeting_title || 'upcoming meeting'}`,
      time_block: meeting, // Store the full TimeBlock for MeetingPrepPopout
    },
  };
}

// Format date as YYYY-MM-DD in LOCAL timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Fetch Meeting Prep items from Command Center API (today + next business day)
async function fetchMeetingPrepItems(): Promise<QueueResult> {
  const meetingPrepConfig = QUEUE_CONFIGS.find(q => q.id === 'meeting_prep')!;

  try {
    // Calculate dates in LOCAL timezone
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Fetch today and tomorrow in parallel
    const [todayRes, tomorrowRes] = await Promise.all([
      fetch('/api/command-center'),
      fetch(`/api/command-center?date=${formatLocalDate(tomorrow)}`),
    ]);

    const responses = [
      { res: todayRes, label: 'Today', date: today },
      { res: tomorrowRes, label: 'Tomorrow', date: tomorrow },
    ];

    const now = new Date();
    const allMeetings: (TimeBlock & { _dayLabel: string })[] = [];

    for (const { res, label, date } of responses) {
      if (!res.ok) {
        console.warn(`[MeetingPrep] Failed to fetch command center for ${label}:`, res.status);
        continue;
      }

      const data: GetDailyPlanResponse = await res.json();
      const isToday = date.toDateString() === now.toDateString();

      // Debug: log what we received
      const allBlocks = data.plan?.time_blocks || [];
      const meetingBlocks = allBlocks.filter((block: TimeBlock) => block.type === 'meeting');
      console.log(`[MeetingPrep] ${label} (${formatLocalDate(date)}): totalBlocks=${allBlocks.length}, meetingBlocks=${meetingBlocks.length}`);
      console.log(`[MeetingPrep] All blocks:`, allBlocks);
      if (meetingBlocks.length === 0) {
        console.log(`[MeetingPrep] Block types present:`, allBlocks.map((b: TimeBlock) => b.type));
      }

      const meetings = allBlocks
        .filter((block: TimeBlock) => block.type === 'meeting' && block.meeting_id)
        .filter((block: TimeBlock) => {
          if (!isToday) return true; // Include all future day meetings
          // For today, only include future or recently started meetings
          const startTime = new Date(block.start);
          const minutesSinceStart = (now.getTime() - startTime.getTime()) / (1000 * 60);
          return minutesSinceStart < 30;
        })
        .map((block: TimeBlock) => ({ ...block, _dayLabel: label }));

      allMeetings.push(...meetings);
    }

    // Map to QueueItems
    const items = allMeetings.map((meeting) => {
      const item = mapMeetingToQueueItem(meeting);
      const dayLabel = meeting._dayLabel;

      if (dayLabel !== 'Today') {
        item.subtitle = `${dayLabel} · ${item.subtitle}`;
        // Future days' meetings are lower urgency
        item.urgency = 'low';
        item.priority_score = Math.max(0, item.priority_score - 50);
      }
      return item;
    });

    // Calculate stats based on urgency
    const stats: QueueStats = {
      total: items.length,
      critical: items.filter(i => i.urgency === 'critical').length,
      high: items.filter(i => i.urgency === 'high').length,
      medium: items.filter(i => i.urgency === 'medium').length,
      low: items.filter(i => i.urgency === 'low').length,
    };

    return {
      queue: meetingPrepConfig,
      items,
      stats,
      hasMore: false,
    };
  } catch (error) {
    console.error('Error fetching meeting prep items:', error);
    return {
      queue: meetingPrepConfig,
      items: [],
      stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      hasMore: false,
    };
  }
}

// Helper to format day label (Today, Tomorrow, or day name)
function formatDayLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Monday"
}

interface WorkViewProps {
  initialQueues: Map<QueueId, QueueResult>;
}

export function WorkView({ initialQueues }: WorkViewProps) {
  const { currentLens } = useLens();
  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), []);

  // Queue state
  const [queues, setQueues] = useState<Map<QueueId, QueueResult>>(initialQueues);
  const [selectedQueue, setSelectedQueue] = useState<QueueId | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);

  // Drawer and modal state
  const [isCommsDrawerOpen, setIsCommsDrawerOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [scheduleDropdownItemId, setScheduleDropdownItemId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [isMeetingPrepOpen, setIsMeetingPrepOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<TimeBlock | null>(null);

  // Initialize selected queue when lens changes
  useEffect(() => {
    const defaultQueue = getDefaultQueue(currentLens);
    if (defaultQueue && !selectedQueue) {
      setSelectedQueue(defaultQueue.id);
    }
  }, [currentLens, selectedQueue]);

  // Refresh queues when lens changes
  useEffect(() => {
    const loadQueues = async () => {
      const lensQueues = getQueuesForLens(currentLens);
      const newQueues = new Map<QueueId, QueueResult>();

      for (const queue of lensQueues) {
        try {
          // Special handling for action_now queue - fetch from daily driver API
          if (queue.id === 'action_now') {
            const result = await fetchActionNowItems();
            newQueues.set(queue.id, result);
          } else if (queue.id === 'meeting_prep') {
            const result = await fetchMeetingPrepItems();
            newQueues.set(queue.id, result);
          } else {
            const result = await fetchQueueItems(supabase, queue.id, { limit: 20 });
            newQueues.set(queue.id, result);
          }
        } catch (error) {
          console.error(`Error fetching queue ${queue.id}:`, error);
        }
      }

      setQueues(newQueues);

      // Reset selection if current queue isn't available in new lens
      if (selectedQueue && !newQueues.has(selectedQueue)) {
        const defaultQueue = getDefaultQueue(currentLens);
        setSelectedQueue(defaultQueue?.id || null);
        setSelectedItem(null);
      }
    };

    loadQueues();
  }, [currentLens, supabase]);

  // Handle item selection
  const handleSelectItem = (item: QueueItem) => {
    setSelectedItem(item);
  };

  // Handle queue selection
  const handleSelectQueue = (queueId: QueueId) => {
    setSelectedQueue(queueId);
    setSelectedItem(null);
  };

  // Close preview panel
  const handleClosePreview = () => {
    setSelectedItem(null);
    setIsExpanded(false);
    setIsCommsDrawerOpen(false);
    setIsSchedulerModalOpen(false);
  };

  // Handle successful reply (may resolve work item)
  const handleReplySuccess = useCallback(async () => {
    setIsCommsDrawerOpen(false);
    // Refresh queue items after reply
    const lensQueues = getQueuesForLens(currentLens);
    const newQueues = new Map<QueueId, QueueResult>();
    for (const queue of lensQueues) {
      try {
        const result = await fetchQueueItems(supabase, queue.id, { limit: 20 });
        newQueues.set(queue.id, result);
      } catch (error) {
        console.error(`Error refreshing queue ${queue.id}:`, error);
      }
    }
    setQueues(newQueues);
  }, [currentLens, supabase]);

  // Handle successful scheduling
  const handleSchedulingSuccess = useCallback(async (schedulingRequestId: string, meetingBooked: boolean) => {
    console.log('Scheduling request created:', schedulingRequestId, 'Meeting booked:', meetingBooked);
    setIsSchedulerModalOpen(false);
    // Refresh queue items
    const lensQueues = getQueuesForLens(currentLens);
    const newQueues = new Map<QueueId, QueueResult>();
    for (const queue of lensQueues) {
      try {
        const result = await fetchQueueItems(supabase, queue.id, { limit: 20 });
        newQueues.set(queue.id, result);
      } catch (error) {
        console.error(`Error refreshing queue ${queue.id}:`, error);
      }
    }
    setQueues(newQueues);
  }, [currentLens, supabase]);

  // Handle resolving a work item
  const handleResolve = useCallback(async (item: QueueItem) => {
    // Get IDs from metadata to determine resolution type
    const attentionFlagId = item.metadata?.attention_flag_id as string | undefined;
    const communicationId = item.metadata?.communication_id as string | undefined;

    try {
      let success = false;

      if (attentionFlagId) {
        // Resolve via attention flags endpoint
        const res = await fetch(`/api/attention-flags/${attentionFlagId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution_notes: 'Resolved from work queue' }),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error('[WorkView] Failed to resolve attention flag:', error);
          return;
        }

        console.log('[WorkView] Successfully resolved attention flag:', attentionFlagId);
        success = true;
      } else if (communicationId) {
        // Resolve via communications respond endpoint (mark as done)
        const res = await fetch(`/api/communications/${communicationId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Marked done from work queue' }),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error('[WorkView] Failed to mark communication as done:', error);
          return;
        }

        console.log('[WorkView] Successfully marked communication as done:', communicationId);
        success = true;
      } else {
        console.warn('[WorkView] No resolvable ID found for item:', item.id);
        // For items without attention flags or communications, just remove from view
        // This handles readyToClose items which don't have a resolve action yet
        return;
      }

      if (success) {
        // Clear selection
        setSelectedItem(null);

        // Refresh all queues to reflect the change
        const lensQueues = getQueuesForLens(currentLens);
        const newQueues = new Map<QueueId, QueueResult>();
        for (const queue of lensQueues) {
          try {
            if (queue.id === 'action_now') {
              const result = await fetchActionNowItems();
              newQueues.set(queue.id, result);
            } else if (queue.id === 'meeting_prep') {
              const result = await fetchMeetingPrepItems();
              newQueues.set(queue.id, result);
            } else {
              const result = await fetchQueueItems(supabase, queue.id, { limit: 20 });
              newQueues.set(queue.id, result);
            }
          } catch (error) {
            console.error(`Error refreshing queue ${queue.id}:`, error);
          }
        }
        setQueues(newQueues);
      }
    } catch (error) {
      console.error('[WorkView] Error resolving item:', error);
    }
  }, [currentLens, supabase]);

  // Get queue stats
  const queueStats = new Map<QueueId, QueueStats>();
  queues.forEach((result, queueId) => {
    queueStats.set(queueId, result.stats);
  });

  // Get selected queue data
  const selectedQueueConfig = selectedQueue ? getQueueConfig(selectedQueue) : null;
  const selectedQueueItems = selectedQueue ? (queues.get(selectedQueue)?.items || []) : [];

  // Helper to create WorkItemDetailProjection from QueueItem
  const createWorkItemProjection = useCallback((item: QueueItem): WorkItemDetailProjection => {
    const mapSourceType = (source: QueueItem['source_type']): WorkItemSourceType => {
      switch (source) {
        case 'communication': return 'communication';
        case 'support_case': return 'command_center';
        case 'company_product': return 'lifecycle_stage';
        case 'derived': return 'command_center';
        default: return 'command_center';
      }
    };

    const deriveSignalType = (queueId: string): WorkItemSignalType => {
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
    };

    const triggerCommunicationId = item.metadata?.trigger_communication_id as string | undefined ||
                                   item.metadata?.communication_id as string | undefined ||
                                   (item.source_type === 'communication' ? item.source_id : undefined);

    return {
      work_item_id: item.id,
      focus_lens: selectedQueueConfig?.lens || 'customer_success',
      queue_id: item.queue_id,
      company_id: item.company_id,
      company_name: item.company_name,
      deal_id: null,
      case_id: item.metadata?.case_id as string || null,
      communication_id: triggerCommunicationId || null,
      contact_id: null,
      trigger_communication_id: triggerCommunicationId || null,
      trigger_message_id: item.metadata?.trigger_message_id as string || null,
      source_type: mapSourceType(item.source_type),
      signal_type: deriveSignalType(item.queue_id),
      signal_id: item.source_id,
      title: item.title,
      subtitle: item.subtitle || '',
      why_here: item.urgency_reason || 'This item needs your attention',
      priority: item.urgency,
      priority_score: item.priority_score,
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
      created_at: item.created_at,
      updated_at: item.last_activity_at || item.created_at,
      last_event_sequence: 0,
    };
  }, [selectedQueueConfig]);

  // Calculate total items and critical count
  const lensQueues = getQueuesForLens(currentLens);
  const totalItems = Array.from(queues.values()).reduce((sum, q) => sum + q.items.length, 0);
  const criticalItems = Array.from(queues.values()).reduce(
    (sum, q) => sum + q.items.filter(i => i.urgency === 'critical').length, 0
  );

  // Get primary action for an item
  const getPrimaryAction = (queueId: string): 'reply' | 'schedule' | 'resolve' | 'prep' => {
    const replyQueues = ['follow_ups', 'unresolved_issues', 'sla_breaches', 'blocked'];
    const scheduleQueues = ['stalled_deals', 'new_leads', 'new_kickoffs', 'due_this_week'];
    if (queueId === 'meeting_prep') return 'prep';
    if (replyQueues.includes(queueId)) return 'reply';
    if (scheduleQueues.includes(queueId)) return 'schedule';
    return 'resolve';
  };

  // Get CC category for an item
  const getCCCategory = (item: QueueItem): string => {
    if (item.metadata?.cc_category) return item.metadata.cc_category as string;
    const categoryMap: Record<string, string> = {
      at_risk: 'Churn signal', expansion_ready: 'Growth signal', unresolved_issues: 'Open issue',
      follow_ups: 'Needs response', stalled_deals: 'Follow-up due', new_leads: 'New opportunity',
      blocked: 'Needs customer action', due_this_week: 'Milestone due', new_kickoffs: 'New kickoff',
      sla_breaches: 'SLA breach', high_severity: 'Escalation signal', unassigned: 'Needs owner',
    };
    return categoryMap[item.queue_id] || 'Work item';
  };

  // Generate why here text
  const getWhyHere = (item: QueueItem): string => {
    if (item.urgency_reason) return item.urgency_reason;
    const templates: Record<string, string> = {
      at_risk: 'Customer health declined', expansion_ready: 'Strong engagement and growth potential',
      unresolved_issues: 'Open support case', follow_ups: 'Needs follow-up to keep momentum',
      stalled_deals: 'No recent activity', new_leads: 'New opportunity to qualify',
      blocked: 'Onboarding stuck', due_this_week: 'Go-live approaching',
      new_kickoffs: 'Ready to start', sla_breaches: 'SLA breached',
      high_severity: 'High severity issue', unassigned: 'Needs an owner',
    };
    return templates[item.queue_id] || 'Needs attention';
  };

  return (
    <div
      className="h-[calc(100vh-4rem)]"
      style={{
        display: 'grid',
        gridTemplateColumns: isExpanded ? '0 1fr 0' : selectedItem ? '420px 1fr 320px' : '1fr',
        gap: '0',
        background: '#f6f8fb',
      }}
    >
      {/* Left column: Queues + Items stacked */}
      <div
        className={cn('flex flex-col transition-all duration-300', isExpanded && 'overflow-hidden')}
        style={{
          borderRight: '1px solid #e6eaf0',
          background: '#ffffff',
          height: 'calc(100vh - 4rem)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #eef2f7',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b1220' }}>Work Queues</div>
          <div style={{ fontSize: '12px', color: '#667085', marginTop: '4px' }}>
            {totalItems} items • {criticalItems} critical
          </div>
        </div>

        {/* Queue Segments */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lensQueues.map((queue) => {
            const queueData = queues.get(queue.id);
            const count = queueData?.items.length || 0;
            const isSelected = selectedQueue === queue.id;

            return (
              <button
                key={queue.id}
                onClick={() => handleSelectQueue(queue.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e6eaf0',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#1d4ed8' : '#0b1220' }}>
                    {queue.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>
                    {queue.description}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isSelected ? '#1d4ed8' : '#667085',
                    background: isSelected ? '#dbeafe' : '#f1f5f9',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {count}
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#eef2f7', margin: '4px 16px' }} />

        {/* Queue Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {queueLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#667085', fontSize: '13px' }}>
              Loading...
            </div>
          ) : selectedQueueItems.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#667085', fontSize: '13px' }}>
              No items in this queue
            </div>
          ) : (
            selectedQueueItems.map((item) => {
              const primaryAction = getPrimaryAction(item.queue_id);
              const ccCategory = getCCCategory(item);
              const whyHere = getWhyHere(item);
              const isItemSelected = selectedItem?.id === item.id;
              const mrr = item.metadata?.mrr as number || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    background: isItemSelected ? '#f8fafc' : '#ffffff',
                    border: isItemSelected ? '1px solid #2563eb' : '1px solid #e6eaf0',
                    borderRadius: '14px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {/* Top row: Company + Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0b1220' }}>
                      {item.company_name}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: item.urgency === 'critical' ? '#fef2f2' : item.urgency === 'high' ? '#fff7ed' : '#f0fdf4',
                        color: item.urgency === 'critical' ? '#dc2626' : item.urgency === 'high' ? '#ea580c' : '#16a34a',
                      }}
                    >
                      {item.urgency}
                    </span>
                  </div>

                  {/* Subtitle */}
                  {item.subtitle && (
                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                      {item.subtitle}
                    </div>
                  )}

                  {/* Pills row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#f5f3ff',
                        color: '#6d28d9',
                      }}
                    >
                      {ccCategory}
                    </span>
                    {mrr > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#ecfdf5',
                          color: '#059669',
                        }}
                      >
                        ${mrr.toLocaleString()}/mo
                      </span>
                    )}
                    {item.days_in_queue > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#fef3c7',
                          color: '#b45309',
                        }}
                      >
                        {item.days_in_queue}d
                      </span>
                    )}
                  </div>

                  {/* Why this is here */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      marginTop: '8px',
                      padding: '8px',
                      borderRadius: '8px',
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>💡</span>
                    <span style={{ fontSize: '11px', color: '#7c2d12', lineHeight: 1.4 }}>
                      {whyHere}
                    </span>
                  </div>

                  {/* AI Interpretation */}
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#f5f3ff',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#6d28d9', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      AI Interpretation
                    </div>
                    <div style={{ fontSize: '11px', color: '#3b0764', lineHeight: 1.4 }}>
                      {item.metadata?.ai_summary as string ||
                        `${item.title}. Best action: ${primaryAction === 'reply' ? 'respond to message' : primaryAction === 'schedule' ? 'schedule meeting' : primaryAction === 'prep' ? 'review meeting prep' : 'resolve issue'}.`}
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#ede9fe', color: '#5b21b6' }}>
                        {ccCategory}
                      </span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#ede9fe', color: '#5b21b6' }}>
                        {selectedQueueConfig?.name || 'Standard workflow'}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                    {primaryAction !== 'prep' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
                          setIsCommsDrawerOpen(true);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #e6eaf0',
                          background: '#ffffff',
                          color: '#0b1220',
                          cursor: 'pointer',
                        }}
                      >
                        View comms
                      </button>
                    )}
                    {primaryAction === 'prep' ? (
                      /* Meeting Prep button */
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const timeBlock = item.metadata?.time_block as TimeBlock;
                          if (timeBlock) {
                            setSelectedMeeting(timeBlock);
                            setIsMeetingPrepOpen(true);
                          }
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid #7c3aed',
                          background: '#7c3aed',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        View Prep
                      </button>
                    ) : primaryAction === 'schedule' ? (
                      /* Schedule dropdown with two options */
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(item);
                            setScheduleDropdownItemId(
                              scheduleDropdownItemId === item.id ? null : item.id
                            );
                          }}
                          style={{
                            fontSize: '11px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #2563eb',
                            background: '#2563eb',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Schedule
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: '2px' }}>
                            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        {scheduleDropdownItemId === item.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
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
                                setScheduleDropdownItemId(null);
                                setIsSchedulerModalOpen(true);
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
                                setScheduleDropdownItemId(null);
                                setIsQuickBookOpen(true);
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
                    ) : primaryAction === 'reply' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
                          setIsCommsDrawerOpen(true);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #2563eb',
                          background: '#2563eb',
                          color: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        Reply
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(item);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #16a34a',
                          background: '#16a34a',
                          color: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Middle column: Conversation Thread (same as Communications tab) */}
      {selectedItem && (
        <div
          className={cn('flex flex-col transition-all duration-300', isExpanded && 'w-full')}
          style={{ background: '#ffffff', overflow: 'hidden', height: 'calc(100vh - 4rem)' }}
        >
          <ConversationThread
            companyId={selectedItem.company_id}
            companyName={selectedItem.company_name}
            channelFilter={channelFilter}
          />
        </div>
      )}

      {/* Right column: Company Context Panel */}
      {selectedItem && (
        <div
          className={cn('transition-all duration-300', isExpanded && 'w-0 overflow-hidden')}
          style={{
            height: 'calc(100vh - 4rem)',
            overflow: 'hidden',
          }}
        >
          <CustomerContext
            companyId={selectedItem.company_id}
          />
        </div>
      )}

      {/* Communications Drawer */}
      {selectedItem && (
        <CommunicationsDrawer
          isOpen={isCommsDrawerOpen}
          onClose={() => setIsCommsDrawerOpen(false)}
          companyId={selectedItem.company_id}
          companyName={selectedItem.company_name}
          highlightCommunicationId={
            selectedItem.metadata?.trigger_communication_id as string ||
            selectedItem.metadata?.communication_id as string ||
            (selectedItem.source_type === 'communication' ? selectedItem.source_id : undefined)
          }
          workItemId={selectedItem.id}
          workItemSignalType={createWorkItemProjection(selectedItem).signal_type}
          onReplySuccess={handleReplySuccess}
          onSchedule={() => {
            setIsCommsDrawerOpen(false);
            setIsSchedulerModalOpen(true);
          }}
          onQuickBook={() => {
            setIsCommsDrawerOpen(false);
            setIsQuickBookOpen(true);
          }}
        />
      )}

      {/* Scheduler Modal */}
      {selectedItem && (
        <WorkSchedulerModal
          isOpen={isSchedulerModalOpen}
          onClose={() => setIsSchedulerModalOpen(false)}
          onSuccess={handleSchedulingSuccess}
          workItem={selectedItem}
          workItemProjection={createWorkItemProjection(selectedItem)}
        />
      )}

      {/* Quick Book Modal */}
      {selectedItem && (
        <QuickBookModal
          isOpen={isQuickBookOpen}
          onClose={() => setIsQuickBookOpen(false)}
          onSuccess={() => {
            setIsQuickBookOpen(false);
            // Refresh queues after booking
            const refreshQueues = async () => {
              const lensQueues = getQueuesForLens(currentLens);
              const newQueues = new Map<QueueId, QueueResult>();
              for (const queue of lensQueues) {
                try {
                  const result = await fetchQueueItems(supabase, queue.id, { limit: 20 });
                  newQueues.set(queue.id, result);
                } catch (error) {
                  console.error(`Error refreshing queue ${queue.id}:`, error);
                }
              }
              setQueues(newQueues);
            };
            refreshQueues();
          }}
          companyId={selectedItem.company_id}
        />
      )}

      {/* Meeting Prep Popout */}
      {isMeetingPrepOpen && selectedMeeting && (
        <MeetingPrepPopout
          meeting={selectedMeeting}
          onClose={() => {
            setIsMeetingPrepOpen(false);
            setSelectedMeeting(null);
          }}
        />
      )}
    </div>
  );
}
