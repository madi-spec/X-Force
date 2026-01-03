export default function CustomersLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Search skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* List skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
              <div>
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mt-2" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
