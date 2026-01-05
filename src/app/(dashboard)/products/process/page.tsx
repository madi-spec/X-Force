import { Suspense } from 'react';
import { ProcessViewContainer } from '@/components/products/ProcessViewContainer';
import { ProcessViewSkeleton } from '@/components/products/ProcessViewSkeleton';

export const metadata = { title: 'Products Process | X-FORCE' };

export default function ProductsProcessPage() {
  return (
    <Suspense fallback={<ProcessViewSkeleton />}>
      <ProcessViewContainer />
    </Suspense>
  );
}
