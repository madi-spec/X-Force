'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  Building2,
  User,
  DollarSign,
  Search,
  Check,
  Plus,
  AlertCircle,
  Loader2,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Company, Deal } from '@/types';

// Extracted entity data structure (matches transcriptEntityMatcher.ts)
interface ExtractedEntityData {
  company: {
    name: string;
    industry: 'pest' | 'lawn' | 'both' | null;
    segment: 'smb' | 'mid_market' | 'enterprise' | 'pe_platform' | 'franchisor' | null;
    estimatedAgentCount: number | null;
    crmPlatform: 'fieldroutes' | 'pestpac' | 'realgreen' | null;
    website: string | null;
    city: string | null;
    state: string | null;
  };
  contacts: Array<{
    name: string;
    email: string | null;
    title: string | null;
    role: 'decision_maker' | 'influencer' | 'champion' | 'end_user' | null;
    isPrimary: boolean;
  }>;
  deal: {
    suggestedName: string;
    estimatedValue: number | null;
    productInterests: string[];
    salesTeam: 'voice_outside' | 'voice_inside' | 'xrai' | null;
    notes: string | null;
  };
  confidence: number;
}

interface SimilarCompany {
  id: string;
  name: string;
  status: string;
  similarity: string;
}

interface TranscriptReviewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onResolved: () => void;
}

export function TranscriptReviewTaskModal({
  isOpen,
  onClose,
  task,
  onResolved,
}: TranscriptReviewTaskModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from task description
  const [extractedData, setExtractedData] = useState<ExtractedEntityData | null>(null);
  const [similarCompanies, setSimilarCompanies] = useState<SimilarCompany[]>([]);
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);

  // Selected action
  const [selectedAction, setSelectedAction] = useState<'match' | 'create' | null>(null);

  // Match to existing
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [availableDeals, setAvailableDeals] = useState<Deal[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  // Parse task description to extract data
  useEffect(() => {
    if (!task.description) return;

    // Extract transcription ID
    const transcriptionMatch = task.description.match(/Transcription ID:\s*([a-f0-9-]+)/i);
    if (transcriptionMatch) {
      setTranscriptionId(transcriptionMatch[1]);
    }

    // Try to load extracted data from the transcription metadata
    if (transcriptionMatch?.[1]) {
      loadExtractedData(transcriptionMatch[1]);
    }

    // Parse similar companies from description
    const companiesSection = task.description.match(/SIMILAR EXISTING COMPANIES[\s\S]*?(?=═══|$)/);
    if (companiesSection) {
      const lines = companiesSection[0].split('\n').filter(l => l.match(/^\s*\d+\./));
      const parsed = lines.map(line => {
        const match = line.match(/\d+\.\s*(.+?)\s*\(([^)]+)\)\s*-\s*(\d+%)/);
        if (match) {
          return { id: '', name: match[1].trim(), status: match[2].trim(), similarity: match[3] };
        }
        return null;
      }).filter(Boolean) as SimilarCompany[];
      setSimilarCompanies(parsed);
    }
  }, [task.description]);

  const loadExtractedData = async (transcriptId: string) => {
    const { data } = await supabase
      .from('meeting_transcriptions')
      .select('external_metadata')
      .eq('id', transcriptId)
      .single();

    if (data?.external_metadata?.extracted_entity_data) {
      setExtractedData(data.external_metadata.extracted_entity_data as ExtractedEntityData);
    }
  };

  // Search companies
  useEffect(() => {
    const searchCompanies = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchingCompanies(true);
      const { data } = await supabase
        .from('companies')
        .select('id, name, status, segment, industry')
        .ilike('name', `%${searchQuery}%`)
        .limit(10);

      setSearchResults((data || []) as Company[]);
      setSearchingCompanies(false);
    };

    const debounce = setTimeout(searchCompanies, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, supabase]);

  // Load deals when company is selected
  useEffect(() => {
    const loadDeals = async () => {
      if (!selectedCompanyId) {
        setAvailableDeals([]);
        return;
      }

      const { data } = await supabase
        .from('deals')
        .select('id, name, stage, estimated_value')
        .eq('company_id', selectedCompanyId)
        .not('stage', 'in', '("closed_won","closed_lost")')
        .order('created_at', { ascending: false });

      setAvailableDeals((data || []) as Deal[]);
    };

    loadDeals();
  }, [selectedCompanyId, supabase]);

  // Resolve task - match to existing
  const handleMatchToExisting = async () => {
    if (!selectedCompanyId || !transcriptionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks/resolve-transcript-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          transcriptionId,
          action: 'match',
          companyId: selectedCompanyId,
          dealId: selectedDealId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resolve task');
      }

      onResolved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Resolve task - create new entities
  const handleCreateNew = async () => {
    if (!transcriptionId || !extractedData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks/resolve-transcript-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          transcriptionId,
          action: 'create',
          extractedData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create entities');
      }

      onResolved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Select a similar company
  const handleSelectSimilarCompany = async (companyName: string) => {
    // Search for the company by name
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${companyName}%`)
      .limit(1)
      .single();

    if (data) {
      setSelectedCompanyId(data.id);
      setSelectedAction('match');
      setSearchQuery(data.name);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-amber-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Review Transcript Assignment
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Match to an existing company or create new records
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Extracted Info */}
          {extractedData && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Extracted Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Company Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Company</h4>
                  <p className="font-semibold text-gray-900">{extractedData.company?.name}</p>
                  <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                    {extractedData.company?.industry && (
                      <p>Industry: {extractedData.company.industry}</p>
                    )}
                    {extractedData.company?.segment && (
                      <p>Segment: {extractedData.company.segment}</p>
                    )}
                    {extractedData.company?.estimatedAgentCount && (
                      <p>Est. Agents: {extractedData.company.estimatedAgentCount}</p>
                    )}
                    {extractedData.company?.crmPlatform && (
                      <p>CRM: {extractedData.company.crmPlatform}</p>
                    )}
                  </div>
                </div>

                {/* Deal Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Deal</h4>
                  <p className="font-semibold text-gray-900">{extractedData.deal?.suggestedName}</p>
                  <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                    {extractedData.deal?.estimatedValue && (
                      <p className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {extractedData.deal.estimatedValue.toLocaleString()}
                      </p>
                    )}
                    {extractedData.deal?.productInterests && (
                      <p>Products: {extractedData.deal.productInterests.join(', ')}</p>
                    )}
                    {extractedData.deal?.salesTeam && (
                      <p>Team: {extractedData.deal.salesTeam}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacts */}
              {extractedData.contacts && extractedData.contacts.length > 0 && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Contacts</h4>
                  <div className="space-y-2">
                    {extractedData.contacts.map((contact, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{contact.name}</span>
                        {contact.email && (
                          <span className="text-gray-500">&lt;{contact.email}&gt;</span>
                        )}
                        {contact.title && (
                          <span className="text-gray-400">- {contact.title}</span>
                        )}
                        {contact.isPrimary && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Similar Companies */}
          {similarCompanies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Similar Existing Companies
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 mb-2">
                  These companies might be a match. Click to select:
                </p>
                <div className="flex flex-wrap gap-2">
                  {similarCompanies.map((company, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSimilarCompany(company.name)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm hover:bg-amber-100 transition-colors"
                    >
                      <Building2 className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium">{company.name}</span>
                      <span className="text-gray-500">({company.status})</span>
                      <span className="text-amber-600">{company.similarity}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Choose an Action</h3>

            {/* Option A - Match to Existing */}
            <div
              className={cn(
                'border-2 rounded-lg p-4 cursor-pointer transition-colors',
                selectedAction === 'match'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              onClick={() => setSelectedAction('match')}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    selectedAction === 'match'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  )}
                >
                  {selectedAction === 'match' && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Match to Existing Company
                  </h4>
                  <p className="text-sm text-gray-500">
                    Link this transcript to an existing company and optionally a deal
                  </p>
                </div>
              </div>

              {selectedAction === 'match' && (
                <div className="ml-8 space-y-4">
                  {/* Company Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Company
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type to search companies..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {searchingCompanies && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                        {searchResults.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setSearchQuery(company.name);
                              setSearchResults([]);
                            }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between border-b last:border-0',
                              selectedCompanyId === company.id && 'bg-blue-50'
                            )}
                          >
                            <span className="font-medium">{company.name}</span>
                            <span className="text-gray-500">
                              {company.status} - {company.segment}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Deal Selection */}
                  {selectedCompanyId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link to Deal (optional)
                      </label>
                      <select
                        value={selectedDealId || ''}
                        onChange={(e) => setSelectedDealId(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">No deal - just company</option>
                        {availableDeals.map((deal) => (
                          <option key={deal.id} value={deal.id}>
                            {deal.name} ({deal.stage}) - ${deal.estimated_value?.toLocaleString()}
                          </option>
                        ))}
                        <option value="new">+ Create new deal</option>
                      </select>
                    </div>
                  )}

                  {selectedCompanyId && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Ready to match
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Option B - Create New */}
            <div
              className={cn(
                'border-2 rounded-lg p-4 cursor-pointer transition-colors',
                selectedAction === 'create'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              onClick={() => setSelectedAction('create')}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    selectedAction === 'create'
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-300'
                  )}
                >
                  {selectedAction === 'create' && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Records
                  </h4>
                  <p className="text-sm text-gray-500">
                    Create a new company, contacts, and deal from the extracted information
                  </p>
                </div>
              </div>

              {selectedAction === 'create' && extractedData && (
                <div className="ml-8 mt-4 text-sm text-gray-600">
                  <p>This will create:</p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-green-500" />
                      Company: {extractedData.company?.name}
                    </li>
                    {extractedData.contacts?.map((contact, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-500" />
                        Contact: {contact.name}
                      </li>
                    ))}
                    <li className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      Deal: {extractedData.deal?.suggestedName}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {transcriptionId && (
              <a
                href={`/meetings/${transcriptionId}/analysis`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                View Transcript
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            {selectedAction === 'match' && (
              <button
                onClick={handleMatchToExisting}
                disabled={!selectedCompanyId || loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                Match to Company
              </button>
            )}

            {selectedAction === 'create' && (
              <button
                onClick={handleCreateNew}
                disabled={!extractedData || loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create New Records
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
