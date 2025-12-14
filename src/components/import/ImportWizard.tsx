'use client';

import { useState, useCallback } from 'react';
import { FileUpload } from './FileUpload';
import { ColumnMapper } from './ColumnMapper';
import { StageMapper } from './StageMapper';
import { OwnerMapper } from './OwnerMapper';
import { ImportPreview } from './ImportPreview';
import { ImportProgress } from './ImportProgress';
import { ImportComplete } from './ImportComplete';
import type {
  ImportState,
  ImportStep,
} from '@/lib/import/types';

interface ImportWizardProps {
  currentUserId: string;
  users: Array<{ id: string; name: string; email: string }>;
  existingCompanies: Array<{ id: string; name: string }>;
}

const initialState: ImportState = {
  step: 'upload',
  importType: 'deals',
  file: null,
  rawData: [],
  columns: [],
  sampleData: [],
  columnMapping: {},
  stageMapping: {},
  ownerMapping: {},
  preview: {
    companies: 0,
    newCompanies: 0,
    matchedCompanies: 0,
    contacts: 0,
    deals: 0,
    activities: 0,
    skipped: 0,
    skippedRows: [],
  },
  progress: {
    current: 0,
    total: 0,
    phase: 'companies',
    recentActions: [],
  },
  errors: [],
  results: {
    companies: 0,
    contacts: 0,
    deals: 0,
    activities: 0,
  },
};

const STEPS: { id: ImportStep; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'mapping', label: 'Map Fields' },
  { id: 'stages', label: 'Map Stages' },
  { id: 'owners', label: 'Map Owners' },
  { id: 'preview', label: 'Preview' },
  { id: 'importing', label: 'Import' },
  { id: 'complete', label: 'Complete' },
];

export function ImportWizard({ currentUserId, users, existingCompanies }: ImportWizardProps) {
  const [state, setState] = useState<ImportState>(initialState);

  const updateState = useCallback((updates: Partial<ImportState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: ImportStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const handleFileUpload = useCallback((
    file: File,
    rawData: Record<string, string>[],
    columns: string[],
    sampleData: Record<string, string>[]
  ) => {
    updateState({
      file,
      rawData,
      columns,
      sampleData,
      step: 'mapping',
    });
  }, [updateState]);

  const handleMappingComplete = useCallback((columnMapping: Record<string, string>) => {
    updateState({ columnMapping });

    // Check if we need stage mapping
    const hasDealStage = Object.values(columnMapping).includes('deal_stage');
    if (hasDealStage) {
      goToStep('stages');
    } else {
      // Check if we need owner mapping
      const hasDealOwner = Object.values(columnMapping).includes('deal_owner');
      if (hasDealOwner) {
        goToStep('owners');
      } else {
        goToStep('preview');
      }
    }
  }, [updateState, goToStep]);

  const handleStageMappingComplete = useCallback((stageMapping: Record<string, string>) => {
    updateState({ stageMapping });

    // Check if we need owner mapping
    const hasDealOwner = Object.values(state.columnMapping).includes('deal_owner');
    if (hasDealOwner) {
      goToStep('owners');
    } else {
      goToStep('preview');
    }
  }, [updateState, goToStep, state.columnMapping]);

  const handleOwnerMappingComplete = useCallback((ownerMapping: Record<string, string>) => {
    updateState({ ownerMapping });
    goToStep('preview');
  }, [updateState, goToStep]);

  const handlePreviewCalculated = useCallback((preview: ImportState['preview']) => {
    updateState({ preview });
  }, [updateState]);

  const handleStartImport = useCallback(() => {
    goToStep('importing');
  }, [goToStep]);

  const handleImportComplete = useCallback((results: ImportState['results'], errors: ImportState['errors']) => {
    updateState({ results, errors, step: 'complete' });
  }, [updateState]);

  const handleReset = useCallback(() => {
    setState(initialState);
  }, []);

  const currentStepIndex = STEPS.findIndex(s => s.id === state.step);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Step Indicator */}
      {state.step !== 'complete' && (
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.slice(0, -1).map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index < currentStepIndex
                    ? 'bg-blue-600 text-white'
                    : index === currentStepIndex
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  index <= currentStepIndex ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                {index < STEPS.length - 2 && (
                  <div className={`mx-4 h-0.5 w-12 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {state.step === 'upload' && (
          <FileUpload
            importType={state.importType}
            onImportTypeChange={(type) => updateState({ importType: type })}
            onFileUpload={handleFileUpload}
          />
        )}

        {state.step === 'mapping' && (
          <ColumnMapper
            columns={state.columns}
            sampleData={state.sampleData}
            importType={state.importType}
            initialMapping={state.columnMapping}
            onComplete={handleMappingComplete}
            onBack={() => goToStep('upload')}
          />
        )}

        {state.step === 'stages' && (
          <StageMapper
            rawData={state.rawData}
            columnMapping={state.columnMapping}
            initialMapping={state.stageMapping}
            onComplete={handleStageMappingComplete}
            onBack={() => goToStep('mapping')}
          />
        )}

        {state.step === 'owners' && (
          <OwnerMapper
            rawData={state.rawData}
            columnMapping={state.columnMapping}
            users={users}
            currentUserId={currentUserId}
            initialMapping={state.ownerMapping}
            onComplete={handleOwnerMappingComplete}
            onBack={() => {
              const hasDealStage = Object.values(state.columnMapping).includes('deal_stage');
              goToStep(hasDealStage ? 'stages' : 'mapping');
            }}
          />
        )}

        {state.step === 'preview' && (
          <ImportPreview
            rawData={state.rawData}
            columnMapping={state.columnMapping}
            stageMapping={state.stageMapping}
            ownerMapping={state.ownerMapping}
            existingCompanies={existingCompanies}
            users={users}
            currentUserId={currentUserId}
            onPreviewCalculated={handlePreviewCalculated}
            onStartImport={handleStartImport}
            onBack={() => {
              const hasDealOwner = Object.values(state.columnMapping).includes('deal_owner');
              const hasDealStage = Object.values(state.columnMapping).includes('deal_stage');
              if (hasDealOwner) {
                goToStep('owners');
              } else if (hasDealStage) {
                goToStep('stages');
              } else {
                goToStep('mapping');
              }
            }}
          />
        )}

        {state.step === 'importing' && (
          <ImportProgress
            rawData={state.rawData}
            columnMapping={state.columnMapping}
            stageMapping={state.stageMapping}
            ownerMapping={state.ownerMapping}
            existingCompanies={existingCompanies}
            currentUserId={currentUserId}
            onComplete={handleImportComplete}
          />
        )}

        {state.step === 'complete' && (
          <ImportComplete
            results={state.results}
            errors={state.errors}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
