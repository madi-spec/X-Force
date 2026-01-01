'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProcessType, NodeItem } from './types';

interface ProductStage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  description: string | null;
  company_count: number;
}

interface UseProductStagesResult {
  stages: NodeItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches stages from product_process_stages for a given product and process type.
 * Also includes company counts for each stage.
 */
export function useProductStages(
  productId: string,
  processType: ProcessType
): UseProductStagesResult {
  const [stages, setStages] = useState<NodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStages() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // First, get the process for this product and type
        const { data: process, error: processError } = await supabase
          .from('product_processes')
          .select('id')
          .eq('product_id', productId)
          .eq('process_type', processType)
          .eq('status', 'published')
          .single();

        if (processError || !process) {
          // No process found - return empty stages
          setStages([]);
          setIsLoading(false);
          return;
        }

        // Get stages for this process
        const { data: stagesData, error: stagesError } = await supabase
          .from('product_process_stages')
          .select('id, name, slug, stage_order, description')
          .eq('process_id', process.id)
          .order('stage_order');

        if (stagesError) {
          throw new Error(stagesError.message);
        }

        // Get company counts per stage
        const { data: companyCounts, error: countError } = await supabase
          .from('company_products')
          .select('current_stage_id')
          .eq('product_id', productId)
          .eq('status', 'in_sales');

        if (countError) {
          console.warn('Could not fetch company counts:', countError);
        }

        // Count companies per stage
        const countByStage: Record<string, number> = {};
        (companyCounts || []).forEach((cp) => {
          if (cp.current_stage_id) {
            countByStage[cp.current_stage_id] = (countByStage[cp.current_stage_id] || 0) + 1;
          }
        });

        // Transform to NodeItem format
        const nodeItems: NodeItem[] = (stagesData || []).map((stage, index) => ({
          id: stage.id,
          label: stage.name,
          icon: String(index + 1),
          description: stage.description || undefined,
          companyCount: countByStage[stage.id] || 0,
        }));

        setStages(nodeItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stages');
        setStages([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (productId && processType) {
      fetchStages();
    }
  }, [productId, processType]);

  return { stages, isLoading, error };
}
