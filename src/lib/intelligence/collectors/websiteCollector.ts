/**
 * Website Collector
 * Uses Playwright to crawl and extract data from company websites
 */

import { chromium, type Browser, type Page } from 'playwright';
import { BaseCollector } from './base';
import type {
  WebsiteData,
  EnhancedWebsiteData,
  WebsiteTeamMember,
  WebsiteBlogPost,
  WebsiteCollectorOptions,
  CollectorResult,
  ServiceDetail,
  CaseStudy,
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
  '/jobs',
  '/locations',
  '/service-areas',
  '/pricing',
  '/case-studies',
  '/success-stories',
  '/awards',
  '/certifications',
  '/commercial',
  '/residential',
];

// Certification keywords to detect
const CERTIFICATION_KEYWORDS = [
  'qualitypro',
  'quality pro',
  'npma',
  'national pest management',
  'bbb',
  'better business bureau',
  'angi',
  'angie\'s list',
  'homeadvisor',
  'home advisor',
  'thumbtack',
  'yelp elite',
  'certified',
  'licensed',
  'insured',
  'bonded',
  'green pro',
  'greenpro',
  'eco-friendly',
  'organic pest control',
];

// Scheduling system keywords
const SCHEDULING_KEYWORDS = [
  'book online',
  'schedule online',
  'online booking',
  'book now',
  'schedule now',
  'free estimate',
  'get quote',
  'request service',
  'request appointment',
  'calendly',
  'acuity',
  'square appointments',
];

// Payment method keywords
const PAYMENT_KEYWORDS = [
  'credit card',
  'visa',
  'mastercard',
  'american express',
  'amex',
  'discover',
  'financing',
  'payment plans',
  'cash',
  'check',
  'paypal',
  'venmo',
  'zelle',
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

export class WebsiteCollector extends BaseCollector<EnhancedWebsiteData, WebsiteCollectorOptions> {
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
  ): Promise<CollectorResult<EnhancedWebsiteData>> {
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
  calculateQualityScore(data: EnhancedWebsiteData): number {
    if (!data) return 0;

    let score = 0;
    const weights = {
      title: 3,
      description: 3,
      companyName: 5,
      aboutText: 10,
      services: 8,
      products: 5,
      teamMembers: 10,
      email: 3,
      phone: 3,
      socialLinks: 5,
      testimonials: 3,
      blogPosts: 5,
      // Enhanced fields
      serviceAreas: 8,
      serviceDetails: 8,
      certifications: 5,
      awards: 3,
      caseStudies: 5,
      schedulingSystem: 3,
      employeeSizeIndicators: 5,
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
    // Enhanced fields
    if (data.serviceAreas.length > 0) score += weights.serviceAreas;
    if (data.serviceDetails.length > 0) score += weights.serviceDetails;
    if (data.certifications.length > 0) score += weights.certifications;
    if (data.awards.length > 0) score += weights.awards;
    if (data.caseStudies.length > 0) score += weights.caseStudies;
    if (data.schedulingSystem) score += weights.schedulingSystem;
    if (data.employeeSizeIndicators.teamPageCount > 0 || data.employeeSizeIndicators.careersPageExists) {
      score += weights.employeeSizeIndicators;
    }

    return Math.min(100, score);
  }

  /**
   * Main crawl logic
   */
  private async crawlWebsite(
    domain: string,
    options: WebsiteCollectorOptions
  ): Promise<EnhancedWebsiteData> {
    const maxPages = options.maxPages || DEFAULT_MAX_PAGES;
    const baseUrl = this.buildUrl(domain);

    // First, test if we can reach the site with simple fetch
    console.log(`[WebsiteCollector] Testing connectivity to ${baseUrl}...`);
    try {
      const testResponse = await fetch(baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[WebsiteCollector] Site reachable: ${testResponse.status}`);
    } catch (fetchError) {
      console.error(`[WebsiteCollector] Cannot reach site via fetch:`, fetchError);
      // Try to continue with Playwright anyway
    }

    console.log(`[WebsiteCollector] Launching Playwright browser...`);
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const crawledUrls: string[] = [];
    const data: EnhancedWebsiteData = {
      // Base WebsiteData fields
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
      // Enhanced fields
      employeeSizeIndicators: {
        teamPageCount: 0,
        careersPageExists: false,
        jobPostingsCount: 0,
        locationsCount: 0,
      },
      serviceAreas: [],
      serviceDetails: [],
      caseStudies: [],
      certifications: [],
      awards: [],
      schedulingSystem: null,
      paymentMethods: [],
      blogPostFrequency: 'none',
      lastBlogPostDate: null,
      contentTopics: [],
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
          // Extract enhanced data
          await this.extractEnhancedPageData(page, path, data);
        }

        await page.close();
      } catch (error) {
        // Page might not exist or network error, continue
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.debug(`[WebsiteCollector] Could not fetch ${url}: ${errorMsg}`);
      }
    }

    await context.close();

    data.pageCount = crawledUrls.length;
    data.crawledUrls = crawledUrls;
    data.crawlDurationMs = Date.now() - startCrawl;

    // Calculate blog post frequency
    data.blogPostFrequency = this.calculateBlogFrequency(data.blogPosts);

    return data;
  }

  /**
   * Extract data from a single page
   */
  private async extractPageData(
    page: Page,
    path: string,
    data: EnhancedWebsiteData
  ): Promise<void> {
    // Homepage extractions
    if (path === '/') {
      data.title = await this.getTextContent(page, 'title');
      data.description = await this.getMetaContent(page, 'description');
      data.companyName = await this.extractCompanyName(page);
      data.tagline = await this.extractTagline(page);

      // Also extract services from homepage (many pest control sites list services here)
      const homepageServices = await this.extractPestControlServices(page);
      data.services = [...new Set([...data.services, ...homepageServices])];
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

    // Services page - use robust pest control extraction
    if (path.includes('services') || path.includes('solutions') || path.includes('products') ||
        path.includes('pest') || path.includes('control') || path.includes('residential') ||
        path.includes('commercial')) {
      // Use the new robust extraction method
      const services = await this.extractPestControlServices(page);
      data.services = [...new Set([...data.services, ...services])];

      // Also try the old method for products
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

    // Filter to only actual services, not navigation items
    const filteredItems = items.filter(item => this.isActualService(item));
    return [...new Set(filteredItems)].slice(0, 20);
  }

  /**
   * Filter out navigation items and only include actual pest control services
   */
  private isActualService(text: string): boolean {
    const lower = text.toLowerCase().trim();

    // Items to EXCLUDE (navigation items, not services)
    const excludePatterns = [
      /^home$/i, /^about/i, /^contact/i, /^blog$/i, /^careers?$/i,
      /^login$/i, /^customer login/i, /^resource/i, /^history$/i,
      /^meet the team/i, /^our team/i, /^testimonials?$/i, /^faq$/i,
      /^privacy/i, /^terms/i, /^sitemap/i, /^green pledge/i,
      /^request/i, /^schedule/i, /^get a quote/i, /^free/i,
      /^why choose/i, /^our process/i, /^how it works/i,
      /^locations?$/i, /^areas? served/i, /^service area/i,
      /^reviews?$/i, /^gallery/i, /^photos?/i, /^videos?/i,
      /^news$/i, /^press/i, /^media$/i, /^awards?$/i,
      /^pay.*bill/i, /^payments?$/i, /^financing/i,
      /^specials?$/i, /^coupons?$/i, /^offers?$/i,
    ];

    // Reject if matches exclusion pattern
    if (excludePatterns.some(pattern => pattern.test(lower))) {
      return false;
    }

    // Items to INCLUDE (actual pest control services)
    const serviceKeywords = [
      'pest control', 'termite', 'mosquito', 'bed bug', 'rodent', 'ant',
      'roach', 'cockroach', 'spider', 'flea', 'tick', 'wildlife',
      'bee', 'wasp', 'hornet', 'fly', 'moth', 'beetle', 'cricket',
      'lawn care', 'weed control', 'fertilization', 'aeration',
      'hvac', 'heating', 'cooling', 'air conditioning', 'plumbing',
      'insulation', 'moisture control', 'crawl space', 'attic',
      'commercial', 'residential', 'fumigation', 'heat treatment',
      'extermination', 'inspection', 'prevention', 'treatment',
      'mite', 'silverfish', 'centipede', 'millipede', 'earwig',
      'stink bug', 'boxelder', 'ladybug', 'asian beetle',
      'scorpion', 'snake', 'bird', 'bat', 'squirrel', 'raccoon',
      'mole', 'vole', 'gopher', 'groundhog', 'opossum', 'skunk',
    ];

    // Accept if contains service keyword
    if (serviceKeywords.some(keyword => lower.includes(keyword))) {
      return true;
    }

    // Reject if too short or too long
    if (lower.length < 4 || lower.length > 60) {
      return false;
    }

    return false; // Default to rejecting unknown items
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

  // ============================================
  // ENHANCED EXTRACTION METHODS
  // ============================================

  /**
   * Extract enhanced data from a page
   */
  private async extractEnhancedPageData(
    page: Page,
    path: string,
    data: EnhancedWebsiteData
  ): Promise<void> {
    // All pages: Extract certifications and scheduling system hints
    const pageText = await this.getFullPageText(page);
    this.extractCertifications(pageText, data);
    this.extractSchedulingSystem(pageText, data);
    this.extractPaymentMethods(pageText, data);

    // Team/Leadership page: Count team members for size indicator
    if (path.includes('team') || path.includes('leadership')) {
      data.employeeSizeIndicators.teamPageCount = data.teamMembers.length;
    }

    // Careers page
    if (path.includes('careers') || path.includes('jobs')) {
      data.employeeSizeIndicators.careersPageExists = true;
      const jobCount = await this.extractJobPostingsCount(page);
      data.employeeSizeIndicators.jobPostingsCount = jobCount;
    }

    // Locations page
    if (path.includes('locations') || path.includes('service-area')) {
      const locations = await this.extractLocations(page);
      data.employeeSizeIndicators.locationsCount = locations.length;
      data.serviceAreas = [...new Set([...data.serviceAreas, ...locations])];
    }

    // Services page: Extract detailed services
    if (path.includes('services') || path.includes('solutions') || path.includes('commercial') || path.includes('residential')) {
      const serviceDetails = await this.extractServiceDetails(page);
      data.serviceDetails = [...data.serviceDetails, ...serviceDetails];
    }

    // Case studies page
    if (path.includes('case-stud') || path.includes('success')) {
      const caseStudies = await this.extractCaseStudies(page);
      data.caseStudies = [...data.caseStudies, ...caseStudies].slice(0, 10);
    }

    // Awards page
    if (path.includes('award') || path.includes('recognition')) {
      const awards = await this.extractAwards(page);
      data.awards = [...new Set([...data.awards, ...awards])];
    }

    // Blog page: Extract content topics
    if (path.includes('blog') || path.includes('news')) {
      const topics = await this.extractContentTopics(page);
      data.contentTopics = [...new Set([...data.contentTopics, ...topics])];

      // Get latest blog post date
      if (data.blogPosts.length > 0 && data.blogPosts[0].date) {
        data.lastBlogPostDate = data.blogPosts[0].date;
      }
    }
  }

  /**
   * Get full page text for keyword extraction
   */
  private async getFullPageText(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => document.body.innerText.toLowerCase());
    } catch {
      return '';
    }
  }

  /**
   * Extract certifications from page text
   */
  private extractCertifications(pageText: string, data: EnhancedWebsiteData): void {
    for (const keyword of CERTIFICATION_KEYWORDS) {
      if (pageText.includes(keyword.toLowerCase())) {
        // Normalize the certification name
        let certName = keyword;
        if (keyword === 'qualitypro' || keyword === 'quality pro') {
          certName = 'QualityPro';
        } else if (keyword === 'npma' || keyword === 'national pest management') {
          certName = 'NPMA Member';
        } else if (keyword === 'bbb' || keyword === 'better business bureau') {
          certName = 'BBB Accredited';
        } else if (keyword === 'green pro' || keyword === 'greenpro') {
          certName = 'GreenPro Certified';
        } else {
          certName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        }

        if (!data.certifications.includes(certName)) {
          data.certifications.push(certName);
        }
      }
    }
  }

  /**
   * Detect scheduling system from page text
   */
  private extractSchedulingSystem(pageText: string, data: EnhancedWebsiteData): void {
    if (data.schedulingSystem) return; // Already found

    for (const keyword of SCHEDULING_KEYWORDS) {
      if (pageText.includes(keyword.toLowerCase())) {
        if (keyword.includes('calendly')) {
          data.schedulingSystem = 'Calendly';
        } else if (keyword.includes('acuity')) {
          data.schedulingSystem = 'Acuity Scheduling';
        } else if (keyword.includes('square')) {
          data.schedulingSystem = 'Square Appointments';
        } else {
          data.schedulingSystem = 'Online Booking Available';
        }
        break;
      }
    }
  }

  /**
   * Extract payment methods from page text
   */
  private extractPaymentMethods(pageText: string, data: EnhancedWebsiteData): void {
    const foundMethods: string[] = [];

    for (const keyword of PAYMENT_KEYWORDS) {
      if (pageText.includes(keyword.toLowerCase())) {
        // Normalize payment method names
        if (keyword === 'visa' || keyword === 'mastercard' || keyword === 'amex' ||
            keyword === 'american express' || keyword === 'discover' || keyword === 'credit card') {
          if (!foundMethods.includes('Credit Cards')) {
            foundMethods.push('Credit Cards');
          }
        } else if (keyword === 'financing' || keyword === 'payment plans') {
          if (!foundMethods.includes('Financing Available')) {
            foundMethods.push('Financing Available');
          }
        } else {
          const normalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          if (!foundMethods.includes(normalized)) {
            foundMethods.push(normalized);
          }
        }
      }
    }

    data.paymentMethods = [...new Set([...data.paymentMethods, ...foundMethods])];
  }

  /**
   * Extract job postings count from careers page
   */
  private async extractJobPostingsCount(page: Page): Promise<number> {
    const selectors = [
      '.job-posting',
      '.job-listing',
      '[class*="job"] [class*="card"]',
      '[class*="career"] [class*="item"]',
      '[class*="position"]',
      '.opening',
    ];

    for (const selector of selectors) {
      try {
        const count = await page.$$eval(selector, (els) => els.length);
        if (count > 0) return count;
      } catch {
        continue;
      }
    }

    return 0;
  }

  /**
   * Extract locations/service areas (filtered to geographic locations only)
   */
  private async extractLocations(page: Page): Promise<string[]> {
    const rawLocations: string[] = [];

    const selectors = [
      '.location',
      '[class*="location"]',
      '[class*="service-area"]',
      '.city',
      '[class*="city"]',
      '[class*="region"]',
      '[class*="county"]',
    ];

    try {
      for (const selector of selectors) {
        const items = await page.$$eval(selector, (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 2 && t.length < 100) as string[]
        );
        rawLocations.push(...items);
      }

      // Also try to find state/city mentions in lists
      const listItems = await page.$$eval(
        'ul li, .areas li, [class*="service"] li',
        (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 2 && t.length < 50) as string[]
      );
      rawLocations.push(...listItems);
    } catch {
      // Ignore
    }

    // Filter to actual geographic locations
    const usStates = [
      'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
      'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
      'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
      'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
      'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
      'new hampshire', 'new jersey', 'new mexico', 'new york',
      'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
      'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
      'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
      'west virginia', 'wisconsin', 'wyoming',
    ];

    // State abbreviations
    const stateAbbrevs = [
      'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
      'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
      'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
      'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
      'wi', 'wy',
    ];

    // Geo keywords
    const geoKeywords = ['county', 'metro', 'greater', 'region', 'valley', 'lake', 'area'];

    // Items to exclude (nav items, services, etc.)
    const excludePatterns = [
      /^home$/i, /^about/i, /^contact/i, /^blog$/i, /^news$/i, /^careers?$/i,
      /^services?$/i, /^login$/i, /^testimonials?$/i, /^faq$/i, /^privacy/i,
      /^terms/i, /pest/i, /termite/i, /rodent/i, /control/i, /removal/i,
      /inspection/i, /treatment/i, /commercial/i, /residential/i, /^our /i,
      /^\d+$/, // Pure numbers
      /^view /i, /^learn /i, /^get /i, /^call /i, /^click/i,
    ];

    const filteredLocations = [...new Set(rawLocations)].filter(loc => {
      const lower = loc.toLowerCase().trim();

      // Skip if matches exclusion patterns
      if (excludePatterns.some(pattern => pattern.test(lower))) {
        return false;
      }

      // Skip if too short or too long
      if (lower.length < 3 || lower.length > 60) {
        return false;
      }

      // Include if contains state name
      if (usStates.some(state => lower.includes(state))) {
        return true;
      }

      // Include if contains geo keyword
      if (geoKeywords.some(kw => lower.includes(kw))) {
        return true;
      }

      // Include if matches "City, ST" pattern (e.g., "Raleigh, NC")
      const cityStatePattern = /^[a-z\s]+,\s*[a-z]{2}$/i;
      if (cityStatePattern.test(loc)) {
        return true;
      }

      // Include if ends with state abbreviation
      const endsWithState = stateAbbrevs.some(abbr =>
        lower.endsWith(`, ${abbr}`) || lower.endsWith(` ${abbr}`)
      );
      if (endsWithState) {
        return true;
      }

      // Include if it looks like a proper city name (1-3 capitalized words, no common keywords)
      const words = loc.trim().split(/\s+/);
      const looksLikeCity = words.length >= 1 && words.length <= 4 &&
        words.every(w => /^[A-Z][a-z]+$/.test(w) || w === 'of' || w === 'the');

      return looksLikeCity;
    });

    return filteredLocations.slice(0, 30);
  }

  /**
   * Extract detailed service information
   */
  private async extractServiceDetails(page: Page): Promise<ServiceDetail[]> {
    const details: ServiceDetail[] = [];

    const selectors = [
      '.service-card',
      '[class*="service"] [class*="card"]',
      '.service-item',
      '[class*="service-item"]',
    ];

    for (const selector of selectors) {
      try {
        const items = await page.$$(selector);
        if (items.length === 0) continue;

        for (const item of items.slice(0, 15)) {
          const name = await item.$eval(
            'h2, h3, h4, [class*="title"], [class*="name"]',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          const description = await item.$eval(
            'p, [class*="description"], [class*="desc"]',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          // Look for pricing hints
          const itemText = await item.evaluate((el) => el.textContent?.toLowerCase() || '');
          let pricingHint: string | null = null;
          if (itemText.includes('starting at') || itemText.includes('from $')) {
            pricingHint = 'Starting pricing available';
          } else if (itemText.includes('free estimate') || itemText.includes('free quote')) {
            pricingHint = 'Free estimates';
          } else if (itemText.includes('call for')) {
            pricingHint = 'Call for pricing';
          }

          if (name) {
            details.push({
              name,
              description: this.truncate(description, 300),
              pricingHint,
              isPrimary: details.length < 3, // First 3 are primary
            });
          }
        }

        if (details.length > 0) break;
      } catch {
        continue;
      }
    }

    return details;
  }

  /**
   * Extract pest control services from page using multiple strategies
   * More robust than extractListItems - looks at headings, links, cards
   */
  private async extractPestControlServices(page: Page): Promise<string[]> {
    const foundServices: string[] = [];

    // Known pest control service keywords for matching
    const servicePatterns = [
      // Pest types
      'pest control', 'termite', 'mosquito', 'bed bug', 'rodent', 'ant', 'ants',
      'roach', 'cockroach', 'spider', 'flea', 'tick', 'wildlife', 'bee', 'wasp',
      'hornet', 'fly', 'flies', 'moth', 'beetle', 'cricket', 'mite', 'silverfish',
      'centipede', 'millipede', 'earwig', 'stink bug', 'boxelder', 'scorpion',
      'snake', 'bird', 'bat', 'squirrel', 'raccoon', 'mole', 'vole', 'gopher',
      'groundhog', 'opossum', 'skunk', 'rat', 'mice', 'mouse',
      // Service types
      'extermination', 'removal', 'treatment', 'inspection', 'prevention',
      'fumigation', 'heat treatment', 'exclusion',
      // Related services
      'lawn care', 'weed control', 'fertilization', 'aeration', 'landscaping',
      'hvac', 'heating', 'cooling', 'air conditioning', 'plumbing', 'electrical',
      'insulation', 'moisture control', 'crawl space', 'attic',
      // Categories
      'commercial pest', 'residential pest', 'industrial pest',
    ];

    try {
      // Strategy 1: Extract from headings (h1, h2, h3, h4)
      const headings = await page.$$eval(
        'h1, h2, h3, h4',
        (elements) => elements.map(el => el.textContent?.trim()).filter(Boolean) as string[]
      );

      for (const heading of headings) {
        const lower = heading.toLowerCase();
        if (servicePatterns.some(pattern => lower.includes(pattern))) {
          // Clean up the heading (remove "services" suffix, etc.)
          let cleaned = heading
            .replace(/\s*services?\s*$/i, '')
            .replace(/\s*control\s*$/i, ' Control')
            .replace(/\s*removal\s*$/i, ' Removal')
            .replace(/\s*treatment\s*$/i, ' Treatment')
            .trim();
          if (cleaned.length > 2 && cleaned.length < 50) {
            foundServices.push(cleaned);
          }
        }
      }

      // Strategy 2: Extract from links on the page (service navigation)
      const links = await page.$$eval(
        'a[href*="service"], a[href*="pest"], a[href*="control"], nav a, .menu a',
        (elements) => elements.map(el => ({
          text: el.textContent?.trim(),
          href: el.getAttribute('href')
        })).filter(l => l.text && l.text.length > 2) as Array<{text: string, href: string | null}>
      );

      for (const link of links) {
        const lower = link.text!.toLowerCase();
        // Skip obvious nav items
        if (['home', 'about', 'contact', 'blog', 'careers', 'login', 'faq'].some(nav => lower === nav)) {
          continue;
        }
        if (servicePatterns.some(pattern => lower.includes(pattern))) {
          foundServices.push(link.text!);
        }
      }

      // Strategy 3: Extract from cards/grid items with service class names
      const cardSelectors = [
        '[class*="service"] [class*="title"]',
        '[class*="service"] h3',
        '[class*="service"] h4',
        '.card h3, .card h4',
        '[class*="grid"] [class*="item"] h3',
        '[class*="pest"] [class*="title"]',
      ];

      for (const selector of cardSelectors) {
        try {
          const items = await page.$$eval(selector, (els) =>
            els.map(el => el.textContent?.trim()).filter(Boolean) as string[]
          );
          for (const item of items) {
            const lower = item.toLowerCase();
            if (servicePatterns.some(pattern => lower.includes(pattern))) {
              foundServices.push(item);
            }
          }
        } catch {
          // Selector not found, continue
        }
      }

      // Strategy 4: Look for common service list patterns
      const listItems = await page.$$eval(
        'ul li a, .services li, [class*="service-list"] li',
        (elements) => elements.map(el => el.textContent?.trim()).filter(Boolean) as string[]
      );

      for (const item of listItems) {
        const lower = item.toLowerCase();
        if (servicePatterns.some(pattern => lower.includes(pattern)) && item.length < 50) {
          foundServices.push(item);
        }
      }

    } catch (error) {
      console.log('[WebsiteCollector] Error extracting services:', error);
    }

    // Deduplicate and clean up
    const uniqueServices = [...new Set(foundServices.map(s =>
      s.trim()
       .replace(/^\d+\.\s*/, '') // Remove numbered prefixes
       .replace(/^[-•]\s*/, '') // Remove bullet prefixes
    ))].filter(s => s.length > 2 && s.length < 60);

    // Normalize common variations
    const normalizedServices = uniqueServices.map(s => {
      // Capitalize first letter of each word
      return s.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    });

    return normalizedServices.slice(0, 25);
  }

  /**
   * Extract case studies
   */
  private async extractCaseStudies(page: Page): Promise<CaseStudy[]> {
    const studies: CaseStudy[] = [];

    const selectors = [
      '.case-study',
      '[class*="case-study"]',
      '.success-story',
      '[class*="success"]',
    ];

    for (const selector of selectors) {
      try {
        const items = await page.$$(selector);
        if (items.length === 0) continue;

        for (const item of items.slice(0, 10)) {
          const title = await item.$eval(
            'h2, h3, h4, [class*="title"]',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          const results = await item.$eval(
            '[class*="result"], [class*="outcome"], p',
            (el) => el.textContent?.trim()
          ).catch(() => null);

          const url = await item.$eval('a', (el) => el.getAttribute('href')).catch(() => null);

          if (title) {
            studies.push({
              title,
              industry: null, // Would need NLP to extract
              results: this.truncate(results, 200),
              url,
            });
          }
        }

        if (studies.length > 0) break;
      } catch {
        continue;
      }
    }

    return studies;
  }

  /**
   * Extract awards from page using keyword-based detection
   */
  private async extractAwards(page: Page): Promise<string[]> {
    const awards: string[] = [];

    // Award keyword patterns to match text content
    const awardPatterns = [
      /best of\s+\d{4}/i,
      /best of\s+[\w\s]+/i,
      /\d{4}\s+[\w\s]*award/i,
      /award[\w\s]*\d{4}/i,
      /top\s+\d+\s+[\w\s]+/i,
      /winner[:\s]+/i,
      /excellence\s+award/i,
      /industry\s+award/i,
      /service\s+award/i,
      /president['']?s?\s+award/i,
      /leadership\s+award/i,
      /customer\s+(service|choice|satisfaction)\s+award/i,
      /ranked\s+(#?\d+|top)/i,
      /inc\.?\s+\d+/i,
      /fast(est)?\s+\d+/i,
      /growing\s+companies/i,
      /business\s+of\s+the\s+year/i,
      /entrepreneur\s+of\s+the\s+year/i,
      /best\s+place(s)?\s+to\s+work/i,
      /certification\s+of\s+excellence/i,
      /honoree/i,
      /finalist/i,
      /nominee/i,
    ];

    // 1. Try class-based selectors first
    const classSelectors = [
      '.award', '[class*="award"]', '[class*="recognition"]',
      '[class*="accolade"]', '[class*="honor"]', '[class*="achievement"]',
      '[class*="winner"]', '[class*="badge"]',
    ];

    try {
      for (const selector of classSelectors) {
        const items = await page.$$eval(selector, (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 5 && t.length < 300) as string[]
        );
        awards.push(...items);
      }
    } catch {
      // Ignore
    }

    // 2. Extract from generic content elements using keyword matching
    const contentSelectors = [
      'li', 'h3', 'h4', 'h5', '.card', '[class*="item"]',
      'p', 'span', 'div[class*="text"]', 'figcaption',
    ];

    try {
      for (const selector of contentSelectors) {
        const items = await page.$$eval(selector, (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 10 && t.length < 300) as string[]
        );

        // Filter to items that match award patterns
        for (const item of items) {
          const matchesAwardPattern = awardPatterns.some(pattern => pattern.test(item));
          if (matchesAwardPattern) {
            // Clean up the text - take first sentence or up to 150 chars
            let cleanAward = item.split(/[.!?]/)[0].trim();
            if (cleanAward.length > 150) {
              cleanAward = cleanAward.substring(0, 147) + '...';
            }
            if (cleanAward.length > 10) {
              awards.push(cleanAward);
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    // 3. Look for images with award-related alt text
    try {
      const imgAlts = await page.$$eval('img[alt]', (elements) =>
        elements
          .map((el) => el.getAttribute('alt')?.trim())
          .filter((t) => t && t.length > 5 && t.length < 150) as string[]
      );

      for (const alt of imgAlts) {
        const matchesAwardPattern = awardPatterns.some(pattern => pattern.test(alt));
        if (matchesAwardPattern) {
          awards.push(alt);
        }
      }
    } catch {
      // Ignore
    }

    // 4. Look for structured data (JSON-LD) with awards
    try {
      const scripts = await page.$$eval('script[type="application/ld+json"]', (elements) =>
        elements.map((el) => el.textContent).filter(Boolean) as string[]
      );

      for (const script of scripts) {
        try {
          const data = JSON.parse(script);
          if (data.award) {
            const awardList = Array.isArray(data.award) ? data.award : [data.award];
            awards.push(...awardList.filter((a: string) => typeof a === 'string'));
          }
          if (data.awards) {
            const awardList = Array.isArray(data.awards) ? data.awards : [data.awards];
            awards.push(...awardList.filter((a: string) => typeof a === 'string'));
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch {
      // Ignore
    }

    // Deduplicate and limit
    const uniqueAwards = [...new Set(awards)]
      .filter(a => a.length > 10 && !a.includes('\n')) // Filter out multi-line items
      .slice(0, 20);

    return uniqueAwards;
  }

  /**
   * Extract content topics from blog
   */
  private async extractContentTopics(page: Page): Promise<string[]> {
    const topics: string[] = [];

    try {
      // Look for category tags
      const categories = await page.$$eval(
        '.category, [class*="category"], .tag, [class*="tag"], .topic',
        (elements) =>
          elements
            .map((el) => el.textContent?.trim())
            .filter((t) => t && t.length > 2 && t.length < 50) as string[]
      );
      topics.push(...categories);

      // Extract topics from post titles
      const titles = await page.$$eval(
        'article h2, .post h2, [class*="post"] h3',
        (elements) =>
          elements.map((el) => el.textContent?.trim()).filter(Boolean) as string[]
      );

      // Simple topic extraction from titles
      for (const title of titles.slice(0, 5)) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('pest')) topics.push('Pest Control');
        if (lowerTitle.includes('termite')) topics.push('Termites');
        if (lowerTitle.includes('rodent') || lowerTitle.includes('mouse') || lowerTitle.includes('rat')) {
          topics.push('Rodent Control');
        }
        if (lowerTitle.includes('mosquito')) topics.push('Mosquito Control');
        if (lowerTitle.includes('bed bug')) topics.push('Bed Bugs');
        if (lowerTitle.includes('ant')) topics.push('Ant Control');
        if (lowerTitle.includes('wildlife')) topics.push('Wildlife');
        if (lowerTitle.includes('lawn') || lowerTitle.includes('turf')) topics.push('Lawn Care');
        if (lowerTitle.includes('commercial')) topics.push('Commercial Services');
        if (lowerTitle.includes('tip') || lowerTitle.includes('prevention')) topics.push('Prevention Tips');
      }
    } catch {
      // Ignore
    }

    return [...new Set(topics)].slice(0, 15);
  }

  /**
   * Calculate blog post frequency based on dates
   */
  private calculateBlogFrequency(posts: WebsiteBlogPost[]): EnhancedWebsiteData['blogPostFrequency'] {
    if (posts.length === 0) return 'none';

    const postsWithDates = posts.filter((p) => p.date);
    if (postsWithDates.length < 2) return 'rarely';

    // Sort by date
    const sortedPosts = postsWithDates.sort((a, b) => {
      const dateA = new Date(a.date!).getTime();
      const dateB = new Date(b.date!).getTime();
      return dateB - dateA;
    });

    // Calculate average days between posts
    const latestDate = new Date(sortedPosts[0].date!);
    const oldestDate = new Date(sortedPosts[sortedPosts.length - 1].date!);
    const daySpan = (latestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
    const avgDaysBetweenPosts = daySpan / (postsWithDates.length - 1);

    // Check how recent the latest post is
    const daysSinceLastPost = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastPost > 180) return 'rarely'; // No post in 6 months

    if (avgDaysBetweenPosts <= 2) return 'daily';
    if (avgDaysBetweenPosts <= 10) return 'weekly';
    if (avgDaysBetweenPosts <= 45) return 'monthly';
    return 'rarely';
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
