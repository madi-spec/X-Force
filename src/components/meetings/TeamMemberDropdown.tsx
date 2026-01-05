'use client';

import { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface TeamMemberDropdownProps {
  assignee: TeamMember | null;
  teamMembers: TeamMember[];
  onAssign: (member: TeamMember) => void;
  disabled?: boolean;
}

export function TeamMemberDropdown({
  assignee,
  teamMembers,
  onAssign,
  disabled = false,
}: TeamMemberDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  if (disabled) {
    return (
      <span className="text-xs text-gray-500 flex items-center gap-1">
        <User className="w-3 h-3" />
        {assignee?.name || 'Unassigned'}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
      >
        {assignee ? (
          <>
            <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium">
              {getInitials(assignee.name)}
            </span>
            {assignee.name.split(' ')[0]}
          </>
        ) : (
          <>
            <User className="w-3 h-3" />
            Assign
          </>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="w-full text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-gray-500 px-3 py-2">No members found</p>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    onAssign(member);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    member.id === assignee?.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {getInitials(member.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{member.name}</div>
                    <div className="truncate text-xs text-gray-500">{member.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
