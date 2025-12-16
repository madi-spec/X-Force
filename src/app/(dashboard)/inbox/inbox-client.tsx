'use client';

import { useState, useMemo, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { FolderSidebar } from '@/components/email/FolderSidebar';
import { InboxToolbar } from '@/components/email/InboxToolbar';
import { EmailListItem } from '@/components/email/EmailListItem';
import { EmailPreviewPane } from '@/components/email/EmailPreviewPane';
import { EmailCompose } from '@/components/email/EmailCompose';
import { EmailMessage, EmailFolder, EmailFilter } from '@/components/email/types';
import { ResizablePane } from '@/components/ui/ResizablePane';

interface InboxClientProps {
  emails: EmailMessage[];
}

export function InboxClient({ emails: initialEmails }: InboxClientProps) {
  // Email state with client-side properties
  const [emails, setEmails] = useState<EmailMessage[]>(() =>
    initialEmails.map(email => ({
      ...email,
      isRead: true, // Assume all synced emails are read
      isStarred: false,
      labels: [],
    }))
  );

  // UI state
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [filter, setFilter] = useState<EmailFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<EmailMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Computed values
  const counts = useMemo(() => ({
    inbox: emails.filter(e => e.metadata.direction === 'inbound').length,
    sent: emails.filter(e => e.metadata.direction === 'outbound').length,
    all: emails.length,
    unread: emails.filter(e => !e.isRead).length,
    starred: emails.filter(e => e.isStarred).length,
    contacts: emails.filter(e => e.contact !== null).length,
    pst: emails.filter(e => e.isPst).length,
  }), [emails]);

  // Filter and search emails
  const filteredEmails = useMemo(() => {
    let result = emails;

    // Folder filter
    if (currentFolder === 'inbox') {
      result = result.filter(e => e.metadata.direction === 'inbound');
    } else if (currentFolder === 'sent') {
      result = result.filter(e => e.metadata.direction === 'outbound');
    }

    // Additional filter
    if (filter === 'unread') {
      result = result.filter(e => !e.isRead);
    } else if (filter === 'starred') {
      result = result.filter(e => e.isStarred);
    } else if (filter === 'contacts') {
      result = result.filter(e => e.contact !== null);
    } else if (filter === 'pst') {
      result = result.filter(e => e.isPst);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.subject.toLowerCase().includes(query) ||
        e.body.toLowerCase().includes(query) ||
        e.contact?.name.toLowerCase().includes(query) ||
        e.contact?.email.toLowerCase().includes(query) ||
        e.metadata.from?.address?.toLowerCase().includes(query) ||
        e.metadata.to?.[0]?.address?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [emails, currentFolder, filter, searchQuery]);

  const selectedEmail = useMemo(() =>
    emails.find(e => e.id === selectedEmailId) || null,
    [emails, selectedEmailId]
  );

  // Handlers
  const handleStarToggle = useCallback((emailId: string) => {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, isStarred: !e.isStarred } : e
    ));
  }, []);

  const handleCheckToggle = useCallback((emailId: string, checked: boolean) => {
    setCheckedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(emailId);
      } else {
        newSet.delete(emailId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setCheckedIds(new Set(filteredEmails.map(e => e.id)));
  }, [filteredEmails]);

  const handleDeselectAll = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  // Bulk action handlers
  const handleArchive = useCallback(() => {
    // Remove checked emails from view (client-side only for now)
    setEmails(prev => prev.filter(e => !checkedIds.has(e.id)));
    setCheckedIds(new Set());
    setSelectedEmailId(null);
  }, [checkedIds]);

  const handleDelete = useCallback(() => {
    // Remove checked emails from view (client-side only for now)
    setEmails(prev => prev.filter(e => !checkedIds.has(e.id)));
    setCheckedIds(new Set());
    setSelectedEmailId(null);
  }, [checkedIds]);

  const handleMarkRead = useCallback(() => {
    setEmails(prev => prev.map(e =>
      checkedIds.has(e.id) ? { ...e, isRead: true } : e
    ));
  }, [checkedIds]);

  const handleMarkUnread = useCallback(() => {
    setEmails(prev => prev.map(e =>
      checkedIds.has(e.id) ? { ...e, isRead: false } : e
    ));
  }, [checkedIds]);

  const handleStarSelected = useCallback(() => {
    setEmails(prev => prev.map(e =>
      checkedIds.has(e.id) ? { ...e, isStarred: true } : e
    ));
  }, [checkedIds]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/microsoft/sync', { method: 'POST' });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendEmail = async (email: {
    to: string[];
    cc?: string[];
    subject: string;
    content: string;
  }) => {
    const response = await fetch('/api/microsoft/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send email');
    }

    // Refresh after sending
    window.location.reload();
  };

  const handleReply = useCallback(() => {
    if (selectedEmail) {
      setReplyToEmail(selectedEmail);
      setShowCompose(true);
    }
  }, [selectedEmail]);

  // Empty state
  if (emails.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No emails yet
          </h2>
          <p className="text-gray-500 mb-6">
            Sync your Microsoft 365 account to see emails here, or compose a new email.
          </p>
          <button
            onClick={() => setShowCompose(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/20"
          >
            <Mail className="h-5 w-5" />
            Compose Email
          </button>
        </div>

        {showCompose && (
          <EmailCompose
            onClose={() => {
              setShowCompose(false);
              setReplyToEmail(null);
            }}
            onSend={handleSendEmail}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Folder Sidebar - Resizable */}
      <ResizablePane
        defaultWidth={224}
        minWidth={180}
        maxWidth={320}
        side="left"
        className="bg-gray-50/80"
      >
        <FolderSidebar
          currentFolder={currentFolder}
          onFolderChange={setCurrentFolder}
          currentFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
          onComposeClick={() => setShowCompose(true)}
        />
      </ResizablePane>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <InboxToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filter={filter}
          onFilterChange={setFilter}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          selectedCount={checkedIds.size}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          allSelected={checkedIds.size === filteredEmails.length && filteredEmails.length > 0}
          totalCount={filteredEmails.length}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onMarkRead={handleMarkRead}
          onMarkUnread={handleMarkUnread}
          onStarSelected={handleStarSelected}
        />

        {/* Email List and Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List - Resizable */}
          <ResizablePane
            defaultWidth={420}
            minWidth={280}
            maxWidth={600}
            side="left"
            className="border-r border-gray-200 overflow-hidden"
          >
            <div className="h-full overflow-y-auto">
              {filteredEmails.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No emails match your filter</p>
                  </div>
                </div>
              ) : (
                filteredEmails.map(email => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmailId === email.id}
                    isChecked={checkedIds.has(email.id)}
                    onSelect={() => setSelectedEmailId(email.id)}
                    onCheck={(checked) => handleCheckToggle(email.id, checked)}
                    onStarToggle={() => handleStarToggle(email.id)}
                  />
                ))
              )}
            </div>
          </ResizablePane>

          {/* Preview Pane */}
          <EmailPreviewPane
            email={selectedEmail}
            onClose={() => setSelectedEmailId(null)}
            onReply={handleReply}
            onStarToggle={() => selectedEmail && handleStarToggle(selectedEmail.id)}
          />
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <EmailCompose
          onClose={() => {
            setShowCompose(false);
            setReplyToEmail(null);
          }}
          onSend={handleSendEmail}
          defaultTo={replyToEmail?.contact?.email || replyToEmail?.metadata?.from?.address || ''}
          defaultSubject={replyToEmail?.subject || ''}
          isReply={!!replyToEmail}
        />
      )}
    </div>
  );
}
