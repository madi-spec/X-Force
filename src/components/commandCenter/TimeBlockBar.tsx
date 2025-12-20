'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TimeBlock } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface TimeBlockBarProps {
  blocks: TimeBlock[];
  workStartTime?: string; // HH:mm
  workEndTime?: string; // HH:mm
  showLabels?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TimeBlockBar({
  blocks,
  workStartTime = '09:00',
  workEndTime = '17:00',
  showLabels = true,
  height = 'md',
  className,
}: TimeBlockBarProps) {
  // Calculate timeline bounds
  const { startTime, endTime, totalMinutes } = useMemo(() => {
    const [startHour, startMin] = workStartTime.split(':').map(Number);
    const [endHour, endMin] = workEndTime.split(':').map(Number);

    const start = new Date();
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date();
    end.setHours(endHour, endMin, 0, 0);

    return {
      startTime: start,
      endTime: end,
      totalMinutes: (end.getTime() - start.getTime()) / 60000,
    };
  }, [workStartTime, workEndTime]);

  // Current time marker position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const minutesFromStart = (now.getTime() - startTime.getTime()) / 60000;
    if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null;
    return (minutesFromStart / totalMinutes) * 100;
  }, [startTime, totalMinutes]);

  // Hour markers
  const hourMarkers = useMemo(() => {
    const markers: { label: string; position: number }[] = [];
    const [startHour] = workStartTime.split(':').map(Number);
    const [endHour] = workEndTime.split(':').map(Number);

    for (let hour = startHour; hour <= endHour; hour++) {
      const hourDate = new Date(startTime);
      hourDate.setHours(hour, 0, 0, 0);
      const minutesFromStart = (hourDate.getTime() - startTime.getTime()) / 60000;
      const position = (minutesFromStart / totalMinutes) * 100;

      markers.push({
        label: formatHour(hour),
        position: Math.max(0, Math.min(100, position)),
      });
    }

    return markers;
  }, [workStartTime, workEndTime, startTime, totalMinutes]);

  const heightClasses = {
    sm: 'h-6',
    md: 'h-10',
    lg: 'h-14',
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Hour Labels */}
      {showLabels && (
        <div className="relative h-5 mb-1">
          {hourMarkers.map((marker, i) => (
            <span
              key={i}
              className="absolute text-xs text-gray-400 -translate-x-1/2"
              style={{ left: `${marker.position}%` }}
            >
              {marker.label}
            </span>
          ))}
        </div>
      )}

      {/* Timeline Bar */}
      <div
        className={cn(
          'relative w-full bg-gray-100 rounded-lg overflow-hidden',
          heightClasses[height]
        )}
      >
        {/* Blocks */}
        {blocks.map((block, index) => {
          const blockStart = new Date(block.start);
          const blockEnd = new Date(block.end);

          // Clamp to work hours
          const clampedStart = Math.max(blockStart.getTime(), startTime.getTime());
          const clampedEnd = Math.min(blockEnd.getTime(), endTime.getTime());

          if (clampedEnd <= clampedStart) return null;

          const startPercent =
            ((clampedStart - startTime.getTime()) / 60000 / totalMinutes) * 100;
          const widthPercent =
            ((clampedEnd - clampedStart) / 60000 / totalMinutes) * 100;

          return (
            <div
              key={index}
              className={cn(
                'absolute top-0 h-full transition-all duration-300',
                getBlockColor(block.type, block.is_external)
              )}
              style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
              }}
              title={getBlockTooltip(block)}
            >
              {/* Show meeting title for larger blocks */}
              {height === 'lg' && block.meeting_title && widthPercent > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium truncate px-1">
                  {block.meeting_title}
                </span>
              )}
            </div>
          );
        })}

        {/* Current Time Marker */}
        {currentTimePosition !== null && (
          <div
            className="absolute top-0 w-0.5 h-full bg-red-500 z-10"
            style={{ left: `${currentTimePosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
          </div>
        )}
      </div>

      {/* Legend */}
      {showLabels && (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-200" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-300" />
            <span>Meeting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-300" />
            <span>External</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-200" />
            <span>Prep</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPACT INLINE VERSION
// ============================================

interface TimeBlockBarInlineProps {
  blocks: TimeBlock[];
  className?: string;
}

export function TimeBlockBarInline({ blocks, className }: TimeBlockBarInlineProps) {
  return (
    <TimeBlockBar
      blocks={blocks}
      showLabels={false}
      height="sm"
      className={className}
    />
  );
}

// ============================================
// HELPERS
// ============================================

function getBlockColor(type: string, isExternal?: boolean): string {
  switch (type) {
    case 'available':
      return 'bg-emerald-200';
    case 'meeting':
      return isExternal ? 'bg-purple-300' : 'bg-blue-300';
    case 'prep':
      return 'bg-amber-200';
    case 'buffer':
      return 'bg-gray-300';
    default:
      return 'bg-gray-200';
  }
}

function getBlockTooltip(block: TimeBlock): string {
  const start = new Date(block.start);
  const end = new Date(block.end);
  const timeRange = `${formatTime(start)} - ${formatTime(end)}`;

  if (block.type === 'meeting' && block.meeting_title) {
    return `${block.meeting_title}\n${timeRange} (${block.duration_minutes} min)`;
  }

  if (block.type === 'prep' && block.meeting_title) {
    return `Prep for ${block.meeting_title}\n${timeRange}`;
  }

  if (block.type === 'available') {
    return `Available\n${timeRange} (${block.duration_minutes} min)`;
  }

  return timeRange;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour > 12) return `${hour - 12}p`;
  return `${hour}a`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
