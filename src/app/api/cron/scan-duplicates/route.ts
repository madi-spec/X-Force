/**
 * POST /api/cron/scan-duplicates
 *
 * Background job to scan for duplicates
 * Should be called by Vercel Cron or similar scheduler
 *
 * Recommended schedule: Daily at 3 AM
 * Vercel cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/scan-duplicates",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectDuplicates } from '@/lib/duplicates/algorithms';
import {
  calculateCompletenessScore,
  COMPANY_FIELD_WEIGHTS,
  CONTACT_FIELD_WEIGHTS,
} from '@/lib/duplicates/detection';
import type { DuplicateEntityType } from '@/types/duplicates';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

interface ScanStats {
  entityType: DuplicateEntityType;
  detected: number;
  created: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow both Bearer token and direct secret match
    const isAuthorized =
      !cronSecret || // No secret configured = allow (dev mode)
      authHeader === `Bearer ${cronSecret}` ||
      authHeader === cronSecret;

    if (!isAuthorized) {
      console.error('[cron/scan-duplicates] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[cron/scan-duplicates] Starting background duplicate scan');

    const supabase = createAdminClient();
    const results: ScanStats[] = [];

    // Scan companies
    const companyStats = await scanEntityType(supabase, 'company');
    results.push(companyStats);

    // Scan contacts
    const contactStats = await scanEntityType(supabase, 'contact');
    results.push(contactStats);

    console.log('[cron/scan-duplicates] Scan complete:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalDetected: results.reduce((sum, r) => sum + r.detected, 0),
        totalCreated: results.reduce((sum, r) => sum + r.created, 0),
      },
    });
  } catch (error) {
    console.error('[cron/scan-duplicates] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

async function scanEntityType(
  supabase: ReturnType<typeof createAdminClient>,
  entityType: DuplicateEntityType
): Promise<ScanStats> {
  console.log(`[cron/scan-duplicates] Scanning ${entityType}s`);

  const matches = await detectDuplicates(supabase, { entityType });
  console.log(`[cron/scan-duplicates] Found ${matches.length} ${entityType} duplicate groups`);

  let created = 0;

  for (const match of matches) {
    // Check if group already exists (skip if pending, merged, or marked_separate)
    const { data: existing } = await supabase
      .from('duplicate_groups')
      .select('id')
      .eq('entity_type', entityType)
      .in('status', ['pending', 'merged', 'marked_separate'])
      .contains('match_fields', match.matchFields)
      .limit(1);

    if (existing && existing.length > 0) {
      continue;
    }

    // Get full records for completeness scoring
    const table = entityType === 'contact' ? 'contacts' : 'companies';
    const weights = entityType === 'contact' ? CONTACT_FIELD_WEIGHTS : COMPANY_FIELD_WEIGHTS;

    const { data: records } = await supabase.from(table).select('*').in('id', match.recordIds);

    if (!records || records.length === 0) continue;

    // Calculate completeness and select primary
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
        detected_by: 'background_scan',
      })
      .select('id')
      .single();

    if (groupError || !group) {
      console.error(`[cron/scan-duplicates] Error creating group:`, groupError?.message);
      continue;
    }

    // Add members
    for (const record of scoredRecords) {
      await supabase.from('duplicate_group_members').insert({
        group_id: group.id,
        record_id: record.id,
        field_count: record.fieldCount,
        completeness_score: record.score,
        is_primary: record.id === primaryRecord.id,
        record_snapshot: record,
      });
    }

    created++;
  }

  console.log(`[cron/scan-duplicates] Created ${created} new ${entityType} duplicate groups`);

  return {
    entityType,
    detected: matches.length,
    created,
  };
}

// Also support GET for easy manual triggering in development
export async function GET(request: NextRequest): Promise<NextResponse> {
  // In development, allow GET requests without auth
  if (process.env.NODE_ENV === 'development') {
    return POST(request);
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
