'use client';

import { useState, useCallback } from 'react';
import { X, Sparkles, Play, Check, ChevronDown, ChevronRight, Loader2, MessageSquare, Shield, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerateStageContentProps {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  onAddContent: (content: {
    pitchPoints?: Array<{ id: string; title: string; content: string }>;
    objectionHandlers?: Array<{ id: string; objection: string; response: string }>;
    resources?: Array<{ id: string; title: string; url: string; type: string }>;
  }) => void;
}

interface GeneratedContent {
  pitchPoints: Array<{
    id: string;
    title: string;
    content: string;
    confidence: 'high' | 'medium' | 'low';
    mentions: number;
  }>;
  objections: Array<{
    id: string;
    objection: string;
    response: string;
    confidence: 'high' | 'medium' | 'low';
    frequency: number;
  }>;
  resources: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
    mentions: number;
  }>;
}

type GenerationStep = 'select' | 'generating' | 'results';

export function GenerateStageContent({
  isOpen,
  onClose,
  stageName,
  onAddContent,
}: GenerateStageContentProps) {
  const [step, setStep] = useState<GenerationStep>('select');
  const [dateRange, setDateRange] = useState<'30' | '60' | '90'>('30');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<GeneratedContent | null>(null);
  const [selectedPitchPoints, setSelectedPitchPoints] = useState<Set<string>>(new Set());
  const [selectedObjections, setSelectedObjections] = useState<Set<string>>(new Set());
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());

  const [expandedSections, setExpandedSections] = useState({
    pitchPoints: true,
    objections: true,
    resources: false,
  });

  const resetState = useCallback(() => {
    setStep('select');
    setDateRange('30');
    setProgress(0);
    setProgressMessage('');
    setResults(null);
    setSelectedPitchPoints(new Set());
    setSelectedObjections(new Set());
    setSelectedResources(new Set());
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const runGeneration = async () => {
    setStep('generating');

    const messages = [
      `Finding calls at "${stageName}" stage...`,
      'Extracting conversation excerpts...',
      'Identifying successful pitch patterns...',
      'Detecting common objections...',
      'Analyzing objection responses...',
      'Finding mentioned resources...',
      'Generating recommendations...',
    ];

    for (let i = 0; i < messages.length; i++) {
      setProgressMessage(messages[i]);
      setProgress(((i + 1) / messages.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));
    }

    // Generate mock results
    const mockResults = generateMockContent(stageName);
    setResults(mockResults);
    setStep('results');
  };

  const handleAddSelected = () => {
    if (!results) return;

    const content: Parameters<typeof onAddContent>[0] = {};

    if (selectedPitchPoints.size > 0) {
      content.pitchPoints = results.pitchPoints
        .filter(p => selectedPitchPoints.has(p.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          content: p.content,
        }));
    }

    if (selectedObjections.size > 0) {
      content.objectionHandlers = results.objections
        .filter(o => selectedObjections.has(o.id))
        .map(o => ({
          id: o.id,
          objection: o.objection,
          response: o.response,
        }));
    }

    if (selectedResources.size > 0) {
      content.resources = results.resources
        .filter(r => selectedResources.has(r.id))
        .map(r => ({
          id: r.id,
          title: r.title,
          url: r.url,
          type: r.type,
        }));
    }

    onAddContent(content);
    handleClose();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleAllInSection = (section: 'pitchPoints' | 'objections' | 'resources') => {
    if (!results) return;

    const items = section === 'pitchPoints' ? results.pitchPoints :
                  section === 'objections' ? results.objections :
                  results.resources;

    const setter = section === 'pitchPoints' ? setSelectedPitchPoints :
                   section === 'objections' ? setSelectedObjections :
                   setSelectedResources;

    const selected = section === 'pitchPoints' ? selectedPitchPoints :
                     section === 'objections' ? selectedObjections :
                     selectedResources;

    const allSelected = items.every(item => selected.has(item.id));

    if (allSelected) {
      setter(new Set());
    } else {
      setter(new Set(items.map(item => item.id)));
    }
  };

  const totalSelected = selectedPitchPoints.size + selectedObjections.size + selectedResources.size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate from Transcripts</h2>
              <p className="text-sm text-gray-500">
                For stage: <span className="font-medium">{stageName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <SelectTranscripts
              dateRange={dateRange}
              setDateRange={setDateRange}
              stageName={stageName}
            />
          )}

          {step === 'generating' && (
            <GeneratingProgress
              progress={progress}
              message={progressMessage}
            />
          )}

          {step === 'results' && results && (
            <GeneratedResults
              results={results}
              selectedPitchPoints={selectedPitchPoints}
              setSelectedPitchPoints={setSelectedPitchPoints}
              selectedObjections={selectedObjections}
              setSelectedObjections={setSelectedObjections}
              selectedResources={selectedResources}
              setSelectedResources={setSelectedResources}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              toggleAllInSection={toggleAllInSection}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          {step === 'select' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={runGeneration}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Analyze Transcripts
              </button>
            </>
          )}

          {step === 'generating' && (
            <div className="w-full text-center text-sm text-gray-500">
              Analyzing call transcripts...
            </div>
          )}

          {step === 'results' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Analyze Again
              </button>
              <button
                onClick={handleAddSelected}
                disabled={totalSelected === 0}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  totalSelected > 0
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <Check className="w-4 h-4" />
                Add {totalSelected} Selected
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectTranscripts({
  dateRange,
  setDateRange,
  stageName,
}: {
  dateRange: '30' | '60' | '90';
  setDateRange: (v: '30' | '60' | '90') => void;
  stageName: string;
}) {
  const callCounts = {
    '30': Math.floor(Math.random() * 15) + 10,
    '60': Math.floor(Math.random() * 30) + 20,
    '90': Math.floor(Math.random() * 45) + 30,
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-sm text-blue-700">
          The AI will analyze calls where deals were in the <span className="font-medium">&quot;{stageName}&quot;</span> stage
          and extract common pitch points, objections, and resources mentioned.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date Range
        </label>
        <div className="flex gap-2">
          {(['30', '60', '90'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={cn(
                'flex-1 py-3 px-4 text-sm font-medium rounded-lg border transition-colors',
                dateRange === days
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <span className="block text-lg font-semibold">{days}</span>
              <span className="block text-xs text-gray-500">days</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {callCounts[dateRange]} calls found at this stage
        </p>
      </div>
    </div>
  );
}

function GeneratingProgress({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-6">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing Transcripts</h3>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      <div className="w-full max-w-md">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function GeneratedResults({
  results,
  selectedPitchPoints,
  setSelectedPitchPoints,
  selectedObjections,
  setSelectedObjections,
  selectedResources,
  setSelectedResources,
  expandedSections,
  toggleSection,
  toggleAllInSection,
}: {
  results: GeneratedContent;
  selectedPitchPoints: Set<string>;
  setSelectedPitchPoints: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedObjections: Set<string>;
  setSelectedObjections: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedResources: Set<string>;
  setSelectedResources: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedSections: { pitchPoints: boolean; objections: boolean; resources: boolean };
  toggleSection: (section: 'pitchPoints' | 'objections' | 'resources') => void;
  toggleAllInSection: (section: 'pitchPoints' | 'objections' | 'resources') => void;
}) {
  const toggleItem = (
    id: string,
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Pitch Points */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('pitchPoints')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-800">
              Pitch Points ({results.pitchPoints.length})
            </span>
          </div>
          {expandedSections.pitchPoints ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.pitchPoints && (
          <div className="p-3 space-y-2">
            <button
              onClick={() => toggleAllInSection('pitchPoints')}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              {results.pitchPoints.every(p => selectedPitchPoints.has(p.id))
                ? 'Deselect All'
                : 'Select All'}
            </button>
            {results.pitchPoints.map((point) => (
              <div
                key={point.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedPitchPoints.has(point.id)
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                onClick={() => toggleItem(point.id, selectedPitchPoints, setSelectedPitchPoints)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{point.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{point.content}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded', getConfidenceColor(point.confidence))}>
                      {point.confidence}
                    </span>
                    <span className="text-xs text-gray-400">{point.mentions} calls</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Objections */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('objections')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-gray-800">
              Objections ({results.objections.length})
            </span>
          </div>
          {expandedSections.objections ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.objections && (
          <div className="p-3 space-y-2">
            <button
              onClick={() => toggleAllInSection('objections')}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              {results.objections.every(o => selectedObjections.has(o.id))
                ? 'Deselect All'
                : 'Select All'}
            </button>
            {results.objections.map((obj) => (
              <div
                key={obj.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedObjections.has(obj.id)
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                onClick={() => toggleItem(obj.id, selectedObjections, setSelectedObjections)}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800">&quot;{obj.objection}&quot;</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded flex-shrink-0 ml-2', getConfidenceColor(obj.confidence))}>
                    {obj.frequency}x
                  </span>
                </div>
                <div className="pl-3 border-l-2 border-green-200">
                  <p className="text-xs text-gray-600">{obj.response}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('resources')}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-green-600" />
            <span className="font-medium text-gray-800">
              Resources ({results.resources.length})
            </span>
          </div>
          {expandedSections.resources ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.resources && (
          <div className="p-3 space-y-2">
            <button
              onClick={() => toggleAllInSection('resources')}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              {results.resources.every(r => selectedResources.has(r.id))
                ? 'Deselect All'
                : 'Select All'}
            </button>
            {results.resources.map((resource) => (
              <div
                key={resource.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedResources.has(resource.id)
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                onClick={() => toggleItem(resource.id, selectedResources, setSelectedResources)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{resource.title}</p>
                    <p className="text-xs text-gray-500">{resource.type}</p>
                  </div>
                  <span className="text-xs text-gray-400">{resource.mentions} mentions</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function generateMockContent(stageName: string): GeneratedContent {
  return {
    pitchPoints: [
      {
        id: 'pp_1',
        title: 'Time Savings Value Prop',
        content: 'Emphasize average time savings of 4 hours per week per technician through automated scheduling and route optimization.',
        confidence: 'high',
        mentions: 23,
      },
      {
        id: 'pp_2',
        title: 'Mobile App Capabilities',
        content: 'Highlight the field technician mobile app - offline mode, photo capture, and real-time sync features.',
        confidence: 'high',
        mentions: 18,
      },
      {
        id: 'pp_3',
        title: 'Integration Simplicity',
        content: 'Mention the one-click integration with popular CRMs like FieldRoutes, PestPac, and RealGreen.',
        confidence: 'medium',
        mentions: 12,
      },
    ],
    objections: [
      {
        id: 'obj_1',
        objection: "The price seems high compared to our current solution",
        response: 'Focus on ROI - customers typically see payback within 3 months through efficiency gains. Offer to run a cost-benefit analysis specific to their operation.',
        confidence: 'high',
        frequency: 15,
      },
      {
        id: 'obj_2',
        objection: "We're already using another system and switching would be disruptive",
        response: 'Emphasize our dedicated migration team and zero-downtime transition process. Share case study of similar-sized company that switched in under 2 weeks.',
        confidence: 'high',
        frequency: 12,
      },
      {
        id: 'obj_3',
        objection: "Our team isn't tech-savvy enough for new software",
        response: 'Mention our in-field training program and 24/7 support. The interface was designed for technicians, not IT professionals.',
        confidence: 'medium',
        frequency: 8,
      },
    ],
    resources: [
      {
        id: 'res_1',
        title: 'ABC Pest Control Case Study',
        url: 'https://example.com/case-study-abc',
        type: 'Case Study',
        mentions: 9,
      },
      {
        id: 'res_2',
        title: 'ROI Calculator',
        url: 'https://example.com/roi-calculator',
        type: 'Tool',
        mentions: 7,
      },
      {
        id: 'res_3',
        title: 'Mobile App Demo Video',
        url: 'https://example.com/mobile-demo',
        type: 'Video',
        mentions: 5,
      },
    ],
  };
}
