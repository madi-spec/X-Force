'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, FileText, Sparkles, Loader2, Building2, Briefcase, Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Deal, Company } from '@/types';

interface TranscriptionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string;
  companyId?: string;
  deal?: Deal;
  company?: Company;
  onSuccess?: (transcriptionId: string) => void;
}

interface DealOption {
  id: string;
  name: string;
  stage: string;
  company_id: string;
  company_name?: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

export function TranscriptionUploadModal({
  isOpen,
  onClose,
  dealId: initialDealId,
  companyId: initialCompanyId,
  deal: initialDeal,
  company: initialCompany,
  onSuccess,
}: TranscriptionUploadModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initialDeal ? `Meeting - ${initialDeal.name}` : '');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [duration, setDuration] = useState('');
  const [attendees, setAttendees] = useState('');
  const [transcription, setTranscription] = useState('');
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Deal/Company selection state
  const [selectedDealId, setSelectedDealId] = useState<string | null>(initialDealId || null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(initialCompanyId || null);
  const [selectedDealName, setSelectedDealName] = useState<string | null>(initialDeal?.name || null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(initialCompany?.name || null);
  const [showDealSelector, setShowDealSelector] = useState(false);
  const [dealSearch, setDealSearch] = useState('');
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDealId(initialDealId || null);
      setSelectedCompanyId(initialCompanyId || null);
      setSelectedDealName(initialDeal?.name || null);
      setSelectedCompanyName(initialCompany?.name || null);
      setTitle(initialDeal ? `Meeting - ${initialDeal.name}` : '');
    }
  }, [isOpen, initialDealId, initialCompanyId, initialDeal, initialCompany]);

  // Search deals
  useEffect(() => {
    if (!showDealSelector) return;

    const searchDeals = async () => {
      setLoadingDeals(true);
      try {
        let query = supabase
          .from('deals')
          .select('id, name, stage, company_id, companies(name)')
          .not('stage', 'in', '("closed_won","closed_lost")')
          .order('updated_at', { ascending: false })
          .limit(20);

        if (dealSearch) {
          query = query.or(`name.ilike.%${dealSearch}%,companies.name.ilike.%${dealSearch}%`);
        }

        const { data } = await query;
        if (data) {
          setDeals(data.map((d: any) => ({
            id: d.id,
            name: d.name,
            stage: d.stage,
            company_id: d.company_id,
            company_name: d.companies?.name,
          })));
        }
      } catch (err) {
        console.error('Error searching deals:', err);
      } finally {
        setLoadingDeals(false);
      }
    };

    const debounce = setTimeout(searchDeals, 200);
    return () => clearTimeout(debounce);
  }, [showDealSelector, dealSearch, supabase]);

  const handleSelectDeal = (deal: DealOption) => {
    setSelectedDealId(deal.id);
    setSelectedDealName(deal.name);
    setSelectedCompanyId(deal.company_id);
    setSelectedCompanyName(deal.company_name || null);
    setShowDealSelector(false);
    setDealSearch('');
    if (!title || title.startsWith('Meeting - ')) {
      setTitle(`Meeting - ${deal.name}`);
    }
  };

  const handleClearDeal = () => {
    setSelectedDealId(null);
    setSelectedDealName(null);
    setSelectedCompanyId(null);
    setSelectedCompanyName(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!title.trim() || !transcription.trim()) {
      setError('Please provide a title and transcription');
      return;
    }

    setAnalyzing(true);
    setError('');

    try {
      const response = await fetch('/api/meetings/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          meetingDate,
          durationMinutes: duration ? parseInt(duration) : null,
          attendees: attendees
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          dealId: selectedDealId || null,
          companyId: selectedCompanyId || null,
          transcriptionText: transcription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to analyze transcription');
      }

      const data = await response.json();

      if (onSuccess) {
        onSuccess(data.transcriptionId);
      }

      // Navigate to the analysis page
      router.push(`/meetings/${data.transcriptionId}/analysis`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAnalyzing(false);
    }
  }, [
    title,
    transcription,
    meetingDate,
    duration,
    attendees,
    selectedDealId,
    selectedCompanyId,
    onSuccess,
    router,
    onClose,
  ]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        setTranscription(text);

        // Try to extract title from filename
        if (!title) {
          const nameWithoutExt = file.name.replace(/\.(txt|vtt|srt|docx)$/, '');
          setTitle(nameWithoutExt);
        }
      } catch {
        setError('Failed to read file');
      }
    },
    [title]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        setTranscription(text);

        if (!title) {
          const nameWithoutExt = file.name.replace(/\.(txt|vtt|srt|docx)$/, '');
          setTitle(nameWithoutExt);
        }
      } catch {
        setError('Failed to read file');
      }
    },
    [title]
  );

  if (!isOpen) return null;

  const wordCount = transcription.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Upload Meeting Transcription
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Deal/Company Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to Deal
            </label>
            <div className="relative">
              {selectedDealId ? (
                <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <div>
                      <span className="text-sm font-medium text-blue-800">{selectedDealName}</span>
                      {selectedCompanyName && (
                        <span className="text-xs text-blue-600 ml-2">({selectedCompanyName})</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearDeal}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDealSelector(!showDealSelector)}
                  className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Select a deal (optional)
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showDealSelector && "rotate-180")} />
                </button>
              )}

              {/* Deal dropdown */}
              {showDealSelector && !selectedDealId && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={dealSearch}
                        onChange={(e) => setDealSearch(e.target.value)}
                        placeholder="Search deals..."
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {loadingDeals ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No active deals found
                      </div>
                    ) : (
                      deals.map((deal) => (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => handleSelectDeal(deal)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <div className="text-sm font-medium text-gray-900">{deal.name}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {deal.company_name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {deal.company_name}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              {deal.stage.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Link this meeting to a deal for tracking and follow-ups
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Discovery Call - Acme Corp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attendees
            </label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="John Smith, Jane Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated names
            </p>
          </div>

          {/* Input Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcription <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setInputMode('paste')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  inputMode === 'paste'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Paste Text
              </button>
              <button
                onClick={() => setInputMode('upload')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  inputMode === 'upload'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Upload File
              </button>
            </div>

            {inputMode === 'paste' ? (
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={`Paste your meeting transcription here...

Supports plain text, Microsoft Teams transcript, Zoom transcript, Otter.ai export, or any text format.`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm h-64 resize-none"
              />
            ) : (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              >
                <input
                  type="file"
                  accept=".txt,.vtt,.srt,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-400">
                    .txt, .vtt, .srt, .docx
                  </p>
                </label>
                {transcription && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">
                      File loaded ({transcription.length.toLocaleString()} characters)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Word count */}
          {transcription && (
            <p className="text-xs text-gray-500">
              {wordCount.toLocaleString()} words
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={analyzing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !title.trim() || !transcription.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze with AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
