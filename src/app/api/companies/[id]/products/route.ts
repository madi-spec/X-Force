import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { firstOrNull } from '@/lib/supabase/normalize';

// GET - List products for a company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: companyProducts, error } = await supabase
    .from('company_products')
    .select(`
      *,
      product:products(*),
      tier:product_tiers(*),
      current_stage:product_sales_stages(*),
      owner:users!company_products_owner_user_id_fkey(id, name, email)
    `)
    .eq('company_id', id)
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ companyProducts });
}

// POST - Start sale or add product to company
// This enrolls a company_product into the product's sales pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: companyId } = await params;
  const body = await request.json();

  const { product_id, status = 'in_sales' } = body;

  if (!product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 });
  }

  // Validate product exists and is sellable
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, is_active, is_sellable')
    .eq('id', product_id)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  if (!product.is_active) {
    return NextResponse.json({ error: 'This product is no longer active' }, { status: 400 });
  }

  if (!product.is_sellable) {
    return NextResponse.json({
      error: `${product.name} is a legacy product and is no longer available for new sales`
    }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Calculate next_step_due_at (3 days from now)
  const nextStepDue = new Date(now);
  nextStepDue.setDate(nextStepDue.getDate() + 3);
  const nextStepDueIso = nextStepDue.toISOString();

  // Get first stage for this product (order by stage_order ascending)
  const { data: firstStageData, error: stageError } = await supabase
    .from('product_sales_stages')
    .select('id, name')
    .eq('product_id', product_id)
    .order('stage_order', { ascending: true })
    .limit(1);

  if (stageError) {
    console.error('[StartSale] Error fetching first stage:', stageError);
    return NextResponse.json({ error: 'Failed to fetch product stages' }, { status: 500 });
  }

  const firstStage = firstOrNull(firstStageData);

  if (!firstStage && status === 'in_sales') {
    return NextResponse.json({
      error: 'No sales stages defined for this product. Please configure product stages first.'
    }, { status: 400 });
  }

  // Check if company_product already exists
  const { data: existing } = await supabase
    .from('company_products')
    .select('id, status, current_stage_id')
    .eq('company_id', companyId)
    .eq('product_id', product_id)
    .single();

  let companyProduct;
  let isUpdate = false;

  if (existing) {
    // UPDATE existing company_product to enroll in pipeline
    isUpdate = true;
    const previousStageId = existing.current_stage_id;

    const { data: updated, error: updateError } = await supabase
      .from('company_products')
      .update({
        status: status,
        current_stage_id: status === 'in_sales' ? firstStage?.id : null,
        stage_entered_at: status === 'in_sales' ? nowIso : null,
        last_stage_moved_at: status === 'in_sales' ? nowIso : null,
        next_step_due_at: status === 'in_sales' ? nextStepDueIso : null,
        sales_started_at: status === 'in_sales' ? nowIso : null,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .select(`
        *,
        product:products(id, name, slug),
        current_stage:product_sales_stages(id, name, slug, stage_order)
      `)
      .single();

    if (updateError) {
      console.error('[StartSale] Error updating company_product:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    companyProduct = updated;

    // Log history for status change
    if (existing.status !== status) {
      await supabase.from('company_product_history').insert({
        company_product_id: companyProduct.id,
        event_type: 'status_changed',
        from_value: existing.status,
        to_value: status,
        notes: 'Sale started (re-enrolled in pipeline)',
      });
    }

    // Log history for stage change
    if (status === 'in_sales' && previousStageId !== firstStage?.id) {
      await supabase.from('company_product_history').insert({
        company_product_id: companyProduct.id,
        event_type: 'stage_changed',
        from_value: previousStageId || null,
        to_value: firstStage?.id || null,
        notes: `Enrolled in pipeline at stage: ${firstStage?.name || 'Unknown'}`,
      });
    }

  } else {
    // CREATE new company_product
    const { data: created, error: createError } = await supabase
      .from('company_products')
      .insert({
        company_id: companyId,
        product_id,
        status,
        current_stage_id: status === 'in_sales' ? firstStage?.id : null,
        stage_entered_at: status === 'in_sales' ? nowIso : null,
        last_stage_moved_at: status === 'in_sales' ? nowIso : null,
        next_step_due_at: status === 'in_sales' ? nextStepDueIso : null,
        sales_started_at: status === 'in_sales' ? nowIso : null,
      })
      .select(`
        *,
        product:products(id, name, slug),
        current_stage:product_sales_stages(id, name, slug, stage_order)
      `)
      .single();

    if (createError) {
      console.error('[StartSale] Error creating company_product:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    companyProduct = created;

    // Log history for creation
    await supabase.from('company_product_history').insert({
      company_product_id: companyProduct.id,
      event_type: 'created',
      from_value: null,
      to_value: status,
      notes: 'Sale started',
    });

    // Log history for initial stage
    if (status === 'in_sales' && firstStage) {
      await supabase.from('company_product_history').insert({
        company_product_id: companyProduct.id,
        event_type: 'stage_changed',
        from_value: null,
        to_value: firstStage.id,
        notes: `Enrolled in pipeline at stage: ${firstStage.name}`,
      });
    }
  }

  console.log(`[StartSale] ${isUpdate ? 'Updated' : 'Created'} company_product ${companyProduct.id} for company ${companyId}, product ${product_id}`);
  console.log(`[StartSale] Assigned to stage: ${firstStage?.name || 'None'} (${firstStage?.id || 'null'})`);

  return NextResponse.json({
    companyProduct,
    enrolled: status === 'in_sales',
    stage: firstStage ? { id: firstStage.id, name: firstStage.name } : null,
  }, { status: isUpdate ? 200 : 201 });
}

// PUT - Update an existing company product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: companyId } = await params;
  const body = await request.json();

  const {
    company_product_id,
    status,
    tier_id,
    mrr,
    seats,
    current_stage_id,
    notes,
    activated_at,
    onboarding_started_at,
  } = body;

  if (!company_product_id) {
    return NextResponse.json({ error: 'company_product_id required' }, { status: 400 });
  }

  // Fetch existing record
  const { data: existing, error: fetchError } = await supabase
    .from('company_products')
    .select('*, product:products(id, name)')
    .eq('id', company_product_id)
    .eq('company_id', companyId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Company product not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  const historyEntries: Array<{ event_type: string; from_value: string | null; to_value: string | null; notes: string }> = [];

  // Handle status change
  if (status !== undefined && status !== existing.status) {
    updates.status = status;
    historyEntries.push({
      event_type: 'status_changed',
      from_value: existing.status,
      to_value: status,
      notes: `Status changed from ${existing.status} to ${status}`,
    });

    // Set appropriate timestamps based on status
    if (status === 'active' && !existing.activated_at) {
      updates.activated_at = activated_at || now;
    }
    if (status === 'in_onboarding' && !existing.onboarding_started_at) {
      updates.onboarding_started_at = onboarding_started_at || now;
    }
    if (status === 'in_sales' && !existing.sales_started_at) {
      updates.sales_started_at = now;
    }
    if (status === 'churned') {
      updates.churned_at = now;
    }
    if (status === 'declined') {
      updates.declined_at = now;
    }
  }

  // Handle tier change
  if (tier_id !== undefined && tier_id !== existing.tier_id) {
    updates.tier_id = tier_id || null;
    historyEntries.push({
      event_type: 'tier_changed',
      from_value: existing.tier_id,
      to_value: tier_id || null,
      notes: 'Tier updated',
    });
  }

  // Handle MRR change
  if (mrr !== undefined) {
    const newMrr = mrr === '' || mrr === null ? null : parseFloat(mrr);
    const existingMrr = existing.mrr ? parseFloat(existing.mrr) : null;
    if (newMrr !== existingMrr) {
      updates.mrr = newMrr;
      historyEntries.push({
        event_type: 'mrr_changed',
        from_value: existingMrr?.toString() || null,
        to_value: newMrr?.toString() || null,
        notes: `MRR updated from $${existingMrr || 0} to $${newMrr || 0}`,
      });
    }
  }

  // Handle seats change
  if (seats !== undefined && seats !== existing.seats) {
    updates.seats = seats || null;
    historyEntries.push({
      event_type: 'seats_changed',
      from_value: existing.seats?.toString() || null,
      to_value: seats?.toString() || null,
      notes: `Seats updated from ${existing.seats || 0} to ${seats || 0}`,
    });
  }

  // Handle stage change
  if (current_stage_id !== undefined && current_stage_id !== existing.current_stage_id) {
    updates.current_stage_id = current_stage_id || null;
    updates.stage_entered_at = now;
    updates.last_stage_moved_at = now;
    historyEntries.push({
      event_type: 'stage_changed',
      from_value: existing.current_stage_id,
      to_value: current_stage_id || null,
      notes: 'Stage updated',
    });
  }

  // Handle notes change
  if (notes !== undefined && notes !== existing.notes) {
    updates.notes = notes || null;
    historyEntries.push({
      event_type: 'note_added',
      from_value: null,
      to_value: notes || null,
      notes: 'Notes updated',
    });
  }

  // Handle explicit date overrides
  if (activated_at !== undefined) {
    updates.activated_at = activated_at || null;
  }
  if (onboarding_started_at !== undefined) {
    updates.onboarding_started_at = onboarding_started_at || null;
  }

  // Perform the update
  const { data: updated, error: updateError } = await supabase
    .from('company_products')
    .update(updates)
    .eq('id', company_product_id)
    .select(`
      *,
      product:products(id, name, slug, icon, color),
      tier:product_tiers(id, name),
      current_stage:product_sales_stages(id, name, slug, stage_order)
    `)
    .single();

  if (updateError) {
    console.error('[UpdateCompanyProduct] Error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log history entries
  for (const entry of historyEntries) {
    await supabase.from('company_product_history').insert({
      company_product_id,
      ...entry,
    });
  }

  console.log(`[UpdateCompanyProduct] Updated company_product ${company_product_id}, changes:`, Object.keys(updates));

  return NextResponse.json({ companyProduct: updated });
}
