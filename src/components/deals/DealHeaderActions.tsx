'use client';

import Link from 'next/link';
import { Edit2 } from 'lucide-react';
import { MarkAsWonButton } from './MarkAsWonButton';

interface DealHeaderActionsProps {
  dealId: string;
  dealName: string;
  dealValue?: number;
  currentStage: string;
}

export function DealHeaderActions({
  dealId,
  dealName,
  dealValue,
  currentStage,
}: DealHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <MarkAsWonButton
        dealId={dealId}
        dealName={dealName}
        dealValue={dealValue}
        currentStage={currentStage}
      />
      <Link
        href={`/deals/${dealId}/edit`}
        className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <Edit2 className="h-4 w-4" />
        Edit
      </Link>
    </div>
  );
}
