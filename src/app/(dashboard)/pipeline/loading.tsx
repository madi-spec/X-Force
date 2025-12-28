import { PageHeaderSkeleton, PipelineSkeleton } from '@/components/ui/Skeleton';

export default function PipelineLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <PipelineSkeleton />
    </div>
  );
}
