'use client';

import { useState } from 'react';
import { Mail, Send, ChevronRight, User, Building2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface EmailActivity {
  id: string;
  subject: string;
  description: string;
  completed_at: string;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: {
      id: string;
      name: string;
    };
  } | null;
  metadata: {
    direction?: 'inbound' | 'outbound';
    from?: { address: string; name?: string };
    to?: Array<{ address: string; name?: string }>;
  };
}

interface EmailListProps {
  emails: EmailActivity[];
  selectedId?: string;
  onSelect: (email: EmailActivity) => void;
}

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  const filteredEmails = emails.filter(email => {
    if (filter === 'all') return true;
    return email.metadata?.direction === filter;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('inbound')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
            filter === 'inbound'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Received
        </button>
        <button
          onClick={() => setFilter('outbound')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
            filter === 'outbound'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Sent
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No emails to display</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelect(email)}
                className={cn(
                  'w-full p-4 text-left hover:bg-gray-50 transition-colors',
                  selectedId === email.id && 'bg-blue-50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {email.metadata?.direction === 'outbound' ? (
                        <Send className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 truncate">
                        {email.subject || '(No subject)'}
                      </span>
                    </div>

                    {email.contact && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">{email.contact.name}</span>
                        {email.contact.company && (
                          <>
                            <span className="text-gray-400">at</span>
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="truncate">{email.contact.company.name}</span>
                          </>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-gray-500 truncate">
                      {email.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">
                      {formatDate(email.completed_at)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
