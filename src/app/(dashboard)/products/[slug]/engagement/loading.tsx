export default function EngagementLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-1" />
        </div>
      </div>

      {/* Board Skeleton */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col w-80 shrink-0">
              {/* Column Header */}
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-6 bg-gray-100 rounded animate-pulse" />
              </div>

              {/* Column Content */}
              <div className="flex-1 rounded-xl bg-gray-50/50 p-2 min-h-[200px] space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-gray-100 rounded" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                      </div>
                      <div className="h-5 w-12 bg-gray-100 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-12 bg-gray-100 rounded" />
                      <div className="h-4 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
