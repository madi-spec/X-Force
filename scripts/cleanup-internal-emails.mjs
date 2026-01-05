import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupInternalEmails() {
  console.log('=== Cleaning Up Internal Team Email Items ===\n');

  // Get all team members with emails and names
  const { data: teamMembers } = await supabase
    .from('users')
    .select('email, name');

  const teamEmails = new Set(
    (teamMembers || []).map(u => u.email?.toLowerCase()).filter(Boolean)
  );

  // Get team member names (normalized for matching)
  const teamNames = new Set(
    (teamMembers || []).map(u => u.name?.toLowerCase().trim()).filter(Boolean)
  );

  // Get internal domains from team emails
  const internalDomains = new Set();
  for (const email of teamEmails) {
    const domain = email.split('@')[1];
    if (domain) {
      internalDomains.add(domain);
    }
  }

  console.log('Team names:', [...teamNames]);
  console.log('Internal domains:', [...internalDomains]);

  // Find command center items from email sync
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, target_name, source')
    .eq('source', 'email_sync')
    .eq('status', 'pending');

  console.log(`\nFound ${items?.length || 0} email-sourced items`);

  let deleted = 0;
  for (const item of items || []) {
    const targetName = (item.target_name || '').toLowerCase().trim();

    // Check if target_name matches a team member name
    if (teamNames.has(targetName)) {
      const { error } = await supabase
        .from('command_center_items')
        .delete()
        .eq('id', item.id);

      if (!error) {
        console.log(`  Deleted: "${item.title}" (matched name: ${targetName})`);
        deleted++;
      }
      continue;
    }

    // Check if target_name contains an internal domain (email address)
    if (targetName.includes('@')) {
      const domain = targetName.split('@')[1];
      if (internalDomains.has(domain)) {
        const { error } = await supabase
          .from('command_center_items')
          .delete()
          .eq('id', item.id);

        if (!error) {
          console.log(`  Deleted: "${item.title}" (internal domain)`);
          deleted++;
        }
        continue;
      }
    }

    // Check partial name match (e.g., "Alyssa S. Scott" vs "Alyssa Scott")
    for (const teamName of teamNames) {
      const teamParts = teamName.split(' ').filter(p => p.length > 1);
      const targetParts = targetName.split(' ').filter(p => p.length > 1);

      // Check if first and last name match
      if (teamParts.length >= 2 && targetParts.length >= 2) {
        const teamFirst = teamParts[0];
        const teamLast = teamParts[teamParts.length - 1];
        const targetFirst = targetParts[0];
        const targetLast = targetParts[targetParts.length - 1];

        if (teamFirst === targetFirst && teamLast === targetLast) {
          const { error } = await supabase
            .from('command_center_items')
            .delete()
            .eq('id', item.id);

          if (!error) {
            console.log(`  Deleted: "${item.title}" (partial match: ${teamName})`);
            deleted++;
          }
          break;
        }
      }
    }
  }

  console.log(`\n=== Deleted ${deleted} internal email items ===`);

  // Show remaining items
  const { data: remaining } = await supabase
    .from('command_center_items')
    .select('title')
    .eq('source', 'email_sync')
    .eq('status', 'pending')
    .limit(10);

  if (remaining?.length) {
    console.log('\nRemaining email items:');
    remaining.forEach(r => console.log(`  - ${r.title}`));
  }
}

cleanupInternalEmails().catch(console.error);
