/**
 * Website Collector
 * Uses Playwright to crawl and extract data from company websites
 */

import { chromium, type Browser, type Page } from 'playwright';
import { BaseCollector } from './base';
import type {
  WebsiteData,
  WebsiteTeamMember,
  WebsiteBlogPost,
  WebsiteCollectorOptions,
  CollectorResult,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MAX_PAGES = 15;
const DEFAULT_CRAWL_DEPTH = 2;
const PAGE_TIMEOUT = 30000;

// Common paths to check
const PATHS_TO_CHECK = [
  '/',
  '/about',
  '/about-us',
  '/team',
  '/our-team',
  '/leadership',
  '/services',
  '/products',
  '/solutions',
  '/contact',
  '/contact-us',
  '/blog',
  '/news',
  '/testimonials',
  '/customers',
  '/clients',
  '/careers',
];

// Social link patterns
const SOCIAL_PATTERNS = {
  linkedin: /linkedin\.com\/company\//i,
  facebook: /facebook\.com\//i,
  twitter: /twitter\.com\/|x\.com\//i,
  instagram: /instagram\.com\//i,
};

// ============================================
// WEBSITE COLLECTOR
// ============================================

export class WebsiteCollector extends BaseCollector<WebsiteData, WebsiteCollectorOptions> {
  readonly sourceType = 'website' as const;
  readonly displayName = 'Website Crawler';

  private browser: Browser | null = null;

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: WebsiteCollectorOptions = {}
  ): Promise<CollectorResult<WebsiteData>> {
    const startTime = Date.now();

    if (!domain) {
      return this.errorResult('No domain provided', Date.now() - startTime);
    }

    try {
      const data = await this.withRetry(async () => {
        return await this.crawlWebsite(domain, options);
      }, options.maxRetries || 1);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[WebsiteCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Calculate quality score based on data completeness
   */
  calculateQualityScore(data: WebsiteData): number {
    if (!data) return 0;

    let score = 0;
    const weights = {
      title: 5,
      description: 5,
      companyName: 10,
      aboutText: 15,
      services: 10,
      products: 10,
      teamMembers: 15,
      email: 5,
      phone: 5,
      socialLinks: 10,
      testimonials: 5,
      blogPosts: 5,
    };

    if (data.title) score += weights.title;
    if (data.description) score += weights.description;
    if (data.companyName) score += weights.companyName;
    if (data.aboutText && data.aboutText.length > 100) score += weights.aboutText;
    if (data.services.length > 0) score += weights.services;
    if (data.products.length > 0) score += weights.products;
    if (data.teamMembers.length > 0) score += weights.teamMembers;
    if (data.email) score += weights.email;
    if (data.phone) score += weights.phone;
    if (Object.keys(data.socialLinks).length > 0) score += weights.socialLinks;
    if (data.testimonials.length > 0) score += weights.testimonials;
    if (data.blogPosts.length > 0) score += weights.blogPosts;

    return Math.min(100, score);
  }

  /**
   * Main crawl logic
   */
  private async crawlWebsite(
    domain: string,
    options: WebsiteCollectorOptions
  ): Promise<WebsiteData> {
    const maxPages = options.maxPages || DEFAULT_MAX_PAGES;
    const baseUrl = this.buildUrl(domain);

    this.browser = await chromium.launch({
      headless: true,
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const crawledUrls: string[] = [];
    const data: WebsiteData = {
      url: baseUrl,
      title: null,
      description: null,
      companyName: null,
      tagline: null,
      aboutText: null,
      services: [],
      products: [],
      teamMembers: [],
      email: null,
      phone: null,
      address: null,
      socialLinks: {},
      blogPosts: [],
      newsItems: [],
      testimonials: [],
      clientLogos: [],
      technologies: [],
      pageCount: 0,
      crawledUrls: [],
      crawledAt: new Date().toISOString(),
      crawlDurationMs: 0,
    };

    const startCrawl = Date.now();

    // Crawl key pages
    for (const path of PATHS_TO_CHECK) {
      if (crawledUrls.length >= maxPages) break;

      const url = `${baseUrl}${path}`;
      if (crawledUrls.includes(url)) continue;

      try {
        const page = await context.newPage();
        page.setDefaultTimeout(PAGE_TIMEOUT);

        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

        if (response && response.ok()) {
          crawledUrls.push(url);

          // Extract data from this page
          await this.extractPageData(page, path, data);
        }

        await page.close();
      } catch (error) {
        // Page might not exist, continue
        console.debug(`[WebsiteCollector] Could not fetch ${url}`);
      }
    }

    await context.close();

    data.pageCount = crawledUrls.length;
    data.crawledUrls = crawledUrls;
    data.crawlDurationMs = Date.now() - startCrawl;

    return data;
  }

  /**
   * Extract data from a single page
   */
  private async extractPageData(
    page: Page,
    path: string,
    data: WebsiteData
  ): Promise<void> {
    // Homepage extractions
    if (path === '/') {
      data.title = await this.getTextContent(page, 'title');
      data.description = await this.getMetaContent(page, 'description');
      data.companyName = await this.extractCompanyName(page);
      data.tagline = await this.extractTagline(page);
    }

    // About page
    if (path.includes('about')) {
      const aboutText = await this.extractAboutText(page);
      if (aboutText && aboutText.length > (data.aboutText?.length || 0)) {
        data.aboutText = aboutText;
      }
    }

    // Team page
    if (path.includes('team') || path.includes('leadership')) {
      const team = await this.extractTeamMembers(page);
      if (team.length > data.teamMembers.length) {
        data.teamMembers = team;
      }
    }

    // Services page
    if (path.includes('services') || path.includes('solutions') || path.includes('products')) {
      const services = await this.extractListItems(page, ['services', 'offerings', 'solutions']);
      data.services = [...new Set([...data.services, ...services])];

      const products = await this.extractListItems(page, ['products', 'features']);
      data.products = [...new Set([...data.products, ...products])];
    }

    // Contact page
    if (path.includes('contact')) {
      const contactInfo = await this.extractContactInfo(page);
      if (!data.email && contactInfo.email) data.email = contactInfo.email;
      if (!data.phone && contactInfo.phone) data.phone = contactInfo.phone;
      if (!data.address && contactInfo.address) data.address = contactInfo.address;
    }

    // Blog page
    if (path.includes('blog') || path.includes('news')) {
      const posts = await this.extractBlogPosts(page);
      data.blogPosts = [...data.blogPosts, ...posts].slice(0, 10);
    }

    // Testimonials
    if (path.includes('testimonial') || path.includes('customer') || path.includes('client')) {
      const testimonials = await this.extractTestimonials(page);
      data.testimonials = [...new Set([...data.testimonials, ...testimonials])].slice(0, 10);
    }

    // Always extract social links from any page
    const socialLinks = await this.extractSocialLinks(page);
    data.socialLinks = { ...data.socialLinks, ...socialLinks };

    // Extract contact info from footer (available on all pages)
    if (!data.email || !data.phone) {
      const footerContact = await this.extractFooterContact(page);
      if (!data.email && footerContact.email) data.email = footerContact.email;
      if (!data.phone && footerContact.phone) data.phone = footerContact.phone;
    }
  }

  // ============================================
  // EXTRACTION HELPERS
  // ============================================

  private async getTextContent(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        return this.cleanText(text);
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async getMetaContent(page: Page, name: string): Promise<string | null> {
    try {
      const content = await page.$eval(
        `meta[name="${name}"], meta[property="og:${name}"]`,
        (el) => el.getAttribute('content')
      );
      return this.cleanText(content);
    } catch {
      return null;
    }
  }

  private async extractCompanyName(page: Page): Promise<string | null> {
    // Try various selectors
    const selectors = [
      'meta[property="og:site_name"]',
      '.logo-text',
      '.site-title',
      'header h1',
      '[class*="logo"] a',
      '[class*="brand"]',
    ];

    for (const selector of selectors) {
      try {
        const text = await page.$eval(selector, (el) => {
          if (el.tagName === 'META') return el.getAttribute('content');
          return el.textContent?.trim();
        });
        if (text && text.length > 0 && text.length < 100) {
          return text;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async extractTagline(page: Page): Promise<string | null> {
    const selectors = [
      '.tagline',
      '.slogan',
      '.hero-subtitle',
      '.hero p',
      '[class*="hero"] h2',
      'header h2',
    ];

    for (const selector of selectors) {
      try {
        const text = await page.$eval(selector, (el) => el.textContent?.trim());
        if (text && text.length > 10 && text.length < 200) {
          return text;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async extractAboutText(page: Page): Promise<string | null> {
    const selectors = [
      'main p',
      '.about-content p',
      '[class*="about"] p',
      'article p',
      '.content p',
    ];

    try {
      const paragraphs = await page.$$eval(selectors.join(', '), (elements) =>
        elements
          .map((el) => el.textContent?.trim())
          .filter((t) => t && t.length > 50)
          .slice(0, 5)
      );

      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n');
      }
    } catch {
      // Ignore
    }

    return null;
  }

  private async extractTeamMembers(page: Page): Promise<WebsiteTeamMember[]> {
    const members: WebsiteTeamMember[] = [];

    const selectors = [
      '.team-member',
      '.member',
      '[class*="team"] [class*="card"]',
      '[class*="leadership"] [class*="item"]',
      '.person',
    ];

    for (const selector of selectors) {
      try {
        const items = await page.$$(selector);
        if (items.length === 0) continue;

        for (const item of items.slice(0, 20)) {
          const name = await item.$eval(
            'h2, h3, h4, [class*="name"]',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          const title = await item.$eval(
            '[class*="title"], [class*="position"], [class*="role"], p',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          const linkedinUrl = await item.$eval(
            'a[href*="linkedin"]',
            (el) => el.getAttribute('href')
          ).catch(() => undefined);

          if (name) {
            members.push({
              name,
              title: title || null,
              linkedinUrl: linkedinUrl ?? undefined,
            });
          }
        }

        if (members.length > 0) break;
      } catch {
        continue;
      }
    }

    return members;
  }

  private async extractListItems(page: Page, keywords: string[]): Promise<string[]> {
    const items: string[] = [];

    try {
      // Find sections containing keywords
      for (const keyword of keywords) {
        const sectionItems = await page.$$eval(
          `[class*="${keyword}"] li, [id*="${keyword}"] li, section:has(h2:text-matches("${keyword}", "i")) li`,
          (elements) =>
            elements
              .map((el) => el.textContent?.trim())
              .filter((t) => t && t.length > 3 && t.length < 200) as string[]
        );
        items.push(...sectionItems);
      }
    } catch {
      // Ignore
    }

    return [...new Set(items)].slice(0, 20);
  }

  private async extractContactInfo(page: Page): Promise<{
    email: string | null;
    phone: string | null;
    address: string | null;
  }> {
    const result = { email: null as string | null, phone: null as string | null, address: null as string | null };

    try {
      // Email
      const emailLink = await page.$eval('a[href^="mailto:"]', (el) =>
        el.getAttribute('href')?.replace('mailto:', '')
      );
      if (emailLink) result.email = emailLink;

      // Phone
      const phoneLink = await page.$eval('a[href^="tel:"]', (el) =>
        el.getAttribute('href')?.replace('tel:', '')
      );
      if (phoneLink) result.phone = phoneLink;

      // Address
      const address = await page.$eval(
        'address, [class*="address"], [itemtype*="PostalAddress"]',
        (el) => el.textContent?.trim()
      );
      if (address) result.address = this.truncate(address, 300);
    } catch {
      // Ignore
    }

    return result;
  }

  private async extractFooterContact(page: Page): Promise<{
    email: string | null;
    phone: string | null;
  }> {
    const result = { email: null as string | null, phone: null as string | null };

    try {
      const footerText = await page.$eval('footer', (el) => el.textContent || '');

      const emails = this.extractEmails(footerText);
      if (emails.length > 0) result.email = emails[0];

      const phones = this.extractPhones(footerText);
      if (phones.length > 0) result.phone = phones[0];
    } catch {
      // Ignore
    }

    return result;
  }

  private async extractSocialLinks(page: Page): Promise<Record<string, string>> {
    const links: Record<string, string> = {};

    try {
      const allLinks = await page.$$eval('a[href]', (elements) =>
        elements.map((el) => el.getAttribute('href')).filter(Boolean) as string[]
      );

      for (const link of allLinks) {
        for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
          if (pattern.test(link) && !links[platform]) {
            links[platform] = link;
          }
        }
      }
    } catch {
      // Ignore
    }

    return links;
  }

  private async extractBlogPosts(page: Page): Promise<WebsiteBlogPost[]> {
    const posts: WebsiteBlogPost[] = [];

    const selectors = [
      'article',
      '.post',
      '.blog-post',
      '[class*="post-item"]',
      '[class*="blog"] [class*="card"]',
    ];

    for (const selector of selectors) {
      try {
        const items = await page.$$(selector);
        if (items.length === 0) continue;

        for (const item of items.slice(0, 10)) {
          const title = await item.$eval('h2, h3, [class*="title"]', (el) =>
            el.textContent?.trim()
          ).catch(() => null);

          const url = await item.$eval('a', (el) => el.getAttribute('href')).catch(
            () => ''
          );

          const date = await item.$eval(
            'time, [class*="date"]',
            (el) => el.getAttribute('datetime') || el.textContent?.trim()
          ).catch(() => null);

          const excerpt = await item.$eval(
            'p, [class*="excerpt"], [class*="summary"]',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          if (title) {
            posts.push({
              title,
              url: url || '',
              date: this.parseDate(date),
              excerpt: this.truncate(excerpt, 200),
            });
          }
        }

        if (posts.length > 0) break;
      } catch {
        continue;
      }
    }

    return posts;
  }

  private async extractTestimonials(page: Page): Promise<string[]> {
    const testimonials: string[] = [];

    const selectors = [
      '.testimonial',
      '[class*="testimonial"]',
      '.review',
      'blockquote',
      '[class*="quote"]',
    ];

    try {
      for (const selector of selectors) {
        const items = await page.$$eval(selector, (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 50 && t.length < 500) as string[]
        );
        testimonials.push(...items);
        if (testimonials.length > 0) break;
      }
    } catch {
      // Ignore
    }

    return [...new Set(testimonials)].slice(0, 10);
  }

  /**
   * Close browser instance
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton instance
export const websiteCollector = new WebsiteCollector();
