/**
 * Test Email Context Enrichment
 *
 * Run with: npx tsx scripts/test-email-enrichment.ts <email_id>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// INLINE IMPLEMENTATION (for testing without build)
// ============================================

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'live.com', 'msn.com', 'mail.com',
  'protonmail.com', 'zoho.com', 'ymail.com', 'comcast.net',
  'att.net', 'verizon.net', 'sbcglobal.net', 'cox.net', 'charter.net',
]);

const INTERNAL_DOMAINS = new Set([
  'xrailabsteam.com', 'xrailabs.com', 'affiliatedtech.com', 'x-rai.com',
]);

function extractDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

function isPersonalEmail(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

function isInternalEmail(domain: string): boolean {
  return INTERNAL_DOMAINS.has(domain.toLowerCase());
}

function domainToCompanyName(domain: string): string {
  return domain
    .replace(/\.(com|net|org|io|co|biz|us|info)$/, '')
    .split(/[-_.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calculateDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

interface MeetingAnalysis {
  keyPoints?: Array<{ topic: string }>;
  ourCommitments?: Array<{ commitment: string }>;
  theirCommitments?: Array<{ commitment: string }>;
  sentiment?: { overall: string };
  buyingSignals?: Array<{ signal: string }>;
}

async function enrichEmailContext(emailId: string) {
  console.log('='.repeat(60));
  console.log('EMAIL CONTEXT ENRICHMENT TEST');
  console.log('='.repeat(60));

  // 1. Get the email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select(`
      id, user_id, conversation_ref, message_id,
      subject, from_email, from_name,
      body_text, body_preview, body_html,
      received_at, is_sent_by_user
    `)
    .eq('id', emailId)
    .single();

  if (emailError || !email) {
    console.error('Email not found:', emailError?.message);
    return;
  }

  console.log('\n📧 EMAIL:');
  console.log(`  From: ${email.from_name} <${email.from_email}>`);
  console.log(`  Subject: ${email.subject}`);
  console.log(`  Preview: ${email.body_preview?.substring(0, 100)}...`);

  const domain = extractDomain(email.from_email);
  const emailLower = email.from_email.toLowerCase();

  console.log(`\n📍 Domain: ${domain}`);
  console.log(`  Is Personal: ${isPersonalEmail(domain)}`);
  console.log(`  Is Internal: ${isInternalEmail(domain)}`);

  // 2. Find or create contact
  console.log('\n👤 CONTACT:');
  let contact: { id: string; name: string | null; email: string; title: string | null; company_id: string | null; created_new: boolean } | null = null;

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, name, email, title, company_id')
    .ilike('email', emailLower)
    .single();

  if (existingContact) {
    contact = { ...existingContact, email: existingContact.email || emailLower, created_new: false };
    console.log(`  Found: ${contact.name} (${contact.id})`);
    console.log(`  Title: ${contact.title || 'Unknown'}`);
    console.log(`  Company ID: ${contact.company_id || 'None'}`);
  } else if (!isInternalEmail(domain)) {
    console.log('  No existing contact - will create after company');
  } else {
    console.log('  Skipped (internal email)');
  }

  // 3. Find company
  console.log('\n🏢 COMPANY:');
  let company: { id: string; name: string; industry: string | null } | null = null;

  if (!isPersonalEmail(domain) && !isInternalEmail(domain)) {
    if (contact?.company_id) {
      const { data: linkedCompany } = await supabase
        .from('companies')
        .select('id, name, industry')
        .eq('id', contact.company_id)
        .single();

      if (linkedCompany) {
        company = linkedCompany;
        console.log(`  From contact: ${company.name} (${company.id})`);
      }
    }

    if (!company) {
      const { data: domainCompany } = await supabase
        .from('companies')
        .select('id, name, industry')
        .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
        .single();

      if (domainCompany) {
        company = domainCompany;
        console.log(`  From domain: ${company.name} (${company.id})`);

        // Link contact to company
        if (contact?.created_new) {
          await supabase.from('contacts').update({ company_id: company.id }).eq('id', contact.id);
          contact.company_id = company.id;
          console.log('  Linked contact to company');
        }
      } else {
        // Create placeholder company with required fields
        const newName = domainToCompanyName(domain);
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: newName,
            domain: domain,
            status: 'prospect',
            segment: 'smb',  // Required field
            industry: 'pest', // Default industry
          })
          .select('id, name, industry')
          .single();

        if (companyError) {
          console.log(`  ERROR creating company: ${companyError.message}`);
        } else if (newCompany) {
          company = newCompany;
          console.log(`  Created NEW: ${company.name} (${company.id})`);
        }
      }
    }

    // Now create contact if we don't have one and we have a company
    if (!contact && company && !isInternalEmail(domain)) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          email: emailLower,
          name: email.from_name || emailLower.split('@')[0],
          company_id: company.id, // Required field
        })
        .select('id, name, email, title, company_id')
        .single();

      if (contactError) {
        console.log(`  ERROR creating contact: ${contactError.message}`);
      } else if (newContact) {
        contact = { ...newContact, email: newContact.email || emailLower, created_new: true };
        console.log(`\n👤 CONTACT (created after company):`);
        console.log(`  Created NEW: ${contact.name} (${contact.id})`);
        console.log(`  Company ID: ${contact.company_id}`);
      }
    }
  } else {
    console.log('  Skipped (personal/internal email)');
  }

  // 4. Find active deal
  console.log('\n💰 DEAL:');
  let deal: { id: string; name: string; stage: string; estimated_value: number | null } | null = null;

  const companyId = contact?.company_id || company?.id;
  if (companyId) {
    const { data: activeDeal } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value')
      .eq('company_id', companyId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeDeal) {
      deal = activeDeal;
      console.log(`  Found: ${deal.name}`);
      console.log(`  Stage: ${deal.stage}`);
      console.log(`  Value: $${deal.estimated_value?.toLocaleString() || 'Unknown'}`);
    } else {
      console.log('  No active deal found');
    }
  } else {
    console.log('  Skipped (no company)');
  }

  // 5. Get interaction history
  console.log('\n📜 INTERACTION HISTORY:');
  const history: Array<{ type: string; date: string; summary: string }> = [];

  const entityFilters: string[] = [];
  if (contact?.id) entityFilters.push(`contact_id.eq.${contact.id}`);
  if (company?.id) entityFilters.push(`company_id.eq.${company.id}`);
  if (deal?.id) entityFilters.push(`deal_id.eq.${deal.id}`);

  if (entityFilters.length > 0) {
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, subject, description, occurred_at')
      .or(entityFilters.join(','))
      .order('occurred_at', { ascending: false })
      .limit(10);

    if (activities) {
      for (const a of activities) {
        history.push({
          type: a.type,
          date: a.occurred_at,
          summary: a.subject || a.description || '',
        });
      }
    }
  }

  if (history.length > 0) {
    for (const h of history.slice(0, 5)) {
      const daysAgo = calculateDaysSince(h.date);
      console.log(`  [${h.type}] ${daysAgo}d ago - ${h.summary.substring(0, 60)}...`);
    }
    if (history.length > 5) console.log(`  ... and ${history.length - 5} more`);
  } else {
    console.log('  No prior interactions');
  }

  // 6. Get thread context
  console.log('\n📨 THREAD CONTEXT:');
  const { data: thread } = await supabase
    .from('email_messages')
    .select('id, is_sent_by_user, received_at, from_name, body_preview')
    .eq('conversation_ref', email.conversation_ref)
    .neq('id', email.id)
    .order('received_at', { ascending: false })
    .limit(5);

  if (thread && thread.length > 0) {
    for (const msg of thread) {
      const dir = msg.is_sent_by_user ? 'SENT' : 'RECV';
      const daysAgo = calculateDaysSince(msg.received_at);
      console.log(`  [${dir}] ${daysAgo}d ago - ${msg.body_preview?.substring(0, 50)}...`);
    }
  } else {
    console.log('  New thread (no prior messages)');
  }

  // 7. Get recent meetings
  console.log('\n📅 RECENT MEETINGS (30 days):');
  const meetingFilters: string[] = [];
  if (contact?.id) meetingFilters.push(`contact_id.eq.${contact.id}`);
  if (company?.id) meetingFilters.push(`company_id.eq.${company.id}`);
  if (deal?.id) meetingFilters.push(`deal_id.eq.${deal.id}`);

  if (meetingFilters.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: meetings } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date, summary, analysis')
      .or(meetingFilters.join(','))
      .gte('meeting_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (meetings && meetings.length > 0) {
      for (const m of meetings) {
        const analysis = m.analysis as MeetingAnalysis | null;
        console.log(`  ${m.title} (${m.meeting_date})`);
        console.log(`    Summary: ${m.summary?.substring(0, 80) || 'N/A'}...`);
        if (analysis?.buyingSignals?.length) {
          console.log(`    Buying Signals: ${analysis.buyingSignals.map(s => s.signal).join(', ')}`);
        }
      }
    } else {
      console.log('  No recent meetings');
    }
  } else {
    console.log('  Skipped (no entities)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Contact: ${contact?.name || 'None'} ${contact?.created_new ? '(NEW)' : ''}`);
  console.log(`  Company: ${company?.name || 'None'}`);
  console.log(`  Deal: ${deal?.name || 'None'} ${deal ? `(${deal.stage})` : ''}`);
  console.log(`  Interactions: ${history.length}`);
  console.log(`  Thread messages: ${thread?.length || 0}`);

  const relationshipStage = !contact && history.length === 0 ? 'new_contact'
    : !deal && history.length > 0 ? 'known_contact'
    : deal?.stage === 'closed_won' ? 'customer'
    : deal?.stage === 'closed_lost' ? 'lost_opportunity'
    : deal ? 'active_prospect'
    : 'unknown';

  console.log(`  Relationship Stage: ${relationshipStage}`);
}

// Run with email ID from command line
const emailId = process.argv[2] || 'cc823e12-b5ce-41d0-a2d2-114671bf1690';
enrichEmailContext(emailId).catch(console.error);
