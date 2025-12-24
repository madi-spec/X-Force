import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Target, Clock, ChevronRight } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductProcessPage({ params }: Props) {
  const supabase = await createClient();
  const { slug } = await params;

  // Get product with stages
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(*)
    `)
    .eq('slug', slug)
    .single();

  if (error || !product) {
    notFound();
  }

  // Sort stages by order
  const stages = (product.stages || []).sort(
    (a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/products/${slug}`}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {product.name}
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${product.color}20`, color: product.color || '#3B82F6' }}
          >
            {product.icon || '📦'}
          </div>
          <div>
            <h1 className="text-xl font-normal text-gray-900">{product.name} - Proven Process</h1>
            <p className="text-sm text-gray-500">Sales stages and milestones for this product</p>
          </div>
        </div>
      </div>

      {/* Stages */}
      {stages.length > 0 ? (
        <div className="space-y-4">
          {stages.map((stage: any, index: number) => (
            <div
              key={stage.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Stage Number */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: product.color || '#3B82F6' }}
                >
                  {index + 1}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{stage.name}</h3>
                    {stage.typical_duration_days && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        ~{stage.typical_duration_days} days
                      </span>
                    )}
                  </div>

                  {stage.goal && (
                    <div className="flex items-start gap-2 mb-3">
                      <Target className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-600">{stage.goal}</p>
                    </div>
                  )}

                  {stage.exit_criteria && stage.exit_criteria.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Exit Criteria
                      </p>
                      <ul className="space-y-1">
                        {stage.exit_criteria.map((criteria: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            {criteria}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Arrow to next stage */}
                {index < stages.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No sales stages defined yet</p>
          <p className="text-sm text-gray-400">
            Sales stages help track prospects through your proven process.
          </p>
        </div>
      )}
    </div>
  );
}
