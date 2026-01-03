import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productSlug: string }>;
}

/**
 * Support Process Route
 *
 * Redirects to the unified Process Editor with support tab selected.
 * Maintains backwards compatibility.
 */
export default async function SupportProcessPage({ params }: Props) {
  const { productSlug } = await params;
  redirect(`/products/${productSlug}/process?process=support`);
}
