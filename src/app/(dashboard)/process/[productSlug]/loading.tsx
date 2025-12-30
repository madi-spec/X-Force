export default function ProductProcessLoading() {
  return (
    <div className="animate-pulse">
      {/* Back link skeleton */}
      <div className="h-4 w-40 bg-gray-200 rounded mb-6" />

      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-14 w-14 bg-gray-200 rounded-xl" />
        <div>
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
        </div>
      </div>

      {/* Process types grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-6 bg-white rounded-xl border border-gray-200"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-gray-200 rounded-xl" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-48 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-100 rounded mt-4" />
              </div>
              <div className="h-5 w-5 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick links skeleton */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="flex gap-3">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
