import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Contact,
  ContactRole,
  MeetingStakeholder,
  RelationshipFact,
  CommunicationStyle,
} from '@/types';

interface ContactDetectionResult {
  created: Contact[];
  updated: Contact[];
  matched: Contact[];
  skipped: Array<{ name: string; reason: string }>;
}

interface ProcessedStakeholder {
  stakeholder: MeetingStakeholder;
  existingContact: Contact | null;
  action: 'create' | 'update' | 'skip';
  skipReason?: string;
}

/**
 * Process detected stakeholders from a meeting analysis
 * and auto-create or update contacts
 */
export async function processDetectedContacts(
  transcriptionId: string,
  companyId: string,
  stakeholders: MeetingStakeholder[],
  meetingTitle: string,
  meetingDate: string
): Promise<ContactDetectionResult> {
  const supabase = createAdminClient();
  const result: ContactDetectionResult = {
    created: [],
    updated: [],
    matched: [],
    skipped: [],
  };

  if (!stakeholders || stakeholders.length === 0) {
    return result;
  }

  // Get existing contacts for this company
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId);

  const contactsMap = new Map<string, Contact>();
  existingContacts?.forEach((c) => {
    // Map by email (lowercase) and by normalized name
    if (c.email) {
      contactsMap.set(c.email.toLowerCase(), c as Contact);
    }
    contactsMap.set(normalizeName(c.name), c as Contact);
  });

  // Process each stakeholder
  const processed: ProcessedStakeholder[] = [];

  for (const stakeholder of stakeholders) {
    // Skip stakeholders with low confidence
    const confidence = stakeholder.confidence ?? 0.5;
    if (confidence < 0.7) {
      processed.push({
        stakeholder,
        existingContact: null,
        action: 'skip',
        skipReason: `Low confidence (${confidence})`,
      });
      continue;
    }

    // Skip if no name
    if (!stakeholder.name || stakeholder.name.trim().length < 2) {
      processed.push({
        stakeholder,
        existingContact: null,
        action: 'skip',
        skipReason: 'No valid name detected',
      });
      continue;
    }

    // Try to match existing contact
    let existingContact: Contact | null = null;

    // First try email match (most reliable)
    if (stakeholder.email) {
      existingContact = contactsMap.get(stakeholder.email.toLowerCase()) || null;
    }

    // Then try name match
    if (!existingContact) {
      existingContact = contactsMap.get(normalizeName(stakeholder.name)) || null;
    }

    // Fuzzy name match as fallback
    if (!existingContact) {
      existingContact = findFuzzyMatch(stakeholder.name, existingContacts || []);
    }

    if (existingContact) {
      processed.push({
        stakeholder,
        existingContact,
        action: 'update',
      });
    } else {
      processed.push({
        stakeholder,
        existingContact: null,
        action: 'create',
      });
    }
  }

  // Execute creates and updates
  const sourceLabel = `Meeting: ${meetingTitle} (${meetingDate})`;

  for (const item of processed) {
    if (item.action === 'skip') {
      result.skipped.push({
        name: item.stakeholder.name,
        reason: item.skipReason || 'Unknown',
      });
      continue;
    }

    const facts = buildRelationshipFacts(item.stakeholder, sourceLabel);
    const commStyle = buildCommunicationStyle(item.stakeholder);

    if (item.action === 'create') {
      // Create new contact
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          name: item.stakeholder.name,
          email: item.stakeholder.email || `${normalizeName(item.stakeholder.name).replace(/\s/g, '.')}@placeholder.com`,
          title: item.stakeholder.role || null,
          role: mapDealRole(item.stakeholder.dealRole),
          is_primary: false,
          relationship_facts: facts,
          communication_style: commStyle,
          ai_detected_at: new Date().toISOString(),
          ai_detection_source: 'meeting',
          ai_confidence: item.stakeholder.confidence ?? 0.8,
        })
        .select()
        .single();

      if (!error && newContact) {
        result.created.push(newContact as Contact);
        // Record meeting mention
        await recordMeetingMention(
          supabase,
          newContact.id,
          transcriptionId,
          item.stakeholder,
          facts
        );
      }
    } else if (item.action === 'update' && item.existingContact) {
      // Merge facts with existing
      const existingFacts = (item.existingContact.relationship_facts || []) as RelationshipFact[];
      const mergedFacts = mergeFacts(existingFacts, facts);

      // Merge communication style
      const existingStyle = (item.existingContact.communication_style || {}) as CommunicationStyle;
      const mergedStyle = { ...existingStyle, ...commStyle, lastUpdated: new Date().toISOString() };

      // Update contact
      const updates: Record<string, unknown> = {
        relationship_facts: mergedFacts,
        communication_style: mergedStyle,
      };

      // Update title if we have a better one
      if (item.stakeholder.role && !item.existingContact.title) {
        updates.title = item.stakeholder.role;
      }

      // Update role if not set and we detected one
      if (item.stakeholder.dealRole && !item.existingContact.role) {
        updates.role = mapDealRole(item.stakeholder.dealRole);
      }

      const { data: updatedContact, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', item.existingContact.id)
        .select()
        .single();

      if (!error && updatedContact) {
        result.updated.push(updatedContact as Contact);
      } else {
        result.matched.push(item.existingContact);
      }

      // Record meeting mention
      await recordMeetingMention(
        supabase,
        item.existingContact.id,
        transcriptionId,
        item.stakeholder,
        facts
      );
    }
  }

  return result;
}

/**
 * Record a contact's mention in a meeting transcription
 */
async function recordMeetingMention(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string,
  transcriptionId: string,
  stakeholder: MeetingStakeholder,
  facts: RelationshipFact[]
): Promise<void> {
  await supabase.from('contact_meeting_mentions').upsert(
    {
      contact_id: contactId,
      transcription_id: transcriptionId,
      role_detected: stakeholder.role || null,
      deal_role_detected: mapDealRole(stakeholder.dealRole),
      sentiment_detected: stakeholder.sentiment || null,
      key_quotes: stakeholder.keyQuotes || [],
      facts_extracted: facts,
      confidence: stakeholder.confidence ?? null,
    },
    {
      onConflict: 'contact_id,transcription_id',
    }
  );
}

/**
 * Build relationship facts from stakeholder data
 */
function buildRelationshipFacts(
  stakeholder: MeetingStakeholder,
  source: string
): RelationshipFact[] {
  const facts: RelationshipFact[] = [];
  const now = new Date().toISOString();

  if (stakeholder.personalFacts) {
    for (const pf of stakeholder.personalFacts) {
      facts.push({
        type: pf.type,
        fact: pf.fact,
        source,
        detected_at: now,
        confidence: stakeholder.confidence ?? 0.8,
      });
    }
  }

  return facts;
}

/**
 * Build communication style from stakeholder data
 */
function buildCommunicationStyle(
  stakeholder: MeetingStakeholder
): CommunicationStyle | null {
  if (!stakeholder.communicationInsights) {
    return null;
  }

  const style: CommunicationStyle = {};

  if (stakeholder.communicationInsights.preferredChannel) {
    style.preferredChannel = stakeholder.communicationInsights.preferredChannel as CommunicationStyle['preferredChannel'];
  }

  if (stakeholder.communicationInsights.communicationTone) {
    style.communicationTone = stakeholder.communicationInsights.communicationTone;
  }

  style.lastUpdated = new Date().toISOString();

  return Object.keys(style).length > 1 ? style : null;
}

/**
 * Merge new facts with existing, avoiding duplicates
 */
function mergeFacts(
  existing: RelationshipFact[],
  newFacts: RelationshipFact[]
): RelationshipFact[] {
  const merged = [...existing];

  for (const newFact of newFacts) {
    // Check for semantic duplicate (same type and similar fact)
    const isDuplicate = existing.some(
      (ef) =>
        ef.type === newFact.type &&
        similarity(ef.fact.toLowerCase(), newFact.fact.toLowerCase()) > 0.8
    );

    if (!isDuplicate) {
      merged.push(newFact);
    }
  }

  return merged;
}

/**
 * Map stakeholder dealRole to ContactRole
 */
function mapDealRole(dealRole?: ContactRole): ContactRole {
  if (!dealRole) return null;
  const validRoles: ContactRole[] = ['decision_maker', 'influencer', 'champion', 'end_user', 'blocker'];
  return validRoles.includes(dealRole) ? dealRole : null;
}

/**
 * Normalize a name for comparison
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find a fuzzy match for a name in existing contacts
 */
function findFuzzyMatch(name: string, contacts: Contact[]): Contact | null {
  const normalizedName = normalizeName(name);
  let bestMatch: Contact | null = null;
  let bestScore = 0;

  for (const contact of contacts) {
    const score = similarity(normalizedName, normalizeName(contact.name));
    if (score > 0.85 && score > bestScore) {
      bestMatch = contact;
      bestScore = score;
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}
