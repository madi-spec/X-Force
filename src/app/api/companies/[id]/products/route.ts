import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      current_stage:product_sales_stages(*)
    `)
    .eq('company_id', id)
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ companyProducts });
}

// POST - Start sale or add product to company
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  const { product_id, status = 'in_sales' } = body;

  if (!product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 });
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from('company_products')
    .select('id')
    .eq('company_id', id)
    .eq('product_id', product_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Company already has this product' }, { status: 400 });
  }

  // Get first stage for this product
  const { data: firstStage } = await supabase
    .from('product_sales_stages')
    .select('id')
    .eq('product_id', product_id)
    .order('stage_order')
    .limit(1)
    .single();

  // Create company_product
  const { data: companyProduct, error } = await supabase
    .from('company_products')
    .insert({
      company_id: id,
      product_id,
      status,
      current_stage_id: status === 'in_sales' ? firstStage?.id : null,
      stage_entered_at: status === 'in_sales' ? new Date().toISOString() : null,
      sales_started_at: status === 'in_sales' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log history
  await supabase.from('company_product_history').insert({
    company_product_id: companyProduct.id,
    event_type: 'status_changed',
    from_value: 'inactive',
    to_value: status,
    notes: 'Sale started',
  });

  return NextResponse.json({ companyProduct }, { status: 201 });
}
