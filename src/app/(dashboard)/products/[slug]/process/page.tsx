import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProvenProcessEditor } from '@/components/products/ProvenProcessEditor';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProvenProcessPage({ params }: Props) {
  const supabase = await createClient();
  const { slug } = await params;

  const { data: product } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(*)
    `)
    .eq('slug', slug)
    .single();

  if (!product) notFound();

  // Normalize stages to ensure arrays are never null
  const stages = (product.stages || [])
    .sort((a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order)
    .map((stage: Record<string, unknown>) => ({
      ...stage,
      pitch_points: stage.pitch_points || [],
      objection_handlers: stage.objection_handlers || [],
      resources: stage.resources || [],
    }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
            <h1 className="text-xl font-normal text-gray-900">Proven Process</h1>
            <p className="text-sm text-gray-500">
              Define the sales stages, pitch points, and objection handlers for {product.name}
            </p>
          </div>
        </div>
      </div>

      <ProvenProcessEditor product={product} initialStages={stages} />
    </div>
  );
}
