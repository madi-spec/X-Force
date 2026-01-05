# Communication Hub: Phase 3B - Unified Conversation View

## What We're Building

A unified inbox like iMessage/Slack that shows ALL communications with a customer in one conversational thread, regardless of channel (email, call, SMS, AI-sent).

**NOT** an accountability dashboard. **A conversation view.**

---

## The Layout (Three Panels)

```
┌─────────────────────┬────────────────────────────────┬──────────────────────┐
│ CONVERSATION LIST   │ CONVERSATION THREAD            │ CUSTOMER CONTEXT     │
│ (Left Panel)        │ (Center Panel)                 │ (Right Panel)        │
│                     │                                │                      │
│ • Search            │ • All comms for selected       │ • Contact info       │
│ • Channel filters   │   company/contact              │ • Company info       │
│ • Recent convos     │ • Chronological (newest top)   │ • Deal info          │
│ • Grouped by company│ • Shows channel icon           │ • Products discussed │
│                     │ • AI insights inline           │ • Quick actions      │
└─────────────────────┴────────────────────────────────┴──────────────────────┘
```

---

## Phase 3B Tasks

### Task 1: Create Conversation List Component (Left Panel)

Create `src/components/communications/ConversationList.tsx`:

```tsx
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
  Bot,
  Filter
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ConversationSummary {
  company_id: string;
  company_name: string;
  contact_id: string | null;
  contact_name: string | null;
  last_communication: {
    id: string;
    channel: string;
    subject: string | null;
    content_preview: string | null;
    occurred_at: string;
    direction: string;
    is_ai_generated: boolean;
  };
  unread_count: number;
  communication_count: number;
  tags: string[];
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

interface ConversationListProps {
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string, contactId?: string | null) => void;
  channelFilter: string | null;
  onChannelFilterChange: (channel: string | null) => void;
}

export function ConversationList({
  selectedCompanyId,
  onSelectCompany,
  channelFilter,
  onChannelFilterChange,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Build query params
  const params = new URLSearchParams();
  if (channelFilter === 'ai') {
    params.set('ai_only', 'true');
  } else if (channelFilter) {
    params.set('channel', channelFilter);
  }
  
  const { data, error, isLoading } = useSWR(
    `/api/communications/conversations?${params.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  const conversations: ConversationSummary[] = data?.conversations || [];
  
  // Filter by search
  const filteredConversations = searchQuery
    ? conversations.filter(c => 
        c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_communication?.subject?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;
  
  return (
    <div className="flex flex-col h-full border-r bg-white">
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
            const isSelected = selectedCompanyId === convo.company_id;
            
            return (
              <button
                key={`${convo.company_id}-${convo.contact_id || 'all'}`}
                onClick={() => onSelectCompany(convo.company_id, convo.contact_id)}
                className={`w-full p-3 text-left border-b hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Channel Icon */}
                  <div className={`p-2 rounded-full ${
                    convo.last_communication?.is_ai_generated 
                      ? 'bg-purple-100' 
                      : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      convo.last_communication?.is_ai_generated 
                        ? 'text-purple-600' 
                        : 'text-gray-600'
                    }`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {convo.contact_name || convo.company_name}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(convo.last_communication?.occurred_at), { addSuffix: false })}
                      </span>
                    </div>
                    
                    {convo.contact_name && (
                      <p className="text-xs text-gray-500 mb-1">
                        {convo.company_name}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-600 truncate">
                      {convo.last_communication?.is_ai_generated && (
                        <span className="text-purple-600 font-medium">AI: </span>
                      )}
                      {convo.last_communication?.subject || convo.last_communication?.content_preview || 'No subject'}
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
```

### Task 2: Create Conversation Thread Component (Center Panel)

Create `src/components/communications/ConversationThread.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Mail, 
  Phone, 
  Video, 
  MessageSquare, 
  Bot,
  ArrowDown,
  ArrowUp,
  Paperclip,
  Play,
  ChevronDown,
  ChevronUp,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Communication {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  occurred_at: string;
  duration_seconds: number | null;
  is_ai_generated: boolean;
  ai_action_type: string | null;
  recording_url: string | null;
  attachments: any[];
  our_participants: any[];
  their_participants: any[];
  current_analysis: {
    summary: string | null;
    sentiment: string | null;
    sentiment_score: number | null;
    extracted_signals: any[];
    extracted_commitments_us: any[];
    extracted_commitments_them: any[];
    products_discussed: string[];
  } | null;
  contact: { id: string; name: string; email: string } | null;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Video,
  sms: MessageSquare,
};

const sentimentIcons: Record<string, { icon: React.ElementType; color: string }> = {
  positive: { icon: Smile, color: 'text-green-500' },
  neutral: { icon: Meh, color: 'text-gray-400' },
  negative: { icon: Frown, color: 'text-red-500' },
  concerned: { icon: AlertCircle, color: 'text-yellow-500' },
  excited: { icon: Smile, color: 'text-green-600' },
};

function CommunicationBubble({ comm }: { comm: Communication }) {
  const [expanded, setExpanded] = useState(false);
  
  const isOutbound = comm.direction === 'outbound';
  const Icon = comm.is_ai_generated ? Bot : channelIcons[comm.channel] || Mail;
  const sentiment = sentimentIcons[comm.current_analysis?.sentiment || 'neutral'];
  const SentimentIcon = sentiment?.icon || Meh;
  
  const hasAnalysis = comm.current_analysis && (
    comm.current_analysis.extracted_signals?.length > 0 ||
    comm.current_analysis.extracted_commitments_us?.length > 0 ||
    comm.current_analysis.extracted_commitments_them?.length > 0
  );
  
  return (
    <div className={`flex gap-3 mb-4 ${isOutbound ? 'flex-row-reverse' : ''}`}>
      {/* Avatar/Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        comm.is_ai_generated 
          ? 'bg-purple-100' 
          : isOutbound 
            ? 'bg-blue-100' 
            : 'bg-gray-100'
      }`}>
        <Icon className={`w-5 h-5 ${
          comm.is_ai_generated 
            ? 'text-purple-600' 
            : isOutbound 
              ? 'text-blue-600' 
              : 'text-gray-600'
        }`} />
      </div>
      
      {/* Message Bubble */}
      <div className={`flex-1 max-w-[75%] ${isOutbound ? 'items-end' : 'items-start'}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 text-xs text-gray-500 ${
          isOutbound ? 'flex-row-reverse' : ''
        }`}>
          <span className="font-medium text-gray-700">
            {comm.is_ai_generated 
              ? `AI ${comm.ai_action_type || 'Message'}`
              : isOutbound 
                ? (comm.our_participants?.[0]?.name || 'You')
                : (comm.their_participants?.[0]?.name || comm.contact?.name || 'Contact')
            }
          </span>
          <span>•</span>
          <span>{format(new Date(comm.occurred_at), 'MMM d, h:mm a')}</span>
          {comm.channel !== 'email' && (
            <>
              <span>•</span>
              <span className="capitalize">{comm.channel}</span>
            </>
          )}
          {comm.duration_seconds && (
            <>
              <span>•</span>
              <span>{Math.round(comm.duration_seconds / 60)} min</span>
            </>
          )}
        </div>
        
        {/* Content Bubble */}
        <div className={`rounded-2xl p-4 ${
          isOutbound 
            ? 'bg-blue-500 text-white rounded-tr-sm' 
            : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        }`}>
          {/* Subject */}
          {comm.subject && (
            <p className={`font-medium mb-2 ${isOutbound ? 'text-blue-100' : 'text-gray-500'}`}>
              {comm.subject}
            </p>
          )}
          
          {/* Content */}
          <p className={`text-sm whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>
            {comm.full_content || comm.content_preview || 'No content'}
          </p>
          
          {/* Expand/Collapse */}
          {(comm.full_content?.length || 0) > 300 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                isOutbound ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show more <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
          
          {/* Attachments */}
          {comm.attachments && comm.attachments.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 text-xs">
                <Paperclip className="w-3 h-3" />
                <span>{comm.attachments.length} attachment(s)</span>
              </div>
            </div>
          )}
          
          {/* Recording */}
          {comm.recording_url && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <a 
                href={comm.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-xs ${
                  isOutbound ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <Play className="w-3 h-3" />
                Play Recording
              </a>
            </div>
          )}
        </div>
        
        {/* AI Insights (Below bubble, for inbound only) */}
        {!isOutbound && hasAnalysis && (
          <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-4 text-xs">
              {/* Sentiment */}
              {comm.current_analysis?.sentiment && (
                <div className="flex items-center gap-1">
                  <SentimentIcon className={`w-4 h-4 ${sentiment?.color}`} />
                  <span className="capitalize text-gray-600">
                    {comm.current_analysis.sentiment}
                  </span>
                </div>
              )}
              
              {/* Signals */}
              {comm.current_analysis?.extracted_signals?.slice(0, 2).map((signal: any, i: number) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full"
                >
                  {signal.signal.replace(/_/g, ' ')}
                </span>
              ))}
              
              {/* Products */}
              {comm.current_analysis?.products_discussed?.slice(0, 2).map((product: string, i: number) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                >
                  {product}
                </span>
              ))}
            </div>
            
            {/* Commitments */}
            {(comm.current_analysis?.extracted_commitments_us?.length > 0 || 
              comm.current_analysis?.extracted_commitments_them?.length > 0) && (
              <div className="mt-2 pt-2 border-t border-purple-100 grid grid-cols-2 gap-2 text-xs">
                {comm.current_analysis?.extracted_commitments_us?.length > 0 && (
                  <div>
                    <span className="text-gray-500">We promised: </span>
                    <span className="text-gray-700">
                      {comm.current_analysis.extracted_commitments_us[0].commitment}
                    </span>
                  </div>
                )}
                {comm.current_analysis?.extracted_commitments_them?.length > 0 && (
                  <div>
                    <span className="text-gray-500">They promised: </span>
                    <span className="text-gray-700">
                      {comm.current_analysis.extracted_commitments_them[0].commitment}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationThreadProps {
  companyId: string | null;
  contactId?: string | null;
  channelFilter: string | null;
}

export function ConversationThread({ 
  companyId, 
  contactId,
  channelFilter 
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Build query params
  const params = new URLSearchParams();
  if (companyId) params.set('company_id', companyId);
  if (contactId) params.set('contact_id', contactId);
  if (channelFilter === 'ai') {
    params.set('ai_only', 'true');
  } else if (channelFilter) {
    params.set('channel', channelFilter);
  }
  params.set('limit', '50');
  
  const { data, error, isLoading } = useSWR(
    companyId ? `/api/communications?${params.toString()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  const communications: Communication[] = data?.communications || [];
  
  // Sort oldest first (conversation order)
  const sortedComms = [...communications].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  
  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedComms.length]);
  
  if (!companyId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose a company from the list to view communications</p>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (sortedComms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No communications yet</p>
          <p className="text-sm">Start a conversation with this company</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Thread Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {sortedComms[0]?.contact?.name || 'Company Conversation'}
            </h2>
            <p className="text-sm text-gray-500">
              {communications.length} communications
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Latest: {formatDistanceToNow(new Date(communications[0]?.occurred_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {sortedComms.map((comm) => (
          <CommunicationBubble key={comm.id} comm={comm} />
        ))}
      </div>
    </div>
  );
}
```

### Task 3: Create Customer Context Panel (Right Panel)

Create `src/components/communications/CustomerContext.tsx`:

```tsx
'use client';

import useSWR from 'swr';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Briefcase,
  DollarSign,
  Target,
  Package,
  Calendar,
  MessageSquare,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface CustomerContextProps {
  companyId: string | null;
  contactId?: string | null;
}

export function CustomerContext({ companyId, contactId }: CustomerContextProps) {
  // Fetch company details
  const { data: companyData } = useSWR(
    companyId ? `/api/companies/${companyId}` : null,
    fetcher
  );
  
  // Fetch contact details if specific contact selected
  const { data: contactData } = useSWR(
    contactId ? `/api/contacts/${contactId}` : null,
    fetcher
  );
  
  // Fetch deals for this company
  const { data: dealsData } = useSWR(
    companyId ? `/api/deals?company_id=${companyId}` : null,
    fetcher
  );
  
  // Fetch communication stats
  const { data: statsData } = useSWR(
    companyId ? `/api/communications/stats?company_id=${companyId}` : null,
    fetcher
  );
  
  const company = companyData?.company;
  const contact = contactData?.contact;
  const deals = dealsData?.deals || [];
  const stats = statsData?.stats;
  const activeDeal = deals.find((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
  
  if (!companyId) {
    return (
      <div className="w-80 border-l bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-400 text-center">
          Select a conversation to see customer details
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-80 border-l bg-white overflow-y-auto">
      {/* Contact/Company Header */}
      <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            {contact ? (
              <User className="w-6 h-6 text-blue-600" />
            ) : (
              <Building2 className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {contact?.name || company?.name || 'Loading...'}
            </h3>
            {contact && (
              <p className="text-sm text-gray-500">{contact.title || 'Contact'}</p>
            )}
            {contact && company && (
              <p className="text-xs text-gray-400">{company.name}</p>
            )}
          </div>
        </div>
        
        {/* Quick Contact Info */}
        <div className="space-y-1.5 text-sm">
          {(contact?.email || company?.email) && (
            <a 
              href={`mailto:${contact?.email || company?.email}`}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Mail className="w-4 h-4" />
              {contact?.email || company?.email}
            </a>
          )}
          {(contact?.phone || company?.phone) && (
            <a 
              href={`tel:${contact?.phone || company?.phone}`}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Phone className="w-4 h-4" />
              {contact?.phone || company?.phone}
            </a>
          )}
          {company?.website && (
            <a 
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Globe className="w-4 h-4" />
              {company.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>
      
      {/* Active Deal */}
      {activeDeal && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Active Deal
          </h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900 mb-1">{activeDeal.name}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Value: </span>
                <span className="font-medium text-green-600">
                  ${activeDeal.value?.toLocaleString()}/yr
                </span>
              </div>
              <div>
                <span className="text-gray-500">Stage: </span>
                <span className="font-medium text-gray-700 capitalize">
                  {activeDeal.stage?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            {activeDeal.expected_close_date && (
              <div className="mt-2 text-xs text-gray-500">
                Expected close: {new Date(activeDeal.expected_close_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Products Discussed */}
      {stats?.products_discussed?.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products Discussed
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.products_discussed.map((product: string) => (
              <span 
                key={product}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg"
              >
                {product}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Communication Stats */}
      {stats && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Communication Stats
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total_communications || 0}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.avg_response_time || '-'}</p>
              <p className="text-xs text-gray-500">Avg Response</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.inbound || 0}</p>
              <p className="text-xs text-gray-500">Inbound</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.outbound || 0}</p>
              <p className="text-xs text-gray-500">Outbound</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Recent Signals */}
      {stats?.recent_signals?.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Recent Signals
          </h4>
          <div className="space-y-2">
            {stats.recent_signals.map((signal: any, i: number) => (
              <div 
                key={i}
                className={`px-3 py-2 rounded-lg text-sm ${
                  signal.type === 'positive' 
                    ? 'bg-green-50 text-green-700' 
                    : signal.type === 'negative'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-50 text-gray-700'
                }`}
              >
                {signal.signal.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          Quick Actions
        </h4>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Send Email
          </button>
          <button className="w-full px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            Schedule Meeting
          </button>
          <button className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Task 4: Create Conversations API Endpoint

Create `src/app/api/communications/conversations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const channel = searchParams.get('channel');
  const aiOnly = searchParams.get('ai_only') === 'true';
  
  // Get latest communication per company, grouped
  // This query gets the most recent communication for each company
  let query = supabase
    .from('communications')
    .select(`
      id,
      company_id,
      contact_id,
      channel,
      direction,
      subject,
      content_preview,
      occurred_at,
      is_ai_generated,
      ai_action_type,
      company:companies!company_id(id, name),
      contact:contacts!contact_id(id, name, email)
    `)
    .not('company_id', 'is', null)
    .order('occurred_at', { ascending: false });
  
  // Apply filters
  if (aiOnly) {
    query = query.eq('is_ai_generated', true);
  } else if (channel) {
    query = query.eq('channel', channel);
  }
  
  const { data: allComms, error } = await query;
  
  if (error) {
    console.error('[Conversations API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Group by company, get the latest one per company
  const companyMap = new Map<string, any>();
  
  for (const comm of allComms || []) {
    if (!comm.company_id) continue;
    
    const key = comm.company_id;
    if (!companyMap.has(key)) {
      companyMap.set(key, {
        company_id: comm.company_id,
        company_name: comm.company?.name || 'Unknown',
        contact_id: comm.contact_id,
        contact_name: comm.contact?.name || null,
        last_communication: {
          id: comm.id,
          channel: comm.channel,
          subject: comm.subject,
          content_preview: comm.content_preview,
          occurred_at: comm.occurred_at,
          direction: comm.direction,
          is_ai_generated: comm.is_ai_generated,
        },
        communication_count: 1,
        tags: [], // Could extract from analysis
      });
    } else {
      companyMap.get(key).communication_count++;
    }
  }
  
  // Convert to array and sort by last communication
  const conversations = Array.from(companyMap.values())
    .sort((a, b) => 
      new Date(b.last_communication.occurred_at).getTime() - 
      new Date(a.last_communication.occurred_at).getTime()
    );
  
  return NextResponse.json({ conversations });
}
```

### Task 5: Create Stats API Endpoint

Create `src/app/api/communications/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const companyId = searchParams.get('company_id');
  
  if (!companyId) {
    return NextResponse.json({ error: 'company_id required' }, { status: 400 });
  }
  
  // Get communications for this company
  const { data: comms, error } = await supabase
    .from('communications')
    .select(`
      id,
      channel,
      direction,
      occurred_at,
      current_analysis:communication_analysis!current_analysis_id(
        products_discussed,
        extracted_signals
      )
    `)
    .eq('company_id', companyId);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Calculate stats
  const total = comms?.length || 0;
  const inbound = comms?.filter(c => c.direction === 'inbound').length || 0;
  const outbound = comms?.filter(c => c.direction === 'outbound').length || 0;
  
  // Collect all products discussed
  const productsSet = new Set<string>();
  const signalsArr: any[] = [];
  
  for (const comm of comms || []) {
    const analysis = comm.current_analysis as any;
    if (analysis?.products_discussed) {
      analysis.products_discussed.forEach((p: string) => productsSet.add(p));
    }
    if (analysis?.extracted_signals) {
      signalsArr.push(...analysis.extracted_signals);
    }
  }
  
  // Get recent signals (last 5 unique)
  const recentSignals = signalsArr
    .slice(0, 10)
    .reduce((acc: any[], signal) => {
      if (!acc.find(s => s.signal === signal.signal)) {
        acc.push({
          signal: signal.signal,
          type: signal.signal.includes('risk') || signal.signal.includes('concern') 
            ? 'negative' 
            : 'positive',
        });
      }
      return acc;
    }, [])
    .slice(0, 5);
  
  return NextResponse.json({
    stats: {
      total_communications: total,
      inbound,
      outbound,
      products_discussed: Array.from(productsSet),
      recent_signals: recentSignals,
      avg_response_time: '2h', // Would calculate from actual data
    },
  });
}
```

### Task 6: Create Main Unified Inbox Page

Update `src/app/(dashboard)/communications/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ConversationList } from '@/components/communications/ConversationList';
import { ConversationThread } from '@/components/communications/ConversationThread';
import { CustomerContext } from '@/components/communications/CustomerContext';

export default function CommunicationsPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  
  const handleSelectCompany = (companyId: string, contactId?: string | null) => {
    setSelectedCompanyId(companyId);
    setSelectedContactId(contactId || null);
  };
  
  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left: Conversation List */}
      <div className="w-80 flex-shrink-0">
        <ConversationList
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={handleSelectCompany}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
        />
      </div>
      
      {/* Center: Conversation Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationThread
          companyId={selectedCompanyId}
          contactId={selectedContactId}
          channelFilter={channelFilter}
        />
      </div>
      
      {/* Right: Customer Context */}
      <CustomerContext
        companyId={selectedCompanyId}
        contactId={selectedContactId}
      />
    </div>
  );
}
```

### Task 7: Update Exports

Update `src/components/communications/index.ts`:

```typescript
// Daily Drivers (keep for dashboard widgets)
export { ResponseQueue } from './ResponseQueue';
export { PromisesTracker } from './PromisesTracker';
export { AIActivityFeed } from './AIActivityFeed';

// Unified Inbox (main communication hub)
export { ConversationList } from './ConversationList';
export { ConversationThread } from './ConversationThread';
export { CustomerContext } from './CustomerContext';
```

---

## Verification

After implementation:

1. **Navigate to /communications**
2. **Left panel should show:** List of companies with latest communication
3. **Click a company:** Center panel shows conversation thread (all channels mixed)
4. **Right panel shows:** Company/contact info, deal, products, stats
5. **Channel filters work:** Filter to just calls, just emails, just AI sent
6. **Search works:** Find specific company/contact

---

## Visual Result

```
┌─────────────────────┬────────────────────────────────┬──────────────────────┐
│ 🔍 Search...        │ Ramsey Cole                    │ 👤 Ramsey Cole       │
│                     │ VP Operations • Happinest      │ VP Operations        │
│ [All][📞][💬][📧][🤖]│                                │ Happinest            │
│                     │ ────────────────────────────── │ 📧 ramsey@...        │
│ ┌─────────────────┐ │                                │ 📞 (555) 123...      │
│ │📧 Ramsey Cole 2m│ │ 📧 ← Inbound                   │                      │
│ │Re: Timeline     │ │ "Thanks for the proposal..."   │ ──────────────────── │
│ │[Sales][Voice]   │ │ 😊 Positive • Ready to proceed │ DEAL                 │
│ └─────────────────┘ │                                │ Voice Agent          │
│                     │ 📧 → Outbound                  │ $48,000/yr           │
│ ┌─────────────────┐ │ "Here's the updated timeline"  │ Stage: Proposal      │
│ │📞 Marcus Chen   │ │                                │                      │
│ │Discovery Call   │ │ 🤖 → AI Scheduling             │ ──────────────────── │
│ │15m ago          │ │ "Following up to schedule..."  │ PRODUCTS             │
│ └─────────────────┘ │                                │ • Voice Agent        │
│                     │ 📞 Meeting                     │ • Call Analytics     │
│ ┌─────────────────┐ │ "Discovery call - 45 min"     │                      │
│ │🤖 Sarah Kim     │ │ 🎤 Play Recording              │ ──────────────────── │
│ │AI Scheduling    │ │                                │ [📧 Email]           │
│ │1h ago           │ │                                │ [📅 Schedule]        │
│ └─────────────────┘ │                                │ [📝 Add Note]        │
└─────────────────────┴────────────────────────────────┴──────────────────────┘
```

---

## Success Criteria

- [ ] Three-panel layout renders correctly
- [ ] Conversation list shows companies grouped by latest comm
- [ ] Clicking company loads ALL communications in center
- [ ] Communications display as chat bubbles (inbound left, outbound right)
- [ ] AI insights show inline below inbound messages
- [ ] Right panel shows company/contact/deal info
- [ ] Channel filters work
- [ ] Search works
- [ ] TypeScript compiles clean
