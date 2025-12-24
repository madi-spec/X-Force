/**
 * Email to Company Matching
 *
 * Matches email addresses to companies and contacts using multiple strategies:
 * 1. Direct contact email match
 * 2. Company domain match
 * 3. Contact with same email domain match
 *
 * Internal domains (our company) are excluded from matching.
 * For forwarded emails, attempts to extract original sender.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Internal domains - these are OUR company, not customers
const INTERNAL_DOMAINS = [
  'voiceforpest.com',
  'affiliatedtech.com',
  'x-rai.com',
  'xraisales.com',
];

/**
 * Check if an email is from an internal domain
 */
export function isInternalEmail(email: string): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1];
  return INTERNAL_DOMAINS.some(d => domain === d || domain?.endsWith(`.${d}`));
}

/**
 * Extract external emails from a list, filtering out internal domains
 */
export function getExternalEmails(emails: string[]): string[] {
  return emails.filter(e => e && !isInternalEmail(e));
}

/**
 * Try to extract forwarded email sender from content
 * Looks for patterns like "From: john@example.com" or "---------- Forwarded message ---------"
 */
export function extractForwardedSender(content: string): string | null {
  if (!content) return null;

  // Pattern: "From: Name <email@domain.com>" or "From: email@domain.com"
  const forwardPatterns = [
    /(?:From|De|Von):\s*(?:[^<\n]*<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /[-]{3,}\s*(?:Forwarded|Original)\s+(?:message|Message)[\s\S]*?From:\s*(?:[^<\n]*<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
  ];

  for (const pattern of forwardPatterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      const email = match[1].toLowerCase();
      // Only return if it's an external email
      if (!isInternalEmail(email)) {
        return email;
      }
    }
  }

  return null;
}

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
 *
 * Priority:
 * 1. External emails from their_participants
 * 2. External emails from our_participants (for outbound to external)
 * 3. Forwarded email original sender (extracted from content)
 * 4. If no external match found, leave unlinked
 */
export async function matchCommunicationToCompany(communicationId: string): Promise<MatchResult> {
  const supabase = createAdminClient();

  // Get the communication with content for forwarded email detection
  const { data: comm, error } = await supabase
    .from('communications')
    .select('id, direction, their_participants, our_participants, company_id, contact_id, full_content, content_preview, subject')
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

  // Collect all emails from participants
  const theirParticipants = (comm.their_participants as Array<{ email?: string }>) || [];
  const ourParticipants = (comm.our_participants as Array<{ email?: string }>) || [];

  const theirEmails = theirParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
  const ourEmails = ourParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];

  // Get external emails only (filter out internal domains)
  const externalTheirEmails = getExternalEmails(theirEmails);
  const externalOurEmails = getExternalEmails(ourEmails);

  // Build priority list of emails to try matching
  const emailsToTry: string[] = [
    ...externalTheirEmails,  // Priority 1: external "their" participants
    ...externalOurEmails,    // Priority 2: external "our" participants (for outbound)
  ];

  // Check for forwarded email original sender
  const content = comm.full_content || comm.content_preview || '';
  const isForwarded = /(?:fwd?:|fw:|\bforwarded\b)/i.test(comm.subject || '');

  if (isForwarded || content.includes('Forwarded message') || content.includes('Original Message')) {
    const forwardedSender = extractForwardedSender(content);
    if (forwardedSender && !emailsToTry.includes(forwardedSender)) {
      emailsToTry.push(forwardedSender);
      console.log(`[EmailMatch] Found forwarded sender: ${forwardedSender}`);
    }
  }

  // Log if we filtered out internal emails
  const internalCount = theirEmails.length + ourEmails.length - emailsToTry.length;
  if (internalCount > 0) {
    console.log(`[EmailMatch] Filtered out ${internalCount} internal email(s) for communication ${communicationId}`);
  }

  // No external emails found
  if (emailsToTry.length === 0) {
    console.log(`[EmailMatch] No external emails in communication ${communicationId} - leaving unlinked`);
    return { company_id: null, contact_id: null, matched_by: null };
  }

  // Try matching each email in priority order
  for (const email of emailsToTry) {
    const match = await matchEmailToCompany(email);
    if (match.company_id) {
      // Update the communication
      const updates: Record<string, string> = { company_id: match.company_id };
      if (match.contact_id) {
        updates.contact_id = match.contact_id;
      }

      await supabase
        .from('communications')
        .update(updates)
        .eq('id', communicationId);

      console.log(`[EmailMatch] Updated communication ${communicationId} with company ${match.company_id} (matched via ${email})`);
      return match;
    }
  }

  // No match found for any external email
  console.log(`[EmailMatch] No company match for external emails: ${emailsToTry.join(', ')}`);
  return { company_id: null, contact_id: null, matched_by: null };
}
