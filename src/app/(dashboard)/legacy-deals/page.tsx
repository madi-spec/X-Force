'use client';

import { LegacyDealsView } from '@/components/legacyDeals';

export default function LegacyDealsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <LegacyDealsView />
      </div>
    </div>
  );
}
