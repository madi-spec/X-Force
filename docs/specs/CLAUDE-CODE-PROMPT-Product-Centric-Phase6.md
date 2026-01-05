# Product-Centric Redesign: Phase 6 - Whitespace Analytics & Dashboard

## Context

Read these first:
- `/docs/specs/X-FORCE-CRM-Project-State.md`
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

**Phases 1-5 Complete:**
- Phase 1: Database tables, products seeded
- Phase 2: 1,390 company_products imported
- Phase 3: Product detail page, pipeline view, company products grid
- Phase 4: Proven process editor (stages, pitch points, objections)
- Phase 5: AI learning (transcript analysis, pattern extraction)

---

## Phase 6 Overview

The final phase focuses on **growth intelligence**:

1. **Whitespace Analytics** - Find adoption gaps (VFP customers missing AI products)
2. **Expansion Dashboard** - Key metrics and opportunities at a glance
3. **Prospecting Pipeline** - Traditional pipeline for non-VFP leads
4. **Product Adoption Trends** - Track growth over time

---

## Task 1: Whitespace Analysis Service

Create `src/lib/analytics/whitespaceAnalyzer.ts`:

```typescript
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
    fit_score: number; // 0-100 based on company attributes
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
    .in('product.slug', ['voice-for-pest', 'voice-for-turf'])
    .eq('status', 'active');
  
  const vfpCompanyIds = [...new Set(vfpCustomers?.map(c => c.company_id) || [])];
  
  // Get all AI product adoptions
  const { data: aiAdoptions } = await supabase
    .from('company_products')
    .select(`
      company_id,
      product_id,
      product:products(slug, name)
    `)
    .in('company_id', vfpCompanyIds)
    .eq('status', 'active')
    .not('product.slug', 'in', '("voice-for-pest","voice-for-turf")');
  
  // Build adoption map
  const adoptionMap = new Map<string, Set<string>>();
  for (const adoption of aiAdoptions || []) {
    if (!adoptionMap.has(adoption.company_id)) {
      adoptionMap.set(adoption.company_id, new Set());
    }
    adoptionMap.get(adoption.company_id)!.add(adoption.product_id);
  }
  
  // Calculate stats
  const customersWithAI = [...adoptionMap.keys()].length;
  const customersWithoutAI = vfpCompanyIds.length - customersWithAI;
  
  // Calculate opportunities by product
  const opportunitiesByProduct = (products || []).map(product => {
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
  
  // Get VFP customers with their current products
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
  
  for (const company of companies || []) {
    const activeProducts = (company.company_products || [])
      .filter((cp: any) => cp.status === 'active');
    
    const hasVFP = activeProducts.some((cp: any) => 
      ['voice-for-pest', 'voice-for-turf'].includes(cp.product?.slug)
    );
    
    if (!hasVFP) continue; // Only analyze VFP customers
    
    const currentProductIds = new Set(activeProducts.map((cp: any) => cp.product_id));
    const currentProductNames = activeProducts.map((cp: any) => cp.product?.name || '');
    
    // Find missing products
    const missingProducts = (products || [])
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
    return b.priority_score - a.priority_score; // default: priority
  });
  
  return opportunities.slice(0, limit);
}

function calculateFitScore(
  company: any, 
  product: any, 
  currentProducts: any[]
): { score: number; reasons: string[] } {
  let score = 50; // Base score
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
    // Summary Note is good for everyone
    score += 15;
    reasons.push('Universal fit for all VFP customers');
  }
  
  if (product.slug === 'smart-data-plus') {
    // Higher tier of summary note
    const hasSummaryNote = currentProducts.some((cp: any) => 
      cp.product?.slug === 'summary-note'
    );
    if (hasSummaryNote) {
      score += 25;
      reasons.push('Natural upgrade from Summary Note');
    }
  }
  
  if (product.slug === 'xrai-1') {
    // X-RAI 1.0 for larger companies
    if (company.employee_count && company.employee_count >= 10) {
      score += 15;
      reasons.push('Company size fits X-RAI 1.0');
    }
  }
  
  if (product.slug === 'xrai-2') {
    // X-RAI 2.0 for enterprise
    const hasXrai1 = currentProducts.some((cp: any) => 
      cp.product?.slug === 'xrai-1'
    );
    if (hasXrai1) {
      score += 30;
      reasons.push('Ready to upgrade from X-RAI 1.0');
    }
    if (company.segment === 'enterprise') {
      score += 20;
      reasons.push('Enterprise segment');
    }
  }
  
  // Cap at 100
  return { score: Math.min(100, score), reasons };
}
```

---

## Task 2: Whitespace API Endpoints

Create `src/app/api/analytics/whitespace/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeWhitespace, getWhitespaceOpportunities } from '@/lib/analytics/whitespaceAnalyzer';

// GET - Get whitespace stats and opportunities
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const view = searchParams.get('view') || 'stats';
  
  try {
    if (view === 'stats') {
      const stats = await analyzeWhitespace();
      return NextResponse.json(stats);
    }
    
    if (view === 'opportunities') {
      const opportunities = await getWhitespaceOpportunities({
        product_id: searchParams.get('product_id') || undefined,
        min_fit_score: parseInt(searchParams.get('min_fit_score') || '0'),
        limit: parseInt(searchParams.get('limit') || '50'),
        sort_by: (searchParams.get('sort_by') as any) || 'priority'
      });
      return NextResponse.json({ opportunities });
    }
    
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Task 3: Whitespace Dashboard Page

Create `src/app/(dashboard)/analytics/whitespace/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { analyzeWhitespace, getWhitespaceOpportunities } from '@/lib/analytics/whitespaceAnalyzer';
import { WhitespaceStats } from '@/components/analytics/WhitespaceStats';
import { WhitespaceOpportunityList } from '@/components/analytics/WhitespaceOpportunityList';
import { ProductAdoptionChart } from '@/components/analytics/ProductAdoptionChart';

export default async function WhitespacePage() {
  const stats = await analyzeWhitespace();
  const opportunities = await getWhitespaceOpportunities({ limit: 20 });
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Whitespace Analysis</h1>
        <p className="text-gray-500">
          Find expansion opportunities in your existing customer base
        </p>
      </div>
      
      {/* Stats Cards */}
      <WhitespaceStats stats={stats} />
      
      {/* Adoption by Product Chart */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Product Adoption Opportunities
        </h2>
        <ProductAdoptionChart data={stats.opportunities_by_product} />
      </div>
      
      {/* Top Opportunities */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Top Expansion Opportunities
        </h2>
        <WhitespaceOpportunityList opportunities={opportunities} />
      </div>
    </div>
  );
}
```

---

## Task 4: Whitespace Stats Component

Create `src/components/analytics/WhitespaceStats.tsx`:

```tsx
'use client';

import { Users, TrendingUp, DollarSign, Target } from 'lucide-react';

interface WhitespaceStatsProps {
  stats: {
    total_vfp_customers: number;
    customers_with_ai_products: number;
    customers_without_ai_products: number;
    adoption_rate: number;
    total_whitespace_mrr: number;
  };
}

export function WhitespaceStats({ stats }: WhitespaceStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        value={stats.total_vfp_customers.toLocaleString()}
        label="VFP Customers"
      />
      <StatCard
        icon={TrendingUp}
        iconBg="bg-green-100"
        iconColor="text-green-600"
        value={`${stats.adoption_rate}%`}
        label="AI Adoption Rate"
        subtext={`${stats.customers_with_ai_products} with AI products`}
      />
      <StatCard
        icon={Target}
        iconBg="bg-yellow-100"
        iconColor="text-yellow-600"
        value={stats.customers_without_ai_products.toLocaleString()}
        label="Untapped Customers"
        subtext="No AI products yet"
      />
      <StatCard
        icon={DollarSign}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        value={`$${(stats.total_whitespace_mrr / 1000).toFixed(0)}k`}
        label="Whitespace MRR"
        subtext="Potential monthly revenue"
      />
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  iconBg, 
  iconColor, 
  value, 
  label, 
  subtext 
}: {
  icon: any;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
          {subtext && <div className="text-xs text-gray-400">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 5: Product Adoption Chart Component

Create `src/components/analytics/ProductAdoptionChart.tsx`:

```tsx
'use client';

import Link from 'next/link';

interface ProductData {
  product_id: string;
  product_name: string;
  potential_customers: number;
  potential_mrr: number;
}

interface ProductAdoptionChartProps {
  data: ProductData[];
}

export function ProductAdoptionChart({ data }: ProductAdoptionChartProps) {
  const maxCustomers = Math.max(...data.map(d => d.potential_customers));
  
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="space-y-4">
        {data.map((product) => {
          const percentage = maxCustomers > 0 
            ? (product.potential_customers / maxCustomers) * 100 
            : 0;
          
          return (
            <div key={product.product_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {product.product_name}
                </span>
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">
                    {product.potential_customers}
                  </span>
                  {' potential customers'}
                  <span className="text-green-600 ml-2">
                    (${product.potential_mrr.toLocaleString()}/mo)
                  </span>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Task 6: Whitespace Opportunity List Component

Create `src/components/analytics/WhitespaceOpportunityList.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles, DollarSign } from 'lucide-react';

interface Opportunity {
  company_id: string;
  company_name: string;
  current_products: string[];
  missing_products: {
    product_name: string;
    product_slug: string;
    estimated_mrr: number;
    fit_score: number;
    fit_reasons: string[];
  }[];
  total_potential_mrr: number;
  priority_score: number;
}

interface WhitespaceOpportunityListProps {
  opportunities: Opportunity[];
}

export function WhitespaceOpportunityList({ opportunities }: WhitespaceOpportunityListProps) {
  if (opportunities.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        No expansion opportunities found.
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Current Products</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Opportunities</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Potential MRR</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Fit</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {opportunities.map((opp) => (
            <tr key={opp.company_id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link 
                  href={`/companies/${opp.company_id}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {opp.company_name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {opp.current_products.slice(0, 3).map((product, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
                    >
                      {product}
                    </span>
                  ))}
                  {opp.current_products.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{opp.current_products.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {opp.missing_products.slice(0, 2).map((product, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1"
                      title={product.fit_reasons.join(', ')}
                    >
                      <Sparkles className="w-3 h-3" />
                      {product.product_name}
                    </span>
                  ))}
                  {opp.missing_products.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{opp.missing_products.length - 2} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium text-green-600">
                  ${opp.total_potential_mrr.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <FitScoreBadge score={opp.priority_score} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${opp.company_id}`}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FitScoreBadge({ score }: { score: number }) {
  let bgColor = 'bg-gray-100 text-gray-600';
  if (score >= 80) bgColor = 'bg-green-100 text-green-700';
  else if (score >= 60) bgColor = 'bg-yellow-100 text-yellow-700';
  else if (score >= 40) bgColor = 'bg-orange-100 text-orange-700';
  
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${bgColor}`}>
      {score}%
    </span>
  );
}
```

---

## Task 7: Main Dashboard Widget

Create `src/components/dashboard/ExpansionWidget.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { TrendingUp, ChevronRight, Sparkles } from 'lucide-react';

interface ExpansionWidgetProps {
  stats: {
    adoption_rate: number;
    customers_without_ai_products: number;
    total_whitespace_mrr: number;
  };
  topOpportunities: {
    company_id: string;
    company_name: string;
    total_potential_mrr: number;
    priority_score: number;
  }[];
}

export function ExpansionWidget({ stats, topOpportunities }: ExpansionWidgetProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h3 className="font-medium text-gray-900">Expansion Opportunities</h3>
        </div>
        <Link 
          href="/analytics/whitespace"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.adoption_rate}%</div>
            <div className="text-xs text-gray-500">AI Adoption</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.customers_without_ai_products}
            </div>
            <div className="text-xs text-gray-500">Untapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${(stats.total_whitespace_mrr / 1000).toFixed(0)}k
            </div>
            <div className="text-xs text-gray-500">Potential MRR</div>
          </div>
        </div>
        
        {/* Top Opportunities */}
        <div className="space-y-2">
          {topOpportunities.slice(0, 5).map((opp) => (
            <Link
              key={opp.company_id}
              href={`/companies/${opp.company_id}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">
                  {opp.company_name}
                </span>
              </div>
              <span className="text-sm text-green-600 font-medium">
                +${opp.total_potential_mrr}/mo
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 8: Prospecting Pipeline Page

Create `src/app/(dashboard)/prospecting/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Users, Building2 } from 'lucide-react';

export default async function ProspectingPage() {
  const supabase = await createClient();
  
  // Get prospecting pipeline entries
  const { data: prospects } = await supabase
    .from('prospecting_pipeline')
    .select(`
      *,
      company:companies(id, name, domain, industry),
      owner:users(id, name)
    `)
    .order('created_at', { ascending: false });
  
  // Group by stage
  const stages = ['lead', 'qualified', 'meeting_scheduled', 'proposal_sent', 'negotiating'];
  const stageLabels: Record<string, string> = {
    lead: 'New Lead',
    qualified: 'Qualified',
    meeting_scheduled: 'Meeting Set',
    proposal_sent: 'Proposal Sent',
    negotiating: 'Negotiating'
  };
  
  const prospectsByStage = stages.map(stage => ({
    stage,
    label: stageLabels[stage],
    prospects: (prospects || []).filter(p => p.stage === stage)
  }));
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospecting Pipeline</h1>
          <p className="text-gray-500">New business opportunities (non-VFP)</p>
        </div>
        <Link
          href="/prospecting/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Prospect
        </Link>
      </div>
      
      {/* Pipeline Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {prospectsByStage.map(({ stage, label, prospects }) => (
          <div key={stage} className="flex-shrink-0 w-72">
            <div className="bg-gray-100 rounded-t-xl px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{label}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {prospects.length}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-b-xl p-2 min-h-[400px] space-y-2">
              {prospects.map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} />
              ))}
              
              {prospects.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No prospects
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: any }) {
  return (
    <Link 
      href={`/prospecting/${prospect.id}`}
      className="block bg-white rounded-lg border p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 mb-2">
        <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {prospect.company?.name || prospect.company_name}
          </div>
          {prospect.company?.industry && (
            <div className="text-xs text-gray-500">{prospect.company.industry}</div>
          )}
        </div>
      </div>
      
      {prospect.estimated_value && (
        <div className="text-sm text-green-600 font-medium">
          ${prospect.estimated_value.toLocaleString()}
        </div>
      )}
      
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>{prospect.source || 'Direct'}</span>
        {prospect.owner && <span>{prospect.owner.name}</span>}
      </div>
    </Link>
  );
}
```

---

## Task 9: Add Navigation Links

Update sidebar navigation to include new pages:

```tsx
// In your sidebar/navigation component, add:

// Analytics section
{
  label: 'Analytics',
  icon: BarChart3,
  items: [
    { href: '/analytics/whitespace', label: 'Whitespace Analysis' },
    { href: '/analytics/adoption', label: 'Product Adoption' },
  ]
}

// Add Prospecting to main nav
{ href: '/prospecting', label: 'Prospecting', icon: Target }
```

---

## Task 10: Update Main Dashboard

In your main dashboard page, add the expansion widget:

```tsx
import { analyzeWhitespace, getWhitespaceOpportunities } from '@/lib/analytics/whitespaceAnalyzer';
import { ExpansionWidget } from '@/components/dashboard/ExpansionWidget';

// In the page component:
const whitespaceStats = await analyzeWhitespace();
const topOpportunities = await getWhitespaceOpportunities({ limit: 5 });

// In the JSX:
<ExpansionWidget 
  stats={whitespaceStats}
  topOpportunities={topOpportunities}
/>
```

---

## Verification

1. Visit `/analytics/whitespace` - Should show adoption stats and opportunities
2. See product adoption chart with potential customers
3. Click an opportunity → Goes to company page
4. Visit `/prospecting` - Should show pipeline kanban
5. Main dashboard shows expansion widget
6. TypeScript compiles clean: `npx tsc --noEmit`

---

## Success Criteria

- [ ] `/analytics/whitespace` page renders with real data
- [ ] Whitespace stats show VFP customer count, adoption rate
- [ ] Product adoption chart shows opportunities by product
- [ ] Opportunity list shows companies with fit scores
- [ ] `/prospecting` page shows pipeline kanban
- [ ] Dashboard has expansion widget
- [ ] Navigation updated with new links
- [ ] TypeScript compiles clean
