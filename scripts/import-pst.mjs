/**
 * PST File Import Script
 * Imports emails and calendar events from Outlook PST files into X-FORCE
 *
 * Usage: node scripts/import-pst.mjs
 *
 * This script:
 * 1. Opens the configured PST file
 * 2. Extracts emails from Inbox and Sent Items
 * 3. Extracts calendar events
 * 4. Imports into the activities table with deduplication
 */

import { createClient } from '@supabase/supabase-js';
import PSTFile from 'pst-extractor';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  PST_FILE_PATH: 'C:\\Users\\tmort\\OneDrive\\Desktop\\xraisales@affiliatedtech.com.pst',
  IMPORT_USER_EMAIL: 'xraisales@affiliatedtech.com',
  FOLDERS_TO_IMPORT: ['Inbox', 'Sent Items', 'Sent', 'Calendar'],
  MAX_BODY_LENGTH: 50000, // Truncate long emails/events
};

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Could not load .env.local:', e.message);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateEmailExternalId(email) {
  if (email.messageId) {
    // Clean up message ID (remove angle brackets and whitespace)
    const cleanId = email.messageId.replace(/[<>\s]/g, '');
    return `pst_email_${cleanId}`;
  }

  const hashInput = [
    email.subject || '',
    email.fromEmail || '',
    email.sentDate?.toISOString() || email.receivedDate?.toISOString() || '',
  ].join('|');

  const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  return `pst_email_${hash}`;
}

function generateEventExternalId(event) {
  const hashInput = [
    event.subject || '',
    event.startTime?.toISOString() || '',
    event.location || '',
  ].join('|');

  const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  return `pst_event_${hash}`;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

function formatDate(date) {
  if (!date) return null;
  try {
    return date.toISOString();
  } catch {
    return null;
  }
}

// ============================================
// PST PARSING
// ============================================

function extractEmail(message, folder, userEmail, isSentItems) {
  const senderEmail = message.senderEmailAddress || '';
  const isFromMe = isSentItems || senderEmail.toLowerCase().includes(userEmail.toLowerCase());

  // Get recipients
  const toRecipients = [];
  const ccRecipients = [];

  try {
    const recipientCount = message.numberOfRecipients;
    for (let i = 0; i < recipientCount; i++) {
      const recipient = message.getRecipient(i);
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
    messageId: message.internetMessageId || null,
    subject: message.subject || '',
    body: message.body || '',
    bodyHtml: message.bodyHTML || null,
    from: message.senderName || '',
    fromEmail: senderEmail,
    to: toRecipients,
    cc: ccRecipients,
    sentDate: message.clientSubmitTime || null,
    receivedDate: message.messageDeliveryTime || null,
    folder,
    hasAttachments: message.hasAttachments,
    attachmentCount: message.numberOfAttachments,
    isFromMe,
  };
}

function extractCalendarEvent(appointment, folder) {
  const attendees = [];
  try {
    const recipientCount = appointment.numberOfRecipients;
    for (let i = 0; i < recipientCount; i++) {
      const recipient = appointment.getRecipient(i);
      if (recipient) {
        const email = recipient.smtpAddress || recipient.emailAddress || '';
        if (email) attendees.push(email);
      }
    }
  } catch {
    // Ignore attendee extraction errors
  }

  return {
    subject: appointment.subject || '',
    body: appointment.body || '',
    location: appointment.location || null,
    startTime: appointment.startTime || null,
    endTime: appointment.endTime || null,
    isAllDay: appointment.subType === 1,
    attendees,
    organizer: appointment.senderEmailAddress || null,
    folder,
  };
}

function processFolder(folder, parentPath, results, userEmail, foldersToImport) {
  const folderName = folder.displayName || 'Unknown';
  const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;

  // Check if this folder should be processed
  const shouldProcess = foldersToImport.some(f =>
    currentPath.toLowerCase().includes(f.toLowerCase())
  );

  const isCalendar = currentPath.toLowerCase().includes('calendar');
  const isSentItems = currentPath.toLowerCase().includes('sent');

  if (shouldProcess && folder.contentCount > 0) {
    console.log(`  Processing: ${currentPath} (${folder.contentCount} items)`);

    try {
      let item = folder.getNextChild();
      while (item !== null) {
        try {
          if (isCalendar && item.messageClass?.includes('IPM.Appointment')) {
            const event = extractCalendarEvent(item, currentPath);
            if (event.startTime) {
              results.calendarEvents.push(event);
            }
          } else if (item.messageClass?.includes('IPM.Note') || !isCalendar) {
            const email = extractEmail(item, currentPath, userEmail, isSentItems);
            if (email.subject || email.body) {
              results.emails.push(email);
            }
          }
        } catch (itemError) {
          results.errors.push(`Error processing item in ${currentPath}: ${itemError.message}`);
        }
        item = folder.getNextChild();
      }
    } catch (folderError) {
      results.errors.push(`Error reading folder ${currentPath}: ${folderError.message}`);
    }
  }

  // Process subfolders
  if (folder.hasSubfolders) {
    try {
      const subfolders = folder.getSubFolders();
      for (const subfolder of subfolders) {
        processFolder(subfolder, currentPath, results, userEmail, foldersToImport);
      }
    } catch (error) {
      results.errors.push(`Error accessing subfolders of ${currentPath}: ${error.message}`);
    }
  }
}

async function parsePstFile(filePath, userEmail, foldersToImport) {
  const results = {
    emails: [],
    calendarEvents: [],
    errors: [],
  };

  console.log(`Opening PST file: ${filePath}`);

  try {
    const pstFile = new PSTFile.PSTFile(filePath);
    const rootFolder = pstFile.getRootFolder();

    console.log('Traversing folder structure...');
    processFolder(rootFolder, '', results, userEmail, foldersToImport);

  } catch (error) {
    results.errors.push(`Failed to parse PST file: ${error.message}`);
  }

  return results;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function getOrCreateExternalCompany() {
  // Check if "PST Import" company exists
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('name', 'PST Import')
    .single();

  if (existing) {
    return existing.id;
  }

  // Create it
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: 'PST Import',
      status: 'cold_lead',
      segment: 'smb',
      industry: 'pest',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create PST Import company:', error.message);
    return null;
  }

  return newCompany.id;
}

async function getSystemUserId() {
  // Get the first admin user or any user as the owner
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  return user?.id || null;
}

async function checkExistingExternalId(externalId) {
  const { data } = await supabase
    .from('activities')
    .select('id')
    .eq('external_id', externalId)
    .single();

  return !!data;
}

async function importEmail(email, companyId, userId) {
  const externalId = generateEmailExternalId(email);

  // Check for duplicate
  const exists = await checkExistingExternalId(externalId);
  if (exists) {
    return { status: 'skipped', reason: 'duplicate' };
  }

  const activityType = email.isFromMe ? 'email_sent' : 'email_received';
  const occurredAt = formatDate(email.sentDate) || formatDate(email.receivedDate) || new Date().toISOString();

  const { error } = await supabase.from('activities').insert({
    company_id: companyId,
    user_id: userId,
    type: activityType,
    subject: truncateText(email.subject, 500),
    body: truncateText(email.body || email.bodyHtml || '', CONFIG.MAX_BODY_LENGTH),
    external_id: externalId,
    occurred_at: occurredAt,
    metadata: {
      source: 'pst_import',
      folder: email.folder,
      from: email.from,
      fromEmail: email.fromEmail,
      to: email.to,
      cc: email.cc,
      hasAttachments: email.hasAttachments,
      attachmentCount: email.attachmentCount,
      messageId: email.messageId,
    },
  });

  if (error) {
    return { status: 'error', reason: error.message };
  }

  return { status: 'imported' };
}

async function importCalendarEvent(event, companyId, userId) {
  const externalId = generateEventExternalId(event);

  // Check for duplicate
  const exists = await checkExistingExternalId(externalId);
  if (exists) {
    return { status: 'skipped', reason: 'duplicate' };
  }

  const occurredAt = formatDate(event.startTime) || new Date().toISOString();

  const { error } = await supabase.from('activities').insert({
    company_id: companyId,
    user_id: userId,
    type: 'meeting',
    subject: truncateText(event.subject, 500),
    body: truncateText(event.body, CONFIG.MAX_BODY_LENGTH),
    external_id: externalId,
    occurred_at: occurredAt,
    metadata: {
      source: 'pst_import',
      folder: event.folder,
      location: event.location,
      endTime: formatDate(event.endTime),
      isAllDay: event.isAllDay,
      attendees: event.attendees,
      organizer: event.organizer,
    },
  });

  if (error) {
    return { status: 'error', reason: error.message };
  }

  return { status: 'imported' };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(50));
  console.log('PST IMPORT STARTED');
  console.log('='.repeat(50));
  console.log(`File: ${CONFIG.PST_FILE_PATH}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Check if file exists
  if (!existsSync(CONFIG.PST_FILE_PATH)) {
    console.error(`ERROR: PST file not found: ${CONFIG.PST_FILE_PATH}`);
    process.exit(1);
  }

  // Get company and user IDs for the activities
  const companyId = await getOrCreateExternalCompany();
  const userId = await getSystemUserId();

  if (!companyId || !userId) {
    console.error('ERROR: Could not get company or user ID');
    process.exit(1);
  }

  console.log(`Using Company ID: ${companyId}`);
  console.log(`Using User ID: ${userId}`);
  console.log('');

  // Parse the PST file
  const parseResults = await parsePstFile(
    CONFIG.PST_FILE_PATH,
    CONFIG.IMPORT_USER_EMAIL,
    CONFIG.FOLDERS_TO_IMPORT
  );

  console.log('');
  console.log(`Found ${parseResults.emails.length} emails`);
  console.log(`Found ${parseResults.calendarEvents.length} calendar events`);
  console.log('');

  // Import emails
  const emailStats = { imported: 0, skipped: 0, errors: 0 };
  console.log('Importing emails...');

  for (const email of parseResults.emails) {
    const result = await importEmail(email, companyId, userId);
    if (result.status === 'imported') {
      emailStats.imported++;
    } else if (result.status === 'skipped') {
      emailStats.skipped++;
    } else {
      emailStats.errors++;
      if (emailStats.errors <= 5) {
        console.error(`  Error importing email "${email.subject}": ${result.reason}`);
      }
    }

    // Progress indicator
    const total = emailStats.imported + emailStats.skipped + emailStats.errors;
    if (total % 100 === 0) {
      console.log(`  Processed ${total}/${parseResults.emails.length} emails...`);
    }
  }

  console.log(`  Emails - Imported: ${emailStats.imported}, Skipped: ${emailStats.skipped}, Errors: ${emailStats.errors}`);
  console.log('');

  // Import calendar events
  const calendarStats = { imported: 0, skipped: 0, errors: 0 };
  console.log('Importing calendar events...');

  for (const event of parseResults.calendarEvents) {
    const result = await importCalendarEvent(event, companyId, userId);
    if (result.status === 'imported') {
      calendarStats.imported++;
    } else if (result.status === 'skipped') {
      calendarStats.skipped++;
    } else {
      calendarStats.errors++;
      if (calendarStats.errors <= 5) {
        console.error(`  Error importing event "${event.subject}": ${result.reason}`);
      }
    }
  }

  console.log(`  Calendar - Imported: ${calendarStats.imported}, Skipped: ${calendarStats.skipped}, Errors: ${calendarStats.errors}`);
  console.log('');

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('='.repeat(50));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total Imported: ${emailStats.imported + calendarStats.imported}`);
  console.log(`Total Skipped (duplicates): ${emailStats.skipped + calendarStats.skipped}`);
  console.log(`Total Errors: ${emailStats.errors + calendarStats.errors}`);
  console.log(`Parse Errors: ${parseResults.errors.length}`);
  console.log(`Duration: ${duration} seconds`);

  if (parseResults.errors.length > 0) {
    console.log('');
    console.log('Parse Errors:');
    parseResults.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (parseResults.errors.length > 10) {
      console.log(`  ... and ${parseResults.errors.length - 10} more`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
