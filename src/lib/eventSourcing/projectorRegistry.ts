/**
 * Projector Registry
 *
 * Central registry for all projectors in the system.
 * Used by the rebuild tool to look up projectors by name.
 */

import type { Projector } from '../lifecycle/projectors/core';

// Lazy-loaded projector registry to avoid circular dependencies
let projectorsLoaded = false;
const projectorRegistry = new Map<string, Projector>();

/**
 * Load all projectors into the registry
 */
async function loadProjectors(): Promise<void> {
  if (projectorsLoaded) return;

  try {
    // Import lifecycle projectors
    const lifecycleProjectors = await import('../lifecycle/projectors');

    if (lifecycleProjectors.CompanyProductReadModelProjector) {
      projectorRegistry.set('company_product_read_model', lifecycleProjectors.CompanyProductReadModelProjector);
    }
    if (lifecycleProjectors.CompanyProductStageFactsProjector) {
      projectorRegistry.set('company_product_stage_facts', lifecycleProjectors.CompanyProductStageFactsProjector);
    }
    if (lifecycleProjectors.ProductPipelineStageCountsProjector) {
      projectorRegistry.set('product_pipeline_stage_counts', lifecycleProjectors.ProductPipelineStageCountsProjector);
    }
  } catch (error) {
    console.warn('Failed to load lifecycle projectors:', error);
  }

  try {
    // Import support case projectors
    const supportCaseProjectors = await import('../supportCase/projectors');

    if (supportCaseProjectors.SupportCaseReadModelProjector) {
      projectorRegistry.set('support_case_read_model', supportCaseProjectors.SupportCaseReadModelProjector);
    }
    if (supportCaseProjectors.SupportCaseSlaFactsProjector) {
      projectorRegistry.set('support_case_sla_facts', supportCaseProjectors.SupportCaseSlaFactsProjector);
    }
    if (supportCaseProjectors.OpenCaseCountsProjector) {
      projectorRegistry.set('company_product_open_case_counts', supportCaseProjectors.OpenCaseCountsProjector);
      projectorRegistry.set('company_open_case_counts', supportCaseProjectors.OpenCaseCountsProjector);
    }
  } catch (error) {
    console.warn('Failed to load support case projectors:', error);
  }

  projectorsLoaded = true;
}

/**
 * Get a projector by name
 */
export async function getProjectorByName(name: string): Promise<Projector | undefined> {
  await loadProjectors();
  return projectorRegistry.get(name);
}

/**
 * Get all registered projectors
 */
export async function getAllProjectors(): Promise<Map<string, Projector>> {
  await loadProjectors();
  return new Map(projectorRegistry);
}

/**
 * Get registered projector names
 */
export async function getProjectorNames(): Promise<string[]> {
  await loadProjectors();
  return Array.from(projectorRegistry.keys());
}

/**
 * Register a projector (for testing or custom projectors)
 */
export function registerProjector(name: string, projector: Projector): void {
  projectorRegistry.set(name, projector);
}

/**
 * Clear registry (for testing)
 */
export function clearRegistry(): void {
  projectorRegistry.clear();
  projectorsLoaded = false;
}
