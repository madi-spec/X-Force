'use client';

/**
 * Create Lead From Email Component
 *
 * Shows unlinked email addresses found in a communication
 * and allows users to create a new lead (company + contact) from them.
 */

import { useState, useEffect } from 'react';
import { UserPlus, Building2, Mail, Loader2, Check, ChevronDown, ExternalLink } from 'lucide-react';

interface EmailOption {
  email: string;
  name?: string;
  domain: string;
  suggestedCompanyName: string;
  source: 'participant' | 'body';
}

interface CreateLeadResult {
  success: boolean;
  action: 'created' | 'linked_existing' | 'linked_existing_contact';
  company?: { id: string; name: string };
  contact?: { id: string; name: string };
  additional_linked?: number;
  message: string;
}

interface CreateLeadFromEmailProps {
  communicationId: string;
  onLeadCreated?: (result: CreateLeadResult) => void;
  compact?: boolean;
}

export function CreateLeadFromEmail({
  communicationId,
  onLeadCreated,
  compact = false
}: CreateLeadFromEmailProps) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [emailOptions, setEmailOptions] = useState<EmailOption[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateLeadResult | null>(null);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    fetchEmailOptions();
  }, [communicationId]);

  async function fetchEmailOptions() {
    try {
      setLoading(true);
      const res = await fetch(`/api/communications/${communicationId}/create-lead`);
      const data = await res.json();

      if (data.linked) {
        setIsLinked(true);
        setEmailOptions([]);
      } else {
        setEmailOptions(data.available_emails || []);
        if (data.available_emails?.length > 0) {
          setSelectedEmail(data.available_emails[0].email);
          setCustomCompanyName(data.available_emails[0].suggestedCompanyName);
        }
      }
    } catch (err) {
      setError('Failed to load email options');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLead() {
    if (!selectedEmail) return;

    try {
      setCreating(true);
      setError(null);

      const res = await fetch(`/api/communications/${communicationId}/create-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedEmail,
          companyName: customCompanyName || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create lead');
        return;
      }

      setSuccess(data);
      setIsLinked(true);
      onLeadCreated?.(data);
    } catch (err) {
      setError('Failed to create lead');
    } finally {
      setCreating(false);
    }
  }

  function handleSelectEmail(email: EmailOption) {
    setSelectedEmail(email.email);
    setCustomCompanyName(email.suggestedCompanyName);
    setShowDropdown(false);
  }

  // Already linked or no options
  if (isLinked) {
    if (success) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>{success.message}</span>
          {success.company && (
            <a
              href={`/companies/${success.company.id}`}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking for lead options...</span>
      </div>
    );
  }

  if (emailOptions.length === 0) {
    return null;
  }

  const selectedOption = emailOptions.find(e => e.email === selectedEmail);

  // Compact mode - just a button
  if (compact) {
    return (
      <button
        onClick={handleCreateLead}
        disabled={creating}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {creating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Create Lead
      </button>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg">
          <UserPlus className="h-5 w-5 text-amber-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">
            Unlinked Email - Create Lead?
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Found {emailOptions.length} external email{emailOptions.length > 1 ? 's' : ''} not linked to any company
          </p>

          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}

          <div className="mt-3 space-y-3">
            {/* Email selector */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email Address
              </label>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{selectedEmail}</span>
                  {selectedOption?.source === 'body' && (
                    <span className="text-xs text-gray-400">(from body)</span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </button>

              {showDropdown && emailOptions.length > 1 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {emailOptions.map((option) => (
                    <button
                      key={option.email}
                      onClick={() => handleSelectEmail(option)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                        option.email === selectedEmail ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{option.email}</div>
                        {option.name && (
                          <div className="text-xs text-gray-500 truncate">{option.name}</div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {option.source === 'body' ? 'body' : 'participant'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Company name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Company Name
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={customCompanyName}
                  onChange={(e) => setCustomCompanyName(e.target.value)}
                  placeholder="Company name..."
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateLead}
              disabled={creating || !selectedEmail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Lead
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateLeadFromEmail;
