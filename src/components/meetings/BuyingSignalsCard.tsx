'use client';

import { Lightbulb, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingBuyingSignal } from '@/types';

interface BuyingSignalsCardProps {
  signals: MeetingBuyingSignal[];
}

export function BuyingSignalsCard({ signals }: BuyingSignalsCardProps) {
  if (signals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Buying Signals</h3>
        </div>
        <p className="text-sm text-gray-500">No strong buying signals detected</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">Buying Signals</h3>
      </div>
      <ul className="space-y-3">
        {signals.map((signal, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle
              className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                signal.strength === 'strong' && 'text-green-600',
                signal.strength === 'moderate' && 'text-amber-600',
                signal.strength === 'weak' && 'text-gray-400'
              )}
            />
            <div>
              <span className="text-sm text-gray-900">{signal.signal}</span>
              {signal.quote && (
                <p className="text-xs text-gray-500 italic mt-0.5">
                  &quot;{signal.quote}&quot;
                </p>
              )}
              <span
                className={cn(
                  'inline-block text-xs px-1.5 py-0.5 rounded mt-1',
                  signal.strength === 'strong' &&
                    'bg-green-100 text-green-700',
                  signal.strength === 'moderate' &&
                    'bg-amber-100 text-amber-700',
                  signal.strength === 'weak' && 'bg-gray-100 text-gray-600'
                )}
              >
                {signal.strength}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
