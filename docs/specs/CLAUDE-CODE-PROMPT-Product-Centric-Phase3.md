# Product-Centric Redesign: Phase 3 - Product UI

## Context

Read these first:
- `/docs/specs/X-FORCE-CRM-Project-State.md`
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

**Phase 1 Complete:** Database tables, products seeded
**Phase 2 Complete:** Customer data imported (1,390 company_products)

---

## Phase 3 Deliverables

1. ✅ Product Detail Page (`/products/[slug]`)
2. ✅ Pipeline View (companies grouped by stage)
3. ✅ Company Page Redesign (product status grid)
4. ✅ "Start Sale" Flow
5. ✅ Move Stage Action

---

## Task 1: Product Detail Page

Create `src/app/(dashboard)/products/[slug]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProductHeader } from '@/components/products/ProductHeader';
import { ProductPipeline } from '@/components/products/ProductPipeline';
import { ProductCustomers } from '@/components/products/ProductCustomers';
import { ProductStats } from '@/components/products/ProductStats';

interface Props {
  params: { slug: string };
  searchParams: { view?: string };
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const view = searchParams.view || 'pipeline';
  
  // Get product with stages
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(*),
      tiers:product_tiers(*),
      modules:products!parent_product_id(*)
    `)
    .eq('slug', params.slug)
    .single();
  
  if (error || !product) {
    notFound();
  }
  
  // Sort stages by order
  const stages = (product.stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);
  
  // Get pipeline (companies in sales)
  const { data: pipeline } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain, city, state),
      current_stage:product_sales_stages(id, name, slug, stage_order),
      owner:users(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });
  
  // Get active customers
  const { data: activeCustomers } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      tier:product_tiers(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false });
  
  // Get stats
  const stats = {
    active: activeCustomers?.length || 0,
    in_sales: pipeline?.length || 0,
    total_mrr: activeCustomers?.reduce((sum, c) => sum + (parseFloat(c.mrr) || 0), 0) || 0,
  };
  
  // Group pipeline by stage
  const pipelineByStage = stages.map((stage: any) => ({
    ...stage,
    companies: (pipeline || []).filter((p: any) => p.current_stage_id === stage.id),
  }));
  
  return (
    <div className="p-6">
      <ProductHeader product={product} />
      
      <ProductStats stats={stats} />
      
      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <a
          href={`/products/${params.slug}?view=pipeline`}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'pipeline' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pipeline ({stats.in_sales})
        </a>
        <a
          href={`/products/${params.slug}?view=customers`}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'customers' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active Customers ({stats.active})
        </a>
      </div>
      
      {view === 'pipeline' ? (
        <ProductPipeline 
          product={product}
          stages={pipelineByStage} 
        />
      ) : (
        <ProductCustomers 
          product={product}
          customers={activeCustomers || []} 
        />
      )}
    </div>
  );
}
```

---

## Task 2: Product Header Component

Create `src/components/products/ProductHeader.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';

interface ProductHeaderProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
}

export function ProductHeader({ product }: ProductHeaderProps) {
  return (
    <div className="mb-6">
      <Link 
        href="/products" 
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        All Products
      </Link>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${product.color}20`, color: product.color }}
          >
            {product.icon || '📦'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            {product.description && (
              <p className="text-gray-500">{product.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link
            href={`/products/${product.slug}/process`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Proven Process
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 3: Product Stats Component

Create `src/components/products/ProductStats.tsx`:

```tsx
'use client';

import { Users, TrendingUp, DollarSign, Target } from 'lucide-react';

interface ProductStatsProps {
  stats: {
    active: number;
    in_sales: number;
    total_mrr: number;
  };
}

export function ProductStats({ stats }: ProductStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
            <div className="text-sm text-gray-500">Active Customers</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Target className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.in_sales}</div>
            <div className="text-sm text-gray-500">In Pipeline</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ${stats.total_mrr.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Monthly Revenue</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ${Math.round(stats.total_mrr / Math.max(stats.active, 1)).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Avg MRR</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 4: Pipeline View Component

Create `src/components/products/ProductPipeline.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, 
  Clock, 
  User,
  MoreHorizontal,
  Play,
  Pause,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  companies: CompanyProduct[];
}

interface CompanyProduct {
  id: string;
  status: string;
  stage_entered_at: string | null;
  ai_sequence_active: boolean;
  company: {
    id: string;
    name: string;
    domain: string | null;
    city: string | null;
    state: string | null;
  };
  owner: {
    id: string;
    name: string;
  } | null;
}

interface ProductPipelineProps {
  product: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  stages: Stage[];
}

export function ProductPipeline({ product, stages }: ProductPipelineProps) {
  if (stages.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border">
        <p className="text-gray-500">No sales stages defined for this product.</p>
        <Link
          href={`/products/${product.slug}/process`}
          className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
        >
          Set up proven process →
        </Link>
      </div>
    );
  }
  
  const totalInPipeline = stages.reduce((sum, s) => sum + s.companies.length, 0);
  
  if (totalInPipeline === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border">
        <p className="text-gray-500 mb-4">No companies in the pipeline yet.</p>
        <Link
          href="/companies"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Find Companies to Sell To
        </Link>
      </div>
    );
  }
  
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex-shrink-0 w-80">
          {/* Stage Header */}
          <div className="bg-gray-100 rounded-t-xl px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {stage.name}
                </span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {stage.companies.length}
                </span>
              </div>
              {index < stages.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
            {stage.goal && (
              <p className="text-xs text-gray-500 mt-1">{stage.goal}</p>
            )}
          </div>
          
          {/* Stage Cards */}
          <div className="bg-gray-50 rounded-b-xl p-2 min-h-[400px] space-y-2">
            {stage.companies.map((cp) => (
              <PipelineCard 
                key={cp.id} 
                companyProduct={cp}
                productSlug={product.slug}
                productColor={product.color}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineCard({ 
  companyProduct: cp, 
  productSlug,
  productColor 
}: { 
  companyProduct: CompanyProduct;
  productSlug: string;
  productColor: string | null;
}) {
  const daysInStage = cp.stage_entered_at
    ? Math.floor((Date.now() - new Date(cp.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return (
    <div className="bg-white rounded-lg border p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <Link 
          href={`/companies/${cp.company.id}`}
          className="font-medium text-gray-900 hover:text-blue-600"
        >
          {cp.company.name}
        </Link>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      {cp.company.city && cp.company.state && (
        <p className="text-xs text-gray-500 mb-2">
          {cp.company.city}, {cp.company.state}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-gray-500">
            <Clock className="w-3 h-3" />
            {daysInStage}d
          </span>
          {cp.owner && (
            <span className="flex items-center gap-1 text-gray-500">
              <User className="w-3 h-3" />
              {cp.owner.name.split(' ')[0]}
            </span>
          )}
        </div>
        
        {cp.ai_sequence_active ? (
          <span className="flex items-center gap-1 text-green-600">
            <Play className="w-3 h-3" />
            AI Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-400">
            <Pause className="w-3 h-3" />
            Manual
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## Task 5: Active Customers Component

Create `src/components/products/ProductCustomers.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Customer {
  id: string;
  status: string;
  activated_at: string | null;
  mrr: string | null;
  seats: number | null;
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
  tier: {
    id: string;
    name: string;
  } | null;
}

interface ProductCustomersProps {
  product: {
    id: string;
    name: string;
    pricing_model: string | null;
  };
  customers: Customer[];
}

export function ProductCustomers({ product, customers }: ProductCustomersProps) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border">
        <p className="text-gray-500">No active customers yet.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Tier</th>
            {product.pricing_model === 'per_seat' && (
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Seats</th>
            )}
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">MRR</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Since</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link 
                  href={`/companies/${customer.company.id}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {customer.company.name}
                </Link>
                {customer.company.domain && (
                  <span className="text-xs text-gray-400 ml-2">
                    {customer.company.domain}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {customer.tier?.name || '—'}
              </td>
              {product.pricing_model === 'per_seat' && (
                <td className="px-4 py-3 text-sm text-gray-600">
                  {customer.seats || '—'}
                </td>
              )}
              <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                ${parseFloat(customer.mrr || '0').toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {customer.activated_at 
                  ? formatDistanceToNow(new Date(customer.activated_at), { addSuffix: true })
                  : '—'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Task 6: Company Page - Product Status Grid

Create `src/components/companies/CompanyProductsGrid.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  MinusCircle,
  ChevronRight,
  Play
} from 'lucide-react';

interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
  tier: {
    name: string;
  } | null;
  current_stage: {
    name: string;
  } | null;
  mrr: string | null;
  seats: number | null;
  activated_at: string | null;
}

interface AvailableProduct {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

interface CompanyProductsGridProps {
  companyId: string;
  companyProducts: CompanyProduct[];
  availableProducts: AvailableProduct[];
}

const STATUS_CONFIG = {
  active: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Active' },
  in_sales: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'In Sales' },
  in_onboarding: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Onboarding' },
  declined: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Declined' },
  churned: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Churned' },
  inactive: { icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Not Started' },
};

export function CompanyProductsGrid({ 
  companyId, 
  companyProducts, 
  availableProducts 
}: CompanyProductsGridProps) {
  // Get products the company doesn't have yet
  const activeProductIds = companyProducts.map(cp => cp.product.id);
  const missingProducts = availableProducts.filter(p => !activeProductIds.includes(p.id));
  
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Products</h3>
      </div>
      
      <div className="divide-y">
        {/* Active Products */}
        {companyProducts.map((cp) => {
          const config = STATUS_CONFIG[cp.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.inactive;
          const StatusIcon = config.icon;
          
          return (
            <div key={cp.id} className={`p-4 ${config.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${cp.product.color}20` }}
                  >
                    {cp.product.icon || '📦'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{cp.product.name}</span>
                      {cp.tier && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          {cp.tier.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={config.color}>{config.label}</span>
                      {cp.current_stage && cp.status === 'in_sales' && (
                        <span className="text-gray-500">• {cp.current_stage.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {cp.mrr && cp.status === 'active' && (
                    <span className="text-sm font-medium text-gray-900">
                      ${parseFloat(cp.mrr).toLocaleString()}/mo
                    </span>
                  )}
                  <Link
                    href={`/products/${cp.product.slug}`}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Products Not Yet Sold */}
        {missingProducts.map((product) => (
          <div key={product.id} className="p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg opacity-50"
                  style={{ backgroundColor: `${product.color}20` }}
                >
                  {product.icon || '📦'}
                </div>
                <div>
                  <span className="font-medium text-gray-400">{product.name}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <MinusCircle className="w-4 h-4 text-gray-300" />
                    <span className="text-gray-400">Not Started</span>
                  </div>
                </div>
              </div>
              
              <StartSaleButton companyId={companyId} productId={product.id} productName={product.name} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StartSaleButton({ 
  companyId, 
  productId, 
  productName 
}: { 
  companyId: string; 
  productId: string; 
  productName: string;
}) {
  const handleStartSale = async () => {
    if (!confirm(`Start selling ${productName} to this company?`)) return;
    
    const response = await fetch(`/api/companies/${companyId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        product_id: productId,
        status: 'in_sales'
      }),
    });
    
    if (response.ok) {
      window.location.reload();
    } else {
      alert('Failed to start sale');
    }
  };
  
  return (
    <button
      onClick={handleStartSale}
      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
    >
      Start Sale
    </button>
  );
}
```

---

## Task 7: Company Products API

Create `src/app/api/companies/[id]/products/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List products for a company
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: companyProducts, error } = await supabase
    .from('company_products')
    .select(`
      *,
      product:products(*),
      tier:product_tiers(*),
      current_stage:product_sales_stages(*)
    `)
    .eq('company_id', params.id)
    .order('created_at');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ companyProducts });
}

// POST - Start sale or add product to company
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { product_id, status = 'in_sales' } = body;
  
  if (!product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 });
  }
  
  // Check if already exists
  const { data: existing } = await supabase
    .from('company_products')
    .select('id')
    .eq('company_id', params.id)
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
      company_id: params.id,
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
```

---

## Task 8: Move Stage API

Create `src/app/api/company-products/[id]/move-stage/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { stage_id, outcome } = body;
  // outcome: 'next' | 'won' | 'declined'
  
  // Get current company_product
  const { data: cp, error: fetchError } = await supabase
    .from('company_products')
    .select(`
      *,
      current_stage:product_sales_stages(*),
      product:products(*)
    `)
    .eq('id', params.id)
    .single();
  
  if (fetchError || !cp) {
    return NextResponse.json({ error: 'Company product not found' }, { status: 404 });
  }
  
  let updateData: any = {};
  let historyEvent = '';
  
  if (outcome === 'won') {
    updateData = {
      status: 'in_onboarding',
      current_stage_id: null,
      stage_entered_at: null,
      onboarding_started_at: new Date().toISOString(),
    };
    historyEvent = 'status_changed';
  } else if (outcome === 'declined') {
    updateData = {
      status: 'declined',
      current_stage_id: null,
      stage_entered_at: null,
      declined_at: new Date().toISOString(),
    };
    historyEvent = 'status_changed';
  } else if (stage_id) {
    updateData = {
      current_stage_id: stage_id,
      stage_entered_at: new Date().toISOString(),
    };
    historyEvent = 'stage_changed';
  } else {
    return NextResponse.json({ error: 'stage_id or outcome required' }, { status: 400 });
  }
  
  // Update
  const { error: updateError } = await supabase
    .from('company_products')
    .update(updateData)
    .eq('id', params.id);
  
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  
  // Log history
  await supabase.from('company_product_history').insert({
    company_product_id: params.id,
    event_type: historyEvent,
    from_value: cp.current_stage?.name || cp.status,
    to_value: outcome || stage_id,
  });
  
  return NextResponse.json({ success: true });
}
```

---

## Task 9: Update Company Page

In your company detail page, add the products grid. Find where the company page is (likely `src/app/(dashboard)/companies/[id]/page.tsx`) and add:

```tsx
// At the top, import the component
import { CompanyProductsGrid } from '@/components/companies/CompanyProductsGrid';

// In the page component, fetch products
const { data: companyProducts } = await supabase
  .from('company_products')
  .select(`
    *,
    product:products(*),
    tier:product_tiers(*),
    current_stage:product_sales_stages(*)
  `)
  .eq('company_id', params.id);

const { data: availableProducts } = await supabase
  .from('products')
  .select('*')
  .eq('is_sellable', true)
  .eq('is_active', true)
  .order('display_order');

// In the JSX, add the grid (in a sidebar or main content area)
<CompanyProductsGrid
  companyId={params.id}
  companyProducts={companyProducts || []}
  availableProducts={availableProducts || []}
/>
```

---

## Task 10: Update Component Index

Create/update `src/components/products/index.ts`:

```typescript
export { ProductCard } from './ProductCard';
export { ProductHeader } from './ProductHeader';
export { ProductStats } from './ProductStats';
export { ProductPipeline } from './ProductPipeline';
export { ProductCustomers } from './ProductCustomers';
```

---

## Verification

1. Visit `/products` - Should show product cards with real stats
2. Click a product → `/products/[slug]` - Should show pipeline view
3. Toggle to "Active Customers" tab - Should show customer list
4. Visit a company page - Should show product status grid
5. Click "Start Sale" on a missing product - Should add to pipeline
6. TypeScript compiles clean: `npx tsc --noEmit`

---

## Success Criteria

- [ ] `/products/[slug]` page renders with pipeline
- [ ] Pipeline shows companies grouped by stage
- [ ] Active Customers tab shows customer list with MRR
- [ ] Company page shows product status grid
- [ ] "Start Sale" button works
- [ ] Stage transitions work (move stage API)
- [ ] History is logged for all changes
- [ ] TypeScript compiles clean
