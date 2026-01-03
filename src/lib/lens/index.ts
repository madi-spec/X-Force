// Lens types
export type { LensType, LensConfig, LensState } from './types';
export { LENS_STORAGE_KEY } from './types';

// Lens configuration
export {
  lensConfigs,
  getLensConfig,
  getAllLenses,
  isWidgetVisible,
  isPrimaryCTA,
  isQueueDefault,
  DEFAULT_LENS,
} from './lensConfig';

// Lens context and hooks
export {
  LensContext,
  LensProvider,
  useLens,
  useWidgetVisibility,
  usePrimaryCTA,
  useDefaultQueue,
} from './LensContext';

// Focus → Segment mapping
export type {
  FocusSegmentConfig,
  FocusKPI,
  UserRole,
  FocusRestriction,
  FocusSegmentMappingUpdatedEvent,
  RoleFocusRestrictionUpdatedEvent,
  FocusConfigEvent,
} from './focusSegmentMapping';

export {
  FOCUS_SEGMENT_CONFIGS,
  ROLE_FOCUS_RESTRICTIONS,
  getFocusSegmentConfig,
  getVisibleQueuesForLens,
  isQueueVisibleForLens,
  getCTALabel,
  getFocusRestriction,
  canAccessLens,
  canSwitchLens,
  getDefaultLensForRole,
  isNavItemHidden,
  getOrderedQueuesForLens,
} from './focusSegmentMapping';
