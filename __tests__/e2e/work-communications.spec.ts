/**
 * E2E Tests for Work + Communications Integration
 *
 * Tests the workflow:
 * 1. Work item -> View Comms -> Opens drawer at triggering message
 * 2. Reply from drawer -> Resolves work item
 */

import { test, expect } from '@playwright/test';

test.describe('Work Communications Integration', () => {
  test.describe('View Communications from Work', () => {
    test('clicking View Comms opens drawer', async ({ page }) => {
      // Navigate to work page
      await page.goto('/work');

      // Wait for work items to load
      await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

      // Click on a work item to open preview pane
      const workItem = page.locator('[data-testid="queue-item"]').first();
      await workItem.click();

      // Wait for preview pane to appear
      await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });

      // Click View Comms button
      const viewCommsButton = page.getByRole('button', { name: /view comms/i });
      await expect(viewCommsButton).toBeVisible();
      await viewCommsButton.click();

      // Verify drawer opens
      const drawer = page.locator('[data-testid="communications-drawer"]');
      await expect(drawer).toBeVisible({ timeout: 5000 });
    });

    test('drawer highlights triggering message when present', async ({ page }) => {
      // This test requires a work item that was triggered by a communication
      await page.goto('/work');

      // Wait for work items
      await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

      // Find a work item with communication source (if any)
      const commWorkItem = page.locator('[data-testid="queue-item"][data-source-type="communication"]').first();

      // Skip if no communication-triggered work items exist
      if (await commWorkItem.count() === 0) {
        test.skip();
        return;
      }

      await commWorkItem.click();
      await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });

      // Open comms drawer
      await page.getByRole('button', { name: /view comms/i }).click();
      await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

      // Look for highlighted message indicator
      const highlightIndicator = page.locator('[data-testid="highlight-indicator"]');
      await expect(highlightIndicator).toBeVisible();

      // The highlighted message should have a visible ring
      const highlightedMessage = page.locator('.ring-amber-400');
      await expect(highlightedMessage).toBeVisible();
    });
  });

  test.describe('Reply Flow', () => {
    test('can compose and send reply from drawer', async ({ page }) => {
      await page.goto('/work');
      await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

      // Click on first work item
      await page.locator('[data-testid="queue-item"]').first().click();
      await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });

      // Open comms drawer
      await page.getByRole('button', { name: /view comms/i }).click();
      await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

      // Click Quick Reply
      const quickReplyButton = page.getByRole('button', { name: /quick reply/i });
      await expect(quickReplyButton).toBeVisible();
      await quickReplyButton.click();

      // Verify reply composer appears
      const subjectInput = page.locator('input[placeholder="Subject"]');
      await expect(subjectInput).toBeVisible();

      const bodyTextarea = page.locator('textarea[placeholder*="reply"]');
      await expect(bodyTextarea).toBeVisible();

      // Type a reply
      await bodyTextarea.fill('Thank you for your message. This is a test reply.');

      // Verify Send button is enabled
      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toBeEnabled();
    });

    test('AI Draft button generates draft content', async ({ page }) => {
      await page.goto('/work');
      await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

      // Open work item and comms drawer
      await page.locator('[data-testid="queue-item"]').first().click();
      await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });
      await page.getByRole('button', { name: /view comms/i }).click();
      await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

      // Open reply composer
      await page.getByRole('button', { name: /quick reply/i }).click();

      // Click AI Draft button
      const aiDraftButton = page.getByRole('button', { name: /ai draft/i });
      await expect(aiDraftButton).toBeVisible();
      await aiDraftButton.click();

      // Wait for draft to be generated (should show loading state then content)
      await page.waitForFunction(() => {
        const textarea = document.querySelector('textarea[placeholder*="reply"]') as HTMLTextAreaElement;
        return textarea && textarea.value.length > 0;
      }, { timeout: 30000 }); // AI generation may take time
    });
  });

  test.describe('Work Item Resolution', () => {
    test('sending reply to message_needs_reply resolves work item', async ({ page }) => {
      // This test verifies the full flow:
      // 1. Work item exists with message_needs_reply signal
      // 2. User replies via drawer
      // 3. Work item is resolved

      await page.goto('/work');
      await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

      // Find a work item that can be resolved by reply
      const replyWorkItem = page.locator('[data-testid="queue-item"][data-signal-type="message_needs_reply"]').first();

      if (await replyWorkItem.count() === 0) {
        test.skip();
        return;
      }

      // Get the work item ID for later verification
      const workItemId = await replyWorkItem.getAttribute('data-work-item-id');

      // Open work item and send reply
      await replyWorkItem.click();
      await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });
      await page.getByRole('button', { name: /view comms/i }).click();
      await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

      await page.getByRole('button', { name: /quick reply/i }).click();
      await page.locator('textarea[placeholder*="reply"]').fill('Thank you for reaching out.');
      await page.getByRole('button', { name: /send/i }).click();

      // Wait for send to complete
      await page.waitForFunction(() => {
        const drawer = document.querySelector('[data-testid="communications-drawer"]');
        // Drawer should close after successful send
        return !drawer || drawer.getAttribute('data-open') !== 'true';
      }, { timeout: 10000 });

      // Verify work item is no longer in the queue (resolved)
      await page.waitForTimeout(1000); // Allow queue to refresh

      const resolvedItem = page.locator(`[data-testid="queue-item"][data-work-item-id="${workItemId}"]`);
      await expect(resolvedItem).not.toBeVisible();
    });
  });
});

test.describe('Drawer Behavior', () => {
  test('drawer closes when clicking backdrop', async ({ page }) => {
    await page.goto('/work');
    await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

    // Open drawer
    await page.locator('[data-testid="queue-item"]').first().click();
    await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });
    await page.getByRole('button', { name: /view comms/i }).click();
    await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

    // Click backdrop (the dark overlay)
    await page.locator('.bg-black\\/30').click({ force: true });

    // Drawer should close
    const drawer = page.locator('[data-testid="communications-drawer"]');
    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });

  test('drawer closes when clicking X button', async ({ page }) => {
    await page.goto('/work');
    await page.waitForSelector('[data-testid="queue-item-list"]', { timeout: 10000 });

    // Open drawer
    await page.locator('[data-testid="queue-item"]').first().click();
    await page.waitForSelector('[data-testid="work-item-preview"]', { timeout: 5000 });
    await page.getByRole('button', { name: /view comms/i }).click();
    await page.waitForSelector('[data-testid="communications-drawer"]', { timeout: 5000 });

    // Click close button in drawer header
    await page.locator('[data-testid="communications-drawer"] button').filter({ has: page.locator('svg') }).first().click();

    // Drawer should close
    const drawer = page.locator('[data-testid="communications-drawer"]');
    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });
});
