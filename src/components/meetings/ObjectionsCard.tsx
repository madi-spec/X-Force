'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { MeetingObjection } from '@/types';

interface ObjectionsCardProps {
  objections: MeetingObjection[];
}

export function ObjectionsCard({ objections }: ObjectionsCardProps) {
  if (objections.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Objections & Concerns</h3>
        </div>
        <p className="text-sm text-gray-500">No objections raised</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">Objections & Concerns</h3>
      </div>
      <ul className="space-y-4">
        {objections.map((objection, i) => (
          <li
            key={i}
            className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
          >
            <div className="flex items-start gap-2">
              {objection.resolved ? (
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {objection.objection}
                </p>
                <p className="text-xs text-gray-500 mt-1">{objection.context}</p>
                {objection.howAddressed && (
                  <p className="text-xs text-green-700 mt-1 bg-green-50 px-2 py-1 rounded">
                    Response: {objection.howAddressed}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
