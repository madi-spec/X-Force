'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  Mail,
  Phone,
  MessageSquare,
  Video,
  Bot
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ConversationSummary {
  company_id: string | null;
  company_name: string;
  contact_id: string | null;
  contact_name: string | null;
  sender_email: string | null;
  is_unlinked: boolean;
  last_communication: {
    id: string;
    channel: string;
    subject: string | null;
    content_preview: string | null;
    occurred_at: string;
    direction: string;
    is_ai_generated: boolean;
  };
  unread_count?: number;
  communication_count: number;
  tags: string[];
  has_open_task?: boolean;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Video,
  sms: MessageSquare,
};

const channelFilters = [
  { id: null, label: 'All', icon: null },
  { id: 'call', label: 'Calls', icon: Phone },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'meeting', label: 'Meetings', icon: Video },
  { id: 'ai', label: 'AI Sent', icon: Bot },
];

type LinkFilter = 'linked' | 'unlinked';

interface ConversationListProps {
  selectedCompanyId: string | null;
  selectedSenderEmail: string | null;
  onSelectCompany: (companyId: string | null, contactId?: string | null, senderEmail?: string | null, companyName?: string | null) => void;
  channelFilter: string | null;
  onChannelFilterChange: (channel: string | null) => void;
}

export function ConversationList({
  selectedCompanyId,
  selectedSenderEmail,
  onSelectCompany,
  channelFilter,
  onChannelFilterChange,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('linked');

  // Build query params
  const params = new URLSearchParams();
  params.set('link_filter', linkFilter);
  if (channelFilter === 'ai') {
    params.set('ai_only', 'true');
  } else if (channelFilter) {
    params.set('channel', channelFilter);
  }

  const { data, isLoading } = useSWR<{ conversations: ConversationSummary[] }>(
    `/api/communications/conversations?${params.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch counts for both linked and unlinked
  const { data: statsData } = useSWR<{ linked: number; unlinked: number }>(
    '/api/communications/conversations/stats',
    fetcher,
    { refreshInterval: 60000 }
  );

  const conversations: ConversationSummary[] = data?.conversations || [];

  // Filter by search
  const searchFiltered = searchQuery
    ? conversations.filter(c =>
        c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_communication?.content_preview?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Sort conversations: those with open tasks first, then by date
  const filteredConversations = [...searchFiltered].sort((a, b) => {
    // First sort by has_open_task (true comes first)
    if (a.has_open_task && !b.has_open_task) return -1;
    if (!a.has_open_task && b.has_open_task) return 1;
    // Then sort by date (most recent first)
    const dateA = new Date(a.last_communication?.occurred_at || 0).getTime();
    const dateB = new Date(b.last_communication?.occurred_at || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full border-r bg-white">
      {/* Linked/Unlinked Toggle */}
      <div className="p-3 border-b">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setLinkFilter('linked')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              linkFilter === 'linked'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Linked
            {statsData && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                linkFilter === 'linked'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {statsData.linked}
              </span>
            )}
          </button>
          <button
            onClick={() => setLinkFilter('unlinked')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              linkFilter === 'unlinked'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unlinked
            {statsData && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                linkFilter === 'unlinked'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {statsData.unlinked}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Channel Filters */}
      <div className="flex items-center gap-1 p-2 border-b overflow-x-auto">
        {channelFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = channelFilter === filter.id;

          return (
            <button
              key={filter.id || 'all'}
              onClick={() => onChannelFilterChange(filter.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((convo) => {
            const Icon = convo.last_communication?.is_ai_generated
              ? Bot
              : channelIcons[convo.last_communication?.channel] || Mail;
            const isSelected = convo.is_unlinked
              ? selectedSenderEmail === convo.sender_email
              : selectedCompanyId === convo.company_id;

            return (
              <button
                key={convo.is_unlinked ? `unlinked:${convo.sender_email}` : convo.company_id}
                onClick={() => onSelectCompany(convo.company_id, null, convo.sender_email, convo.company_name)}
                className={`w-full p-3 text-left border-b hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Channel Icon with Action Dot */}
                  <div className="relative">
                    <div className={`p-2 rounded-full ${
                      convo.is_unlinked
                        ? 'bg-amber-100'
                        : convo.last_communication?.is_ai_generated
                          ? 'bg-purple-100'
                          : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        convo.is_unlinked
                          ? 'text-amber-600'
                          : convo.last_communication?.is_ai_generated
                            ? 'text-purple-600'
                            : 'text-gray-600'
                      }`} />
                    </div>
                    {/* Red Action Dot */}
                    {convo.has_open_task && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-gray-900 truncate">
                          {convo.company_name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {convo.last_communication?.occurred_at
                          ? formatDistanceToNow(new Date(convo.last_communication.occurred_at), { addSuffix: false })
                          : ''}
                      </span>
                    </div>

                    {convo.contact_name && (
                      <p className="text-xs text-gray-500 mb-1">
                        {convo.contact_name}
                      </p>
                    )}

                    <p className="text-sm text-gray-600 truncate">
                      {convo.last_communication?.is_ai_generated && (
                        <span className="text-purple-600 font-medium">AI: </span>
                      )}
                      {convo.last_communication?.content_preview || 'No content'}
                    </p>

                    {/* Tags */}
                    {convo.tags && convo.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {convo.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
