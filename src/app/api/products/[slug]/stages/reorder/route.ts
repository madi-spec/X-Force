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

  // Update each stage's order
  for (let i = 0; i < stage_ids.length; i++) {
    await supabase
      .from('product_sales_stages')
      .update({ stage_order: i + 1 })
      .eq('id', stage_ids[i])
      .eq('product_id', product.id);
  }

  return NextResponse.json({ success: true });
}
