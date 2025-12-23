'use client';

import { useState } from 'react';
import {
  Users,
  Crown,
  Shield,
  UserCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Stakeholder } from '@/lib/intelligence/relationshipStore';

interface StakeholderMapProps {
  stakeholders: Stakeholder[];
  contacts?: Array<{
    id: string;
    name: string | null;
    email: string;
    title: string | null;
    phone: string | null;
  }>;
  onContactClick?: (contactId: string) => void;
}

const roleIcons: Record<string, React.ElementType> = {
  champion: Crown,
  decision_maker: Shield,
  influencer: UserCheck,
  blocker: AlertCircle,
  user: Users,
};

const roleColors: Record<string, string> = {
  champion: 'bg-green-100 text-green-700 border-green-200',
  decision_maker: 'bg-blue-100 text-blue-700 border-blue-200',
  influencer: 'bg-purple-100 text-purple-700 border-purple-200',
  blocker: 'bg-red-100 text-red-700 border-red-200',
  user: 'bg-gray-100 text-gray-700 border-gray-200',
};

const roleLabels: Record<string, string> = {
  champion: 'Champion',
  decision_maker: 'Decision Maker',
  influencer: 'Influencer',
  blocker: 'Blocker',
  user: 'End User',
};

const sentimentColors: Record<string, string> = {
  positive: 'text-green-600',
  neutral: 'text-gray-600',
  negative: 'text-red-600',
  unknown: 'text-gray-400',
};

export function StakeholderMap({
  stakeholders,
  contacts = [],
  onContactClick,
}: StakeholderMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxVisible = 6;

  // Merge stakeholder data with contact info
  const enrichedStakeholders = stakeholders.map((s) => {
    const contact = contacts.find((c) => c.id === s.contact_id);
    return {
      ...s,
      contactName: contact?.name || s.name,
      contactEmail: contact?.email,
      contactTitle: contact?.title,
      contactPhone: contact?.phone,
    };
  });

  // Sort by role priority
  const rolePriority: Record<string, number> = {
    champion: 1,
    decision_maker: 2,
    influencer: 3,
    blocker: 4,
    user: 5,
  };

  const sortedStakeholders = [...enrichedStakeholders].sort(
    (a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99)
  );

  const visibleStakeholders = isExpanded
    ? sortedStakeholders
    : sortedStakeholders.slice(0, maxVisible);

  const hasMore = sortedStakeholders.length > maxVisible;

  // Group by role for summary
  const roleGroups = stakeholders.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <h3 className="font-medium text-gray-900">
            Stakeholder Map ({stakeholders.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(roleGroups).map(([role, count]) => {
            const Icon = roleIcons[role] || Users;
            return (
              <div
                key={role}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border',
                  roleColors[role] || roleColors.user
                )}
                title={roleLabels[role] || role}
              >
                <Icon className="w-3 h-3" />
                <span>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stakeholder Grid */}
      {visibleStakeholders.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {visibleStakeholders.map((stakeholder, index) => {
            const Icon = roleIcons[stakeholder.role] || Users;
            const colorClass = roleColors[stakeholder.role] || roleColors.user;

            return (
              <div
                key={`${stakeholder.contact_id}-${index}`}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  'bg-gray-50',
                  'hover:bg-gray-100',
                  onContactClick && 'cursor-pointer'
                )}
                onClick={() =>
                  onContactClick && stakeholder.contact_id
                    ? onContactClick(stakeholder.contact_id)
                    : null
                }
              >
                <div className="flex items-start gap-3">
                  {/* Avatar Placeholder */}
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full border-2',
                      colorClass
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name and Role */}
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {stakeholder.contactName || 'Unknown'}
                      </p>
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded border',
                          colorClass
                        )}
                      >
                        {roleLabels[stakeholder.role] || stakeholder.role}
                      </span>
                    </div>

                    {/* Title */}
                    {stakeholder.contactTitle && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {stakeholder.contactTitle}
                      </p>
                    )}

                    {/* Sentiment and Last Interaction */}
                    <div className="flex items-center gap-3 mt-1.5">
                      {stakeholder.sentiment && (
                        <span
                          className={cn(
                            'text-xs',
                            sentimentColors[stakeholder.sentiment] ||
                              sentimentColors.unknown
                          )}
                        >
                          {stakeholder.sentiment}
                        </span>
                      )}
                      {stakeholder.last_interaction && (
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(stakeholder.last_interaction)}
                        </span>
                      )}
                    </div>

                    {/* Contact Actions */}
                    {(stakeholder.contactEmail || stakeholder.contactPhone) && (
                      <div className="flex items-center gap-2 mt-2">
                        {stakeholder.contactEmail && (
                          <a
                            href={`mailto:${stakeholder.contactEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                            title={stakeholder.contactEmail}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {stakeholder.contactPhone && (
                          <a
                            href={`tel:${stakeholder.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                            title={stakeholder.contactPhone}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {stakeholder.notes && (
                  <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                    {stakeholder.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-4">
          No stakeholders identified yet. They will be detected from meetings and emails.
        </p>
      )}

      {/* Show More/Less */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {sortedStakeholders.length - maxVisible} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
