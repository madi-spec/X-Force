'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Loader2,
  Copy,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

interface TaskActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onCompleted: () => void;
}

interface EmailSuggestion {
  subject: string;
  body: string;
  tone: string;
  callToAction: string;
}

export function TaskActionModal({
  isOpen,
  onClose,
  task,
  onCompleted,
}: TaskActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<EmailSuggestion | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && task.type === 'email' && !emailSuggestion) {
      generateEmailSuggestion();
    }
  }, [isOpen, task.type, emailSuggestion]);

  const generateEmailSuggestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/suggest-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSuggestion(data.suggestion);
        setEmailSubject(data.suggestion.subject);
        setEmailBody(data.suggestion.body);
      }
    } catch (error) {
      console.error('Failed to generate email suggestion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (actionType?: string) => {
    setCompleting(true);
    try {
      const actionData = actionType ? {
        type: actionType,
        subject: emailSubject || task.title,
        body: emailBody || notes || task.description,
        metadata: emailSuggestion ? { ai_suggested: true } : {},
      } : undefined;

      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, action: actionData, notes }),
      });

      if (res.ok) {
        onCompleted();
        onClose();
      } else {
        const data = await res.json();
        alert('Failed to complete task: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEmailClient = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailto, '_blank');
  };

  if (!isOpen) return null;

  const getTaskIcon = () => {
    switch (task.type) {
      case 'email': return <Mail className="h-5 w-5" />;
      case 'call': return <Phone className="h-5 w-5" />;
      case 'meeting': return <Calendar className="h-5 w-5" />;
      default: return <CheckCircle2 className="h-5 w-5" />;
    }
  };

  const getTaskColor = () => {
    switch (task.type) {
      case 'email': return 'text-blue-600 bg-blue-50';
      case 'call': return 'text-green-600 bg-green-50';
      case 'meeting': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const deal = task.deal as { id: string; name: string } | undefined;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', getTaskColor())}>
              {getTaskIcon()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
              {deal && <p className="text-sm text-gray-500">{deal.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Email Task */}
          {task.type === 'email' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-500">Generating email suggestion...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Sparkles className="h-4 w-4" />
                      AI-Generated Email
                    </div>
                    <button
                      onClick={generateEmailSuggestion}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Regenerate
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={openEmailClient}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Email Client
                    </button>
                    <button
                      onClick={() => copyToClipboard(emailSubject + '\n\n' + emailBody)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Call Task */}
          {task.type === 'call' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">Call Task</h3>
                <p className="text-sm text-green-700">
                  {task.description || 'Make a call to complete this task.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter notes from your call..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {/* Meeting Task */}
          {task.type === 'meeting' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2">Meeting Task</h3>
                <p className="text-sm text-purple-700">
                  {task.description || 'Schedule or complete a meeting.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter meeting notes or outcomes..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Other Task Types */}
          {!['email', 'call', 'meeting'].includes(task.type) && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Task Details</h3>
                <p className="text-sm text-gray-700">
                  {task.description || 'Complete this task.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const actionType = task.type === 'email' ? 'email_sent'
                : task.type === 'call' ? 'call_made'
                : task.type === 'meeting' ? 'meeting_held'
                : 'note';
              handleComplete(actionType);
            }}
            disabled={completing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}
