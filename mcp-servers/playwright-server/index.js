import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Browser instance (reused across calls)
let browser = null;
let context = null;
let page = null;

// Base URL for your dev server
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

// Test user email (optional - if not set, uses first active user)
const AUTH_EMAIL = process.env.AUTH_EMAIL || '';

// Cookie storage path
const COOKIES_PATH = path.join(os.homedir(), '.claude', 'playwright-cookies.json');

/**
 * Save cookies to file for persistence
 */
async function saveCookies() {
  if (context) {
    const cookies = await context.cookies();
    const dir = path.dirname(COOKIES_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  }
}

/**
 * Load cookies from file
 */
async function loadCookies() {
  if (context && fs.existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      if (cookies.length > 0) {
        await context.addCookies(cookies);
        return true;
      }
    } catch (e) {
      // Invalid cookies file, ignore
      return false;
    }
  }
  return false;
}

/**
 * Check if current page is the login page
 */
async function isLoginPage(p) {
  const url = p.url();
  if (url.includes('/login') || url.includes('/signin')) {
    return true;
  }

  // Check for Microsoft OAuth redirect
  if (url.includes('login.microsoftonline.com') || url.includes('login.live.com')) {
    return true;
  }

  // Check for OAuth button (our login page has "Sign in with Microsoft")
  try {
    const hasOAuthButton = await p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b =>
        b.textContent?.toLowerCase().includes('microsoft') ||
        b.textContent?.toLowerCase().includes('sign in')
      );
    });
    if (hasOAuthButton && url.includes('/login')) {
      return true;
    }
  } catch {
    // Ignore evaluation errors
  }

  return false;
}

/**
 * Perform login via development auth bypass API
 * Uses POST endpoint to get cookies, then manually adds them to context
 */
async function performDevAuthBypass(p, targetUrl, email) {
  console.error('[Playwright] Using dev auth bypass...');

  try {
    const authEmail = email || AUTH_EMAIL;
    console.error('[Playwright] Authenticating as:', authEmail || '(first active user)');

    // Use native fetch to get cookies from the POST endpoint
    // This avoids browser redirect issues
    const postUrl = `${BASE_URL}/api/dev/auth`;
    console.error('[Playwright] Fetching auth from:', postUrl);

    const response = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail || undefined }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Playwright] Auth request failed:', response.status, errorText);
      return false;
    }

    // Extract Set-Cookie headers
    const setCookieHeaders = response.headers.getSetCookie ?
      response.headers.getSetCookie() :
      [response.headers.get('set-cookie')].filter(Boolean);

    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      console.error('[Playwright] No cookies in auth response');
      return false;
    }

    console.error('[Playwright] Got', setCookieHeaders.length, 'Set-Cookie headers');

    // Parse and add cookies to browser context
    const cookies = [];
    for (const cookieStr of setCookieHeaders) {
      const parsed = parseCookie(cookieStr, BASE_URL);
      if (parsed) {
        cookies.push(parsed);
      }
    }

    if (cookies.length > 0) {
      await context.addCookies(cookies);
      console.error('[Playwright] Added', cookies.length, 'cookies to context');
    }

    // Navigate to target URL
    const finalUrl = targetUrl || '/work';
    await p.goto(`${BASE_URL}${finalUrl}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Check if we ended up on a valid page (not login)
    const currentUrl = p.url();
    const stillOnAuth = currentUrl.includes('/login') ||
                        currentUrl.includes('login.microsoftonline.com');

    if (stillOnAuth) {
      console.error('[Playwright] Auth failed, still on:', currentUrl);
      return false;
    }

    // Verify and save cookies
    const allCookies = await context.cookies();
    const authCookies = allCookies.filter(c => c.name.includes('auth'));
    console.error('[Playwright] Auth successful, got', authCookies.length, 'auth cookies');

    await saveCookies();
    return true;
  } catch (error) {
    console.error('[Playwright] Dev auth bypass failed:', error.message);
    return false;
  }
}

/**
 * Parse a Set-Cookie header into a Playwright cookie object
 */
function parseCookie(cookieStr, baseUrl) {
  try {
    const parts = cookieStr.split(';').map(p => p.trim());
    const [nameValue, ...attributes] = parts;
    const [name, ...valueParts] = nameValue.split('=');
    const value = valueParts.join('=');

    const url = new URL(baseUrl);

    const cookie = {
      name,
      value,
      domain: url.hostname,
      path: '/',
    };

    for (const attr of attributes) {
      const [key, val] = attr.split('=');
      const lowerKey = key.toLowerCase();

      if (lowerKey === 'path') {
        cookie.path = val || '/';
      } else if (lowerKey === 'domain') {
        cookie.domain = val;
      } else if (lowerKey === 'secure') {
        cookie.secure = true;
      } else if (lowerKey === 'httponly') {
        cookie.httpOnly = true;
      } else if (lowerKey === 'samesite') {
        cookie.sameSite = val;
      } else if (lowerKey === 'max-age') {
        cookie.expires = Date.now() / 1000 + parseInt(val, 10);
      }
    }

    return cookie;
  } catch {
    return null;
  }
}

/**
 * Ensure browser is launched
 */
async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true, // Set to false if you want to see the browser
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();

    // Try to load saved cookies
    await loadCookies();
  }
  return page;
}

/**
 * Navigate to URL, handling auth if needed
 */
async function navigateWithAuth(p, url) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const targetPath = url.startsWith('http') ? new URL(url).pathname : url;

  await p.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Check if we got redirected to login
  if (await isLoginPage(p)) {
    // Use dev auth bypass with the target URL as redirect
    // Pass AUTH_EMAIL to ensure consistent user for auto-login
    const loginSuccess = await performDevAuthBypass(p, targetPath, AUTH_EMAIL);
    if (!loginSuccess) {
      // If auth failed, try navigating to target anyway
      await p.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    }
    // If successful, performDevAuthBypass already redirected us to the target
  }

  return p.url();
}

/**
 * Take a screenshot and return as base64
 */
async function takeScreenshot(url, options = {}) {
  const p = await ensureBrowser();

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  // Navigate if URL changed or forced
  if (p.url() !== fullUrl || options.forceNavigate) {
    await navigateWithAuth(p, url);
  }

  // Wait for any additional selector if specified
  if (options.waitFor) {
    await p.waitForSelector(options.waitFor, { timeout: 10000 });
  }

  // Optional: wait for animations to settle
  await p.waitForTimeout(options.delay || 500);

  // Take screenshot
  const screenshot = await p.screenshot({
    fullPage: options.fullPage || false,
    type: 'png',
  });

  return {
    base64: screenshot.toString('base64'),
    url: p.url(),
    title: await p.title(),
    viewport: { width: 1280, height: 800 },
  };
}

/**
 * Click an element
 */
async function clickElement(selector, options = {}) {
  const p = await ensureBrowser();

  // Navigate first if URL provided
  if (options.url) {
    await navigateWithAuth(p, options.url);
  }

  // Wait for element
  await p.waitForSelector(selector, { timeout: 10000 });

  // Click
  await p.click(selector);

  // Wait for navigation or network if expected
  if (options.waitForNavigation) {
    await p.waitForLoadState('networkidle');
  } else {
    await p.waitForTimeout(500);
  }

  // Return screenshot after click
  const screenshot = await p.screenshot({ type: 'png' });

  return {
    success: true,
    base64: screenshot.toString('base64'),
    url: p.url(),
  };
}

/**
 * Fill a form field
 */
async function fillField(selector, value, options = {}) {
  const p = await ensureBrowser();

  // Navigate first if URL provided
  if (options.url) {
    await navigateWithAuth(p, options.url);
  }

  // Wait for element
  await p.waitForSelector(selector, { timeout: 10000 });

  // Clear and fill
  await p.fill(selector, value);

  await p.waitForTimeout(300);

  return {
    success: true,
    selector,
    value,
  };
}

/**
 * Get page content/state
 */
async function getPageInfo(url) {
  const p = await ensureBrowser();

  if (url) {
    await navigateWithAuth(p, url);
  }

  // Get useful info about the page
  const info = await p.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      // Get all interactive elements
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim().slice(0, 50),
        selector: b.id ? `#${b.id}` : b.className ? `.${b.className.split(' ')[0]}` : 'button',
        disabled: b.disabled,
      })).slice(0, 20),
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
        type: i.type || i.tagName.toLowerCase(),
        name: i.name,
        id: i.id,
        placeholder: i.placeholder,
        selector: i.id ? `#${i.id}` : i.name ? `[name="${i.name}"]` : null,
      })).filter(i => i.selector).slice(0, 20),
      // Get any error messages
      errors: Array.from(document.querySelectorAll('[role="alert"], .error, .text-red-500, .text-red-600')).map(e =>
        e.textContent?.trim().slice(0, 100)
      ).filter(Boolean),
      // Get headings for structure
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
        level: h.tagName,
        text: h.textContent?.trim().slice(0, 50),
      })).slice(0, 10),
    };
  });

  return info;
}

/**
 * Evaluate custom JavaScript
 */
async function evaluate(script, url) {
  const p = await ensureBrowser();

  if (url) {
    await navigateWithAuth(p, url);
  }

  const result = await p.evaluate(script);
  return result;
}

/**
 * Manual login via dev auth bypass
 * Forces re-authentication even if already logged in
 */
async function login(email) {
  const p = await ensureBrowser();

  // Clear existing cookies first
  await context.clearCookies();

  // Set the email for this login
  const loginEmail = email || AUTH_EMAIL;

  console.error('[Playwright] Forcing dev auth login for:', loginEmail || '(first active user)');

  // Navigate to trigger auth
  await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // Use the dev auth bypass with the specified email
  const success = await performDevAuthBypass(p, '/work', loginEmail);

  if (!success) {
    return {
      success: false,
      message: 'Dev auth bypass failed - is the dev server running?',
      url: p.url()
    };
  }

  // Navigate to home page
  await p.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Check if we're logged in (not on login page)
  const stillOnLogin = await isLoginPage(p);
  if (stillOnLogin) {
    return {
      success: false,
      message: 'Login failed - still on login page',
      url: p.url()
    };
  }

  // Take screenshot of logged-in state
  const screenshot = await p.screenshot({ type: 'png' });

  return {
    success: true,
    message: 'Login successful via dev auth bypass',
    url: p.url(),
    base64: screenshot.toString('base64'),
  };
}

/**
 * Logout and clear saved cookies
 */
async function logout() {
  const p = await ensureBrowser();

  // Clear cookies
  await context.clearCookies();

  // Delete saved cookies file
  if (fs.existsSync(COOKIES_PATH)) {
    fs.unlinkSync(COOKIES_PATH);
  }

  // Navigate to login page
  await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  return { success: true, message: 'Logged out and cookies cleared' };
}

/**
 * Close browser
 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
  }
  return { success: true };
}

// Create MCP Server
const server = new Server(
  {
    name: 'playwright-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'screenshot',
        description: 'Take a screenshot of a page. Auto-logs in if needed. Returns base64 image.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL path to screenshot (e.g., "/settings" or "http://localhost:3000/settings")',
            },
            fullPage: {
              type: 'boolean',
              description: 'Capture full scrollable page (default: false)',
            },
            waitFor: {
              type: 'string',
              description: 'CSS selector to wait for before screenshot',
            },
            delay: {
              type: 'number',
              description: 'Milliseconds to wait after page load (default: 500)',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'click',
        description: 'Click an element on the page. Auto-logs in if needed. Returns screenshot after click.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of element to click',
            },
            url: {
              type: 'string',
              description: 'URL to navigate to first (optional)',
            },
            waitForNavigation: {
              type: 'boolean',
              description: 'Wait for page navigation after click (default: false)',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'fill',
        description: 'Fill a form field with a value. Auto-logs in if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of input/textarea',
            },
            value: {
              type: 'string',
              description: 'Value to fill',
            },
            url: {
              type: 'string',
              description: 'URL to navigate to first (optional)',
            },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'get_page_info',
        description: 'Get information about the current page: buttons, inputs, errors, headings. Auto-logs in if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to analyze (optional, uses current page if not provided)',
            },
          },
        },
      },
      {
        name: 'evaluate',
        description: 'Run JavaScript in the browser and return the result. Auto-logs in if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code to evaluate',
            },
            url: {
              type: 'string',
              description: 'URL to navigate to first (optional)',
            },
          },
          required: ['script'],
        },
      },
      {
        name: 'login',
        description: 'Manually login to the application. Use if auto-login fails or to switch users.',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email to login with (optional, uses default test user)',
            },
            password: {
              type: 'string',
              description: 'Password to login with (optional, uses default test user)',
            },
          },
        },
      },
      {
        name: 'logout',
        description: 'Logout and clear saved session cookies.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'close_browser',
        description: 'Close the browser instance. Use when done with testing.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'screenshot':
        result = await takeScreenshot(args.url, {
          fullPage: args.fullPage,
          waitFor: args.waitFor,
          delay: args.delay,
        });
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: `Screenshot of ${result.url}\nTitle: ${result.title}\nViewport: ${result.viewport.width}x${result.viewport.height}`,
            },
          ],
        };

      case 'click':
        result = await clickElement(args.selector, {
          url: args.url,
          waitForNavigation: args.waitForNavigation,
        });
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: `Clicked "${args.selector}"\nCurrent URL: ${result.url}`,
            },
          ],
        };

      case 'fill':
        result = await fillField(args.selector, args.value, {
          url: args.url,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Filled "${args.selector}" with "${args.value}"`,
            },
          ],
        };

      case 'get_page_info':
        result = await getPageInfo(args.url);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      case 'evaluate':
        result = await evaluate(args.script, args.url);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      case 'login':
        result = await login(args.email);
        if (result.base64) {
          return {
            content: [
              {
                type: 'image',
                data: result.base64,
                mimeType: 'image/png',
              },
              {
                type: 'text',
                text: `${result.message}\nURL: ${result.url}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `${result.message}\nURL: ${result.url}`,
            },
          ],
        };

      case 'logout':
        result = await logout();
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };

      case 'close_browser':
        result = await closeBrowser();
        return {
          content: [
            {
              type: 'text',
              text: 'Browser closed',
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Handle shutdown
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Playwright MCP Server running (v2.0.0 with dev auth bypass)');
}

main().catch(console.error);
