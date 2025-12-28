'use client';

import { useState } from 'react';
import { X, Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { AttentionFlagType, AttentionFlagSeverity } from '@/types/operatingLayer';

interface QuickFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyProductId?: string | null;
  companyName: string;
}

const FLAG_TYPE_OPTIONS: { value: AttentionFlagType; label: string }[] = [
  { value: 'NEEDS_REPLY', label: 'Needs Reply' },
  { value: 'BOOK_MEETING_APPROVAL', label: 'Meeting Approval' },
  { value: 'PROPOSAL_APPROVAL', label: 'Proposal Approval' },
  { value: 'PRICING_EXCEPTION', label: 'Pricing Exception' },
  { value: 'CLOSE_DECISION', label: 'Close Decision' },
  { value: 'HIGH_RISK_OBJECTION', label: 'High-Risk Objection' },
  { value: 'NO_NEXT_STEP_AFTER_MEETING', label: 'No Next Step' },
  { value: 'STALE_IN_STAGE', label: 'Stale in Stage' },
  { value: 'GHOSTING_AFTER_PROPOSAL', label: 'Ghosting After Proposal' },
  { value: 'DATA_MISSING_BLOCKER', label: 'Data Missing' },
  { value: 'SYSTEM_ERROR', label: 'System Error' },
];

const SEVERITY_OPTIONS: { value: AttentionFlagSeverity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
];

export function QuickFlagModal({
  isOpen,
  onClose,
  companyId,
  companyProductId,
  companyName,
}: QuickFlagModalProps) {
  const { success, error: showError } = useToast();
  const [flagType, setFlagType] = useState<AttentionFlagType>('NEEDS_REPLY');
  const [severity, setSeverity] = useState<AttentionFlagSeverity>('medium');
  const [reason, setReason] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim() || !recommendedAction.trim()) {
      showError('Validation Error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/attention-flags/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          company_product_id: companyProductId || null,
          flag_type: flagType,
          severity,
          reason: reason.trim(),
          recommended_action: recommendedAction.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create flag');
      }

      success('Flag Created', `Attention flag added for ${companyName}`);

      // Reset form
      setFlagType('NEEDS_REPLY');
      setSeverity('medium');
      setReason('');
      setRecommendedAction('');
      onClose();
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to create flag');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">Quick Flag</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Create an attention flag for <span className="font-medium">{companyName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Flag Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flag Type
            </label>
            <select
              value={flagType}
              onChange={(e) => setFlagType(e.target.value as AttentionFlagType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FLAG_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AttentionFlagSeverity)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this need attention?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Recommended Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recommended Action
            </label>
            <textarea
              value={recommendedAction}
              onChange={(e) => setRecommendedAction(e.target.value)}
              placeholder="What should be done?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim() || !recommendedAction.trim()}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2',
                isSubmitting || !reason.trim() || !recommendedAction.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700'
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Flag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
