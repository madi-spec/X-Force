'use client';

import { ExternalLink, Link2 } from 'lucide-react';
import type { SoftwareLink } from '@/lib/meetingPrep/buildEnhancedPrep';

interface SoftwareLinksPanelProps {
  links: SoftwareLink[];
}

export function SoftwareLinksPanel({ links }: SoftwareLinksPanelProps) {
  if (links.length === 0) {
    return null; // Don't show empty panel
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="h-4 w-4 text-gray-400" />
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Quick Links
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 hover:-translate-y-0.5 transition-all group"
          >
            {link.icon ? (
              <span className="text-xl">{link.icon}</span>
            ) : (
              <ExternalLink className="h-4 w-4 text-gray-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {link.name}
              </p>
              {link.description && (
                <p className="text-xs text-gray-500 truncate">{link.description}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
