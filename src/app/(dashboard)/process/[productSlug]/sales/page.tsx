import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productSlug: string }>;
}

/**
 * Sales Process Route
 *
 * Redirects to the existing Proven Process editor at /products/[slug]/process
 * This maintains backwards compatibility while providing a unified URL structure.
 */
export default async function SalesProcessPage({ params }: Props) {
  const { productSlug } = await params;

  // Redirect to the existing proven process editor
  redirect(`/products/${productSlug}/process`);
}
