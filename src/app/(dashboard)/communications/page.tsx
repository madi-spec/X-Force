'use client';

import { useState } from 'react';
import { ConversationList } from '@/components/communications/ConversationList';
import { ConversationThread } from '@/components/communications/ConversationThread';
import { CustomerContext } from '@/components/communications/CustomerContext';

export default function CommunicationsPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  const handleSelectCompany = (
    companyId: string | null,
    contactId?: string | null,
    senderEmail?: string | null,
    companyName?: string | null
  ) => {
    setSelectedCompanyId(companyId);
    setSelectedCompanyName(companyName || null);
    setSelectedContactId(contactId || null);
    setSelectedSenderEmail(senderEmail || null);
  };

  return (
    <div
      className="flex -m-4 lg:-m-6 overflow-hidden"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Left: Conversation List */}
      <ConversationList
        selectedCompanyId={selectedCompanyId}
        selectedSenderEmail={selectedSenderEmail}
        onSelectCompany={handleSelectCompany}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
      />

      {/* Center: Conversation Thread */}
      <ConversationThread
        companyId={selectedCompanyId}
        companyName={selectedCompanyName}
        contactId={selectedContactId}
        senderEmail={selectedSenderEmail}
        channelFilter={channelFilter}
      />

      {/* Right: Customer Context */}
      <CustomerContext
        companyId={selectedCompanyId}
        contactId={selectedContactId}
        senderEmail={selectedSenderEmail}
        onLeadCreated={() => {
          // Refresh the page to show updated linked state
          window.location.reload();
        }}
      />
    </div>
  );
}
