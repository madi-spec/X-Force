'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  eventDates?: Set<string>; // ISO date strings that have events
}

export function MiniCalendar({ selectedDate, onDateSelect, eventDates }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setViewDate(newDate);
  };

  const days = getDaysInMonth(viewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const hasEvents = (date: Date | null) => {
    if (!date || !eventDates) return false;
    return eventDates.has(date.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => day && onDateSelect(day)}
            disabled={!day}
            className={cn(
              'relative aspect-square flex items-center justify-center text-xs rounded-full transition-colors',
              !day && 'invisible',
              day && 'hover:bg-gray-100',
              day && isSameDay(day, today) && !isSameDay(day, selectedDate) && 'text-blue-600 font-semibold',
              day && isSameDay(day, selectedDate) && 'bg-blue-600 text-white hover:bg-blue-700',
              day && !isSameDay(day, selectedDate) && !isSameDay(day, today) && 'text-gray-700'
            )}
          >
            {day?.getDate()}
            {hasEvents(day) && !isSameDay(day, selectedDate) && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
