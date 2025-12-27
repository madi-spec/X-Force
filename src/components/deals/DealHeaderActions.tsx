'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit2, ArrowRightCircle } from 'lucide-react';
import { MarkAsWonButton } from './MarkAsWonButton';
import { ConvertDealWizard } from './ConvertDealWizard';

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
  const router = useRouter();
  const [showConvertWizard, setShowConvertWizard] = useState(false);

  const isTerminalStage = currentStage === 'closed_won' || currentStage === 'closed_lost' || currentStage === 'closed_converted';

  return (
    <>
      <div className="flex items-center gap-2">
        {!isTerminalStage && (
          <button
            onClick={() => setShowConvertWizard(true)}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
          >
            <ArrowRightCircle className="h-4 w-4" />
            Convert
          </button>
        )}
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

      {showConvertWizard && (
        <ConvertDealWizard
          dealId={dealId}
          dealName={dealName}
          onClose={() => setShowConvertWizard(false)}
          onConverted={() => {
            setShowConvertWizard(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
