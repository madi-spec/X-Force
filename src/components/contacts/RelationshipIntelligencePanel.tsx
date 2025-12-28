'use client';

import { useState, useEffect } from 'react';
import {
  Heart,
  Users,
  Lightbulb,
  MessageSquare,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Quote,
  Sparkles,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Contact, RelationshipFact, CommunicationStyle, ContactMeetingMention } from '@/types';

interface RelationshipIntelligencePanelProps {
  contact: Contact;
  onFactAdded?: () => void;
}

interface IntelligenceData {
  relationshipFacts: RelationshipFact[];
  communicationStyle: CommunicationStyle | null;
  meetingMentions: (ContactMeetingMention & {
    transcription?: { id: string; title: string; meeting_date: string; duration_minutes: number | null };
  })[];
  aiConfidence: number | null;
}

const factTypeConfig: Record<string, { label: string; icon: typeof Heart; color: string }> = {
  personal: { label: 'Personal', icon: Heart, color: 'text-pink-600 bg-pink-50' },
  family: { label: 'Family', icon: Users, color: 'text-rose-600 bg-rose-50' },
  interest: { label: 'Interests', icon: Lightbulb, color: 'text-amber-600 bg-amber-50' },
  preference: { label: 'Preferences', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  communication: { label: 'Communication', icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50' },
  concern: { label: 'Concerns', icon: AlertCircle, color: 'text-orange-600 bg-orange-50' },
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  meeting: Calendar,
  text: MessageSquare,
};

export function RelationshipIntelligencePanel({ contact, onFactAdded }: RelationshipIntelligencePanelProps) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFactType, setNewFactType] = useState<string>('personal');
  const [newFactText, setNewFactText] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function fetchIntelligence() {
      try {
        const response = await fetch(`/api/contacts/${contact.id}/intelligence`);
        if (response.ok) {
          const result = await response.json();
          setData({
            relationshipFacts: result.relationshipFacts || [],
            communicationStyle: result.communicationStyle,
            meetingMentions: result.meetingMentions || [],
            aiConfidence: result.aiConfidence,
          });
        }
      } catch (error) {
        console.error('Error fetching intelligence:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchIntelligence();
  }, [contact.id]);

  const handleAddFact = async () => {
    if (!newFactText.trim()) return;

    setAdding(true);
    try {
      const response = await fetch(`/api/contacts/${contact.id}/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newFactType, fact: newFactText.trim() }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) =>
          prev
            ? { ...prev, relationshipFacts: [...prev.relationshipFacts, result.addedFact] }
            : null
        );
        setNewFactText('');
        setShowAddFact(false);
        onFactAdded?.();
      }
    } catch (error) {
      console.error('Error adding fact:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFact = async (index: number) => {
    try {
      const response = await fetch(`/api/contacts/${contact.id}/intelligence?index=${index}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setData((prev) =>
          prev
            ? { ...prev, relationshipFacts: prev.relationshipFacts.filter((_, i) => i !== index) }
            : null
        );
      }
    } catch (error) {
      console.error('Error removing fact:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        Unable to load intelligence data
      </div>
    );
  }

  // Group facts by type
  const factsByType: Record<string, RelationshipFact[]> = {};
  data.relationshipFacts.forEach((fact) => {
    if (!factsByType[fact.type]) {
      factsByType[fact.type] = [];
    }
    factsByType[fact.type].push(fact);
  });

  return (
    <div className="p-4 space-y-4">
      {/* Header with AI badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <h4 className="text-sm font-medium text-gray-900">Relationship Intelligence</h4>
        </div>
        {data.aiConfidence !== null && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${data.aiConfidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round(data.aiConfidence * 100)}%</span>
          </div>
        )}
      </div>

      {/* Facts by Type */}
      {Object.keys(factTypeConfig).map((type) => {
        const facts = factsByType[type];
        if (!facts || facts.length === 0) return null;

        const config = factTypeConfig[type];
        const Icon = config.icon;

        return (
          <div key={type}>
            <div className={cn('flex items-center gap-1.5 mb-2', config.color.split(' ')[0])}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">{config.label}</span>
            </div>
            <div className="space-y-1.5 pl-5">
              {facts.map((fact, i) => (
                <div key={i} className="group flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{fact.fact}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fact.source}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFact(data.relationshipFacts.indexOf(fact))}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                    title="Remove fact"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Communication Style */}
      {data.communicationStyle && Object.keys(data.communicationStyle).length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-indigo-600 mb-2">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Communication Style</span>
          </div>
          <div className="flex flex-wrap gap-2 pl-5">
            {data.communicationStyle.preferredChannel && (
              <div className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {(() => {
                  const ChannelIcon = channelIcons[data.communicationStyle.preferredChannel] || MessageSquare;
                  return <ChannelIcon className="h-3 w-3" />;
                })()}
                Prefers {data.communicationStyle.preferredChannel}
              </div>
            )}
            {data.communicationStyle.communicationTone && (
              <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                {data.communicationStyle.communicationTone} tone
              </div>
            )}
            {data.communicationStyle.bestTimeToReach && (
              <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Best: {data.communicationStyle.bestTimeToReach}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meeting Mentions */}
      {data.meetingMentions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-gray-600 mb-2">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Detected in {data.meetingMentions.length} meeting{data.meetingMentions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2 pl-5">
            {data.meetingMentions.slice(0, 3).map((mention) => (
              <div key={mention.id} className="text-sm">
                <p className="text-gray-700">{mention.transcription?.title || 'Meeting'}</p>
                <p className="text-xs text-gray-400">
                  {mention.transcription?.meeting_date
                    ? formatRelativeTime(mention.transcription.meeting_date)
                    : ''}
                  {mention.sentiment_detected && (
                    <span className={cn(
                      'ml-2',
                      mention.sentiment_detected === 'positive' && 'text-green-600',
                      mention.sentiment_detected === 'negative' && 'text-red-600'
                    )}>
                      • {mention.sentiment_detected}
                    </span>
                  )}
                </p>
                {mention.key_quotes && mention.key_quotes.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-gray-500 italic">
                    <Quote className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{mention.key_quotes[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Fact */}
      {showAddFact ? (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <select
            value={newFactType}
            onChange={(e) => setNewFactType(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(factTypeConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newFactText}
            onChange={(e) => setNewFactText(e.target.value)}
            placeholder="Enter a fact about this contact..."
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddFact(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFact}
              disabled={adding || !newFactText.trim()}
              className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Fact'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddFact(true)}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
        >
          <Plus className="h-3 w-3" />
          Add a fact
        </button>
      )}

      {/* Empty State */}
      {data.relationshipFacts.length === 0 && data.meetingMentions.length === 0 && !showAddFact && (
        <p className="text-sm text-gray-500 text-center py-2">
          No relationship intelligence yet. Facts will be detected from meeting transcripts.
        </p>
      )}
    </div>
  );
}
