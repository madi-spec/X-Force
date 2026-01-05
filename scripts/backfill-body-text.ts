/**
 * Backfill body_text from body_html in email_messages
 * Then re-sync to communications table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Convert HTML content to plain text
 */
function htmlToPlainText(html: string | null | undefined): string | null {
  if (!html) return null;

  let text = html
    // Remove style and script blocks entirely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Convert <br> and block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Clean up whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text || null;
}

async function backfill() {
  console.log('=== Backfill body_text from body_html ===\n');

  // Get all emails with body_html but no body_text
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id, body_html, body_text')
    .not('body_html', 'is', null);

  if (error) {
    console.error('Error fetching emails:', error);
    return;
  }

  console.log(`Found ${emails?.length || 0} emails with body_html\n`);

  let updated = 0;
  let skipped = 0;

  for (const email of emails || []) {
    if (email.body_text) {
      skipped++;
      continue;
    }

    const bodyText = htmlToPlainText(email.body_html);

    if (bodyText) {
      const { error: updateError } = await supabase
        .from('email_messages')
        .update({ body_text: bodyText })
        .eq('id', email.id);

      if (updateError) {
        console.error(`Error updating email ${email.id}:`, updateError);
      } else {
        updated++;
      }
    }
  }

  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had body_text): ${skipped}`);

  // Now update communications with the new full_content
  console.log('\n=== Updating communications with full_content ===\n');

  const { data: comms, error: commsError } = await supabase
    .from('communications')
    .select('id, source_id')
    .eq('source_table', 'email_messages')
    .is('full_content', null);

  if (commsError) {
    console.error('Error fetching communications:', commsError);
    return;
  }

  console.log(`Found ${comms?.length || 0} communications without full_content\n`);

  let commsUpdated = 0;

  for (const comm of comms || []) {
    if (!comm.source_id) continue;

    // Get the email body_text
    const { data: email } = await supabase
      .from('email_messages')
      .select('body_text')
      .eq('id', comm.source_id)
      .single();

    if (email?.body_text) {
      const { error: updateError } = await supabase
        .from('communications')
        .update({ full_content: email.body_text })
        .eq('id', comm.id);

      if (!updateError) {
        commsUpdated++;
      }
    }
  }

  console.log(`Communications updated: ${commsUpdated}`);

  console.log('\n=== Done ===');
}

backfill().catch(console.error);
