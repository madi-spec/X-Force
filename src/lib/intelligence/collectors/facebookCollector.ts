/**
 * Facebook Collector
 * Uses Playwright to scrape public Facebook business pages
 */

import { chromium, type Browser, type Page } from 'playwright';
import { BaseCollector } from './base';
import type {
  FacebookData,
  FacebookPost,
  CollectorOptions,
  CollectorResult,
} from '../types';

// ============================================
// FACEBOOK COLLECTOR
// ============================================

export class FacebookCollector extends BaseCollector<FacebookData, CollectorOptions> {
  readonly sourceType = 'facebook' as const;
  readonly displayName = 'Facebook Page';

  private browser: Browser | null = null;

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<FacebookData>> {
    const startTime = Date.now();

    // Try to find Facebook page URL
    const facebookUrl = await this.findFacebookPage(companyName, domain);

    if (!facebookUrl) {
      return this.errorResult(
        'Could not find Facebook page for company',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        return await this.scrapeFacebookPage(facebookUrl);
      }, options.maxRetries || 1);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[FacebookCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: FacebookData): number {
    if (!data) return 0;

    let score = 0;

    if (data.pageName) score += 15;
    if (data.category) score += 10;
    if (data.description) score += 15;
    if (data.likes && data.likes > 0) score += 10;
    if (data.followers && data.followers > 0) score += 10;
    if (data.website) score += 5;
    if (data.phone) score += 5;
    if (data.address) score += 5;
    if (data.recentPosts.length > 0) score += 15;
    if (data.rating) score += 10;

    return Math.min(100, score);
  }

  /**
   * Find Facebook page URL
   */
  private async findFacebookPage(
    companyName: string,
    domain: string | null
  ): Promise<string | null> {
    // Build search URL
    const searchQuery = encodeURIComponent(
      domain ? `${companyName} ${domain}` : companyName
    );

    // Try direct URL patterns first
    if (domain) {
      const normalizedDomain = this.normalizeDomain(domain).replace(/\./g, '');
      const directUrls = [
        `https://www.facebook.com/${normalizedDomain}`,
        `https://www.facebook.com/${companyName.toLowerCase().replace(/\s+/g, '')}`,
      ];

      for (const url of directUrls) {
        if (await this.checkFacebookPageExists(url)) {
          return url;
        }
      }
    }

    // Search via Google
    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      const page = await context.newPage();

      await page.goto(
        `https://www.google.com/search?q=site:facebook.com+${searchQuery}`,
        { waitUntil: 'domcontentloaded' }
      );

      // Find Facebook URLs in results
      const fbUrl = await page.$eval(
        'a[href*="facebook.com"]',
        (el) => el.getAttribute('href')
      ).catch(() => null);

      await context.close();

      if (fbUrl && fbUrl.includes('facebook.com')) {
        // Extract actual Facebook URL from Google redirect
        const match = fbUrl.match(/facebook\.com\/[a-zA-Z0-9._-]+/);
        if (match) {
          return `https://www.${match[0]}`;
        }
      }
    } catch (error) {
      console.debug('[FacebookCollector] Search failed:', error);
    }

    return null;
  }

  /**
   * Check if Facebook page exists
   */
  private async checkFacebookPageExists(url: string): Promise<boolean> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({ headless: true });
      }
      const context = await this.browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const exists = response?.ok() ?? false;

      await context.close();
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Scrape Facebook page data
   */
  private async scrapeFacebookPage(pageUrl: string): Promise<FacebookData> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for content to load
    await this.sleep(2000);

    const data: FacebookData = {
      pageUrl,
      pageName: null,
      category: null,
      description: null,
      likes: null,
      followers: null,
      website: null,
      phone: null,
      email: null,
      address: null,
      hours: null,
      recentPosts: [],
      rating: null,
      reviewCount: null,
      crawledAt: new Date().toISOString(),
    };

    // Extract page name
    data.pageName = await this.extractText(page, 'h1, [role="main"] h1');

    // Extract category
    data.category = await this.extractText(page, '[data-pagelet="ProfileTilesCategoryInfo"], .category');

    // Extract description/about
    const aboutSection = await page.$('[data-pagelet="AboutPage"], #page_about_section');
    if (aboutSection) {
      data.description = await aboutSection.textContent().then((t) => this.truncate(t, 1000));
    }

    // Extract likes/followers (these are often in format "X likes · Y followers")
    const likesText = await this.extractText(page, '[href*="/followers"], [href*="/likes"]');
    if (likesText) {
      const likesMatch = likesText.match(/([0-9,]+)\s*(?:likes?|people like)/i);
      const followersMatch = likesText.match(/([0-9,]+)\s*followers?/i);

      if (likesMatch) {
        data.likes = parseInt(likesMatch[1].replace(/,/g, ''), 10);
      }
      if (followersMatch) {
        data.followers = parseInt(followersMatch[1].replace(/,/g, ''), 10);
      }
    }

    // Try About page for more details
    try {
      const aboutUrl = pageUrl.endsWith('/') ? `${pageUrl}about` : `${pageUrl}/about`;
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.sleep(1000);

      // Extract contact info
      const pageText = await page.content();

      const emails = this.extractEmails(pageText);
      if (emails.length > 0) data.email = emails[0];

      const phones = this.extractPhones(pageText);
      if (phones.length > 0) data.phone = phones[0];

      // Extract website
      const websiteLink = await page.$eval(
        'a[href*="l.facebook.com/l.php"], a[href^="http"]:not([href*="facebook.com"])',
        (el) => el.getAttribute('href')
      ).catch(() => null);

      if (websiteLink) {
        // Decode Facebook redirect URL
        const match = websiteLink.match(/u=([^&]+)/);
        data.website = match ? decodeURIComponent(match[1]) : websiteLink;
      }

      // Extract address
      data.address = await this.extractText(page, '[data-key="address"], .address');

      // Extract hours
      data.hours = await this.extractText(page, '[data-key="hours"], .hours');

    } catch (error) {
      console.debug('[FacebookCollector] About page fetch failed:', error);
    }

    // Go back to main page for posts
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.sleep(1000);

      // Extract recent posts
      data.recentPosts = await this.extractPosts(page);
    } catch (error) {
      console.debug('[FacebookCollector] Posts fetch failed:', error);
    }

    await context.close();

    return data;
  }

  /**
   * Extract posts from page
   */
  private async extractPosts(page: Page): Promise<FacebookPost[]> {
    const posts: FacebookPost[] = [];

    try {
      // Find post containers
      const postElements = await page.$$('[data-pagelet*="FeedUnit"], [role="article"]');

      for (const post of postElements.slice(0, 10)) {
        try {
          const content = await post.$eval(
            '[data-ad-preview="message"], .userContent, [dir="auto"]',
            (el) => el.textContent?.trim()
          ).catch(() => '');

          if (!content || content.length < 10) continue;

          const dateText = await post.$eval(
            'abbr, time, [data-utime]',
            (el) => el.getAttribute('title') || el.textContent
          ).catch(() => null);

          // Engagement metrics are often hidden or require login
          posts.push({
            content: this.truncate(content, 500) || '',
            date: this.parseDate(dateText),
            likes: null,
            comments: null,
            shares: null,
            type: 'text',
          });
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.debug('[FacebookCollector] Post extraction failed:', error);
    }

    return posts;
  }

  /**
   * Extract text from selector
   */
  private async extractText(page: Page, selector: string): Promise<string | null> {
    try {
      const text = await page.$eval(selector, (el) => el.textContent?.trim());
      return text || null;
    } catch {
      return null;
    }
  }

  /**
   * Close browser
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton
export const facebookCollector = new FacebookCollector();
