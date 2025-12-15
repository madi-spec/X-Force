'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Users, FileText, X, StickyNote, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { TranscriptionUploadModal } from '@/components/meetings/TranscriptionUploadModal';
import type { ActivityType, Contact, Deal } from '@/types';

interface ActivityLoggerProps {
  dealId: string;
  companyId: string;
  userId: string;
  contacts?: Contact[];
  deal?: Deal;
}

const QUICK_ACTIVITIES = [
  { id: 'email_sent' as ActivityType, label: 'Log Email', icon: Mail, color: 'text-blue-600 hover:bg-blue-50' },
  { id: 'call_made' as ActivityType, label: 'Log Call', icon: Phone, color: 'text-green-600 hover:bg-green-50' },
  { id: 'meeting_held' as ActivityType, label: 'Log Meeting', icon: Users, color: 'text-purple-600 hover:bg-purple-50' },
  { id: 'proposal_sent' as ActivityType, label: 'Log Proposal', icon: FileText, color: 'text-amber-600 hover:bg-amber-50' },
  { id: 'note' as ActivityType, label: 'Add Note', icon: StickyNote, color: 'text-gray-600 hover:bg-gray-50' },
];

export function ActivityLogger({ dealId, companyId, userId, contacts, deal }: ActivityLoggerProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    body: '',
    contactId: '',
    occurred_at: new Date().toISOString().slice(0, 16),
  });

  const handleOpenModal = (type: ActivityType) => {
    setSelectedType(type);
    setFormData({
      subject: '',
      body: '',
      contactId: '',
      occurred_at: new Date().toISOString().slice(0, 16),
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: insertError } = await supabase
        .from('activities')
        .insert({
          deal_id: dealId,
          company_id: companyId,
          user_id: userId,
          contact_id: formData.contactId || null,
          type: selectedType,
          subject: formData.subject || null,
          body: formData.body || null,
          occurred_at: formData.occurred_at,
          visible_to_teams: ['voice', 'xrai'],
        });

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      setError('Failed to log activity');
    } finally {
      setLoading(false);
    }
  };

  const getActivityConfig = (type: ActivityType) => {
    return QUICK_ACTIVITIES.find(a => a.id === type);
  };

  const activeConfig = selectedType ? getActivityConfig(selectedType) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Quick Log</h2>

      <div className="grid grid-cols-6 gap-2">
        {QUICK_ACTIVITIES.map((activity) => {
          const Icon = activity.icon;
          return (
            <button
              key={activity.id}
              onClick={() => handleOpenModal(activity.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 transition-colors',
                activity.color
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium text-gray-700">{activity.label.replace('Log ', '').replace('Add ', '')}</span>
            </button>
          );
        })}
        {/* Upload Transcript Button */}
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className={cn(
            'flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 transition-colors',
            'text-indigo-600 hover:bg-indigo-50 border-dashed'
          )}
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium text-gray-700">Transcript</span>
        </button>
      </div>

      {/* Activity Modal */}
      {isModalOpen && activeConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <activeConfig.icon className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{activeConfig.label}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedType === 'note' ? 'Title' : 'Subject'}
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    selectedType === 'email_sent' ? 'Email subject...' :
                    selectedType === 'call_made' ? 'Call topic...' :
                    selectedType === 'meeting_held' ? 'Meeting agenda...' :
                    selectedType === 'proposal_sent' ? 'Proposal title...' :
                    'Note title...'
                  }
                />
              </div>

              {/* Contact */}
              {contacts && contacts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    With Contact (optional)
                  </label>
                  <select
                    value={formData.contactId}
                    onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select contact...</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.title ? `(${contact.title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date/Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  When
                </label>
                <input
                  type="datetime-local"
                  value={formData.occurred_at}
                  onChange={(e) => setFormData({ ...formData, occurred_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes/Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedType === 'note' ? 'Content' : 'Notes'}
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    selectedType === 'email_sent' ? 'Key points from the email...' :
                    selectedType === 'call_made' ? 'What was discussed...' :
                    selectedType === 'meeting_held' ? 'Meeting notes and outcomes...' :
                    selectedType === 'proposal_sent' ? 'Proposal details...' :
                    'Note content...'
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transcription Upload Modal */}
      <TranscriptionUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        dealId={dealId}
        companyId={companyId}
        deal={deal}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
