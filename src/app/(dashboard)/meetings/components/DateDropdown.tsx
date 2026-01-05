'use client';

import { useState, useRef, useEffect } from 'react';

interface DateDropdownProps {
  date: string | null;
  onDateChange: (date: string) => void;
  disabled?: boolean;
}

export function DateDropdown({ date, onDateChange, disabled = false }: DateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (disabled) {
    return (
      <span className="text-xs text-gray-500">
        Due {formatDate(date)}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        Due {formatDate(date)}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20">
          <input
            type="date"
            value={date || ''}
            onChange={(e) => {
              onDateChange(e.target.value);
              setIsOpen(false);
            }}
            className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
