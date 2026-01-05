/**
 * Deduplicate Command Center Items
 *
 * This script identifies and removes duplicate command center items.
 * Duplicates are detected by:
 * 1. Same source (email/meeting) - same conversation_id, meeting_id, or email_id
 * 2. Similar titles for the same contact/company
 *
 * Run with: npx tsx scripts/dedupe-command-center.ts
 * Dry run:  npx tsx scripts/dedupe-command-center.ts --dry-run
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

interface CommandCenterItem {
  id: string;
  title: string;
  user_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  conversation_id: string | null;
  meeting_id: string | null;
  email_id: string | null;
  source_hash: string | null;
  tier: number;
  status: string;
  source: string | null;
  created_at: string;
  workflow_steps: unknown[] | null;
}

interface DuplicateGroup {
  key: string;
  items: CommandCenterItem[];
  keep: CommandCenterItem;
  remove: CommandCenterItem[];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  console.log('='.repeat(80));
  console.log('COMMAND CENTER DEDUPLICATION SCRIPT');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}`);
  console.log('');

  const supabase = createAdminClient();

  // Get all pending/in_progress items
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log(`Found ${items?.length || 0} open command center items\n`);

  if (!items || items.length === 0) {
    console.log('No items to deduplicate.');
    return;
  }

  // Find duplicates based on different strategies
  const duplicateGroups: DuplicateGroup[] = [];

  // Strategy 1: Same source_hash (exact same source)
  const bySourceHash = groupBy(items.filter(i => i.source_hash), 'source_hash');
  for (const [hash, groupItems] of Object.entries(bySourceHash)) {
    if (groupItems.length > 1) {
      duplicateGroups.push(createDuplicateGroup(`source_hash:${hash}`, groupItems));
    }
  }

  // Strategy 2: Same conversation_id
  const byConversation = groupBy(items.filter(i => i.conversation_id), 'conversation_id');
  for (const [convId, groupItems] of Object.entries(byConversation)) {
    if (groupItems.length > 1) {
      // Check if already captured by source_hash
      const uncaptured = groupItems.filter(i =>
        !duplicateGroups.some(g => g.items.some(gi => gi.id === i.id))
      );
      if (uncaptured.length > 1) {
        duplicateGroups.push(createDuplicateGroup(`conversation:${convId}`, uncaptured));
      }
    }
  }

  // Strategy 3: Same email_id
  const byEmailId = groupBy(items.filter(i => i.email_id), 'email_id');
  for (const [emailId, groupItems] of Object.entries(byEmailId)) {
    if (groupItems.length > 1) {
      const uncaptured = groupItems.filter(i =>
        !duplicateGroups.some(g => g.items.some(gi => gi.id === i.id))
      );
      if (uncaptured.length > 1) {
        duplicateGroups.push(createDuplicateGroup(`email:${emailId}`, uncaptured));
      }
    }
  }

  // Strategy 4: Similar titles for same contact (fuzzy match)
  const byContactTitle = new Map<string, CommandCenterItem[]>();
  for (const item of items) {
    if (!item.contact_id) continue;
    const normalizedTitle = normalizeTitle(item.title);
    const key = `${item.contact_id}:${normalizedTitle}`;

    const existing = byContactTitle.get(key) || [];
    existing.push(item);
    byContactTitle.set(key, existing);
  }

  for (const [key, groupItems] of byContactTitle) {
    if (groupItems.length > 1) {
      const uncaptured = groupItems.filter(i =>
        !duplicateGroups.some(g => g.items.some(gi => gi.id === i.id))
      );
      if (uncaptured.length > 1) {
        duplicateGroups.push(createDuplicateGroup(`similar:${key}`, uncaptured));
      }
    }
  }

  // Report findings
  console.log(`Found ${duplicateGroups.length} duplicate groups\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found!');
    return;
  }

  let totalRemoved = 0;

  for (const group of duplicateGroups) {
    console.log('-'.repeat(60));
    console.log(`Duplicate group: ${group.key}`);
    console.log(`  Keep: [${group.keep.id.substring(0, 8)}] "${group.keep.title.substring(0, 50)}"`);
    console.log(`    - Tier ${group.keep.tier}, Source: ${group.keep.source}`);
    console.log(`    - Has workflow_steps: ${Array.isArray(group.keep.workflow_steps) && group.keep.workflow_steps.length > 0}`);
    console.log(`    - Created: ${group.keep.created_at}`);

    for (const item of group.remove) {
      console.log(`  Remove: [${item.id.substring(0, 8)}] "${item.title.substring(0, 50)}"`);
      if (verbose) {
        console.log(`    - Tier ${item.tier}, Source: ${item.source}`);
        console.log(`    - Created: ${item.created_at}`);
      }
    }

    if (!dryRun) {
      // Mark duplicates as completed (dismissed)
      for (const item of group.remove) {
        const { error: updateError } = await supabase
          .from('command_center_items')
          .update({
            status: 'dismissed',
            dismissed_at: new Date().toISOString(),
            dismissed_reason: `Deduplicated: merged with ${group.keep.id}`,
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`  Error removing ${item.id}:`, updateError);
        } else {
          totalRemoved++;
        }
      }
    } else {
      totalRemoved += group.remove.length;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`Items to ${dryRun ? 'remove (dry run)' : 'removed'}: ${totalRemoved}`);

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

/**
 * Group items by a field value
 */
function groupBy<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = String(item[field]);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  return groups;
}

/**
 * Normalize title for fuzzy matching
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\d+\s*(agents?|users?|licenses?)/gi, 'N units') // Normalize counts
    .trim();
}

/**
 * Create a duplicate group, selecting the best item to keep
 */
function createDuplicateGroup(key: string, items: CommandCenterItem[]): DuplicateGroup {
  // Sort by priority: workflow_steps > has links > higher tier > older
  const sorted = [...items].sort((a, b) => {
    // Prefer items with workflow_steps
    const aHasSteps = Array.isArray(a.workflow_steps) && a.workflow_steps.length > 0;
    const bHasSteps = Array.isArray(b.workflow_steps) && b.workflow_steps.length > 0;
    if (aHasSteps && !bHasSteps) return -1;
    if (bHasSteps && !aHasSteps) return 1;

    // Prefer items with entity links
    const aLinks = (a.contact_id ? 1 : 0) + (a.company_id ? 1 : 0) + (a.deal_id ? 1 : 0);
    const bLinks = (b.contact_id ? 1 : 0) + (b.company_id ? 1 : 0) + (b.deal_id ? 1 : 0);
    if (aLinks !== bLinks) return bLinks - aLinks;

    // Prefer higher priority (lower tier number)
    if (a.tier !== b.tier) return a.tier - b.tier;

    // Prefer older item (first created)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return {
    key,
    items,
    keep: sorted[0],
    remove: sorted.slice(1),
  };
}

main().catch(console.error);
