import { redirect } from 'next/navigation';

/**
 * The /deals route now redirects to /products as part of the
 * product-centric migration. Legacy deals are available at /legacy-deals.
 */
export default function DealsPage() {
  redirect('/products');
}
