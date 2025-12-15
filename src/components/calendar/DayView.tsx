'use client';

import { cn } from '@/lib/utils';
import { CalendarEvent, getEventColor, formatEventTime, isSameDay } from './types';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 20;

export function DayView({ currentDate, events, onEventClick }: DayViewProps) {
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.metadata.start_time || event.occurred_at);
    return isSameDay(eventDate, currentDate);
  });

  const getEventPosition = (event: CalendarEvent) => {
    const startTime = new Date(event.metadata.start_time || event.occurred_at);
    const endTime = event.metadata.end_time
      ? new Date(event.metadata.end_time)
      : new Date(startTime.getTime() + 60 * 60 * 1000);

    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;

    const visibleStart = Math.max(startHour, START_HOUR);
    const visibleEnd = Math.min(endHour, END_HOUR);

    const top = (visibleStart - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((visibleEnd - visibleStart) * HOUR_HEIGHT, 40);

    return { top, height };
  };

  // Calculate overlapping events
  const getEventColumns = () => {
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const aStart = new Date(a.metadata.start_time || a.occurred_at).getTime();
      const bStart = new Date(b.metadata.start_time || b.occurred_at).getTime();
      return aStart - bStart;
    });

    const columns: CalendarEvent[][] = [];

    sortedEvents.forEach(event => {
      const eventStart = new Date(event.metadata.start_time || event.occurred_at).getTime();
      const eventEnd = event.metadata.end_time
        ? new Date(event.metadata.end_time).getTime()
        : eventStart + 60 * 60 * 1000;

      // Find a column where this event doesn't overlap
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const lastEvent = column[column.length - 1];
        const lastEnd = lastEvent.metadata.end_time
          ? new Date(lastEvent.metadata.end_time).getTime()
          : new Date(lastEvent.metadata.start_time || lastEvent.occurred_at).getTime() + 60 * 60 * 1000;

        if (eventStart >= lastEnd) {
          column.push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
      }
    });

    return columns;
  };

  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const columns = getEventColumns();
  const totalColumns = columns.length || 1;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Day header */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 py-3 px-4">
          <div className="text-sm font-medium text-gray-500">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className={cn(
            'inline-flex items-center justify-center w-10 h-10 text-xl font-semibold rounded-full mt-1',
            isToday && 'bg-blue-600 text-white',
            !isToday && 'text-gray-900'
          )}>
            {currentDate.getDate()}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative min-h-full">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-2 text-xs text-gray-500">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          {/* Main column */}
          <div className={cn(
            'flex-1 relative border-l border-gray-200',
            isToday && 'bg-blue-50/30'
          )}>
            {/* Hour grid lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-100"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Events */}
            {columns.map((column, colIndex) =>
              column.map((event) => {
                const { top, height } = getEventPosition(event);
                const colors = getEventColor(event);
                const width = `calc(${100 / totalColumns}% - 8px)`;
                const left = `calc(${(colIndex / totalColumns) * 100}% + 4px)`;

                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'absolute rounded-lg px-3 py-2 text-left overflow-hidden border-l-4 hover:ring-2 hover:ring-blue-400 transition-shadow shadow-sm',
                      colors.bg,
                      colors.border,
                      colors.text
                    )}
                    style={{ top, height, width, left, minHeight: 40 }}
                  >
                    <div className="font-semibold truncate">{event.subject}</div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {formatEventTime(event.metadata.start_time || event.occurred_at)}
                      {event.metadata.end_time && ` - ${formatEventTime(event.metadata.end_time)}`}
                    </div>
                    {height >= 80 && event.contact && (
                      <div className="text-xs opacity-80 mt-1 truncate">
                        {event.contact.name}
                        {event.contact.company && ` - ${event.contact.company.name}`}
                      </div>
                    )}
                    {height >= 100 && event.metadata.location && (
                      <div className="text-xs opacity-70 mt-1 truncate">
                        {event.metadata.location}
                      </div>
                    )}
                  </button>
                );
              })
            )}

            {/* Current time indicator */}
            {isToday && (
              <CurrentTimeIndicator startHour={START_HOUR} hourHeight={HOUR_HEIGHT} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator({ startHour, hourHeight }: { startHour: number; hourHeight: number }) {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  if (currentHour < startHour || currentHour > END_HOUR) {
    return null;
  }

  const top = (currentHour - startHour) * hourHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}
