export default function CasesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mt-1" />
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Stats Bar Skeleton */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Filters Bar Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-10 flex-1 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Case', 'Company', 'Status', 'Severity', 'SLA', 'Owner', 'Opened', ''].map((header, i) => (
                <th key={i} className="px-6 py-3 text-left">
                  <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[...Array(8)].map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-50 rounded animate-pulse mt-1" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-7 w-16 bg-gray-100 rounded-xl animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
