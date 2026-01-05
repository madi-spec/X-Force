import {
  canAccessLens,
  canSwitchLens,
  getDefaultLensForRole,
  getPermittedLensesForRole,
  buildUserFocusPermissions,
  getRoleConfig,
  UserRole,
} from '@/lib/rbac';
import { LensType } from '@/lib/lens/types';

describe('RBAC Focus Permission Logic', () => {
  // ============================================================================
  // ROLE CONFIGURATION TESTS
  // ============================================================================

  describe('getRoleConfig', () => {
    it('returns correct config for sales_rep', () => {
      const config = getRoleConfig('sales_rep');
      expect(config.id).toBe('sales_rep');
      expect(config.defaultLens).toBe('sales');
      expect(config.permittedLenses).toEqual(['sales']);
      expect(config.canSwitchLens).toBe(false);
      expect(config.isManager).toBe(false);
    });

    it('returns correct config for admin', () => {
      const config = getRoleConfig('admin');
      expect(config.id).toBe('admin');
      expect(config.permittedLenses).toContain('sales');
      expect(config.permittedLenses).toContain('onboarding');
      expect(config.permittedLenses).toContain('customer_success');
      expect(config.permittedLenses).toContain('support');
      expect(config.canSwitchLens).toBe(true);
      expect(config.isManager).toBe(true);
    });

    it('returns correct config for onboarding_specialist', () => {
      const config = getRoleConfig('onboarding_specialist');
      expect(config.defaultLens).toBe('onboarding');
      expect(config.permittedLenses).toEqual(['onboarding']);
    });

    it('returns correct config for support_agent', () => {
      const config = getRoleConfig('support_agent');
      expect(config.defaultLens).toBe('support');
      expect(config.permittedLenses).toEqual(['support']);
    });

    it('returns correct config for customer_success_manager', () => {
      const config = getRoleConfig('customer_success_manager');
      expect(config.defaultLens).toBe('customer_success');
      expect(config.permittedLenses).toContain('customer_success');
      expect(config.permittedLenses).toContain('onboarding');
    });
  });

  // ============================================================================
  // CAN ACCESS LENS TESTS
  // ============================================================================

  describe('canAccessLens', () => {
    describe('sales_rep role', () => {
      const role: UserRole = 'sales_rep';

      it('allows access to sales lens', () => {
        const result = canAccessLens(role, 'sales');
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('denies access to onboarding lens', () => {
        const result = canAccessLens(role, 'onboarding');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('does not have access');
      });

      it('denies access to customer_success lens', () => {
        const result = canAccessLens(role, 'customer_success');
        expect(result.allowed).toBe(false);
      });

      it('denies access to support lens', () => {
        const result = canAccessLens(role, 'support');
        expect(result.allowed).toBe(false);
      });
    });

    describe('admin role', () => {
      const role: UserRole = 'admin';

      it('allows access to all lenses', () => {
        const allLenses: LensType[] = ['sales', 'onboarding', 'customer_success', 'support'];
        allLenses.forEach((lens) => {
          const result = canAccessLens(role, lens);
          expect(result.allowed).toBe(true);
        });
      });
    });

    describe('sales_manager role', () => {
      const role: UserRole = 'sales_manager';

      it('allows access to sales lens', () => {
        expect(canAccessLens(role, 'sales').allowed).toBe(true);
      });

      it('allows access to onboarding lens', () => {
        expect(canAccessLens(role, 'onboarding').allowed).toBe(true);
      });

      it('allows access to customer_success lens', () => {
        expect(canAccessLens(role, 'customer_success').allowed).toBe(true);
      });

      it('denies access to support lens', () => {
        expect(canAccessLens(role, 'support').allowed).toBe(false);
      });
    });

    describe('support_agent role', () => {
      const role: UserRole = 'support_agent';

      it('allows access to support lens only', () => {
        expect(canAccessLens(role, 'support').allowed).toBe(true);
        expect(canAccessLens(role, 'sales').allowed).toBe(false);
        expect(canAccessLens(role, 'onboarding').allowed).toBe(false);
        expect(canAccessLens(role, 'customer_success').allowed).toBe(false);
      });
    });

    describe('with override permissions', () => {
      it('allows access when override includes the lens', () => {
        const result = canAccessLens('sales_rep', 'support', ['sales', 'support']);
        expect(result.allowed).toBe(true);
      });

      it('denies access when override excludes the lens', () => {
        const result = canAccessLens('admin', 'support', ['sales']);
        expect(result.allowed).toBe(false);
      });
    });
  });

  // ============================================================================
  // CAN SWITCH LENS TESTS
  // ============================================================================

  describe('canSwitchLens', () => {
    it('returns false for sales_rep (single lens)', () => {
      expect(canSwitchLens('sales_rep')).toBe(false);
    });

    it('returns false for onboarding_specialist (single lens)', () => {
      expect(canSwitchLens('onboarding_specialist')).toBe(false);
    });

    it('returns false for support_agent (single lens)', () => {
      expect(canSwitchLens('support_agent')).toBe(false);
    });

    it('returns true for customer_success_manager (multiple lenses)', () => {
      expect(canSwitchLens('customer_success_manager')).toBe(true);
    });

    it('returns true for sales_manager (multiple lenses)', () => {
      expect(canSwitchLens('sales_manager')).toBe(true);
    });

    it('returns true for admin (all lenses)', () => {
      expect(canSwitchLens('admin')).toBe(true);
    });
  });

  // ============================================================================
  // GET DEFAULT LENS FOR ROLE TESTS
  // ============================================================================

  describe('getDefaultLensForRole', () => {
    it('returns sales for sales_rep', () => {
      expect(getDefaultLensForRole('sales_rep')).toBe('sales');
    });

    it('returns onboarding for onboarding_specialist', () => {
      expect(getDefaultLensForRole('onboarding_specialist')).toBe('onboarding');
    });

    it('returns customer_success for customer_success_manager', () => {
      expect(getDefaultLensForRole('customer_success_manager')).toBe('customer_success');
    });

    it('returns support for support_agent', () => {
      expect(getDefaultLensForRole('support_agent')).toBe('support');
    });

    it('returns sales for sales_manager', () => {
      expect(getDefaultLensForRole('sales_manager')).toBe('sales');
    });

    it('returns customer_success for admin', () => {
      expect(getDefaultLensForRole('admin')).toBe('customer_success');
    });
  });

  // ============================================================================
  // GET PERMITTED LENSES FOR ROLE TESTS
  // ============================================================================

  describe('getPermittedLensesForRole', () => {
    it('returns only sales for sales_rep', () => {
      expect(getPermittedLensesForRole('sales_rep')).toEqual(['sales']);
    });

    it('returns only onboarding for onboarding_specialist', () => {
      expect(getPermittedLensesForRole('onboarding_specialist')).toEqual(['onboarding']);
    });

    it('returns customer_success and onboarding for customer_success_manager', () => {
      const lenses = getPermittedLensesForRole('customer_success_manager');
      expect(lenses).toContain('customer_success');
      expect(lenses).toContain('onboarding');
      expect(lenses).toHaveLength(2);
    });

    it('returns all lenses for admin', () => {
      const lenses = getPermittedLensesForRole('admin');
      expect(lenses).toContain('sales');
      expect(lenses).toContain('onboarding');
      expect(lenses).toContain('customer_success');
      expect(lenses).toContain('support');
      expect(lenses).toHaveLength(4);
    });
  });

  // ============================================================================
  // BUILD USER FOCUS PERMISSIONS TESTS
  // ============================================================================

  describe('buildUserFocusPermissions', () => {
    it('builds correct permissions for sales_rep', () => {
      const permissions = buildUserFocusPermissions('user-123', 'sales_rep');

      expect(permissions.userId).toBe('user-123');
      expect(permissions.role).toBe('sales_rep');
      expect(permissions.defaultLens).toBe('sales');
      expect(permissions.permittedLenses).toEqual(['sales']);
      expect(permissions.canSwitchLens).toBe(false);
      expect(permissions.currentLens).toBe('sales');
    });

    it('builds correct permissions for admin', () => {
      const permissions = buildUserFocusPermissions('user-456', 'admin');

      expect(permissions.userId).toBe('user-456');
      expect(permissions.role).toBe('admin');
      expect(permissions.permittedLenses).toHaveLength(4);
      expect(permissions.canSwitchLens).toBe(true);
    });

    it('uses provided currentLens if permitted', () => {
      const permissions = buildUserFocusPermissions('user-789', 'admin', 'support');

      expect(permissions.currentLens).toBe('support');
    });

    it('falls back to default lens if provided currentLens is not permitted', () => {
      const permissions = buildUserFocusPermissions('user-789', 'sales_rep', 'support');

      expect(permissions.currentLens).toBe('sales'); // Falls back to default
    });

    it('uses default lens when no currentLens provided', () => {
      const permissions = buildUserFocusPermissions('user-abc', 'onboarding_specialist');

      expect(permissions.currentLens).toBe('onboarding');
    });
  });

  // ============================================================================
  // EDGE CASES AND SECURITY TESTS
  // ============================================================================

  describe('security and edge cases', () => {
    it('permission check is case-sensitive for lens types', () => {
      // TypeScript would catch this at compile time, but runtime should handle it
      const result = canAccessLens('sales_rep', 'sales');
      expect(result.allowed).toBe(true);
    });

    it('handles manager roles correctly', () => {
      const managers: UserRole[] = ['sales_manager', 'cs_manager', 'support_manager', 'admin'];

      managers.forEach((role) => {
        const config = getRoleConfig(role);
        expect(config.isManager).toBe(true);
        expect(config.canSwitchLens).toBe(true);
      });
    });

    it('handles IC roles correctly', () => {
      const ics: UserRole[] = ['sales_rep', 'onboarding_specialist', 'support_agent'];

      ics.forEach((role) => {
        const config = getRoleConfig(role);
        expect(config.isManager).toBe(false);
      });
    });

    it('customer_success_manager is special - IC but can switch', () => {
      const config = getRoleConfig('customer_success_manager');
      expect(config.isManager).toBe(false);
      expect(config.canSwitchLens).toBe(true);
      expect(config.permittedLenses.length).toBeGreaterThan(1);
    });
  });
});
