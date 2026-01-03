import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Complete a migration and start X-RAI 2.0 onboarding
 *
 * POST /api/products/migration/complete
 * Body: { companyProductId: string }
 *
 * This will:
 * 1. Mark the migration company_product as completed (status: 'active' with churned date to indicate completion)
 * 2. Create an X-RAI 2.0 company_product in 'in_onboarding' status
 * 3. Mark the X-RAI 1.0 company_product as 'churned' (converted)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { companyProductId } = body;

    if (!companyProductId) {
      return NextResponse.json(
        { error: 'companyProductId is required' },
        { status: 400 }
      );
    }

    // Get the migration company_product
    const { data: migrationCp, error: migrationError } = await supabase
      .from('company_products')
      .select(`
        *,
        product:products(id, slug, name),
        company:companies(id, name)
      `)
      .eq('id', companyProductId)
      .single();

    if (migrationError || !migrationCp) {
      return NextResponse.json(
        { error: 'Migration record not found' },
        { status: 404 }
      );
    }

    // Verify this is a migration product
    const product = migrationCp.product as { id: string; slug: string; name: string };
    if (product.slug !== 'xrai-migration') {
      return NextResponse.json(
        { error: 'This is not a migration product' },
        { status: 400 }
      );
    }

    // Get X-RAI 2.0 product
    const { data: xrai2Product } = await supabase
      .from('products')
      .select('id, name')
      .eq('slug', 'xrai-2')
      .single();

    if (!xrai2Product) {
      return NextResponse.json(
        { error: 'X-RAI 2.0 product not found' },
        { status: 500 }
      );
    }

    // Get X-RAI 1.0 product
    const { data: xrai1Product } = await supabase
      .from('products')
      .select('id')
      .eq('slug', 'xrai-1')
      .single();

    const now = new Date().toISOString();

    // 1. Mark the migration as completed
    const { error: updateMigrationError } = await supabase
      .from('company_products')
      .update({
        status: 'active', // Mark as 'active' to indicate completion
        activated_at: now,
        notes: `Migration completed. Customer transitioned to X-RAI 2.0 onboarding.`,
      })
      .eq('id', companyProductId);

    if (updateMigrationError) {
      throw new Error(`Failed to update migration: ${updateMigrationError.message}`);
    }

    // 2. Check if X-RAI 2.0 company_product already exists
    const { data: existingXrai2 } = await supabase
      .from('company_products')
      .select('id, status')
      .eq('company_id', migrationCp.company_id)
      .eq('product_id', xrai2Product.id)
      .single();

    let xrai2CompanyProductId: string;

    if (existingXrai2) {
      // Update existing record to onboarding
      const { error: updateXrai2Error } = await supabase
        .from('company_products')
        .update({
          status: 'in_onboarding',
          onboarding_started_at: now,
          mrr: migrationCp.mrr, // Carry over MRR
          notes: `Migration from X-RAI 1.0 completed. Starting onboarding.`,
        })
        .eq('id', existingXrai2.id);

      if (updateXrai2Error) {
        throw new Error(`Failed to update X-RAI 2.0 record: ${updateXrai2Error.message}`);
      }
      xrai2CompanyProductId = existingXrai2.id;
    } else {
      // Create new X-RAI 2.0 company_product in onboarding
      const { data: newXrai2, error: createXrai2Error } = await supabase
        .from('company_products')
        .insert({
          company_id: migrationCp.company_id,
          product_id: xrai2Product.id,
          status: 'in_onboarding',
          onboarding_started_at: now,
          mrr: migrationCp.mrr,
          notes: `Created from X-RAI 1.0 migration.`,
        })
        .select()
        .single();

      if (createXrai2Error) {
        throw new Error(`Failed to create X-RAI 2.0 record: ${createXrai2Error.message}`);
      }
      xrai2CompanyProductId = newXrai2.id;
    }

    // 3. Mark X-RAI 1.0 as churned (converted)
    if (xrai1Product) {
      const { error: churnXrai1Error } = await supabase
        .from('company_products')
        .update({
          status: 'churned',
          churned_at: now,
          notes: `Converted to X-RAI 2.0.`,
        })
        .eq('company_id', migrationCp.company_id)
        .eq('product_id', xrai1Product.id)
        .eq('status', 'active');

      if (churnXrai1Error) {
        console.warn('Failed to churn X-RAI 1.0:', churnXrai1Error.message);
        // Don't fail the whole operation for this
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      xrai2CompanyProductId,
      company: migrationCp.company,
    });
  } catch (error) {
    console.error('Migration completion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete migration' },
      { status: 500 }
    );
  }
}
