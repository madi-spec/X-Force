'use client';

export function MeetingCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 border-l-4 border-l-gray-200 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Company badge */}
          <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
          {/* Subject */}
          <div className="h-5 w-3/4 bg-gray-200 rounded mb-3" />
          {/* Meta info */}
          <div className="flex gap-3">
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-4 w-12 bg-gray-100 rounded" />
            <div className="h-4 w-14 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        <div className="h-8 w-20 bg-gray-100 rounded-lg" />
        <div className="h-8 w-16 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

export function DateGroupSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="mb-6">
      {/* Date header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-6 bg-gray-100 rounded" />
      </div>
      {/* Cards */}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <MeetingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function UpcomingMeetingsSkeleton() {
  return (
    <section>
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <DateGroupSkeleton count={2} />
        <DateGroupSkeleton count={1} />
      </div>
    </section>
  );
}

export function PastMeetingsSkeleton() {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-28 bg-gray-200 rounded" />
        <div className="flex items-center gap-3">
          <div className="h-6 w-20 bg-gray-100 rounded" />
          <div className="h-7 w-28 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {/* Collapsible groups */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-b border-gray-100 last:border-b-0 py-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-6 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MeetingsHubSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-24 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-48 bg-gray-100 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-20 bg-gray-100 rounded-lg" />
            <div className="h-9 w-36 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        <UpcomingMeetingsSkeleton />
        <PastMeetingsSkeleton />
      </div>
    </div>
  );
}
