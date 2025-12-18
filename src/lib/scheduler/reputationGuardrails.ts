/**
 * Reputation Guardrails
 *
 * Prevents over-contacting prospects by enforcing communication limits
 * and tracking contact frequency across all channels.
 *
 * Key principles:
 * - Respect prospect's time and attention
 * - Prevent "spammy" behavior that damages brand reputation
 * - Allow override for high-urgency situations with explicit approval
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { CommunicationChannel, PersonaType } from './types';

// ============================================
// TYPES
// ============================================

export interface ContactFrequencyLimits {
  emails_per_week: number;
  sms_per_week: number;
  calls_per_week: number;
  total_per_week: number;
  min_hours_between_contacts: number;
  max_follow_ups_without_response: number;
}

export interface ContactFrequencyState {
  contact_id: string;
  company_id: string | null;

  // Counts in current windows
  emails_this_week: number;
  sms_this_week: number;
  calls_this_week: number;
  total_this_week: number;

  // Response tracking
  outreach_without_response: number;
  last_response_at: string | null;
  last_contact_at: string | null;

  // Status
  is_blocked: boolean;
  block_reason: string | null;
  block_until: string | null;

  // Limits applied
  limits: ContactFrequencyLimits;
}

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  suggested_wait_until?: string;
  current_state: ContactFrequencyState;
  override_allowed: boolean;
  override_requires_approval: boolean;
}

export interface ContactEvent {
  contact_id: string;
  company_id?: string;
  channel: CommunicationChannel;
  direction: 'outbound' | 'inbound';
  timestamp: string;
}

// ============================================
// DEFAULT LIMITS BY PERSONA
// ============================================

export const DEFAULT_LIMITS: ContactFrequencyLimits = {
  emails_per_week: 4,
  sms_per_week: 2,
  calls_per_week: 2,
  total_per_week: 6,
  min_hours_between_contacts: 24,
  max_follow_ups_without_response: 5,
};

export const PERSONA_LIMITS: Record<PersonaType, Partial<ContactFrequencyLimits>> = {
  owner_operator: {
    emails_per_week: 3,
    sms_per_week: 2,
    total_per_week: 5,
    min_hours_between_contacts: 48, // Busier, less frequent
  },
  office_manager: {
    emails_per_week: 4,
    sms_per_week: 2,
    total_per_week: 6,
    min_hours_between_contacts: 24,
  },
  operations_lead: {
    emails_per_week: 5,
    sms_per_week: 3,
    total_per_week: 7,
    min_hours_between_contacts: 24,
  },
  it_technical: {
    emails_per_week: 4,
    sms_per_week: 1, // Technical folks prefer email
    total_per_week: 5,
    min_hours_between_contacts: 48,
  },
  executive: {
    emails_per_week: 2, // Very limited for execs
    sms_per_week: 0, // No SMS unless explicitly allowed
    calls_per_week: 1,
    total_per_week: 3,
    min_hours_between_contacts: 72,
    max_follow_ups_without_response: 3,
  },
  franchise_corp: {
    emails_per_week: 4,
    sms_per_week: 1,
    total_per_week: 5,
    min_hours_between_contacts: 48,
  },
};

// ============================================
// MAIN GUARDRAIL CHECK
// ============================================

/**
 * Check if contacting a prospect is allowed right now.
 */
export async function checkCanContact(
  contactId: string,
  channel: CommunicationChannel,
  persona?: PersonaType
): Promise<GuardrailCheckResult> {
  const state = await getContactFrequencyState(contactId, persona);

  // Check if contact is blocked
  if (state.is_blocked) {
    const blockUntil = state.block_until ? new Date(state.block_until) : null;
    if (!blockUntil || blockUntil > new Date()) {
      return {
        allowed: false,
        reason: state.block_reason || 'Contact is blocked',
        suggested_wait_until: state.block_until || undefined,
        current_state: state,
        override_allowed: true,
        override_requires_approval: true,
      };
    }
  }

  // Check minimum time between contacts
  if (state.last_contact_at) {
    const hoursSinceContact = getHoursSince(state.last_contact_at);
    if (hoursSinceContact < state.limits.min_hours_between_contacts) {
      const waitUntil = new Date(
        new Date(state.last_contact_at).getTime() +
        state.limits.min_hours_between_contacts * 60 * 60 * 1000
      );
      return {
        allowed: false,
        reason: `Minimum ${state.limits.min_hours_between_contacts} hours between contacts`,
        suggested_wait_until: waitUntil.toISOString(),
        current_state: state,
        override_allowed: true,
        override_requires_approval: false,
      };
    }
  }

  // Check channel-specific limits
  const channelLimit = getChannelLimit(channel, state.limits);
  const channelCount = getChannelCount(channel, state);

  if (channelCount >= channelLimit) {
    return {
      allowed: false,
      reason: `Weekly ${channel} limit reached (${channelCount}/${channelLimit})`,
      suggested_wait_until: getNextWeekStart().toISOString(),
      current_state: state,
      override_allowed: true,
      override_requires_approval: true,
    };
  }

  // Check total weekly limit
  if (state.total_this_week >= state.limits.total_per_week) {
    return {
      allowed: false,
      reason: `Weekly total limit reached (${state.total_this_week}/${state.limits.total_per_week})`,
      suggested_wait_until: getNextWeekStart().toISOString(),
      current_state: state,
      override_allowed: true,
      override_requires_approval: true,
    };
  }

  // Check max follow-ups without response
  if (state.outreach_without_response >= state.limits.max_follow_ups_without_response) {
    return {
      allowed: false,
      reason: `Max follow-ups without response reached (${state.outreach_without_response})`,
      suggested_wait_until: undefined, // Need to wait for response
      current_state: state,
      override_allowed: true,
      override_requires_approval: true,
    };
  }

  // All checks passed
  return {
    allowed: true,
    current_state: state,
    override_allowed: false,
    override_requires_approval: false,
  };
}

/**
 * Check if a company can be contacted (aggregate of all contacts).
 */
export async function checkCompanyCanContact(
  companyId: string
): Promise<{
  allowed: boolean;
  blocked_contacts: string[];
  contacts_at_limit: number;
  total_contacts: number;
}> {
  const supabase = createAdminClient();

  // Get all contacts for company
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('company_id', companyId);

  if (!contacts || contacts.length === 0) {
    return {
      allowed: true,
      blocked_contacts: [],
      contacts_at_limit: 0,
      total_contacts: 0,
    };
  }

  const blockedContacts: string[] = [];
  let atLimitCount = 0;

  for (const contact of contacts) {
    const result = await checkCanContact(contact.id, 'email');
    if (!result.allowed) {
      if (result.current_state.is_blocked) {
        blockedContacts.push(contact.id);
      } else {
        atLimitCount++;
      }
    }
  }

  return {
    allowed: blockedContacts.length < contacts.length,
    blocked_contacts: blockedContacts,
    contacts_at_limit: atLimitCount,
    total_contacts: contacts.length,
  };
}

// ============================================
// CONTACT EVENT RECORDING
// ============================================

/**
 * Record a contact event (outbound or inbound).
 */
export async function recordContactEvent(event: ContactEvent): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('contact_frequency_events').insert({
    contact_id: event.contact_id,
    company_id: event.company_id,
    channel: event.channel,
    direction: event.direction,
    event_at: event.timestamp || new Date().toISOString(),
  });

  // If inbound, reset outreach_without_response counter
  if (event.direction === 'inbound') {
    await supabase
      .from('contact_frequency_state')
      .update({
        outreach_without_response: 0,
        last_response_at: event.timestamp || new Date().toISOString(),
      })
      .eq('contact_id', event.contact_id);
  }
}

/**
 * Block a contact from outreach.
 */
export async function blockContact(
  contactId: string,
  reason: string,
  until?: Date
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('contact_frequency_state')
    .upsert({
      contact_id: contactId,
      is_blocked: true,
      block_reason: reason,
      block_until: until?.toISOString() || null,
    });
}

/**
 * Unblock a contact.
 */
export async function unblockContact(contactId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('contact_frequency_state')
    .update({
      is_blocked: false,
      block_reason: null,
      block_until: null,
    })
    .eq('contact_id', contactId);
}

// ============================================
// STATE RETRIEVAL
// ============================================

/**
 * Get contact frequency state for a contact.
 */
export async function getContactFrequencyState(
  contactId: string,
  persona?: PersonaType
): Promise<ContactFrequencyState> {
  const supabase = createAdminClient();

  // Get contact for company_id
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('id', contactId)
    .single();

  // Get stored state
  const { data: storedState } = await supabase
    .from('contact_frequency_state')
    .select('*')
    .eq('contact_id', contactId)
    .single();

  // Get events from past week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from('contact_frequency_events')
    .select('*')
    .eq('contact_id', contactId)
    .gte('event_at', weekAgo)
    .order('event_at', { ascending: false });

  // Count events by type
  const outboundEvents = events?.filter(e => e.direction === 'outbound') || [];
  const emailsThisWeek = outboundEvents.filter(e => e.channel === 'email').length;
  const smsThisWeek = outboundEvents.filter(e => e.channel === 'sms').length;
  const callsThisWeek = outboundEvents.filter(e => e.channel === 'phone').length;
  const totalThisWeek = outboundEvents.length;

  // Get last contact time
  const lastOutbound = outboundEvents[0];
  const lastContactAt = lastOutbound?.event_at || null;

  // Get last response
  const inboundEvents = events?.filter(e => e.direction === 'inbound') || [];
  const lastInbound = inboundEvents[0];
  const lastResponseAt = lastInbound?.event_at || storedState?.last_response_at || null;

  // Calculate outreach without response
  let outreachWithoutResponse = 0;
  if (lastResponseAt) {
    const responseTime = new Date(lastResponseAt).getTime();
    outreachWithoutResponse = outboundEvents.filter(e =>
      new Date(e.event_at).getTime() > responseTime
    ).length;
  } else {
    outreachWithoutResponse = outboundEvents.length;
  }

  // Get limits based on persona
  const limits = getLimitsForPersona(persona);

  return {
    contact_id: contactId,
    company_id: contact?.company_id || null,
    emails_this_week: emailsThisWeek,
    sms_this_week: smsThisWeek,
    calls_this_week: callsThisWeek,
    total_this_week: totalThisWeek,
    outreach_without_response: outreachWithoutResponse,
    last_response_at: lastResponseAt,
    last_contact_at: lastContactAt,
    is_blocked: storedState?.is_blocked || false,
    block_reason: storedState?.block_reason || null,
    block_until: storedState?.block_until || null,
    limits,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getLimitsForPersona(persona?: PersonaType): ContactFrequencyLimits {
  if (!persona) return DEFAULT_LIMITS;

  const personaLimits = PERSONA_LIMITS[persona];
  return {
    ...DEFAULT_LIMITS,
    ...personaLimits,
  };
}

function getChannelLimit(
  channel: CommunicationChannel,
  limits: ContactFrequencyLimits
): number {
  switch (channel) {
    case 'email':
      return limits.emails_per_week;
    case 'sms':
      return limits.sms_per_week;
    case 'phone':
      return limits.calls_per_week;
    default:
      return limits.total_per_week;
  }
}

function getChannelCount(
  channel: CommunicationChannel,
  state: ContactFrequencyState
): number {
  switch (channel) {
    case 'email':
      return state.emails_this_week;
    case 'sms':
      return state.sms_this_week;
    case 'phone':
      return state.calls_this_week;
    default:
      return state.total_this_week;
  }
}

function getHoursSince(timestamp: string): number {
  const time = new Date(timestamp).getTime();
  const now = Date.now();
  return (now - time) / (1000 * 60 * 60);
}

function getNextWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = (7 - dayOfWeek + 1) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

// ============================================
// REPORTING
// ============================================

/**
 * Get a summary of contact frequency across all contacts.
 */
export async function getFrequencyReport(): Promise<{
  total_contacts: number;
  blocked_contacts: number;
  at_limit_contacts: number;
  healthy_contacts: number;
  heavy_outreach_contacts: Array<{
    contact_id: string;
    total_this_week: number;
    without_response: number;
  }>;
}> {
  const supabase = createAdminClient();

  // Get all contacts with recent activity
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentEvents } = await supabase
    .from('contact_frequency_events')
    .select('contact_id')
    .gte('event_at', weekAgo);

  const uniqueContactIds = [...new Set(recentEvents?.map(e => e.contact_id) || [])];

  // Get blocked contacts
  const { data: blockedData } = await supabase
    .from('contact_frequency_state')
    .select('contact_id')
    .eq('is_blocked', true);

  const blockedContacts = blockedData?.length || 0;

  // Check each contact's state
  const heavyOutreach: Array<{
    contact_id: string;
    total_this_week: number;
    without_response: number;
  }> = [];
  let atLimitCount = 0;

  for (const contactId of uniqueContactIds.slice(0, 100)) { // Limit for performance
    const state = await getContactFrequencyState(contactId);

    if (state.total_this_week >= state.limits.total_per_week) {
      atLimitCount++;
    }

    if (state.outreach_without_response >= 3 || state.total_this_week >= 4) {
      heavyOutreach.push({
        contact_id: contactId,
        total_this_week: state.total_this_week,
        without_response: state.outreach_without_response,
      });
    }
  }

  return {
    total_contacts: uniqueContactIds.length,
    blocked_contacts: blockedContacts,
    at_limit_contacts: atLimitCount,
    healthy_contacts: uniqueContactIds.length - atLimitCount - blockedContacts,
    heavy_outreach_contacts: heavyOutreach.slice(0, 10),
  };
}
