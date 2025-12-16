/**
 * PST File Parser
 * Parses Outlook PST files and extracts emails and calendar events
 */

import PSTFile from 'pst-extractor';
import { createHash } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface PstEmail {
  messageId: string | null;
  subject: string;
  body: string;
  bodyHtml: string | null;
  senderName: string;
  senderEmail: string;
  recipients: Array<{
    name: string;
    email: string;
    type: 'to' | 'cc' | 'bcc';
  }>;
  sentAt: Date | null;
  receivedAt: Date | null;
  folder: string;
  hasAttachments: boolean;
  attachmentNames: string[];
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
}

export interface PstCalendarEvent {
  subject: string;
  body: string;
  location: string | null;
  startTime: Date | null;
  endTime: Date | null;
  isAllDay: boolean;
  organizer: string | null;
  attendees: Array<{
    name: string;
    email: string;
    required: boolean;
  }>;
  folder: string;
  recurrencePattern: string | null;
}

export interface PstImportItem {
  type: 'email_sent' | 'email_received' | 'meeting';
  externalId: string;
  subject: string;
  body: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

// ============================================
// HASH GENERATION
// ============================================

/**
 * Generate a deterministic external ID for deduplication
 */
export function generateExternalId(type: 'email' | 'event', item: {
  subject: string;
  date: Date | null;
  sender?: string;
  startTime?: Date | null;
}): string {
  const parts: string[] = [type];

  if (item.subject) {
    parts.push(item.subject.substring(0, 100));
  }

  if (item.date) {
    parts.push(item.date.toISOString());
  } else if (item.startTime) {
    parts.push(item.startTime.toISOString());
  }

  if (item.sender) {
    parts.push(item.sender.toLowerCase());
  }

  const hash = createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .substring(0, 16);

  return `pst_${type}_${hash}`;
}

// ============================================
// FOLDER HELPERS
// ============================================

/**
 * Check if folder name matches any of the target names (case-insensitive)
 */
function folderMatches(folderName: string, targets: string[]): boolean {
  const lower = folderName.toLowerCase();
  return targets.some(t => lower.includes(t.toLowerCase()));
}

// ============================================
// EMAIL EXTRACTION
// ============================================

/**
 * Extract email from PST message
 */
function extractEmail(message: PSTFile.PSTMessage, folderPath: string): PstEmail | null {
  try {
    // Get recipients
    const recipients: PstEmail['recipients'] = [];
    const numRecipients = message.numberOfRecipients || 0;

    for (let i = 0; i < numRecipients; i++) {
      try {
        const recipient = message.getRecipient(i);
        if (recipient) {
          const recipientType = recipient.recipientType || 0;
          let type: 'to' | 'cc' | 'bcc' = 'to';
          if (recipientType === 2) type = 'cc';
          if (recipientType === 3) type = 'bcc';

          recipients.push({
            name: recipient.displayName || '',
            email: recipient.smtpAddress || recipient.emailAddress || '',
            type,
          });
        }
      } catch {
        // Skip problematic recipients
      }
    }

    // Get attachment info
    const attachmentNames: string[] = [];
    const numAttachments = message.numberOfAttachments || 0;

    for (let i = 0; i < numAttachments; i++) {
      try {
        const attachment = message.getAttachment(i);
        if (attachment && attachment.longFilename) {
          attachmentNames.push(attachment.longFilename);
        } else if (attachment && attachment.filename) {
          attachmentNames.push(attachment.filename);
        }
      } catch {
        // Skip problematic attachments
      }
    }

    // Determine importance
    let importance: 'low' | 'normal' | 'high' = 'normal';
    const importanceValue = message.importance || 1;
    if (importanceValue === 0) importance = 'low';
    if (importanceValue === 2) importance = 'high';

    return {
      messageId: message.internetMessageId || null,
      subject: message.subject || '(No Subject)',
      body: message.body || '',
      bodyHtml: message.bodyHTML || null,
      senderName: message.senderName || '',
      senderEmail: message.senderEmailAddress || '',
      recipients,
      sentAt: message.clientSubmitTime || null,
      receivedAt: message.messageDeliveryTime || null,
      folder: folderPath,
      hasAttachments: numAttachments > 0,
      attachmentNames,
      importance,
      isRead: message.isRead || false,
    };
  } catch (error) {
    console.error('Error extracting email:', error);
    return null;
  }
}

// ============================================
// CALENDAR EXTRACTION
// ============================================

/**
 * Extract calendar event from PST appointment
 */
function extractCalendarEvent(appointment: PSTFile.PSTAppointment, folderPath: string): PstCalendarEvent | null {
  try {
    // Get attendees
    const attendees: PstCalendarEvent['attendees'] = [];
    const numRecipients = appointment.numberOfRecipients || 0;

    for (let i = 0; i < numRecipients; i++) {
      try {
        const recipient = appointment.getRecipient(i);
        if (recipient) {
          const recipientType = recipient.recipientType || 0;
          attendees.push({
            name: recipient.displayName || '',
            email: recipient.smtpAddress || recipient.emailAddress || '',
            required: recipientType === 1, // Required attendee
          });
        }
      } catch {
        // Skip problematic recipients
      }
    }

    return {
      subject: appointment.subject || '(No Subject)',
      body: appointment.body || '',
      location: appointment.location || null,
      startTime: appointment.startTime || null,
      endTime: appointment.endTime || null,
      isAllDay: appointment.subType === 1,
      organizer: appointment.senderName || null,
      attendees,
      folder: folderPath,
      recurrencePattern: appointment.recurrencePattern || null,
    };
  } catch (error) {
    console.error('Error extracting calendar event:', error);
    return null;
  }
}

// ============================================
// PST TRAVERSAL
// ============================================

interface TraversalOptions {
  maxItems?: number;
  emailFolders?: string[];
  calendarFolders?: string[];
  importUserEmail?: string;
  onProgress?: (processed: number, type: string) => void;
}

interface TraversalResult {
  emails: PstImportItem[];
  events: PstImportItem[];
  stats: {
    foldersProcessed: number;
    emailsFound: number;
    eventsFound: number;
    errors: number;
  };
}

/**
 * Recursively traverse PST folders and extract items
 */
function traverseFolder(
  folder: PSTFile.PSTFolder,
  folderPath: string,
  options: TraversalOptions,
  result: TraversalResult
): void {
  const folderName = folder.displayName || '';
  const currentPath = folderPath ? `${folderPath}/${folderName}` : folderName;

  const emailFolders = options.emailFolders || ['inbox', 'sent'];
  const calendarFolders = options.calendarFolders || ['calendar'];
  const importUserEmail = options.importUserEmail?.toLowerCase() || '';

  const isEmailFolder = folderMatches(folderName, emailFolders);
  const isCalendarFolder = folderMatches(folderName, calendarFolders);

  result.stats.foldersProcessed++;

  // Process items in this folder
  if (folder.hasSubfolders) {
    try {
      let childFolder = folder.getNextChild();
      while (childFolder) {
        traverseFolder(childFolder, currentPath, options, result);
        childFolder = folder.getNextChild();
      }
    } catch (error) {
      console.error(`Error processing subfolders in ${currentPath}:`, error);
      result.stats.errors++;
    }
  }

  // Process emails
  if (isEmailFolder && folder.contentCount > 0) {
    try {
      let email = folder.getNextChild() as PSTFile.PSTMessage | null;
      while (email) {
        if (options.maxItems && (result.emails.length + result.events.length) >= options.maxItems) {
          break;
        }

        const extracted = extractEmail(email, currentPath);
        if (extracted) {
          result.stats.emailsFound++;

          // Determine if sent or received based on folder and sender
          const isSent = folderMatches(folderName, ['sent']) ||
            (importUserEmail && extracted.senderEmail.toLowerCase() === importUserEmail);

          const occurredAt = isSent ? extracted.sentAt : extracted.receivedAt;

          if (occurredAt) {
            const importItem: PstImportItem = {
              type: isSent ? 'email_sent' : 'email_received',
              externalId: generateExternalId('email', {
                subject: extracted.subject,
                date: occurredAt,
                sender: extracted.senderEmail,
              }),
              subject: extracted.subject,
              body: extracted.bodyHtml || extracted.body,
              occurredAt,
              metadata: {
                folder: currentPath,
                from: { name: extracted.senderName, email: extracted.senderEmail },
                to: extracted.recipients.filter(r => r.type === 'to'),
                cc: extracted.recipients.filter(r => r.type === 'cc'),
                hasAttachments: extracted.hasAttachments,
                attachmentNames: extracted.attachmentNames,
                importance: extracted.importance,
                messageId: extracted.messageId,
              },
            };

            result.emails.push(importItem);

            if (options.onProgress) {
              options.onProgress(result.emails.length + result.events.length, 'email');
            }
          }
        }

        email = folder.getNextChild() as PSTFile.PSTMessage | null;
      }
    } catch (error) {
      console.error(`Error processing emails in ${currentPath}:`, error);
      result.stats.errors++;
    }
  }

  // Process calendar events
  if (isCalendarFolder && folder.contentCount > 0) {
    try {
      let item = folder.getNextChild();
      while (item) {
        if (options.maxItems && (result.emails.length + result.events.length) >= options.maxItems) {
          break;
        }

        // Check if it's an appointment
        if (item instanceof PSTFile.PSTAppointment) {
          const extracted = extractCalendarEvent(item, currentPath);
          if (extracted && extracted.startTime) {
            result.stats.eventsFound++;

            const importItem: PstImportItem = {
              type: 'meeting',
              externalId: generateExternalId('event', {
                subject: extracted.subject,
                startTime: extracted.startTime,
              }),
              subject: extracted.subject,
              body: extracted.body,
              occurredAt: extracted.startTime,
              metadata: {
                folder: currentPath,
                location: extracted.location,
                endTime: extracted.endTime?.toISOString() || null,
                isAllDay: extracted.isAllDay,
                organizer: extracted.organizer,
                attendees: extracted.attendees,
                recurrencePattern: extracted.recurrencePattern,
              },
            };

            result.events.push(importItem);

            if (options.onProgress) {
              options.onProgress(result.emails.length + result.events.length, 'event');
            }
          }
        }

        item = folder.getNextChild();
      }
    } catch (error) {
      console.error(`Error processing calendar in ${currentPath}:`, error);
      result.stats.errors++;
    }
  }
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parse a PST file and extract emails and calendar events
 */
export async function parsePstFile(
  filePath: string,
  options: TraversalOptions = {}
): Promise<TraversalResult> {
  console.log(`[PstParser] Opening PST file: ${filePath}`);

  const result: TraversalResult = {
    emails: [],
    events: [],
    stats: {
      foldersProcessed: 0,
      emailsFound: 0,
      eventsFound: 0,
      errors: 0,
    },
  };

  try {
    const pstFile = new PSTFile.default(filePath);
    const rootFolder = pstFile.getRootFolder();

    if (!rootFolder) {
      throw new Error('Could not read PST root folder');
    }

    console.log(`[PstParser] PST file opened successfully`);

    // Traverse the folder structure
    traverseFolder(rootFolder, '', options, result);

    console.log(`[PstParser] Extraction complete:`, result.stats);

    return result;
  } catch (error) {
    console.error('[PstParser] Error parsing PST file:', error);
    throw error;
  }
}

/**
 * Get folder structure from PST file (for debugging/exploration)
 */
export function getPstFolderStructure(filePath: string): string[] {
  const folders: string[] = [];

  try {
    const pstFile = new PSTFile.default(filePath);
    const rootFolder = pstFile.getRootFolder();

    if (!rootFolder) {
      throw new Error('Could not read PST root folder');
    }

    function traverse(folder: PSTFile.PSTFolder, path: string): void {
      const name = folder.displayName || 'Unknown';
      const currentPath = path ? `${path}/${name}` : name;
      const itemCount = folder.contentCount || 0;

      folders.push(`${currentPath} (${itemCount} items)`);

      if (folder.hasSubfolders) {
        let child = folder.getNextChild();
        while (child) {
          if (child instanceof PSTFile.PSTFolder) {
            traverse(child, currentPath);
          }
          child = folder.getNextChild();
        }
      }
    }

    traverse(rootFolder, '');

  } catch (error) {
    console.error('Error reading PST structure:', error);
  }

  return folders;
}
