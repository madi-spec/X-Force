'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { LensType, LensConfig, LensState, LENS_STORAGE_KEY } from '@/lib/lens/types';
import { getLensConfig, DEFAULT_LENS, LensContext } from '@/lib/lens';
import { UserFocusPermissions } from '@/lib/rbac';

// ============================================================================
// TYPES
// ============================================================================

export interface FocusState {
  // Current lens and config
  currentLens: LensType;
  config: LensConfig;

  // Permission-aware setters
  setLens: (lens: LensType) => Promise<boolean>;
  canSwitchTo: (lens: LensType) => boolean;

  // Permission state
  permissions: UserFocusPermissions | null;
  permittedLenses: LensType[];
  canSwitchLens: boolean;

  // Loading state
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}

interface FocusProviderProps {
  children: ReactNode;
  initialPermissions?: UserFocusPermissions;
}

// ============================================================================
// CONTEXT
// ============================================================================

const FocusContext = createContext<FocusState | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function FocusProvider({ children, initialPermissions }: FocusProviderProps) {
  const [permissions, setPermissions] = useState<UserFocusPermissions | null>(
    initialPermissions || null
  );
  const [currentLens, setCurrentLens] = useState<LensType>(
    initialPermissions?.currentLens || DEFAULT_LENS
  );
  const [isLoading, setIsLoading] = useState(!initialPermissions);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch permissions from server on mount
  useEffect(() => {
    if (initialPermissions) {
      setIsHydrated(true);
      return;
    }

    async function fetchPermissions() {
      try {
        const response = await fetch('/api/focus/permissions');
        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json() as UserFocusPermissions;
        setPermissions(data);
        setCurrentLens(data.currentLens);

        // Also sync to localStorage for faster hydration on next visit
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LENS_STORAGE_KEY, data.currentLens);
          } catch {
            // Ignore localStorage errors
          }
        }
      } catch (err) {
        console.error('[FocusContext] Failed to fetch permissions:', err);
        setError('Failed to load focus permissions');

        // Fallback to localStorage
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(LENS_STORAGE_KEY) as LensType | null;
            if (stored) {
              setCurrentLens(stored);
            }
          } catch {
            // Ignore localStorage errors
          }
        }
      } finally {
        setIsLoading(false);
        setIsHydrated(true);
      }
    }

    fetchPermissions();
  }, [initialPermissions]);

  // Check if user can switch to a specific lens
  const canSwitchTo = useCallback((lens: LensType): boolean => {
    if (!permissions) return true; // Allow all if permissions not loaded
    return permissions.permittedLenses.includes(lens);
  }, [permissions]);

  // Set lens with permission check and server sync
  const setLens = useCallback(async (lens: LensType): Promise<boolean> => {
    if (!canSwitchTo(lens)) {
      setError(`You don't have permission to switch to ${lens} focus`);
      return false;
    }

    // Optimistic update
    const previousLens = currentLens;
    setCurrentLens(lens);
    setError(null);

    // Sync to localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LENS_STORAGE_KEY, lens);
      } catch {
        // Ignore localStorage errors
      }
    }

    // Sync to server (non-blocking - localStorage is primary)
    try {
      const response = await fetch('/api/focus/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lens }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.permissions) {
          setPermissions(result.permissions);
        }
      } else {
        // Log but don't fail - localStorage has the preference
        console.log('[FocusContext] Server sync failed, using localStorage');
      }

      return true;
    } catch (err) {
      // Log but don't rollback - localStorage is the source of truth
      console.log('[FocusContext] Server sync error:', err);
      // Still return true since localStorage was updated
      return true;
    }
  }, [currentLens, canSwitchTo]);

  const config = getLensConfig(currentLens);
  const permittedLenses = permissions?.permittedLenses || [
    'sales',
    'onboarding',
    'customer_success',
    'support',
  ];
  const canSwitchLens = permissions?.canSwitchLens ?? true;

  const value: FocusState = {
    currentLens,
    config,
    setLens,
    canSwitchTo,
    permissions,
    permittedLenses,
    canSwitchLens,
    isLoading,
    isHydrated,
    error,
  };

  // Create a synchronized lens value for backward compatibility
  // This allows existing components using useLens to continue working
  const legacyLensValue: LensState = {
    currentLens,
    setLens: (lens: LensType) => {
      // Delegate to the focus provider's setLens but make it sync
      setLens(lens);
    },
    config,
  };

  return (
    <FocusContext.Provider value={value}>
      <LensContext.Provider value={legacyLensValue}>
        {children}
      </LensContext.Provider>
    </FocusContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access focus state with permission awareness
 */
export function useFocus(): FocusState {
  const context = useContext(FocusContext);
  if (context === undefined) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}

/**
 * Backward-compatible hook for lens state
 * This allows existing components using useLens to work with FocusProvider
 */
export function useLensCompat(): LensState {
  const context = useContext(LensContext);
  if (context === undefined) {
    throw new Error('useLensCompat must be used within a FocusProvider or LensProvider');
  }
  return context;
}

/**
 * Hook to check if a widget is visible in current lens
 */
export function useFocusWidgetVisibility(widgetId: string): boolean {
  const { config } = useFocus();
  if (config.hiddenWidgets.includes(widgetId)) return false;
  if (config.visibleWidgets.length > 0) {
    return config.visibleWidgets.includes(widgetId);
  }
  return true;
}

/**
 * Hook to check if a CTA is primary in current lens
 */
export function useFocusPrimaryCTA(ctaId: string): boolean {
  const { config } = useFocus();
  return config.primaryCTAs.includes(ctaId);
}

/**
 * Hook to check if a queue is in default set for current lens
 */
export function useFocusDefaultQueue(queueId: string): boolean {
  const { config } = useFocus();
  return config.defaultQueues.includes(queueId as LensConfig['defaultQueues'][number]);
}
