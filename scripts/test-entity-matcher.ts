/**
 * Test AI-Powered Entity Matching
 *
 * Tests the new entity matcher against real emails from the database.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import {
  extractRawIdentifiers,
  findCandidateCompanies,
  findCandidateContacts,
  intelligentEntityMatch,
  CommunicationInput,
} from '../src/lib/intelligence/entityMatcher';

async function testWithRealEmails() {
  console.log('='.repeat(80));
  console.log('AI-POWERED ENTITY MATCHING TEST');
  console.log('='.repeat(80));
  console.log();

  const supabase = createAdminClient();

  // Get a user with auth_id
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) {
    console.log('No user with auth_id found!');
    return;
  }

  // Get some analyzed emails to test
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, body_text, received_at')
    .eq('analysis_complete', true)
    .order('received_at', { ascending: false })
    .limit(5);

  if (!emails || emails.length === 0) {
    console.log('No analyzed emails found!');
    return;
  }

  console.log(`Testing with ${emails.length} emails...\n`);

  for (const email of emails) {
    console.log('─'.repeat(80));
    console.log(`EMAIL: ${email.subject}`);
    console.log(`FROM: ${email.from_name} <${email.from_email}>`);
    console.log(`DATE: ${email.received_at}`);
    console.log();

    // Create communication input
    const communication: CommunicationInput = {
      type: 'email_inbound',
      from_email: email.from_email,
      from_name: email.from_name || undefined,
      subject: email.subject,
      body: email.body_text?.substring(0, 2000) || '',
    };

    // Step 1: Extract raw identifiers
    console.log('STEP 1: Extracting raw identifiers...');
    const rawIdentifiers = extractRawIdentifiers(communication);
    console.log('  Emails:', rawIdentifiers.emails);
    console.log('  Names:', rawIdentifiers.names_mentioned);
    console.log('  Companies:', rawIdentifiers.company_mentions);
    console.log('  Domain:', rawIdentifiers.domain);
    console.log();

    // Step 2: Find candidates
    console.log('STEP 2: Finding candidate matches...');
    const candidateCompanies = await findCandidateCompanies({
      domains: [rawIdentifiers.domain],
      nameFragments: rawIdentifiers.company_mentions.map(n => n.split(' ')[0]),
      emailDomains: rawIdentifiers.emails.map(e => e.split('@')[1]).filter(Boolean),
    });
    console.log(`  Found ${candidateCompanies.length} candidate companies:`);
    candidateCompanies.forEach(c => console.log(`    - ${c.name} (${c.domain || 'no domain'})`));

    const candidateContacts = await findCandidateContacts({
      emails: rawIdentifiers.emails,
      phones: rawIdentifiers.phones,
      nameFragments: rawIdentifiers.names_mentioned,
      companyIds: candidateCompanies.map(c => c.id),
    });
    console.log(`  Found ${candidateContacts.length} candidate contacts:`);
    candidateContacts.forEach(c => console.log(`    - ${c.name} <${c.email}> @ ${c.company_name || 'no company'}`));
    console.log();

    // Step 3: Full intelligent match (includes AI call)
    console.log('STEP 3: Running AI-powered matching...');
    const startTime = Date.now();
    const result = await intelligentEntityMatch(communication, user.id);
    const elapsed = Date.now() - startTime;

    console.log();
    console.log('RESULT:');
    console.log(`  Company: ${result.company?.name || 'NONE'} ${result.was_created.company ? '(CREATED)' : ''}`);
    console.log(`  Contact: ${result.contact?.name || 'NONE'} ${result.was_created.contact ? '(CREATED)' : ''}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`  Reasoning: ${result.reasoning}`);
    console.log(`  Time: ${elapsed}ms`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Test with a specific scenario
async function testSpecificScenario() {
  console.log('\n' + '='.repeat(80));
  console.log('SPECIFIC SCENARIO TEST: Trial Form Email');
  console.log('='.repeat(80));
  console.log();

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .not('auth_id', 'is', null)
    .limit(1)
    .single();

  if (!user) return;

  // Simulate a trial form email
  const communication: CommunicationInput = {
    type: 'email_inbound',
    from_email: 'acanniff@lawndoctorma.com',
    from_name: 'Andrew Canniff',
    subject: 'X-RAI Trial Authorization Form - Lawn Doctor of Hanover',
    body: [
      'Trial Authorization Form Submission',
      '',
      'Company: Lawn Doctor of Hanover',
      'Contact: Andrew Canniff',
      'Title: VP/GM',
      'Email: acanniff@lawndoctorma.com',
      'Phone: 781-831-2165',
      '',
      'Team Size: 16 agents',
      'Location: Hanover, MA',
      'Type: Franchisee',
      '',
      'I authorize X-RAI to process our call recordings for the trial period.',
      '',
      'Best regards,',
      'Andy Canniff',
      'VP/GM',
      'Lawn Doctor of Hanover',
    ].join('\n'),
  };

  console.log('Testing with trial form email...');
  console.log(`FROM: ${communication.from_name} <${communication.from_email}>`);
  console.log(`SUBJECT: ${communication.subject}`);
  console.log();

  const result = await intelligentEntityMatch(communication, user.id);

  console.log('RESULT:');
  console.log(`  Company: ${result.company?.name || 'NONE'} (${result.company?.id || 'no id'})`);
  console.log(`  Contact: ${result.contact?.name || 'NONE'} (${result.contact?.id || 'no id'})`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`  Created: company=${result.was_created.company}, contact=${result.was_created.contact}`);
  console.log(`  Reasoning: ${result.reasoning}`);
}

async function main() {
  await testWithRealEmails();
  await testSpecificScenario();
}

main().catch(console.error);
