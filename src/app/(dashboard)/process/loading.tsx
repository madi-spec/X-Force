export default function ProcessLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-56 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Playbook sections skeleton */}
      {[1, 2].map((section) => (
        <div key={section} className="mb-8">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 bg-gray-200 rounded-lg animate-pulse" />
            <div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse mt-1" />
            </div>
          </div>

          {/* Process cards skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((card) => (
              <div
                key={card}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-2" />
                    </div>
                    <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((stage) => (
                      <div key={stage} className="flex items-center">
                        <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
                        {stage < 4 && <div className="h-3 w-3 bg-gray-200 rounded mx-1 animate-pulse" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Quick actions skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
        <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-3" />
        <div className="flex gap-2">
          <div className="h-10 w-36 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
