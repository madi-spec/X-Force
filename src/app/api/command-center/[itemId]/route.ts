/**
 * Command Center Item API
 *
 * GET - Get single item
 * PATCH - Update item (complete, snooze, dismiss, start)
 * DELETE - Remove item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { UpdateItemRequest, ItemStatus } from '@/types/commandCenter';

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
// PATCH - Update item
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

    // Verify ownership
    const { data: existingItem } = await supabase
      .from('command_center_items')
      .select('id, status, snooze_count, skip_count, company_id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
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
