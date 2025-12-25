import { createClient } from '@/lib/supabase/server';

export interface WhitespaceOpportunity {
  company_id: string;
  company_name: string;
  current_products: string[];
  missing_products: {
    product_id: string;
    product_name: string;
    product_slug: string;
    estimated_mrr: number;
    fit_score: number;
    fit_reasons: string[];
  }[];
  total_potential_mrr: number;
  priority_score: number;
}

export interface WhitespaceStats {
  total_vfp_customers: number;
  customers_with_ai_products: number;
  customers_without_ai_products: number;
  adoption_rate: number;
  total_whitespace_mrr: number;
  opportunities_by_product: {
    product_id: string;
    product_name: string;
    potential_customers: number;
    potential_mrr: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  base_price: number | null;
}

interface CompanyProduct {
  product_id: string;
  status: string;
  mrr: number | null;
  product: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  segment: string | null;
  employee_count: number | null;
  company_products: CompanyProduct[] | null;
}

export async function analyzeWhitespace(): Promise<WhitespaceStats> {
  const supabase = await createClient();

  // Get all sellable products (excluding VFP/VFT base products)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, base_price')
    .eq('is_sellable', true)
    .eq('is_active', true)
    .not('slug', 'in', '("voice-for-pest","voice-for-turf")');

  // Get all VFP/VFT customers
  const { data: vfpCustomers } = await supabase
    .from('company_products')
    .select(`
      company_id,
      company:companies(id, name),
      product:products(slug)
    `)
    .in('status', ['active', 'in_sales'])
    .not('product', 'is', null);

  // Filter to only VFP/VFT customers
  const vfpCompanyIds = [...new Set(
    (vfpCustomers || [])
      .filter(c => {
        const product = Array.isArray(c.product) ? c.product[0] : c.product;
        return product && ['voice-for-pest', 'voice-for-turf'].includes(product.slug);
      })
      .map(c => c.company_id)
  )];

  // Get all AI product adoptions for VFP customers
  const { data: aiAdoptions } = await supabase
    .from('company_products')
    .select(`
      company_id,
      product_id,
      product:products(slug, name)
    `)
    .in('company_id', vfpCompanyIds.length > 0 ? vfpCompanyIds : ['no-matches'])
    .eq('status', 'active');

  // Filter to non-VFP products
  const filteredAdoptions = (aiAdoptions || []).filter(a => {
    const product = Array.isArray(a.product) ? a.product[0] : a.product;
    return product && !['voice-for-pest', 'voice-for-turf'].includes(product.slug);
  });

  // Build adoption map
  const adoptionMap = new Map<string, Set<string>>();
  for (const adoption of filteredAdoptions) {
    if (!adoptionMap.has(adoption.company_id)) {
      adoptionMap.set(adoption.company_id, new Set());
    }
    adoptionMap.get(adoption.company_id)!.add(adoption.product_id);
  }

  // Calculate stats
  const customersWithAI = [...adoptionMap.keys()].length;
  const customersWithoutAI = vfpCompanyIds.length - customersWithAI;

  // Calculate opportunities by product
  const opportunitiesByProduct = ((products as Product[]) || []).map(product => {
    const customersWithProduct = [...adoptionMap.values()]
      .filter(products => products.has(product.id)).length;
    const potentialCustomers = vfpCompanyIds.length - customersWithProduct;

    return {
      product_id: product.id,
      product_name: product.name,
      potential_customers: potentialCustomers,
      potential_mrr: potentialCustomers * (product.base_price || 0)
    };
  });

  const totalWhitespaceMRR = opportunitiesByProduct.reduce(
    (sum, p) => sum + p.potential_mrr, 0
  );

  return {
    total_vfp_customers: vfpCompanyIds.length,
    customers_with_ai_products: customersWithAI,
    customers_without_ai_products: customersWithoutAI,
    adoption_rate: vfpCompanyIds.length > 0
      ? Math.round((customersWithAI / vfpCompanyIds.length) * 100)
      : 0,
    total_whitespace_mrr: totalWhitespaceMRR,
    opportunities_by_product: opportunitiesByProduct
  };
}

export async function getWhitespaceOpportunities(
  options: {
    product_id?: string;
    min_fit_score?: number;
    limit?: number;
    sort_by?: 'potential_mrr' | 'fit_score' | 'priority';
  } = {}
): Promise<WhitespaceOpportunity[]> {
  const supabase = await createClient();
  const { product_id, min_fit_score = 0, limit = 50, sort_by = 'priority' } = options;

  // Get all sellable products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, base_price')
    .eq('is_sellable', true)
    .eq('is_active', true)
    .not('slug', 'in', '("voice-for-pest","voice-for-turf")');

  // Get companies with their products
  const { data: companies } = await supabase
    .from('companies')
    .select(`
      id, name, domain, industry, segment, employee_count,
      company_products(
        product_id,
        status,
        mrr,
        product:products(id, name, slug)
      )
    `)
    .not('company_products', 'is', null);

  const opportunities: WhitespaceOpportunity[] = [];

  for (const company of (companies as unknown as Company[]) || []) {
    const activeProducts = (company.company_products || [])
      .filter((cp) => cp.status === 'active' || cp.status === 'in_sales');

    const hasVFP = activeProducts.some((cp) => {
      const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      return product && ['voice-for-pest', 'voice-for-turf'].includes(product.slug);
    });

    if (!hasVFP) continue;

    const currentProductIds = new Set(activeProducts.map((cp) => cp.product_id));
    const currentProductNames = activeProducts.map((cp) => {
      const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      return product?.name || '';
    }).filter(Boolean);

    // Find missing products
    const missingProducts = ((products as Product[]) || [])
      .filter(p => !currentProductIds.has(p.id))
      .filter(p => !product_id || p.id === product_id)
      .map(product => {
        const { score, reasons } = calculateFitScore(company, product, activeProducts);
        return {
          product_id: product.id,
          product_name: product.name,
          product_slug: product.slug,
          estimated_mrr: product.base_price || 0,
          fit_score: score,
          fit_reasons: reasons
        };
      })
      .filter(p => p.fit_score >= min_fit_score);

    if (missingProducts.length === 0) continue;

    const totalPotentialMRR = missingProducts.reduce((sum, p) => sum + p.estimated_mrr, 0);
    const avgFitScore = missingProducts.reduce((sum, p) => sum + p.fit_score, 0) / missingProducts.length;

    opportunities.push({
      company_id: company.id,
      company_name: company.name,
      current_products: currentProductNames,
      missing_products: missingProducts,
      total_potential_mrr: totalPotentialMRR,
      priority_score: Math.round(avgFitScore * 0.6 + (totalPotentialMRR / 100) * 0.4)
    });
  }

  // Sort
  opportunities.sort((a, b) => {
    if (sort_by === 'potential_mrr') return b.total_potential_mrr - a.total_potential_mrr;
    if (sort_by === 'fit_score') return b.priority_score - a.priority_score;
    return b.priority_score - a.priority_score;
  });

  return opportunities.slice(0, limit);
}

function calculateFitScore(
  company: Company,
  product: Product,
  currentProducts: CompanyProduct[]
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // Higher score for customers with more products (engaged)
  if (currentProducts.length >= 3) {
    score += 20;
    reasons.push('Highly engaged customer (3+ products)');
  } else if (currentProducts.length >= 2) {
    score += 10;
    reasons.push('Engaged customer (2+ products)');
  }

  // Product-specific fit logic
  if (product.slug === 'summary-note') {
    score += 15;
    reasons.push('Universal fit for all VFP customers');
  }

  if (product.slug === 'smart-data-plus') {
    const hasSummaryNote = currentProducts.some((cp) => {
      const prod = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      return prod?.slug === 'summary-note';
    });
    if (hasSummaryNote) {
      score += 25;
      reasons.push('Natural upgrade from Summary Note');
    }
  }

  if (product.slug === 'xrai-1') {
    if (company.employee_count && company.employee_count >= 10) {
      score += 15;
      reasons.push('Company size fits X-RAI 1.0');
    }
  }

  if (product.slug === 'xrai-2') {
    const hasXrai1 = currentProducts.some((cp) => {
      const prod = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      return prod?.slug === 'xrai-1';
    });
    if (hasXrai1) {
      score += 30;
      reasons.push('Ready to upgrade from X-RAI 1.0');
    }
    if (company.segment === 'enterprise') {
      score += 20;
      reasons.push('Enterprise segment');
    }
  }

  return { score: Math.min(100, score), reasons };
}
