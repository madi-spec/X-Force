'use client';

import { EyeOff, Eye } from 'lucide-react';

interface ExcludedBannerProps {
  excludedCount: number;
  showExcluded: boolean;
  onToggle: () => void;
}

export function ExcludedBanner({
  excludedCount,
  showExcluded,
  onToggle,
}: ExcludedBannerProps) {
  if (excludedCount === 0) return null;

  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
        showExcluded
          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {showExcluded ? (
        <Eye className="w-4 h-4" />
      ) : (
        <EyeOff className="w-4 h-4" />
      )}
      {excludedCount} excluded
    </button>
  );
}
