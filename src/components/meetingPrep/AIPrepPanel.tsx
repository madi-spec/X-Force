'use client';

import { Target, MessageSquare, AlertTriangle, HelpCircle, Sparkles } from 'lucide-react';
import type { EnhancedMeetingPrep } from '@/lib/meetingPrep/buildEnhancedPrep';

interface AIPrepPanelProps {
  aiPrep: EnhancedMeetingPrep['aiPrep'];
}

export function AIPrepPanel({ aiPrep }: AIPrepPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          AI Meeting Prep
        </h2>
      </div>

      {/* Quick Context */}
      {aiPrep.quick_context && (
        <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
          <p className="text-sm text-purple-800">{aiPrep.quick_context}</p>
        </div>
      )}

      {/* Objective */}
      {aiPrep.objective && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Objective</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed pl-6">
            {aiPrep.objective}
          </p>
        </div>
      )}

      {/* Talking Points */}
      {aiPrep.talking_points.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Talking Points</h3>
          </div>
          <ul className="space-y-2 pl-6">
            {aiPrep.talking_points.map((point, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 flex-shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Landmines / Watch Out */}
      {aiPrep.landmines.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-700">Watch Out For</h3>
          </div>
          <ul className="space-y-2 pl-6">
            {aiPrep.landmines.map((item, idx) => (
              <li key={idx} className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions to Ask */}
      {aiPrep.questions_to_ask && aiPrep.questions_to_ask.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Questions to Ask</h3>
          </div>
          <ul className="space-y-2 pl-6">
            {aiPrep.questions_to_ask.map((q, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-blue-500 flex-shrink-0">{idx + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relationship Status */}
      {aiPrep.relationship_status && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Relationship Status
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {aiPrep.relationship_status.deal_stage && (
              <div className="text-sm">
                <span className="text-gray-400">Stage:</span>{' '}
                <span className="text-gray-700 font-medium">{aiPrep.relationship_status.deal_stage}</span>
              </div>
            )}
            {aiPrep.relationship_status.deal_value !== null && (
              <div className="text-sm">
                <span className="text-gray-400">Value:</span>{' '}
                <span className="text-gray-700 font-medium">
                  ${aiPrep.relationship_status.deal_value?.toLocaleString()}
                </span>
              </div>
            )}
            {aiPrep.relationship_status.sentiment && (
              <div className="text-sm">
                <span className="text-gray-400">Sentiment:</span>{' '}
                <span className="text-gray-700 font-medium">{aiPrep.relationship_status.sentiment}</span>
              </div>
            )}
            {aiPrep.relationship_status.total_interactions > 0 && (
              <div className="text-sm">
                <span className="text-gray-400">Interactions:</span>{' '}
                <span className="text-gray-700 font-medium">
                  {aiPrep.relationship_status.total_interactions}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
