import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function ContactsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
