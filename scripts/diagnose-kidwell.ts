import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  // Find the CC item
  const { data: ccItem } = await supabase
    .from('command_center_items')
    .select('*')
    .ilike('title', '%Raymond Kidwell%')
    .limit(1)
    .single();

  console.log('=== COMMAND CENTER ITEM ===');
  console.log('Title:', ccItem?.title);
  console.log('Tier:', ccItem?.tier, '- Trigger:', ccItem?.tier_trigger);
  console.log('Company ID:', ccItem?.company_id || 'NONE');
  console.log('Contact ID:', ccItem?.contact_id || 'NONE');
  console.log('Context:', ccItem?.context_brief?.substring(0, 500));

  // Extract email from context
  const emailMatch = ccItem?.context_brief?.match(/From: ([^\n]+)/);
  const fromEmail = emailMatch?.[1]?.trim();
  console.log('\nFrom Email extracted:', fromEmail);

  // Check if contact exists by email
  if (fromEmail) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email, company_id, companies:company_id(name)')
      .ilike('email', fromEmail)
      .maybeSingle();

    console.log('\n=== CONTACT LOOKUP BY EMAIL ===');
    if (contact) {
      console.log('Found:', contact.name);
      console.log('Email:', contact.email);
      console.log('Company ID:', contact.company_id);
      console.log('Company:', (contact.companies as any)?.name || 'NO COMPANY');
    } else {
      console.log('NO CONTACT FOUND for email:', fromEmail);
    }
  }

  // Check by name
  const { data: byName } = await supabase
    .from('contacts')
    .select('id, name, email, company_id, companies:company_id(name)')
    .ilike('name', '%Kidwell%');

  console.log('\n=== CONTACTS NAMED KIDWELL ===');
  if (byName?.length) {
    byName.forEach(c => {
      console.log(`- ${c.name} | ${c.email} | Company: ${(c.companies as any)?.name || 'NONE'}`);
    });
  } else {
    console.log('No contacts named Kidwell found');
  }

  // Search by Raymond
  const { data: byRaymond } = await supabase
    .from('contacts')
    .select('id, name, email, company_id, companies:company_id(name)')
    .ilike('name', '%Raymond%');

  console.log('\n=== CONTACTS NAMED RAYMOND ===');
  if (byRaymond?.length) {
    byRaymond.forEach(c => {
      console.log(`- ${c.name} | ${c.email} | Company: ${(c.companies as any)?.name || 'NONE'}`);
    });
  } else {
    console.log('No contacts named Raymond found');
  }

  // Find the original email
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, body_preview, body_text, received_at, processed_for_cc, analysis_complete, ai_analysis')
    .or('from_email.ilike.%kidwell%,from_name.ilike.%kidwell%')
    .order('received_at', { ascending: false })
    .limit(3);

  console.log('\n=== EMAILS FROM KIDWELL ===');
  if (emails?.length) {
    emails.forEach(e => {
      console.log('ID:', e.id);
      console.log('From:', e.from_name, '<' + e.from_email + '>');
      console.log('Subject:', e.subject);
      console.log('Processed for CC:', e.processed_for_cc);
      console.log('Analysis complete:', e.analysis_complete);
      console.log('Preview:', e.body_preview?.substring(0, 300));
      console.log('Body text:', e.body_text?.substring(0, 500));
      console.log('---');
    });
  } else {
    console.log('No emails from Kidwell found');
  }

  // Check companies that might match
  const domainMatch = fromEmail?.match(/@([^@]+)$/);
  const domain = domainMatch?.[1];
  console.log('\n=== DOMAIN CHECK ===');
  console.log('Email domain:', domain);

  if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
    const { data: companyByDomain } = await supabase
      .from('companies')
      .select('id, name, domain, website')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .limit(5);

    console.log('Companies matching domain:');
    companyByDomain?.forEach(c => {
      console.log(`- ${c.name} | domain: ${c.domain} | website: ${c.website}`);
    });
  }

  // Check the email body for company mentions
  if (emails?.[0]?.body_text) {
    console.log('\n=== LOOKING FOR COMPANY MENTIONS IN BODY ===');
    const body = emails[0].body_text;

    // Look for "On The Fly" or similar
    const patterns = [
      /On The Fly/gi,
      /OnTheFly/gi,
      /pest/gi,
      /company|business|organization/gi
    ];

    patterns.forEach(p => {
      const matches = body.match(p);
      if (matches) {
        console.log(`Found "${p.source}":`, matches.length, 'times');
      }
    });
  }
}

diagnose().catch(console.error);
