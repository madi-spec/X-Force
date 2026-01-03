/**
 * Individual Support Case API
 *
 * GET /api/cases/[id] - Get case details from projection
 * POST /api/cases/[id] - Execute command on case
 *
 * Supported commands:
 * - assign: Assign case to owner
 * - change_status: Change case status
 * - change_severity: Change case severity
 * - set_next_action: Set next action and due date
 * - resolve: Mark case as resolved
 * - close: Close the case
 * - reopen: Reopen a closed/resolved case
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assignSupportCase,
  changeSupportCaseStatus,
  changeSupportCaseSeverity,
  setSupportCaseNextAction,
  resolveSupportCase,
  closeSupportCase,
  reopenSupportCase,
} from '@/lib/supportCase/commands';
import type {
  SupportCaseStatus,
  SupportCaseSeverity,
} from '@/types/supportCase';
import type { CloseReason } from '@/lib/supportCase/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]
 *
 * Fetches a single case from the projection.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();

  // Fetch case from projection with related data
  const { data, error } = await supabase
    .from('support_case_read_model')
    .select(`
      *,
      company:companies!company_id (
        id,
        name,
        domain
      ),
      owner:users!owner_id (
        id,
        name,
        email
      )
    `)
    .eq('support_case_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    console.error('Failed to fetch case:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/cases/[id]
 *
 * Execute a command on the case.
 * Body must include: { command: 'assign' | 'change_status' | ... , ...params }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { command, ...params } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'command is required' },
        { status: 400 }
      );
    }

    // First, fetch the case to get company_id and company_product_id
    const { data: caseData, error: fetchError } = await supabase
      .from('support_case_read_model')
      .select('company_id, company_product_id')
      .eq('support_case_id', id)
      .single();

    if (fetchError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const baseParams = {
      supportCaseId: id,
      companyId: caseData.company_id,
      companyProductId: caseData.company_product_id,
      actor: { type: 'user' as const, id: user.id },
    };

    let result;

    switch (command) {
      case 'assign': {
        if (!params.owner_id || !params.owner_name) {
          return NextResponse.json(
            { error: 'owner_id and owner_name are required for assign' },
            { status: 400 }
          );
        }
        result = await assignSupportCase(supabase, {
          ...baseParams,
          ownerId: params.owner_id,
          ownerName: params.owner_name,
          team: params.team,
          reason: params.reason,
        });
        break;
      }

      case 'change_status': {
        if (!params.to_status) {
          return NextResponse.json(
            { error: 'to_status is required for change_status' },
            { status: 400 }
          );
        }
        result = await changeSupportCaseStatus(supabase, {
          ...baseParams,
          toStatus: params.to_status as SupportCaseStatus,
          reason: params.reason,
        });
        break;
      }

      case 'change_severity': {
        if (!params.to_severity) {
          return NextResponse.json(
            { error: 'to_severity is required for change_severity' },
            { status: 400 }
          );
        }
        result = await changeSupportCaseSeverity(supabase, {
          ...baseParams,
          toSeverity: params.to_severity as SupportCaseSeverity,
          reason: params.reason,
        });
        break;
      }

      case 'set_next_action': {
        if (!params.action || !params.due_at) {
          return NextResponse.json(
            { error: 'action and due_at are required for set_next_action' },
            { status: 400 }
          );
        }
        result = await setSupportCaseNextAction(supabase, {
          ...baseParams,
          action: params.action,
          dueAt: params.due_at,
          assignedToId: params.assigned_to_id,
          assignedToName: params.assigned_to_name,
        });
        break;
      }

      case 'resolve': {
        if (!params.resolution_summary) {
          return NextResponse.json(
            { error: 'resolution_summary is required for resolve' },
            { status: 400 }
          );
        }
        result = await resolveSupportCase(supabase, {
          ...baseParams,
          resolutionSummary: params.resolution_summary,
          rootCause: params.root_cause,
        });
        break;
      }

      case 'close': {
        if (!params.close_reason) {
          return NextResponse.json(
            { error: 'close_reason is required for close' },
            { status: 400 }
          );
        }
        result = await closeSupportCase(supabase, {
          ...baseParams,
          closeReason: params.close_reason as CloseReason,
          notes: params.notes,
          forceClose: params.force_close ?? false,
        });
        break;
      }

      case 'reopen': {
        if (!params.reason) {
          return NextResponse.json(
            { error: 'reason is required for reopen' },
            { status: 400 }
          );
        }
        result = await reopenSupportCase(supabase, {
          ...baseParams,
          reason: params.reason,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown command: ${command}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Command failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      sequenceNumber: result.sequenceNumber,
    });
  } catch (err) {
    console.error('Failed to execute case command:', err);
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
