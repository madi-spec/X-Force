import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  // Find the Tier 1 triage item specifically
  console.log('=== TIER 1 TRIAGE ITEM ===');
  const { data: triageItem } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('tier_trigger', 'unknown_sender')
    .ilike('title', '%Raymond%')
    .maybeSingle();

  if (triageItem) {
    console.log('ID:', triageItem.id);
    console.log('Title:', triageItem.title);
    console.log('Context:', triageItem.context_brief);
    console.log('Company ID:', triageItem.company_id || 'NONE');
    console.log('Email ID:', triageItem.email_id || 'NONE');
    console.log('Source ID:', triageItem.source_id || 'NONE');
    console.log('Conversation ID:', triageItem.conversation_id);
  } else {
    console.log('No triage item found - checking all unknown_sender items:');
    const { data: allTriage } = await supabase
      .from('command_center_items')
      .select('id, title, tier_trigger')
      .eq('tier_trigger', 'unknown_sender');
    allTriage?.forEach(t => console.log('-', t.title));
  }

  // Check companies
  console.log('\n=== COMPANY SEARCH ===');

  // Search by voiceforpest
  const { data: c1 } = await supabase
    .from('companies')
    .select('id, name, domain, website')
    .or('domain.ilike.%voiceforpest%,website.ilike.%voiceforpest%,name.ilike.%voice%pest%');
  console.log('voiceforpest matches:', c1?.length ? c1.map(c => `${c.name} (${c.domain})`).join(', ') : 'NONE');

  // Search by On The Fly
  const { data: c2 } = await supabase
    .from('companies')
    .select('id, name, domain, website')
    .ilike('name', '%on the fly%');
  console.log('On The Fly matches:', c2?.length ? c2.map(c => `${c.name} (${c.domain})`).join(', ') : 'NONE');

  // Search by fly
  const { data: c3 } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%fly%');
  console.log('*fly* matches:', c3?.length ? c3.map(c => c.name).join(', ') : 'NONE');

  // Get the email to see full details
  console.log('\n=== EMAIL DETAILS ===');
  const { data: email } = await supabase
    .from('email_messages')
    .select('*')
    .eq('from_email', 'rkidwell@voiceforpest.com')
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  if (email) {
    console.log('Email ID:', email.id);
    console.log('From:', email.from_name, '<' + email.from_email + '>');
    console.log('Subject:', email.subject);
    console.log('Has body_text:', !!email.body_text, email.body_text ? `(${email.body_text.length} chars)` : '');
    console.log('Has body_html:', !!email.body_html, email.body_html ? `(${email.body_html.length} chars)` : '');
    console.log('Body preview:', email.body_preview?.substring(0, 200));
    console.log('Conversation ref:', email.conversation_ref);
    console.log('Processed for CC:', email.processed_for_cc);
    console.log('Analysis complete:', email.analysis_complete);

    if (email.ai_analysis) {
      console.log('\nAI Analysis command_center_classification:');
      console.log(JSON.stringify(email.ai_analysis.command_center_classification, null, 2));
    }
  } else {
    console.log('No email found from rkidwell@voiceforpest.com');
  }

  // Also check conversation items
  if (email?.conversation_ref) {
    console.log('\n=== CC ITEMS FOR THIS CONVERSATION ===');
    const { data: convItems } = await supabase
      .from('command_center_items')
      .select('id, title, tier, tier_trigger, company_id, contact_id')
      .eq('conversation_id', email.conversation_ref);

    convItems?.forEach(item => {
      console.log(`- [T${item.tier}] ${item.title}`);
      console.log(`  Trigger: ${item.tier_trigger}, Company: ${item.company_id || 'NONE'}`);
    });
  }
}

diagnose().catch(console.error);
