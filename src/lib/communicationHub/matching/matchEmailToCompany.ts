/**
 * Email to Company Matching
 *
 * Matches email addresses to companies and contacts using multiple strategies:
 * 1. Direct contact email match
 * 2. Company domain match
 * 3. Contact with same email domain match
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface MatchResult {
  company_id: string | null;
  contact_id: string | null;
  matched_by: 'contact_email' | 'company_domain' | 'contact_domain' | null;
}

/**
 * Match an email address to a company and contact
 */
export async function matchEmailToCompany(email: string): Promise<MatchResult> {
  if (!email) {
    return { company_id: null, contact_id: null, matched_by: null };
  }

  const supabase = createAdminClient();
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];

  // Strategy 1: Direct contact email match
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id, email')
    .ilike('email', emailLower)
    .single();

  if (contact?.company_id) {
    console.log(`[EmailMatch] Matched ${email} to contact ${contact.id}, company ${contact.company_id}`);
    return {
      company_id: contact.company_id,
      contact_id: contact.id,
      matched_by: 'contact_email',
    };
  }

  // Strategy 2: Match company domain
  if (domain) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, domain')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .single();

    if (company) {
      console.log(`[EmailMatch] Matched ${email} to company ${company.id} via domain`);
      return {
        company_id: company.id,
        contact_id: contact?.id || null,
        matched_by: 'company_domain',
      };
    }
  }

  // Strategy 3: Match any contact with same email domain
  if (domain) {
    const { data: domainContact } = await supabase
      .from('contacts')
      .select('id, company_id, email')
      .ilike('email', `%@${domain}`)
      .not('company_id', 'is', null)
      .limit(1)
      .single();

    if (domainContact?.company_id) {
      console.log(`[EmailMatch] Matched ${email} to company ${domainContact.company_id} via contact domain`);
      return {
        company_id: domainContact.company_id,
        contact_id: null, // Don't assign to a different contact
        matched_by: 'contact_domain',
      };
    }
  }

  console.log(`[EmailMatch] No match found for ${email}`);
  return { company_id: null, contact_id: null, matched_by: null };
}

/**
 * Match a communication to company/contact based on participants
 */
export async function matchCommunicationToCompany(communicationId: string): Promise<MatchResult> {
  const supabase = createAdminClient();

  // Get the communication
  const { data: comm, error } = await supabase
    .from('communications')
    .select('id, direction, their_participants, our_participants, company_id, contact_id')
    .eq('id', communicationId)
    .single();

  if (error || !comm) {
    console.error(`[EmailMatch] Communication not found: ${communicationId}`);
    return { company_id: null, contact_id: null, matched_by: null };
  }

  // Already linked? Skip
  if (comm.company_id) {
    return { company_id: comm.company_id, contact_id: comm.contact_id, matched_by: null };
  }

  // Get email from their_participants (the external party)
  const theirParticipants = (comm.their_participants as Array<{ email?: string }>) || [];
  const externalEmail = theirParticipants[0]?.email;

  if (!externalEmail) {
    console.log(`[EmailMatch] No external email in communication ${communicationId}`);
    return { company_id: null, contact_id: null, matched_by: null };
  }

  // Match the email
  const match = await matchEmailToCompany(externalEmail);

  // Update the communication if matched
  if (match.company_id) {
    const updates: Record<string, string> = { company_id: match.company_id };
    if (match.contact_id) {
      updates.contact_id = match.contact_id;
    }

    await supabase
      .from('communications')
      .update(updates)
      .eq('id', communicationId);

    console.log(`[EmailMatch] Updated communication ${communicationId} with company ${match.company_id}`);
  }

  return match;
}
