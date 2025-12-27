import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Convert a company from one product to another (e.g., X-RAI 1.0 to X-RAI 2.0)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: companyId } = await params;
  const body = await request.json();

  const {
    from_product_id,
    to_product_id,
    transfer_mrr = true,
    transfer_tier = false,
    new_status = 'active',
  } = body;

  if (!from_product_id || !to_product_id) {
    return NextResponse.json(
      { error: 'from_product_id and to_product_id are required' },
      { status: 400 }
    );
  }

  // Get the source company_product
  const { data: sourceProduct, error: sourceError } = await supabase
    .from('company_products')
    .select(`
      *,
      product:products(id, name),
      tier:product_tiers(id, name)
    `)
    .eq('company_id', companyId)
    .eq('product_id', from_product_id)
    .single();

  if (sourceError || !sourceProduct) {
    return NextResponse.json(
      { error: 'Source product not found for this company' },
      { status: 404 }
    );
  }

  // Validate target product exists
  const { data: targetProduct, error: targetError } = await supabase
    .from('products')
    .select('id, name, is_active')
    .eq('id', to_product_id)
    .single();

  if (targetError || !targetProduct) {
    return NextResponse.json(
      { error: 'Target product not found' },
      { status: 404 }
    );
  }

  // Check if company already has the target product
  const { data: existingTarget } = await supabase
    .from('company_products')
    .select('id, status, mrr')
    .eq('company_id', companyId)
    .eq('product_id', to_product_id)
    .single();

  const now = new Date().toISOString();

  // Start transaction-like operations
  let newCompanyProduct;

  if (existingTarget) {
    // Update existing target product
    const { data: updated, error: updateError } = await supabase
      .from('company_products')
      .update({
        status: new_status,
        mrr: transfer_mrr ? sourceProduct.mrr : existingTarget.mrr,
        seats: sourceProduct.seats,
        activated_at: new_status === 'active' ? now : null,
        updated_at: now,
        notes: `Converted from ${sourceProduct.product.name}${sourceProduct.notes ? `. Previous notes: ${sourceProduct.notes}` : ''}`,
      })
      .eq('id', existingTarget.id)
      .select(`
        *,
        product:products(id, name, slug),
        company:companies(id, name)
      `)
      .single();

    if (updateError) {
      console.error('[ConvertProduct] Error updating target:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    newCompanyProduct = updated;

    // Log history for the update
    await supabase.from('company_product_history').insert({
      company_product_id: existingTarget.id,
      event_type: 'status_changed',
      from_value: existingTarget.status,
      to_value: new_status,
      notes: `Converted from ${sourceProduct.product.name}`,
    });
  } else {
    // Create new target product
    const { data: created, error: createError } = await supabase
      .from('company_products')
      .insert({
        company_id: companyId,
        product_id: to_product_id,
        status: new_status,
        mrr: transfer_mrr ? sourceProduct.mrr : null,
        seats: sourceProduct.seats,
        activated_at: new_status === 'active' ? now : null,
        notes: `Converted from ${sourceProduct.product.name}${sourceProduct.notes ? `. Previous notes: ${sourceProduct.notes}` : ''}`,
      })
      .select(`
        *,
        product:products(id, name, slug),
        company:companies(id, name)
      `)
      .single();

    if (createError) {
      console.error('[ConvertProduct] Error creating target:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    newCompanyProduct = created;

    // Log history for creation
    await supabase.from('company_product_history').insert({
      company_product_id: created.id,
      event_type: 'created',
      from_value: null,
      to_value: new_status,
      notes: `Converted from ${sourceProduct.product.name}`,
    });
  }

  // Mark the source product as churned
  const { error: churnError } = await supabase
    .from('company_products')
    .update({
      status: 'churned',
      churned_at: now,
      mrr: '0', // Zero out MRR since it's being transferred
      notes: `Converted to ${targetProduct.name}${sourceProduct.notes ? `. Previous notes: ${sourceProduct.notes}` : ''}`,
      updated_at: now,
    })
    .eq('id', sourceProduct.id);

  if (churnError) {
    console.error('[ConvertProduct] Error churning source:', churnError);
    // Don't fail the whole operation, but log it
  }

  // Log history for the source product churn
  await supabase.from('company_product_history').insert({
    company_product_id: sourceProduct.id,
    event_type: 'status_changed',
    from_value: sourceProduct.status,
    to_value: 'churned',
    notes: `Converted to ${targetProduct.name}`,
  });

  console.log(`[ConvertProduct] Converted company ${companyId} from ${sourceProduct.product.name} to ${targetProduct.name}`);

  return NextResponse.json({
    success: true,
    converted: {
      from: {
        product_id: from_product_id,
        product_name: sourceProduct.product.name,
        previous_status: sourceProduct.status,
        new_status: 'churned',
      },
      to: {
        product_id: to_product_id,
        product_name: targetProduct.name,
        company_product_id: newCompanyProduct.id,
        status: new_status,
        mrr: newCompanyProduct.mrr,
      },
    },
  });
}
