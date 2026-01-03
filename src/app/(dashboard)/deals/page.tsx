import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { DealsView } from './DealsView';

export default async function DealsPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('auth_id', user.id)
    .single();

  // Query company_products in sales pipeline (unified model)
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select(`
      id,
      company_id,
      product_id,
      status,
      current_stage_id,
      stage_entered_at,
      owner_user_id,
      mrr,
      expected_close_date,
      close_confidence,
      metadata,
      sales_started_at,
      created_at,
      updated_at,
      company:companies(id, name, segment, domain),
      product:products(id, name, slug),
      current_stage:product_process_stages(id, name, slug),
      owner:users(id, name, email)
    `)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: false });

  // Transform company_products to Deal-like interface for backward compatibility
  const deals = (companyProducts || []).map((cp) => {
    const company = Array.isArray(cp.company) ? cp.company[0] : cp.company;
    const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
    const stage = Array.isArray(cp.current_stage) ? cp.current_stage[0] : cp.current_stage;
    const owner = Array.isArray(cp.owner) ? cp.owner[0] : cp.owner;
    const metadata = cp.metadata as Record<string, unknown> || {};

    return {
      id: cp.id,
      name: metadata.deal_name as string || `${company?.name || 'Unknown'} - ${product?.name || 'Product'}`,
      company_id: cp.company_id,
      company: company ? { id: company.id, name: company.name, segment: company.segment } : null,
      owner_id: cp.owner_user_id,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      stage: stage?.slug || 'new-lead',
      health_score: cp.close_confidence || 50,
      estimated_value: cp.mrr || 0,
      expected_close_date: cp.expected_close_date,
      created_at: cp.created_at,
      updated_at: cp.updated_at,
      stage_entered_at: cp.stage_entered_at,
      // Legacy fields
      products: null,
      primary_product_category_id: product?.slug || null,
      sales_team: 'xrai',
    };
  });

  // Also get legacy deals that haven't been migrated
  const { data: legacyDeals } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name, segment),
      owner:users!deals_owner_id_fkey(id, name, email)
    `)
    .not('stage', 'in', '(closed_won,closed_lost)')
    .is('converted_to_company_product_ids', null)
    .order('created_at', { ascending: false });

  // Legacy deals that haven't been converted
  const unmigrated = legacyDeals || [];

  // Combine: company_products first, then unmigrated legacy deals
  const allDeals = [...deals, ...unmigrated];

  // Get all users for salesperson filter
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, team')
    .order('name');

  // Get all companies for filter
  const companyIds = [...new Set(allDeals.map(d => d.company_id).filter(Boolean))];
  const { data: companies } = companyIds.length > 0
    ? await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds)
        .order('name')
    : { data: [] };

  // Show migration banner if there are unmigrated deals
  const hasMigrationBanner = unmigrated.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Migration Banner */}
      {hasMigrationBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Deals are migrating to Product Pipelines
                </p>
                <p className="text-xs text-amber-600">
                  {unmigrated.length} legacy deals will be migrated. New deals should be created in product pipelines.
                </p>
              </div>
            </div>
            <Link
              href="/products"
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              View Products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Deals View */}
      <div className="flex-1 p-6">
        <DealsView
          initialDeals={allDeals}
          currentUserId={profile?.id || ''}
          users={users || []}
          companies={companies || []}
        />
      </div>
    </div>
  );
}
