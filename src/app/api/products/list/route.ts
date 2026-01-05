import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  try {
    // Match the filters used on /products page:
    // - is_active: only active products
    // - is_sellable: only sellable products (not prerequisites)
    // - parent_product_id is null: only top-level products (not child products)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, color, icon')
      .eq('is_active', true)
      .eq('is_sellable', true)
      .is('parent_product_id', null)
      .order('display_order');

    if (error) {
      console.error('Products list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
