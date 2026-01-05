import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnifiedShell } from '@/components/shell/UnifiedShell';
import { FocusProvider } from '@/lib/focus';
import { UserFocusPermissions } from '@/lib/rbac';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('UnifiedShell', () => {
  const mockAdminPermissions: UserFocusPermissions = {
    userId: 'test-user-1',
    role: 'admin',
    defaultLens: 'customer_success',
    permittedLenses: ['sales', 'onboarding', 'customer_success', 'support'],
    canSwitchLens: true,
    currentLens: 'customer_success',
  };

  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('Layout Structure', () => {
    it('renders sidebar with logo', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('X-FORCE')).toBeInTheDocument();
    });

    it('renders primary navigation items', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Process Studio')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('renders secondary navigation toggle', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('More Tools')).toBeInTheDocument();
    });

    it('renders settings and sign out', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('renders search bar', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(
        screen.getByPlaceholderText('Search customers, deals, contacts...')
      ).toBeInTheDocument();
    });

    it('renders Command Center quick access', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });

    it('renders user info when provided', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('renders focus switcher in header', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      // Should see the focus label in the header area
      const header = screen.getByRole('banner');
      expect(header).toContainHTML('Customer Success');
    });
  });

  describe('Content Area', () => {
    it('renders children content', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div data-testid="test-content">Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('Snapshots', () => {
    it('matches snapshot with admin user', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Dashboard Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });

    it('matches snapshot without user', () => {
      const { container } = render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell>
            <div>Dashboard Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });

    it('matches snapshot with sales focus', () => {
      const salesPermissions: UserFocusPermissions = {
        ...mockAdminPermissions,
        currentLens: 'sales',
      };

      const { container } = render(
        <FocusProvider initialPermissions={salesPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Dashboard Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      expect(container).toMatchSnapshot();
    });
  });

  describe('Responsive Behavior', () => {
    it('sidebar is hidden on mobile (via CSS class)', () => {
      render(
        <FocusProvider initialPermissions={mockAdminPermissions}>
          <UnifiedShell user={mockUser}>
            <div>Test Content</div>
          </UnifiedShell>
        </FocusProvider>
      );

      // Sidebar has hidden lg:flex class
      const sidebar = screen.getByText('X-FORCE').closest('aside');
      expect(sidebar).toHaveClass('hidden');
      expect(sidebar).toHaveClass('lg:flex');
    });
  });
});
