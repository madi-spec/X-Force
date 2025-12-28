import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function DealsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
