import { PageHeaderSkeleton, StatCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function LearningLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeaderSkeleton />

      {/* Tab Navigation Skeleton */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-32 mb-3" />
          ))}
        </div>
      </div>

      {/* Score Card Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-10 w-16 ml-auto" />
            <Skeleton className="h-3 w-20 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-2 w-full mt-4 rounded-full" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
