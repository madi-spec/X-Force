import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('=== PHASE 1: FIND HAPPINEST DATA ===\n');

  // Find company
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%happinest%');

  if (!companies || companies.length === 0) {
    console.log('No Happinest company found!');
    return;
  }

  console.log('Companies found:');
  companies.forEach(c => console.log(`  ${c.id}: ${c.name} (${c.domain})`));

  const companyId = companies[0].id;
  console.log(`\nUsing company ID: ${companyId}\n`);

  // Count data types
  console.log('Data counts:');

  const { count: emailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  console.log(`  Emails: ${emailCount || 0}`);

  const { count: transcriptCount } = await supabase
    .from('meeting_transcriptions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  console.log(`  Transcripts: ${transcriptCount || 0}`);

  const { count: riCount } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  console.log(`  RI Records: ${riCount || 0}`);

  const { count: ccCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  console.log(`  CC Items: ${ccCount || 0}`);

  // Check contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email')
    .eq('company_id', companyId);
  console.log(`  Contacts: ${contacts?.length || 0}`);
  contacts?.forEach(c => console.log(`    - ${c.name} <${c.email}>`));

  // Check deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage')
    .eq('company_id', companyId);
  console.log(`  Deals: ${deals?.length || 0}`);
  deals?.forEach(d => console.log(`    - ${d.name} (${d.stage})`));

  console.log('\n=== PHASE 2: CHECK RI CONTENT ===\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId);

  if (!riRecords || riRecords.length === 0) {
    console.log('NO RI RECORDS EXIST - This is the gap!');
  } else {
    riRecords.forEach(ri => {
      console.log(`RI Record ID: ${ri.id}`);
      console.log(`  Contact ID: ${ri.contact_id}`);
      console.log(`  Context: ${JSON.stringify(ri.context)?.substring(0, 200)}...`);
      console.log(`  Interactions: ${ri.interactions?.length || 0}`);
      console.log(`  Open Commitments: ${JSON.stringify(ri.open_commitments)?.substring(0, 100)}...`);
      console.log(`  Signals: ${JSON.stringify(ri.signals)?.substring(0, 100)}...`);
      console.log(`  Summary: ${ri.relationship_summary?.substring(0, 100) || 'EMPTY'}...`);
    });
  }

  console.log('\n=== PHASE 3: CHECK EMAIL CONVERSATIONS ===\n');

  // Check email conversations linked to company
  const { data: conversations } = await supabase
    .from('email_conversations')
    .select('id, subject, status, last_activity_at, direction')
    .eq('company_id', companyId)
    .order('last_activity_at', { ascending: false })
    .limit(5);

  console.log(`Email conversations linked to Happinest: ${conversations?.length || 0}`);
  conversations?.forEach(c => {
    console.log(`  - ${c.subject} (${c.status}, ${c.direction})`);
  });

  // Check if emails exist but aren't linked
  if (contacts && contacts.length > 0) {
    const contactEmails = contacts.map(c => c.email).filter(Boolean);
    console.log(`\nChecking emails from contact addresses: ${contactEmails.join(', ')}`);

    const { data: unlinkedEmails } = await supabase
      .from('email_messages')
      .select('id, from_email, subject, company_id')
      .in('from_email', contactEmails)
      .limit(10);

    console.log(`\nEmails from Happinest contacts: ${unlinkedEmails?.length || 0}`);
    unlinkedEmails?.forEach(e => {
      console.log(`  - ${e.from_email}: "${e.subject}" (company_id: ${e.company_id || 'NULL'})`);
    });
  }

  console.log('\n=== PHASE 4: CHECK TRANSCRIPTS ===\n');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, analysis')
    .eq('company_id', companyId)
    .limit(5);

  console.log(`Transcripts for Happinest: ${transcripts?.length || 0}`);
  transcripts?.forEach(t => {
    const analysis = t.analysis as any;
    console.log(`  - ${t.title}`);
    console.log(`    Has analysis: ${!!analysis}`);
    if (analysis) {
      console.log(`    Key points: ${analysis.keyPoints?.length || 0}`);
      console.log(`    Our commitments: ${analysis.ourCommitments?.length || 0}`);
    }
  });

  console.log('\n=== DIAGNOSIS SUMMARY ===\n');

  if (riCount === 0 && (emailCount! > 0 || transcriptCount! > 0)) {
    console.log('PROBLEM: Data exists but RI records are missing!');
    console.log('The pipeline is NOT updating relationship_intelligence.');
    console.log('\nGAP LOCATION: Check if updateRelationshipIntelligence is being called.');
  } else if (riCount! > 0) {
    console.log('RI records exist. Check if they are being populated correctly.');
  } else {
    console.log('No data exists for Happinest yet.');
  }
}

diagnose().catch(console.error);
