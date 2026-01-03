'use client';

import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface ResolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  companyName: string;
  suggestedAction?: string;
}

const QUICK_REASONS = [
  'Responded via email',
  'Responded via phone',
  'Meeting scheduled',
  'Issue resolved',
  'Not applicable',
  'Handled offline',
];

export function ResolveModal({
  isOpen,
  onClose,
  onConfirm,
  companyName,
  suggestedAction,
}: ResolveModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickSelect = (quickReason: string) => {
    setSelectedQuick(quickReason);
    setReason(quickReason);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      setSelectedQuick(null);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && reason.trim()) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          margin: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e6eaf0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle style={{ width: '20px', height: '20px', color: '#16a34a' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0b1220', margin: 0 }}>
                Resolve Item
              </h2>
              <p style={{ fontSize: '13px', color: '#667085', margin: 0 }}>
                {companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#667085',
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {suggestedAction && typeof suggestedAction === 'string' && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#166534',
              }}
            >
              <strong>Suggested action:</strong> {suggestedAction}
            </div>
          )}

          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#344054',
              marginBottom: '8px',
            }}
          >
            What action did you take?
          </label>

          {/* Quick select buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {QUICK_REASONS.map((quickReason) => (
              <button
                key={quickReason}
                onClick={() => handleQuickSelect(quickReason)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selectedQuick === quickReason ? '#16a34a' : '#e5e7eb',
                  background: selectedQuick === quickReason ? '#dcfce7' : '#ffffff',
                  color: selectedQuick === quickReason ? '#166534' : '#4b5563',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {quickReason}
              </button>
            ))}
          </div>

          {/* Custom reason input */}
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSelectedQuick(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Or type a custom resolution note..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          <p
            style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#667085',
            }}
          >
            This will be logged as an activity for {companyName}.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e6eaf0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#4b5563',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              background: reason.trim() && !isSubmitting ? '#16a34a' : '#9ca3af',
              color: '#ffffff',
              cursor: reason.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
            }}
          >
            {isSubmitting ? 'Resolving...' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}
