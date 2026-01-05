import type { MeetingsStats } from '@/types/meetings';

interface StatsBarProps {
  stats: MeetingsStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const statItems = [
    {
      label: 'Today',
      value: stats.today_count,
      sublabel: 'meetings',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'This Week',
      value: stats.this_week_count,
      sublabel: 'scheduled',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Analyzed',
      value: stats.analyzed_count,
      sublabel: 'transcripts',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Action Items',
      value: stats.pending_actions_count,
      sublabel: 'pending',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {statItems.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bg} rounded-lg p-3 border border-gray-100`}
        >
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
            <span className="text-sm text-gray-500">{stat.sublabel}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
