import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ productSlug: string }>;
}

/**
 * Onboarding Process Route
 *
 * Redirects to the unified Process Editor with onboarding tab selected.
 * Maintains backwards compatibility.
 */
export default async function OnboardingProcessPage({ params }: Props) {
  const { productSlug } = await params;
  redirect(`/products/${productSlug}/process?process=onboarding`);
}
