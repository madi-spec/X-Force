/**
 * RBAC Types for Focus Lens Permissions
 *
 * Defines roles, permissions, and focus access control.
 * Role assignments and permission grants are event-sourced.
 */

import { LensType } from '@/lib/lens/types';

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export type UserRole =
  | 'sales_rep'
  | 'onboarding_specialist'
  | 'customer_success_manager'
  | 'support_agent'
  | 'sales_manager'
  | 'cs_manager'
  | 'support_manager'
  | 'admin';

export interface RoleConfig {
  id: UserRole;
  label: string;
  description: string;
  defaultLens: LensType;
  permittedLenses: LensType[];
  canSwitchLens: boolean;
  isManager: boolean;
}

// ============================================================================
// ROLE CONFIGURATIONS
// ============================================================================

export const roleConfigs: Record<UserRole, RoleConfig> = {
  sales_rep: {
    id: 'sales_rep',
    label: 'Sales Representative',
    description: 'Individual contributor focused on sales pipeline',
    defaultLens: 'sales',
    permittedLenses: ['sales'],
    canSwitchLens: false,
    isManager: false,
  },
  onboarding_specialist: {
    id: 'onboarding_specialist',
    label: 'Onboarding Specialist',
    description: 'Individual contributor focused on customer onboarding',
    defaultLens: 'onboarding',
    permittedLenses: ['onboarding'],
    canSwitchLens: false,
    isManager: false,
  },
  customer_success_manager: {
    id: 'customer_success_manager',
    label: 'Customer Success Manager',
    description: 'Individual contributor focused on customer retention',
    defaultLens: 'customer_success',
    permittedLenses: ['focus', 'customer_success', 'onboarding'],
    canSwitchLens: true,
    isManager: false,
  },
  support_agent: {
    id: 'support_agent',
    label: 'Support Agent',
    description: 'Individual contributor focused on issue resolution',
    defaultLens: 'support',
    permittedLenses: ['support'],
    canSwitchLens: false,
    isManager: false,
  },
  sales_manager: {
    id: 'sales_manager',
    label: 'Sales Manager',
    description: 'Manager overseeing sales team and pipeline',
    defaultLens: 'sales',
    permittedLenses: ['focus', 'sales', 'onboarding', 'customer_success'],
    canSwitchLens: true,
    isManager: true,
  },
  cs_manager: {
    id: 'cs_manager',
    label: 'Customer Success Manager (Leadership)',
    description: 'Manager overseeing CS and onboarding teams',
    defaultLens: 'customer_success',
    permittedLenses: ['focus', 'customer_success', 'onboarding', 'support'],
    canSwitchLens: true,
    isManager: true,
  },
  support_manager: {
    id: 'support_manager',
    label: 'Support Manager',
    description: 'Manager overseeing support team',
    defaultLens: 'support',
    permittedLenses: ['focus', 'support', 'customer_success'],
    canSwitchLens: true,
    isManager: true,
  },
  admin: {
    id: 'admin',
    label: 'Administrator',
    description: 'Full access to all areas',
    defaultLens: 'focus',
    permittedLenses: ['focus', 'sales', 'onboarding', 'customer_success', 'support'],
    canSwitchLens: true,
    isManager: true,
  },
};

// ============================================================================
// USER FOCUS PERMISSIONS
// ============================================================================

export interface UserFocusPermissions {
  userId: string;
  role: UserRole;
  defaultLens: LensType;
  permittedLenses: LensType[];
  canSwitchLens: boolean;
  currentLens: LensType;
}

// ============================================================================
// PERMISSION CHECK RESULTS
// ============================================================================

export interface LensPermissionCheck {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get role configuration by ID
 */
export function getRoleConfig(role: UserRole): RoleConfig {
  return roleConfigs[role];
}

/**
 * Get all role options for admin UI
 */
export function getAllRoles(): RoleConfig[] {
  return Object.values(roleConfigs);
}

/**
 * Check if a user can access a specific lens
 */
export function canAccessLens(
  userRole: UserRole,
  targetLens: LensType,
  overridePermissions?: LensType[]
): LensPermissionCheck {
  const roleConfig = getRoleConfig(userRole);
  const permittedLenses = overridePermissions || roleConfig.permittedLenses;

  if (permittedLenses.includes(targetLens)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Role '${roleConfig.label}' does not have access to '${targetLens}' focus`,
  };
}

/**
 * Check if a user can switch lenses at all
 */
export function canSwitchLens(userRole: UserRole): boolean {
  const roleConfig = getRoleConfig(userRole);
  return roleConfig.canSwitchLens && roleConfig.permittedLenses.length > 1;
}

/**
 * Get default lens for a role
 */
export function getDefaultLensForRole(role: UserRole): LensType {
  return getRoleConfig(role).defaultLens;
}

/**
 * Get permitted lenses for a role
 */
export function getPermittedLensesForRole(role: UserRole): LensType[] {
  return getRoleConfig(role).permittedLenses;
}

/**
 * Build user focus permissions from role
 */
export function buildUserFocusPermissions(
  userId: string,
  role: UserRole,
  currentLens?: LensType
): UserFocusPermissions {
  const roleConfig = getRoleConfig(role);
  const effectiveLens = currentLens && roleConfig.permittedLenses.includes(currentLens)
    ? currentLens
    : roleConfig.defaultLens;

  return {
    userId,
    role,
    defaultLens: roleConfig.defaultLens,
    permittedLenses: roleConfig.permittedLenses,
    canSwitchLens: roleConfig.canSwitchLens && roleConfig.permittedLenses.length > 1,
    currentLens: effectiveLens,
  };
}
