/**
 * AI-Powered Entity Matching
 *
 * Uses AI to intelligently match incoming communications to existing
 * companies and contacts in the CRM. No keyword fallbacks - AI does all reasoning.
 *
 * This replaces the old autoLinkEntities approach with keyword/fuzzy matching.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { getPromptWithVariables } from '@/lib/ai/promptManager';

// ============================================
// TYPES
// ============================================

export interface RawIdentifiers {
  emails: string[];
  phones: string[];
  names_mentioned: string[];
  company_mentions: string[];
  domain: string | null;
  from_email: string;
  from_name: string | null;
}

export interface CandidateCompany {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  segment: string | null;
  agent_count: number | null;
  contact_count: number;
}

export interface CandidateContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  company_name: string | null;
}

export interface AIMatchResult {
  company_match: {
    match_type: 'exact' | 'confident' | 'probable' | 'none';
    company_id: string | null;
    reasoning: string;
    confidence: number;
  };
  contact_match: {
    match_type: 'exact' | 'confident' | 'probable' | 'none';
    contact_id: string | null;
    reasoning: string;
    confidence: number;
  };
  create_company: {
    should_create: boolean;
    suggested_name: string | null;
    suggested_domain: string | null;
    suggested_industry: string | null;
    reasoning: string;
  };
  create_contact: {
    should_create: boolean;
    suggested_name: string | null;
    suggested_email: string | null;
    suggested_phone: string | null;
    suggested_title: string | null;
    reasoning: string;
  };
  overall_confidence: number;
  overall_reasoning: string;
}

export interface EntityMatchResult {
  company: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    company_id: string | null;
  } | null;
  confidence: number;
  reasoning: string;
  was_created: {
    company: boolean;
    contact: boolean;
  };
}

export interface CommunicationInput {
  type: 'email_inbound' | 'email_outbound' | 'transcript';
  from_email?: string;
  from_name?: string;
  to_emails?: string[];
  subject?: string;
  body?: string;
  attendees?: string[]; // For transcripts
  title?: string; // For transcripts
  transcript_text?: string; // For transcripts
}

// ============================================
// STEP A: EXTRACT RAW IDENTIFIERS
// ============================================

/**
 * Extract raw identifiers from communication without matching
 */
export function extractRawIdentifiers(communication: CommunicationInput): RawIdentifiers {
  const emails: Set<string> = new Set();
  const phones: Set<string> = new Set();
  const names: Set<string> = new Set();
  const companies: Set<string> = new Set();

  // Get the text content to analyze
  const textToAnalyze = [
    communication.subject,
    communication.body,
    communication.transcript_text,
    communication.title,
  ].filter(Boolean).join('\n');

  // Extract from_email and from_name
  const fromEmail = communication.from_email?.toLowerCase() || '';
  const fromName = communication.from_name || '';

  if (fromEmail) emails.add(fromEmail);
  if (fromName) names.add(fromName);

  // Add attendees from transcripts
  if (communication.attendees) {
    communication.attendees.forEach(a => {
      if (a.includes('@')) {
        emails.add(a.toLowerCase());
      } else {
        names.add(a);
      }
    });
  }

  // Extract emails from text using regex
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const foundEmails = textToAnalyze.match(emailPattern) || [];
  foundEmails.forEach(e => emails.add(e.toLowerCase()));

  // Extract phone numbers from text
  const phonePattern = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
  const foundPhones = textToAnalyze.match(phonePattern) || [];
  foundPhones.forEach(p => phones.add(p.replace(/[^\d+]/g, '')));

  // Extract potential company names (capitalized multi-word phrases)
  // This is a simple heuristic - AI will do the real matching
  const companyPatterns = [
    // Common pest control company patterns
    /(?:Lawn\s+Doctor(?:\s+of\s+[\w\s]+)?)/gi,
    /(?:[\w]+\s+Pest(?:\s+Control)?(?:\s+[\w]+)?)/gi,
    /(?:[\w]+\s+Termite(?:\s+[\w]+)?)/gi,
    // Generic company patterns
    /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+(?:Inc|LLC|Corp|Co|Ltd|Services|Solutions))/g,
  ];

  companyPatterns.forEach(pattern => {
    const matches = textToAnalyze.match(pattern) || [];
    matches.forEach(m => companies.add(m.trim()));
  });

  // Extract domain from primary email
  let domain: string | null = null;
  if (fromEmail) {
    const domainMatch = fromEmail.match(/@([^@]+)$/);
    if (domainMatch) {
      const extractedDomain = domainMatch[1].toLowerCase();
      // Skip common email providers
      const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'me.com'];
      if (!commonDomains.includes(extractedDomain)) {
        domain = extractedDomain;
      }
    }
  }

  return {
    emails: Array.from(emails),
    phones: Array.from(phones),
    names_mentioned: Array.from(names),
    company_mentions: Array.from(companies),
    domain,
    from_email: fromEmail,
    from_name: fromName || null,
  };
}

// ============================================
// STEP A2: AI-BASED COMPANY EXTRACTION FROM CONTENT
// ============================================

/**
 * Extract company names from email content using AI
 * This catches cases where regex patterns miss (e.g., "On The Fly")
 */
export async function extractCompaniesFromContent(
  subject: string,
  body: string
): Promise<string[]> {
  // Skip if no meaningful content
  if (!body && !subject) return [];
  if ((body || '').length < 50 && (subject || '').length < 10) return [];

  const client = new Anthropic();

  const prompt = `Extract all company or business names mentioned in this email.

Look for:
- Company names in the signature
- Company names mentioned in the body
- Business names referenced (e.g., "On The Fly Pest Solutions", "ABC Pest Control")
- Franchise names with location qualifiers (e.g., "Lawn Doctor of Boston")

DO NOT include:
- Personal names (unless they are clearly a business name)
- Generic terms like "pest control company" or "the business"
- Your own company name if mentioned

Subject: ${subject || 'No subject'}

Body:
${(body || '').substring(0, 2000)}

Return ONLY a JSON array of company names. No other text.
Example: ["Acme Corp", "TechStart Inc"]
If no companies mentioned, return: []`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    let jsonText = content.text.trim();
    // Handle potential markdown wrapping
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonText);
    if (Array.isArray(result)) {
      console.log(`[EntityMatcher] AI extracted companies from content: ${result.join(', ')}`);
      return result.filter((name: unknown) => typeof name === 'string' && name.length > 1);
    }
    return [];
  } catch (error) {
    console.warn('[EntityMatcher] AI company extraction failed:', error);
    return [];
  }
}

/**
 * Try to match extracted company names against database
 * Uses multiple matching strategies: exact, contains, partial word match
 */
export async function matchExtractedCompanies(
  extractedNames: string[]
): Promise<{ companyId: string; companyName: string } | null> {
  if (!extractedNames.length) return null;

  const supabase = createAdminClient();

  for (const name of extractedNames) {
    // Skip very short names
    if (name.length < 3) continue;

    // 1. Try exact match (case-insensitive)
    const { data: exactMatch } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    if (exactMatch) {
      console.log(`[EntityMatcher] Exact match for "${name}": ${exactMatch.name}`);
      return { companyId: exactMatch.id, companyName: exactMatch.name };
    }

    // 2. Try fuzzy match (contains)
    const { data: fuzzyMatch } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();

    if (fuzzyMatch) {
      console.log(`[EntityMatcher] Fuzzy match for "${name}": ${fuzzyMatch.name}`);
      return { companyId: fuzzyMatch.id, companyName: fuzzyMatch.name };
    }

    // 3. Try reverse contains (name contains query)
    // e.g., search "On The Fly" matches "On The Fly Pest Solutions"
    const { data: reverseMatches } = await supabase
      .from('companies')
      .select('id, name')
      .limit(50);

    if (reverseMatches) {
      const nameLower = name.toLowerCase();
      const reverseMatch = reverseMatches.find(c =>
        c.name.toLowerCase().includes(nameLower)
      );
      if (reverseMatch) {
        console.log(`[EntityMatcher] Reverse match for "${name}": ${reverseMatch.name}`);
        return { companyId: reverseMatch.id, companyName: reverseMatch.name };
      }
    }

    // 4. Try matching first few words (for "On The Fly Pest Solutions" → "On The Fly")
    const words = name.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
      const partialName = words.slice(0, 3).join(' ');
      const { data: partialMatch } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${partialName}%`)
        .limit(1)
        .maybeSingle();

      if (partialMatch) {
        console.log(`[EntityMatcher] Partial match for "${partialName}": ${partialMatch.name}`);
        return { companyId: partialMatch.id, companyName: partialMatch.name };
      }
    }
  }

  return null;
}

// ============================================
// STEP B: FIND CANDIDATE MATCHES
// ============================================

/**
 * Find candidate companies that might match
 */
export async function findCandidateCompanies(params: {
  domains: (string | null)[];
  nameFragments: string[];
  emailDomains: string[];
  contactCompanyIds?: string[]; // Companies that matched contacts belong to
}): Promise<CandidateCompany[]> {
  const supabase = createAdminClient();
  const candidateIds: Set<string> = new Set();
  const candidates: CandidateCompany[] = [];

  // First priority: Companies that matched contacts already belong to
  if (params.contactCompanyIds?.length) {
    const { data: contactCompanies } = await supabase
      .from('companies')
      .select('id, name, domain, website, city, state, industry, segment, agent_count')
      .in('id', params.contactCompanyIds.filter(Boolean));

    contactCompanies?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({ ...c, contact_count: 0 });
      }
    });
  }

  // Search by domain (exact and partial)
  for (const domain of params.domains.filter(Boolean)) {
    const { data: domainMatches } = await supabase
      .from('companies')
      .select('id, name, domain, website, city, state, industry, segment, agent_count')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .limit(5);

    domainMatches?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({ ...c, contact_count: 0 });
      }
    });
  }

  // Search by name fragments (first word of each mention)
  for (const fragment of params.nameFragments) {
    if (fragment.length < 3) continue;

    const { data: nameMatches } = await supabase
      .from('companies')
      .select('id, name, domain, website, city, state, industry, segment, agent_count')
      .ilike('name', `%${fragment}%`)
      .limit(10);

    nameMatches?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({ ...c, contact_count: 0 });
      }
    });
  }

  // Get contact counts for each candidate
  for (const candidate of candidates) {
    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', candidate.id);

    candidate.contact_count = count || 0;
  }

  return candidates.slice(0, 15); // Limit to 15 candidates for AI
}

/**
 * Find candidate contacts that might match
 */
export async function findCandidateContacts(params: {
  emails: string[];
  phones: string[];
  nameFragments: string[];
  companyIds: string[];
}): Promise<CandidateContact[]> {
  const supabase = createAdminClient();
  const candidateIds: Set<string> = new Set();
  const candidates: CandidateContact[] = [];

  // Search by email (exact match)
  for (const email of params.emails) {
    const { data: emailMatches } = await supabase
      .from('contacts')
      .select(`
        id, name, email, phone, title, company_id,
        companies:company_id (name)
      `)
      .ilike('email', email)
      .limit(3);

    emailMatches?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({
          ...c,
          company_name: (c.companies as any)?.name || null,
        });
      }
    });
  }

  // Search by phone
  for (const phone of params.phones) {
    if (phone.length < 10) continue;

    const { data: phoneMatches } = await supabase
      .from('contacts')
      .select(`
        id, name, email, phone, title, company_id,
        companies:company_id (name)
      `)
      .ilike('phone', `%${phone.slice(-10)}%`)
      .limit(3);

    phoneMatches?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({
          ...c,
          company_name: (c.companies as any)?.name || null,
        });
      }
    });
  }

  // Search by name within candidate companies
  for (const fragment of params.nameFragments) {
    const firstName = fragment.split(' ')[0];
    if (firstName.length < 2) continue;

    let query = supabase
      .from('contacts')
      .select(`
        id, name, email, phone, title, company_id,
        companies:company_id (name)
      `)
      .ilike('name', `%${firstName}%`)
      .limit(10);

    // If we have candidate companies, prioritize those
    if (params.companyIds.length > 0) {
      query = query.in('company_id', params.companyIds);
    }

    const { data: nameMatches } = await query;

    nameMatches?.forEach(c => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        candidates.push({
          ...c,
          company_name: (c.companies as any)?.name || null,
        });
      }
    });
  }

  return candidates.slice(0, 15); // Limit to 15 candidates for AI
}

// ============================================
// STEP C: AI-POWERED MATCHING
// ============================================

/**
 * Use AI to determine the best match from candidates
 */
export async function callAIForMatching(
  communication: CommunicationInput,
  rawIdentifiers: RawIdentifiers,
  candidateCompanies: CandidateCompany[],
  candidateContacts: CandidateContact[]
): Promise<AIMatchResult> {
  const client = new Anthropic();

  // Format candidate companies for the prompt
  const candidateCompaniesText = candidateCompanies.length === 0
    ? 'No candidate companies found in CRM.'
    : candidateCompanies.map((c, i) => `${i + 1}. ID: ${c.id}, Name: ${c.name}, Domain: ${c.domain || 'N/A'}, Location: ${c.city || 'Unknown'}${c.state ? `, ${c.state}` : ''}, Industry: ${c.industry || 'Unknown'}`).join('\n');

  // Format candidate contacts for the prompt
  const candidateContactsText = candidateContacts.length === 0
    ? 'No candidate contacts found in CRM.'
    : candidateContacts.map((c, i) => `${i + 1}. ID: ${c.id}, Name: ${c.name}, Email: ${c.email || 'N/A'}, Title: ${c.title || 'Unknown'}, Company: ${c.company_name || 'None'}`).join('\n');

  // Try to load the managed prompt from database
  const promptResult = await getPromptWithVariables('entity_matching', {
    communicationType: communication.type,
    fromEmail: rawIdentifiers.from_email,
    fromName: rawIdentifiers.from_name || '',
    subject: communication.subject || 'N/A',
    contentPreview: (communication.body || communication.transcript_text || '').substring(0, 1500),
    emailsMentioned: rawIdentifiers.emails.join(', ') || 'none',
    phonesMentioned: rawIdentifiers.phones.join(', ') || 'none',
    namesMentioned: rawIdentifiers.names_mentioned.join(', ') || 'none',
    companyMentions: rawIdentifiers.company_mentions.join(', ') || 'none',
    emailDomain: rawIdentifiers.domain || 'N/A (common provider)',
    candidateCompanies: candidateCompaniesText,
    candidateContacts: candidateContactsText,
  });

  // Use managed prompt or fall back to inline prompt
  let prompt: string;
  if (promptResult?.prompt) {
    prompt = promptResult.prompt;
  } else {
    console.warn('[callAIForMatching] Failed to load entity_matching prompt, using fallback');
    prompt = `You are matching an incoming communication to existing CRM records.

## THE COMMUNICATION
Type: ${communication.type}
From: ${rawIdentifiers.from_email}${rawIdentifiers.from_name ? ` (${rawIdentifiers.from_name})` : ''}
Subject: ${communication.subject || 'N/A'}
Content Preview:
${(communication.body || communication.transcript_text || '').substring(0, 1500)}

## RAW IDENTIFIERS EXTRACTED
Emails mentioned: ${rawIdentifiers.emails.join(', ') || 'none'}
Phones mentioned: ${rawIdentifiers.phones.join(', ') || 'none'}
Names mentioned: ${rawIdentifiers.names_mentioned.join(', ') || 'none'}
Company mentions: ${rawIdentifiers.company_mentions.join(', ') || 'none'}
Email domain: ${rawIdentifiers.domain || 'N/A (common provider)'}

## CANDIDATE COMPANIES IN OUR CRM
${candidateCompaniesText}

## CANDIDATE CONTACTS IN OUR CRM
${candidateContactsText}

## YOUR TASK
Determine which company and contact this communication is from/about.

Return JSON only:
{
  "company_match": { "match_type": "exact|confident|probable|none", "company_id": "uuid or null", "reasoning": "string", "confidence": 0.0-1.0 },
  "contact_match": { "match_type": "exact|confident|probable|none", "contact_id": "uuid or null", "reasoning": "string", "confidence": 0.0-1.0 },
  "create_company": { "should_create": true/false, "suggested_name": "string or null", "suggested_domain": "string or null", "suggested_industry": "string or null", "reasoning": "string" },
  "create_contact": { "should_create": true/false, "suggested_name": "string or null", "suggested_email": "string or null", "suggested_phone": "string or null", "suggested_title": "string or null", "reasoning": "string" },
  "overall_confidence": 0.0-1.0,
  "overall_reasoning": "string"
}`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response (handle potential markdown wrapping and minor issues)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    // Clean up common JSON issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/\n/g, ' ')     // Remove newlines within strings
      .replace(/\t/g, ' ');    // Remove tabs

    try {
      const result = JSON.parse(jsonText) as AIMatchResult;
      return result;
    } catch (parseError) {
      console.error('[EntityMatcher] JSON parse error, raw text:', jsonText.substring(0, 500));
      throw parseError;
    }

  } catch (error) {
    console.error('[EntityMatcher] AI matching error:', error);

    // Return a safe default if AI fails
    return {
      company_match: {
        match_type: 'none',
        company_id: null,
        reasoning: 'AI matching failed',
        confidence: 0,
      },
      contact_match: {
        match_type: 'none',
        contact_id: null,
        reasoning: 'AI matching failed',
        confidence: 0,
      },
      create_company: {
        should_create: true,
        suggested_name: rawIdentifiers.company_mentions[0] || null,
        suggested_domain: rawIdentifiers.domain,
        suggested_industry: null,
        reasoning: 'Creating due to AI failure',
      },
      create_contact: {
        should_create: true,
        suggested_name: rawIdentifiers.from_name,
        suggested_email: rawIdentifiers.from_email,
        suggested_phone: rawIdentifiers.phones[0] || null,
        suggested_title: null,
        reasoning: 'Creating due to AI failure',
      },
      overall_confidence: 0,
      overall_reasoning: 'AI matching failed - using extracted identifiers',
    };
  }
}

// ============================================
// STEP D: APPLY MATCH RESULT
// ============================================

const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH: 0.85,      // Match automatically, no review needed
  LIKELY_MATCH: 0.70,    // Match but flag for verification
  UNCERTAIN: 0.50,       // Show user candidates, ask to confirm
  NO_MATCH: 0.0          // Create new entity
};

/**
 * Main entry point: Intelligent entity matching using AI
 */
export async function intelligentEntityMatch(
  communication: CommunicationInput,
  userId: string
): Promise<EntityMatchResult> {
  console.log('[EntityMatcher] Starting AI-powered entity matching');

  // STEP A: Extract raw identifiers
  const rawIdentifiers = extractRawIdentifiers(communication);
  console.log('[EntityMatcher] Raw identifiers:', {
    emails: rawIdentifiers.emails,
    names: rawIdentifiers.names_mentioned,
    companies: rawIdentifiers.company_mentions,
    domain: rawIdentifiers.domain,
  });

  // STEP B: Get candidate matches from database
  // First find contacts to get their company associations
  const candidateContacts = await findCandidateContacts({
    emails: rawIdentifiers.emails,
    phones: rawIdentifiers.phones,
    nameFragments: rawIdentifiers.names_mentioned,
    companyIds: [], // We'll filter by company later
  });
  console.log(`[EntityMatcher] Found ${candidateContacts.length} candidate contacts`);

  // Now find companies, including those that contacts belong to
  const contactCompanyIds = candidateContacts
    .map(c => c.company_id)
    .filter((id): id is string => id !== null);

  // Extract meaningful words from subject for name matching
  // This helps catch cases like "on the fly receptionist" → match "On the Fly"
  const subjectWords = (communication.subject || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['the', 'and', 'for', 'with', 'from'].includes(w));

  const candidateCompanies = await findCandidateCompanies({
    domains: [rawIdentifiers.domain],
    nameFragments: [
      ...rawIdentifiers.company_mentions.map(n => n.split(' ')[0]),
      ...subjectWords, // Include meaningful subject words for name matching
    ],
    emailDomains: rawIdentifiers.emails.map(e => e.split('@')[1]).filter(Boolean),
    contactCompanyIds,
  });
  console.log(`[EntityMatcher] Found ${candidateCompanies.length} candidate companies`);

  // STEP C: Let AI reason about the best match
  const aiResult = await callAIForMatching(
    communication,
    rawIdentifiers,
    candidateCompanies,
    candidateContacts
  );
  console.log('[EntityMatcher] AI result:', {
    company: aiResult.company_match,
    contact: aiResult.contact_match,
    overall_confidence: aiResult.overall_confidence,
  });

  // STEP D: Apply the match with confidence threshold
  const supabase = createAdminClient();
  let company: EntityMatchResult['company'] = null;
  let contact: EntityMatchResult['contact'] = null;
  let wasCreated = { company: false, contact: false };

  // Handle company matching/creation
  if (aiResult.company_match.confidence >= CONFIDENCE_THRESHOLDS.LIKELY_MATCH && aiResult.company_match.company_id) {
    // Use matched company - first check candidates, then lookup from DB if needed
    const matched = candidateCompanies.find(c => c.id === aiResult.company_match.company_id);
    if (matched) {
      company = {
        id: matched.id,
        name: matched.name,
        domain: matched.domain,
      };
    } else {
      // AI matched a company_id not in candidates (e.g., from contact association)
      // Look it up directly from the database
      const { data: dbCompany } = await supabase
        .from('companies')
        .select('id, name, domain')
        .eq('id', aiResult.company_match.company_id)
        .single();

      if (dbCompany) {
        company = {
          id: dbCompany.id,
          name: dbCompany.name,
          domain: dbCompany.domain,
        };
        console.log(`[EntityMatcher] Looked up company from DB: ${dbCompany.name}`);
      }
    }
  }

  // FALLBACK: If no company match, try AI body extraction
  // This catches cases like "On The Fly" mentioned in email body but not in patterns
  if (!company && candidateCompanies.length === 0) {
    console.log('[EntityMatcher] No candidates found, trying AI body extraction...');
    // Use body text, or fall back to transcript text, or extract text from subject
    // Note: body_preview is a good fallback when body_text is null but body_html exists
    const bodyContent = communication.body || communication.transcript_text || '';
    const extractedCompanies = await extractCompaniesFromContent(
      communication.subject || '',
      bodyContent
    );

    if (extractedCompanies.length > 0) {
      const bodyMatch = await matchExtractedCompanies(extractedCompanies);
      if (bodyMatch) {
        // Found a match via AI extraction!
        const { data: matchedCompany } = await supabase
          .from('companies')
          .select('id, name, domain')
          .eq('id', bodyMatch.companyId)
          .single();

        if (matchedCompany) {
          company = matchedCompany;
          console.log(`[EntityMatcher] AI body extraction matched: ${matchedCompany.name}`);
        }
      }
    }
  }

  if (!company && aiResult.create_company.should_create && aiResult.create_company.suggested_name) {
    // Create new company
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        name: aiResult.create_company.suggested_name,
        domain: aiResult.create_company.suggested_domain,
        website: aiResult.create_company.suggested_domain ? `https://${aiResult.create_company.suggested_domain}` : null,
        industry: aiResult.create_company.suggested_industry || 'pest_control',
        status: 'prospect',
        source: 'ai_extracted',
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, name, domain')
      .single();

    if (!error && newCompany) {
      company = newCompany;
      wasCreated.company = true;
      console.log(`[EntityMatcher] Created company: ${newCompany.name}`);
    }
  }

  // Handle contact matching/creation
  if (aiResult.contact_match.confidence >= CONFIDENCE_THRESHOLDS.LIKELY_MATCH && aiResult.contact_match.contact_id) {
    // Use matched contact
    const matched = candidateContacts.find(c => c.id === aiResult.contact_match.contact_id);
    if (matched) {
      contact = {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        company_id: matched.company_id,
      };

      // Link contact to company if not already linked
      if (company && !matched.company_id) {
        await supabase
          .from('contacts')
          .update({ company_id: company.id, updated_at: new Date().toISOString() })
          .eq('id', matched.id);
        contact.company_id = company.id;
      }
    }
  } else if (aiResult.create_contact.should_create && (aiResult.create_contact.suggested_name || aiResult.create_contact.suggested_email)) {
    // Create new contact
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        name: aiResult.create_contact.suggested_name || aiResult.create_contact.suggested_email?.split('@')[0] || 'Unknown',
        email: aiResult.create_contact.suggested_email,
        phone: aiResult.create_contact.suggested_phone,
        title: aiResult.create_contact.suggested_title,
        company_id: company?.id || null,
        status: 'active',
        source: 'ai_extracted',
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, name, email, company_id')
      .single();

    if (!error && newContact) {
      contact = newContact;
      wasCreated.contact = true;
      console.log(`[EntityMatcher] Created contact: ${newContact.name}`);
    }
  }

  const result: EntityMatchResult = {
    company,
    contact,
    confidence: aiResult.overall_confidence,
    reasoning: aiResult.overall_reasoning,
    was_created: wasCreated,
  };

  console.log('[EntityMatcher] Final result:', {
    company: company?.name || 'none',
    contact: contact?.name || 'none',
    confidence: result.confidence,
    created: wasCreated,
  });

  return result;
}
