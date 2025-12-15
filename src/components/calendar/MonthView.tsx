'use client';

import { cn } from '@/lib/utils';
import { CalendarEvent, getEventColor, formatEventTime, isSameDay } from './types';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

export function MonthView({ currentDate, events, onEventClick, onDateClick }: MonthViewProps) {
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonth.getDate() - i));
    }

    // Add all days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.metadata.start_time || event.occurred_at);
      return isSameDay(eventDate, day);
    });
  };

  const days = getDaysInMonth();
  const today = new Date();
  const isCurrentMonth = (day: Date) => day.getMonth() === currentDate.getMonth();

  // Split days into weeks
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day, dayIndex) => {
              if (!day) return <div key={dayIndex} className="bg-gray-50" />;

              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, today);
              const isOtherMonth = !isCurrentMonth(day);
              const maxEventsToShow = 3;
              const hasMore = dayEvents.length > maxEventsToShow;

              return (
                <div
                  key={dayIndex}
                  onClick={() => onDateClick(day)}
                  className={cn(
                    'min-h-[100px] p-1 border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors',
                    isOtherMonth && 'bg-gray-50/50'
                  )}
                >
                  <div className="flex items-center justify-center mb-1">
                    <span
                      className={cn(
                        'flex items-center justify-center w-7 h-7 text-sm rounded-full',
                        isToday && 'bg-blue-600 text-white font-semibold',
                        !isToday && isOtherMonth && 'text-gray-400',
                        !isToday && !isOtherMonth && 'text-gray-900'
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxEventsToShow).map((event) => {
                      const colors = getEventColor(event);
                      return (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className={cn(
                            'w-full text-left px-1.5 py-0.5 text-xs rounded truncate border-l-2',
                            colors.bg,
                            colors.border,
                            colors.text
                          )}
                        >
                          <span className="font-medium">
                            {formatEventTime(event.metadata.start_time || event.occurred_at)}
                          </span>{' '}
                          {event.subject}
                        </button>
                      );
                    })}
                    {hasMore && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDateClick(day);
                        }}
                        className="w-full text-left px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        +{dayEvents.length - maxEventsToShow} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
