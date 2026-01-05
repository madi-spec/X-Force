/**
 * Simple test for inbound email analysis
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Finding inbound emails...');

  // Get inbound emails
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, body_text, body_preview')
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log(`Found ${emails?.length || 0} inbound emails`);

  // Find one with actual body content
  for (const email of (emails || [])) {
    const bodyLen = (email.body_text || email.body_preview || '').length;
    console.log(`\n${email.id}`);
    console.log(`  From: ${email.from_name} <${email.from_email}>`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Body length: ${bodyLen} chars`);

    if (bodyLen > 100) {
      console.log('\n\n=== TESTING THIS EMAIL ===\n');

      // Import and run analysis
      const { processInboundEmail } = await import('../src/lib/intelligence/analyzeInboundEmail');
      const { buildRelationshipContext } = await import('../src/lib/intelligence/buildRelationshipContext');

      // Reset analysis
      await supabase
        .from('email_messages')
        .update({ analysis_complete: false, ai_analysis: null })
        .eq('id', email.id);

      // Build context
      console.log('Building relationship context...');
      const context = await buildRelationshipContext({ email: email.from_email });
      console.log('Context:', {
        contact: context.structured.contact?.name,
        company: context.structured.company?.name,
        interactions: context.structured.interactions.length,
      });

      // Run analysis
      console.log('\nRunning analysis...');
      const result = await processInboundEmail(email.id);

      if (result.success && result.analysis) {
        const a = result.analysis;
        console.log('\n=== ANALYSIS RESULTS ===');
        console.log('Summary:', a.summary);
        console.log('Type:', a.request_type);
        console.log('Sentiment:', a.sentiment);
        console.log('Urgency:', a.urgency);
        console.log('\nFull Analysis:', a.full_analysis);
        console.log('\nContext Connections:', a.context_connections);
        console.log('\nCommand Center:', a.command_center_classification);
        console.log('\nDraft Response:', a.response_draft);
      } else {
        console.log('Error:', result.error);
      }

      break;
    }
  }
}

main().catch(console.error);
