/**
 * Command Center Item API - Unified
 *
 * Handles actions on items from multiple source tables:
 * - comm-{id}: Communications (needsReply)
 * - af-{id}: Attention Flags (needsHuman, stalled)
 * - cp-{id}: Company Products (readyToClose)
 * - {uuid}: Legacy command_center_items
 *
 * GET - Get single item
 * PATCH - Update item (complete, snooze, dismiss, start)
 * DELETE - Remove item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { UpdateItemRequest, ItemStatus, WorkflowStep } from '@/types/commandCenter';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';

// Helper to parse item ID and determine source table
interface ParsedItemId {
  sourceTable: 'communication' | 'attention_flag' | 'company_product' | 'command_center_items';
  actualId: string;
}

function parseItemId(itemId: string): ParsedItemId {
  if (itemId.startsWith('comm-')) {
    return { sourceTable: 'communication', actualId: itemId.slice(5) };
  }
  if (itemId.startsWith('af-')) {
    return { sourceTable: 'attention_flag', actualId: itemId.slice(3) };
  }
  if (itemId.startsWith('cp-')) {
    return { sourceTable: 'company_product', actualId: itemId.slice(3) };
  }
  // Legacy UUID format - command_center_items table
  return { sourceTable: 'command_center_items', actualId: itemId };
}

// Helper to get internal user ID from auth user
async function getInternalUserId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUserId)
    .single();
  return dbUser?.id || null;
}

// Helper to tag email in Outlook when command center action is taken
async function tagEmailInOutlook(
  supabase: ReturnType<typeof createAdminClient>,
  item: {
    source?: string;
    source_id?: string | null;
    conversation_id?: string | null;
    company_id?: string | null;
    contact_id?: string | null;
    email_id?: string | null;
  }
): Promise<void> {
  try {
    // Only process email-related items
    const emailSources = ['email_inbound', 'email_sync', 'email_ai_analysis', 'needs_reply'];
    if (!item.source || !emailSources.includes(item.source)) {
      return;
    }

    // Try to find the communication with external_id
    let externalId: string | null = null;

    // First try source_id or email_id as email_messages ID
    // Communications link to email_messages via source_table='email_messages' and source_id
    const emailMessageId = item.email_id || item.source_id;
    if (emailMessageId) {
      const { data: comm } = await supabase
        .from('communications')
        .select('external_id')
        .eq('source_table', 'email_messages')
        .eq('source_id', emailMessageId)
        .single();

      if (comm?.external_id) {
        externalId = comm.external_id;
        console.log('[CommandCenter/Item] Found external_id via email_messages link');
      }
    }

    // Also try source_id as direct communication ID (for newer items)
    if (!externalId && item.source_id) {
      const { data: comm } = await supabase
        .from('communications')
        .select('external_id')
        .eq('id', item.source_id)
        .single();

      if (comm?.external_id) {
        externalId = comm.external_id;
      }
    }

    // If not found, try conversation_id
    if (!externalId && item.conversation_id) {
      const { data: comm } = await supabase
        .from('communications')
        .select('external_id')
        .eq('id', item.conversation_id)
        .single();

      if (comm?.external_id) {
        externalId = comm.external_id;
      }
    }

    // Fallback: find most recent inbound communication by contact_id or company_id
    if (!externalId && (item.contact_id || item.company_id)) {
      let query = supabase
        .from('communications')
        .select('external_id')
        .eq('direction', 'inbound')
        .not('external_id', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(1);

      if (item.contact_id) {
        query = query.eq('contact_id', item.contact_id);
      } else if (item.company_id) {
        query = query.eq('company_id', item.company_id);
      }

      const { data: comm } = await query.single();
      if (comm?.external_id) {
        externalId = comm.external_id;
        console.log('[CommandCenter/Item] Found external_id via fallback lookup');
      }
    }

    if (!externalId) {
      console.log('[CommandCenter/Item] No external_id found for email tagging');
      return;
    }

    // Get active Microsoft connection
    const { data: msConnection } = await supabase
      .from('microsoft_connections')
      .select('user_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!msConnection) {
      console.log('[CommandCenter/Item] No active Microsoft connection for email tagging');
      return;
    }

    // Get token and add category
    const token = await getValidToken(msConnection.user_id);
    if (!token) {
      console.log('[CommandCenter/Item] No valid token for email tagging');
      return;
    }

    const graphClient = new MicrosoftGraphClient(token);
    await graphClient.addCategoryToMessage(externalId, 'X-FORCE');
    console.log('[CommandCenter/Item] Added X-FORCE category to email:', externalId);
  } catch (error) {
    // Non-critical, just log
    console.warn('[CommandCenter/Item] Error tagging email in Outlook:', error);
  }
}

// ============================================
// GET - Get single item
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { itemId } = await params;
    const supabase = createAdminClient();

    const { data: item, error } = await supabase
      .from('command_center_items')
      .select(`
        *,
        deal:deals(id, name, stage, estimated_value),
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('[CommandCenter/Item] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH - Update item (handles multiple source tables)
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { itemId } = await params;
    const body: UpdateItemRequest = await request.json();
    const supabase = createAdminClient();

    // Parse item ID to determine source table
    const { sourceTable, actualId } = parseItemId(itemId);

    // ============================================
    // Handle unified items from source tables
    // ============================================
    if (sourceTable === 'communication') {
      // Communication item - update the source communication
      if (body.status === 'completed' || body.status === 'dismissed') {
        // Mark as responded
        const { error } = await supabase
          .from('communications')
          .update({
            responded_at: new Date().toISOString(),
            awaiting_our_response: false,
          })
          .eq('id', actualId);

        if (error) {
          console.error('[CommandCenter/Item] Communication update error:', error);
          return NextResponse.json({ error: 'Failed to update communication' }, { status: 500 });
        }

        // Tag email in Outlook
        const { data: comm } = await supabase
          .from('communications')
          .select('external_id, company_id, contact_id')
          .eq('id', actualId)
          .single();

        if (comm) {
          await tagEmailInOutlook(supabase, {
            source: 'communication',
            source_id: actualId,
            company_id: comm.company_id,
            contact_id: comm.contact_id,
          });
        }

        return NextResponse.json({
          success: true,
          item: { id: itemId, status: 'completed' },
          message: 'Communication marked as responded',
        });
      }

      // Snooze is not applicable to communications
      return NextResponse.json({ error: 'Invalid action for communication' }, { status: 400 });
    }

    if (sourceTable === 'attention_flag') {
      // Attention flag item
      if (body.status === 'completed' || body.status === 'dismissed') {
        // Resolve the flag
        const { error } = await supabase
          .from('attention_flags')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by: userId,
            resolution_notes: body.dismissed_reason || 'Resolved via Command Center',
          })
          .eq('id', actualId);

        if (error) {
          console.error('[CommandCenter/Item] Attention flag resolve error:', error);
          return NextResponse.json({ error: 'Failed to resolve flag' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          item: { id: itemId, status: 'completed' },
          message: 'Flag resolved',
        });
      }

      if (body.status === 'snoozed') {
        // Snooze the flag
        let snoozedUntil = body.snoozed_until;
        if (!snoozedUntil) {
          // Default snooze: 1 hour
          const snoozeDate = new Date();
          snoozeDate.setHours(snoozeDate.getHours() + 1);
          snoozedUntil = snoozeDate.toISOString();
        }

        const { error } = await supabase
          .from('attention_flags')
          .update({
            snoozed_until: snoozedUntil,
          })
          .eq('id', actualId);

        if (error) {
          console.error('[CommandCenter/Item] Attention flag snooze error:', error);
          return NextResponse.json({ error: 'Failed to snooze flag' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          item: { id: itemId, status: 'snoozed', snoozed_until: snoozedUntil },
          message: 'Flag snoozed',
        });
      }

      return NextResponse.json({ error: 'Invalid action for attention flag' }, { status: 400 });
    }

    if (sourceTable === 'company_product') {
      // Company product item - close actions
      if (body.status === 'completed') {
        // Could update company_product status or create a deal closed activity
        // For now, just return success - the actual close flow is handled elsewhere
        return NextResponse.json({
          success: true,
          item: { id: itemId, status: 'completed' },
          message: 'Close action acknowledged',
        });
      }

      return NextResponse.json({ error: 'Invalid action for company product' }, { status: 400 });
    }

    // ============================================
    // Legacy: Handle command_center_items table
    // ============================================
    // Verify ownership
    const { data: existingItem } = await supabase
      .from('command_center_items')
      .select('id, status, snooze_count, skip_count, company_id, contact_id, email_id, workflow_steps, source, source_id, conversation_id')
      .eq('id', actualId)
      .eq('user_id', userId)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Handle step completion (for workflow cards)
    const completeStepId = (body as { complete_step_id?: string }).complete_step_id;
    if (completeStepId) {
      const workflowSteps = existingItem.workflow_steps as WorkflowStep[] | null;
      if (!workflowSteps || workflowSteps.length === 0) {
        return NextResponse.json({ error: 'Item has no workflow steps' }, { status: 400 });
      }

      const stepIndex = workflowSteps.findIndex(s => s.id === completeStepId);
      if (stepIndex === -1) {
        return NextResponse.json({ error: 'Step not found' }, { status: 404 });
      }

      // Mark step as complete
      workflowSteps[stepIndex].completed = true;
      workflowSteps[stepIndex].completed_at = new Date().toISOString();

      // Check if all steps are completed
      const allStepsCompleted = workflowSteps.every(s => s.completed);

      const stepUpdateData: Record<string, unknown> = {
        workflow_steps: workflowSteps,
        updated_at: new Date().toISOString(),
      };

      // Auto-complete the card if all steps are done
      if (allStepsCompleted) {
        stepUpdateData.status = 'completed';
        stepUpdateData.completed_at = new Date().toISOString();
        stepUpdateData.completed_reason = 'All workflow steps completed';
      }

      const { data: updatedItem, error: stepError } = await supabase
        .from('command_center_items')
        .update(stepUpdateData)
        .eq('id', itemId)
        .select()
        .single();

      if (stepError) {
        console.error('[CommandCenter/Item] Step completion error:', stepError);
        return NextResponse.json({ error: 'Failed to complete step' }, { status: 500 });
      }

      // Log activity if card was auto-completed
      if (allStepsCompleted) {
        await logItemCompletion(supabase, userId, updatedItem);
        // Also tag email in Outlook
        await tagEmailInOutlook(supabase, existingItem);
      }

      return NextResponse.json({
        success: true,
        item: updatedItem,
        step_completed: completeStepId,
        all_steps_completed: allStepsCompleted,
      });
    }

    // Build update object based on status change
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) {
      updateData.status = body.status;

      switch (body.status) {
        case 'completed':
          updateData.completed_at = new Date().toISOString();
          break;

        case 'in_progress':
          updateData.started_at = new Date().toISOString();
          break;

        case 'snoozed':
          if (!body.snoozed_until) {
            // Default snooze: 1 hour
            const snoozeUntil = new Date();
            snoozeUntil.setHours(snoozeUntil.getHours() + 1);
            updateData.snoozed_until = snoozeUntil.toISOString();
          } else {
            updateData.snoozed_until = body.snoozed_until;
          }
          updateData.snooze_count = (existingItem.snooze_count || 0) + 1;
          updateData.last_snoozed_at = new Date().toISOString();
          break;

        case 'dismissed':
          updateData.dismissed_at = new Date().toISOString();
          updateData.dismissed_reason = body.dismissed_reason || 'User dismissed';
          break;

        case 'pending':
          // Un-snooze or reset
          updateData.snoozed_until = null;
          break;
      }
    }

    // Handle skip (without changing status)
    if (body.status === undefined && (body as { skip?: boolean }).skip) {
      updateData.skip_count = (existingItem.skip_count || 0) + 1;
      updateData.last_skipped_at = new Date().toISOString();
    }

    // Handle deal linking
    if ((body as { deal_id?: string }).deal_id !== undefined) {
      const dealId = (body as { deal_id?: string }).deal_id;
      updateData.deal_id = dealId;

      // Also fetch and update deal-related fields
      if (dealId) {
        const { data: deal } = await supabase
          .from('deals')
          .select('estimated_value, probability, stage, company_id, companies(name)')
          .eq('id', dealId)
          .single();

        if (deal) {
          updateData.deal_value = deal.estimated_value;
          updateData.deal_probability = deal.probability;
          updateData.deal_stage = deal.stage;
          // Also link company if not already set
          if (!existingItem.company_id && deal.company_id) {
            updateData.company_id = deal.company_id;
            const companies = deal.companies;
            if (companies) {
              if (Array.isArray(companies) && companies.length > 0) {
                updateData.company_name = companies[0].name;
              } else if (typeof companies === 'object' && 'name' in companies) {
                updateData.company_name = (companies as { name: string }).name;
              }
            }
          }
        }
      }
    }

    // Handle company linking
    if ((body as { company_id?: string }).company_id !== undefined) {
      const companyId = (body as { company_id?: string }).company_id;
      updateData.company_id = companyId;

      // Also fetch and update company name
      if (companyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single();

        if (company) {
          updateData.company_name = company.name;
        }
      }
    }

    const { data: updatedItem, error } = await supabase
      .from('command_center_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('[CommandCenter/Item] Update error:', error);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    // Log activity for completed items
    if (body.status === 'completed') {
      await logItemCompletion(supabase, userId, updatedItem);
    }

    // Tag email in Outlook when action is taken (completed, snoozed, or dismissed)
    const statusesToTag: ItemStatus[] = ['completed', 'snoozed', 'dismissed'];
    if (body.status && statusesToTag.includes(body.status)) {
      await tagEmailInOutlook(supabase, existingItem);
    }

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('[CommandCenter/Item] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE - Remove item
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getInternalUserId(authUser.id);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { itemId } = await params;
    const supabase = createAdminClient();

    // Verify ownership before delete
    const { data: existingItem } = await supabase
      .from('command_center_items')
      .select('id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('command_center_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[CommandCenter/Item] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: itemId });
  } catch (error) {
    console.error('[CommandCenter/Item] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// HELPERS
// ============================================

async function logItemCompletion(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  item: Record<string, unknown>
) {
  try {
    // Log to activities table if it exists
    await supabase.from('activities').insert({
      user_id: userId,
      activity_type: 'command_center_complete',
      subject_type: 'command_center_item',
      subject_id: item.id as string,
      deal_id: item.deal_id || null,
      company_id: item.company_id || null,
      contact_id: item.contact_id || null,
      metadata: {
        action_type: item.action_type,
        title: item.title,
        momentum_score: item.momentum_score,
        estimated_minutes: item.estimated_minutes,
      },
    });

    // Update daily plan completion count
    const today = new Date().toISOString().split('T')[0];
    await supabase.rpc('increment_daily_plan_completion', {
      p_user_id: userId,
      p_plan_date: today,
      p_completed_value: (item.deal_value as number) || 0,
    });
  } catch (error) {
    // Non-critical, just log
    console.error('[CommandCenter/Item] Activity logging error:', error);
  }
}
