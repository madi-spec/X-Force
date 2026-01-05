import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusSwitcher } from '@/components/shell/FocusSwitcher';
import { FocusProvider } from '@/lib/focus';
import { UserFocusPermissions } from '@/lib/rbac';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('FocusSwitcher', () => {
  const mockAdminPermissions: UserFocusPermissions = {
    userId: 'test-user-1',
    role: 'admin',
    defaultLens: 'customer_success',
    permittedLenses: ['sales', 'onboarding', 'customer_success', 'support'],
    canSwitchLens: true,
    currentLens: 'customer_success',
  };

  const mockSalesRepPermissions: UserFocusPermissions = {
    userId: 'test-user-2',
    role: 'sales_rep',
    defaultLens: 'sales',
    permittedLenses: ['sales'],
    canSwitchLens: false,
    currentLens: 'sales',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('Sidebar Variant', () => {
    it('renders with correct focus label for admin', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      expect(screen.getByText('Customer Success')).toBeInTheDocument();
      expect(screen.getByText('Focus')).toBeInTheDocument();
    });

    it('shows dropdown when clicked for admin', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByText('Switch Focus Lens')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();
      expect(screen.getByText('Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('does not show dropdown for sales_rep (single lens)', () => {
      render(
        <FocusProvider initialPermissions={mockSalesRepPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Dropdown should not appear
      expect(screen.queryByText('Switch Focus Lens')).not.toBeInTheDocument();
    });

    it('matches snapshot for admin user', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });

    it('matches snapshot for sales_rep user', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockSalesRepPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });
  });

  describe('Header Variant', () => {
    it('renders correctly for admin', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="header" />
        </FocusProvider>
      );

      expect(screen.getByText('Customer Success')).toBeInTheDocument();
    });

    it('shows chevron for admin (can switch)', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="header" />
        </FocusProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Should show dropdown
      expect(screen.getByText('Switch Focus Lens')).toBeInTheDocument();
    });

    it('matches snapshot for header variant', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="header" />
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });
  });

  describe('Compact Variant', () => {
    it('shows short label', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="compact" />
        </FocusProvider>
      );

      expect(screen.getByText('CS')).toBeInTheDocument();
    });

    it('matches snapshot for compact variant', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="compact" />
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });
  });

  describe('Permission-Aware Behavior', () => {
    const mockCSMPermissions: UserFocusPermissions = {
      userId: 'test-user-3',
      role: 'customer_success_manager',
      defaultLens: 'customer_success',
      permittedLenses: ['customer_success', 'onboarding'],
      canSwitchLens: true,
      currentLens: 'customer_success',
    };

    it('only shows permitted lenses in dropdown', () => {
      render(
        <FocusProvider initialPermissions={mockCSMPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Should show permitted lenses
      expect(screen.getByText('Customer Success')).toBeInTheDocument();
      expect(screen.getByText('Onboarding')).toBeInTheDocument();

      // Should NOT show unpermitted lenses
      expect(screen.queryByText('Sales')).not.toBeInTheDocument();
      expect(screen.queryByText('Support')).not.toBeInTheDocument();
    });

    it('shows check mark on current lens', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <FocusSwitcher variant="sidebar" />
        </FocusProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Current lens (Customer Success) should have check mark
      const csButton = screen.getByText('Customer Success').closest('button');
      expect(csButton?.querySelector('svg')).toBeInTheDocument();
    });
  });
});
