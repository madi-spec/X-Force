'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useLens } from '@/lib/lens';
import { Sparkles, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CommunicationsDrawer } from './CommunicationsDrawer';
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { QuickBookModal } from '@/components/scheduler/QuickBookModal';
import { WorkItemCard } from './WorkItemCard';
import { TriagePanel } from './TriagePanel';
import { ResolveModal } from './ResolveModal';
import { QueueSelector } from './QueueSelector';
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
  getActionVerb,
} from '@/lib/work';
import { DailyDriverItem, DailyDriverResponse } from '@/types/operatingLayer';
import { TimeBlock, GetDailyPlanResponse } from '@/types/commandCenter';
import { MeetingPrepPopout } from '@/components/commandCenter/MeetingPrepPopout';

// Queue dot colors mapping
function getQueueDotColor(queueId: QueueId | null): string {
  const colorMap: Record<string, string> = {
    action_now: '#dc2626',      // red-600
    meeting_prep: '#9333ea',    // purple-600
    at_risk: '#b91c1c',         // red-700
    expansion_ready: '#7e22ce', // purple-700
    unresolved_issues: '#c2410c', // orange-700
    follow_ups: '#1d4ed8',      // blue-700
    stalled_deals: '#b45309',   // amber-700
    new_leads: '#15803d',       // green-700
    blocked: '#b91c1c',         // red-700
    due_this_week: '#1d4ed8',   // blue-700
    new_kickoffs: '#7e22ce',    // purple-700
    sla_breaches: '#b91c1c',    // red-700
    high_severity: '#c2410c',   // orange-700
    unassigned: '#4b5563',      // gray-600
  };
  return queueId ? (colorMap[queueId] || '#667085') : '#667085';
}

// Calculate waiting time as human-readable string
function calculateWaitingTimeForItem(createdAt: string): string | null {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

// Map DailyDriverItem to QueueItem format
function mapDailyDriverToQueueItem(item: DailyDriverItem): QueueItem {
  const urgencyMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  // Use email subject as subtitle, fall back to contact info
  const subtitle = item.communication_subject
    || (item.contact_name ? `From ${item.contact_name}` : null)
    || (item.contact_email ? `From ${item.contact_email}` : null);

  // Derive action type from flag_type or recommended_action
  const actionType = item.flag_type || item.recommended_action || null;

  // Build context for action verb detection
  const urgencyReason = item.reason || null;

  return {
    id: item.id,
    company_id: item.company_id,
    company_name: item.company_name,
    company_domain: null,
    queue_id: 'action_now',
    title: item.company_name,
    subtitle,
    urgency: urgencyMap[item.severity || 'medium'] || 'medium',
    urgency_reason: urgencyReason,

    // New action-oriented fields - pass context for smarter verb detection
    action_verb: getActionVerb(actionType, 'action_now', {
      urgency_reason: urgencyReason,
      description: item.communication_preview,
      title: item.company_name,
      subtitle,
    }),
    thread_count: 1, // Default to 1 for daily driver items
    waiting_time: calculateWaitingTimeForItem(item.created_at),
    contact_name: item.contact_name || null,
    stage: item.stage_name || null,

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
// When fetchAll=true, includes all attention levels (now, soon, monitor)
async function fetchActionNowItems(fetchAll: boolean = false): Promise<QueueResult> {
  const actionNowConfig = QUEUE_CONFIGS.find(q => q.id === 'action_now')!;

  try {
    const res = await fetch('/api/daily-driver');
    if (!res.ok) throw new Error('Failed to fetch daily driver');

    const data: DailyDriverResponse = await res.json();

    // When fetchAll=true (for "All" view), include all attention levels
    // Otherwise, only include "now" items for the Action Now queue
    let itemsToMap: DailyDriverItem[];
    if (fetchAll) {
      itemsToMap = [
        ...data.byAttentionLevel.now,
        ...data.byAttentionLevel.soon,
        ...data.byAttentionLevel.monitor,
      ];
    } else {
      itemsToMap = data.byAttentionLevel.now;
    }

    const items = itemsToMap.map(mapDailyDriverToQueueItem);

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

  // Calculate waiting time for meeting prep
  const waitingTime = minutesUntil <= 0
    ? 'now'
    : minutesUntil < 60
      ? `${minutesUntil} min${minutesUntil !== 1 ? 's' : ''}`
      : `${Math.floor(minutesUntil / 60)} hour${Math.floor(minutesUntil / 60) !== 1 ? 's' : ''}`;

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

    // New action-oriented fields
    action_verb: 'Prepare',
    thread_count: 1,
    waiting_time: waitingTime,
    contact_name: null,
    stage: null,

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

    // Map to QueueItems and enrich with company data
    const items = await Promise.all(allMeetings.map(async (meeting) => {
      const item = mapMeetingToQueueItem(meeting);
      const dayLabel = meeting._dayLabel;

      if (dayLabel !== 'Today') {
        item.subtitle = `${dayLabel} · ${item.subtitle}`;
        // Future days' meetings are lower urgency
        item.urgency = 'low';
        item.priority_score = Math.max(0, item.priority_score - 50);
      }

      // Try to get company_id from meeting prep API
      if (meeting.meeting_id) {
        try {
          const prepRes = await fetch(`/api/calendar/${meeting.meeting_id}/prep`);
          if (prepRes.ok) {
            const prepData = await prepRes.json();
            if (prepData.company_id) {
              item.company_id = prepData.company_id;
              item.company_name = prepData.company_name || item.company_name;
            }
          }
        } catch (err) {
          console.warn(`[MeetingPrep] Could not fetch prep for ${meeting.meeting_id}:`, err);
        }
      }

      return item;
    }));

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

// Helper function to generate action descriptions for AI Summary
function getActionDescription(actionVerb: string): string {
  switch (actionVerb) {
    case 'Reply':
      return 'Respond to their question or request.';
    case 'Schedule':
      return 'Confirm or propose meeting times.';
    case 'Follow up':
      return 'Check in on progress or next steps.';
    case 'Prepare':
      return 'Review materials before the upcoming meeting.';
    case 'Escalate':
      return 'Address this urgently to prevent churn risk.';
    case 'Approve':
      return 'Review and approve the expansion opportunity.';
    default:
      return 'Review and take appropriate action.';
  }
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
  const [selectedQueue, setSelectedQueue] = useState<QueueId | null>(() => {
    // Initialize to default queue for current lens
    const defaultQueue = getDefaultQueue(currentLens);
    return defaultQueue?.id || null;
  });
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // All Daily Driver items (for "All" view - includes soon/monitor levels not shown in action_now)
  const [allDailyDriverItems, setAllDailyDriverItems] = useState<QueueItem[]>([]);

  // Track previous lens to detect lens changes
  const prevLensRef = useRef(currentLens);

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);

  // Drawer and modal state
  const [isCommsDrawerOpen, setIsCommsDrawerOpen] = useState(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [isMeetingPrepOpen, setIsMeetingPrepOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<TimeBlock | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [pendingResolveItem, setPendingResolveItem] = useState<QueueItem | null>(null);

  // Reset to default queue only when lens actually changes (not when user selects "All")
  useEffect(() => {
    if (prevLensRef.current !== currentLens) {
      // Lens changed - reset to default queue for new lens
      const defaultQueue = getDefaultQueue(currentLens);
      if (defaultQueue) {
        setSelectedQueue(defaultQueue.id);
      }
      prevLensRef.current = currentLens;
    }
  }, [currentLens]);

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

      // Also fetch ALL Daily Driver items (including soon/monitor) for "All" view
      try {
        const allDDResult = await fetchActionNowItems(true); // fetchAll=true
        setAllDailyDriverItems(allDDResult.items);
      } catch (error) {
        console.error('Error fetching all daily driver items:', error);
        setAllDailyDriverItems([]);
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

  // Open resolve modal for an item
  const handleOpenResolveModal = useCallback((item: QueueItem) => {
    setPendingResolveItem(item);
    setIsResolveModalOpen(true);
  }, []);

  // Handle resolving a work item with a reason
  const handleResolve = useCallback(async (item: QueueItem, resolutionReason: string) => {
    // Get IDs from metadata to determine resolution type
    const attentionFlagId = item.metadata?.attention_flag_id as string | undefined;
    const communicationId = item.metadata?.communication_id as string | undefined;

    // Extract raw UUID from prefixed item ID (e.g., "af-uuid" -> "uuid")
    const extractRawId = (prefixedId: string): string | null => {
      const match = prefixedId.match(/^(?:af|comm|cp)-(.+)$/);
      return match ? match[1] : null;
    };

    console.log('[WorkView] Resolving item:', {
      id: item.id,
      attentionFlagId,
      communicationId,
      resolutionReason,
      metadata: item.metadata,
    });

    try {
      let success = false;
      let resolveMethod = 'none';

      if (attentionFlagId) {
        // Resolve via attention flags endpoint
        resolveMethod = 'attention_flag';
        const res = await fetch(`/api/attention-flags/${attentionFlagId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution_notes: resolutionReason }),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error('[WorkView] Failed to resolve attention flag:', error);
          // Don't return - still clear selection and refresh
        } else {
          console.log('[WorkView] Successfully resolved attention flag:', attentionFlagId);
          success = true;
        }
      } else if (communicationId) {
        // Resolve via communications respond endpoint (mark as done)
        resolveMethod = 'communication';
        const res = await fetch(`/api/communications/${communicationId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: resolutionReason }),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error('[WorkView] Failed to mark communication as done:', error);
          // Don't return - still clear selection and refresh
        } else {
          console.log('[WorkView] Successfully marked communication as done:', communicationId);
          success = true;
        }
      } else {
        // No specific IDs in metadata - try to infer from item ID prefix
        const rawId = extractRawId(item.id);
        console.log('[WorkView] No direct IDs found, extracted raw ID:', rawId, 'from', item.id);

        if (item.id.startsWith('af-') && rawId) {
          // This is an attention flag item - resolve via attention flags API
          resolveMethod = 'attention_flag_from_id';
          const res = await fetch(`/api/attention-flags/${rawId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution_notes: resolutionReason }),
          });

          if (res.ok) {
            console.log('[WorkView] Successfully resolved attention flag via ID:', rawId);
            success = true;
          } else {
            console.error('[WorkView] Failed to resolve attention flag via ID:', rawId);
          }
        } else if (item.id.startsWith('comm-') && rawId) {
          // This is a communication item - mark as responded
          resolveMethod = 'communication_from_id';
          const res = await fetch(`/api/communications/${rawId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: resolutionReason }),
          });

          if (res.ok) {
            console.log('[WorkView] Successfully marked communication as done via ID:', rawId);
            success = true;
          } else {
            console.error('[WorkView] Failed to mark communication as done via ID:', rawId);
          }
        } else if (item.id.startsWith('cp-') && rawId) {
          // This is a company_product item (readyToClose) - mark as won/closed
          resolveMethod = 'company_product';
          const res = await fetch(`/api/company-products/${rawId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: resolutionReason }),
          });

          if (res.ok) {
            console.log('[WorkView] Successfully resolved company product:', rawId);
            success = true;
          } else {
            // Company product resolve endpoint may not exist yet - that's OK
            console.log('[WorkView] Company product resolve not available, proceeding anyway');
            success = true; // Mark as success to trigger refresh
          }
        } else {
          // No prefix found - this might be a command_center_items record with raw UUID
          // Try to complete it via command_center_items API
          console.log('[WorkView] No prefix, trying command_center_items completion for:', item.id);
          resolveMethod = 'command_center_item';

          // First try completing via CC item endpoint
          const ccRes = await fetch(`/api/command-center/${item.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution_notes: resolutionReason }),
          });

          if (ccRes.ok) {
            console.log('[WorkView] Successfully completed command center item:', item.id);
            success = true;
          } else {
            // If CC item endpoint doesn't exist, try source_id as attention flag
            const possibleFlagId = item.source_id;
            if (possibleFlagId) {
              try {
                const res = await fetch(`/api/attention-flags/${possibleFlagId}/resolve`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ resolution_notes: resolutionReason }),
                });

                if (res.ok) {
                  console.log('[WorkView] Successfully resolved via source_id:', possibleFlagId);
                  success = true;
                  resolveMethod = 'source_id_as_flag';
                }
              } catch {
                // Ignore errors - this was a fallback attempt
              }
            }

            // If still no success, log warning but proceed
            if (!success) {
              console.warn('[WorkView] No resolvable endpoint for item:', item.id);
              resolveMethod = 'view_only';
              success = true; // Mark as success to trigger refresh anyway
            }
          }
        }
      }

      console.log('[WorkView] Resolution result:', { success, resolveMethod });

      // Log activity for the company if we have a company_id
      if (success && item.company_id) {
        try {
          await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: item.company_id,
              type: 'work_item_resolved',
              title: `Work item resolved: ${item.title}`,
              description: resolutionReason,
              metadata: {
                queue_id: item.queue_id,
                resolve_method: resolveMethod,
                original_urgency: item.urgency,
              },
            }),
          });
          console.log('[WorkView] Activity logged for company:', item.company_id);
        } catch (activityError) {
          console.error('[WorkView] Failed to log activity:', activityError);
          // Don't fail the resolution if activity logging fails
        }
      }

      // Always clear selection and refresh to remove the item from view
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
      // Also refresh all Daily Driver items for "All" view
      try {
        const allDDResult = await fetchActionNowItems(true);
        setAllDailyDriverItems(allDDResult.items);
      } catch (error) {
        console.error('Error refreshing all daily driver items:', error);
      }
      setQueues(newQueues);
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

  // Helper: Deduplicate items by company_id, keeping highest priority item per company
  const deduplicateByCompany = useCallback((items: QueueItem[]): QueueItem[] => {
    const companyMap = new Map<string, QueueItem>();
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    for (const item of items) {
      const companyKey = item.company_id || `no_company_${item.id}`;
      const existing = companyMap.get(companyKey);

      if (!existing) {
        companyMap.set(companyKey, item);
      } else {
        // Keep the item with higher urgency, or if same urgency, higher priority score
        const existingUrgency = urgencyOrder[existing.urgency];
        const itemUrgency = urgencyOrder[item.urgency];

        if (itemUrgency < existingUrgency ||
            (itemUrgency === existingUrgency && item.priority_score > existing.priority_score)) {
          companyMap.set(companyKey, item);
        }
      }
    }

    return Array.from(companyMap.values());
  }, []);

  // When "All" is selected (null), show all items from all queues sorted by priority
  const selectedQueueItems = useMemo(() => {
    let items: QueueItem[];

    if (selectedQueue) {
      items = queues.get(selectedQueue)?.items || [];
    } else {
      // All queues - combine items from:
      // 1. All Daily Driver items (includes soon/monitor levels)
      // 2. Meeting prep items
      // 3. Other queue items (from command_center_items)
      // Deduplicate by id, keeping highest priority score
      const itemMap = new Map<string, QueueItem>();

      // First add all Daily Driver items (now, soon, monitor levels)
      allDailyDriverItems.forEach((item) => {
        itemMap.set(item.id, item);
      });

      // Then add items from other queues (meeting_prep, follow_ups, etc.)
      queues.forEach((result, queueId) => {
        // Skip action_now since allDailyDriverItems already has everything from Daily Driver
        if (queueId === 'action_now') return;

        result.items.forEach((item) => {
          // Keep the item with highest priority score if duplicates exist
          const existing = itemMap.get(item.id);
          if (!existing || item.priority_score > existing.priority_score) {
            itemMap.set(item.id, item);
          }
        });
      });

      items = Array.from(itemMap.values());
    }

    // Deduplicate by company - ONE card per company, highest priority wins
    const dedupedItems = deduplicateByCompany(items);

    // Sort: critical > high > medium > low, then by priority score
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return dedupedItems.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.priority_score - a.priority_score;
    });
  }, [selectedQueue, queues, allDailyDriverItems, deduplicateByCompany]);

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

  // Calculate total items and critical count for "All" view
  // Need to compute what "All" would show (deduplicated across all sources AND by company)
  const lensQueues = getQueuesForLens(currentLens);
  const allViewItems = useMemo(() => {
    const itemMap = new Map<string, QueueItem>();
    // Add all Daily Driver items
    allDailyDriverItems.forEach((item) => itemMap.set(item.id, item));
    // Add other queue items (skip action_now as DD covers it)
    queues.forEach((result, queueId) => {
      if (queueId === 'action_now') return;
      result.items.forEach((item) => {
        const existing = itemMap.get(item.id);
        if (!existing || item.priority_score > existing.priority_score) {
          itemMap.set(item.id, item);
        }
      });
    });
    // Apply company deduplication to match what's shown in the queue
    return deduplicateByCompany(Array.from(itemMap.values()));
  }, [queues, allDailyDriverItems, deduplicateByCompany]);

  const totalItems = allViewItems.length;
  const criticalItems = allViewItems.filter(i => i.urgency === 'critical').length;

  // Calculate deduplicated counts per queue for accurate tab badges
  const deduplicatedQueueCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    lensQueues.forEach((queue) => {
      const queueData = queues.get(queue.id);
      if (!queueData) {
        counts[queue.id] = 0;
        return;
      }

      // Apply deduplication to get accurate count
      const dedupedItems = deduplicateByCompany(queueData.items);
      // Also filter out Unknown Company items to match what's displayed
      const displayedItems = dedupedItems.filter((item) => {
        const companyName = item.company_name?.toLowerCase() || '';
        return !companyName.includes('unknown') && item.company_id;
      });
      counts[queue.id] = displayedItems.length;
    });

    return counts;
  }, [lensQueues, queues, deduplicateByCompany]);

  return (
    <div
      className="h-[calc(100vh-4rem)]"
      style={{
        display: 'grid',
        gridTemplateColumns: isExpanded ? '0 1fr 0' : selectedItem ? '420px 1fr 320px' : '1fr 400px',
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
        {/* Header with Queue Dropdown */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #eef2f7',
          }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0b1220' }}>Work</div>
            <div style={{ fontSize: '12px', color: '#667085' }}>
              {totalItems} items
              {criticalItems > 0 && (
                <span style={{ color: '#dc2626', marginLeft: '6px' }}>
                  • {criticalItems} critical
                </span>
              )}
            </div>
          </div>

          {/* Queue Dropdown Selector */}
          <QueueSelector
            queues={lensQueues.map((queue) => ({
              id: queue.id,
              name: queue.name,
              count: deduplicatedQueueCounts[queue.id] || 0,
              color: getQueueDotColor(queue.id),
            }))}
            selectedQueueId={selectedQueue}
            onSelect={(queueId) => {
              if (queueId === null) {
                setSelectedQueue(null);
                setSelectedItem(null);
              } else {
                handleSelectQueue(queueId as QueueId);
              }
            }}
            totalCount={totalItems}
          />
        </div>

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
          {(() => {
            if (queueLoading) {
              return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#667085', fontSize: '13px' }}>
                  Loading...
                </div>
              );
            }

            // Filter items before checking if empty
            const displayableItems = selectedQueueItems.filter((item) => {
              const companyName = item.company_name?.toLowerCase() || '';
              return !companyName.includes('unknown') && item.company_id;
            });

            if (displayableItems.length === 0) {
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 20px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    marginBottom: '16px',
                    borderRadius: '50%',
                    background: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CheckCircle style={{ width: '24px', height: '24px', color: '#16a34a' }} />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#0b1220', margin: 0 }}>
                    All caught up!
                  </p>
                  <p style={{ fontSize: '12px', color: '#667085', marginTop: '4px' }}>
                    {selectedQueue ? 'No items need attention in this queue' : 'No work items need attention'}
                  </p>
                </div>
              );
            }

            return displayableItems.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                isSelected={selectedItem?.id === item.id}
                onClick={() => handleSelectItem(item)}
              />
            ));
          })()}
        </div>
      </div>

      {/* Middle column: AI Summary + Conversation Thread */}
      {selectedItem && (
        <div
          className={cn('flex flex-col transition-all duration-300', isExpanded && 'w-full')}
          style={{ background: '#ffffff', overflow: 'hidden', height: 'calc(100vh - 4rem)' }}
        >
          {/* AI Summary Box */}
          <div
            style={{
              margin: '16px 24px',
              padding: '16px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles style={{ width: '16px', height: '16px', color: '#16a34a' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#15803d' }}>AI Summary</span>
            </div>
            <p style={{ fontSize: '14px', color: '#166534', lineHeight: 1.5, margin: 0 }}>
              {selectedItem.urgency_reason || selectedItem.subtitle || selectedItem.title}
            </p>
            {selectedItem.contact_name && (
              <p style={{ fontSize: '14px', color: '#166534', marginTop: '4px', marginBottom: 0 }}>
                {selectedItem.contact_name} is the primary contact.
              </p>
            )}
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#14532d', marginTop: '12px', marginBottom: 0 }}>
              → Action needed: {getActionDescription(selectedItem.action_verb)}
            </p>
          </div>

          {/* Conversation Thread */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ConversationThread
              companyId={selectedItem.company_id}
              companyName={selectedItem.company_name}
              channelFilter={channelFilter}
            />
          </div>
        </div>
      )}

      {/* Right column: Company Context Panel (when item selected) */}
      {selectedItem && (
        <div
          className={cn('transition-all duration-300 flex flex-col', isExpanded && 'w-0 overflow-hidden')}
          style={{
            height: 'calc(100vh - 4rem)',
            overflow: 'hidden',
          }}
        >
          {/* Action Buttons */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e6eaf0',
            flexShrink: 0,
          }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#667085',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}>
              Mark Item
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleOpenResolveModal(selectedItem)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#ffffff',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
              >
                Resolve
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#4b5563',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Snooze
              </button>
            </div>
          </div>

          {/* Customer Context */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CustomerContext
              companyId={selectedItem.company_id}
            />
          </div>
        </div>
      )}

      {/* Right column: Triage Panel (when no item selected) */}
      {!selectedItem && (
        <div
          style={{
            height: 'calc(100vh - 4rem)',
            overflow: 'hidden',
            borderLeft: '1px solid #e6eaf0',
          }}
        >
          <TriagePanel />
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
        <ScheduleMeetingModal
          isOpen={isSchedulerModalOpen}
          onClose={() => setIsSchedulerModalOpen(false)}
          onSuccess={(requestId) => handleSchedulingSuccess(requestId, false)}
          companyId={selectedItem.company_id}
          workItem={{
            id: selectedItem.id,
            company_id: selectedItem.company_id,
            company_name: selectedItem.company_name,
            signal_type: createWorkItemProjection(selectedItem).signal_type,
            metadata: selectedItem.metadata as Record<string, unknown>,
          }}
          linkedCommunication={
            selectedItem.metadata?.communication_id ? {
              id: selectedItem.metadata.communication_id as string,
            } : undefined
          }
          onWorkItemResolved={() => {
            // Refresh queue items after work item resolution
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

      {/* Resolve Modal */}
      <ResolveModal
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false);
          setPendingResolveItem(null);
        }}
        onConfirm={async (reason) => {
          if (pendingResolveItem) {
            await handleResolve(pendingResolveItem, reason);
          }
        }}
        companyName={pendingResolveItem?.company_name || ''}
        suggestedAction={
          typeof pendingResolveItem?.metadata?.recommended_action === 'string'
            ? pendingResolveItem.metadata.recommended_action
            : undefined
        }
      />

    </div>
  );
}
