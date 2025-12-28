/**
 * Contact Auto-Enrichment Service
 * Automatically enriches contacts from Apollo/LinkedIn data
 * and creates new contacts from discovered employees
 */

import { createClient } from '@supabase/supabase-js';
import type {
  EnhancedApolloPerson,
  ContactEnrichmentResult,
  SingleContactEnrichmentResult,
} from '../types';

// ============================================
// SUPABASE CLIENT
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// CONTACT ENRICHMENT SERVICE
// ============================================

/**
 * Enrich existing contacts from Apollo people data
 * Also creates new contacts for discovered employees
 */
export async function enrichExistingContacts(
  companyId: string,
  apolloPeople: EnhancedApolloPerson[]
): Promise<ContactEnrichmentResult> {
  try {
    // Get existing contacts for this company
    const { data: existingContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, phone, linkedin_url, title, seniority, department')
      .eq('company_id', companyId);

    if (fetchError) {
      return {
        success: false,
        enrichedCount: 0,
        createdCount: 0,
        matchedContacts: [],
        error: fetchError.message,
      };
    }

    const contacts = existingContacts || [];
    let enrichedCount = 0;
    let createdCount = 0;
    const matchedContacts: ContactEnrichmentResult['matchedContacts'] = [];

    for (const apolloPerson of apolloPeople) {
      // Try to find a matching contact
      const matchedContact = findMatchingContact(contacts, apolloPerson);

      if (matchedContact) {
        // Enrich existing contact
        const result = await enrichContact(matchedContact.id, apolloPerson);
        if (result.success && result.fieldsUpdated.length > 0) {
          enrichedCount++;
          matchedContacts.push({
            contactId: matchedContact.id,
            apolloId: apolloPerson.apolloId,
            fieldsUpdated: result.fieldsUpdated,
          });
        }
      } else if (apolloPerson.email || apolloPerson.phone) {
        // Create new contact from Apollo data
        const created = await createContactFromApollo(companyId, apolloPerson);
        if (created) {
          createdCount++;
        }
      }
    }

    return {
      success: true,
      enrichedCount,
      createdCount,
      matchedContacts,
      error: null,
    };
  } catch (error) {
    console.error('[ContactEnrichment] Error:', error);
    return {
      success: false,
      enrichedCount: 0,
      createdCount: 0,
      matchedContacts: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enrich a single contact from Apollo data
 */
export async function enrichContact(
  contactId: string,
  apolloPerson: EnhancedApolloPerson
): Promise<SingleContactEnrichmentResult> {
  try {
    // Get current contact data
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      return {
        success: false,
        contactId,
        fieldsUpdated: [],
        newValues: {},
        error: fetchError?.message || 'Contact not found',
      };
    }

    // Build update object - only update empty fields
    const updates: Record<string, unknown> = {};
    const fieldsUpdated: string[] = [];

    // Phone
    if (!contact.phone && (apolloPerson.directDial || apolloPerson.phone)) {
      updates.phone = apolloPerson.directDial || apolloPerson.phone;
      fieldsUpdated.push('phone');
    }

    // Direct phone
    if (!contact.direct_phone && apolloPerson.directDial) {
      updates.direct_phone = apolloPerson.directDial;
      fieldsUpdated.push('direct_phone');
    }

    // LinkedIn URL
    if (!contact.linkedin_url && apolloPerson.linkedinUrl) {
      updates.linkedin_url = apolloPerson.linkedinUrl;
      fieldsUpdated.push('linkedin_url');
    }

    // Title
    if (!contact.title && apolloPerson.title) {
      updates.title = apolloPerson.title;
      fieldsUpdated.push('title');
    }

    // Seniority
    if (!contact.seniority && apolloPerson.seniority) {
      updates.seniority = apolloPerson.seniority;
      fieldsUpdated.push('seniority');
    }

    // Department
    if (!contact.department && apolloPerson.department) {
      updates.department = apolloPerson.department;
      fieldsUpdated.push('department');
    }

    // Apply updates if any
    if (fieldsUpdated.length > 0) {
      updates.enriched_at = new Date().toISOString();
      updates.enrichment_source = 'apollo';

      const { error: updateError } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId);

      if (updateError) {
        return {
          success: false,
          contactId,
          fieldsUpdated: [],
          newValues: {},
          error: updateError.message,
        };
      }

      // Log enrichment
      await logContactEnrichment(contactId, 'apollo', fieldsUpdated, updates);
    }

    return {
      success: true,
      contactId,
      fieldsUpdated,
      newValues: updates,
      error: null,
    };
  } catch (error) {
    console.error('[ContactEnrichment] Error enriching contact:', error);
    return {
      success: false,
      contactId,
      fieldsUpdated: [],
      newValues: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enrich a contact by email lookup in Apollo
 */
export async function enrichContactFromEmail(
  contactId: string,
  email: string
): Promise<SingleContactEnrichmentResult> {
  const apiKey = process.env.APOLLO_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      contactId,
      fieldsUpdated: [],
      newValues: {},
      error: 'Apollo API key not configured',
    };
  }

  try {
    // Search Apollo for this email
    const response = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      return {
        success: false,
        contactId,
        fieldsUpdated: [],
        newValues: {},
        error: `Apollo API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const person = data.person;

    if (!person) {
      return {
        success: true,
        contactId,
        fieldsUpdated: [],
        newValues: {},
        error: null, // Not an error, just no match found
      };
    }

    // Transform to EnhancedApolloPerson and enrich
    const apolloPerson: EnhancedApolloPerson = {
      apolloId: person.id || '',
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.name || '',
      title: person.title || null,
      headline: person.headline || null,
      department: person.departments?.[0] || null,
      seniority: mapApolloSeniority(person.seniority),
      email: person.email || null,
      phone: person.phone_numbers?.[0]?.sanitized_number || null,
      linkedinUrl: person.linkedin_url || null,
      photoUrl: person.photo_url || null,
      employmentHistory: [],
      // Enhanced fields
      personalEmail: null,
      mobilePhone: person.phone_numbers?.find((p: { type?: string }) => p.type === 'mobile')?.sanitized_number || null,
      directDial: person.phone_numbers?.find((p: { type?: string }) => p.type === 'work_direct')?.sanitized_number || null,
      bio: person.headline || null,
      skills: [],
      certifications: [],
      yearsInRole: null,
      yearsAtCompany: null,
      budgetAuthority: false,
      techBuyer: false,
      reportsTo: null,
      teamSize: null,
      linkedinActivityLevel: 'none',
      recentPosts: 0,
      connectionCount: null,
    };

    return await enrichContact(contactId, apolloPerson);
  } catch (error) {
    console.error('[ContactEnrichment] Error looking up email:', error);
    return {
      success: false,
      contactId,
      fieldsUpdated: [],
      newValues: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new contact from Apollo person data
 */
async function createContactFromApollo(
  companyId: string,
  apolloPerson: EnhancedApolloPerson
): Promise<boolean> {
  try {
    const { error } = await supabase.from('contacts').insert({
      company_id: companyId,
      first_name: apolloPerson.firstName,
      last_name: apolloPerson.lastName,
      email: apolloPerson.email,
      phone: apolloPerson.directDial || apolloPerson.phone,
      direct_phone: apolloPerson.directDial,
      title: apolloPerson.title,
      linkedin_url: apolloPerson.linkedinUrl,
      seniority: apolloPerson.seniority,
      department: apolloPerson.department,
      enriched_at: new Date().toISOString(),
      enrichment_source: 'apollo_discovery',
      // Mark as AI-discovered
      notes: 'Discovered via Account Intelligence',
    });

    if (error) {
      console.error('[ContactEnrichment] Error creating contact:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[ContactEnrichment] Error creating contact:', error);
    return false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface ExistingContact {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  title: string | null;
  seniority: string | null;
  department: string | null;
}

/**
 * Find a matching contact by email or fuzzy name match
 */
function findMatchingContact(
  contacts: ExistingContact[],
  apolloPerson: EnhancedApolloPerson
): ExistingContact | null {
  // Try exact email match first
  if (apolloPerson.email) {
    const emailMatch = contacts.find(
      (c) => c.email?.toLowerCase() === apolloPerson.email?.toLowerCase()
    );
    if (emailMatch) return emailMatch;
  }

  // Try fuzzy name match
  const apolloName = apolloPerson.fullName.toLowerCase().trim();
  const apolloFirstName = apolloPerson.firstName?.toLowerCase().trim() || '';
  const apolloLastName = apolloPerson.lastName?.toLowerCase().trim() || '';

  for (const contact of contacts) {
    const contactFirstName = contact.first_name?.toLowerCase().trim() || '';
    const contactLastName = contact.last_name?.toLowerCase().trim() || '';
    const contactFullName = `${contactFirstName} ${contactLastName}`.trim();

    // Check for exact full name match
    if (contactFullName && contactFullName === apolloName) {
      return contact;
    }

    // Check for first + last name match
    if (
      contactFirstName &&
      contactLastName &&
      contactFirstName === apolloFirstName &&
      contactLastName === apolloLastName
    ) {
      return contact;
    }
  }

  return null;
}

/**
 * Map Apollo seniority to our enum
 */
function mapApolloSeniority(seniority: string | undefined): EnhancedApolloPerson['seniority'] {
  if (!seniority) return null;

  const mapping: Record<string, EnhancedApolloPerson['seniority']> = {
    c_suite: 'c_level',
    owner: 'owner',
    founder: 'owner',
    partner: 'partner',
    vp: 'vp',
    director: 'director',
    manager: 'manager',
    senior: 'senior',
    entry: 'entry',
  };

  return mapping[seniority.toLowerCase()] || null;
}

/**
 * Log contact enrichment
 */
async function logContactEnrichment(
  contactId: string,
  source: string,
  fieldsUpdated: string[],
  newValues: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('enrichment_log').insert({
      entity_type: 'contact',
      entity_id: contactId,
      source,
      fields_updated: fieldsUpdated,
      previous_values: {}, // Could fetch previous values if needed
      new_values: newValues,
    });
  } catch (error) {
    console.error('[EnrichmentLog] Failed to log contact enrichment:', error);
  }
}
