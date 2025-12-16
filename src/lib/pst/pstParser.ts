/**
 * PST File Parser
 * Extracts emails and calendar events from Outlook PST files
 */

import PSTFile from 'pst-extractor';
import { createHash } from 'crypto';

export interface PSTEmail {
  messageId: string | null;
  subject: string;
  body: string;
  bodyHtml: string | null;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  sentDate: Date | null;
  receivedDate: Date | null;
  folder: string;
  hasAttachments: boolean;
  attachmentCount: number;
  isFromMe: boolean;
}

export interface PSTCalendarEvent {
  subject: string;
  body: string;
  location: string | null;
  startTime: Date | null;
  endTime: Date | null;
  isAllDay: boolean;
  attendees: string[];
  organizer: string | null;
  folder: string;
}

export interface ParseResult {
  emails: PSTEmail[];
  calendarEvents: PSTCalendarEvent[];
  errors: string[];
}

/**
 * Generate a deterministic external ID for deduplication
 */
export function generateEmailExternalId(email: PSTEmail): string {
  // Use message ID if available, otherwise hash key fields
  if (email.messageId) {
    return `pst_email_${email.messageId}`;
  }

  const hashInput = [
    email.subject || '',
    email.fromEmail || '',
    email.sentDate?.toISOString() || email.receivedDate?.toISOString() || '',
  ].join('|');

  const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  return `pst_email_${hash}`;
}

export function generateEventExternalId(event: PSTCalendarEvent): string {
  const hashInput = [
    event.subject || '',
    event.startTime?.toISOString() || '',
    event.location || '',
  ].join('|');

  const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  return `pst_event_${hash}`;
}

/**
 * Parse a PST file and extract emails and calendar events
 */
export async function parsePstFile(
  filePath: string,
  userEmail: string,
  foldersToImport: string[] = ['Inbox', 'Sent Items', 'Calendar']
): Promise<ParseResult> {
  const result: ParseResult = {
    emails: [],
    calendarEvents: [],
    errors: [],
  };

  try {
    const pstFile = new PSTFile.PSTFile(filePath);
    const rootFolder = pstFile.getRootFolder();

    // Process the folder tree
    processFolder(rootFolder, '', result, userEmail, foldersToImport);

  } catch (error) {
    result.errors.push(`Failed to parse PST file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

function processFolder(
  folder: PSTFile.PSTFolder,
  parentPath: string,
  result: ParseResult,
  userEmail: string,
  foldersToImport: string[]
): void {
  const folderName = folder.displayName || 'Unknown';
  const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;

  // Check if this folder should be processed
  const shouldProcess = foldersToImport.some(f =>
    currentPath.toLowerCase().includes(f.toLowerCase())
  );

  if (shouldProcess && folder.hasSubfolders === false) {
    // This is a leaf folder we want to process
    const isCalendar = currentPath.toLowerCase().includes('calendar');
    const isSentItems = currentPath.toLowerCase().includes('sent');

    if (folder.contentCount > 0) {
      try {
        let item = folder.getNextChild();
        while (item !== null) {
          try {
            // Use messageClass to determine item type
            const messageClass = (item as { messageClass?: string }).messageClass || '';
            if (isCalendar && messageClass.includes('IPM.Appointment')) {
              const event = extractCalendarEvent(item, currentPath);
              if (event.startTime) {
                result.calendarEvents.push(event);
              }
            } else if (messageClass.includes('IPM.Note') || !isCalendar) {
              const email = extractEmail(item, currentPath, userEmail, isSentItems);
              if (email.subject || email.body) {
                result.emails.push(email);
              }
            }
          } catch (itemError) {
            result.errors.push(`Error processing item in ${currentPath}: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
          }
          item = folder.getNextChild();
        }
      } catch (folderError) {
        result.errors.push(`Error reading folder ${currentPath}: ${folderError instanceof Error ? folderError.message : String(folderError)}`);
      }
    }
  }

  // Process subfolders
  if (folder.hasSubfolders) {
    try {
      const subfolders = folder.getSubFolders();
      for (const subfolder of subfolders) {
        processFolder(subfolder, currentPath, result, userEmail, foldersToImport);
      }
    } catch (error) {
      result.errors.push(`Error accessing subfolders of ${currentPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEmail(
  item: any,
  folder: string,
  userEmail: string,
  isSentItems: boolean
): PSTEmail {
  const senderEmail = item.senderEmailAddress || '';
  const isFromMe = isSentItems || senderEmail.toLowerCase() === userEmail.toLowerCase();

  // Get recipients
  const toRecipients: string[] = [];
  const ccRecipients: string[] = [];

  try {
    const recipientCount = item.numberOfRecipients || 0;
    for (let i = 0; i < recipientCount; i++) {
      const recipient = item.getRecipient?.(i);
      if (recipient) {
        const email = recipient.smtpAddress || recipient.emailAddress || '';
        const recipientType = recipient.recipientType;
        if (recipientType === 1) { // TO
          toRecipients.push(email);
        } else if (recipientType === 2) { // CC
          ccRecipients.push(email);
        }
      }
    }
  } catch {
    // Ignore recipient extraction errors
  }

  return {
    messageId: item.internetMessageId || null,
    subject: item.subject || '',
    body: item.body || '',
    bodyHtml: item.bodyHTML || null,
    from: item.senderName || '',
    fromEmail: senderEmail,
    to: toRecipients,
    cc: ccRecipients,
    sentDate: item.clientSubmitTime || null,
    receivedDate: item.messageDeliveryTime || null,
    folder,
    hasAttachments: item.hasAttachments || false,
    attachmentCount: item.numberOfAttachments || 0,
    isFromMe,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCalendarEvent(
  item: any,
  folder: string
): PSTCalendarEvent {
  // Extract attendees
  const attendees: string[] = [];
  try {
    const recipientCount = item.numberOfRecipients || 0;
    for (let i = 0; i < recipientCount; i++) {
      const recipient = item.getRecipient?.(i);
      if (recipient) {
        const email = recipient.smtpAddress || recipient.emailAddress || '';
        if (email) attendees.push(email);
      }
    }
  } catch {
    // Ignore attendee extraction errors
  }

  return {
    subject: item.subject || '',
    body: item.body || '',
    location: item.location || null,
    startTime: item.startTime || null,
    endTime: item.endTime || null,
    isAllDay: item.subType === 1,
    attendees,
    organizer: item.senderEmailAddress || null,
    folder,
  };
}
