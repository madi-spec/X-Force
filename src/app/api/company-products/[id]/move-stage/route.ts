/**
 * Move Stage API
 *
 * Handles stage transitions and process completion via the command layer.
 * All mutations go through events for audit trail and projections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  advanceStage,
  completeProcess,
} from '@/lib/lifecycle/commands';
import { runAllProjectors } from '@/lib/lifecycle/projectors';

// Create admin client for commands
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id: companyProductId } = await params;
    const body = await request.json();

    const { stage_id, outcome, actor_id } = body;
    // outcome: 'won' | 'declined' (for terminal stages)

    // Get company_product info
    const { data: cp, error: fetchError } = await supabase
      .from('company_products')
      .select('company_id, product_id')
      .eq('id', companyProductId)
      .single();

    if (fetchError || !cp) {
      return NextResponse.json({ error: 'Company product not found' }, { status: 404 });
    }

    const actor = {
      type: 'user' as const,
      id: actor_id,
    };

    let result;

    if (outcome === 'won') {
      // Complete process with won outcome
      // Get the terminal stage info
      const { data: terminalStage } = await supabase
        .from('product_process_stages')
        .select('id, name')
        .eq('terminal_type', 'won')
        .single();

      result = await completeProcess(supabase, {
        companyProductId,
        companyId: cp.company_id,
        productId: cp.product_id,
        terminalStageId: terminalStage?.id || stage_id,
        terminalStageName: terminalStage?.name || 'Closed Won',
        outcome: 'won',
        actor,
      });
    } else if (outcome === 'declined') {
      // Complete process with lost outcome
      const { data: terminalStage } = await supabase
        .from('product_process_stages')
        .select('id, name')
        .eq('terminal_type', 'lost')
        .single();

      result = await completeProcess(supabase, {
        companyProductId,
        companyId: cp.company_id,
        productId: cp.product_id,
        terminalStageId: terminalStage?.id || stage_id,
        terminalStageName: terminalStage?.name || 'Closed Lost',
        outcome: 'lost',
        actor,
      });
    } else if (stage_id) {
      // Advance to new stage
      // Get stage info
      const { data: stage, error: stageError } = await supabase
        .from('product_process_stages')
        .select('id, name, stage_order')
        .eq('id', stage_id)
        .single();

      if (stageError || !stage) {
        return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
      }

      result = await advanceStage(supabase, {
        companyProductId,
        companyId: cp.company_id,
        productId: cp.product_id,
        toStageId: stage.id,
        toStageName: stage.name,
        toStageOrder: stage.stage_order,
        reason: 'Stage transition via API',
        actor,
      });
    } else {
      return NextResponse.json({ error: 'stage_id or outcome required' }, { status: 400 });
    }

    // Check for command failure
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Run projectors to update read models
    await runAllProjectors(supabase);

    return NextResponse.json({ success: true, eventId: result.eventId });
  } catch (error) {
    console.error('Move stage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
