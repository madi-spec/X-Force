/**
 * Command Center API
 *
 * GET - Get today's plan with items sorted by momentum
 * POST - Manually create a new item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyPlan,
  generateDailyPlan,
  calculateMomentumScore,
  getDuration,
  getRepTimeProfile,
  getCurrentBlockIndex,
  findDealForCompany,
  generateWhyNow,
  enrichItem,
} from '@/lib/commandCenter';
import {
  CommandCenterItem,
  CreateItemRequest,
  GetDailyPlanResponse,
} from '@/types/commandCenter';

// ============================================
// GET - Today's plan with items
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;

    // Get user's timezone from profile to calculate correct local date
    const profile = await getRepTimeProfile(userId);
    const timezone = profile.timezone || 'America/New_York';

    // Check for date parameter (supports 'tomorrow' or YYYY-MM-DD)
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Get current date in user's timezone using Intl.DateTimeFormat
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now); // Returns YYYY-MM-DD format

    // Parse the date parts
    let [year, month, day] = todayStr.split('-').map(Number);

    // Handle date parameter
    if (dateParam === 'tomorrow') {
      // Find the next work day, not just tomorrow
      const workDays = profile.work_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Create date for iteration (use noon to avoid DST issues)
      let targetDate = new Date(year, month - 1, day, 12, 0, 0);
      let daysChecked = 0;

      do {
        targetDate.setDate(targetDate.getDate() + 1);
        daysChecked++;
        const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayName = dayNames[dayOfWeek];
        if (workDays.includes(dayName)) {
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      } while (daysChecked < 7); // Safety limit
    } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      [year, month, day] = dateParam.split('-').map(Number);
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Create userLocalDate for day-of-week checks later
    const userLocalDate = new Date(year, month - 1, day, 12, 0, 0);


    // Check if it's a work day
    const dayName = userLocalDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
    const isWorkDay = profile.work_days?.includes(dayName) ?? true;

    // Always regenerate daily plan to get fresh calendar data with correct timezone
    let plan: Awaited<ReturnType<typeof getDailyPlan>> = null;
    try {
      plan = await generateDailyPlan(userId, userLocalDate);
    } catch (planError) {
      console.error('[CommandCenter] Error generating plan:', planError);
      // Fall back to cached plan if generation fails
      plan = await getDailyPlan(userId, userLocalDate);

      // If still no plan, create empty structure
      if (!plan) {
        plan = {
          id: '',
          user_id: userId,
          plan_date: dateStr,
          total_work_minutes: 480,
          meeting_minutes: 0,
          prep_buffer_minutes: 0,
          reactive_buffer_minutes: 60,
          available_minutes: 420,
          planned_minutes: 0,
          time_blocks: [],
          planned_item_ids: [],
          total_potential_value: 0,
          completed_value: 0,
          items_planned: 0,
          items_completed: 0,
          completion_rate: 0,
          generated_at: new Date().toISOString(),
        } as unknown as typeof plan;
      }
    }

    // Get all items for today
    const { data: items, error: itemsError } = await supabase
      .from('command_center_items')
      .select(`
        *,
        deal:deals(id, name, stage, estimated_value),
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('momentum_score', { ascending: false });

    if (itemsError) {
      console.error('[CommandCenter] Error fetching items:', itemsError);
      return NextResponse.json({
        error: 'Failed to fetch items',
        details: itemsError.message,
        code: itemsError.code
      }, { status: 500 });
    }

    let allItems = (items || []) as CommandCenterItem[];

    // Recalculate scores for items with 0 momentum (on-demand scoring)
    const itemsNeedingScores = allItems.filter(item => item.momentum_score === 0);
    if (itemsNeedingScores.length > 0) {
      console.log(`[CommandCenter] Recalculating scores for ${itemsNeedingScores.length} items`);

      for (const item of itemsNeedingScores) {
        const scoreResult = calculateMomentumScore({
          action_type: item.action_type,
          due_at: item.due_at,
          deal_value: item.deal_value,
          deal_probability: item.deal_probability,
          deal_id: item.deal_id,
          company_id: item.company_id,
        });

        // Update the item in database
        await supabase
          .from('command_center_items')
          .update({
            momentum_score: scoreResult.score,
            score_factors: scoreResult.factors,
            score_explanation: scoreResult.explanation,
            base_priority: scoreResult.factors.base?.value || 0,
            time_pressure: scoreResult.factors.time?.value || 0,
            value_score: scoreResult.factors.value?.value || 0,
            engagement_score: scoreResult.factors.engagement?.value || 0,
          })
          .eq('id', item.id);

        // Update local item
        item.momentum_score = scoreResult.score;
        item.score_factors = scoreResult.factors;
        item.score_explanation = scoreResult.explanation;
      }

      // Re-sort items by momentum score with secondary criteria
      allItems = allItems.sort((a, b) => {
        // Primary: momentum score (descending)
        const scoreDiff = (b.momentum_score || 0) - (a.momentum_score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        // Secondary: deal value (descending) - higher value items first
        const valueDiff = (b.deal_value || 0) - (a.deal_value || 0);
        if (valueDiff !== 0) return valueDiff;

        // Tertiary: due date (ascending) - items due sooner first
        if (a.due_at && b.due_at) {
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        }
        if (a.due_at) return -1; // Items with due dates come first
        if (b.due_at) return 1;

        return 0;
      });
    }

    // Enrich top items that are missing context (limit to top 5 for performance)
    const itemsNeedingEnrichment = allItems
      .slice(0, 5)
      .filter(item => !item.context_brief);

    if (itemsNeedingEnrichment.length > 0) {
      console.log(`[CommandCenter] Enriching ${itemsNeedingEnrichment.length} items with AI context`);

      // Enrich items in parallel for speed
      const enrichmentPromises = itemsNeedingEnrichment.map(async (item) => {
        try {
          const enrichment = await enrichItem(userId, item as CommandCenterItem);

          // Update the item in database
          await supabase
            .from('command_center_items')
            .update({
              context_brief: enrichment.context_summary,
            })
            .eq('id', item.id);

          // Update local item
          item.context_brief = enrichment.context_summary;
        } catch (err) {
          console.error(`[CommandCenter] Failed to enrich item ${item.id}:`, err);
        }
      });

      await Promise.all(enrichmentPromises);
    }

    // Find current time block
    const timeBlocks = plan?.time_blocks || [];
    const currentBlockIndex = getCurrentBlockIndex(timeBlocks);

    // Categorize items
    const currentItem = allItems[0] || null;
    const nextItems = allItems.slice(1, 6); // Next 5 items

    // At-risk items: high momentum, due soon
    const atRiskItems = allItems.filter((item) => {
      if (!item.due_at) return false;
      const hoursUntilDue = (new Date(item.due_at).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilDue <= 4 && hoursUntilDue > 0 && item.momentum_score >= 60;
    });

    // Count overflow (items that won't fit in available time)
    const plannedIds = plan?.planned_item_ids || [];
    const overflowCount = Math.max(0, allItems.length - plannedIds.length);

    // Count calendar events from time blocks
    const calendarEventsCount = timeBlocks.filter(b => b.type === 'meeting').length;

    const response: GetDailyPlanResponse = {
      success: true,
      plan: plan!,
      items: allItems,
      current_item: currentItem,
      next_items: nextItems,
      at_risk_items: atRiskItems,
      overflow_count: overflowCount,
      is_work_day: isWorkDay,
      debug: {
        server_time: now.toISOString(),
        queried_date: dateStr,
        day_name: dayName,
        is_work_day: isWorkDay,
        user_timezone: timezone,
        calendar_events_count: calendarEventsCount,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[CommandCenter] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST - Create new item
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateItemRequest = await request.json();

    // Validate required fields
    if (!body.action_type || !body.title) {
      return NextResponse.json(
        { error: 'action_type and title are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;

    // Get rep profile for duration calculation
    const profile = await getRepTimeProfile(userId);

    // Calculate duration
    const estimatedMinutes =
      body.estimated_minutes || getDuration(body.action_type, profile.action_durations);

    // Get deal info if provided
    let dealValue: number | null = null;
    let dealProbability: number | null = null;
    let dealStage: string | null = null;
    let companyId: string | null = body.company_id || null;
    let companyName: string | null = null;
    let resolvedDealId: string | null = body.deal_id || null;

    if (body.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('estimated_value, probability, stage, company_id, companies(name)')
        .eq('id', body.deal_id)
        .single();

      if (deal) {
        dealValue = deal.estimated_value;
        dealProbability = deal.probability;
        dealStage = deal.stage;
        companyId = deal.company_id;
        // Handle companies relation (could be object or array depending on join)
        const companies = deal.companies;
        if (companies) {
          if (Array.isArray(companies) && companies.length > 0) {
            companyName = companies[0].name || null;
          } else if (typeof companies === 'object' && 'name' in companies) {
            companyName = (companies as { name: string }).name || null;
          }
        }
      }
    } else if (body.company_id) {
      // No deal_id provided but we have company_id - try to find active deal
      const companyDeal = await findDealForCompany(body.company_id);
      if (companyDeal) {
        resolvedDealId = companyDeal.id;
        dealValue = companyDeal.estimated_value;
        dealProbability = companyDeal.probability;
        dealStage = companyDeal.stage;
      }

      // Get company name
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', body.company_id)
        .single();

      if (company) {
        companyName = company.name;
      }
    }

    // Get contact name if provided
    let targetName: string | null = null;
    if (body.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', body.contact_id)
        .single();

      if (contact) {
        targetName = contact.name;
      }
    }

    // Calculate momentum score with resolved deal values
    const scoreResult = calculateMomentumScore({
      action_type: body.action_type,
      due_at: body.due_at || null,
      deal_value: dealValue,
      deal_probability: dealProbability,
      deal_id: resolvedDealId,
      company_id: companyId,
    });

    // Generate why_now text
    const whyNow = generateWhyNow({
      action_type: body.action_type,
      due_at: body.due_at,
      deal_value: dealValue,
      deal_stage: dealStage,
    });

    // Build item
    const itemData = {
      user_id: userId,
      action_type: body.action_type,
      title: body.title,
      description: body.description || null,
      deal_id: resolvedDealId,
      company_id: companyId,
      contact_id: body.contact_id || null,
      deal_value: dealValue,
      deal_probability: dealProbability,
      deal_stage: dealStage,
      company_name: companyName,
      target_name: targetName,
      due_at: body.due_at || null,
      estimated_minutes: estimatedMinutes,
      momentum_score: scoreResult.score,
      score_factors: scoreResult.factors,
      score_explanation: scoreResult.explanation,
      base_priority: scoreResult.factors.base?.value || 0,
      time_pressure: scoreResult.factors.time?.value || 0,
      value_score: scoreResult.factors.value?.value || 0,
      engagement_score: scoreResult.factors.engagement?.value || 0,
      risk_score: scoreResult.factors.risk?.value || 0,
      why_now: whyNow,
      source: 'manual' as const,
      status: 'pending' as const,
      primary_action_label: 'Start',
    };

    const { data: newItem, error } = await supabase
      .from('command_center_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      console.error('[CommandCenter] Error creating item:', error);
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    console.error('[CommandCenter] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
