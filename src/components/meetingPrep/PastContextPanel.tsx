'use client';

import Link from 'next/link';
import { History, Briefcase, Brain, FileAudio, Calendar } from 'lucide-react';
import type { PastContextLink } from '@/lib/meetingPrep/buildEnhancedPrep';

interface PastContextPanelProps {
  links: PastContextLink[];
}

const TYPE_ICONS = {
  deal: Briefcase,
  intelligence: Brain,
  transcript: FileAudio,
  meeting: Calendar,
};

const TYPE_COLORS = {
  deal: 'text-purple-600 bg-purple-50',
  intelligence: 'text-blue-600 bg-blue-50',
  transcript: 'text-green-600 bg-green-50',
  meeting: 'text-amber-600 bg-amber-50',
};

export function PastContextPanel({ links }: PastContextPanelProps) {
  if (links.length === 0) {
    return null; // Don't show empty panel
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-gray-400" />
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Past Context
        </h2>
      </div>

      <div className="space-y-2">
        {links.map((link, idx) => {
          const Icon = TYPE_ICONS[link.type];
          const colorClass = TYPE_COLORS[link.type];

          return (
            <Link
              key={idx}
              href={link.url}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 hover:-translate-y-0.5 transition-all group"
            >
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
