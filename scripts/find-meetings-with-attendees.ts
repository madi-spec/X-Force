/**
 * Find meetings with attendees for testing
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find meetings with attendees
  const { data: meetings } = await supabase
    .from('activities')
    .select('id, subject, metadata, company_id')
    .eq('type', 'meeting')
    .order('occurred_at', { ascending: false })
    .limit(20);

  console.log('Meetings with attendees:\n');
  for (const m of (meetings || [])) {
    const attendees = m.metadata?.attendees || [];
    if (attendees.length > 0) {
      console.log(`${m.subject}:`);
      console.log(`  ID: ${m.id}`);
      console.log(`  Attendees: ${attendees.join(', ')}`);

      // Check if any has RI
      for (const email of attendees) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('email', email)
          .single();

        if (contact) {
          const { data: ri } = await supabase
            .from('relationship_intelligence')
            .select('id')
            .eq('contact_id', contact.id)
            .limit(1)
            .single();

          if (ri) {
            console.log(`  ** HAS RI: ${contact.name} (${email})`);
          }
        }
      }
      console.log('');
    }
  }
}
main().catch(console.error);
