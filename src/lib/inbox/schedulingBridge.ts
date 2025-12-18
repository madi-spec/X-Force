/**
 * Scheduling Bridge
 *
 * Connects the inbox to the AI scheduler system.
 * Detects scheduling intent from conversations and creates scheduling requests.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import {
  CreateSchedulingRequestInput,
  MeetingType,
  MeetingPlatform,
  MEETING_TYPES,
  MEETING_PLATFORMS,
} from '@/lib/scheduler/types';
import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '@/lib/ai/promptManager';

const anthropic = new Anthropic();
const adminSchedulingService = new SchedulingService({ useAdmin: true });

interface SchedulingIntent {
  hasIntent: boolean;
  confidence: number;
  meetingType: MeetingType;
  suggestedDuration: number;
  suggestedTimeframe: {
    start: Date;
    end: Date;
  };
  context: string;
  attendees: {
    name: string;
    email: string;
    title?: string;
  }[];
}

interface ConversationWithMessages {
  id: string;
  subject: string;
  participants: { address: string; name?: string }[];
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  messages: {
    body_preview: string;
    body_html?: string;
    from_address: string;
    from_name?: string;
    is_from_us: boolean;
    received_at: string;
  }[];
}

/**
 * Detects scheduling intent from a conversation using AI
 */
export async function detectSchedulingIntent(
  conversation: ConversationWithMessages
): Promise<SchedulingIntent | null> {
  try {
    // Get prompt configuration from database
    const promptConfig = await getPrompt('scheduling_detection');
    const model = promptConfig?.model || 'claude-sonnet-4-20250514';
    const maxTokens = promptConfig?.max_tokens || 1024;

    // Build conversation context
    const messageHistory = conversation.messages
      .slice(-10) // Last 10 messages
      .map((m) => {
        const sender = m.is_from_us ? 'Us' : (m.from_name || m.from_address);
        return `[${sender}]: ${m.body_preview}`;
      })
      .join('\n\n');

    // Use prompt template from DB or fallback
    let prompt: string;
    if (promptConfig?.prompt_template) {
      prompt = promptConfig.prompt_template
        .replace(/\{\{subject\}\}/g, conversation.subject)
        .replace(/\{\{messageHistory\}\}/g, messageHistory);
    } else {
      // Fallback to hardcoded prompt
      prompt = `Analyze this email conversation to detect if there's intent to schedule a meeting.

Subject: ${conversation.subject}

Conversation:
${messageHistory}

Analyze whether:
1. Either party is requesting or suggesting a meeting
2. The conversation is about scheduling, availability, or meeting times
3. There's a clear next step that involves meeting

Respond with JSON only:
{
  "hasIntent": boolean,
  "confidence": number (0-100),
  "meetingType": "discovery" | "demo" | "follow_up" | "technical" | "executive" | "custom",
  "suggestedDuration": number (in minutes, typically 30 or 60),
  "timeframeDescription": string (e.g., "next week", "this Friday"),
  "context": string (brief description of what the meeting is about),
  "signals": string[] (what indicated scheduling intent)
}`;
    }

    const response = await anthropic.messages.create({
      model: model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const analysis = JSON.parse(jsonMatch[0]);

    if (!analysis.hasIntent || analysis.confidence < 60) {
      return null;
    }

    // Calculate suggested timeframe
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    // Default to next 2 weeks
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 14);

    // Parse timeframe description if provided
    if (analysis.timeframeDescription) {
      const desc = analysis.timeframeDescription.toLowerCase();
      if (desc.includes('tomorrow')) {
        start.setDate(now.getDate() + 1);
        end.setDate(now.getDate() + 2);
      } else if (desc.includes('this week')) {
        end.setDate(now.getDate() + (7 - now.getDay()));
      } else if (desc.includes('next week')) {
        start.setDate(now.getDate() + (8 - now.getDay()));
        end.setDate(start.getDate() + 5);
      }
    }

    // Get external participants
    const externalAttendees = conversation.participants
      .filter((p) => !p.address.includes('@x-force.com') && !p.address.includes('@x-rai.com'))
      .map((p) => ({
        name: p.name || p.address.split('@')[0],
        email: p.address,
      }));

    return {
      hasIntent: true,
      confidence: analysis.confidence,
      meetingType: (MEETING_TYPES[analysis.meetingType?.toUpperCase() as keyof typeof MEETING_TYPES] ||
        MEETING_TYPES.FOLLOW_UP) as MeetingType,
      suggestedDuration: analysis.suggestedDuration || 30,
      suggestedTimeframe: {
        start,
        end,
      },
      context: analysis.context || conversation.subject,
      attendees: externalAttendees,
    };
  } catch (error) {
    console.error('Error detecting scheduling intent:', error);
    return null;
  }
}

/**
 * Creates a scheduling request from a conversation
 */
export async function createSchedulingFromConversation(
  conversationId: string,
  userId: string,
  options?: {
    meetingType?: MeetingType;
    duration?: number;
    platform?: MeetingPlatform;
  }
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get conversation with messages
    const { data: conversation, error: convError } = await supabase
      .from('email_conversations')
      .select(`
        id,
        subject,
        participants,
        deal_id,
        company_id,
        contact_id,
        messages:email_messages(
          body_preview,
          body_html,
          from_address,
          from_name,
          is_from_us,
          received_at
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    // Get user info
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('auth_id', userId)
      .single();

    if (!userProfile) {
      return { success: false, error: 'User not found' };
    }

    // Detect scheduling intent if no options provided
    let intent: SchedulingIntent | null = null;
    if (!options?.meetingType) {
      intent = await detectSchedulingIntent(conversation as ConversationWithMessages);
    }

    // Build request input
    const meetingType = options?.meetingType || intent?.meetingType || MEETING_TYPES.FOLLOW_UP;
    const duration = options?.duration || intent?.suggestedDuration || 30;
    const platform = options?.platform || MEETING_PLATFORMS.TEAMS;

    // Calculate date range
    const dateRangeStart = intent?.suggestedTimeframe?.start || new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() + 1);
    const dateRangeEnd = intent?.suggestedTimeframe?.end || new Date();
    dateRangeEnd.setDate(dateRangeEnd.getDate() + 14);

    // Get external attendees from participants
    const externalAttendees = (conversation.participants as { address: string; name?: string }[])
      .filter((p) => !p.address.includes('@x-force.com') && !p.address.includes('@x-rai.com'))
      .map((p) => ({
        name: p.name || p.address.split('@')[0],
        email: p.address,
        is_primary_contact: p.address === conversation.participants[0]?.address,
      }));

    if (externalAttendees.length === 0) {
      return { success: false, error: 'No external attendees found' };
    }

    const input: CreateSchedulingRequestInput = {
      meeting_type: meetingType,
      duration_minutes: duration,
      title: conversation.subject,
      context: intent?.context || `Follow-up from email conversation: ${conversation.subject}`,
      meeting_platform: platform,
      date_range_start: dateRangeStart.toISOString(),
      date_range_end: dateRangeEnd.toISOString(),
      deal_id: conversation.deal_id || undefined,
      company_id: conversation.company_id || undefined,
      internal_attendees: [
        {
          user_id: userProfile.id,
          is_organizer: true,
        },
      ],
      external_attendees: externalAttendees.map((a) => ({
        contact_id: conversation.contact_id || undefined,
        name: a.name,
        email: a.email,
        is_primary_contact: a.is_primary_contact,
      })),
    };

    // Create the scheduling request
    const { data: request, error: createError } = await adminSchedulingService.createSchedulingRequest(
      input,
      userProfile.id
    );

    if (createError || !request) {
      return { success: false, error: createError || 'Failed to create scheduling request' };
    }

    // Link conversation to scheduling request - add signal
    // Fetch current signals first then merge
    const { data: convData } = await supabase
      .from('email_conversations')
      .select('signals')
      .eq('id', conversationId)
      .single();
    const currentSignals = (convData?.signals as Record<string, boolean>) || {};
    await supabase
      .from('email_conversations')
      .update({
        signals: { ...currentSignals, scheduling_request_created: true },
      })
      .eq('id', conversationId);

    // Create activity link
    await supabase.from('activities').insert({
      user_id: userProfile.id,
      type: 'scheduling_request',
      subject: `Scheduling request created from email: ${conversation.subject}`,
      body: intent?.context || 'Scheduling request created from email conversation',
      occurred_at: new Date().toISOString(),
      deal_id: conversation.deal_id,
      company_id: conversation.company_id,
      contact_id: conversation.contact_id,
      metadata: {
        scheduling_request_id: request.id,
        conversation_id: conversationId,
        source: 'inbox_bridge',
      },
    });

    return { success: true, requestId: request.id };
  } catch (error) {
    console.error('Error creating scheduling from conversation:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Links an email conversation to an existing scheduling request
 */
export async function linkConversationToScheduling(
  conversationId: string,
  schedulingRequestId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Update conversation with scheduling link - fetch and merge signals
    const { data: convData } = await supabase
      .from('email_conversations')
      .select('signals')
      .eq('id', conversationId)
      .single();
    const currentSignals = (convData?.signals as Record<string, boolean>) || {};
    const { error: convError } = await supabase
      .from('email_conversations')
      .update({
        signals: { ...currentSignals, linked_to_scheduling: true },
      })
      .eq('id', conversationId);

    if (convError) {
      return { success: false, error: convError.message };
    }

    // Update scheduling request with email thread reference
    const { error: schedError } = await supabase
      .from('scheduling_requests')
      .update({
        email_thread_id: conversationId,
      })
      .eq('id', schedulingRequestId);

    if (schedError) {
      return { success: false, error: schedError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error linking conversation to scheduling:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}

/**
 * Gets scheduling suggestions for a conversation based on AI analysis
 */
export async function getSchedulingSuggestions(
  conversationId: string
): Promise<{
  hasSuggestion: boolean;
  suggestion?: SchedulingIntent;
  existingRequestId?: string;
}> {
  const supabase = createAdminClient();

  try {
    // Check if conversation is already linked to a scheduling request
    const { data: existingRequest } = await supabase
      .from('scheduling_requests')
      .select('id, status')
      .eq('email_thread_id', conversationId)
      .single();

    if (existingRequest) {
      return {
        hasSuggestion: false,
        existingRequestId: existingRequest.id,
      };
    }

    // Get conversation
    const { data: conversation, error } = await supabase
      .from('email_conversations')
      .select(`
        id,
        subject,
        participants,
        deal_id,
        company_id,
        contact_id,
        ai_signals,
        messages:email_messages(
          body_preview,
          body_html,
          from_address,
          from_name,
          is_from_us,
          received_at
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return { hasSuggestion: false };
    }

    // Check if we've already suggested scheduling for this conversation
    const signals = (conversation.ai_signals as string[]) || [];
    if (signals.includes('scheduling_suggested') || signals.includes('scheduling_request_created')) {
      return { hasSuggestion: false };
    }

    // Detect scheduling intent
    const intent = await detectSchedulingIntent(conversation as ConversationWithMessages);

    if (intent && intent.hasIntent) {
      // Mark that we've suggested scheduling
      await supabase
        .from('email_conversations')
        .update({
          ai_signals: [...signals, 'scheduling_suggested'],
        })
        .eq('id', conversationId);

      return {
        hasSuggestion: true,
        suggestion: intent,
      };
    }

    return { hasSuggestion: false };
  } catch (error) {
    console.error('Error getting scheduling suggestions:', error);
    return { hasSuggestion: false };
  }
}

/**
 * Processes incoming messages to detect scheduling opportunities
 * Called by the sync service when new messages arrive
 */
export async function processMessageForScheduling(
  conversationId: string,
  messageId: string
): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Get the message
    const { data: message } = await supabase
      .from('email_messages')
      .select('body_preview, is_from_us')
      .eq('id', messageId)
      .single();

    if (!message || message.is_from_us) {
      // Don't process our own messages
      return;
    }

    // Quick keyword check before full AI analysis
    const schedulingKeywords = [
      'schedule',
      'meeting',
      'call',
      'availability',
      'available',
      'time slot',
      'calendar',
      'demo',
      'discuss',
      'connect',
      'catch up',
      'set up',
    ];

    const bodyLower = message.body_preview.toLowerCase();
    const hasKeyword = schedulingKeywords.some((kw) => bodyLower.includes(kw));

    if (!hasKeyword) {
      return;
    }

    // Get full conversation context
    const suggestions = await getSchedulingSuggestions(conversationId);

    if (suggestions.hasSuggestion && suggestions.suggestion) {
      // Add scheduling signal to conversation - fetch and merge signals
      const { data: convData } = await supabase
        .from('email_conversations')
        .select('signals')
        .eq('id', conversationId)
        .single();
      const currentSignals = (convData?.signals as Record<string, boolean>) || {};
      await supabase
        .from('email_conversations')
        .update({
          signals: { ...currentSignals, scheduling_opportunity_detected: true },
        })
        .eq('id', conversationId);

      console.log(
        `Scheduling opportunity detected in conversation ${conversationId}:`,
        suggestions.suggestion
      );
    }
  } catch (error) {
    console.error('Error processing message for scheduling:', error);
  }
}
