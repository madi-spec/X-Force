'use client';

import { useState, useEffect } from 'react';
import { X, Send, Loader2, Minimize2, Maximize2, Bold, Italic, Underline, List, Link2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Deal {
  id: string;
  name: string;
}

interface EmailComposeProps {
  onClose: () => void;
  onSend: (email: { to: string[]; cc?: string[]; subject: string; content: string; dealId?: string }) => Promise<void>;
  defaultTo?: string;
  defaultSubject?: string;
  isReply?: boolean;
  deals?: Deal[];
}

export function EmailCompose({
  onClose,
  onSend,
  defaultTo = '',
  defaultSubject = '',
  isReply = false,
  deals = [],
}: EmailComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(isReply && defaultSubject ? `Re: ${defaultSubject}` : defaultSubject);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [showDealDropdown, setShowDealDropdown] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) {
      setError('Please add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      setError('Please add a subject');
      return;
    }
    if (!content.trim()) {
      setError('Please write a message');
      return;
    }

    setError('');
    setIsSending(true);

    try {
      const toEmails = to.split(',').map(e => e.trim()).filter(Boolean);
      const ccEmails = cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : undefined;

      await onSend({
        to: toEmails,
        cc: ccEmails,
        subject,
        content,
        dealId: selectedDeal || undefined,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSend();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [to, subject, content]);

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-24 w-72 bg-white rounded-t-lg shadow-2xl border border-gray-200 z-50">
        <div
          onClick={() => setIsMinimized(false)}
          className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-t-lg cursor-pointer hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm font-medium truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1 hover:bg-gray-600 rounded"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-gray-600 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-24 w-[560px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50 max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white rounded-t-xl">
        <span className="text-sm font-medium">
          {isReply ? 'Reply' : 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* To Field */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="text-sm text-gray-500 w-12">To</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipients"
            className="flex-1 py-2 text-sm focus:outline-none"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cc
            </button>
          )}
        </div>

        {/* CC Field */}
        {showCc && (
          <div className="flex items-center border-b border-gray-200 px-4">
            <span className="text-sm text-gray-500 w-12">Cc</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Carbon copy"
              className="flex-1 py-2 text-sm focus:outline-none"
            />
          </div>
        )}

        {/* Subject Field */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="text-sm text-gray-500 w-12">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 py-2 text-sm focus:outline-none"
          />
        </div>

        {/* Link to Deal */}
        {deals.length > 0 && (
          <div className="flex items-center border-b border-gray-200 px-4 relative">
            <span className="text-sm text-gray-500 w-12">Deal</span>
            <button
              onClick={() => setShowDealDropdown(!showDealDropdown)}
              className="flex-1 flex items-center justify-between py-2 text-sm text-left"
            >
              <span className={selectedDeal ? 'text-gray-900' : 'text-gray-400'}>
                {selectedDeal
                  ? deals.find(d => d.id === selectedDeal)?.name
                  : 'Link to deal (optional)'}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {showDealDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedDeal('');
                    setShowDealDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                >
                  No deal
                </button>
                {deals.map(deal => (
                  <button
                    key={deal.id}
                    onClick={() => {
                      setSelectedDeal(deal.id);
                      setShowDealDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-50',
                      selectedDeal === deal.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    )}
                  >
                    {deal.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Body */}
        <div className="px-4 py-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Write your message..."
            className="w-full text-sm focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Footer with Formatting & Send */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex items-center gap-1">
          {/* Formatting buttons (decorative for now) */}
          <button className="p-2 text-gray-500 hover:bg-gray-200 rounded transition-colors">
            <Bold className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-200 rounded transition-colors">
            <Italic className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-200 rounded transition-colors">
            <Underline className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button className="p-2 text-gray-500 hover:bg-gray-200 rounded transition-colors">
            <List className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-200 rounded transition-colors">
            <Link2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Send
                <Send className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
