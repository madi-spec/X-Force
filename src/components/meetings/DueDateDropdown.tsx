'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { format, isToday, isTomorrow, addDays, isThisWeek, isPast, parseISO } from 'date-fns';

interface DueDateDropdownProps {
  date: string | null;
  onDateChange: (date: string | null) => void;
  disabled?: boolean;
}

export function DueDateDropdown({ date, onDateChange, disabled = false }: DueDateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';

    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Today';
      if (isTomorrow(d)) return 'Tomorrow';
      if (isThisWeek(d)) return format(d, 'EEEE');
      return format(d, 'MMM d');
    } catch {
      return 'Invalid date';
    }
  };

  const getDateColor = (dateStr: string | null) => {
    if (!dateStr) return 'text-gray-400';

    try {
      const d = parseISO(dateStr);
      if (isPast(d) && !isToday(d)) return 'text-red-600';
      if (isToday(d)) return 'text-amber-600';
      if (isTomorrow(d)) return 'text-blue-600';
      return 'text-gray-500';
    } catch {
      return 'text-gray-400';
    }
  };

  const quickDates = [
    { label: 'Today', date: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Tomorrow', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: 'This Week', date: format(addDays(new Date(), 5), 'yyyy-MM-dd') },
    { label: 'Next Week', date: format(addDays(new Date(), 7), 'yyyy-MM-dd') },
  ];

  if (disabled) {
    return (
      <span className={`text-xs ${getDateColor(date)} flex items-center gap-1`}>
        <Calendar className="w-3 h-3" />
        {formatDisplayDate(date)}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs ${getDateColor(date)} hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1`}
      >
        <Calendar className="w-3 h-3" />
        {formatDisplayDate(date)}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20 min-w-[180px]">
          {/* Quick date options */}
          <div className="space-y-1 mb-2">
            {quickDates.map((qd) => (
              <button
                key={qd.label}
                onClick={() => {
                  onDateChange(qd.date);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-50 ${
                  date === qd.date ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {qd.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-2">
            <label className="block text-xs text-gray-500 mb-1">Custom date</label>
            <input
              type="date"
              value={date || ''}
              onChange={(e) => {
                onDateChange(e.target.value || null);
                setIsOpen(false);
              }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {date && (
            <button
              onClick={() => {
                onDateChange(null);
                setIsOpen(false);
              }}
              className="w-full mt-2 text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Remove due date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
