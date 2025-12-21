/**
 * Test script for outbound email analysis
 * Run: npx tsx scripts/test-outbound-analysis.ts
 */

// Load dotenv BEFORE any imports that use env vars
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamic imports to ensure env vars are loaded first
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { processOutboundEmail } = await import('../src/lib/intelligence/analyzeOutboundEmail');

  const supabase = createAdminClient();

  console.log('='.repeat(60));
  console.log('OUTBOUND EMAIL ANALYSIS TEST');
  console.log('='.repeat(60));

  // Find 3 sent emails that haven't been analyzed
  // Need emails with actual content (body_preview is always available)
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select(`
      id,
      subject,
      to_emails,
      body_text,
      body_html,
      body_preview,
      sent_at,
      is_sent_by_user,
      analysis_complete
    `)
    .eq('is_sent_by_user', true)
    .eq('analysis_complete', false)
    .not('body_preview', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching emails:', error);
    return;
  }

  if (!emails || emails.length === 0) {
    console.log('No unanalyzed outbound emails found.');

    // Try to find any sent emails
    const { data: anyEmails } = await supabase
      .from('email_messages')
      .select('id, subject, is_sent_by_user, analysis_complete')
      .eq('is_sent_by_user', true)
      .limit(5);

    console.log('\nAll sent emails in DB:');
    console.log(anyEmails);
    return;
  }

  console.log(`Found ${emails.length} outbound emails to analyze\n`);

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`EMAIL ${i + 1} of ${emails.length}`);
    console.log(`${'─'.repeat(60)}`);

    // Show original email (brief)
    console.log('\n📤 ORIGINAL EMAIL:');
    console.log(`   Subject: ${email.subject || '(no subject)'}`);
    console.log(`   To: ${(email.to_emails || []).join(', ')}`);
    console.log(`   Sent: ${email.sent_at}`);
    console.log(`   Preview: ${(email.body_preview || '').substring(0, 150)}...`);

    // Process the email
    console.log('\n🔄 ANALYZING...');
    const result = await processOutboundEmail(email.id);

    if (!result.success) {
      console.log(`   ❌ Error: ${result.error}`);
      continue;
    }

    const analysis = result.analysis!;

    // Show extracted commitments
    console.log('\n📝 ANALYSIS RESULTS:');
    console.log(`   Summary: ${analysis.summary}`);
    console.log(`   Tone: ${analysis.tone}`);

    if (analysis.commitments_made.length > 0) {
      console.log('\n   🤝 COMMITMENTS WE MADE:');
      for (const c of analysis.commitments_made) {
        console.log(`      • ${c.commitment}`);
        if (c.deadline_mentioned) {
          console.log(`        Deadline mentioned: ${c.deadline_mentioned}`);
        }
        if (c.inferred_due_date) {
          console.log(`        Due by: ${c.inferred_due_date}`);
        }
      }
    } else {
      console.log('\n   🤝 No commitments made in this email');
    }

    if (analysis.content_shared.length > 0) {
      console.log('\n   📎 CONTENT SHARED:');
      for (const c of analysis.content_shared) {
        console.log(`      • [${c.type}] ${c.description}`);
      }
    }

    if (analysis.questions_asked.length > 0) {
      console.log('\n   ❓ QUESTIONS ASKED:');
      for (const q of analysis.questions_asked) {
        console.log(`      • ${q}`);
      }
    }

    if (analysis.follow_up_expected.expected) {
      console.log('\n   ⏳ FOLLOW-UP EXPECTED:');
      console.log(`      What: ${analysis.follow_up_expected.what}`);
      if (analysis.follow_up_expected.expected_by) {
        console.log(`      By: ${analysis.follow_up_expected.expected_by}`);
      }
    }

    // Show relationship update
    if (result.relationshipId) {
      console.log(`\n   ✅ Updated relationship: ${result.relationshipId}`);

      // Fetch the relationship to show commitments
      const { data: rel } = await supabase
        .from('relationship_intelligence')
        .select('open_commitments, interactions')
        .eq('id', result.relationshipId)
        .single();

      if (rel) {
        const ourCommitments = rel.open_commitments?.ours || [];
        console.log(`\n   📋 RELATIONSHIP - Our Open Commitments (${ourCommitments.length}):`);
        for (const c of ourCommitments.slice(-3)) { // Show last 3
          console.log(`      • ${c.commitment} (${c.status})`);
          if (c.due_by) console.log(`        Due: ${c.due_by}`);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
