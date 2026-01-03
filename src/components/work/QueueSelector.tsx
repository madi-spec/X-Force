'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface QueueOption {
  id: string | null;
  name: string;
  count: number;
  color?: string;
}

interface QueueSelectorProps {
  queues: QueueOption[];
  selectedQueueId: string | null;
  onSelect: (queueId: string | null) => void;
  totalCount: number;
}

// Queue category organization
const QUEUE_CATEGORIES: Record<string, { category: string; order: number }> = {
  action_now: { category: 'priority', order: 0 },
  meeting_prep: { category: 'meetings', order: 1 },
  scheduling: { category: 'meetings', order: 1 },
  needs_response: { category: 'sales', order: 2 },
  follow_ups: { category: 'sales', order: 2 },
  new_leads: { category: 'sales', order: 2 },
  stalled_deals: { category: 'sales', order: 2 },
  at_risk: { category: 'customer_success', order: 3 },
  expansion_ready: { category: 'customer_success', order: 3 },
  unresolved_issues: { category: 'customer_success', order: 3 },
  blocked: { category: 'onboarding', order: 4 },
  due_this_week: { category: 'onboarding', order: 4 },
  new_kickoffs: { category: 'onboarding', order: 4 },
  sla_breaches: { category: 'support', order: 5 },
  high_severity: { category: 'support', order: 5 },
  unassigned: { category: 'support', order: 5 },
};

const CATEGORY_LABELS: Record<string, string> = {
  priority: '',
  meetings: 'Meetings',
  sales: 'Sales',
  customer_success: 'Customer Success',
  onboarding: 'Onboarding',
  support: 'Support',
};

export function QueueSelector({ queues, selectedQueueId, onSelect, totalCount }: QueueSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedQueue = queues.find(q => q.id === selectedQueueId) || { id: null, name: 'All Queues', count: totalCount };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Group queues by category
  const groupedQueues = queues.reduce((acc, queue) => {
    if (queue.id === null) return acc; // Skip "All" - handled separately
    const category = QUEUE_CATEGORIES[queue.id]?.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(queue);
    return acc;
  }, {} as Record<string, QueueOption[]>);

  // Sort categories by order
  const sortedCategories = Object.keys(groupedQueues).sort((a, b) => {
    const orderA = Object.values(QUEUE_CATEGORIES).find(q => q.category === a)?.order ?? 99;
    const orderB = Object.values(QUEUE_CATEGORIES).find(q => q.category === b)?.order ?? 99;
    return orderA - orderB;
  });

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '280px',
          padding: '10px 14px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = '#d1d5db';
          e.currentTarget.style.background = '#fafafa';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = '#e5e7eb';
          e.currentTarget.style.background = '#ffffff';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Colored dot for specific queues */}
          {selectedQueueId && selectedQueue.color && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: selectedQueue.color,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0b1220' }}>
            {selectedQueue.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              background: '#f3f4f6',
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
            {selectedQueueId === null ? totalCount : selectedQueue.count}
          </span>
          <ChevronDown
            style={{
              width: '16px',
              height: '16px',
              color: '#9ca3af',
              transition: 'transform 150ms ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 50,
            marginTop: '6px',
            width: '300px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
          }}
        >
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '6px 0' }}>
            {/* All Queues option */}
            <QueueMenuItem
              queue={{ id: null, name: 'All Queues', count: totalCount }}
              isSelected={selectedQueueId === null}
              onSelect={() => {
                onSelect(null);
                setIsOpen(false);
              }}
            />

            {/* Priority queues (Action Now) */}
            {groupedQueues['priority']?.map(queue => (
              <QueueMenuItem
                key={queue.id}
                queue={queue}
                isSelected={selectedQueueId === queue.id}
                onSelect={() => {
                  onSelect(queue.id);
                  setIsOpen(false);
                }}
                showDot
              />
            ))}

            {/* Other categories */}
            {sortedCategories.filter(c => c !== 'priority').map((category) => (
              <div key={category}>
                {/* Divider */}
                <div style={{ height: '1px', background: '#f3f4f6', margin: '6px 0' }} />

                {/* Category header */}
                {CATEGORY_LABELS[category] && (
                  <div style={{ padding: '8px 16px 4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                )}

                {/* Queue items in category */}
                {groupedQueues[category]?.map(queue => (
                  <QueueMenuItem
                    key={queue.id}
                    queue={queue}
                    isSelected={selectedQueueId === queue.id}
                    onSelect={() => {
                      onSelect(queue.id);
                      setIsOpen(false);
                    }}
                    showDot
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual queue menu item
interface QueueMenuItemProps {
  queue: QueueOption;
  isSelected: boolean;
  onSelect: () => void;
  showDot?: boolean;
}

function QueueMenuItem({ queue, isSelected, onSelect, showDot }: QueueMenuItemProps) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: isSelected ? '#eff6ff' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 100ms ease',
      }}
      onMouseOver={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#f9fafb';
      }}
      onMouseOut={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Checkmark or spacer */}
        <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isSelected && (
            <Check style={{ width: '14px', height: '14px', color: '#2563eb' }} />
          )}
        </div>

        {/* Colored dot for queue */}
        {showDot && queue.color && (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: queue.color,
              flexShrink: 0,
            }}
          />
        )}

        {/* Queue name */}
        <span
          style={{
            fontSize: '13px',
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? '#2563eb' : '#374151',
          }}
        >
          {queue.name}
        </span>
      </div>

      {/* Count */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: isSelected ? '#2563eb' : '#9ca3af',
        }}
      >
        {queue.count}
      </span>
    </button>
  );
}

export default QueueSelector;
