'use client';

import { cn } from '@/lib/utils';

// Base skeleton pulse animation
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}

// Meeting Header Skeleton
export function MeetingHeaderSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          {/* Badge */}
          <Skeleton className="h-5 w-20 rounded-full" />
          {/* Title */}
          <Skeleton className="h-7 w-64 mt-2" />
          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {/* Join Button */}
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

// AI Prep Panel Skeleton
export function AIPrepPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Quick Context */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Objective */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-full ml-6" />
        <Skeleton className="h-4 w-3/4 ml-6 mt-2" />
      </div>

      {/* Talking Points */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2 ml-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      {/* Landmines */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 ml-6">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Collateral Panel Skeleton
export function CollateralPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-4 w-36 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Attendees Panel Skeleton
export function AttendeesPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <Skeleton className="h-3 w-40 mt-1" />
              <Skeleton className="h-3 w-48 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Software Links Panel Skeleton
export function SoftwareLinksPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Past Context Panel Skeleton
export function PastContextPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Notes Panel Skeleton
export function NotesPanelSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-4 w-16 mb-4" />
      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
        <Skeleton className="flex-1 h-8 rounded-md" />
        <Skeleton className="flex-1 h-8 rounded-md" />
      </div>
      {/* Textarea */}
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

// Full Page Loading Skeleton
export function MeetingPrepSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back link */}
        <Skeleton className="h-4 w-32 mb-6" />

        {/* Header */}
        <MeetingHeaderSkeleton />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <AIPrepPanelSkeleton />
            <CollateralPanelSkeleton />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <AttendeesPanelSkeleton />
            <SoftwareLinksPanelSkeleton />
            <PastContextPanelSkeleton />
            <NotesPanelSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
