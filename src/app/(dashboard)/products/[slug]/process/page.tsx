import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { UnifiedProcessEditor } from '@/components/process/UnifiedProcessEditor';

type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ process?: string }>;
}

export default async function ProcessEditorPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { slug } = await params;
  const sp = await searchParams;

  // Get initial process type from query param, default to 'sales'
  const initialProcessType = (sp.process as ProcessType) || 'sales';

  const { data: product } = await supabase
    .from('products')
    .select('id, name, slug, color, icon')
    .eq('slug', slug)
    .single();

  if (!product) notFound();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link
        href={`/products/${slug}`}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {product.name}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${product.color}20`, color: product.color || '#3B82F6' }}
          >
            {product.icon || '📦'}
          </div>
          <div>
            <h1 className="text-xl font-normal text-gray-900">Process Editor</h1>
            <p className="text-sm text-gray-500">
              Configure lifecycle processes for {product.name}
            </p>
          </div>
        </div>
      </div>

      <UnifiedProcessEditor
        product={product}
        initialProcessType={initialProcessType}
      />
    </div>
  );
}
