import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;
  const body = await request.json();

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { stage_ids } = body;

  if (!Array.isArray(stage_ids)) {
    return NextResponse.json({ error: 'stage_ids array required' }, { status: 400 });
  }

  // Get the process for this product's sales stages
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', product.id)
    .eq('process_type', 'sales')
    .eq('status', 'published')
    .single();

  if (!process) {
    return NextResponse.json({ error: 'No sales process found' }, { status: 404 });
  }

  // Update each stage's order in the unified table
  for (let i = 0; i < stage_ids.length; i++) {
    await supabase
      .from('product_process_stages')
      .update({ stage_order: i + 1 })
      .eq('id', stage_ids[i])
      .eq('process_id', process.id);
  }

  return NextResponse.json({ success: true });
}
