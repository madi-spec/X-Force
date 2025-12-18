'use client';

import { useState, useCallback } from 'react';
import { Mail, Copy, Check, Edit2, Send, X } from 'lucide-react';
import type { MeetingFollowUpEmail } from '@/types';
import {
  ContextualComposeModal,
  createTranscriptFollowupContext,
  type ComposeContextData,
} from '@/components/inbox/ContextualComposeModal';

interface FollowUpEmailPreviewProps {
  email: MeetingFollowUpEmail;
  transcriptionId: string;
  meetingTitle?: string;
  attendees?: Array<{ email: string; name?: string; role?: string }>;
}

export function FollowUpEmailPreview({
  email,
  transcriptionId,
  meetingTitle,
  attendees,
}: FollowUpEmailPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(email.subject);
  const [editedBody, setEditedBody] = useState(email.body);
  const [copied, setCopied] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  // Build compose context from transcript data
  // Deduplicate attendees by email
  const uniqueAttendees = attendees?.reduce((acc, a) => {
    const emailLower = a.email.toLowerCase();
    if (!acc.seen.has(emailLower)) {
      acc.seen.add(emailLower);
      acc.list.push(a);
    }
    return acc;
  }, { seen: new Set<string>(), list: [] as typeof attendees }).list;

  const composeContext: ComposeContextData = {
    type: 'transcript_followup',
    transcriptId: transcriptionId,
    suggestedSubject: isEditing ? editedSubject : email.subject,
    suggestedBody: isEditing ? editedBody : email.body,
    recipients: uniqueAttendees?.map((a) => ({
      email: a.email,
      name: a.name,
      role: a.role,
      confidence: a.role === 'organizer' ? 95 : 80,
    })) || [],
    sourceLabel: meetingTitle || 'Meeting Follow-up',
  };

  const handleCopy = useCallback(async () => {
    const fullEmail = `Subject: ${isEditing ? editedSubject : email.subject}\n\n${isEditing ? editedBody : email.body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [email, editedSubject, editedBody, isEditing]);

  const handleSave = useCallback(() => {
    // In a real implementation, this would save the edited email
    setIsEditing(false);
  }, []);

  const handleCancel = useCallback(() => {
    setEditedSubject(email.subject);
    setEditedBody(email.body);
    setIsEditing(false);
  }, [email]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Follow-up Email Draft</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
              >
                <Check className="h-4 w-4" />
                <span>Save</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1 text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg ml-2"
          >
            <Send className="h-4 w-4" />
            <span>Send</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Subject
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          ) : (
            <p className="text-sm font-medium text-gray-900">{email.subject}</p>
          )}
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Body
          </label>
          {isEditing ? (
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
            />
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                {email.body}
              </pre>
            </div>
          )}
        </div>

        {/* Attachment Suggestions */}
        {email.attachmentSuggestions && email.attachmentSuggestions.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Suggested Attachments
            </label>
            <ul className="space-y-1">
              {email.attachmentSuggestions.map((attachment, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                  {attachment}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      <ContextualComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        context={composeContext}
      />
    </div>
  );
}
