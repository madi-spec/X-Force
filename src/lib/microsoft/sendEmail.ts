/**
 * Send Email via Microsoft Graph
 *
 * Extracted from emailSync.ts for cleaner module separation.
 * The sync functions in emailSync.ts are deprecated, but sendEmail is still active.
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
  isHtml: boolean = false
): Promise<SendEmailResult> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
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
