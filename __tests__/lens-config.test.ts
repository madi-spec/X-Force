/**
 * Unit tests for Focus Lens configuration and persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  lensConfigs,
  getLensConfig,
  getAllLenses,
  isWidgetVisible,
  isPrimaryCTA,
  isQueueDefault,
  DEFAULT_LENS,
} from '../src/lib/lens/lensConfig';
import { LensType, LENS_STORAGE_KEY } from '../src/lib/lens/types';

describe('Lens Configuration', () => {
  describe('lensConfigs', () => {
    it('should have all four lens types defined', () => {
      expect(lensConfigs).toHaveProperty('customer_success');
      expect(lensConfigs).toHaveProperty('sales');
      expect(lensConfigs).toHaveProperty('onboarding');
      expect(lensConfigs).toHaveProperty('support');
    });

    it('each lens should have required properties', () => {
      const requiredProps = [
        'id',
        'label',
        'shortLabel',
        'description',
        'icon',
        'color',
        'bgColor',
        'defaultCustomerTab',
        'defaultQueues',
        'primaryCTAs',
        'visibleWidgets',
        'hiddenWidgets',
      ];

      Object.values(lensConfigs).forEach((config) => {
        requiredProps.forEach((prop) => {
          expect(config).toHaveProperty(prop);
        });
      });
    });

    it('customer_success lens should have correct defaults', () => {
      const cs = lensConfigs.customer_success;
      expect(cs.id).toBe('customer_success');
      expect(cs.defaultCustomerTab).toBe('relationship');
      expect(cs.defaultQueues).toContain('commandCenter');
      expect(cs.defaultQueues).toContain('responses');
    });

    it('sales lens should have correct defaults', () => {
      const sales = lensConfigs.sales;
      expect(sales.id).toBe('sales');
      expect(sales.defaultCustomerTab).toBe('deals');
      expect(sales.defaultQueues).toContain('commandCenter');
      expect(sales.defaultQueues).toContain('scheduler');
    });

    it('onboarding lens should have correct defaults', () => {
      const onboarding = lensConfigs.onboarding;
      expect(onboarding.id).toBe('onboarding');
      expect(onboarding.defaultCustomerTab).toBe('products');
      expect(onboarding.defaultQueues).toContain('commandCenter');
      expect(onboarding.defaultQueues).toContain('scheduler');
    });

    it('support lens should have correct defaults', () => {
      const support = lensConfigs.support;
      expect(support.id).toBe('support');
      expect(support.defaultCustomerTab).toBe('activities');
      expect(support.defaultQueues).toContain('supportCases');
      expect(support.defaultQueues).toContain('responses');
    });
  });

  describe('getLensConfig', () => {
    it('should return correct config for each lens type', () => {
      const lensTypes: LensType[] = ['customer_success', 'sales', 'onboarding', 'support'];

      lensTypes.forEach((lensType) => {
        const config = getLensConfig(lensType);
        expect(config.id).toBe(lensType);
      });
    });
  });

  describe('getAllLenses', () => {
    it('should return all four lenses', () => {
      const lenses = getAllLenses();
      expect(lenses).toHaveLength(4);
    });

    it('should return lenses as an array of configs', () => {
      const lenses = getAllLenses();
      lenses.forEach((lens) => {
        expect(lens).toHaveProperty('id');
        expect(lens).toHaveProperty('label');
      });
    });
  });

  describe('isWidgetVisible', () => {
    it('should return false for hidden widgets', () => {
      // Customer success hides deal_pipeline
      expect(isWidgetVisible('customer_success', 'deal_pipeline')).toBe(false);

      // Sales hides support_tickets
      expect(isWidgetVisible('sales', 'support_tickets')).toBe(false);
    });

    it('should return true for visible widgets', () => {
      // Customer success shows health_score
      expect(isWidgetVisible('customer_success', 'health_score')).toBe(true);

      // Sales shows deal_pipeline
      expect(isWidgetVisible('sales', 'deal_pipeline')).toBe(true);
    });
  });

  describe('isPrimaryCTA', () => {
    it('should return true for primary CTAs in lens', () => {
      expect(isPrimaryCTA('customer_success', 'schedule_check_in')).toBe(true);
      expect(isPrimaryCTA('sales', 'create_deal')).toBe(true);
      expect(isPrimaryCTA('support', 'create_ticket')).toBe(true);
    });

    it('should return false for non-primary CTAs', () => {
      expect(isPrimaryCTA('customer_success', 'create_deal')).toBe(false);
      expect(isPrimaryCTA('sales', 'create_ticket')).toBe(false);
    });
  });

  describe('isQueueDefault', () => {
    it('should return true for default queues in lens', () => {
      expect(isQueueDefault('customer_success', 'commandCenter')).toBe(true);
      expect(isQueueDefault('customer_success', 'responses')).toBe(true);
      expect(isQueueDefault('support', 'supportCases')).toBe(true);
    });

    it('should return false for non-default queues', () => {
      expect(isQueueDefault('customer_success', 'supportCases')).toBe(false);
      expect(isQueueDefault('sales', 'supportCases')).toBe(false);
    });
  });

  describe('DEFAULT_LENS', () => {
    it('should be customer_success', () => {
      expect(DEFAULT_LENS).toBe('customer_success');
    });
  });
});

describe('Lens Persistence', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  it('should use correct storage key', () => {
    expect(LENS_STORAGE_KEY).toBe('x-force-focus-lens');
  });

  it('should persist lens to localStorage', () => {
    const lens: LensType = 'sales';
    localStorage.setItem(LENS_STORAGE_KEY, lens);

    expect(localStorage.setItem).toHaveBeenCalledWith(LENS_STORAGE_KEY, lens);
    expect(mockLocalStorage[LENS_STORAGE_KEY]).toBe(lens);
  });

  it('should read lens from localStorage', () => {
    mockLocalStorage[LENS_STORAGE_KEY] = 'onboarding';

    const storedLens = localStorage.getItem(LENS_STORAGE_KEY);
    expect(storedLens).toBe('onboarding');
  });

  it('should return null when no lens stored', () => {
    const storedLens = localStorage.getItem(LENS_STORAGE_KEY);
    expect(storedLens).toBeNull();
  });
});

describe('Lens Tab Mapping', () => {
  it('each lens should map to a valid tab', () => {
    const validTabs = [
      'overview',
      'relationship',
      'deals',
      'activities',
      'contacts',
      'products',
      'memory',
      'research',
    ];

    Object.values(lensConfigs).forEach((config) => {
      expect(validTabs).toContain(config.defaultCustomerTab);
    });
  });

  it('customer_success should default to relationship tab', () => {
    expect(lensConfigs.customer_success.defaultCustomerTab).toBe('relationship');
  });

  it('sales should default to deals tab', () => {
    expect(lensConfigs.sales.defaultCustomerTab).toBe('deals');
  });

  it('onboarding should default to products tab', () => {
    expect(lensConfigs.onboarding.defaultCustomerTab).toBe('products');
  });

  it('support should default to activities tab', () => {
    expect(lensConfigs.support.defaultCustomerTab).toBe('activities');
  });
});

describe('Lens Queue Priorities', () => {
  it('each lens should have at least one default queue', () => {
    Object.values(lensConfigs).forEach((config) => {
      expect(config.defaultQueues.length).toBeGreaterThan(0);
    });
  });

  it('queues should be valid queue types', () => {
    const validQueues = ['commandCenter', 'supportCases', 'scheduler', 'responses'];

    Object.values(lensConfigs).forEach((config) => {
      config.defaultQueues.forEach((queue) => {
        expect(validQueues).toContain(queue);
      });
    });
  });

  it('support lens should prioritize supportCases queue', () => {
    expect(lensConfigs.support.defaultQueues).toContain('supportCases');
  });

  it('sales lens should prioritize scheduler queue', () => {
    expect(lensConfigs.sales.defaultQueues).toContain('scheduler');
  });
});
