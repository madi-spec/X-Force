import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productSlug: string }>;
}

/**
 * Sales Process Route
 *
 * Redirects to the unified Process Editor with sales tab selected.
 * Maintains backwards compatibility.
 */
export default async function SalesProcessPage({ params }: Props) {
  const { productSlug } = await params;
  redirect(`/products/${productSlug}/process?process=sales`);
}
