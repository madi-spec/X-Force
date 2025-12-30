import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProcessEditor } from '@/components/process/ProcessEditor';

interface Props {
  params: Promise<{ productSlug: string }>;
}

export default async function EngagementProcessPage({ params }: Props) {
  const { productSlug } = await params;
  const supabase = await createClient();

  // Get product
  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, slug, color')
    .eq('slug', productSlug)
    .single();

  if (error || !product) {
    notFound();
  }

  // Get existing process and stages
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', product.id)
    .eq('process_type', 'engagement')
    .in('status', ['published', 'draft'])
    .order('version', { ascending: false })
    .limit(1)
    .single();

  let initialStages: { id: string; name: string; description: string; order: number; config: Record<string, unknown> }[] = [];

  if (process) {
    const { data: stages } = await supabase
      .from('product_process_stages')
      .select('id, name, description, stage_order')
      .eq('process_id', process.id)
      .order('stage_order');

    initialStages = (stages || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      order: s.stage_order,
      config: {},
    }));
  }

  return (
    <ProcessEditor
      productSlug={product.slug}
      productName={product.name}
      productColor={product.color}
      processType="engagement"
      initialStages={initialStages}
    />
  );
}
