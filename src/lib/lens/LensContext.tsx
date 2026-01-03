'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { LensType, LensConfig, LensState, LENS_STORAGE_KEY } from './types';
import { getLensConfig, DEFAULT_LENS } from './lensConfig';

// Storage key for tracking if we've loaded user's default
const LENS_INITIALIZED_KEY = 'x-force-lens-initialized';

// Create the LensContext
const LensContext = createContext<LensState | undefined>(undefined);

// Export for use by FocusProvider
export { LensContext };

interface LensProviderProps {
  children: ReactNode;
  initialLens?: LensType;
}

const VALID_LENSES = ['focus', 'customer_success', 'sales', 'onboarding', 'support'];

/**
 * Load lens from localStorage
 */
function loadLensFromStorage(): LensType | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(LENS_STORAGE_KEY);
    if (stored && VALID_LENSES.includes(stored)) {
      return stored as LensType;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

/**
 * Check if lens has been initialized from user preferences
 */
function isLensInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LENS_INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark lens as initialized
 */
function markLensInitialized(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LENS_INITIALIZED_KEY, 'true');
  } catch {
    // localStorage not available
  }
}

/**
 * Save lens to localStorage
 */
function saveLensToStorage(lens: LensType): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LENS_STORAGE_KEY, lens);
  } catch {
    // localStorage not available
  }
}

/**
 * Fetch user's default lens from API
 */
async function fetchUserDefaultLens(): Promise<LensType | null> {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    const data = await res.json();
    const defaultLens = data.user?.default_lens;
    if (defaultLens && VALID_LENSES.includes(defaultLens)) {
      return defaultLens as LensType;
    }
  } catch {
    // API not available or error
  }
  return null;
}

export function LensProvider({ children, initialLens }: LensProviderProps) {
  const [currentLens, setCurrentLens] = useState<LensType>(initialLens || DEFAULT_LENS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage, then potentially from API
  useEffect(() => {
    const initializeLens = async () => {
      // First try localStorage for quick hydration
      const storedLens = loadLensFromStorage();

      if (storedLens) {
        // User has a stored lens preference
        setCurrentLens(storedLens);
        setIsHydrated(true);

        // If not initialized from user preferences yet, fetch and use default
        if (!isLensInitialized()) {
          const userDefault = await fetchUserDefaultLens();
          if (userDefault) {
            setCurrentLens(userDefault);
            saveLensToStorage(userDefault);
            markLensInitialized();
          } else {
            markLensInitialized();
          }
        }
      } else {
        // No stored lens - fetch user's default from API
        const userDefault = await fetchUserDefaultLens();
        if (userDefault) {
          setCurrentLens(userDefault);
          saveLensToStorage(userDefault);
        } else {
          setCurrentLens(DEFAULT_LENS);
        }
        markLensInitialized();
        setIsHydrated(true);
      }
    };

    initializeLens();
  }, []);

  const setLens = useCallback((lens: LensType) => {
    setCurrentLens(lens);
    saveLensToStorage(lens);
  }, []);

  const config = getLensConfig(currentLens);

  const value: LensState = {
    currentLens,
    setLens,
    config,
  };

  // Prevent hydration mismatch by rendering with default until hydrated
  if (!isHydrated) {
    return (
      <LensContext.Provider
        value={{
          currentLens: DEFAULT_LENS,
          setLens,
          config: getLensConfig(DEFAULT_LENS),
        }}
      >
        {children}
      </LensContext.Provider>
    );
  }

  return <LensContext.Provider value={value}>{children}</LensContext.Provider>;
}

/**
 * Hook to access lens state
 */
export function useLens(): LensState {
  const context = useContext(LensContext);
  if (context === undefined) {
    throw new Error('useLens must be used within a LensProvider');
  }
  return context;
}

/**
 * Hook to check if a widget is visible in current lens
 */
export function useWidgetVisibility(widgetId: string): boolean {
  const { config } = useLens();
  if (config.hiddenWidgets.includes(widgetId)) return false;
  if (config.visibleWidgets.length > 0) {
    return config.visibleWidgets.includes(widgetId);
  }
  return true;
}

/**
 * Hook to check if a CTA is primary in current lens
 */
export function usePrimaryCTA(ctaId: string): boolean {
  const { config } = useLens();
  return config.primaryCTAs.includes(ctaId);
}

/**
 * Hook to check if a queue is in default set for current lens
 */
export function useDefaultQueue(queueId: string): boolean {
  const { config } = useLens();
  return config.defaultQueues.includes(queueId as LensConfig['defaultQueues'][number]);
}
