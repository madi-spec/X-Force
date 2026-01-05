/**
 * Fix Orphaned Command Center Items
 *
 * Links existing command center items that are missing company/contact/deal links.
 * Uses auto-linking to find or create the appropriate entities.
 *
 * Run with: npx tsx scripts/fix-orphaned-items.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { autoLinkEntities, extractDomain } from '../src/lib/intelligence/autoLinkEntities';

interface OrphanedItem {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  why_now: string | null;
  tier: number;
  tier_trigger: string | null;
  source: string | null;
  conversation_id: string | null;
  transcription_id: string | null;
  created_at: string;
}

interface EmailConversation {
  id: string;
  user_id: string;
  from_email: string | null;
  from_name: string | null;
  contact_id: string | null;
  company_id: string | null;
}

async function main() {
  console.log('='.repeat(80));
  console.log('ORPHANED ITEMS FIX SCRIPT');
  console.log('='.repeat(80));

  const supabase = createAdminClient();

  // Find orphaned items (no company or contact link)
  const { data: orphanedItems, error } = await supabase
    .from('command_center_items')
    .select('*')
    .is('company_id', null)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orphaned items:', error);
    return;
  }

  console.log(`\nFound ${orphanedItems?.length || 0} orphaned items\n`);

  if (!orphanedItems || orphanedItems.length === 0) {
    console.log('No orphaned items to fix.');
    return;
  }

  // Group by user for reporting
  const byUser = new Map<string, OrphanedItem[]>();
  for (const item of orphanedItems) {
    const existing = byUser.get(item.user_id) || [];
    existing.push(item);
    byUser.set(item.user_id, existing);
  }

  console.log('Orphaned items by user:');
  for (const [userId, items] of byUser) {
    console.log(`  User ${userId.substring(0, 8)}...: ${items.length} items`);
  }

  // Process each orphaned item
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of orphanedItems as OrphanedItem[]) {
    console.log(`\n--- Processing: ${item.title.substring(0, 50)}... ---`);

    try {
      // Try to get info from conversation if linked
      let email: string | undefined;
      let contactName: string | undefined;
      let companyName: string | undefined;

      if (item.conversation_id) {
        const { data: conv } = await supabase
          .from('email_conversations')
          .select('from_email, from_name, contact_id, company_id')
          .eq('id', item.conversation_id)
          .single();

        if (conv) {
          email = conv.from_email || undefined;
          contactName = conv.from_name || undefined;

          // If conversation has links, use them directly
          if (conv.company_id) {
            await supabase
              .from('command_center_items')
              .update({
                company_id: conv.company_id,
                contact_id: conv.contact_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            console.log(`  Linked from conversation: company=${conv.company_id?.substring(0, 8)}...`);
            fixed++;
            continue;
          }
        }
      }

      // Try to extract company name from title or description
      if (!companyName) {
        const text = `${item.title} ${item.description || ''} ${item.why_now || ''}`;

        // Look for patterns like "Company Name - Action" or "Action for Company Name"
        const titleMatch = item.title.match(/^([^-]+)\s*-/);
        if (titleMatch) {
          companyName = titleMatch[1].trim();
        }

        // Look for "for X" pattern
        const forMatch = text.match(/for\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-,]|\s+trial|\s+demo|\s+review)/i);
        if (forMatch && !companyName) {
          companyName = forMatch[1].trim();
        }
      }

      // If we don't have enough info, skip
      if (!email && !companyName) {
        console.log('  Skipped: No email or company name found');
        skipped++;
        continue;
      }

      // Run auto-link
      const autoLink = await autoLinkEntities({
        email,
        contact_name: contactName,
        company_name: companyName,
        domain: email ? extractDomain(email) : undefined,
        additional_context: {
          source: item.tier_trigger || undefined,
        },
        user_id: item.user_id,
      });

      // Update the item with links
      if (autoLink.company_id || autoLink.contact_id || autoLink.deal_id) {
        await supabase
          .from('command_center_items')
          .update({
            company_id: autoLink.company_id,
            contact_id: autoLink.contact_id,
            deal_id: autoLink.deal_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        console.log(`  Fixed: company=${autoLink.company_id?.substring(0, 8)}..., contact=${autoLink.contact_id?.substring(0, 8)}..., deal=${autoLink.deal_id?.substring(0, 8)}...`);
        console.log(`  Created: company=${autoLink.created.company}, contact=${autoLink.created.contact}, deal=${autoLink.created.deal}`);
        fixed++;
      } else {
        console.log('  Skipped: Auto-link returned no IDs');
        skipped++;
      }
    } catch (err) {
      console.error(`  Error: ${err}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total orphaned items: ${orphanedItems.length}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
