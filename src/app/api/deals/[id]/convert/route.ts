/**
 * POST /api/deals/[id]/convert
 *
 * Converts a legacy deal into the new product-centric company_products system.
 *
 * Input:
 * {
 *   products: [
 *     { product_id: uuid, stage_id?: uuid }
 *   ]
 * }
 *
 * Logic:
 * A) Load legacy deal + linked data (activities, communications, meetings)
 * B) Compute first_activity_at and last_activity_at
 * C) Create company_products for each selected product
 * D) Mark legacy deal as CONVERTED (terminal)
 * E) Return conversion details
 *
 * Idempotency: Converting same deal twice does not duplicate records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ProductSelection {
  product_id: string;
  stage_id?: string;
}

interface ConvertRequestBody {
  products: ProductSelection[];
}

interface ConvertedProduct {
  product_id: string;
  product_name: string;
  company_product_id: string;
  stage_name: string | null;
  created: boolean; // true if newly created, false if already existed
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
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
      .select('id, name')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body: ConvertRequestBody = await request.json();

    if (!body.products || body.products.length === 0) {
      return NextResponse.json(
        { error: 'At least one product must be selected' },
        { status: 400 }
      );
    }

    // =========================================
    // A) Load legacy deal + linked data
    // =========================================
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Check if already converted (idempotency)
    const { data: existingConversions } = await supabase
      .from('deal_conversions')
      .select('*, company_product:company_products(id, product_id), product:products(name)')
      .eq('legacy_deal_id', dealId);

    const alreadyConvertedProductIds = new Set(
      (existingConversions || []).map((c) => c.product_id)
    );

    // If all requested products are already converted, return existing data
    const newProducts = body.products.filter(
      (p) => !alreadyConvertedProductIds.has(p.product_id)
    );

    if (newProducts.length === 0 && existingConversions && existingConversions.length > 0) {
      // Already fully converted - return existing mapping
      const firstConversion = existingConversions[0];
      return NextResponse.json({
        success: true,
        deal_id: dealId,
        converted: true,
        already_converted: true,
        first_activity_at: firstConversion.first_activity_at,
        last_activity_at: firstConversion.last_activity_at,
        company_product_ids: existingConversions.map((c) => c.company_product_id),
        products: existingConversions.map((c) => ({
          product_id: c.product_id,
          product_name: (c.product as { name: string } | null)?.name || 'Unknown',
          company_product_id: c.company_product_id,
          created: false,
        })),
        legacy_deal_status: {
          status: deal.stage,
          conversion_status: 'converted',
          converted_at: firstConversion.converted_at,
        },
      });
    }

    // Get linked activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, occurred_at, created_at')
      .eq('deal_id', dealId);

    // Get linked communications (by company_id since deal_id may not be set)
    const { data: communications } = await supabase
      .from('communications')
      .select('id, occurred_at, created_at')
      .eq('company_id', deal.company_id);

    // Get linked meetings
    const { data: meetings } = await supabase
      .from('meeting_transcriptions')
      .select('id, meeting_date, created_at')
      .or(`deal_id.eq.${dealId},company_id.eq.${deal.company_id}`);

    // =========================================
    // B) Compute first_activity_at and last_activity_at
    // =========================================
    const allDates: Date[] = [];

    // Activities
    (activities || []).forEach((a) => {
      if (a.occurred_at) allDates.push(new Date(a.occurred_at));
      else if (a.created_at) allDates.push(new Date(a.created_at));
    });

    // Communications
    (communications || []).forEach((c) => {
      if (c.occurred_at) allDates.push(new Date(c.occurred_at));
      else if (c.created_at) allDates.push(new Date(c.created_at));
    });

    // Meetings
    (meetings || []).forEach((m) => {
      if (m.meeting_date) allDates.push(new Date(m.meeting_date));
      else if (m.created_at) allDates.push(new Date(m.created_at));
    });

    // Fallback to deal.created_at if no activities
    if (allDates.length === 0 && deal.created_at) {
      allDates.push(new Date(deal.created_at));
    }

    const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
    const firstActivityAt = sortedDates.length > 0 ? sortedDates[0].toISOString() : deal.created_at;
    const lastActivityAt = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].toISOString() : deal.created_at;

    const activitiesCount = activities?.length || 0;
    const communicationsCount = communications?.length || 0;
    const meetingsCount = meetings?.length || 0;

    // =========================================
    // C) Create company_products for each selected product
    // =========================================
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const convertedProducts: ConvertedProduct[] = [];
    const newCompanyProductIds: string[] = [];

    // Include already-converted products in the response
    for (const existing of existingConversions || []) {
      convertedProducts.push({
        product_id: existing.product_id,
        product_name: (existing.product as { name: string } | null)?.name || 'Unknown',
        company_product_id: existing.company_product_id,
        stage_name: null,
        created: false,
      });
      newCompanyProductIds.push(existing.company_product_id);
    }

    for (const selection of newProducts) {
      // Get product details
      const { data: product } = await supabase
        .from('products')
        .select('id, name, slug')
        .eq('id', selection.product_id)
        .single();

      if (!product) {
        console.warn(`[ConvertDeal] Product not found: ${selection.product_id}`);
        continue;
      }

      // Get stage (provided or first stage for product)
      let stageId = selection.stage_id;
      let stageName: string | null = null;

      if (stageId) {
        const { data: stage } = await supabase
          .from('product_process_stages')
          .select('id, name')
          .eq('id', stageId)
          .single();
        stageName = stage?.name || null;
      } else {
        // Get the sales process for this product first
        const { data: salesProcess } = await supabase
          .from('product_processes')
          .select('id')
          .eq('product_id', selection.product_id)
          .eq('process_type', 'sales')
          .eq('status', 'published')
          .single();

        if (salesProcess) {
          const { data: firstStage } = await supabase
            .from('product_process_stages')
            .select('id, name')
            .eq('process_id', salesProcess.id)
            .order('stage_order', { ascending: true })
            .limit(1)
            .single();
          stageId = firstStage?.id || null;
          stageName = firstStage?.name || null;
        }
      }

      // Check if company_product already exists (idempotency)
      const { data: existingCP } = await supabase
        .from('company_products')
        .select('id')
        .eq('company_id', deal.company_id)
        .eq('product_id', selection.product_id)
        .single();

      let companyProductId: string;
      let wasCreated = false;

      if (existingCP) {
        // Update existing company_product
        companyProductId = existingCP.id;

        // Build update object - converted_from_deal_id may not exist yet
        const updateData: Record<string, unknown> = {
          current_stage_id: stageId,
          stage_entered_at: now.toISOString(),
          last_stage_moved_at: now.toISOString(),
          sales_started_at: firstActivityAt, // IMPORTANT: Use first activity date
          last_human_touch_at: lastActivityAt,
          next_step_due_at: threeDaysFromNow.toISOString(),
          status: 'in_sales',
          updated_at: now.toISOString(),
        };

        // Try with converted_from_deal_id first, fall back without it
        const { error: updateError } = await supabase
          .from('company_products')
          .update({ ...updateData, converted_from_deal_id: dealId })
          .eq('id', existingCP.id);

        if (updateError?.message?.includes('converted_from_deal_id')) {
          await supabase
            .from('company_products')
            .update(updateData)
            .eq('id', existingCP.id);
        }
      } else {
        // Create new company_product
        // Build insert object - converted_from_deal_id may not exist yet
        const insertData: Record<string, unknown> = {
          company_id: deal.company_id,
          product_id: selection.product_id,
          status: 'in_sales',
          current_stage_id: stageId,
          stage_entered_at: now.toISOString(),
          last_stage_moved_at: now.toISOString(),
          sales_started_at: firstActivityAt, // IMPORTANT: Use first activity date
          last_human_touch_at: lastActivityAt,
          next_step_due_at: threeDaysFromNow.toISOString(),
          owner_user_id: deal.owner_id || dbUser.id,
          mrr: deal.estimated_value || null,
          close_confidence: deal.health_score || 50,
          close_ready: false,
        };

        // Try with converted_from_deal_id first
        let newCP;
        let insertError;

        ({ data: newCP, error: insertError } = await supabase
          .from('company_products')
          .insert({ ...insertData, converted_from_deal_id: dealId })
          .select('id')
          .single());

        // Retry without converted_from_deal_id if column doesn't exist
        if (insertError?.message?.includes('converted_from_deal_id')) {
          ({ data: newCP, error: insertError } = await supabase
            .from('company_products')
            .insert(insertData)
            .select('id')
            .single());
        }

        if (insertError || !newCP) {
          console.error(`[ConvertDeal] Failed to create company_product:`, insertError);
          continue;
        }

        companyProductId = newCP.id;
        wasCreated = true;
      }

      // Record the conversion mapping
      await supabase
        .from('deal_conversions')
        .upsert({
          legacy_deal_id: dealId,
          company_product_id: companyProductId,
          product_id: selection.product_id,
          converted_at: now.toISOString(),
          converted_by: dbUser.id,
          first_activity_at: firstActivityAt,
          last_activity_at: lastActivityAt,
          activities_count: activitiesCount,
          communications_count: communicationsCount,
          meetings_count: meetingsCount,
          notes: `Converted from legacy deal "${deal.name}"`,
        }, {
          onConflict: 'legacy_deal_id,product_id',
        });

      convertedProducts.push({
        product_id: selection.product_id,
        product_name: product.name,
        company_product_id: companyProductId,
        stage_name: stageName,
        created: wasCreated,
      });

      newCompanyProductIds.push(companyProductId);
    }

    // =========================================
    // D) Mark legacy deal as CONVERTED (terminal)
    // =========================================
    const productNames = convertedProducts.map((p) => p.product_name).join(', ');
    const conversionNote = `Converted on ${now.toLocaleDateString()}. Created ${convertedProducts.filter(p => p.created).length} new product deals: ${productNames}. First activity: ${new Date(firstActivityAt).toLocaleDateString()}. Last activity: ${new Date(lastActivityAt).toLocaleDateString()}. Activities: ${activitiesCount}, Communications: ${communicationsCount}, Meetings: ${meetingsCount}.`;

    // Update deal to terminal state
    // Try to update with conversion columns if they exist, otherwise just update stage
    const dealUpdate: Record<string, unknown> = {
      stage: 'closed_converted', // Terminal state - converted to new product pipeline
      closed_at: now.toISOString(),
      lost_reason: conversionNote,
      updated_at: now.toISOString(),
    };

    // Try to set conversion-specific columns (may not exist yet)
    try {
      await supabase
        .from('deals')
        .update({
          ...dealUpdate,
          converted_at: now.toISOString(),
          converted_by: dbUser.id,
          conversion_status: 'converted',
          converted_to_company_product_ids: newCompanyProductIds,
        })
        .eq('id', dealId);
    } catch {
      // Fallback if columns don't exist
      await supabase
        .from('deals')
        .update(dealUpdate)
        .eq('id', dealId);
    }

    // Add a note to activities for the deal
    await supabase
      .from('activities')
      .insert({
        deal_id: dealId,
        company_id: deal.company_id,
        user_id: dbUser.id,
        type: 'note',
        subject: 'Deal Converted to Product Pipeline',
        body: conversionNote,
        occurred_at: now.toISOString(),
      });

    console.log(
      `[ConvertDeal] Converted deal ${dealId} ("${deal.name}") → ${convertedProducts.length} products: ${productNames}`
    );

    // =========================================
    // E) Return conversion details
    // =========================================
    return NextResponse.json({
      success: true,
      deal_id: dealId,
      converted: true,
      already_converted: false,
      first_activity_at: firstActivityAt,
      last_activity_at: lastActivityAt,
      company_product_ids: newCompanyProductIds,
      products: convertedProducts,
      legacy_deal_status: {
        status: 'closed_converted',
        conversion_status: 'converted',
        converted_at: now.toISOString(),
      },
      stats: {
        activities_count: activitiesCount,
        communications_count: communicationsCount,
        meetings_count: meetingsCount,
      },
    });
  } catch (error) {
    console.error('[ConvertDeal] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/deals/[id]/convert
 *
 * Pre-flight endpoint to get conversion preview data:
 * - Available products
 * - Computed activity dates
 * - Current conversion status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*, company:companies(id, name)')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Check existing conversions
    const { data: existingConversions } = await supabase
      .from('deal_conversions')
      .select('*, product:products(id, name)')
      .eq('legacy_deal_id', dealId);

    // Get activities for date calculation
    const { data: activities } = await supabase
      .from('activities')
      .select('id, occurred_at, created_at')
      .eq('deal_id', dealId);

    const { data: communications } = await supabase
      .from('communications')
      .select('id, occurred_at, created_at')
      .eq('company_id', deal.company_id);

    const { data: meetings } = await supabase
      .from('meeting_transcriptions')
      .select('id, meeting_date, created_at')
      .or(`deal_id.eq.${dealId},company_id.eq.${deal.company_id}`);

    // Calculate dates
    const allDates: Date[] = [];
    (activities || []).forEach((a) => {
      if (a.occurred_at) allDates.push(new Date(a.occurred_at));
      else if (a.created_at) allDates.push(new Date(a.created_at));
    });
    (communications || []).forEach((c) => {
      if (c.occurred_at) allDates.push(new Date(c.occurred_at));
      else if (c.created_at) allDates.push(new Date(c.created_at));
    });
    (meetings || []).forEach((m) => {
      if (m.meeting_date) allDates.push(new Date(m.meeting_date));
      else if (m.created_at) allDates.push(new Date(m.created_at));
    });

    if (allDates.length === 0 && deal.created_at) {
      allDates.push(new Date(deal.created_at));
    }

    const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
    const firstActivityAt = sortedDates.length > 0 ? sortedDates[0].toISOString() : deal.created_at;
    const lastActivityAt = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].toISOString() : deal.created_at;

    // Get available products with their stages (only active, sellable products)
    const { data: products } = await supabase
      .from('products')
      .select(`
        id, name, slug, is_sellable,
        processes:product_processes(
          id, process_type,
          stages:product_process_stages(id, name, stage_order)
        )
      `)
      .eq('is_active', true)
      .eq('is_sellable', true)
      .order('name');

    // Extract and sort sales stages within each product
    const productsWithSortedStages = (products || []).map((p) => {
      const salesProcess = (p.processes as Array<{ process_type: string; stages: Array<{ id: string; name: string; stage_order: number }> }> || [])
        .find(proc => proc.process_type === 'sales');
      const stages = (salesProcess?.stages || [])
        .sort((a, b) => a.stage_order - b.stage_order);
      return { ...p, stages };
    });

    return NextResponse.json({
      deal: {
        id: deal.id,
        name: deal.name,
        company_id: deal.company_id,
        company_name: (deal.company as { name: string } | null)?.name || 'Unknown',
        stage: deal.stage,
        estimated_value: deal.estimated_value,
        created_at: deal.created_at,
      },
      computed_dates: {
        first_activity_at: firstActivityAt,
        last_activity_at: lastActivityAt,
      },
      stats: {
        activities_count: activities?.length || 0,
        communications_count: communications?.length || 0,
        meetings_count: meetings?.length || 0,
      },
      existing_conversions: (existingConversions || []).map((c) => ({
        product_id: c.product_id,
        product_name: (c.product as { name: string } | null)?.name || 'Unknown',
        company_product_id: c.company_product_id,
        converted_at: c.converted_at,
      })),
      is_converted: (existingConversions || []).length > 0,
      products: productsWithSortedStages,
    });
  } catch (error) {
    console.error('[ConvertDeal] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
