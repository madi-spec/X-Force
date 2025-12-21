import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { processOutboundEmail } = await import('../src/lib/intelligence/analyzeOutboundEmail');

  const supabase = createAdminClient();

  // Test with these specific rich emails
  const emailIds = [
    '85e78227-e365-4c2c-ad44-6fa4c7a8d705', // X-Rai AI Platform Trial & Proposal - Frame's Pest Control
    '6a64484c-28cf-4702-9062-eb3d8c97204d', // X-Rai Trial & AI Agent Proposal for Native Pest
    '184668ab-ce39-44c4-af81-48409a8b2d6d', // Next Steps: PestPac Demo & Pricing for Entomo Brands
  ];

  console.log('='.repeat(60));
  console.log('TESTING SPECIFIC EMAILS WITH RICH CONTENT');
  console.log('='.repeat(60));

  for (let i = 0; i < emailIds.length; i++) {
    const emailId = emailIds[i];

    // Get email details
    const { data: email } = await supabase
      .from('email_messages')
      .select('id, subject, to_emails, body_preview, body_html, sent_at')
      .eq('id', emailId)
      .single();

    if (!email) {
      console.log(`Email ${emailId} not found`);
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`EMAIL ${i + 1} of ${emailIds.length}`);
    console.log(`${'─'.repeat(60)}`);

    console.log('\n📤 ORIGINAL EMAIL:');
    console.log(`   Subject: ${email.subject}`);
    console.log(`   To: ${(email.to_emails || []).join(', ')}`);
    console.log(`   Sent: ${email.sent_at}`);
    console.log(`   Preview: ${(email.body_preview || '').substring(0, 200)}...`);

    console.log('\n🔄 ANALYZING...');
    const result = await processOutboundEmail(emailId);

    if (!result.success) {
      console.log(`   ❌ Error: ${result.error}`);
      continue;
    }

    const analysis = result.analysis!;

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
        .select('open_commitments, interactions, contact_id, company_id')
        .eq('id', result.relationshipId)
        .single();

      if (rel) {
        const ourCommitments = (rel.open_commitments as any)?.ours || [];
        console.log(`\n   📋 RELATIONSHIP - Our Open Commitments (${ourCommitments.length}):`);
        for (const c of ourCommitments.slice(-5)) {
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
