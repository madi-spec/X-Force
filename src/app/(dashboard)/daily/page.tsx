'use client';

import { DailyDriverView } from '@/components/dailyDriver';

export default function DailyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <DailyDriverView />
      </div>
    </div>
  );
}
