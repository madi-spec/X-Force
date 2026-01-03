import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productSlug: string }>;
}

/**
 * Engagement Process Route
 *
 * Redirects to the unified Process Editor with engagement tab selected.
 * Maintains backwards compatibility.
 */
export default async function EngagementProcessPage({ params }: Props) {
  const { productSlug } = await params;
  redirect(`/products/${productSlug}/process?process=engagement`);
}
