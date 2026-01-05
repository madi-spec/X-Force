export default function MeetingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-28 bg-gray-200 rounded-lg" />
              <div className="h-10 w-36 bg-gray-200 rounded-lg" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-3 h-20" />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Upcoming section skeleton */}
        <section>
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 h-24"
              />
            ))}
          </div>
        </section>

        {/* Past section skeleton */}
        <section>
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 h-24"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
