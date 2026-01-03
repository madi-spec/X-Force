/**
 * Scheduling Intelligence Engine
 *
 * Analyzes scheduling patterns to predict success, identify risks,
 * and provide actionable insights for deal intelligence.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  SchedulingRequest,
  SchedulingStatus,
  MeetingType,
  PersonaType,
  CommunicationChannel,
  SCHEDULING_STATUS,
  MEETING_TYPES,
} from './types';

// ============================================
// TYPES
// ============================================

export interface SchedulingSignal {
  type: SchedulingSignalType;
  strength: 'strong' | 'moderate' | 'weak';
  impact: 'positive' | 'negative' | 'neutral';
  value: number;  // -100 to +100
  description: string;
  detected_at: string;
}

export type SchedulingSignalType =
  | 'response_speed'        // How fast they responded
  | 'response_sentiment'    // Positive/negative tone
  | 'time_selection'        // Chose quickly vs negotiated
  | 'no_show_pattern'       // History of no-shows
  | 'reschedule_pattern'    // Frequent rescheduling
  | 'channel_preference'    // Which channel worked
  | 'duration_preference'   // Full vs reduced meetings
  | 'availability_pattern'  // When they're available
  | 'engagement_decline'    // Declining engagement
  | 'champion_indicator'    // Signs of internal advocacy
  | 'urgency_signal'        // Urgency in their responses
  | 'objection_signal';     // Concerns in responses

export interface SchedulingIntelligence {
  scheduling_request_id: string;
  deal_id: string | null;
  company_id: string | null;

  // Overall assessment
  scheduling_health: 'healthy' | 'at_risk' | 'critical';
  success_probability: number;  // 0-100

  // Signals
  signals: SchedulingSignal[];

  // Pattern analysis
  response_pattern: {
    avg_response_hours: number | null;
    response_rate: number;  // % of emails responded to
    preferred_channel: CommunicationChannel | null;
    preferred_times: string[];  // e.g., ["morning", "tuesday"]
  };

  // Risk indicators
  risks: SchedulingRisk[];

  // Recommendations
  recommendations: SchedulingRecommendation[];

  // For deal intelligence
  deal_signals: DealSchedulingSignal[];

  computed_at: string;
}

export interface SchedulingRisk {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface SchedulingRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

// Signals to pass to deal intelligence
export interface DealSchedulingSignal {
  signal: string;
  impact: 'positive' | 'negative';
  confidence: number;
  for_deal_factor: 'engagement' | 'champion' | 'authority' | 'need' | 'timeline';
}

// ============================================
// MAIN INTELLIGENCE COMPUTATION
// ============================================

export async function computeSchedulingIntelligence(
  schedulingRequestId: string
): Promise<SchedulingIntelligence | null> {
  const supabase = createAdminClient();

  // Get the scheduling request with all related data
  const { data: request, error } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*),
      actions:scheduling_actions(*)
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (error || !request) {
    console.error('[SchedulingIntelligence] Failed to fetch request:', error);
    return null;
  }

  const typedRequest = request as SchedulingRequest;

  // Analyze signals
  const signals = analyzeSignals(typedRequest);

  // Analyze response patterns
  const responsePattern = analyzeResponsePattern(typedRequest);

  // Identify risks
  const risks = identifySchedulingRisks(typedRequest, signals);

  // Generate recommendations
  const recommendations = generateRecommendations(typedRequest, signals, risks);

  // Calculate health and probability
  const { health, probability } = calculateSchedulingHealth(signals, risks);

  // Generate deal signals
  const dealSignals = generateDealSignals(typedRequest, signals);

  return {
    scheduling_request_id: schedulingRequestId,
    deal_id: typedRequest.deal_id,
    company_id: typedRequest.company_id,
    scheduling_health: health,
    success_probability: probability,
    signals,
    response_pattern: responsePattern,
    risks,
    recommendations,
    deal_signals: dealSignals,
    computed_at: new Date().toISOString(),
  };
}

// ============================================
// SIGNAL ANALYSIS
// ============================================

function analyzeSignals(request: SchedulingRequest): SchedulingSignal[] {
  const signals: SchedulingSignal[] = [];
  const actions = request.actions || [];
  const conversationHistory = request.conversation_history || [];

  // 1. Response Speed Signal
  const responseSpeedSignal = analyzeResponseSpeed(actions, conversationHistory);
  if (responseSpeedSignal) signals.push(responseSpeedSignal);

  // 2. Time Selection Pattern
  const timeSelectionSignal = analyzeTimeSelection(request, actions);
  if (timeSelectionSignal) signals.push(timeSelectionSignal);

  // 3. No-Show Pattern
  if (request.no_show_count > 0) {
    signals.push({
      type: 'no_show_pattern',
      strength: request.no_show_count >= 2 ? 'strong' : 'moderate',
      impact: 'negative',
      value: -20 * request.no_show_count,
      description: `${request.no_show_count} no-show(s) recorded`,
      detected_at: new Date().toISOString(),
    });
  }

  // 4. Reschedule Pattern
  const rescheduleCount = actions.filter(a =>
    a.action_type === 'rescheduling_started'
  ).length;
  if (rescheduleCount > 0) {
    signals.push({
      type: 'reschedule_pattern',
      strength: rescheduleCount >= 2 ? 'moderate' : 'weak',
      impact: rescheduleCount >= 3 ? 'negative' : 'neutral',
      value: rescheduleCount >= 3 ? -15 : -5,
      description: `Rescheduled ${rescheduleCount} time(s)`,
      detected_at: new Date().toISOString(),
    });
  }

  // 5. Channel Preference
  if (request.current_channel !== 'email') {
    signals.push({
      type: 'channel_preference',
      strength: 'moderate',
      impact: 'neutral',
      value: 0,
      description: `Engaged via ${request.current_channel}`,
      detected_at: new Date().toISOString(),
    });
  }

  // 6. Duration De-escalation
  if (request.deescalation_state) {
    const deesc = request.deescalation_state;
    signals.push({
      type: 'duration_preference',
      strength: deesc.duration_tier === 'minimal' ? 'strong' : 'moderate',
      impact: 'negative',
      value: deesc.duration_tier === 'minimal' ? -25 : -10,
      description: `Meeting reduced from ${deesc.original_duration}min to ${deesc.current_duration}min`,
      detected_at: deesc.deescalated_at || new Date().toISOString(),
    });
  }

  // 7. Engagement Decline (many attempts, no response)
  if (request.attempt_count >= 4 && request.status === SCHEDULING_STATUS.AWAITING_RESPONSE) {
    signals.push({
      type: 'engagement_decline',
      strength: request.attempt_count >= 6 ? 'strong' : 'moderate',
      impact: 'negative',
      value: -15 * Math.min(request.attempt_count - 3, 3),
      description: `${request.attempt_count} outreach attempts with no response`,
      detected_at: new Date().toISOString(),
    });
  }

  // 8. Confirmed Meeting = Strong Positive
  if (request.status === SCHEDULING_STATUS.CONFIRMED ||
      request.status === SCHEDULING_STATUS.REMINDER_SENT) {
    signals.push({
      type: 'champion_indicator',
      strength: 'strong',
      impact: 'positive',
      value: 40,
      description: 'Meeting confirmed - prospect committed time',
      detected_at: new Date().toISOString(),
    });
  }

  // 9. Quick Confirmation = Urgency Signal
  if (request.scheduled_time && request.attempt_count <= 2) {
    signals.push({
      type: 'urgency_signal',
      strength: 'moderate',
      impact: 'positive',
      value: 20,
      description: 'Confirmed quickly with minimal follow-up',
      detected_at: new Date().toISOString(),
    });
  }

  return signals;
}

function analyzeResponseSpeed(
  actions: SchedulingRequest['actions'],
  history: SchedulingRequest['conversation_history']
): SchedulingSignal | null {
  if (!actions || actions.length === 0) return null;

  // Find outbound/inbound pairs
  const outbounds = actions.filter(a => a.action_type === 'email_sent' || a.action_type === 'sms_sent');
  const inbounds = actions.filter(a => a.action_type === 'email_received' || a.action_type === 'sms_received');

  if (outbounds.length === 0 || inbounds.length === 0) return null;

  // Calculate average response time
  let totalResponseHours = 0;
  let responseCount = 0;

  for (const inbound of inbounds) {
    const inboundTime = new Date(inbound.created_at).getTime();

    // Find the most recent outbound before this inbound
    const precedingOutbounds = outbounds.filter(o =>
      new Date(o.created_at).getTime() < inboundTime
    );

    if (precedingOutbounds.length > 0) {
      const lastOutbound = precedingOutbounds[precedingOutbounds.length - 1];
      const outboundTime = new Date(lastOutbound.created_at).getTime();
      const hoursToRespond = (inboundTime - outboundTime) / (1000 * 60 * 60);

      totalResponseHours += hoursToRespond;
      responseCount++;
    }
  }

  if (responseCount === 0) return null;

  const avgHours = totalResponseHours / responseCount;

  let signal: SchedulingSignal;

  if (avgHours < 4) {
    signal = {
      type: 'response_speed',
      strength: 'strong',
      impact: 'positive',
      value: 30,
      description: `Fast responder - avg ${Math.round(avgHours)} hours`,
      detected_at: new Date().toISOString(),
    };
  } else if (avgHours < 24) {
    signal = {
      type: 'response_speed',
      strength: 'moderate',
      impact: 'positive',
      value: 15,
      description: `Good response time - avg ${Math.round(avgHours)} hours`,
      detected_at: new Date().toISOString(),
    };
  } else if (avgHours < 72) {
    signal = {
      type: 'response_speed',
      strength: 'weak',
      impact: 'neutral',
      value: 0,
      description: `Slow responder - avg ${Math.round(avgHours)} hours`,
      detected_at: new Date().toISOString(),
    };
  } else {
    signal = {
      type: 'response_speed',
      strength: 'moderate',
      impact: 'negative',
      value: -15,
      description: `Very slow responder - avg ${Math.round(avgHours)} hours`,
      detected_at: new Date().toISOString(),
    };
  }

  return signal;
}

function analyzeTimeSelection(
  request: SchedulingRequest,
  actions: SchedulingRequest['actions']
): SchedulingSignal | null {
  if (!request.scheduled_time) return null;

  const timeSelectedActions = (actions || []).filter(a => a.action_type === 'time_selected');

  if (timeSelectedActions.length === 0) return null;

  // Check if they selected from proposed times or counter-proposed
  const negotiatingActions = (actions || []).filter(a =>
    a.action_type === 'times_proposed' && a.actor === 'prospect'
  );

  if (negotiatingActions.length === 0) {
    // Selected from our proposed times
    return {
      type: 'time_selection',
      strength: 'moderate',
      impact: 'positive',
      value: 15,
      description: 'Selected from proposed times without negotiation',
      detected_at: new Date().toISOString(),
    };
  } else {
    // Had to negotiate
    return {
      type: 'time_selection',
      strength: 'weak',
      impact: 'neutral',
      value: 0,
      description: 'Required time negotiation',
      detected_at: new Date().toISOString(),
    };
  }
}

// ============================================
// RESPONSE PATTERN ANALYSIS
// ============================================

function analyzeResponsePattern(request: SchedulingRequest): SchedulingIntelligence['response_pattern'] {
  const actions = request.actions || [];

  // Calculate response metrics
  const outboundCount = actions.filter(a =>
    a.action_type === 'email_sent' || a.action_type === 'sms_sent'
  ).length;

  const inboundCount = actions.filter(a =>
    a.action_type === 'email_received' || a.action_type === 'sms_received'
  ).length;

  const responseRate = outboundCount > 0 ? (inboundCount / outboundCount) * 100 : 0;

  // Determine preferred channel
  const emailResponses = actions.filter(a => a.action_type === 'email_received').length;
  const smsResponses = actions.filter(a => a.action_type === 'sms_received').length;

  let preferredChannel: CommunicationChannel | null = null;
  if (emailResponses > smsResponses) preferredChannel = 'email';
  else if (smsResponses > emailResponses) preferredChannel = 'sms';

  // Analyze preferred times from scheduled meetings
  const preferredTimes: string[] = [];
  if (request.scheduled_time) {
    const scheduledDate = new Date(request.scheduled_time);
    const timezone = request.timezone || 'America/New_York';
    // Use timezone-aware hour extraction
    const hourStr = scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
    const hour = parseInt(hourStr);
    const day = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase();

    if (hour < 12) preferredTimes.push('morning');
    else if (hour < 17) preferredTimes.push('afternoon');
    else preferredTimes.push('evening');

    preferredTimes.push(day);
  }

  return {
    avg_response_hours: null, // Calculated in signal analysis
    response_rate: Math.round(responseRate),
    preferred_channel: preferredChannel,
    preferred_times: preferredTimes,
  };
}

// ============================================
// RISK IDENTIFICATION
// ============================================

function identifySchedulingRisks(
  request: SchedulingRequest,
  signals: SchedulingSignal[]
): SchedulingRisk[] {
  const risks: SchedulingRisk[] = [];

  // No-show risk
  if (request.no_show_count >= 2) {
    risks.push({
      type: 'no_show',
      severity: 'high',
      description: 'Multiple no-shows indicate low commitment',
      mitigation: 'Request explicit confirmation, send multiple reminders',
    });
  } else if (request.no_show_count === 1) {
    risks.push({
      type: 'no_show',
      severity: 'medium',
      description: 'Previous no-show on record',
      mitigation: 'Send reminder SMS 30 minutes before',
    });
  }

  // Engagement risk
  const engagementDecline = signals.find(s => s.type === 'engagement_decline');
  if (engagementDecline && engagementDecline.value <= -30) {
    risks.push({
      type: 'engagement',
      severity: 'high',
      description: 'Prospect not responding to outreach',
      mitigation: 'Try different channel or have manager reach out',
    });
  }

  // Duration de-escalation risk
  if (request.deescalation_state?.duration_tier === 'minimal') {
    risks.push({
      type: 'commitment',
      severity: 'medium',
      description: 'Prospect only willing to commit to minimal time',
      mitigation: 'Focus on one key value point in short meeting',
    });
  }

  // Paused status risk
  if (request.status === SCHEDULING_STATUS.PAUSED) {
    risks.push({
      type: 'stalled',
      severity: 'medium',
      description: 'Scheduling process is paused',
      mitigation: 'Review pause reason and re-engage appropriately',
    });
  }

  // High attempt count without confirmation
  if (request.attempt_count >= 5 && !request.scheduled_time) {
    risks.push({
      type: 'outreach_fatigue',
      severity: 'high',
      description: `${request.attempt_count} attempts without confirmation`,
      mitigation: 'Consider pausing outreach for 1-2 weeks',
    });
  }

  return risks;
}

// ============================================
// RECOMMENDATIONS
// ============================================

function generateRecommendations(
  request: SchedulingRequest,
  signals: SchedulingSignal[],
  risks: SchedulingRisk[]
): SchedulingRecommendation[] {
  const recs: SchedulingRecommendation[] = [];

  // High-priority risk mitigations
  for (const risk of risks.filter(r => r.severity === 'high')) {
    recs.push({
      action: risk.mitigation,
      priority: 'high',
      rationale: risk.description,
    });
  }

  // Status-specific recommendations
  switch (request.status) {
    case SCHEDULING_STATUS.AWAITING_RESPONSE:
      if (request.attempt_count >= 3 && request.current_channel === 'email') {
        recs.push({
          action: 'Escalate to SMS channel',
          priority: 'medium',
          rationale: 'Email not getting response, try SMS',
        });
      }
      break;

    case SCHEDULING_STATUS.NEGOTIATING:
      recs.push({
        action: 'Review counter-proposal and respond within 4 hours',
        priority: 'high',
        rationale: 'Prospect is engaged, maintain momentum',
      });
      break;

    case SCHEDULING_STATUS.CONFIRMING:
      recs.push({
        action: 'Send calendar invite immediately',
        priority: 'high',
        rationale: 'Lock in the commitment before they change mind',
      });
      break;

    case SCHEDULING_STATUS.CONFIRMED:
      if (!request.next_action_type?.includes('reminder')) {
        recs.push({
          action: 'Schedule reminder for day of meeting',
          priority: 'medium',
          rationale: 'Reduce no-show risk',
        });
      }
      break;
  }

  // Persona-based recommendations
  if (request.persona) {
    const personaRec = getPersonaRecommendation(request.persona.type, request);
    if (personaRec) recs.push(personaRec);
  }

  return recs.slice(0, 3);
}

function getPersonaRecommendation(
  persona: PersonaType,
  request: SchedulingRequest
): SchedulingRecommendation | null {
  switch (persona) {
    case 'owner_operator':
      if (request.duration_minutes > 30) {
        return {
          action: 'Consider offering a shorter 15-20 min intro call',
          priority: 'medium',
          rationale: 'Owner-operators value their time highly',
        };
      }
      break;

    case 'executive':
      if (request.current_channel === 'sms') {
        return {
          action: 'Switch back to email for executives',
          priority: 'medium',
          rationale: 'Executives typically prefer email communication',
        };
      }
      break;

    case 'it_technical':
      return {
        action: 'Include technical documentation links in follow-up',
        priority: 'low',
        rationale: 'Technical personas appreciate detailed info',
      };
  }

  return null;
}

// ============================================
// HEALTH CALCULATION
// ============================================

function calculateSchedulingHealth(
  signals: SchedulingSignal[],
  risks: SchedulingRisk[]
): { health: 'healthy' | 'at_risk' | 'critical'; probability: number } {
  // Sum signal values
  const signalScore = signals.reduce((sum, s) => sum + s.value, 0);

  // Risk penalty
  const highRisks = risks.filter(r => r.severity === 'high').length;
  const mediumRisks = risks.filter(r => r.severity === 'medium').length;
  const riskPenalty = (highRisks * 20) + (mediumRisks * 10);

  // Calculate probability (base 50, adjusted by signals and risks)
  let probability = 50 + (signalScore / 2) - riskPenalty;
  probability = Math.max(5, Math.min(95, probability));

  // Determine health
  let health: 'healthy' | 'at_risk' | 'critical';
  if (probability >= 60 && highRisks === 0) {
    health = 'healthy';
  } else if (probability >= 30 && highRisks <= 1) {
    health = 'at_risk';
  } else {
    health = 'critical';
  }

  return { health, probability: Math.round(probability) };
}

// ============================================
// DEAL SIGNAL GENERATION
// ============================================

function generateDealSignals(
  request: SchedulingRequest,
  signals: SchedulingSignal[]
): DealSchedulingSignal[] {
  const dealSignals: DealSchedulingSignal[] = [];

  // Confirmed meeting = strong engagement signal
  if (request.status === SCHEDULING_STATUS.CONFIRMED ||
      request.status === SCHEDULING_STATUS.COMPLETED) {
    dealSignals.push({
      signal: 'Meeting scheduled/held',
      impact: 'positive',
      confidence: 0.9,
      for_deal_factor: 'engagement',
    });
  }

  // Fast response = good engagement
  const responseSpeedSignal = signals.find(s => s.type === 'response_speed');
  if (responseSpeedSignal && responseSpeedSignal.impact === 'positive') {
    dealSignals.push({
      signal: 'Quick scheduling response',
      impact: 'positive',
      confidence: 0.7,
      for_deal_factor: 'engagement',
    });
  }

  // Urgency signal = timeline indicator
  const urgencySignal = signals.find(s => s.type === 'urgency_signal');
  if (urgencySignal) {
    dealSignals.push({
      signal: 'Prospect showed urgency in scheduling',
      impact: 'positive',
      confidence: 0.6,
      for_deal_factor: 'timeline',
    });
  }

  // No-show = negative engagement
  if (request.no_show_count > 0) {
    dealSignals.push({
      signal: `${request.no_show_count} no-show(s)`,
      impact: 'negative',
      confidence: 0.8,
      for_deal_factor: 'engagement',
    });
  }

  // Many attempts without response = low engagement
  if (request.attempt_count >= 5 && !request.scheduled_time) {
    dealSignals.push({
      signal: 'Not responding to scheduling outreach',
      impact: 'negative',
      confidence: 0.75,
      for_deal_factor: 'engagement',
    });
  }

  // Meeting with decision maker = authority signal
  const hasDecisionMaker = request.attendees?.some(a =>
    a.title?.toLowerCase().includes('owner') ||
    a.title?.toLowerCase().includes('president') ||
    a.title?.toLowerCase().includes('ceo') ||
    a.title?.toLowerCase().includes('vp')
  );

  if (hasDecisionMaker && request.status === SCHEDULING_STATUS.CONFIRMED) {
    dealSignals.push({
      signal: 'Decision maker attending scheduled meeting',
      impact: 'positive',
      confidence: 0.85,
      for_deal_factor: 'authority',
    });
  }

  return dealSignals;
}

// ============================================
// EXPORTS
// ============================================

// SchedulingSignalType is exported inline with its declaration
