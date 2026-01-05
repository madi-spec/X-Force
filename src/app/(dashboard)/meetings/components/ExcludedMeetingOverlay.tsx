'use client';

import { EyeOff, RotateCcw } from 'lucide-react';

interface ExcludedMeetingOverlayProps {
  onRestore: () => void;
  isPending?: boolean;
}

export function ExcludedMeetingOverlay({
  onRestore,
  isPending = false,
}: ExcludedMeetingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
          <EyeOff className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 mb-2">Meeting excluded</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          disabled={isPending}
          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 mx-auto transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </button>
      </div>
    </div>
  );
}
