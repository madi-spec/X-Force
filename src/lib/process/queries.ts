/**
 * Unified process/stage query helpers
 *
 * These functions provide consistent access to process stages
 * across all components, abstracting the underlying table structure.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

export interface ProcessStage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  sla_days: number | null;
  sla_warning_days: number | null;
  is_terminal: boolean;
  terminal_type: string | null;
  config?: Record<string, unknown>;
  // Sales-specific fields
  pitch_points: Array<{ id: string; text: string; source?: string; effectiveness_score?: number }>;
  objection_handlers: Array<{ id: string; objection: string; response: string; source?: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
  ai_suggested_pitch_points: unknown[];
  ai_suggested_objections: unknown[];
  ai_insights: Record<string, unknown>;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  ai_sequence_id: string | null;
  ai_actions: unknown[];
  exit_criteria?: string | null;
  exit_actions: unknown;
}

export interface ProcessWithStages {
  id: string;
  product_id: string;
  process_type: ProcessType;
  name: string;
  status: string;
  version: number;
  stages: ProcessStage[];
}

/**
 * Get published process with stages for a product
 */
export async function getProcessWithStages(
  supabase: SupabaseClient,
  productId: string,
  processType: ProcessType
): Promise<ProcessWithStages | null> {
  const { data, error } = await supabase
    .from('product_processes')
    .select(`
      id, product_id, process_type, name, status, version,
      stages:product_process_stages(
        id, name, slug, description, stage_order, goal,
        sla_days, sla_warning_days, is_terminal, terminal_type,
        pitch_points, objection_handlers, resources,
        ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
        avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
        exit_actions
      )
    `)
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    stages: ((data.stages as ProcessStage[]) || []).sort(
      (a: ProcessStage, b: ProcessStage) => a.stage_order - b.stage_order
    ),
  } as ProcessWithStages;
}

/**
 * Get stages for a product's sales process
 * Convenience wrapper for ProductPipeline and similar components
 */
export async function getSalesStages(
  supabase: SupabaseClient,
  productId: string
): Promise<ProcessStage[]> {
  const process = await getProcessWithStages(supabase, productId, 'sales');
  return process?.stages || [];
}

/**
 * Get all process types configured for a product
 */
export async function getProductProcessTypes(
  supabase: SupabaseClient,
  productId: string
): Promise<ProcessType[]> {
  const { data } = await supabase
    .from('product_processes')
    .select('process_type')
    .eq('product_id', productId)
    .eq('status', 'published');

  return (data || []).map((p) => p.process_type as ProcessType);
}

/**
 * Get stage by ID from the unified table
 */
export async function getStageById(
  supabase: SupabaseClient,
  stageId: string
): Promise<ProcessStage | null> {
  const { data, error } = await supabase
    .from('product_process_stages')
    .select(`
      id, name, slug, description, stage_order, goal,
      sla_days, sla_warning_days, is_terminal, terminal_type,
      pitch_points, objection_handlers, resources,
      ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
      avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
      exit_actions
    `)
    .eq('id', stageId)
    .single();

  if (error || !data) return null;
  return data as ProcessStage;
}

/**
 * Get stages for a product by product ID (queries product_process_stages via product_processes)
 * This replaces direct queries to product_sales_stages
 */
export async function getStagesByProductId(
  supabase: SupabaseClient,
  productId: string,
  processType: ProcessType = 'sales'
): Promise<ProcessStage[]> {
  // First get the process
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (!process) return [];

  // Then get stages
  const { data: stages } = await supabase
    .from('product_process_stages')
    .select(`
      id, name, slug, description, stage_order, goal,
      sla_days, sla_warning_days, is_terminal, terminal_type,
      pitch_points, objection_handlers, resources,
      ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
      avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
      exit_actions
    `)
    .eq('process_id', process.id)
    .order('stage_order');

  return (stages as ProcessStage[]) || [];
}
