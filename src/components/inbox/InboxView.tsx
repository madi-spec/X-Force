'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, Settings, AlertTriangle, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionQueueTabs } from './ActionQueueTabs';
import { ConversationList } from './ConversationList';
import { ConversationDetail } from './ConversationDetail';
import { TasksPane } from './TasksPane';
import type { Conversation, EmailMessage, EmailDraft, ActionQueue, ActionQueueCounts } from './types';

interface InboxViewProps {
  initialConversations?: Conversation[];
  initialCounts?: ActionQueueCounts;
  isSynced?: boolean;
}

export function InboxView({
  initialConversations = [],
  initialCounts = { respond: 0, follow_up: 0, review: 0, drafts: 0, fyi: 0 },
  isSynced = false,
}: InboxViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [counts, setCounts] = useState<ActionQueueCounts>(initialCounts);
  const [activeQueue, setActiveQueue] = useState<ActionQueue | undefined>(undefined);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<EmailMessage[]>([]);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastActionId, setLastActionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [schedulingSuggestion, setSchedulingSuggestion] = useState<{
    hasSuggestion: boolean;
    meetingType?: string;
    confidence?: number;
  } | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeQueue) params.append('queue', activeQueue);

      const res = await fetch(`/api/inbox/conversations?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch conversations');

      setConversations(data.conversations || []);
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  }, [activeQueue]);

  // Fetch conversation detail
  const fetchConversationDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/inbox/conversations/${id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch conversation');

      setSelectedMessages(data.messages || []);
      if (data.draft) setDraft(data.draft);
      else setDraft(null);
    } catch (err) {
      console.error('Error fetching conversation:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch scheduling suggestions
  const fetchSchedulingSuggestion = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/inbox/schedule?conversationId=${id}`);
      const data = await res.json();

      if (res.ok) {
        setSchedulingSuggestion({
          hasSuggestion: data.hasSuggestion,
          meetingType: data.suggestion?.meetingType,
          confidence: data.suggestion?.confidence,
        });
      }
    } catch (err) {
      console.error('Error fetching scheduling suggestions:', err);
    }
  }, []);

  // Fetch detail when selection changes
  useEffect(() => {
    if (selectedConversation) {
      fetchConversationDetail(selectedConversation.id);
      fetchSchedulingSuggestion(selectedConversation.id);
    } else {
      setSchedulingSuggestion(null);
    }
  }, [selectedConversation, fetchConversationDetail, fetchSchedulingSuggestion]);

  // Filter conversations by queue
  const filteredConversations = activeQueue
    ? activeQueue === 'drafts'
      ? conversations.filter((c) => c.has_pending_draft)
      : conversations.filter((c) => c.action_queue === activeQueue)
    : conversations;

  // Action handlers
  const performAction = async (action: string, options: Record<string, unknown> = {}) => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/inbox/conversations/${selectedConversation.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...options }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (data.actionId) setLastActionId(data.actionId);

      // Refresh data
      fetchConversations();
      if (data.conversation) {
        setSelectedConversation(data.conversation);
      }
    } catch (err) {
      console.error('Action error:', err);
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleArchive = () => performAction('archive');
  const handleUnarchive = () => performAction('unarchive');
  const handleSnooze = (until: Date, reason?: string) =>
    performAction('snooze', { until: until.toISOString(), reason });
  const handleUnsnooze = () => performAction('unsnooze');
  const handleLink = (dealId?: string, companyId?: string, contactId?: string) =>
    performAction('link', { dealId, companyId, contactId });
  const handleUnlink = () => performAction('unlink');
  const handlePriority = (priority: string) => performAction('priority', { priority });
  const handleUndo = (actionId: string) => performAction('undo', { actionId });

  // AI handlers
  const handleAnalyze = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch('/api/inbox/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConversation.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      // Update conversation with analysis
      setSelectedConversation((prev) =>
        prev
          ? {
              ...prev,
              ai_summary: data.summary,
              ai_signals: data.signals,
            }
          : null
      );
    } catch (err) {
      console.error('Analysis error:', err);
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedConversation) return;

    setIsGeneratingDraft(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          conversationId: selectedConversation.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft generation failed');

      setDraft(data);
    } catch (err) {
      console.error('Draft error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleReply = () => {
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
  };

  const handleSendDraft = async (draftId: string) => {
    try {
      const res = await fetch('/api/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          draftId,
          status: 'sent',
        }),
      });

      if (!res.ok) throw new Error('Failed to send draft');

      setDraft(null);
      fetchConversations();
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  const handleDiscardDraft = async (draftId: string) => {
    try {
      const res = await fetch('/api/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          draftId,
          status: 'discarded',
        }),
      });

      if (!res.ok) throw new Error('Failed to discard draft');

      setDraft(null);
    } catch (err) {
      console.error('Discard error:', err);
    }
  };

  // Scheduling handler
  const handleSchedule = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch('/api/inbox/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          conversationId: selectedConversation.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create scheduling request');

      // Navigate to the scheduler or show success message
      if (data.requestId) {
        window.location.href = `/scheduler?requestId=${data.requestId}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scheduling request');
    }
  };

  // Sync handler
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      // Refresh conversations after sync
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup folders handler
  const handleSetup = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');

      // Trigger initial sync
      await handleSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      setIsSyncing(false);
    }
  };

  // Not synced state
  if (!isSynced && conversations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center p-8">
          <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">
            Connect Your Email
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Set up your inbox to sync emails from Outlook. We'll organize your
            conversations and help you stay on top of follow-ups.
          </p>
          <button
            onClick={handleSetup}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {isSyncing ? 'Setting up...' : 'Setup Inbox'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action queue tabs with tasks toggle */}
      <div className="flex items-center border-b border-gray-200">
        <div className="flex-1">
          <ActionQueueTabs
            counts={counts}
            activeQueue={activeQueue}
            onQueueChange={setActiveQueue}
          />
        </div>
        <div className="px-4">
          <button
            onClick={() => setShowTasks(!showTasks)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              showTasks
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
            title={showTasks ? 'Hide Tasks' : 'Show Tasks'}
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Conversation list */}
        <div className="w-96 shrink-0">
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedConversation?.id}
            onSelect={setSelectedConversation}
            isLoading={isLoading}
            onRefresh={handleSync}
          />
        </div>

        {/* Conversation detail */}
        <div className="flex-1 min-w-0">
          {selectedConversation ? (
            <ConversationDetail
              conversation={selectedConversation}
              messages={selectedMessages}
              draft={draft || undefined}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onSnooze={handleSnooze}
              onUnsnooze={handleUnsnooze}
              onLink={handleLink}
              onUnlink={handleUnlink}
              onPriority={handlePriority}
              onUndo={handleUndo}
              onAnalyze={handleAnalyze}
              onGenerateDraft={handleGenerateDraft}
              onSendDraft={handleSendDraft}
              onDiscardDraft={handleDiscardDraft}
              onSchedule={handleSchedule}
              onReply={handleReply}
              schedulingSuggestion={schedulingSuggestion || undefined}
              lastActionId={lastActionId}
              isGeneratingDraft={isGeneratingDraft}
              showCompose={showCompose}
              onCloseCompose={handleCloseCompose}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Select a conversation to view
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tasks pane */}
        {showTasks && (
          <TasksPane onClose={() => setShowTasks(false)} />
        )}
      </div>
    </div>
  );
}
