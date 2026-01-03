'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Workflow,
  Target,
  Rocket,
  HeartHandshake,
  Ticket,
  ChevronRight,
  Plus,
  Settings2,
  ArrowRight,
  Clock,
  CheckCircle2,
  Package,
  ExternalLink,
  Construction,
} from 'lucide-react';
import { PROCESS_CATEGORIES, ProcessCategory, ProductWithProcesses } from '@/lib/process';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  sla_days: number | null;
  is_terminal: boolean;
}

interface Process {
  id: string;
  name: string;
  process_type: string;
  version: number;
  status: string;
  product_process_stages: Stage[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  is_sellable: boolean;
  processes?: Process[];
  product_processes?: Process[];
}

interface Playbook {
  type: string;
  products: Product[];
}

interface ProcessStudioProps {
  playbooks: Playbook[];
  allProducts: Product[];
}

const iconMap: Record<string, typeof Target> = {
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
};

function ProcessTypeCard({
  category,
  productSlug,
  process,
  productColor,
}: {
  category: (typeof PROCESS_CATEGORIES)[0];
  productSlug: string;
  process: Process | null;
  productColor: string | null;
}) {
  const Icon = iconMap[category.icon] || Workflow;
  const stages = process?.product_process_stages || [];
  const isImplemented = category.isImplemented;
  const href = category.editorPath(productSlug);

  return (
    <Link
      href={href}
      className={cn(
        'block p-4 rounded-xl border transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        isImplemented
          ? 'bg-white border-gray-200 hover:border-gray-300'
          : 'bg-gray-50 border-dashed border-gray-300 hover:border-gray-400'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', category.bgColor)}>
          <Icon className={cn('h-4 w-4', category.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 text-sm">{category.label}</h4>
            {!isImplemented && (
              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{category.description}</p>

          {process ? (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{stages.length} stages</span>
                <span>·</span>
                <span>v{process.version}</span>
                {process.status === 'published' && (
                  <>
                    <span>·</span>
                    <span className="text-green-600">Published</span>
                  </>
                )}
              </div>

              {/* Stage mini-preview */}
              {stages.length > 0 && (
                <div className="flex items-center gap-1 mt-2 overflow-hidden">
                  {stages
                    .sort((a, b) => a.stage_order - b.stage_order)
                    .slice(0, 4)
                    .map((stage, idx) => (
                      <div key={stage.id} className="flex items-center shrink-0">
                        <div
                          className={cn(
                            'px-2 py-1 rounded text-[10px] font-medium truncate max-w-[80px]',
                            stage.is_terminal
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {stage.name}
                        </div>
                        {idx < Math.min(stages.length - 1, 3) && (
                          <ArrowRight className="h-2.5 w-2.5 text-gray-300 mx-0.5 shrink-0" />
                        )}
                      </div>
                    ))}
                  {stages.length > 4 && (
                    <span className="text-[10px] text-gray-400 ml-1">
                      +{stages.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              {isImplemented ? (
                <>
                  <Plus className="h-3 w-3" />
                  <span>Configure process</span>
                </>
              ) : (
                <>
                  <Construction className="h-3 w-3" />
                  <span>Not yet available</span>
                </>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
      </div>
    </Link>
  );
}

function ProductProcessCard({ product, playbooks }: { product: Product; playbooks: Playbook[] }) {
  // Get processes for this product from playbooks
  const getProcess = (type: ProcessCategory): Process | null => {
    const playbook = playbooks.find((p) => p.type === type);
    if (!playbook) return null;

    const productWithProcesses = playbook.products.find((p) => p.id === product.id);
    return productWithProcesses?.processes?.[0] || null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Product Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: product.color || '#6B7280' }}
          >
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900">{product.name}</h3>
            <p className="text-xs text-gray-500 truncate">
              {product.description || 'Configure playbooks for this product'}
            </p>
          </div>
          <Link
            href={`/products/${product.slug}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="View product details"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Process Types Grid */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {PROCESS_CATEGORIES.map((category) => (
          <ProcessTypeCard
            key={category.id}
            category={category}
            productSlug={product.slug}
            process={getProcess(category.id)}
            productColor={product.color || null}
          />
        ))}
      </div>
    </div>
  );
}

export function ProcessStudio({ playbooks, allProducts }: ProcessStudioProps) {
  const [viewMode, setViewMode] = useState<'products' | 'playbooks'>('products');
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs = [
    { key: 'all', label: 'All Playbooks' },
    { key: 'sales', label: 'Sales' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'support', label: 'Support' },
    { key: 'engagement', label: 'Engagement' },
  ];

  const totalProcesses = playbooks.reduce(
    (sum, pb) => sum + pb.products.reduce((s, p) => s + (p.processes?.length || 0), 0),
    0
  );

  // Sort products by name
  const sortedProducts = [...allProducts].sort((a, b) => a.name.localeCompare(b.name));

  // Debug: log on client
  console.log('[ProcessStudio] allProducts:', allProducts.length, 'sortedProducts:', sortedProducts.length);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Process Studio</h1>
          <p className="text-xs text-gray-500 mt-1">
            {totalProcesses} playbooks across {allProducts.length} products
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setViewMode('products')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'products'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            By Product
          </button>
          <button
            onClick={() => setViewMode('playbooks')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'playbooks'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            By Type
          </button>
        </div>
      </div>

      {viewMode === 'products' ? (
        /* Products View */
        <div className="space-y-6">
          {sortedProducts.map((product) => (
            <ProductProcessCard key={product.id} product={product} playbooks={playbooks} />
          ))}

          {sortedProducts.length === 0 && (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-1">No Products Found</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                Active, sellable products will appear here. Check the Products page to ensure products are configured correctly.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Package className="h-4 w-4" />
                View Products
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Playbooks View (original) */
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === tab.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Playbook Sections */}
          {(activeTab === 'all'
            ? playbooks
            : playbooks.filter((p) => p.type === activeTab)
          ).map((playbook) => (
            <PlaybookSection
              key={playbook.type}
              playbook={playbook}
              onSwitchToProducts={() => setViewMode('products')}
            />
          ))}
        </>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/products"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            Manage Products
          </Link>
        </div>
      </div>
    </div>
  );
}

// Playbooks view section (original implementation)
const processTypeConfig: Record<
  string,
  { label: string; icon: typeof Target; color: string; bgColor: string; description: string }
> = {
  sales: {
    label: 'Sales',
    icon: Target,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    description: 'Lead qualification through closed-won/lost',
  },
  onboarding: {
    label: 'Onboarding',
    icon: Rocket,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'New customer activation and training',
  },
  support: {
    label: 'Support',
    icon: Ticket,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: 'Issue resolution and customer success',
  },
  engagement: {
    label: 'Engagement',
    icon: HeartHandshake,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Ongoing customer health and expansion',
  },
};

function ProcessCard({ process, productSlug }: { process: Process; productSlug: string }) {
  const stages = (process.product_process_stages || []).sort(
    (a, b) => a.stage_order - b.stage_order
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">{process.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {stages.length} stages · v{process.version}
            </p>
          </div>
          <Link
            href={`/products/${productSlug}/process?type=${process.process_type}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stage Flow */}
      <div className="p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center shrink-0">
              <div
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium',
                  stage.is_terminal
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                )}
              >
                <div className="flex items-center gap-1.5">
                  {stage.is_terminal ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : stage.sla_days ? (
                    <Clock className="h-3 w-3 text-gray-400" />
                  ) : null}
                  <span>{stage.name}</span>
                </div>
                {stage.sla_days && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{stage.sla_days}d SLA</p>
                )}
              </div>
              {index < stages.length - 1 && (
                <ArrowRight className="h-3 w-3 text-gray-300 mx-1 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaybookSection({
  playbook,
  onSwitchToProducts
}: {
  playbook: Playbook;
  onSwitchToProducts: () => void;
}) {
  const config = processTypeConfig[playbook.type] || processTypeConfig.sales;
  const Icon = config.icon;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('p-2 rounded-lg', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{config.label} Playbooks</h3>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>
      </div>

      {playbook.products.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <Workflow className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No {config.label.toLowerCase()} processes configured</p>
          <button
            onClick={onSwitchToProducts}
            className="mt-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
          >
            <Plus className="h-3 w-3" />
            Create {config.label} Process
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {playbook.products.map((product) =>
            product.processes?.map((process) => (
              <ProcessCard key={process.id} process={process} productSlug={product.slug} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
