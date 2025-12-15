'use client';

import { cn } from '@/lib/utils';
import { CalendarEvent, getEventColor, formatEventTime, isSameDay } from './types';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 7;
const END_HOUR = 20; // 8pm

export function WeekView({ currentDate, events, onEventClick }: WeekViewProps) {
  // Get the week's days (Sunday to Saturday)
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.metadata.start_time || event.occurred_at);
      return isSameDay(eventDate, day);
    });
  };

  const getEventPosition = (event: CalendarEvent) => {
    const startTime = new Date(event.metadata.start_time || event.occurred_at);
    const endTime = event.metadata.end_time
      ? new Date(event.metadata.end_time)
      : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour

    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;

    // Clamp to visible hours
    const visibleStart = Math.max(startHour, START_HOUR);
    const visibleEnd = Math.min(endHour, END_HOUR);

    const top = (visibleStart - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max((visibleEnd - visibleStart) * HOUR_HEIGHT, 24); // Min height

    return { top, height };
  };

  const weekDays = getWeekDays();
  const today = new Date();
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header with day names */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="w-16 flex-shrink-0" /> {/* Time gutter */}
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className="flex-1 py-2 text-center border-l border-gray-200"
            >
              <div className="text-xs font-medium text-gray-500 uppercase">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={cn(
                  'mx-auto mt-1 w-8 h-8 flex items-center justify-center text-sm font-semibold rounded-full',
                  isToday && 'bg-blue-600 text-white',
                  !isToday && 'text-gray-900'
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative">
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

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, today);

            return (
              <div
                key={dayIndex}
                className={cn(
                  'flex-1 relative border-l border-gray-200',
                  isToday && 'bg-blue-50/30'
                )}
              >
                {/* Hour grid lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-gray-100"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const { top, height } = getEventPosition(event);
                  const colors = getEventColor(event);

                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className={cn(
                        'absolute left-1 right-1 rounded px-2 py-1 text-xs overflow-hidden border-l-2 hover:ring-2 hover:ring-blue-400 transition-shadow',
                        colors.bg,
                        colors.border,
                        colors.text
                      )}
                      style={{ top, height, minHeight: 24 }}
                    >
                      <div className="font-semibold truncate">{event.subject}</div>
                      {height >= 40 && (
                        <div className="text-[10px] opacity-80 truncate">
                          {formatEventTime(event.metadata.start_time || event.occurred_at)}
                          {event.metadata.end_time && ` - ${formatEventTime(event.metadata.end_time)}`}
                        </div>
                      )}
                      {height >= 60 && event.contact && (
                        <div className="text-[10px] opacity-80 truncate mt-0.5">
                          {event.contact.name}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Current time indicator */}
                {isToday && (
                  <CurrentTimeIndicator startHour={START_HOUR} hourHeight={HOUR_HEIGHT} />
                )}
              </div>
            );
          })}
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
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}
