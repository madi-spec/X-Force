/**
 * SLA Breach Detection Scanner
 *
 * Scans projections to detect SLA breaches and emits events.
 *
 * ARCHITECTURE:
 * 1. Query company_product_read_model for items in active stages
 * 2. Calculate days in stage vs SLA threshold
 * 3. For breached items, check if breach event already exists
 * 4. If not, emit CompanyProductSLABreached event
 *
 * GUARDRAILS:
 * - Only emits events, never directly modifies projections
 * - Idempotent - safe to run multiple times
 * - Uses actor.type = 'system' to identify scanner-generated events
 *
 * USAGE:
 * - Run via cron job (recommended: every 15 minutes)
 * - Manual trigger via API endpoint
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { appendEvent } from './commands';
import type { CompanyProductSLABreached } from './events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// TYPES
// ============================================================================

export interface ScanResult {
  success: boolean;
  scanned: number;
  breachesDetected: number;
  eventsEmitted: number;
  errors: Array<{
    companyProductId: string;
    error: string;
  }>;
  duration: number;
}

interface StageWithSLA {
  id: string;
  name: string;
  sla_days: number | null;
  sla_warning_days: number | null;
  process_id: string;
  process_type: string;
}

interface CompanyProductInStage {
  company_product_id: string;
  company_id: string;
  product_id: string;
  current_stage_id: string;
  current_stage_name: string;
  stage_entered_at: string;
  current_process_type: string;
}

// ============================================================================
// SCANNER IMPLEMENTATION
// ============================================================================

/**
 * Scans for SLA breaches and emits events.
 *
 * @param supabase - Supabase client with service role
 * @returns Scan result with statistics
 */
export async function scanForSLABreaches(
  supabase: AnySupabaseClient
): Promise<ScanResult> {
  const startTime = Date.now();
  const errors: Array<{ companyProductId: string; error: string }> = [];
  let scanned = 0;
  let breachesDetected = 0;
  let eventsEmitted = 0;

  try {
    // Get all stages with SLA configured
    const { data: stages, error: stagesError } = await supabase
      .from('product_process_stages')
      .select(`
        id,
        name,
        sla_days,
        sla_warning_days,
        process_id,
        process:product_processes!inner(process_type)
      `)
      .not('sla_days', 'is', null);

    if (stagesError) {
      throw new Error(`Failed to fetch stages: ${stagesError.message}`);
    }

    if (!stages || stages.length === 0) {
      return {
        success: true,
        scanned: 0,
        breachesDetected: 0,
        eventsEmitted: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Create stage lookup map
    const stageMap = new Map<string, StageWithSLA>();
    for (const stage of stages) {
      stageMap.set(stage.id, {
        id: stage.id,
        name: stage.name,
        sla_days: stage.sla_days,
        sla_warning_days: stage.sla_warning_days,
        process_id: stage.process_id,
        process_type: (stage.process as unknown as { process_type: string })?.process_type || 'sales',
      });
    }

    // Get all company products in stages with SLA
    const stageIds = stages.map(s => s.id);
    const { data: companyProducts, error: cpError } = await supabase
      .from('company_product_read_model')
      .select('company_product_id, company_id, product_id, current_stage_id, current_stage_name, stage_entered_at, current_process_type')
      .in('current_stage_id', stageIds)
      .not('stage_entered_at', 'is', null);

    if (cpError) {
      throw new Error(`Failed to fetch company products: ${cpError.message}`);
    }

    if (!companyProducts || companyProducts.length === 0) {
      return {
        success: true,
        scanned: 0,
        breachesDetected: 0,
        eventsEmitted: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    scanned = companyProducts.length;
    const now = new Date();

    // Check each company product for SLA breach
    for (const cp of companyProducts as CompanyProductInStage[]) {
      const stage = stageMap.get(cp.current_stage_id);
      if (!stage || !stage.sla_days) continue;

      // Calculate days in stage
      const enteredAt = new Date(cp.stage_entered_at);
      const daysInStage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if breached
      if (daysInStage > stage.sla_days) {
        breachesDetected++;

        // Check if we already emitted a breach event for this stage entry
        // We look for existing SLABreached events after the stage entry
        const { data: existingBreachEvents, error: checkError } = await supabase
          .from('event_store')
          .select('id')
          .eq('aggregate_id', cp.company_product_id)
          .eq('event_type', 'CompanyProductSLABreached')
          .gte('occurred_at', cp.stage_entered_at)
          .limit(1);

        if (checkError) {
          errors.push({
            companyProductId: cp.company_product_id,
            error: `Failed to check existing events: ${checkError.message}`,
          });
          continue;
        }

        // Skip if breach already emitted for this stage entry
        if (existingBreachEvents && existingBreachEvents.length > 0) {
          continue;
        }

        // Emit breach event
        const breachEvent: CompanyProductSLABreached = {
          type: 'CompanyProductSLABreached',
          version: 1,
          data: {
            stageId: cp.current_stage_id,
            stageName: cp.current_stage_name || stage.name,
            slaDays: stage.sla_days,
            actualDays: daysInStage,
            daysOver: daysInStage - stage.sla_days,
          },
          occurredAt: now.toISOString(),
          actor: { type: 'system', id: 'sla_breach_scanner' },
          metadata: {
            source: 'sla_breach_scanner',
            scanTime: now.toISOString(),
          },
        };

        const result = await appendEvent(supabase, {
          aggregateId: cp.company_product_id,
          event: breachEvent,
        });

        if (result.success) {
          eventsEmitted++;
        } else {
          errors.push({
            companyProductId: cp.company_product_id,
            error: result.error || 'Unknown error emitting breach event',
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      scanned,
      breachesDetected,
      eventsEmitted,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      scanned,
      breachesDetected,
      eventsEmitted,
      errors: [{
        companyProductId: 'SYSTEM',
        error: error instanceof Error ? error.message : String(error),
      }],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Scans for SLA warnings (approaching breach) and emits events.
 *
 * @param supabase - Supabase client with service role
 * @returns Scan result with statistics
 */
export async function scanForSLAWarnings(
  supabase: AnySupabaseClient
): Promise<ScanResult> {
  const startTime = Date.now();
  const errors: Array<{ companyProductId: string; error: string }> = [];
  let scanned = 0;
  let warningsDetected = 0;
  let eventsEmitted = 0;

  try {
    // Get all stages with SLA warning configured
    const { data: stages, error: stagesError } = await supabase
      .from('product_process_stages')
      .select(`
        id,
        name,
        sla_days,
        sla_warning_days,
        process_id,
        process:product_processes!inner(process_type)
      `)
      .not('sla_warning_days', 'is', null);

    if (stagesError) {
      throw new Error(`Failed to fetch stages: ${stagesError.message}`);
    }

    if (!stages || stages.length === 0) {
      return {
        success: true,
        scanned: 0,
        breachesDetected: 0,
        eventsEmitted: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Create stage lookup map
    const stageMap = new Map<string, StageWithSLA>();
    for (const stage of stages) {
      stageMap.set(stage.id, {
        id: stage.id,
        name: stage.name,
        sla_days: stage.sla_days,
        sla_warning_days: stage.sla_warning_days,
        process_id: stage.process_id,
        process_type: (stage.process as unknown as { process_type: string })?.process_type || 'sales',
      });
    }

    // Get all company products in stages with SLA warning
    const stageIds = stages.map(s => s.id);
    const { data: companyProducts, error: cpError } = await supabase
      .from('company_product_read_model')
      .select('company_product_id, company_id, product_id, current_stage_id, current_stage_name, stage_entered_at, current_process_type')
      .in('current_stage_id', stageIds)
      .not('stage_entered_at', 'is', null);

    if (cpError) {
      throw new Error(`Failed to fetch company products: ${cpError.message}`);
    }

    if (!companyProducts || companyProducts.length === 0) {
      return {
        success: true,
        scanned: 0,
        breachesDetected: 0,
        eventsEmitted: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    scanned = companyProducts.length;
    const now = new Date();

    // Check each company product for SLA warning
    for (const cp of companyProducts as CompanyProductInStage[]) {
      const stage = stageMap.get(cp.current_stage_id);
      if (!stage || !stage.sla_warning_days || !stage.sla_days) continue;

      // Calculate days in stage
      const enteredAt = new Date(cp.stage_entered_at);
      const daysInStage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if in warning zone (but not breached)
      if (daysInStage >= stage.sla_warning_days && daysInStage <= stage.sla_days) {
        warningsDetected++;

        // Check if we already emitted a warning event for this stage entry
        const { data: existingWarningEvents, error: checkError } = await supabase
          .from('event_store')
          .select('id')
          .eq('aggregate_id', cp.company_product_id)
          .eq('event_type', 'CompanyProductSLAWarning')
          .gte('occurred_at', cp.stage_entered_at)
          .limit(1);

        if (checkError) {
          errors.push({
            companyProductId: cp.company_product_id,
            error: `Failed to check existing events: ${checkError.message}`,
          });
          continue;
        }

        // Skip if warning already emitted for this stage entry
        if (existingWarningEvents && existingWarningEvents.length > 0) {
          continue;
        }

        // Emit warning event
        const warningEvent = {
          type: 'CompanyProductSLAWarning' as const,
          version: 1 as const,
          data: {
            stageId: cp.current_stage_id,
            stageName: cp.current_stage_name || stage.name,
            slaDays: stage.sla_days,
            warningDays: stage.sla_warning_days,
            actualDays: daysInStage,
          },
          occurredAt: now.toISOString(),
          actor: { type: 'system' as const, id: 'sla_breach_scanner' },
          metadata: {
            source: 'sla_breach_scanner',
            scanTime: now.toISOString(),
          },
        };

        const result = await appendEvent(supabase, {
          aggregateId: cp.company_product_id,
          event: warningEvent,
        });

        if (result.success) {
          eventsEmitted++;
        } else {
          errors.push({
            companyProductId: cp.company_product_id,
            error: result.error || 'Unknown error emitting warning event',
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      scanned,
      breachesDetected: warningsDetected,
      eventsEmitted,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      scanned,
      breachesDetected: 0,
      eventsEmitted,
      errors: [{
        companyProductId: 'SYSTEM',
        error: error instanceof Error ? error.message : String(error),
      }],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Runs full SLA scan (warnings and breaches).
 */
export async function runFullSLAScan(
  supabase: AnySupabaseClient
): Promise<{
  warnings: ScanResult;
  breaches: ScanResult;
}> {
  const warnings = await scanForSLAWarnings(supabase);
  const breaches = await scanForSLABreaches(supabase);

  return { warnings, breaches };
}
