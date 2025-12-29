/**
 * Duplicate Merge Service
 * Handles merging duplicate records and relocating related data
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { MergeResult, RelocationCounts } from '@/types/duplicates';

/**
 * Merge duplicate companies
 * - Fills empty fields from duplicates into primary
 * - Combines external_ids
 * - Relocates contacts, deals, activities, company_products
 * - Deletes duplicate records
 */
export async function mergeCompanies(
  supabase: SupabaseClient,
  primaryId: string,
  duplicateIds: string[],
  userId: string
): Promise<MergeResult> {
  try {
    // 1. Get all records
    const { data: records, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .in('id', [primaryId, ...duplicateIds]);

    if (fetchError || !records) {
      return {
        success: false,
        primaryRecordId: primaryId,
        mergedRecordIds: duplicateIds,
        mergedFields: {},
        relocationCounts: {},
        error: fetchError?.message || 'Failed to fetch records',
      };
    }

    const primary = records.find((r) => r.id === primaryId);
    const duplicates = records.filter((r) => r.id !== primaryId);

    if (!primary) {
      return {
        success: false,
        primaryRecordId: primaryId,
        mergedRecordIds: duplicateIds,
        mergedFields: {},
        relocationCounts: {},
        error: 'Primary record not found',
      };
    }

    // 2. Merge fields (fill empty fields from duplicates)
    const mergedFields: Record<string, unknown> = {};
    const fieldsToMerge = [
      'domain',
      'segment',
      'industry',
      'agent_count',
      'crm_platform',
      'address',
      'employee_count',
      'employee_range',
      'revenue_estimate',
      'vfp_customer_id',
      'ats_id',
      'vfp_support_contact',
      'website',
      'logo_url',
      'notes',
    ];

    for (const field of fieldsToMerge) {
      // Only fill if primary doesn't have a value
      if (!primary[field]) {
        for (const dup of duplicates) {
          if (dup[field]) {
            mergedFields[field] = dup[field];
            break; // Take first non-null value
          }
        }
      }
    }

    // 3. Merge external_ids (combine all)
    const allExternalIds: Record<string, unknown> = { ...(primary.external_ids || {}) };
    for (const dup of duplicates) {
      if (dup.external_ids && typeof dup.external_ids === 'object') {
        Object.assign(allExternalIds, dup.external_ids);
      }
    }
    if (Object.keys(allExternalIds).length > 0) {
      mergedFields.external_ids = allExternalIds;
    }

    // 4. Update primary record with merged data
    if (Object.keys(mergedFields).length > 0) {
      const { error: updateError } = await supabase
        .from('companies')
        .update(mergedFields)
        .eq('id', primaryId);

      if (updateError) {
        console.error('[mergeCompanies] Error updating primary:', updateError.message);
      }
    }

    // 5. Relocate related records
    const relocationCounts: RelocationCounts = {};

    // Relocate contacts
    const { data: contactsUpdated } = await supabase
      .from('contacts')
      .update({ company_id: primaryId })
      .in('company_id', duplicateIds)
      .select('id');
    relocationCounts.contacts = contactsUpdated?.length || 0;

    // Relocate deals
    const { data: dealsUpdated } = await supabase
      .from('deals')
      .update({ company_id: primaryId })
      .in('company_id', duplicateIds)
      .select('id');
    relocationCounts.deals = dealsUpdated?.length || 0;

    // Relocate activities
    const { data: activitiesUpdated } = await supabase
      .from('activities')
      .update({ company_id: primaryId })
      .in('company_id', duplicateIds)
      .select('id');
    relocationCounts.activities = activitiesUpdated?.length || 0;

    // Relocate communications
    const { data: communicationsUpdated } = await supabase
      .from('communications')
      .update({ company_id: primaryId })
      .in('company_id', duplicateIds)
      .select('id');
    relocationCounts.communications = communicationsUpdated?.length || 0;

    // Handle company_products (avoid duplicates)
    const { data: dupProducts } = await supabase
      .from('company_products')
      .select('*')
      .in('company_id', duplicateIds);

    const { data: primaryProducts } = await supabase
      .from('company_products')
      .select('product_id')
      .eq('company_id', primaryId);

    const primaryProductIds = new Set(primaryProducts?.map((p) => p.product_id) || []);
    let productsRelocated = 0;

    for (const product of dupProducts || []) {
      if (!primaryProductIds.has(product.product_id)) {
        // Move product to primary
        await supabase
          .from('company_products')
          .update({ company_id: primaryId })
          .eq('id', product.id);
        productsRelocated++;
      } else {
        // Product already exists on primary, delete duplicate
        await supabase.from('company_products').delete().eq('id', product.id);
      }
    }
    relocationCounts.company_products = productsRelocated;

    // 6. Delete duplicate records
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      console.error('[mergeCompanies] Error deleting duplicates:', deleteError.message);
    }

    return {
      success: true,
      primaryRecordId: primaryId,
      mergedRecordIds: duplicateIds,
      mergedFields,
      relocationCounts,
    };
  } catch (error) {
    console.error('[mergeCompanies] Error:', error);
    return {
      success: false,
      primaryRecordId: primaryId,
      mergedRecordIds: duplicateIds,
      mergedFields: {},
      relocationCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Merge duplicate contacts
 * - Fills empty fields from duplicates into primary
 * - Relocates activities
 * - Deletes duplicate records
 */
export async function mergeContacts(
  supabase: SupabaseClient,
  primaryId: string,
  duplicateIds: string[],
  userId: string
): Promise<MergeResult> {
  try {
    // 1. Get all records
    const { data: records, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', [primaryId, ...duplicateIds]);

    if (fetchError || !records) {
      return {
        success: false,
        primaryRecordId: primaryId,
        mergedRecordIds: duplicateIds,
        mergedFields: {},
        relocationCounts: {},
        error: fetchError?.message || 'Failed to fetch records',
      };
    }

    const primary = records.find((r) => r.id === primaryId);
    const duplicates = records.filter((r) => r.id !== primaryId);

    if (!primary) {
      return {
        success: false,
        primaryRecordId: primaryId,
        mergedRecordIds: duplicateIds,
        mergedFields: {},
        relocationCounts: {},
        error: 'Primary record not found',
      };
    }

    // 2. Merge fields
    const mergedFields: Record<string, unknown> = {};
    const fieldsToMerge = [
      'phone',
      'title',
      'role',
      'is_decision_maker',
      'relationship_facts',
      'communication_style',
      'last_contacted_at',
    ];

    for (const field of fieldsToMerge) {
      if (!primary[field]) {
        for (const dup of duplicates) {
          if (dup[field]) {
            mergedFields[field] = dup[field];
            break;
          }
        }
      }
    }

    // Special handling for relationship_facts (merge arrays)
    if (primary.relationship_facts || duplicates.some((d) => d.relationship_facts)) {
      const allFacts = new Set<string>();

      // Add primary facts
      if (Array.isArray(primary.relationship_facts)) {
        primary.relationship_facts.forEach((f: { fact: string }) => allFacts.add(f.fact));
      }

      // Add duplicate facts
      for (const dup of duplicates) {
        if (Array.isArray(dup.relationship_facts)) {
          dup.relationship_facts.forEach((f: { fact: string }) => allFacts.add(f.fact));
        }
      }

      // If we have more facts than primary, update
      const primaryFactCount = Array.isArray(primary.relationship_facts)
        ? primary.relationship_facts.length
        : 0;
      if (allFacts.size > primaryFactCount) {
        mergedFields.relationship_facts = Array.from(allFacts).map((fact) => ({ fact }));
      }
    }

    // 3. Update primary record
    if (Object.keys(mergedFields).length > 0) {
      const { error: updateError } = await supabase
        .from('contacts')
        .update(mergedFields)
        .eq('id', primaryId);

      if (updateError) {
        console.error('[mergeContacts] Error updating primary:', updateError.message);
      }
    }

    // 4. Relocate activities (if they reference contact_id)
    const relocationCounts: RelocationCounts = {};

    const { data: activitiesUpdated } = await supabase
      .from('activities')
      .update({ contact_id: primaryId })
      .in('contact_id', duplicateIds)
      .select('id');
    relocationCounts.activities = activitiesUpdated?.length || 0;

    // 5. Delete duplicate records
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      console.error('[mergeContacts] Error deleting duplicates:', deleteError.message);
    }

    return {
      success: true,
      primaryRecordId: primaryId,
      mergedRecordIds: duplicateIds,
      mergedFields,
      relocationCounts,
    };
  } catch (error) {
    console.error('[mergeContacts] Error:', error);
    return {
      success: false,
      primaryRecordId: primaryId,
      mergedRecordIds: duplicateIds,
      mergedFields: {},
      relocationCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Merge duplicates for any entity type
 */
export async function mergeDuplicates(
  supabase: SupabaseClient,
  entityType: 'company' | 'contact' | 'customer',
  primaryId: string,
  duplicateIds: string[],
  userId: string
): Promise<MergeResult> {
  switch (entityType) {
    case 'company':
    case 'customer':
      return mergeCompanies(supabase, primaryId, duplicateIds, userId);
    case 'contact':
      return mergeContacts(supabase, primaryId, duplicateIds, userId);
    default:
      return {
        success: false,
        primaryRecordId: primaryId,
        mergedRecordIds: duplicateIds,
        mergedFields: {},
        relocationCounts: {},
        error: `Unknown entity type: ${entityType}`,
      };
  }
}
