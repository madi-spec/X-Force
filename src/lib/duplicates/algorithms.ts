/**
 * Duplicate Detection Algorithms
 * Entity-specific detection logic for companies and contacts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { DuplicateMatch, DetectionOptions, DuplicateConfidence } from '@/types/duplicates';
import {
  normalizeName,
  normalizePhone,
  normalizeEmail,
  normalizeDomain,
} from './detection';

interface CompanyRecord {
  id: string;
  name: string;
  domain: string | null;
  vfp_customer_id: string | null;
  ats_id: string | null;
  external_ids: Record<string, unknown> | null;
  status: string | null;
  segment: string | null;
}

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company_id: string;
}

/**
 * Detect duplicate companies
 * Checks: domain (exact), vfp_customer_id (exact), ats_id (exact), normalized name (high)
 */
export async function detectCompanyDuplicates(
  supabase: SupabaseClient,
  options: DetectionOptions
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const processedPairs = new Set<string>();

  // Fetch all companies
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, domain, vfp_customer_id, ats_id, external_ids, status, segment')
    .order('name');

  if (error || !companies) {
    console.error('[detectCompanyDuplicates] Error fetching companies:', error?.message);
    return matches;
  }

  // Helper to create a unique pair key
  const pairKey = (ids: string[]) => ids.sort().join(':');

  // Helper to check if pair already processed
  const isNewMatch = (ids: string[]): boolean => {
    const key = pairKey(ids);
    if (processedPairs.has(key)) return false;
    processedPairs.add(key);
    return true;
  };

  // 1. EXACT: Domain matches
  const domainMap = new Map<string, CompanyRecord[]>();
  for (const company of companies) {
    if (company.domain) {
      const domain = normalizeDomain(company.domain);
      if (domain.length >= 3) {
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(company);
      }
    }
  }

  for (const [domain, list] of domainMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'exact',
          matchReason: 'Exact domain match',
          matchFields: { domain },
          matchScore: 100,
        });
      }
    }
  }

  // 2. EXACT: VFP Customer ID matches
  const vfpMap = new Map<string, CompanyRecord[]>();
  for (const company of companies) {
    if (company.vfp_customer_id) {
      const vfpId = company.vfp_customer_id.trim();
      if (!vfpMap.has(vfpId)) vfpMap.set(vfpId, []);
      vfpMap.get(vfpId)!.push(company);
    }
  }

  for (const [vfpId, list] of vfpMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'exact',
          matchReason: 'Exact VFP Customer ID match',
          matchFields: { vfp_customer_id: vfpId },
          matchScore: 100,
        });
      }
    }
  }

  // 3. EXACT: ATS ID matches
  const atsMap = new Map<string, CompanyRecord[]>();
  for (const company of companies) {
    if (company.ats_id) {
      const atsId = company.ats_id.trim();
      if (!atsMap.has(atsId)) atsMap.set(atsId, []);
      atsMap.get(atsId)!.push(company);
    }
  }

  for (const [atsId, list] of atsMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'exact',
          matchReason: 'Exact ATS ID match',
          matchFields: { ats_id: atsId },
          matchScore: 100,
        });
      }
    }
  }

  // 4. HIGH: Normalized name matches
  const nameMap = new Map<string, CompanyRecord[]>();
  for (const company of companies) {
    const normalized = normalizeName(company.name);
    if (normalized.length >= 3) {
      if (!nameMap.has(normalized)) nameMap.set(normalized, []);
      nameMap.get(normalized)!.push(company);
    }
  }

  for (const [normalizedName, list] of nameMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'high',
          matchReason: 'Normalized name match',
          matchFields: { normalized_name: normalizedName, original_names: list.map((c) => c.name) },
          matchScore: 85,
        });
      }
    }
  }

  // Filter by minimum confidence if specified
  if (options.minConfidence) {
    const confidenceOrder: DuplicateConfidence[] = ['exact', 'high', 'medium', 'low'];
    const minIndex = confidenceOrder.indexOf(options.minConfidence);
    return matches.filter((m) => confidenceOrder.indexOf(m.confidence) <= minIndex);
  }

  return matches;
}

/**
 * Detect duplicate contacts
 * Checks: email (exact), phone (high), same name within company (medium)
 */
export async function detectContactDuplicates(
  supabase: SupabaseClient,
  options: DetectionOptions
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const processedPairs = new Set<string>();

  // Fetch all contacts
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, company_id')
    .order('name');

  if (error || !contacts) {
    console.error('[detectContactDuplicates] Error fetching contacts:', error?.message);
    return matches;
  }

  // Helper functions
  const pairKey = (ids: string[]) => ids.sort().join(':');
  const isNewMatch = (ids: string[]): boolean => {
    const key = pairKey(ids);
    if (processedPairs.has(key)) return false;
    processedPairs.add(key);
    return true;
  };

  // 1. EXACT: Email matches
  const emailMap = new Map<string, ContactRecord[]>();
  for (const contact of contacts) {
    if (contact.email) {
      const email = normalizeEmail(contact.email);
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(contact);
    }
  }

  for (const [email, list] of emailMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'exact',
          matchReason: 'Exact email match',
          matchFields: { email },
          matchScore: 100,
        });
      }
    }
  }

  // 2. HIGH: Phone number matches
  const phoneMap = new Map<string, ContactRecord[]>();
  for (const contact of contacts) {
    if (contact.phone) {
      const phone = normalizePhone(contact.phone);
      if (phone.length >= 10) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone)!.push(contact);
      }
    }
  }

  for (const [phone, list] of phoneMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        matches.push({
          recordIds: ids,
          confidence: 'high',
          matchReason: 'Phone number match',
          matchFields: { phone },
          matchScore: 90,
        });
      }
    }
  }

  // 3. MEDIUM: Same normalized name within same company
  const companyNameMap = new Map<string, ContactRecord[]>();
  for (const contact of contacts) {
    if (contact.company_id) {
      const key = `${contact.company_id}:${normalizeName(contact.name)}`;
      if (!companyNameMap.has(key)) companyNameMap.set(key, []);
      companyNameMap.get(key)!.push(contact);
    }
  }

  for (const [key, list] of companyNameMap) {
    if (list.length > 1) {
      const ids = list.map((c) => c.id);
      if (isNewMatch(ids)) {
        const [companyId, normalizedName] = key.split(':');
        matches.push({
          recordIds: ids,
          confidence: 'medium',
          matchReason: 'Same name within company',
          matchFields: {
            company_id: companyId,
            normalized_name: normalizedName,
            original_names: list.map((c) => c.name),
          },
          matchScore: 70,
        });
      }
    }
  }

  // Filter by minimum confidence if specified
  if (options.minConfidence) {
    const confidenceOrder: DuplicateConfidence[] = ['exact', 'high', 'medium', 'low'];
    const minIndex = confidenceOrder.indexOf(options.minConfidence);
    return matches.filter((m) => confidenceOrder.indexOf(m.confidence) <= minIndex);
  }

  return matches;
}

/**
 * Run duplicate detection for any entity type
 */
export async function detectDuplicates(
  supabase: SupabaseClient,
  options: DetectionOptions
): Promise<DuplicateMatch[]> {
  switch (options.entityType) {
    case 'company':
    case 'customer':
      return detectCompanyDuplicates(supabase, options);
    case 'contact':
      return detectContactDuplicates(supabase, options);
    default:
      return [];
  }
}
