/**
 * Send Email via Microsoft Graph
 *
 * Extracted from emailSync.ts for cleaner module separation.
 * The sync functions in emailSync.ts are deprecated, but sendEmail is still active.
 *
 * Supports two modes:
 * 1. New message: Creates a fresh email (default)
 * 2. Reply mode: When replyToMessageId is provided, creates a proper reply
 *    that includes the quoted conversation history (like hitting Reply in Outlook)
 */

import { getValidToken } from './auth';

// SAFEGUARD: Save emails as drafts instead of sending automatically
// Set to true to require manual review before sending scheduler emails
const EMAIL_DRAFT_ONLY_MODE = true;

export interface SendEmailResult {
  success: boolean;
  error?: string;
  isDraft?: boolean;
  messageId?: string;
  conversationId?: string;
}

/**
 * Send an email via Microsoft Graph
 *
 * SAFEGUARD: When EMAIL_DRAFT_ONLY_MODE is true, emails are saved as drafts
 * with X-FORCE category for manual review instead of being sent automatically.
 */
export async function sendEmail(
  userId: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  isHtml: boolean = false,
  replyToMessageId?: string
): Promise<SendEmailResult> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
  }

  // If replyToMessageId is provided, use reply mode
  if (replyToMessageId) {
    return sendReply(token, replyToMessageId, body, isHtml, cc);
  }

  // SAFEGUARD: Create as draft instead of sending directly
  if (EMAIL_DRAFT_ONLY_MODE) {
    try {
      // Create draft message with X-FORCE category
      const draftResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
          toRecipients: to.map(email => ({ emailAddress: { address: email } })),
          ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
          categories: ['X-FORCE'],
        }),
      });

      if (!draftResponse.ok) {
        const errorText = await draftResponse.text();
        return { success: false, error: `Failed to create draft: ${errorText}` };
      }

      const draft = await draftResponse.json();
      console.log(`[sendEmail] DRAFT ONLY MODE - Email saved as draft for manual review:`, draft.id);
      console.log(`[sendEmail] Subject: ${subject}`);
      console.log(`[sendEmail] To: ${to.join(', ')}`);
      console.log(`[sendEmail] ConversationId: ${draft.conversationId || 'N/A'}`);
      return { success: true, isDraft: true, messageId: draft.id, conversationId: draft.conversationId };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // Use "create draft then send" pattern to capture the conversationId
  // This allows us to track the email thread for response matching
  try {
    // Step 1: Create a draft message
    const draftResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
        toRecipients: to.map(email => ({ emailAddress: { address: email } })),
        ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
      }),
    });

    if (!draftResponse.ok) {
      const errorText = await draftResponse.text();
      return { success: false, error: `Failed to create draft: ${errorText}` };
    }

    const draft = await draftResponse.json();
    console.log(`[sendEmail] Draft created with id: ${draft.id}, conversationId: ${draft.conversationId}`);

    // Step 2: Send the draft
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      return { success: false, error: `Failed to send message: ${errorText}` };
    }

    console.log(`[sendEmail] Email sent successfully. ConversationId: ${draft.conversationId}`);
    return { success: true, messageId: draft.id, conversationId: draft.conversationId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Create a reply to an existing message using Microsoft Graph createReply API.
 * This automatically includes the quoted conversation history.
 */
async function sendReply(
  token: string,
  replyToMessageId: string,
  body: string,
  isHtml: boolean,
  cc?: string[]
): Promise<SendEmailResult> {
  try {
    // Step 1: Create a reply draft using Microsoft createReply endpoint
    // This automatically includes the quoted conversation history and sets proper headers
    const createReplyResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${replyToMessageId}/createReply`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'IdType="ImmutableId"',
        },
        body: JSON.stringify({}),
      }
    );

    if (!createReplyResponse.ok) {
      const errorText = await createReplyResponse.text();
      return { success: false, error: `Failed to create reply: ${errorText}` };
    }

    const replyDraft = await createReplyResponse.json();
    console.log(`[sendEmail] Reply draft created: ${replyDraft.id}`);

    // Step 2: Update the reply draft with our body content
    // The body from createReply includes the quoted thread, so we prepend our new content
    // IMPORTANT: createReply ALWAYS returns HTML body, so we must use HTML
    const existingBody = replyDraft.body?.content || '';

    // Convert our content to HTML if it's plain text
    let ourContent = body;
    if (!isHtml) {
      ourContent = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    // Always use HTML since existingBody from createReply is HTML
    const newBody = `${ourContent}<br><br>${existingBody}`;

    const updatePayload: Record<string, unknown> = {
      body: {
        contentType: 'HTML', // Always HTML for replies since createReply returns HTML
        content: newBody,
      },
    };

    // Add CC if provided
    if (cc && cc.length > 0) {
      updatePayload.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }));
    }

    // Add X-FORCE category in draft mode
    if (EMAIL_DRAFT_ONLY_MODE) {
      updatePayload.categories = ['X-FORCE'];
    }

    const updateResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${replyDraft.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return { success: false, error: `Failed to update reply: ${errorText}` };
    }

    const updatedDraft = await updateResponse.json();
    console.log(`[sendEmail] Reply updated with body, conversationId: ${updatedDraft.conversationId}`);

    // SAFEGUARD: In draft mode, stop here
    if (EMAIL_DRAFT_ONLY_MODE) {
      console.log(`[sendEmail] DRAFT ONLY MODE - Reply saved as draft for manual review:`, updatedDraft.id);
      console.log(`[sendEmail] Subject: ${updatedDraft.subject}`);
      console.log(`[sendEmail] ConversationId: ${updatedDraft.conversationId || 'N/A'}`);
      return {
        success: true,
        isDraft: true,
        messageId: updatedDraft.id,
        conversationId: updatedDraft.conversationId,
      };
    }

    // Step 3: Send the reply
    const sendResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${updatedDraft.id}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      return { success: false, error: `Failed to send reply: ${errorText}` };
    }

    console.log(`[sendEmail] Reply sent successfully. ConversationId: ${updatedDraft.conversationId}`);
    return {
      success: true,
      messageId: updatedDraft.id,
      conversationId: updatedDraft.conversationId,
    };
  } catch (err) {
    return { success: false, error: `Reply error: ${String(err)}` };
  }
}
