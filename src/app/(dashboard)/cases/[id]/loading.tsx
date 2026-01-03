export default function CaseDetailLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-2" />
          <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-3 mt-2">
            <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-9 w-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-9 w-24 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-50 rounded animate-pulse mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* SLA Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-24 bg-gray-50 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
                  <div className="h-4 w-8 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
