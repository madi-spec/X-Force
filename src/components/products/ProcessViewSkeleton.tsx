'use client';

function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#e6eaf0] p-3.5 shadow-sm">
      <div className="w-3/4 h-4 bg-[#eef2f7] rounded animate-pulse mb-2" />
      <div className="w-1/2 h-3 bg-[#eef2f7] rounded animate-pulse mb-3" />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-16 h-5 bg-[#eef2f7] rounded animate-pulse" />
        <div className="w-20 h-5 bg-[#eef2f7] rounded animate-pulse" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#e6eaf0]">
        <div className="w-12 h-3 bg-[#eef2f7] rounded animate-pulse" />
        <div className="w-6 h-6 bg-[#eef2f7] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

function ColumnSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e6eaf0]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#eef2f7] rounded animate-pulse" />
          <div className="w-24 h-4 bg-[#eef2f7] rounded animate-pulse" />
          <div className="w-6 h-5 bg-[#eef2f7] rounded-full animate-pulse ml-auto" />
        </div>
      </div>
      <div className="bg-[#f6f8fb] p-3 space-y-3 min-h-[400px]">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ProcessViewSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <ColumnSkeleton count={2} />
      <ColumnSkeleton count={3} />
      <ColumnSkeleton count={4} />
    </div>
  );
}
