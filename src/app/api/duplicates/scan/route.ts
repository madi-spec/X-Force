/**
 * POST /api/duplicates/scan
 * Trigger a duplicate scan for specified entity type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectDuplicates } from '@/lib/duplicates';
import {
  calculateCompletenessScore,
  COMPANY_FIELD_WEIGHTS,
  CONTACT_FIELD_WEIGHTS,
} from '@/lib/duplicates/detection';
import type { DuplicateEntityType, ScanResult } from '@/types/duplicates';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<ScanResult | { error: string }>> {
  try {
    // Authenticate user
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const entityType = body.entityType as DuplicateEntityType;

    if (!['company', 'contact', 'customer'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // Use admin client for the scan
    const supabase = createAdminClient();

    // Run detection
    console.log(`[duplicates/scan] Starting scan for ${entityType}`);
    const matches = await detectDuplicates(supabase, { entityType });
    console.log(`[duplicates/scan] Found ${matches.length} potential duplicate groups`);

    // Store detected duplicates
    let created = 0;

    for (const match of matches) {
      // Check if group already exists (to avoid re-creating resolved groups)
      // Include pending, merged, and marked_separate to prevent re-detecting
      const { data: existing } = await supabase
        .from('duplicate_groups')
        .select('id, status')
        .eq('entity_type', entityType)
        .in('status', ['pending', 'merged', 'marked_separate'])
        .contains('match_fields', match.matchFields)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[duplicates/scan] Group already exists (${existing[0].status}) for match: ${match.matchReason}`);
        continue;
      }

      // Get full records for completeness scoring
      const table = entityType === 'contact' ? 'contacts' : 'companies';
      const weights = entityType === 'contact' ? CONTACT_FIELD_WEIGHTS : COMPANY_FIELD_WEIGHTS;

      const { data: records } = await supabase.from(table).select('*').in('id', match.recordIds);

      if (!records || records.length === 0) continue;

      // Calculate completeness scores and select primary
      const scoredRecords = records.map((r) => ({
        ...r,
        ...calculateCompletenessScore(r, weights),
      }));

      scoredRecords.sort((a, b) => b.score - a.score);
      const primaryRecord = scoredRecords[0];

      // Create duplicate group
      const { data: group, error: groupError } = await supabase
        .from('duplicate_groups')
        .insert({
          entity_type: entityType,
          confidence: match.confidence,
          match_reason: match.matchReason,
          match_fields: match.matchFields,
          match_score: match.matchScore,
          primary_record_id: primaryRecord.id,
          detected_by: 'manual_scan',
        })
        .select('id')
        .single();

      if (groupError || !group) {
        console.error('[duplicates/scan] Error creating group:', groupError?.message);
        continue;
      }

      // Add members
      for (const record of scoredRecords) {
        const { error: memberError } = await supabase.from('duplicate_group_members').insert({
          group_id: group.id,
          record_id: record.id,
          field_count: record.fieldCount,
          completeness_score: record.score,
          is_primary: record.id === primaryRecord.id,
          record_snapshot: record,
        });

        if (memberError) {
          console.error('[duplicates/scan] Error adding member:', memberError.message);
        }
      }

      created++;
    }

    console.log(`[duplicates/scan] Created ${created} new duplicate groups`);

    return NextResponse.json({
      success: true,
      detected: matches.length,
      created,
      message: `Found ${matches.length} duplicate groups, created ${created} new pending reviews`,
    });
  } catch (error) {
    console.error('[duplicates/scan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
