'use client';

import { Inbox, Send, Mail, Star, Users, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailFolder, EmailFilter } from './types';

interface FolderSidebarProps {
  currentFolder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  currentFilter: EmailFilter;
  onFilterChange: (filter: EmailFilter) => void;
  counts: {
    inbox: number;
    sent: number;
    all: number;
    unread: number;
    starred: number;
    contacts: number;
  };
  onComposeClick: () => void;
}

export function FolderSidebar({
  currentFolder,
  onFolderChange,
  currentFilter,
  onFilterChange,
  counts,
  onComposeClick,
}: FolderSidebarProps) {
  const folders = [
    { id: 'inbox' as const, label: 'Inbox', icon: Inbox, count: counts.inbox },
    { id: 'sent' as const, label: 'Sent', icon: Send, count: counts.sent },
    { id: 'all' as const, label: 'All Mail', icon: Mail, count: counts.all },
  ];

  const labels: { id: EmailFilter; label: string; icon: typeof Star; count: number; color: string }[] = [
    { id: 'starred', label: 'Starred', icon: Star, count: counts.starred, color: 'text-yellow-500' },
    { id: 'contacts', label: 'Contacts', icon: Users, count: counts.contacts, color: 'text-green-500' },
  ];

  return (
    <div className="h-full flex flex-col border-r border-gray-200">
      {/* Compose Button */}
      <div className="p-4">
        <button
          onClick={onComposeClick}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 hover:shadow-lg transition-all font-medium"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Compose
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-2 space-y-1">
        {folders.map((folder) => {
          const isActive = currentFolder === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <folder.icon className={cn('h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-500')} />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.count > 0 && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isActive ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-600'
                )}>
                  {folder.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-3 border-t border-gray-200" />

        {/* Labels */}
        <div className="px-3 py-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Labels
          </span>
        </div>
        {labels.map((label) => {
          const isActive = currentFilter === label.id;
          return (
            <button
              key={label.id}
              onClick={() => onFilterChange(isActive ? 'all' : label.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <label.icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : label.color)} />
              <span className="flex-1 text-left">{label.label}</span>
              {label.count > 0 && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isActive ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-600'
                )}>
                  {label.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Contact Tag */}
        <div className="px-3 py-2 mt-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tags
          </span>
        </div>
        <div className="px-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Tag className="h-4 w-4" />
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Has Contact</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Tag className="h-4 w-4" />
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Has Deal</span>
          </div>
        </div>
      </nav>

      {/* Storage indicator (aesthetic) */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 mb-2">
          {counts.all} emails synced
        </div>
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-1/4 bg-blue-500 rounded-full" />
        </div>
      </div>
    </div>
  );
}
