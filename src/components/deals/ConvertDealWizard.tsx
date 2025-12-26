'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ArrowRight, ArrowLeft, Check, Calendar, Activity, MessageSquare, Video } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface ProductStage {
  id: string;
  name: string;
  stage_order: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  is_sellable: boolean;
  stages: ProductStage[];
}

interface ProductSelection {
  product_id: string;
  stage_id?: string;
}

interface ExistingConversion {
  product_id: string;
  product_name: string;
  company_product_id: string;
  converted_at: string;
}

interface ConversionPreview {
  deal: {
    id: string;
    name: string;
    company_id: string;
    company_name: string;
    stage: string;
    estimated_value: number;
    created_at: string;
  };
  computed_dates: {
    first_activity_at: string;
    last_activity_at: string;
  };
  stats: {
    activities_count: number;
    communications_count: number;
    meetings_count: number;
  };
  existing_conversions: ExistingConversion[];
  is_converted: boolean;
  products: Product[];
}

interface ConvertDealWizardProps {
  dealId: string;
  dealName: string;
  onClose: () => void;
  onConverted: () => void;
}

type WizardStep = 'products' | 'dates' | 'confirm';

export function ConvertDealWizard({ dealId, dealName, onClose, onConverted }: ConvertDealWizardProps) {
  const [step, setStep] = useState<WizardStep>('products');
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConversionPreview | null>(null);

  // Product selection state
  const [selectedProducts, setSelectedProducts] = useState<Map<string, ProductSelection>>(new Map());

  // Load conversion preview data
  useEffect(() => {
    async function loadPreview() {
      try {
        setLoading(true);
        const res = await fetch(`/api/deals/${dealId}/convert`);
        if (!res.ok) throw new Error('Failed to load deal data');
        const data = await res.json();
        setPreview(data);

        // Pre-select already converted products (disabled in UI)
        const existingMap = new Map<string, ProductSelection>();
        for (const conv of data.existing_conversions || []) {
          existingMap.set(conv.product_id, { product_id: conv.product_id });
        }
        setSelectedProducts(existingMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    loadPreview();
  }, [dealId]);

  const toggleProduct = (productId: string, stages: ProductStage[]) => {
    // Don't allow toggling already converted products
    if (preview?.existing_conversions.some((c) => c.product_id === productId)) {
      return;
    }

    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        // Default to first stage
        const firstStage = stages[0];
        next.set(productId, {
          product_id: productId,
          stage_id: firstStage?.id,
        });
      }
      return next;
    });
  };

  const setProductStage = (productId: string, stageId: string) => {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (existing) {
        next.set(productId, { ...existing, stage_id: stageId });
      }
      return next;
    });
  };

  const handleConvert = async () => {
    // Filter out already-converted products
    const newSelections = Array.from(selectedProducts.values()).filter(
      (s) => !preview?.existing_conversions.some((c) => c.product_id === s.product_id)
    );

    if (newSelections.length === 0) {
      setError('Please select at least one new product');
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: newSelections }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Conversion failed');
      }

      onConverted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const newSelectionsCount = Array.from(selectedProducts.keys()).filter(
    (id) => !preview?.existing_conversions.some((c) => c.product_id === id)
  ).length;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-4">Loading deal data...</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md">
          <p className="text-red-600">{error || 'Failed to load deal'}</p>
          <button onClick={onClose} className="mt-4 text-sm text-blue-600">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Convert Deal</h2>
            <p className="text-sm text-gray-500 mt-0.5">{dealName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Already Converted Notice */}
        {preview.is_converted && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              This deal has already been converted to {preview.existing_conversions.length} product(s).
              You can add more products below.
            </p>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <StepIndicator
            step={1}
            label="Select Products"
            active={step === 'products'}
            completed={step !== 'products'}
          />
          <div className="flex-1 h-px bg-gray-300" />
          <StepIndicator
            step={2}
            label="Review Dates"
            active={step === 'dates'}
            completed={step === 'confirm'}
          />
          <div className="flex-1 h-px bg-gray-300" />
          <StepIndicator step={3} label="Confirm" active={step === 'confirm'} completed={false} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step A: Select Products */}
          {step === 'products' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select which products this deal should be converted to. You can select multiple products
                to split this deal into separate product pipelines.
              </p>

              <div className="space-y-3">
                {preview.products.map((product) => {
                  const isSelected = selectedProducts.has(product.id);
                  const isAlreadyConverted = preview.existing_conversions.some(
                    (c) => c.product_id === product.id
                  );
                  const selection = selectedProducts.get(product.id);

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'border rounded-xl p-4 transition-colors',
                        isAlreadyConverted
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isAlreadyConverted}
                          onChange={() => toggleProduct(product.id, product.stages)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{product.name}</span>
                            {isAlreadyConverted && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                Already Converted
                              </span>
                            )}
                          </div>

                          {/* Stage selector (only if selected and not already converted) */}
                          {isSelected && !isAlreadyConverted && product.stages.length > 0 && (
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Starting Stage
                              </label>
                              <select
                                value={selection?.stage_id || ''}
                                onChange={(e) => setProductStage(product.id, e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {product.stages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step B: Review Dates */}
          {step === 'dates' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                These dates are computed from the deal's history and will be applied to the new
                product deals.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">First Activity</span>
                  </div>
                  <p className="text-lg font-medium text-gray-900">
                    {formatDate(preview.computed_dates.first_activity_at)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Will be set as sales_started_at
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Last Activity</span>
                  </div>
                  <p className="text-lg font-medium text-gray-900">
                    {formatDate(preview.computed_dates.last_activity_at)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Will be set as last_human_touch_at
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">History to Migrate</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">{preview.stats.activities_count}</p>
                      <p className="text-xs text-gray-500">Activities</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">{preview.stats.communications_count}</p>
                      <p className="text-xs text-gray-500">Communications</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Video className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">{preview.stats.meetings_count}</p>
                      <p className="text-xs text-gray-500">Meetings</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step C: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="font-medium text-blue-900 mb-2">Ready to Convert</h4>
                <p className="text-sm text-blue-700">
                  This will create {newSelectionsCount} new product deal(s) and mark the legacy deal
                  as converted. The legacy deal will become read-only.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Products to Create</h4>
                <div className="space-y-2">
                  {Array.from(selectedProducts.entries())
                    .filter(([id]) => !preview.existing_conversions.some((c) => c.product_id === id))
                    .map(([productId, selection]) => {
                      const product = preview.products.find((p) => p.id === productId);
                      const stage = product?.stages.find((s) => s.id === selection.stage_id);
                      return (
                        <div
                          key={productId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <span className="font-medium text-gray-900">{product?.name}</span>
                          <span className="text-sm text-gray-500">
                            Stage: {stage?.name || 'First stage'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>
                    - <strong>Company:</strong> {preview.deal.company_name}
                  </li>
                  <li>
                    - <strong>First Activity:</strong> {formatDate(preview.computed_dates.first_activity_at)}
                  </li>
                  <li>
                    - <strong>Last Activity:</strong> {formatDate(preview.computed_dates.last_activity_at)}
                  </li>
                  <li>
                    - <strong>History:</strong> {preview.stats.activities_count} activities,{' '}
                    {preview.stats.communications_count} communications, {preview.stats.meetings_count}{' '}
                    meetings
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {step !== 'products' && (
              <button
                onClick={() => setStep(step === 'dates' ? 'products' : 'dates')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>

            {step === 'products' && (
              <button
                onClick={() => setStep('dates')}
                disabled={newSelectionsCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 'dates' && (
              <button
                onClick={() => setStep('confirm')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 'confirm' && (
              <button
                onClick={handleConvert}
                disabled={converting || newSelectionsCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {converting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Convert Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
          completed
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-500'
        )}
      >
        {completed ? <Check className="h-3 w-3" /> : step}
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          active ? 'text-gray-900' : 'text-gray-500'
        )}
      >
        {label}
      </span>
    </div>
  );
}
