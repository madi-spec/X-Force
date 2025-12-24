/**
 * Email Sync for Communication Hub
 *
 * Syncs emails from email_messages to communications table
 * and triggers analysis.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { syncEmailToCommunications } from '../adapters/emailAdapter';
import { analyzeCommunication } from '../analysis/analyzeCommunication';
import { matchCommunicationToCompany } from '../matching/matchEmailToCompany';

/**
 * Sync a single email to communications and trigger analysis
 */
export async function syncEmailToCommunication(emailId: string): Promise<string | null> {
  try {
    // Sync to communications table
    const communicationId = await syncEmailToCommunications(emailId);

    if (!communicationId) {
      console.log(`[EmailSync] Failed to sync email ${emailId}`);
      return null;
    }

    console.log(`[EmailSync] Synced email ${emailId} → communication ${communicationId}`);

    // Try to match to company/contact (async, don't block)
    matchCommunicationToCompany(communicationId).catch((err) => {
      console.error(`[EmailSync] Matching failed for ${communicationId}:`, err);
    });

    // Trigger analysis in background (don't block)
    triggerAnalysis(communicationId).catch((err) => {
      console.error(`[EmailSync] Analysis failed for ${communicationId}:`, err);
    });

    return communicationId;
  } catch (error) {
    console.error(`[EmailSync] Error syncing email ${emailId}:`, error);
    return null;
  }
}

/**
 * Sync all recent emails to communications
 */
export async function syncRecentEmailsToCommunications(
  options?: { since?: string; limit?: number }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();
  const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = options?.limit || 100;

  // Find emails not yet synced
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !emails) {
    console.error('[EmailSync] Failed to fetch emails:', error);
    return { synced: 0, errors: 1 };
  }

  let synced = 0;
  let errors = 0;

  for (const email of emails) {
    // Check if already synced
    const { data: existing } = await supabase
      .from('communications')
      .select('id')
      .eq('source_table', 'email_messages')
      .eq('source_id', email.id)
      .single();

    if (existing) {
      continue; // Already synced
    }

    const result = await syncEmailToCommunication(email.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }

  console.log(`[EmailSync] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Trigger analysis for a communication (non-blocking)
 */
async function triggerAnalysis(communicationId: string): Promise<void> {
  try {
    // Run analysis directly
    await analyzeCommunication(communicationId);
    console.log(`[EmailSync] Analysis complete for ${communicationId}`);
  } catch (error) {
    console.error(`[EmailSync] Analysis failed:`, error);
    // Don't throw - we don't want to fail the sync just because analysis failed
  }
}
