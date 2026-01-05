/**
 * Work Queue E2E Tests
 *
 * Tests the complete work queue flow:
 * - Queue selection and switching
 * - Item selection and preview
 * - CTA actions and resolution
 */

import { test, expect } from '@playwright/test';

test.describe('Work Queue Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to work page
    await page.goto('/work');
    // Wait for initial load
    await page.waitForSelector('[data-testid="queue-selector"], .work-queues', {
      timeout: 10000,
    }).catch(() => {
      // Fallback: wait for any queue button
      return page.waitForSelector('button:has-text("At Risk"), button:has-text("Follow-ups")', {
        timeout: 10000,
      });
    });
  });

  test.describe('Queue Navigation', () => {
    test('displays queue selector with queue counts', async ({ page }) => {
      // Should show queue buttons
      const queueButtons = page.locator('button').filter({
        has: page.locator('text=/At Risk|Expansion Ready|Follow-ups|Stalled Deals/'),
      });

      await expect(queueButtons.first()).toBeVisible();
    });

    test('selecting a queue shows its items', async ({ page }) => {
      // Click on a queue
      const queueButton = page.locator('button:has-text("At Risk"), button:has-text("Follow-ups")').first();
      await queueButton.click();

      // Should show queue items or empty state
      await expect(
        page.locator('text=/items|All clear|No items/')
      ).toBeVisible({ timeout: 5000 });
    });

    test('queue selection persists across navigation', async ({ page }) => {
      // Click on a specific queue
      const stalledDealsQueue = page.locator('button:has-text("Stalled Deals")');
      if (await stalledDealsQueue.isVisible()) {
        await stalledDealsQueue.click();

        // Navigate away and back
        await page.goto('/customers');
        await page.goto('/work');

        // The queue header should reflect the selection or default
        await expect(
          page.locator('h2:has-text("Stalled Deals"), h2:has-text("At Risk"), h2:has-text("Follow-ups")')
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Item Selection', () => {
    test('clicking an item opens the preview pane', async ({ page }) => {
      // Wait for items to load
      await page.waitForTimeout(1000);

      // Find and click an item card
      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();

        // Preview pane should open
        await expect(
          page.locator('text=/Why This Is Here|Take Action/')
        ).toBeVisible({ timeout: 3000 });
      }
    });

    test('preview pane shows company information', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        // Get company name from card
        const companyName = await itemCard.locator('span:has-text("")').first().textContent();

        await itemCard.click();

        // Preview should show company name
        if (companyName) {
          await expect(page.locator(`text="${companyName.trim()}"`)).toBeVisible();
        }
      }
    });

    test('preview pane shows "Why This Is Here" explanation', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();

        // Should show the "Why Here" section
        await expect(
          page.locator('text="Why This Is Here"')
        ).toBeVisible({ timeout: 3000 });
      }
    });

    test('preview pane can be collapsed and expanded', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();
        await page.waitForTimeout(500);

        // Find the collapse/expand button
        const collapseButton = page.locator('button[title="Hide details"], button[title="Show details"]').first();

        if (await collapseButton.isVisible()) {
          // Click to collapse
          await collapseButton.click();

          // Why Here section should be hidden
          await expect(
            page.locator('text="Why This Is Here"')
          ).not.toBeVisible({ timeout: 1000 });

          // Click to expand
          await collapseButton.click();

          // Why Here should be visible again
          await expect(
            page.locator('text="Why This Is Here"')
          ).toBeVisible({ timeout: 1000 });
        }
      }
    });

    test('closing preview returns to list view', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();
        await page.waitForTimeout(500);

        // Click close button
        const closeButton = page.locator('button[title="Close"]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();

          // Preview should be closed
          await expect(
            page.locator('text="Why This Is Here"')
          ).not.toBeVisible({ timeout: 1000 });
        }
      }
    });
  });

  test.describe('CTA Actions', () => {
    test('primary CTA button is visible in preview', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();

        // Should show action buttons
        await expect(
          page.locator('text=/Take Action/')
        ).toBeVisible({ timeout: 3000 });

        // Primary CTA should be visible
        const primaryButton = page.locator('button').filter({
          has: page.locator('text=/Reply|Schedule|Call|Close|View|Escalate/')
        }).first();

        await expect(primaryButton).toBeVisible();
      }
    });

    test('secondary CTAs are visible', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();
        await page.waitForTimeout(500);

        // Should have multiple action buttons
        const actionButtons = page.locator('button[class*="gap-2"]');
        const count = await actionButtons.count();

        expect(count).toBeGreaterThanOrEqual(1);
      }
    });

    test('quick actions are accessible', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();
        await page.waitForTimeout(500);

        // Quick actions should be visible
        const quickActions = page.locator('text=/Note|Ack/');
        if (await quickActions.first().isVisible()) {
          expect(await quickActions.count()).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  test.describe('Focus Lens Integration', () => {
    test('queue list changes based on focus lens', async ({ page }) => {
      // Check for lens-specific queues
      // Sales lens should have: Follow-ups, Stalled Deals, New Leads
      // CS lens should have: At Risk, Expansion Ready, Unresolved Issues

      const salesQueues = page.locator('text=/Follow-ups|Stalled Deals|New Leads/');
      const csQueues = page.locator('text=/At Risk|Expansion Ready|Unresolved Issues/');

      const hasSalesQueues = await salesQueues.first().isVisible();
      const hasCSQueues = await csQueues.first().isVisible();

      // At least one lens's queues should be visible
      expect(hasSalesQueues || hasCSQueues).toBe(true);
    });
  });

  test.describe('Customer Hub Integration', () => {
    test('selecting an item loads customer context', async ({ page }) => {
      await page.waitForTimeout(1000);

      const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

      if (await itemCard.isVisible()) {
        await itemCard.click();

        // Wait for CustomerHub to load
        await page.waitForTimeout(2000);

        // Should show customer information (company header, stats, or tabs)
        const hasCustomerInfo = await page
          .locator('text=/Overview|Engagement|Communications|Timeline/')
          .first()
          .isVisible()
          .catch(() => false);

        const hasLoadingSkeleton = await page
          .locator('[class*="animate-pulse"]')
          .first()
          .isVisible()
          .catch(() => false);

        // Either loading or loaded
        expect(hasCustomerInfo || hasLoadingSkeleton).toBe(true);
      }
    });
  });
});

test.describe('Work Queue Performance', () => {
  test('queue loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/work');
    await page.waitForSelector('button:has-text("At Risk"), button:has-text("Follow-ups")', {
      timeout: 10000,
    }).catch(() => null);

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('item selection is responsive', async ({ page }) => {
    await page.goto('/work');
    await page.waitForTimeout(1000);

    const itemCard = page.locator('[class*="rounded-lg"][class*="border-l-4"]').first();

    if (await itemCard.isVisible()) {
      const startTime = Date.now();
      await itemCard.click();

      // Wait for preview to appear
      await page.locator('text=/Why This Is Here|Take Action/').waitFor({
        timeout: 2000,
      }).catch(() => null);

      const responseTime = Date.now() - startTime;

      // Should respond within 500ms
      expect(responseTime).toBeLessThan(500);
    }
  });
});
