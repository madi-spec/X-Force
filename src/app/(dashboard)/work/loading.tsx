export default function WorkLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] flex animate-pulse">
      {/* Left column: Queue selector */}
      <div className="w-72 border-r border-gray-200 bg-gray-50">
        <div className="p-4 border-b border-gray-200">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded mt-1" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <div className="h-8 w-8 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-100 rounded mt-1" />
              </div>
              <div className="h-4 w-6 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Middle column: Queue items */}
      <div className="flex-1 bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-16 bg-gray-100 rounded mt-1" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-200 border-l-4 border-l-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
              <div className="h-4 w-48 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-64 bg-gray-100 rounded" />
              <div className="flex gap-3 mt-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-3 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
