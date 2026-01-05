import { test, expect } from 'playwright';

/**
 * E2E Tests for Focus Lens Permissions
 *
 * Tests role-based focus landing and permission enforcement.
 * These tests require a running dev server and test user accounts.
 */

test.describe('Focus Lens Permissions', () => {
  // Test helper to login as a specific user role
  async function loginAsRole(page: any, role: string) {
    // Navigate to login page
    await page.goto('/login');

    // Use test credentials based on role
    // In production, these would be seeded test accounts
    const testUsers: Record<string, { email: string; password: string }> = {
      sales_rep: { email: 'sales@test.com', password: 'testpass123' },
      onboarding_specialist: { email: 'onboarding@test.com', password: 'testpass123' },
      customer_success_manager: { email: 'csm@test.com', password: 'testpass123' },
      support_agent: { email: 'support@test.com', password: 'testpass123' },
      admin: { email: 'admin@test.com', password: 'testpass123' },
    };

    const user = testUsers[role] || testUsers.admin;

    await page.fill('[name="email"]', user.email);
    await page.fill('[name="password"]', user.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/work');
  }

  test.describe('Sales Rep Role', () => {
    test.skip('lands on /work with Sales focus', async ({ page }) => {
      await loginAsRole(page, 'sales_rep');

      // Should be on /work page
      await expect(page).toHaveURL('/work');

      // Should see Sales focus indicator
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await expect(focusSwitcher).toContainText('Sales');
    });

    test.skip('cannot switch to unauthorized focus areas', async ({ page }) => {
      await loginAsRole(page, 'sales_rep');

      // Try to open focus switcher
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();

      // Should not see dropdown (locked to single lens)
      const dropdown = page.locator('[data-testid="focus-dropdown"]');
      await expect(dropdown).not.toBeVisible();

      // Should see lock icon indicating no switching allowed
      const lockIcon = focusSwitcher.locator('svg[data-icon="lock"]');
      await expect(lockIcon).toBeVisible();
    });
  });

  test.describe('Onboarding Specialist Role', () => {
    test.skip('lands on /work with Onboarding focus', async ({ page }) => {
      await loginAsRole(page, 'onboarding_specialist');

      await expect(page).toHaveURL('/work');

      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await expect(focusSwitcher).toContainText('Onboarding');
    });

    test.skip('cannot access Sales focus', async ({ page }) => {
      await loginAsRole(page, 'onboarding_specialist');

      // Try to access Sales focus via API
      const response = await page.request.post('/api/focus/set', {
        data: { lens: 'sales' },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Admin Role', () => {
    test.skip('can switch between all focus areas', async ({ page }) => {
      await loginAsRole(page, 'admin');

      // Open focus switcher
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();

      // Should see dropdown with all lenses
      const dropdown = page.locator('[data-testid="focus-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Should see all four focus options
      await expect(dropdown.locator('button')).toHaveCount(4);
      await expect(dropdown).toContainText('Sales');
      await expect(dropdown).toContainText('Onboarding');
      await expect(dropdown).toContainText('Customer Success');
      await expect(dropdown).toContainText('Support');
    });

    test.skip('switching focus updates UI immediately', async ({ page }) => {
      await loginAsRole(page, 'admin');

      // Switch to Support focus
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();

      await page.click('text=Support');

      // Verify focus switched
      await expect(focusSwitcher).toContainText('Support');

      // Refresh page and verify focus persisted
      await page.reload();
      await expect(focusSwitcher).toContainText('Support');
    });
  });

  test.describe('Customer Success Manager Role', () => {
    test.skip('lands with Customer Success focus by default', async ({ page }) => {
      await loginAsRole(page, 'customer_success_manager');

      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await expect(focusSwitcher).toContainText('Customer Success');
    });

    test.skip('can switch to Onboarding focus', async ({ page }) => {
      await loginAsRole(page, 'customer_success_manager');

      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();

      const dropdown = page.locator('[data-testid="focus-dropdown"]');
      await expect(dropdown).toContainText('Onboarding');

      await page.click('text=Onboarding');
      await expect(focusSwitcher).toContainText('Onboarding');
    });

    test.skip('cannot switch to Sales focus', async ({ page }) => {
      await loginAsRole(page, 'customer_success_manager');

      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();

      const dropdown = page.locator('[data-testid="focus-dropdown"]');

      // Should not see Sales option
      await expect(dropdown).not.toContainText('Sales');
    });
  });

  test.describe('Navigation Persistence', () => {
    test.skip('focus persists across navigation', async ({ page }) => {
      await loginAsRole(page, 'admin');

      // Set focus to Support
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();
      await page.click('text=Support');

      // Navigate to different pages
      await page.click('text=Customers');
      await expect(page).toHaveURL('/customers');
      await expect(focusSwitcher).toContainText('Support');

      await page.click('text=Process Studio');
      await expect(page).toHaveURL('/process');
      await expect(focusSwitcher).toContainText('Support');
    });

    test.skip('focus persists after browser refresh', async ({ page }) => {
      await loginAsRole(page, 'admin');

      // Set focus to Onboarding
      const focusSwitcher = page.locator('[data-testid="focus-switcher"]');
      await focusSwitcher.click();
      await page.click('text=Onboarding');

      await expect(focusSwitcher).toContainText('Onboarding');

      // Refresh
      await page.reload();

      // Should still be Onboarding
      await expect(focusSwitcher).toContainText('Onboarding');
    });
  });

  test.describe('API Permission Enforcement', () => {
    test.skip('unauthorized focus set returns 403', async ({ page }) => {
      await loginAsRole(page, 'sales_rep');

      // Try to set unauthorized focus via API
      const response = await page.request.post('/api/focus/set', {
        data: { lens: 'support' },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('does not have access');
    });

    test.skip('authorized focus set returns success', async ({ page }) => {
      await loginAsRole(page, 'admin');

      const response = await page.request.post('/api/focus/set', {
        data: { lens: 'support' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.permissions.currentLens).toBe('support');
    });
  });
});
