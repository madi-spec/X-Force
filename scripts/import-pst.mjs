#!/usr/bin/env node
/**
 * PST File Import Script
 * Imports emails and calendar events from a local Outlook PST file into X-FORCE
 *
 * Usage: node scripts/import-pst.mjs [--dry-run] [--max=1000]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import PSTExtractor from 'pst-extractor';
const { PSTFile, PSTFolder, PSTMessage, PSTAppointment } = PSTExtractor;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  PST_FILE_PATH: 'C:\\Users\\tmort\\OneDrive\\Desktop\\xraisales@affiliatedtech.com.pst',
  IMPORT_USER_EMAIL: 'xraisales@affiliatedtech.com',
  FOLDERS_TO_IMPORT: {
    email: ['inbox', 'sent items', 'sent', 'archive'],
    calendar: ['calendar'],
  },
  MAX_BODY_LENGTH: 50000,
  BATCH_SIZE: 100,
};

// ============================================
// ENVIRONMENT LOADING
// ============================================

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.error('Failed to load .env.local:', e.message);
    process.exit(1);
  }
}

// ============================================
// HASH GENERATION
// ============================================

function generateExternalId(type, item) {
  const parts = [type];

  if (item.subject) {
    parts.push(item.subject.substring(0, 100));
  }

  if (item.date) {
    parts.push(item.date.toISOString());
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

function folderMatches(folderName, targets) {
  const lower = (folderName || '').toLowerCase();
  return targets.some(t => lower.includes(t.toLowerCase()));
}

// ============================================
// PST EXTRACTION
// ============================================

function extractEmail(message, folderPath) {
  try {
    const recipients = [];
    const numRecipients = message.numberOfRecipients || 0;

    for (let i = 0; i < numRecipients; i++) {
      try {
        const recipient = message.getRecipient(i);
        if (recipient) {
          const recipientType = recipient.recipientType || 0;
          let type = 'to';
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

    const attachmentNames = [];
    const numAttachments = message.numberOfAttachments || 0;

    for (let i = 0; i < numAttachments; i++) {
      try {
        const attachment = message.getAttachment(i);
        if (attachment) {
          const name = attachment.longFilename || attachment.filename;
          if (name) attachmentNames.push(name);
        }
      } catch {
        // Skip problematic attachments
      }
    }

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
    };
  } catch (error) {
    console.error('Error extracting email:', error.message);
    return null;
  }
}

function extractCalendarEvent(appointment, folderPath) {
  try {
    const attendees = [];
    const numRecipients = appointment.numberOfRecipients || 0;

    for (let i = 0; i < numRecipients; i++) {
      try {
        const recipient = appointment.getRecipient(i);
        if (recipient) {
          attendees.push({
            name: recipient.displayName || '',
            email: recipient.smtpAddress || recipient.emailAddress || '',
            required: recipient.recipientType === 1,
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
    };
  } catch (error) {
    console.error('Error extracting calendar event:', error.message);
    return null;
  }
}

// ============================================
// PST TRAVERSAL
// ============================================

function traversePst(filePath, options = {}) {
  const result = {
    emails: [],
    events: [],
    stats: {
      foldersProcessed: 0,
      emailsFound: 0,
      eventsFound: 0,
      errors: 0,
    },
  };

  console.log(`Opening PST file: ${filePath}`);

  try {
    const pstFile = new PSTFile(filePath);
    const rootFolder = pstFile.getRootFolder();

    if (!rootFolder) {
      throw new Error('Could not read PST root folder');
    }

    console.log('PST file opened successfully');

    if (options.verbose) {
      console.log(`Root folder: ${rootFolder.displayName || '(root)'}`);
      console.log(`Root has subfolders: ${rootFolder.hasSubfolders}`);
      console.log(`Root content count: ${rootFolder.contentCount || 0}`);
    }

    function processFolder(folder, path) {
      const name = folder.displayName || '(unnamed)';
      const currentPath = path ? `${path}/${name}` : name;

      const isEmailFolder = folderMatches(name, CONFIG.FOLDERS_TO_IMPORT.email);
      const isCalendarFolder = folderMatches(name, CONFIG.FOLDERS_TO_IMPORT.calendar);

      result.stats.foldersProcessed++;

      if (options.verbose) {
        console.log(`  [${result.stats.foldersProcessed}] Folder: "${name}" (${folder.contentCount || 0} items)`);
      }

      // Process subfolders using getSubFolders()
      if (folder.hasSubfolders) {
        try {
          const subfolders = folder.getSubFolders();
          if (subfolders && subfolders.length > 0) {
            for (const subfolder of subfolders) {
              processFolder(subfolder, currentPath);
            }
          }
        } catch (error) {
          // Some folders like Search folders may not be accessible
          if (options.verbose) {
            console.error(`  Error getting subfolders in ${currentPath}:`, error.message);
          }
          result.stats.errors++;
        }
      }

      // Process content items
      if ((isEmailFolder || isCalendarFolder) && folder.contentCount > 0) {
        try {
          // Reset the iterator to the beginning
          folder.moveChildCursorTo(0);
          let item = folder.getNextChild();
          while (item) {
            if (options.maxItems && (result.emails.length + result.events.length) >= options.maxItems) {
              console.log(`Reached max items limit (${options.maxItems})`);
              return;
            }

            // Check if it's an appointment/calendar item
            const msgClass = item.messageClass || '';
            if (isCalendarFolder && msgClass.includes('IPM.Appointment')) {
              const extracted = extractCalendarEvent(item, currentPath);
              if (extracted && extracted.startTime) {
                result.stats.eventsFound++;

                const importItem = {
                  type: 'meeting',
                  externalId: generateExternalId('event', {
                    subject: extracted.subject,
                    date: extracted.startTime,
                  }),
                  subject: extracted.subject,
                  body: extracted.body.substring(0, CONFIG.MAX_BODY_LENGTH),
                  occurredAt: extracted.startTime,
                  metadata: {
                    folder: currentPath,
                    location: extracted.location,
                    endTime: extracted.endTime?.toISOString() || null,
                    isAllDay: extracted.isAllDay,
                    organizer: extracted.organizer,
                    attendees: extracted.attendees,
                    source: 'pst_import',
                  },
                };

                result.events.push(importItem);
              }
            } else if (isEmailFolder) {
              // It's an email
              const extracted = extractEmail(item, currentPath);
              if (extracted) {
                result.stats.emailsFound++;

                // Determine if sent or received
                const isSent = folderMatches(name, ['sent']) ||
                  (CONFIG.IMPORT_USER_EMAIL &&
                   extracted.senderEmail.toLowerCase() === CONFIG.IMPORT_USER_EMAIL.toLowerCase());

                const occurredAt = isSent ? extracted.sentAt : extracted.receivedAt;

                if (occurredAt) {
                  const body = extracted.bodyHtml || extracted.body;
                  const importItem = {
                    type: isSent ? 'email_sent' : 'email_received',
                    externalId: generateExternalId('email', {
                      subject: extracted.subject,
                      date: occurredAt,
                      sender: extracted.senderEmail,
                    }),
                    subject: extracted.subject,
                    body: body.substring(0, CONFIG.MAX_BODY_LENGTH),
                    occurredAt,
                    metadata: {
                      folder: currentPath,
                      from: { name: extracted.senderName, email: extracted.senderEmail },
                      to: extracted.recipients.filter(r => r.type === 'to'),
                      cc: extracted.recipients.filter(r => r.type === 'cc'),
                      hasAttachments: extracted.hasAttachments,
                      attachmentCount: extracted.attachmentNames.length,
                      messageId: extracted.messageId,
                      source: 'pst_import',
                    },
                  };

                  result.emails.push(importItem);
                }
              }
            }

            item = folder.getNextChild();
          }
        } catch (error) {
          console.error(`Error processing items in ${currentPath}:`, error.message);
          result.stats.errors++;
        }
      }
    }

    processFolder(rootFolder, '');

  } catch (error) {
    console.error('Error parsing PST file:', error);
    throw error;
  }

  return result;
}

// ============================================
// DATABASE IMPORT
// ============================================

async function importToDatabase(supabase, items, options = {}) {
  const stats = {
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  // Get or create system user and company for imports
  let userId = null;
  let companyId = null;

  // Try to find a system/admin user
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    console.error('No users found in database. Cannot import.');
    return stats;
  }

  // Try to find or create a company for external contacts
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .eq('name', 'External Contacts')
    .limit(1);

  if (companies && companies.length > 0) {
    companyId = companies[0].id;
  } else {
    // Create the company
    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: 'External Contacts',
        status: 'cold_lead',
        segment: 'smb',
        industry: 'Other',
        agent_count: 0,
      })
      .select('id')
      .single();

    if (companyError) {
      console.error('Failed to create External Contacts company:', companyError);
      return stats;
    }
    companyId = newCompany.id;
    console.log('Created External Contacts company:', companyId);
  }

  console.log(`Using user ID: ${userId}`);
  console.log(`Using company ID: ${companyId}`);

  // Process items in batches
  const batches = [];
  for (let i = 0; i < items.length; i += CONFIG.BATCH_SIZE) {
    batches.push(items.slice(i, i + CONFIG.BATCH_SIZE));
  }

  console.log(`Processing ${items.length} items in ${batches.length} batches...`);

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    console.log(`  Batch ${batchNum + 1}/${batches.length} (${batch.length} items)`);

    for (const item of batch) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('external_id', item.externalId)
        .single();

      if (existing) {
        stats.skipped++;
        continue;
      }

      if (options.dryRun) {
        stats.imported++;
        continue;
      }

      // Insert the activity
      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: userId,
          company_id: companyId,
          type: item.type,
          subject: item.subject,
          body: item.body,
          metadata: item.metadata,
          external_id: item.externalId,
          occurred_at: item.occurredAt.toISOString(),
        });

      if (error) {
        // Check if it's a duplicate key error (external_id unique constraint)
        if (error.code === '23505') {
          stats.skipped++;
        } else {
          console.error(`Error inserting activity:`, error.message);
          stats.errors++;
        }
      } else {
        stats.imported++;
      }
    }
  }

  return stats;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('=== PST Import Started ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  let maxItems = null;

  for (const arg of args) {
    if (arg.startsWith('--max=')) {
      maxItems = parseInt(arg.split('=')[1], 10);
    }
  }

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made to the database');
  }

  if (maxItems) {
    console.log(`Max items limit: ${maxItems}`);
  }

  console.log('');

  // Check if PST file exists
  if (!existsSync(CONFIG.PST_FILE_PATH)) {
    console.error(`PST file not found: ${CONFIG.PST_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`File: ${CONFIG.PST_FILE_PATH}`);
  console.log('');

  // Load environment and create Supabase client
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Extract from PST
  console.log('Extracting from PST file...');
  const startExtract = Date.now();

  const extractResult = traversePst(CONFIG.PST_FILE_PATH, { maxItems, verbose });

  const extractTime = ((Date.now() - startExtract) / 1000).toFixed(1);
  console.log('');
  console.log(`Extraction complete in ${extractTime}s`);
  console.log(`  Folders processed: ${extractResult.stats.foldersProcessed}`);
  console.log(`  Emails found: ${extractResult.stats.emailsFound}`);
  console.log(`  Calendar events found: ${extractResult.stats.eventsFound}`);
  console.log(`  Errors: ${extractResult.stats.errors}`);
  console.log('');

  // Combine emails and events for import
  const allItems = [...extractResult.emails, ...extractResult.events];

  if (allItems.length === 0) {
    console.log('No items to import.');
    return;
  }

  // Import to database
  console.log('Importing to database...');
  const startImport = Date.now();

  const importStats = await importToDatabase(supabase, allItems, { dryRun });

  const importTime = ((Date.now() - startImport) / 1000).toFixed(1);
  console.log('');
  console.log('=== Import Complete ===');
  console.log(`  Imported: ${importStats.imported}`);
  console.log(`  Skipped (duplicates): ${importStats.skipped}`);
  console.log(`  Errors: ${importStats.errors}`);
  console.log(`  Duration: ${importTime}s`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
