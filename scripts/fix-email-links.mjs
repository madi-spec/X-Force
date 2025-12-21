/**
 * Fix Email Links Script
 *
 * Re-links email conversations that have null contact_id/company_id/deal_id
 * by matching participant emails to contacts and companies.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

const LINK_THRESHOLDS = {
  AUTO_HIGH: 65,
  AUTO_SUGGESTED: 30,
};

async function calculateLinkConfidence(participantEmails, userId) {
  let confidence = 0;
  const reasoning = [];
  let contactId = null;
  let companyId = null;
  let dealId = null;

  // Filter out internal team emails
  const { data: teamMembers } = await supabase
    .from('users')
    .select('email');

  const teamEmails = new Set(
    (teamMembers || []).map(u => u.email?.toLowerCase()).filter(Boolean)
  );

  const externalEmails = participantEmails.filter(email => !teamEmails.has(email.toLowerCase()));

  if (externalEmails.length === 0) {
    return { confidence: 0, contactId: null, companyId: null, dealId: null, method: 'none', reasoning: 'All internal emails' };
  }

  for (const email of externalEmails) {
    const emailLower = email.toLowerCase();

    // 1. Check if email matches a known contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, company_id')
      .ilike('email', emailLower)
      .single();

    if (contact) {
      contactId = contact.id;
      companyId = contact.company_id;
      reasoning.push(`Matched contact: ${contact.name} (${email})`);

      // Check for active deals via company_id (deals are linked to companies)
      if (contact.company_id) {
        const { data: companyDeals } = await supabase
          .from('deals')
          .select('id, name, stage')
          .eq('company_id', contact.company_id)
          .not('stage', 'in', '("closed_won","closed_lost")');

        if (companyDeals && companyDeals.length === 1) {
          confidence += 45;
          dealId = companyDeals[0].id;
          reasoning.push(`Company has one active deal: ${companyDeals[0].name}`);
        } else if (companyDeals && companyDeals.length > 1) {
          confidence += 30;
          reasoning.push(`Company has ${companyDeals.length} deals`);
        } else {
          confidence += 35;
          reasoning.push(`Known contact, no active deals`);
        }
      } else {
        confidence += 35;
        reasoning.push(`Known contact, no company linked`);
      }
      break; // Found a match, stop looking
    }

    // 2. Try domain match
    const domain = emailLower.split('@')[1];
    if (domain && !companyId) {
      // Check by domain field
      let { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('domain', `%${domain}%`)
        .single();

      if (!company) {
        // Check by website field
        const { data: companyByWebsite } = await supabase
          .from('companies')
          .select('id, name')
          .ilike('website', `%${domain}%`)
          .single();
        company = companyByWebsite;
      }

      if (company) {
        companyId = company.id;
        reasoning.push(`Domain matches company: ${company.name}`);

        // Check for active deals for this company
        const { data: companyDeals } = await supabase
          .from('deals')
          .select('id, name, stage')
          .eq('company_id', company.id)
          .not('stage', 'in', '("closed_won","closed_lost")');

        if (companyDeals && companyDeals.length === 1) {
          confidence += 45;
          dealId = companyDeals[0].id;
          reasoning.push(`Company has one active deal: ${companyDeals[0].name}`);
        } else if (companyDeals && companyDeals.length > 1) {
          confidence += 30;
          reasoning.push(`Company has ${companyDeals.length} deals`);
        } else {
          confidence += 35;
        }
      }
    }
  }

  let method = 'none';
  if (confidence >= LINK_THRESHOLDS.AUTO_HIGH) method = 'auto_high';
  else if (confidence >= LINK_THRESHOLDS.AUTO_SUGGESTED) method = 'auto_suggested';

  return {
    confidence,
    contactId,
    companyId,
    dealId: method !== 'none' ? dealId : null,
    method,
    reasoning: reasoning.join('. '),
  };
}

async function fixEmailLinks() {
  console.log('=== Fixing Email Conversation Links ===\n');

  // Get all conversations that need linking (missing contact, company, or deal)
  const { data: unlinkedConversations, error } = await supabase
    .from('email_conversations')
    .select('id, subject, participant_emails, user_id, contact_id, company_id, deal_id')
    .or('contact_id.is.null,company_id.is.null,deal_id.is.null');

  if (error) {
    console.error('Error fetching conversations:', error);
    return;
  }

  console.log(`Found ${unlinkedConversations?.length || 0} conversations to check\n`);

  let updated = 0;
  let skipped = 0;

  for (const conv of unlinkedConversations || []) {
    if (!conv.participant_emails || conv.participant_emails.length === 0) {
      console.log(`  Skipping: ${conv.subject} (no participants)`);
      skipped++;
      continue;
    }

    const linkResult = await calculateLinkConfidence(conv.participant_emails, conv.user_id);

    // Only update if we found something new
    const hasNewContact = linkResult.contactId && !conv.contact_id;
    const hasNewCompany = linkResult.companyId && !conv.company_id;
    const hasNewDeal = linkResult.dealId && !conv.deal_id;

    if (hasNewContact || hasNewCompany || hasNewDeal) {
      const updates = {
        link_confidence: linkResult.confidence,
        link_method: linkResult.method,
        link_reasoning: linkResult.reasoning,
        updated_at: new Date().toISOString(),
      };

      if (hasNewContact) updates.contact_id = linkResult.contactId;
      if (hasNewCompany) updates.company_id = linkResult.companyId;
      if (hasNewDeal) updates.deal_id = linkResult.dealId;

      const { error: updateError } = await supabase
        .from('email_conversations')
        .update(updates)
        .eq('id', conv.id);

      if (updateError) {
        console.log(`  Error updating ${conv.subject}: ${updateError.message}`);
      } else {
        console.log(`  Linked: "${conv.subject}"`);
        console.log(`    Reasoning: ${linkResult.reasoning}`);
        if (hasNewContact) console.log(`    Contact: ${linkResult.contactId}`);
        if (hasNewCompany) console.log(`    Company: ${linkResult.companyId}`);
        if (hasNewDeal) console.log(`    Deal: ${linkResult.dealId}`);
        updated++;
      }
    } else {
      console.log(`  No match found: "${conv.subject}"`);
      console.log(`    Participants: ${conv.participant_emails.slice(0, 3).join(', ')}`);
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  // Show Tommy Kellogg and Charlie Libby specific status
  console.log('\n=== Specific Contacts ===');

  // Check Tommy Kellogg
  const { data: tommyContact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .ilike('email', '%t.kellogg%');

  console.log('\nTommy Kellogg contact search:', tommyContact || 'Not found');

  // Check for Environmental PC company
  const { data: envPCCompany } = await supabase
    .from('companies')
    .select('id, name, domain, website')
    .or('domain.ilike.%environmentalpc%,website.ilike.%environmentalpc%,name.ilike.%environmental%');

  console.log('Environmental PC company search:', envPCCompany || 'Not found');

  // Check Charlie Libby
  const { data: charlieContact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .ilike('email', '%charlie%atlanticpest%');

  console.log('\nCharlie Libby contact search:', charlieContact || 'Not found');

  // Check conversations for these emails
  const { data: tommyConvs } = await supabase
    .from('email_conversations')
    .select('id, subject, contact_id, company_id, deal_id')
    .contains('participant_emails', ['t.kellogg@environmentalpc.com']);

  console.log('\nTommy conversations:', tommyConvs || 'None found');

  const { data: charlieConvs } = await supabase
    .from('email_conversations')
    .select('id, subject, contact_id, company_id, deal_id')
    .contains('participant_emails', ['charlie@atlanticpestnc.com']);

  console.log('Charlie conversations:', charlieConvs || 'None found');
}

fixEmailLinks().catch(console.error);
