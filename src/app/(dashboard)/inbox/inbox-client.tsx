'use client';

import { useState } from 'react';
import { Plus, Mail } from 'lucide-react';
import { EmailList } from '@/components/email/EmailList';
import { EmailDetail } from '@/components/email/EmailDetail';
import { EmailCompose } from '@/components/email/EmailCompose';

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
  deal?: {
    id: string;
    name: string;
  } | null;
  metadata: {
    direction?: 'inbound' | 'outbound';
    from?: { address: string; name?: string };
    to?: Array<{ address: string; name?: string }>;
  };
}

interface InboxClientProps {
  emails: EmailActivity[];
}

export function InboxClient({ emails }: InboxClientProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailActivity | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<EmailActivity | null>(null);

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

    // Refresh the page to show the new email
    window.location.reload();
  };

  const handleReply = () => {
    if (selectedEmail) {
      setReplyTo(selectedEmail);
      setShowCompose(true);
    }
  };

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No emails yet
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Sync your Microsoft 365 account to see emails here, or compose a new email.
          </p>
          <button
            onClick={() => setShowCompose(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Compose Email
          </button>
        </div>

        {showCompose && (
          <EmailCompose
            onClose={() => {
              setShowCompose(false);
              setReplyTo(null);
            }}
            onSend={handleSendEmail}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="text-sm text-gray-500">
          {emails.length} emails
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Email list */}
        <div className="w-1/2 border-r border-gray-200 overflow-hidden">
          <EmailList
            emails={emails}
            selectedId={selectedEmail?.id}
            onSelect={setSelectedEmail}
          />
        </div>

        {/* Email detail */}
        <div className="w-1/2 overflow-hidden">
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onReply={handleReply}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select an email to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <EmailCompose
          onClose={() => {
            setShowCompose(false);
            setReplyTo(null);
          }}
          onSend={handleSendEmail}
          defaultTo={replyTo?.contact?.email || replyTo?.metadata?.from?.address || ''}
          defaultSubject={replyTo?.subject || ''}
          isReply={!!replyTo}
        />
      )}
    </div>
  );
}
