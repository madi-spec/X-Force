/**
 * Blog/Content Detector
 * Comprehensive blog detection across multiple URL patterns
 * Detects blog platform, post frequency, topics, and email capture
 */

import * as cheerio from 'cheerio';
import { BaseCollector } from './base';
import type { CollectorOptions, CollectorResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface BlogDetectionResult {
  exists: boolean;
  url: string | null;
  platform: string | null;
  postCount: number;
  postsLast30Days: number;
  postsLast90Days: number;
  lastPostDate: string | null;
  lastPostTitle: string | null;
  categories: string[];
  hasRssFeed: boolean;
  hasEmailCapture: boolean;
  averageWordCount: number;
  hasAuthorBios: boolean;
  topTopics: string[];
}

interface BlogPost {
  title: string;
  url: string;
  date: string | null;
  excerpt: string | null;
}

// ============================================
// CONSTANTS
// ============================================

// All possible blog paths to check
const BLOG_PATH_VARIATIONS = [
  '/blog',
  '/news',
  '/articles',
  '/resources',
  '/learning-center',
  '/pest-library',
  '/tips',
  '/insights',
  '/posts',
  '/updates',
  '/whats-new',
  '/media',
  '/press',
  '/stories',
  '/journal',
  '/knowledge-base',
  '/help-center',
  '/education',
  '/library',
  '/pest-info',
  '/pest-control-tips',
  '/home-tips',
  '/seasonal-tips',
];

// Subdomains that might host blogs
const BLOG_SUBDOMAINS = ['blog.', 'news.', 'resources.', 'learn.', 'help.'];

// Topic patterns for pest control industry
const TOPIC_PATTERNS = [
  { pattern: /termite/i, topic: 'Termites' },
  { pattern: /bed\s*bug/i, topic: 'Bed Bugs' },
  { pattern: /mosquito/i, topic: 'Mosquitoes' },
  { pattern: /ant/i, topic: 'Ants' },
  { pattern: /roach|cockroach/i, topic: 'Roaches' },
  { pattern: /rodent|mouse|mice|rat/i, topic: 'Rodents' },
  { pattern: /spider/i, topic: 'Spiders' },
  { pattern: /tick/i, topic: 'Ticks' },
  { pattern: /flea/i, topic: 'Fleas' },
  { pattern: /wasp|bee|hornet/i, topic: 'Stinging Insects' },
  { pattern: /wildlife|raccoon|squirrel/i, topic: 'Wildlife' },
  { pattern: /lawn|grass|turf/i, topic: 'Lawn Care' },
  { pattern: /diy|yourself/i, topic: 'DIY Tips' },
  { pattern: /prevent|prevention/i, topic: 'Prevention' },
  { pattern: /seasonal|spring|summer|fall|winter/i, topic: 'Seasonal Tips' },
  { pattern: /commercial|business/i, topic: 'Commercial' },
  { pattern: /health|disease|danger/i, topic: 'Health & Safety' },
];

// ============================================
// BLOG DETECTOR COLLECTOR
// ============================================

export class BlogDetector extends BaseCollector<BlogDetectionResult, CollectorOptions> {
  readonly sourceType = 'blog_detection' as const;
  readonly displayName = 'Blog Detection';

  /**
   * Main collection method
   */
  async collect(
    _companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<BlogDetectionResult>> {
    const startTime = Date.now();

    if (!domain) {
      return this.errorResult('Domain required for blog detection', Date.now() - startTime);
    }

    try {
      const websiteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const data = await this.withRetry(
        async () => this.detectBlog(websiteUrl),
        options.maxRetries || 2
      );

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[BlogDetector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: BlogDetectionResult): number {
    if (!data || !data.exists) return 0;

    let score = 0;

    // Has blog (base score)
    score += 20;

    // Post count
    score += Math.min(20, data.postCount * 2);

    // Recent activity
    if (data.postsLast30Days > 0) score += 15;
    if (data.postsLast90Days >= 3) score += 10;

    // Categories/topics
    score += Math.min(15, data.categories.length * 3);
    score += Math.min(10, data.topTopics.length * 2);

    // Email capture
    if (data.hasEmailCapture) score += 10;

    // RSS feed
    if (data.hasRssFeed) score += 5;

    return Math.min(100, score);
  }

  /**
   * Main detection logic
   */
  private async detectBlog(websiteUrl: string): Promise<BlogDetectionResult> {
    const baseUrl = new URL(websiteUrl).origin;
    let blogUrl: string | null = null;
    let blogHtml: string | null = null;

    console.log('[BlogDetector] Searching for blog on:', baseUrl);

    // 1. Check main domain paths
    for (const path of BLOG_PATH_VARIATIONS) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; XForceBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          // Check if page looks like a blog OR if URL strongly suggests it's a blog
          const isBlogPath = ['/blog', '/news', '/articles'].includes(path);
          const hasContentIndicators = html.length > 5000 && (
            html.includes('post') ||
            html.includes('article') ||
            html.includes('blog')
          );

          if (this.looksLikeBlogPage(html) || (isBlogPath && hasContentIndicators)) {
            blogUrl = `${baseUrl}${path}`;
            blogHtml = html;
            console.log('[BlogDetector] Found blog at:', blogUrl);
            break;
          }
        }
      } catch {
        // Continue to next path
      }
    }

    // 2. Check subdomains if no blog found
    if (!blogUrl) {
      const domain = new URL(websiteUrl).hostname.replace('www.', '');
      for (const subdomain of BLOG_SUBDOMAINS) {
        try {
          const subdomainUrl = `https://${subdomain}${domain}`;
          const response = await fetch(subdomainUrl, {
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          });

          if (response.ok) {
            const html = await response.text();
            if (this.looksLikeBlogPage(html)) {
              blogUrl = subdomainUrl;
              blogHtml = html;
              console.log('[BlogDetector] Found blog at subdomain:', blogUrl);
              break;
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // 3. Look for blog link in navigation/footer
    if (!blogUrl) {
      try {
        const homeResponse = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
        const homeHtml = await homeResponse.text();
        const $ = cheerio.load(homeHtml);

        // Find links that look like blog links
        const blogLinkPatterns = [
          'a[href*="/blog"]',
          'a[href*="/news"]',
          'a[href*="/articles"]',
          'a[href*="/resources"]',
          'a:contains("Blog")',
          'a:contains("News")',
          'a:contains("Articles")',
          'a:contains("Resources")',
          'a:contains("Tips")',
          'a:contains("Learning")',
        ];

        for (const pattern of blogLinkPatterns) {
          const link = $(pattern).first().attr('href');
          if (link) {
            const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
            try {
              const response = await fetch(fullUrl, {
                redirect: 'follow',
                signal: AbortSignal.timeout(10000),
              });
              if (response.ok) {
                const html = await response.text();
                if (this.looksLikeBlogPage(html)) {
                  blogUrl = fullUrl;
                  blogHtml = html;
                  console.log('[BlogDetector] Found blog via navigation:', blogUrl);
                  break;
                }
              }
            } catch {
              // Continue
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // No blog found
    if (!blogUrl || !blogHtml) {
      console.log('[BlogDetector] No blog found');
      return this.emptyResult();
    }

    // 4. Analyze the blog
    return this.analyzeBlog(blogUrl, blogHtml);
  }

  /**
   * Check if page looks like a blog listing
   */
  private looksLikeBlogPage(html: string): boolean {
    const $ = cheerio.load(html);

    // Strong signals (any one of these is enough)
    const strongSignals = [
      // Multiple article elements
      $('article').length >= 3,
      // Blog post class patterns
      $('.post, .blog-post, .article, .entry, .news-item, [class*="blog"]').length >= 3,
      // RSS/Atom feed link
      $('link[type="application/rss+xml"], link[type="application/atom+xml"]').length > 0,
      // WordPress indicators
      html.includes('wp-content') || html.includes('wp-json'),
    ];

    if (strongSignals.some(Boolean)) return true;

    // Weaker signals that need multiple matches
    const signals = [
      // Multiple article elements
      $('article').length >= 2,
      // Blog post class patterns
      $('.post, .blog-post, .article, .entry, .news-item').length >= 2,
      // Date patterns (common in blog listings)
      $('[class*="date"], [class*="posted"], time, .meta').length >= 2,
      // "Read more" links
      $('a:contains("Read more"), a:contains("Continue reading"), a:contains("Learn more")').length >= 1,
      // Pagination
      $('.pagination, .pager, [class*="page-nav"], [class*="load-more"]').length > 0,
      // Category/tag elements
      $('.category, .tag, [class*="categories"], [class*="tags"]').length > 0,
      // Blog-like heading
      $('h1:contains("Blog"), h1:contains("News"), h1:contains("Articles"), h2:contains("Blog")').length > 0,
      // Post listings
      $('[class*="post-list"], [class*="blog-list"], [class*="article-list"]').length > 0,
    ];

    // If 2+ signals match, it's likely a blog
    return signals.filter(Boolean).length >= 2;
  }

  /**
   * Analyze discovered blog
   */
  private async analyzeBlog(blogUrl: string, blogHtml: string): Promise<BlogDetectionResult> {
    const $ = cheerio.load(blogHtml);

    // Extract posts
    const posts = this.extractPosts($);

    // Check for RSS feed
    const hasRssFeed = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').length > 0;

    // Check for email capture
    const hasEmailCapture =
      $(
        'input[type="email"], ' +
          'form[class*="newsletter"], ' +
          'form[class*="subscribe"], ' +
          '[class*="email-signup"], ' +
          '[class*="newsletter"]'
      ).length > 0;

    // Detect platform
    const platform = this.detectBlogPlatform(blogHtml);

    // Check for author bios
    const hasAuthorBios =
      $('.author-bio, ' + '[class*="author"], ' + '.byline, ' + '[rel="author"]').length > 0;

    // Extract categories
    const categories = this.extractCategories($);

    // Calculate recency
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const postsLast30Days = posts.filter(
      (p) => p.date && new Date(p.date) >= thirtyDaysAgo
    ).length;
    const postsLast90Days = posts.filter(
      (p) => p.date && new Date(p.date) >= ninetyDaysAgo
    ).length;

    // Get last post
    const sortedPosts = posts
      .filter((p) => p.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    const lastPost = sortedPosts[0];

    // Extract topics from titles
    const topTopics = this.extractTopics(posts.map((p) => p.title));

    return {
      exists: true,
      url: blogUrl,
      platform,
      postCount: posts.length,
      postsLast30Days,
      postsLast90Days,
      lastPostDate: lastPost?.date || null,
      lastPostTitle: lastPost?.title || null,
      categories,
      hasRssFeed,
      hasEmailCapture,
      averageWordCount: 0, // Would need to fetch individual posts
      hasAuthorBios,
      topTopics,
    };
  }

  /**
   * Extract posts from blog page
   */
  private extractPosts($: cheerio.CheerioAPI): BlogPost[] {
    const posts: BlogPost[] = [];

    // Common blog post container selectors
    const postSelectors = [
      'article',
      '.post',
      '.blog-post',
      '.article',
      '.entry',
      '.news-item',
      '[class*="post-item"]',
      '[class*="blog-item"]',
      '[class*="article-item"]',
    ];

    for (const selector of postSelectors) {
      $(selector).each((_, el) => {
        const $el = $(el);

        // Get title
        const titleEl = $el.find('h1, h2, h3, .title, [class*="title"]').first();
        const title = titleEl.text().trim();

        // Get URL
        const linkEl = $el.find('a').first();
        const url = linkEl.attr('href') || '';

        // Get date
        const dateEl = $el.find('time, [class*="date"], [class*="posted"], .meta').first();
        const dateText = dateEl.attr('datetime') || dateEl.text().trim();
        const date = this.parseBlogDate(dateText);

        // Get excerpt
        const excerptEl = $el.find('p, .excerpt, .summary, [class*="excerpt"]').first();
        const excerpt = excerptEl.text().trim().substring(0, 200);

        if (title && title.length > 5) {
          posts.push({ title, url, date, excerpt });
        }
      });

      if (posts.length >= 3) break; // Found posts, stop looking
    }

    return posts;
  }

  /**
   * Detect blog platform from HTML
   */
  private detectBlogPlatform(html: string): string {
    if (html.includes('wp-content') || html.includes('wordpress')) return 'WordPress';
    if (html.includes('hubspot')) return 'HubSpot';
    if (html.includes('squarespace')) return 'Squarespace';
    if (html.includes('wix.com')) return 'Wix';
    if (html.includes('webflow')) return 'Webflow';
    if (html.includes('ghost')) return 'Ghost';
    if (html.includes('medium.com')) return 'Medium';
    if (html.includes('blogger.com') || html.includes('blogspot')) return 'Blogger';
    if (html.includes('contentful')) return 'Contentful';
    if (html.includes('strapi')) return 'Strapi';
    return 'Unknown';
  }

  /**
   * Extract categories from blog page
   */
  private extractCategories($: cheerio.CheerioAPI): string[] {
    const categories = new Set<string>();

    // Look for category links
    $('[class*="category"] a, [class*="categories"] a, .cat-links a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 50) {
        categories.add(text);
      }
    });

    // Look for tag links
    $('[class*="tag"] a, [class*="tags"] a, .tag-links a').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 50) {
        categories.add(text);
      }
    });

    return Array.from(categories).slice(0, 20);
  }

  /**
   * Extract topics from post titles
   */
  private extractTopics(titles: string[]): string[] {
    const foundTopics = new Set<string>();

    for (const title of titles) {
      for (const { pattern, topic } of TOPIC_PATTERNS) {
        if (pattern.test(title)) {
          foundTopics.add(topic);
        }
      }
    }

    return Array.from(foundTopics);
  }

  /**
   * Parse date string from blog post
   */
  private parseBlogDate(dateText: string): string | null {
    if (!dateText) return null;

    try {
      // Try ISO format first
      const isoDate = new Date(dateText);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
      }

      // Try common formats
      const formats = [
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // January 15, 2024
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // 01/15/2024
        /(\d{4})-(\d{2})-(\d{2})/, // 2024-01-15
      ];

      for (const format of formats) {
        const match = dateText.match(format);
        if (match) {
          const parsed = new Date(dateText);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Empty result for when no blog is found
   */
  private emptyResult(): BlogDetectionResult {
    return {
      exists: false,
      url: null,
      platform: null,
      postCount: 0,
      postsLast30Days: 0,
      postsLast90Days: 0,
      lastPostDate: null,
      lastPostTitle: null,
      categories: [],
      hasRssFeed: false,
      hasEmailCapture: false,
      averageWordCount: 0,
      hasAuthorBios: false,
      topTopics: [],
    };
  }
}

// Export singleton
export const blogDetector = new BlogDetector();
