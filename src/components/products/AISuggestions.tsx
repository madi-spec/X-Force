'use client';

import { useState } from 'react';
import { Sparkles, Plus, X, RefreshCw, TrendingUp } from 'lucide-react';

interface AISuggestionsProps {
  stageId: string;
  suggestedPitchPoints: {
    id: string;
    text: string;
    effectiveness_score: number;
  }[];
  suggestedObjections: {
    id: string;
    objection: string;
    response: string;
    frequency: number;
    success_rate: number;
  }[];
  onAcceptPitchPoint: (point: { text: string }) => void;
  onAcceptObjection: (handler: { objection: string; response: string }) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function AISuggestions({
  suggestedPitchPoints,
  suggestedObjections,
  onAcceptPitchPoint,
  onAcceptObjection,
  onRefresh,
  loading
}: AISuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismissSuggestion = (id: string) => {
    setDismissed(new Set([...dismissed, id]));
  };

  const visiblePitchPoints = suggestedPitchPoints.filter(p => !dismissed.has(p.id));
  const visibleObjections = suggestedObjections.filter(o => !dismissed.has(o.id));

  if (visiblePitchPoints.length === 0 && visibleObjections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No AI suggestions yet.</p>
        <p className="text-xs mt-1">Run "Analyze Transcripts" to generate suggestions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-700">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">AI Suggestions</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-purple-600 hover:text-purple-700 p-1 rounded"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {visiblePitchPoints.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Suggested Pitch Points
          </h4>
          <div className="space-y-2">
            {visiblePitchPoints.map((point) => (
              <div
                key={point.id}
                className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{point.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-600">
                      {Math.round(point.effectiveness_score * 100)}% effective
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onAcceptPitchPoint({ text: point.text });
                      dismissSuggestion(point.id);
                    }}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    title="Add to stage"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => dismissSuggestion(point.id)}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleObjections.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Common Objections Detected
          </h4>
          <div className="space-y-2">
            {visibleObjections.map((obj) => (
              <div
                key={obj.id}
                className="bg-amber-50 border border-amber-100 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      &ldquo;{obj.objection}&rdquo;
                    </p>
                    {obj.response && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="text-gray-400">Response:</span> {obj.response}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Heard {obj.frequency}x</span>
                      <span>|</span>
                      <span>{Math.round(obj.success_rate * 100)}% handled successfully</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onAcceptObjection({
                          objection: obj.objection,
                          response: obj.response
                        });
                        dismissSuggestion(obj.id);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      title="Add to stage"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => dismissSuggestion(obj.id)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
