/**
 * Lifecycle Command API
 *
 * All lifecycle mutations must go through this command API.
 * Commands validate intent, emit events, and trigger projectors.
 *
 * ARCHITECTURE:
 * - POST /api/lifecycle/commands with action in body
 * - All commands emit events (never write projections directly)
 * - After events, projectors are triggered
 *
 * GUARDRAILS:
 * - No PATCH endpoints that mutate lifecycle state
 * - No bypassing command layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  startSale,
  advanceStage,
  setPhase,
  setOwner,
  setTier,
  setMRR,
  setSeats,
  setNextStepDue,
  completeProcess,
  completeSaleAndStartOnboarding,
  completeOnboardingAndStartEngagement,
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

// Command action types
type CommandAction =
  | 'start-sale'
  | 'advance-stage'
  | 'set-phase'
  | 'set-owner'
  | 'set-tier'
  | 'set-mrr'
  | 'set-seats'
  | 'set-next-step-due'
  | 'complete-process'
  | 'complete-sale-start-onboarding'
  | 'complete-onboarding-start-engagement';

// Request body types
interface BaseCommandRequest {
  action: CommandAction;
  companyProductId: string;
  companyId: string;
  productId: string;
  actorId?: string;
  actorType?: 'user' | 'system' | 'ai';
}

interface StartSaleRequest extends BaseCommandRequest {
  action: 'start-sale';
  processId: string;
  processVersion: number;
  initialStageId: string;
  initialStageName: string;
}

interface AdvanceStageRequest extends BaseCommandRequest {
  action: 'advance-stage';
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
  reason?: string;
}

interface SetPhaseRequest extends BaseCommandRequest {
  action: 'set-phase';
  toPhase: 'prospect' | 'in_sales' | 'onboarding' | 'active' | 'churned';
  reason?: string;
  churnReason?: string;
}

interface SetOwnerRequest extends BaseCommandRequest {
  action: 'set-owner';
  ownerId: string;
  ownerName: string;
  reason?: string;
}

interface SetTierRequest extends BaseCommandRequest {
  action: 'set-tier';
  tier: number;
  reason?: string;
}

interface SetMRRRequest extends BaseCommandRequest {
  action: 'set-mrr';
  mrr: number;
  currency?: string;
  reason?: string;
}

interface SetSeatsRequest extends BaseCommandRequest {
  action: 'set-seats';
  seats: number;
  reason?: string;
}

interface SetNextStepDueRequest extends BaseCommandRequest {
  action: 'set-next-step-due';
  nextStep: string;
  dueDate: string;
}

interface CompleteProcessRequest extends BaseCommandRequest {
  action: 'complete-process';
  terminalStageId: string;
  terminalStageName: string;
  outcome: 'won' | 'lost' | 'completed' | 'churned' | 'cancelled';
  notes?: string;
}

interface CompleteSaleStartOnboardingRequest extends BaseCommandRequest {
  action: 'complete-sale-start-onboarding';
  onboardingProcessId?: string;
  notes?: string;
}

interface CompleteOnboardingStartEngagementRequest extends BaseCommandRequest {
  action: 'complete-onboarding-start-engagement';
  engagementProcessId?: string;
  notes?: string;
}

type CommandRequest =
  | StartSaleRequest
  | AdvanceStageRequest
  | SetPhaseRequest
  | SetOwnerRequest
  | SetTierRequest
  | SetMRRRequest
  | SetSeatsRequest
  | SetNextStepDueRequest
  | CompleteProcessRequest
  | CompleteSaleStartOnboardingRequest
  | CompleteOnboardingStartEngagementRequest;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CommandRequest;

    // Validate required fields
    if (!body.action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    if (!body.companyProductId || !body.companyId || !body.productId) {
      return NextResponse.json(
        { error: 'Missing required fields: companyProductId, companyId, productId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build actor from request
    const actor = {
      type: body.actorType || ('user' as const),
      id: body.actorId,
    };

    // Execute command based on action
    let result;

    switch (body.action) {
      case 'start-sale': {
        const req = body as StartSaleRequest;
        if (!req.processId || !req.initialStageId || !req.initialStageName) {
          return NextResponse.json(
            { error: 'Missing required fields for start-sale' },
            { status: 400 }
          );
        }
        result = await startSale(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          processId: req.processId,
          processVersion: req.processVersion || 1,
          initialStageId: req.initialStageId,
          initialStageName: req.initialStageName,
          actor,
        });
        // startSale returns array
        if (Array.isArray(result)) {
          const failed = result.find((r) => !r.success);
          if (failed) {
            return NextResponse.json(
              { error: failed.error, results: result },
              { status: 400 }
            );
          }
        }
        break;
      }

      case 'advance-stage': {
        const req = body as AdvanceStageRequest;
        if (!req.toStageId || !req.toStageName || req.toStageOrder === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields for advance-stage' },
            { status: 400 }
          );
        }
        result = await advanceStage(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          toStageId: req.toStageId,
          toStageName: req.toStageName,
          toStageOrder: req.toStageOrder,
          reason: req.reason,
          actor,
        });
        break;
      }

      case 'set-phase': {
        const req = body as SetPhaseRequest;
        if (!req.toPhase) {
          return NextResponse.json(
            { error: 'Missing required field: toPhase' },
            { status: 400 }
          );
        }
        result = await setPhase(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          toPhase: req.toPhase,
          reason: req.reason,
          churnReason: req.churnReason,
          actor,
        });
        break;
      }

      case 'set-owner': {
        const req = body as SetOwnerRequest;
        if (!req.ownerId || !req.ownerName) {
          return NextResponse.json(
            { error: 'Missing required fields: ownerId, ownerName' },
            { status: 400 }
          );
        }
        result = await setOwner(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          ownerId: req.ownerId,
          ownerName: req.ownerName,
          reason: req.reason,
          actor,
        });
        break;
      }

      case 'set-tier': {
        const req = body as SetTierRequest;
        if (req.tier === undefined) {
          return NextResponse.json(
            { error: 'Missing required field: tier' },
            { status: 400 }
          );
        }
        result = await setTier(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          tier: req.tier,
          reason: req.reason,
          actor,
        });
        break;
      }

      case 'set-mrr': {
        const req = body as SetMRRRequest;
        if (req.mrr === undefined) {
          return NextResponse.json(
            { error: 'Missing required field: mrr' },
            { status: 400 }
          );
        }
        result = await setMRR(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          mrr: req.mrr,
          currency: req.currency,
          reason: req.reason,
          actor,
        });
        break;
      }

      case 'set-seats': {
        const req = body as SetSeatsRequest;
        if (req.seats === undefined) {
          return NextResponse.json(
            { error: 'Missing required field: seats' },
            { status: 400 }
          );
        }
        result = await setSeats(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          seats: req.seats,
          reason: req.reason,
          actor,
        });
        break;
      }

      case 'set-next-step-due': {
        const req = body as SetNextStepDueRequest;
        if (!req.nextStep || !req.dueDate) {
          return NextResponse.json(
            { error: 'Missing required fields: nextStep, dueDate' },
            { status: 400 }
          );
        }
        result = await setNextStepDue(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          nextStep: req.nextStep,
          dueDate: req.dueDate,
          actor,
        });
        break;
      }

      case 'complete-process': {
        const req = body as CompleteProcessRequest;
        if (!req.terminalStageId || !req.terminalStageName || !req.outcome) {
          return NextResponse.json(
            { error: 'Missing required fields: terminalStageId, terminalStageName, outcome' },
            { status: 400 }
          );
        }
        result = await completeProcess(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          terminalStageId: req.terminalStageId,
          terminalStageName: req.terminalStageName,
          outcome: req.outcome,
          notes: req.notes,
          actor,
        });
        break;
      }

      case 'complete-sale-start-onboarding': {
        const req = body as CompleteSaleStartOnboardingRequest;
        result = await completeSaleAndStartOnboarding(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          onboardingProcessId: req.onboardingProcessId,
          notes: req.notes,
          actor,
        });
        // Returns array of results
        if (Array.isArray(result)) {
          const failed = result.find((r) => !r.success);
          if (failed) {
            return NextResponse.json(
              { error: failed.error, results: result },
              { status: 400 }
            );
          }
        }
        break;
      }

      case 'complete-onboarding-start-engagement': {
        const req = body as CompleteOnboardingStartEngagementRequest;
        result = await completeOnboardingAndStartEngagement(supabase, {
          companyProductId: req.companyProductId,
          companyId: req.companyId,
          productId: req.productId,
          engagementProcessId: req.engagementProcessId,
          notes: req.notes,
          actor,
        });
        // Returns array of results
        if (Array.isArray(result)) {
          const failed = result.find((r) => !r.success);
          if (failed) {
            return NextResponse.json(
              { error: failed.error, results: result },
              { status: 400 }
            );
          }
        }
        break;
      }

      default: {
        // TypeScript exhaustiveness check - this should never be reached
        const _exhaustiveCheck: never = body;
        return NextResponse.json(
          { error: `Unknown action: ${(_exhaustiveCheck as BaseCommandRequest).action}` },
          { status: 400 }
        );
      }
    }

    // Check for command failure
    if (!Array.isArray(result) && !result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Run projectors to update read models
    const projectorResult = await runAllProjectors(supabase);

    return NextResponse.json({
      success: true,
      result: Array.isArray(result) ? result : [result],
      projection: {
        eventsProcessed: projectorResult.totalEventsProcessed,
        duration: projectorResult.totalDuration,
      },
    });
  } catch (error) {
    console.error('Lifecycle command error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
