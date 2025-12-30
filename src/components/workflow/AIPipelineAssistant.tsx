'use client';

import { useState, useCallback } from 'react';
import { useWorkflow, PROCESS_TYPE_CONFIG, NODE_CATEGORIES } from '@/lib/workflow';
import { X, Sparkles, Play, Check, ChevronRight, AlertCircle, Loader2, Zap, GitBranch, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPipelineAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  pipelineStructure: {
    description: string;
    suggestedChanges: string[];
  };
  conditionSuggestions: Array<{
    id: string;
    name: string;
    description: string;
    impact: string;
    field: string;
    threshold: string;
  }>;
  aiActionSuggestions: Array<{
    id: string;
    name: string;
    description: string;
    impact: string;
    trigger: string;
  }>;
  stageContentSuggestions: Array<{
    stageName: string;
    pitchPoints: string[];
    objections: Array<{ objection: string; response: string }>;
  }>;
}

type AnalysisStep = 'configure' | 'analyzing' | 'results';

export function AIPipelineAssistant({ isOpen, onClose }: AIPipelineAssistantProps) {
  const { processType, addNode, nodes } = useWorkflow();
  const config = PROCESS_TYPE_CONFIG[processType];

  const [step, setStep] = useState<AnalysisStep>('configure');
  const [dateRange, setDateRange] = useState<'30' | '60' | '90'>('30');
  const [dealFilter, setDealFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const resetState = useCallback(() => {
    setStep('configure');
    setDateRange('30');
    setDealFilter('all');
    setProgress(0);
    setProgressMessage('');
    setResults(null);
    setAppliedSuggestions(new Set());
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const runAnalysis = async () => {
    setStep('analyzing');

    // Simulate analysis progress
    const messages = [
      `Fetching ${config.entityName} transcripts from the last ${dateRange} days...`,
      `Analyzing conversation patterns across ${Math.floor(Math.random() * 50) + 20} calls...`,
      'Identifying successful deal patterns...',
      'Detecting common bottlenecks...',
      'Generating condition thresholds...',
      'Preparing automation recommendations...',
      'Extracting pitch points and objections...',
      'Finalizing recommendations...',
    ];

    for (let i = 0; i < messages.length; i++) {
      setProgressMessage(messages[i]);
      setProgress(((i + 1) / messages.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
    }

    // Generate mock results based on process type
    const mockResults = generateMockResults(processType, config);
    setResults(mockResults);
    setStep('results');
  };

  const applySuggestion = (suggestionId: string, type: 'condition' | 'aiAction') => {
    if (appliedSuggestions.has(suggestionId)) return;

    // Create a new node based on the suggestion
    const suggestion = type === 'condition'
      ? results?.conditionSuggestions.find(s => s.id === suggestionId)
      : results?.aiActionSuggestions.find(s => s.id === suggestionId);

    if (suggestion) {
      const category = NODE_CATEGORIES[type === 'condition' ? 'condition' : 'aiAction'];
      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type === 'condition' ? 'condition' as const : 'aiAction' as const,
        itemId: suggestion.id,
        label: suggestion.name,
        icon: type === 'condition' ? '🔀' : '✨',
        color: category.color,
        position: {
          x: 200 + (nodes.length % 4) * 250,
          y: 150 + Math.floor(nodes.length / 4) * 200,
        },
        config: {},
      };
      addNode(newNode);
      setAppliedSuggestions(new Set([...appliedSuggestions, suggestionId]));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-purple-600">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Pipeline Assistant</h2>
              <p className="text-sm text-purple-100">
                Analyze transcripts to optimize your {config.entityName} pipeline
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'configure' && (
            <ConfigureStep
              dateRange={dateRange}
              setDateRange={setDateRange}
              dealFilter={dealFilter}
              setDealFilter={setDealFilter}
              entityName={config.entityName}
              entityNamePlural={config.entityNamePlural}
            />
          )}

          {step === 'analyzing' && (
            <AnalyzingStep
              progress={progress}
              message={progressMessage}
            />
          )}

          {step === 'results' && results && (
            <ResultsStep
              results={results}
              appliedSuggestions={appliedSuggestions}
              onApplySuggestion={applySuggestion}
              entityName={config.entityName}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          {step === 'configure' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={runAnalysis}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Analysis
              </button>
            </>
          )}

          {step === 'analyzing' && (
            <div className="w-full text-center text-sm text-gray-500">
              Analysis in progress...
            </div>
          )}

          {step === 'results' && (
            <>
              <button
                onClick={() => setStep('configure')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Run New Analysis
              </button>
              <button
                onClick={handleClose}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigureStep({
  dateRange,
  setDateRange,
  dealFilter,
  setDealFilter,
  entityName,
  entityNamePlural,
}: {
  dateRange: '30' | '60' | '90';
  setDateRange: (v: '30' | '60' | '90') => void;
  dealFilter: 'all' | 'won' | 'lost';
  setDealFilter: (v: 'all' | 'won' | 'lost') => void;
  entityName: string;
  entityNamePlural: string;
}) {
  const callCounts = {
    '30': Math.floor(Math.random() * 30) + 20,
    '60': Math.floor(Math.random() * 60) + 40,
    '90': Math.floor(Math.random() * 90) + 60,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Select Data Source
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Analyze calls from the last:
            </label>
            <div className="flex gap-2">
              {(['30', '60', '90'] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setDateRange(days)}
                  className={cn(
                    'flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors',
                    dateRange === days
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Filter by {entityName} outcome:
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: `All ${entityNamePlural}` },
                { value: 'won', label: 'Won only' },
                { value: 'lost', label: 'Lost only' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDealFilter(option.value as 'all' | 'won' | 'lost')}
                  className={cn(
                    'flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors',
                    dealFilter === option.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-purple-700 font-medium">
              {callCounts[dateRange]} calls available
            </p>
            <p className="text-xs text-purple-600 mt-1">
              The AI will analyze transcripts from {entityNamePlural} matching your filters to identify patterns, suggest conditions, and recommend automations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyzingStep({
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
        <p className="text-xs text-gray-400 text-center mt-2">
          {Math.round(progress)}% complete
        </p>
      </div>
    </div>
  );
}

function ResultsStep({
  results,
  appliedSuggestions,
  onApplySuggestion,
  entityName,
}: {
  results: AnalysisResult;
  appliedSuggestions: Set<string>;
  onApplySuggestion: (id: string, type: 'condition' | 'aiAction') => void;
  entityName: string;
}) {
  return (
    <div className="space-y-6">
      {/* Pipeline Structure Summary */}
      <div className="p-4 bg-green-50 rounded-xl border border-green-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-800">Analysis Complete</h4>
            <p className="text-xs text-green-700 mt-1">{results.pipelineStructure.description}</p>
          </div>
        </div>
      </div>

      {/* Condition Suggestions */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <GitBranch className="w-4 h-4 text-yellow-600" />
          Condition Suggestions
        </h4>
        <div className="space-y-2">
          {results.conditionSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              type="condition"
              isApplied={appliedSuggestions.has(suggestion.id)}
              onApply={() => onApplySuggestion(suggestion.id, 'condition')}
            />
          ))}
        </div>
      </div>

      {/* AI Action Suggestions */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Bot className="w-4 h-4 text-purple-600" />
          AI Action Suggestions
        </h4>
        <div className="space-y-2">
          {results.aiActionSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              type="aiAction"
              isApplied={appliedSuggestions.has(suggestion.id)}
              onApply={() => onApplySuggestion(suggestion.id, 'aiAction')}
            />
          ))}
        </div>
      </div>

      {/* Stage Content Suggestions */}
      {results.stageContentSuggestions.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Zap className="w-4 h-4 text-blue-600" />
            Stage Content Suggestions
          </h4>
          <div className="space-y-3">
            {results.stageContentSuggestions.map((stage, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  For &quot;{stage.stageName}&quot; stage:
                </p>
                {stage.pitchPoints.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Pitch Points:</p>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {stage.pitchPoints.slice(0, 2).map((point, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-green-500">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stage.objections.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Objections Found:</p>
                    <p className="text-xs text-gray-700">
                      {stage.objections.length} common objections identified
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  type,
  isApplied,
  onApply,
}: {
  suggestion: { id: string; name: string; description: string; impact: string };
  type: 'condition' | 'aiAction';
  isApplied: boolean;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{suggestion.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{suggestion.description}</p>
        <p className="text-xs text-green-600 mt-1">{suggestion.impact}</p>
      </div>
      <button
        onClick={onApply}
        disabled={isApplied}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ml-3',
          isApplied
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        )}
      >
        {isApplied ? (
          <>
            <Check className="w-3 h-3" />
            Added
          </>
        ) : (
          <>
            Add
            <ChevronRight className="w-3 h-3" />
          </>
        )}
      </button>
    </div>
  );
}

function generateMockResults(processType: string, config: { entityName: string }): AnalysisResult {
  const baseResults: AnalysisResult = {
    pipelineStructure: {
      description: `Analyzed 47 call transcripts. Found 3 optimization opportunities that could improve ${config.entityName} conversion by up to 23%.`,
      suggestedChanges: [
        'Add lead scoring check early in pipeline',
        'Implement automated follow-up after demo',
        'Add AI nurture for cold leads',
      ],
    },
    conditionSuggestions: [],
    aiActionSuggestions: [],
    stageContentSuggestions: [],
  };

  // Add process-specific suggestions
  switch (processType) {
    case 'sales':
      baseResults.conditionSuggestions = [
        {
          id: 'cond_lead_score',
          name: 'Lead Score Check',
          description: 'Route deals based on lead score at entry',
          impact: 'High-scoring leads convert 2.3x faster',
          field: 'Lead Score',
          threshold: '>= 80',
        },
        {
          id: 'cond_response_time',
          name: 'Response Time',
          description: 'Check time since last contact',
          impact: 'Leads responding within 24h have 40% higher close rate',
          field: 'Response Time',
          threshold: '< 24 hours',
        },
      ];
      baseResults.aiActionSuggestions = [
        {
          id: 'ai_followup_demo',
          name: 'AI Demo Follow-up',
          description: 'Send personalized follow-up after demos',
          impact: '35% of demos have no follow-up within 3 days',
          trigger: 'After Demo Scheduled stage',
        },
        {
          id: 'ai_nurture_cold',
          name: 'AI Nurture Campaign',
          description: 'Engage cold leads with value content',
          impact: 'Currently 60% of cold leads get no engagement',
          trigger: 'When lead score drops below 40',
        },
      ];
      baseResults.stageContentSuggestions = [
        {
          stageName: 'Actively Engaging',
          pitchPoints: [
            'Emphasize time savings - avg 4 hours/week per technician',
            'Highlight mobile app capabilities for field teams',
          ],
          objections: [
            { objection: 'Price is too high', response: 'Focus on ROI within 3 months' },
            { objection: 'Already using a competitor', response: 'Offer data migration support' },
          ],
        },
      ];
      break;

    case 'onboarding':
      baseResults.conditionSuggestions = [
        {
          id: 'cond_contract_value',
          name: 'Contract Value Check',
          description: 'Route based on contract size',
          impact: 'Enterprise customers need dedicated onboarding',
          field: 'Contract Value',
          threshold: '>= $50,000',
        },
      ];
      baseResults.aiActionSuggestions = [
        {
          id: 'ai_training_rec',
          name: 'AI Training Recommendation',
          description: 'Suggest personalized training based on usage',
          impact: 'Customers with targeted training activate 45% faster',
          trigger: 'After Technical Setup stage',
        },
      ];
      break;

    case 'support':
      baseResults.conditionSuggestions = [
        {
          id: 'cond_severity',
          name: 'Severity Routing',
          description: 'Route P1/P2 tickets to senior support',
          impact: 'Critical tickets resolved 2x faster with proper routing',
          field: 'Severity',
          threshold: 'P1 or P2',
        },
      ];
      baseResults.aiActionSuggestions = [
        {
          id: 'ai_solution_suggest',
          name: 'AI Solution Suggester',
          description: 'Recommend solutions based on similar tickets',
          impact: 'Reduces resolution time by 35%',
          trigger: 'On ticket creation',
        },
      ];
      break;

    case 'engagement':
      baseResults.conditionSuggestions = [
        {
          id: 'cond_health_score',
          name: 'Health Score Alert',
          description: 'Trigger intervention when health drops',
          impact: 'Early intervention saves 67% of at-risk accounts',
          field: 'Health Score',
          threshold: '< 60',
        },
      ];
      baseResults.aiActionSuggestions = [
        {
          id: 'ai_churn_predict',
          name: 'AI Churn Predictor',
          description: 'Identify accounts likely to churn',
          impact: 'Predicts churn with 85% accuracy 30 days ahead',
          trigger: 'Weekly analysis',
        },
      ];
      break;
  }

  return baseResults;
}
