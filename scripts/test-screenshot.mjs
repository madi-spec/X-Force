import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:3000';

async function takeScreenshot() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // You'll need to update this URL with an actual company ID that has meetings
    // For now, let's take a screenshot of the companies list
    console.log('Navigating to companies page...');
    await page.goto(`${BASE_URL}/companies`, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({ type: 'png' });
    writeFileSync('screenshot-companies.png', screenshot);
    console.log('Screenshot saved to screenshot-companies.png');

    // Get page info
    const title = await page.title();
    console.log('Page title:', title);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshot();
