/**
 * LinkedIn Company Collector
 * Scrapes public LinkedIn company pages for follower counts and company info
 */

import { chromium, type Browser, type Page } from 'playwright';
import { BaseCollector } from './base';
import type { CollectorOptions, CollectorResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface LinkedInCompanyData {
  pageUrl: string;
  companyName: string | null;
  tagline: string | null;
  industry: string | null;
  companySize: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  followers: number | null;
  employeesOnLinkedIn: number | null;
  specialties: string[];
  about: string | null;
  websiteUrl: string | null;
  crawledAt: string;
}

// ============================================
// LINKEDIN COMPANY COLLECTOR
// ============================================

export class LinkedInCompanyCollector extends BaseCollector<LinkedInCompanyData, CollectorOptions> {
  readonly sourceType = 'linkedin_company' as const;
  readonly displayName = 'LinkedIn Company';

  private browser: Browser | null = null;

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<LinkedInCompanyData>> {
    const startTime = Date.now();

    // Use known URL if provided, otherwise try to find it
    let linkedInUrl = options.knownUrl || null;

    if (!linkedInUrl) {
      linkedInUrl = await this.findLinkedInPage(companyName, domain);
    } else {
      console.log('[LinkedInCompanyCollector] Using known URL:', linkedInUrl);
    }

    if (!linkedInUrl) {
      return this.errorResult(
        'Could not find LinkedIn company page',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        return await this.scrapeLinkedInPage(linkedInUrl);
      }, options.maxRetries || 1);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[LinkedInCompanyCollector] Error:', error);
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
  calculateQualityScore(data: LinkedInCompanyData): number {
    if (!data) return 0;

    let score = 0;

    if (data.companyName) score += 15;
    if (data.tagline) score += 5;
    if (data.industry) score += 10;
    if (data.companySize) score += 10;
    if (data.headquarters) score += 10;
    if (data.foundedYear) score += 5;
    if (data.followers && data.followers > 0) score += 20;
    if (data.employeesOnLinkedIn && data.employeesOnLinkedIn > 0) score += 10;
    if (data.specialties.length > 0) score += 5;
    if (data.about) score += 10;

    return Math.min(100, score);
  }

  /**
   * Find LinkedIn company page URL
   */
  private async findLinkedInPage(
    companyName: string,
    domain: string | null
  ): Promise<string | null> {
    // Build potential LinkedIn URLs
    if (domain) {
      const normalizedDomain = this.normalizeDomain(domain).replace(/\./g, '');
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const directUrls = [
        `https://www.linkedin.com/company/${normalizedDomain}`,
        `https://www.linkedin.com/company/${companySlug}`,
      ];

      for (const url of directUrls) {
        if (await this.checkLinkedInPageExists(url)) {
          return url;
        }
      }
    }

    // Search via Google
    try {
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      const searchQuery = encodeURIComponent(
        domain ? `${companyName} ${domain} site:linkedin.com/company` : `${companyName} site:linkedin.com/company`
      );

      await page.goto(
        `https://www.google.com/search?q=${searchQuery}`,
        { waitUntil: 'domcontentloaded', timeout: 15000 }
      );

      // Find LinkedIn URLs in results
      const linkedInUrl = await page.$eval(
        'a[href*="linkedin.com/company"]',
        (el) => el.getAttribute('href')
      ).catch(() => null);

      await context.close();

      if (linkedInUrl && linkedInUrl.includes('linkedin.com/company')) {
        // Extract actual LinkedIn URL from Google redirect if needed
        const match = linkedInUrl.match(/linkedin\.com\/company\/[a-zA-Z0-9_-]+/);
        if (match) {
          return `https://www.${match[0]}`;
        }
      }
    } catch (error) {
      console.debug('[LinkedInCompanyCollector] Search failed:', error);
    }

    return null;
  }

  /**
   * Check if LinkedIn page exists
   */
  private async checkLinkedInPageExists(url: string): Promise<boolean> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({ headless: true });
      }
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const exists = response?.ok() ?? false;

      // Check if we're on a valid company page (not a 404 or login redirect)
      const pageTitle = await page.title();
      const isValidCompanyPage = exists &&
        !pageTitle.includes('Page not found') &&
        !pageTitle.includes('Log In') &&
        !pageTitle.includes('Sign In');

      await context.close();
      return isValidCompanyPage;
    } catch {
      return false;
    }
  }

  /**
   * Scrape LinkedIn company page data
   */
  private async scrapeLinkedInPage(pageUrl: string): Promise<LinkedInCompanyData> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    const page = await context.newPage();

    // Navigate to the company page
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for content to load
    await this.sleep(2000);

    const data: LinkedInCompanyData = {
      pageUrl,
      companyName: null,
      tagline: null,
      industry: null,
      companySize: null,
      headquarters: null,
      foundedYear: null,
      followers: null,
      employeesOnLinkedIn: null,
      specialties: [],
      about: null,
      websiteUrl: null,
      crawledAt: new Date().toISOString(),
    };

    // Extract company name
    data.companyName = await this.extractText(page, 'h1');

    // Extract tagline/headline
    data.tagline = await this.extractText(page, '.org-top-card-summary__tagline, .top-card-layout__headline');

    // Extract followers count
    // LinkedIn shows followers in various formats: "X followers", "X,XXX followers"
    const followersText = await this.extractText(page,
      '[data-test-id="about-us__followers"], .org-top-card-summary-info-list__info-item, .top-card-layout__first-subline'
    );

    if (followersText) {
      const followersMatch = followersText.match(/([\d,]+)\s*followers?/i);
      if (followersMatch) {
        data.followers = parseInt(followersMatch[1].replace(/,/g, ''), 10);
      }
    }

    // Also try to get follower count from page content
    if (!data.followers) {
      const pageContent = await page.content();
      const followerPatterns = [
        /([\d,]+)\s*followers?/i,
        /followers?[:\s]*([\d,]+)/i,
      ];

      for (const pattern of followerPatterns) {
        const match = pageContent.match(pattern);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ''), 10);
          if (count > 0) {
            data.followers = count;
            break;
          }
        }
      }
    }

    // Extract employees on LinkedIn
    const employeesText = await this.extractText(page,
      '[data-test-id="about-us__size"], .org-top-card-summary-info-list__info-item'
    );

    if (employeesText) {
      const employeesMatch = employeesText.match(/([\d,]+)\s*(?:employees?|on LinkedIn)/i);
      if (employeesMatch) {
        data.employeesOnLinkedIn = parseInt(employeesMatch[1].replace(/,/g, ''), 10);
      }
    }

    // Navigate to About page for more details
    try {
      const aboutUrl = pageUrl.endsWith('/') ? `${pageUrl}about/` : `${pageUrl}/about/`;
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.sleep(1000);

      // Extract industry
      data.industry = await this.extractText(page,
        '[data-test-id="about-us__industry"] dd, .org-page-details__definition-text'
      );

      // Extract company size
      data.companySize = await this.extractText(page,
        '[data-test-id="about-us__size"] dd, .org-page-details__definition-text'
      );

      // Extract headquarters
      data.headquarters = await this.extractText(page,
        '[data-test-id="about-us__headquarters"] dd, .org-page-details__definition-text'
      );

      // Extract founded year
      const foundedText = await this.extractText(page,
        '[data-test-id="about-us__foundedOn"] dd, .org-page-details__definition-text'
      );
      if (foundedText) {
        const yearMatch = foundedText.match(/\d{4}/);
        if (yearMatch) {
          data.foundedYear = parseInt(yearMatch[0], 10);
        }
      }

      // Extract about text
      data.about = await this.extractText(page,
        '.org-page-details__paragraph, .org-about-us-organization-description__text, [data-test-id="about-us__description"]'
      );

      // Extract website
      const websiteLink = await page.$eval(
        'a[data-test-id="about-us__website"], a[href^="http"]:not([href*="linkedin.com"])',
        (el) => el.getAttribute('href')
      ).catch(() => null);

      if (websiteLink && !websiteLink.includes('linkedin.com')) {
        data.websiteUrl = websiteLink;
      }

      // Extract specialties
      const specialtiesText = await this.extractText(page,
        '[data-test-id="about-us__specialties"] dd, .org-page-details__definition-text'
      );
      if (specialtiesText) {
        data.specialties = specialtiesText.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }

    } catch (error) {
      console.debug('[LinkedInCompanyCollector] About page fetch failed:', error);
    }

    await context.close();

    return data;
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
export const linkedinCompanyCollector = new LinkedInCompanyCollector();
