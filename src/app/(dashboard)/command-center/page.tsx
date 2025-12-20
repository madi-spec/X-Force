'use client';

import { YourDayView } from '@/components/commandCenter';

export default function CommandCenterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <YourDayView />
      </div>
    </div>
  );
}
