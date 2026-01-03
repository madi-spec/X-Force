/**
 * Focus Lens Types
 *
 * Lenses change UI emphasis, defaults, and queues without changing underlying data.
 */

export type LensType = 'focus' | 'customer_success' | 'sales' | 'onboarding' | 'support';

export interface LensConfig {
  id: LensType;
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  bgColor: string; // tailwind bg color class

  // Default tab when opening a company (Customer Hub tabs)
  defaultCustomerTab: 'overview' | 'sales' | 'onboarding' | 'engagement' | 'support' | 'timeline' | 'conversations' | 'meetings';

  // Tab ordering for Customer Hub (first = leftmost)
  tabOrder: Array<'overview' | 'sales' | 'onboarding' | 'engagement' | 'support' | 'timeline' | 'conversations' | 'meetings'>;

  // Header chips to show prominently (others are collapsed)
  headerChips: string[];

  // Header chips to hide completely
  hiddenHeaderChips: string[];

  // Which work queues are visible by default (others can be toggled on)
  defaultQueues: Array<'commandCenter' | 'supportCases' | 'scheduler' | 'responses'>;

  // Primary CTAs to emphasize
  primaryCTAs: string[];

  // Widgets to show prominently (others are minimized/hidden)
  visibleWidgets: string[];

  // Widgets to hide completely
  hiddenWidgets: string[];

  // Custom breadcrumb prefix (optional)
  breadcrumbPrefix?: string;
}

export interface LensState {
  currentLens: LensType;
  setLens: (lens: LensType) => void;
  config: LensConfig;
}

// Storage key for localStorage persistence
export const LENS_STORAGE_KEY = 'x-force-focus-lens';
