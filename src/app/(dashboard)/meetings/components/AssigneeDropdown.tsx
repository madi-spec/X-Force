'use client';

import { useState, useRef, useEffect } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface AssigneeDropdownProps {
  assignee: TeamMember | null;
  teamMembers: TeamMember[];
  onAssign: (member: TeamMember) => void;
  disabled?: boolean;
}

export function AssigneeDropdown({
  assignee,
  teamMembers,
  onAssign,
  disabled = false,
}: AssigneeDropdownProps) {
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (disabled) {
    return (
      <span className="text-xs text-gray-500">
        @{assignee?.name || 'Unassigned'}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
      >
        @{assignee?.name || 'Unassigned'}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px] max-h-[200px] overflow-y-auto">
          {teamMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => {
                onAssign(member);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                member.id === assignee?.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium flex-shrink-0">
                {getInitials(member.name)}
              </span>
              <span className="truncate">{member.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
