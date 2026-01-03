export default function ReportsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-28 bg-gray-100 rounded animate-pulse mt-3" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mt-2" />
              </div>
              <div className="h-11 w-11 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Customer health skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mx-auto" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mt-2 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
