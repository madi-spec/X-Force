import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Package, Target, Rocket, Ticket, HeartHandshake, ChevronRight, ArrowLeft } from 'lucide-react';
import { PROCESS_CATEGORIES } from '@/lib/process';

interface Props {
  params: Promise<{ productSlug: string }>;
}

const iconMap: Record<string, typeof Target> = {
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
};

export default async function ProductProcessPage({ params }: Props) {
  const { productSlug } = await params;
  const supabase = await createClient();

  // Fetch product with processes
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      description,
      color,
      is_sellable,
      product_processes (
        id,
        name,
        process_type,
        version,
        status,
        product_process_stages (
          id,
          name,
          stage_order,
          is_terminal
        )
      )
    `)
    .eq('slug', productSlug)
    .single();

  if (error || !product) {
    notFound();
  }

  // Get process counts by type
  const getProcessForType = (type: string) => {
    return (product.product_processes || []).find(
      (p) => p.process_type === type && p.status === 'published'
    );
  };

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/process"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Process Studio
      </Link>

      {/* Product Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: product.color || '#6B7280' }}
        >
          <Package className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-normal text-gray-900">{product.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {product.description || 'Configure playbooks for this product'}
          </p>
        </div>
      </div>

      {/* Process Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROCESS_CATEGORIES.map((category) => {
          const Icon = iconMap[category.icon] || Target;
          const process = getProcessForType(category.id);
          const stages = process?.product_process_stages || [];
          const href = category.editorPath(productSlug);

          return (
            <Link
              key={category.id}
              href={href}
              className={`
                block p-6 rounded-xl border transition-all
                hover:shadow-md hover:-translate-y-0.5
                ${category.isImplemented
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 border-dashed border-gray-300 hover:border-gray-400'
                }
              `}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${category.bgColor}`}>
                  <Icon className={`h-6 w-6 ${category.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{category.label}</h3>
                    {!category.isImplemented && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>

                  {process ? (
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                      <span>{stages.length} stages</span>
                      <span>·</span>
                      <span>v{process.version}</span>
                      <span className="text-green-600">Published</span>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-400">
                      {category.isImplemented ? 'Click to configure' : 'Not yet available'}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Product Quick Links */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Product Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/products/${productSlug}`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View Product →
          </Link>
          <Link
            href={`/products/${productSlug}/engagement`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Engagement Board →
          </Link>
        </div>
      </div>
    </div>
  );
}
