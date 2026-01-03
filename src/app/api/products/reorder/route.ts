import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Reorder products
 *
 * POST /api/products/reorder
 * Body: { productId: string, direction: 'up' | 'down' }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { productId, direction } = body;

    if (!productId || !direction) {
      return NextResponse.json(
        { error: 'productId and direction are required' },
        { status: 400 }
      );
    }

    if (direction !== 'up' && direction !== 'down') {
      return NextResponse.json(
        { error: 'direction must be "up" or "down"' },
        { status: 400 }
      );
    }

    // Get all sellable products ordered by display_order
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, display_order')
      .is('parent_product_id', null)
      .eq('is_active', true)
      .eq('is_sellable', true)
      .order('display_order', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length < 2) {
      return NextResponse.json(
        { error: 'Not enough products to reorder' },
        { status: 400 }
      );
    }

    // Find the current product's index
    const currentIndex = products.findIndex(p => p.id === productId);
    if (currentIndex === -1) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Calculate the swap index
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds
    if (swapIndex < 0 || swapIndex >= products.length) {
      return NextResponse.json(
        { error: `Cannot move ${direction} - already at ${direction === 'up' ? 'top' : 'bottom'}` },
        { status: 400 }
      );
    }

    // Swap display_order values
    const currentProduct = products[currentIndex];
    const swapProduct = products[swapIndex];

    const currentOrder = currentProduct.display_order;
    const swapOrder = swapProduct.display_order;

    // Update both products
    const { error: updateError1 } = await supabase
      .from('products')
      .update({ display_order: swapOrder })
      .eq('id', currentProduct.id);

    if (updateError1) {
      throw new Error(`Failed to update product order: ${updateError1.message}`);
    }

    const { error: updateError2 } = await supabase
      .from('products')
      .update({ display_order: currentOrder })
      .eq('id', swapProduct.id);

    if (updateError2) {
      throw new Error(`Failed to update swap product order: ${updateError2.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Moved "${currentProduct.name}" ${direction}`,
    });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder products' },
      { status: 500 }
    );
  }
}
