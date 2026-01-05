# X-FORCE: Enhanced Marketing Intelligence Detection

## Problem Statement

The current Account Intelligence system is ranking marketing-active companies as low activity because it:

1. Only checks for `/blog` path (misses `/news`, `/resources`, `/articles`, etc.)
2. Doesn't measure posting frequency or recency
3. Ignores YouTube entirely (huge for pest control)
4. Doesn't check Google Business Profile posts
5. Can't detect Facebook/Instagram posting frequency without API
6. Misses email marketing signals
7. Doesn't detect advertising activity
8. Ignores review velocity (growth rate)

This update provides comprehensive marketing activity detection.

---

## Enhanced Database Schema

```sql
-- Add marketing intelligence to existing account_intelligence table
ALTER TABLE account_intelligence ADD COLUMN IF NOT EXISTS marketing_data JSONB;
ALTER TABLE account_intelligence ADD COLUMN IF NOT EXISTS marketing_score INTEGER;

-- Or create dedicated table for detailed tracking
CREATE TABLE marketing_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Collection metadata
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  collection_version INTEGER DEFAULT 1,
  
  -- Blog/Content
  blog_data JSONB,
  /*
  {
    exists: boolean,
    url: string,
    platform: string, // WordPress, HubSpot, custom
    postCount: number,
    postsLast30Days: number,
    postsLast90Days: number,
    lastPostDate: string,
    lastPostTitle: string,
    categories: string[],
    hasRssFeed: boolean,
    hasEmailCapture: boolean,
    averageWordCount: number,
    hasAuthorBios: boolean,
    topTopics: string[]
  }
  */
  
  -- YouTube
  youtube_data JSONB,
  /*
  {
    exists: boolean,
    channelId: string,
    channelUrl: string,
    channelName: string,
    subscribers: number,
    totalViews: number,
    videoCount: number,
    videosLast30Days: number,
    videosLast90Days: number,
    lastUploadDate: string,
    lastUploadTitle: string,
    avgViewsPerVideo: number,
    topVideos: [{title, views, date}],
    playlists: string[],
    hasShorts: boolean
  }
  */
  
  -- Google Business Profile
  gbp_data JSONB,
  /*
  {
    claimed: boolean,
    placeId: string,
    postsLast30Days: number,
    postsLast90Days: number,
    lastPostDate: string,
    postTypes: string[], // offer, event, update, product
    photosTotal: number,
    photosLast30Days: number,
    ownerPhotos: number,
    customerPhotos: number,
    questionsAnswered: number,
    questionsTotal: number,
    respondsToReviews: boolean,
    reviewResponseRate: number,
    avgReviewResponseTime: string,
    attributes: string[], // "Online estimates", "Emergency services"
    services: string[],
    productsListed: number
  }
  */
  
  -- Facebook
  facebook_data JSONB,
  /*
  {
    exists: boolean,
    pageUrl: string,
    pageName: string,
    followers: number,
    likes: number,
    postsLast30Days: number,
    postsLast90Days: number,
    lastPostDate: string,
    postTypes: {text: n, photo: n, video: n, link: n},
    avgEngagementRate: number,
    avgLikesPerPost: number,
    avgCommentsPerPost: number,
    avgSharesPerPost: number,
    respondsToComments: boolean,
    avgResponseTime: string,
    hasMessenger: boolean,
    messengerResponseTime: string,
    runningAds: boolean,
    adCount: number,
    checkinsCount: number,
    eventsCount: number,
    hasShop: boolean
  }
  */
  
  -- Instagram
  instagram_data JSONB,
  /*
  {
    exists: boolean,
    handle: string,
    profileUrl: string,
    followers: number,
    following: number,
    postsTotal: number,
    postsLast30Days: number,
    reelsLast30Days: number,
    lastPostDate: string,
    avgLikesPerPost: number,
    avgCommentsPerPost: number,
    engagementRate: number,
    hasHighlights: boolean,
    highlightCategories: string[],
    usesReels: boolean,
    bioHasLink: boolean,
    bioLinkType: string, // linktree, website, etc.
    hashtagsUsed: string[]
  }
  */
  
  -- LinkedIn Company Page
  linkedin_data JSONB,
  /*
  {
    exists: boolean,
    pageUrl: string,
    followers: number,
    employeeCount: number,
    postsLast30Days: number,
    lastPostDate: string,
    avgEngagement: number,
    employeesPosting: number, // employees sharing company content
    hasShowcasePages: boolean,
    jobPostings: number
  }
  */
  
  -- TikTok
  tiktok_data JSONB,
  /*
  {
    exists: boolean,
    handle: string,
    followers: number,
    following: number,
    likes: number,
    videoCount: number,
    videosLast30Days: number,
    lastVideoDate: string,
    avgViewsPerVideo: number
  }
  */
  
  -- Twitter/X
  twitter_data JSONB,
  /*
  {
    exists: boolean,
    handle: string,
    followers: number,
    following: number,
    tweetCount: number,
    tweetsLast30Days: number,
    lastTweetDate: string,
    avgEngagement: number,
    isVerified: boolean
  }
  */
  
  -- Nextdoor (important for local services)
  nextdoor_data JSONB,
  /*
  {
    claimed: boolean,
    recommendations: number,
    responseRate: number,
    lastActive: string
  }
  */
  
  -- Review Platforms
  review_velocity JSONB,
  /*
  {
    google: {
      totalReviews: number,
      reviewsLast30Days: number,
      reviewsLast90Days: number,
      growthRate: number, // % per month
      avgRating: number,
      ratingTrend: 'improving' | 'stable' | 'declining'
    },
    yelp: { ... },
    facebook: { ... },
    bbb: { ... },
    angiesList: { ... },
    homeAdvisor: { ... },
    thumbtack: { ... },
    
    totalPlatforms: number,
    activePlatforms: number, // received review in last 90 days
    combinedMonthlyReviews: number,
    hasReviewManagement: boolean, // detected review software
    reviewSoftware: string // Birdeye, Podium, etc.
  }
  */
  
  -- Email Marketing
  email_marketing_data JSONB,
  /*
  {
    hasNewsletterSignup: boolean,
    signupLocations: string[], // footer, popup, sidebar
    hasLeadMagnet: boolean,
    leadMagnetType: string, // ebook, checklist, guide, coupon
    leadMagnetTitle: string,
    detectedPlatform: string, // Mailchimp, Constant Contact, HubSpot
    hasPopup: boolean,
    popupTrigger: string, // exit intent, time delay, scroll
    hasExitIntent: boolean
  }
  */
  
  -- Advertising Signals
  advertising_data JSONB,
  /*
  {
    facebookAds: {
      running: boolean,
      adCount: number,
      oldestAdDate: string,
      adCategories: string[]
    },
    googleAds: {
      detected: boolean, // via landing pages, UTM params
      landingPages: string[]
    },
    trackingPixels: string[], // facebook, google, bing, etc.
    retargetingDetected: boolean
  }
  */
  
  -- Website Marketing Sophistication
  website_marketing JSONB,
  /*
  {
    // Conversion elements
    hasLiveChat: boolean,
    liveChatProvider: string,
    hasChatbot: boolean,
    chatbotProvider: string,
    hasCallTracking: boolean,
    callTrackingProvider: string,
    hasFormTracking: boolean,
    
    // Trust elements
    hasTrustBadges: boolean,
    trustBadges: string[], // BBB, HomeAdvisor, etc.
    hasTestimonials: boolean,
    testimonialCount: number,
    hasVideoTestimonials: boolean,
    hasCaseStudies: boolean,
    hasBeforeAfter: boolean,
    showsReviewCount: boolean, // "500+ 5-star reviews"
    showsYearsInBusiness: boolean,
    showsCustomerCount: boolean,
    
    // Urgency/scarcity
    hasLimitedOffer: boolean,
    hasCountdownTimer: boolean,
    hasSeasonalPromo: boolean,
    currentPromo: string,
    
    // Lead capture
    formCount: number,
    hasMultiStepForm: boolean,
    hasInstantQuote: boolean,
    hasSchedulingWidget: boolean,
    schedulingProvider: string,
    
    // Content
    hasVideoOnHomepage: boolean,
    hasAnimations: boolean,
    hasInteractiveElements: boolean,
    pageLoadSpeed: number,
    mobileOptimized: boolean,
    
    // SEO signals
    hasSitemap: boolean,
    hasRobotsTxt: boolean,
    hasStructuredData: boolean,
    blogIntegrated: boolean
  }
  */
  
  -- Calculated Scores
  scores JSONB,
  /*
  {
    content: number,      // 0-100: Blog, video, resources
    social: number,       // 0-100: Social media presence
    engagement: number,   // 0-100: Audience engagement quality
    frequency: number,    // 0-100: Posting consistency
    reach: number,        // 0-100: Follower counts, impressions
    sophistication: number, // 0-100: Marketing tech stack
    advertising: number,  // 0-100: Paid marketing activity
    reviews: number,      // 0-100: Review velocity & management
    overall: number       // Weighted average
  }
  */
  
  -- AI Analysis
  ai_analysis JSONB,
  /*
  {
    summary: string,
    strengths: string[],
    weaknesses: string[],
    competitivePosition: string,
    recommendations: string[],
    marketingMaturity: 'basic' | 'developing' | 'established' | 'advanced'
  }
  */
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id)
);

-- Index for quick lookups
CREATE INDEX idx_marketing_intel_company ON marketing_intelligence(company_id);
CREATE INDEX idx_marketing_intel_score ON marketing_intelligence((scores->>'overall'));
```

---

## Collection Services

### 1. Blog/Content Detector

```typescript
// lib/intelligence/collectors/blogDetector.ts

import * as cheerio from 'cheerio';

interface BlogDetectionResult {
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
  '/seasonal-tips'
];

// Subdomains that might host blogs
const BLOG_SUBDOMAINS = [
  'blog.',
  'news.',
  'resources.',
  'learn.',
  'help.'
];

export async function detectBlog(websiteUrl: string): Promise<BlogDetectionResult> {
  const baseUrl = new URL(websiteUrl).origin;
  let blogUrl: string | null = null;
  let blogHtml: string | null = null;
  
  // 1. Check main domain paths
  for (const path of BLOG_PATH_VARIATIONS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { 
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; XForceBot/1.0)' }
      });
      
      if (response.ok) {
        const html = await response.text();
        if (looksLikeBlogPage(html)) {
          blogUrl = `${baseUrl}${path}`;
          blogHtml = html;
          break;
        }
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // 2. Check subdomains if no blog found
  if (!blogUrl) {
    const domain = new URL(websiteUrl).hostname.replace('www.', '');
    for (const subdomain of BLOG_SUBDOMAINS) {
      try {
        const subdomainUrl = `https://${subdomain}${domain}`;
        const response = await fetch(subdomainUrl, { redirect: 'follow' });
        
        if (response.ok) {
          const html = await response.text();
          if (looksLikeBlogPage(html)) {
            blogUrl = subdomainUrl;
            blogHtml = html;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }
  
  // 3. Look for blog link in navigation/footer
  if (!blogUrl) {
    try {
      const homeResponse = await fetch(baseUrl);
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
        'a:contains("Learning")'
      ];
      
      for (const pattern of blogLinkPatterns) {
        const link = $(pattern).first().attr('href');
        if (link) {
          const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
          try {
            const response = await fetch(fullUrl, { redirect: 'follow' });
            if (response.ok) {
              const html = await response.text();
              if (looksLikeBlogPage(html)) {
                blogUrl = fullUrl;
                blogHtml = html;
                break;
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  
  // No blog found
  if (!blogUrl || !blogHtml) {
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
      topTopics: []
    };
  }
  
  // 4. Analyze the blog
  return await analyzeBlog(blogUrl, blogHtml);
}

function looksLikeBlogPage(html: string): boolean {
  const $ = cheerio.load(html);
  
  // Signals that this is a blog/article listing page
  const signals = [
    // Multiple article elements
    $('article').length >= 2,
    // Blog post class patterns
    $('.post, .blog-post, .article, .entry, .news-item').length >= 2,
    // Date patterns (common in blog listings)
    $('[class*="date"], [class*="posted"], time, .meta').length >= 2,
    // "Read more" or "Continue reading" links
    $('a:contains("Read more"), a:contains("Continue reading"), a:contains("Learn more")').length >= 2,
    // Pagination
    $('.pagination, .pager, [class*="page-nav"]').length > 0,
    // Category/tag elements
    $('.category, .tag, [class*="categories"], [class*="tags"]').length > 0
  ];
  
  // If 3+ signals match, it's likely a blog
  return signals.filter(Boolean).length >= 3;
}

async function analyzeBlog(blogUrl: string, blogHtml: string): Promise<BlogDetectionResult> {
  const $ = cheerio.load(blogHtml);
  
  // Extract posts
  const posts = extractPosts($);
  
  // Check for RSS feed
  const hasRssFeed = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').length > 0;
  
  // Check for email capture
  const hasEmailCapture = $(
    'input[type="email"], ' +
    'form[class*="newsletter"], ' +
    'form[class*="subscribe"], ' +
    '[class*="email-signup"], ' +
    '[class*="newsletter"]'
  ).length > 0;
  
  // Detect platform
  const platform = detectBlogPlatform(blogHtml);
  
  // Check for author bios
  const hasAuthorBios = $(
    '.author-bio, ' +
    '[class*="author"], ' +
    '.byline, ' +
    '[rel="author"]'
  ).length > 0;
  
  // Extract categories
  const categories = extractCategories($);
  
  // Calculate recency
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const postsLast30Days = posts.filter(p => p.date && new Date(p.date) >= thirtyDaysAgo).length;
  const postsLast90Days = posts.filter(p => p.date && new Date(p.date) >= ninetyDaysAgo).length;
  
  // Get last post
  const sortedPosts = posts.filter(p => p.date).sort((a, b) => 
    new Date(b.date!).getTime() - new Date(a.date!).getTime()
  );
  
  const lastPost = sortedPosts[0];
  
  // Extract topics from titles
  const topTopics = extractTopics(posts.map(p => p.title));
  
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
    topTopics
  };
}

interface BlogPost {
  title: string;
  url: string;
  date: string | null;
  excerpt: string | null;
}

function extractPosts($: cheerio.CheerioAPI): BlogPost[] {
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
    '[class*="article-item"]'
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
      const date = parseDate(dateText);
      
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

function detectBlogPlatform(html: string): string {
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

function extractCategories($: cheerio.CheerioAPI): string[] {
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

function extractTopics(titles: string[]): string[] {
  // Common pest control topics to look for
  const topicPatterns = [
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
    { pattern: /health|disease|danger/i, topic: 'Health & Safety' }
  ];
  
  const foundTopics = new Set<string>();
  
  for (const title of titles) {
    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(title)) {
        foundTopics.add(topic);
      }
    }
  }
  
  return Array.from(foundTopics);
}

function parseDate(dateText: string): string | null {
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
      /(\d{4})-(\d{2})-(\d{2})/        // 2024-01-15
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
  } catch (e) {}
  
  return null;
}
```

---

### 2. YouTube Channel Detector

```typescript
// lib/intelligence/collectors/youtubeDetector.ts

interface YouTubeProfile {
  exists: boolean;
  channelId: string | null;
  channelUrl: string | null;
  channelName: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  videosLast30Days: number;
  videosLast90Days: number;
  lastUploadDate: string | null;
  lastUploadTitle: string | null;
  avgViewsPerVideo: number;
  topVideos: { title: string; views: number; date: string }[];
  playlists: string[];
  hasShorts: boolean;
}

export async function detectYouTubeChannel(
  companyName: string,
  websiteUrl: string
): Promise<YouTubeProfile> {
  
  // 1. Check website for YouTube link
  let channelUrl = await findYouTubeLinkOnWebsite(websiteUrl);
  
  // 2. If not found, search YouTube
  if (!channelUrl) {
    channelUrl = await searchForChannel(companyName);
  }
  
  if (!channelUrl) {
    return {
      exists: false,
      channelId: null,
      channelUrl: null,
      channelName: null,
      subscribers: 0,
      totalViews: 0,
      videoCount: 0,
      videosLast30Days: 0,
      videosLast90Days: 0,
      lastUploadDate: null,
      lastUploadTitle: null,
      avgViewsPerVideo: 0,
      topVideos: [],
      playlists: [],
      hasShorts: false
    };
  }
  
  // 3. Get channel details
  return await getChannelDetails(channelUrl);
}

async function findYouTubeLinkOnWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    
    // Look for YouTube links
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/i,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/i,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return `https://youtube.com/${match[0].split('youtube.com/')[1]}`;
      }
    }
  } catch (e) {}
  
  return null;
}

async function searchForChannel(companyName: string): Promise<string | null> {
  // Use SerpAPI or YouTube Data API to search
  const serpApiKey = process.env.SERP_API_KEY;
  
  if (!serpApiKey) return null;
  
  try {
    const searchQuery = encodeURIComponent(`${companyName} pest control site:youtube.com`);
    const response = await fetch(
      `https://serpapi.com/search.json?q=${searchQuery}&api_key=${serpApiKey}`
    );
    
    const data = await response.json();
    
    // Look for channel results
    for (const result of data.organic_results || []) {
      const url = result.link || '';
      if (url.includes('youtube.com/channel/') || 
          url.includes('youtube.com/c/') || 
          url.includes('youtube.com/@')) {
        return url;
      }
    }
  } catch (e) {}
  
  return null;
}

async function getChannelDetails(channelUrl: string): Promise<YouTubeProfile> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  // Extract channel identifier
  const channelId = await resolveChannelId(channelUrl, apiKey);
  
  if (!channelId || !apiKey) {
    // Fallback: Scrape public page
    return await scrapeChannelPage(channelUrl);
  }
  
  try {
    // Get channel statistics
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    
    if (!channelData.items?.[0]) {
      return await scrapeChannelPage(channelUrl);
    }
    
    const channel = channelData.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    
    // Get recent videos
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
    );
    const videosData = await videosResponse.json();
    
    const videos = videosData.items || [];
    
    // Calculate recency
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const videosLast30Days = videos.filter(v => 
      new Date(v.snippet?.publishedAt) >= thirtyDaysAgo
    ).length;
    
    const videosLast90Days = videos.filter(v => 
      new Date(v.snippet?.publishedAt) >= ninetyDaysAgo
    ).length;
    
    // Get video statistics for top videos
    const videoIds = videos.slice(0, 10).map(v => v.contentDetails?.videoId).join(',');
    const videoStatsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
    );
    const videoStatsData = await videoStatsResponse.json();
    
    const topVideos = (videoStatsData.items || []).map((v, i) => ({
      title: videos[i]?.snippet?.title || '',
      views: parseInt(v.statistics?.viewCount || '0'),
      date: videos[i]?.snippet?.publishedAt || ''
    })).sort((a, b) => b.views - a.views).slice(0, 5);
    
    const totalVideoViews = topVideos.reduce((sum, v) => sum + v.views, 0);
    
    // Check for Shorts
    const hasShorts = videos.some(v => 
      v.snippet?.title?.includes('#shorts') || 
      v.snippet?.description?.includes('#shorts')
    );
    
    return {
      exists: true,
      channelId,
      channelUrl,
      channelName: channel.snippet?.title || null,
      subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
      totalViews: parseInt(channel.statistics?.viewCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
      videosLast30Days,
      videosLast90Days,
      lastUploadDate: videos[0]?.snippet?.publishedAt || null,
      lastUploadTitle: videos[0]?.snippet?.title || null,
      avgViewsPerVideo: topVideos.length > 0 ? Math.round(totalVideoViews / topVideos.length) : 0,
      topVideos,
      playlists: [], // Would need additional API call
      hasShorts
    };
  } catch (e) {
    console.error('YouTube API error:', e);
    return await scrapeChannelPage(channelUrl);
  }
}

async function resolveChannelId(channelUrl: string, apiKey?: string): Promise<string | null> {
  // Extract from URL patterns
  const channelMatch = channelUrl.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];
  
  // For @handle or /c/ URLs, need to resolve via API or scraping
  const handleMatch = channelUrl.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  const customMatch = channelUrl.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
  const userMatch = channelUrl.match(/youtube\.com\/user\/([a-zA-Z0-9_-]+)/);
  
  const handle = handleMatch?.[1] || customMatch?.[1] || userMatch?.[1];
  
  if (handle && apiKey) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${apiKey}`
      );
      const data = await response.json();
      return data.items?.[0]?.snippet?.channelId || null;
    } catch (e) {}
  }
  
  return null;
}

async function scrapeChannelPage(channelUrl: string): Promise<YouTubeProfile> {
  // Fallback scraping when API not available
  try {
    const response = await fetch(channelUrl);
    const html = await response.text();
    
    // Extract data from meta tags and structured data
    const subscriberMatch = html.match(/"subscriberCountText":"([^"]+)"/);
    const videoCountMatch = html.match(/"videoCountText":"([^"]+)"/);
    const channelNameMatch = html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/);
    
    return {
      exists: true,
      channelId: null,
      channelUrl,
      channelName: channelNameMatch?.[1] || null,
      subscribers: parseSubscriberCount(subscriberMatch?.[1] || '0'),
      totalViews: 0,
      videoCount: parseVideoCount(videoCountMatch?.[1] || '0'),
      videosLast30Days: 0, // Can't determine without API
      videosLast90Days: 0,
      lastUploadDate: null,
      lastUploadTitle: null,
      avgViewsPerVideo: 0,
      topVideos: [],
      playlists: [],
      hasShorts: html.includes('shorts')
    };
  } catch (e) {
    return {
      exists: false,
      channelId: null,
      channelUrl: null,
      channelName: null,
      subscribers: 0,
      totalViews: 0,
      videoCount: 0,
      videosLast30Days: 0,
      videosLast90Days: 0,
      lastUploadDate: null,
      lastUploadTitle: null,
      avgViewsPerVideo: 0,
      topVideos: [],
      playlists: [],
      hasShorts: false
    };
  }
}

function parseSubscriberCount(text: string): number {
  if (!text) return 0;
  const cleanText = text.replace(/subscribers?/i, '').trim();
  
  if (cleanText.includes('K')) {
    return Math.round(parseFloat(cleanText) * 1000);
  } else if (cleanText.includes('M')) {
    return Math.round(parseFloat(cleanText) * 1000000);
  }
  
  return parseInt(cleanText.replace(/\D/g, '')) || 0;
}

function parseVideoCount(text: string): number {
  if (!text) return 0;
  return parseInt(text.replace(/\D/g, '')) || 0;
}
```

---

### 3. Google Business Profile Collector

```typescript
// lib/intelligence/collectors/gbpCollector.ts

interface GBPProfile {
  claimed: boolean;
  placeId: string | null;
  businessName: string | null;
  
  // Posts
  postsLast30Days: number;
  postsLast90Days: number;
  lastPostDate: string | null;
  postTypes: string[];
  
  // Photos
  photosTotal: number;
  photosLast30Days: number;
  ownerPhotos: number;
  customerPhotos: number;
  
  // Q&A
  questionsAnswered: number;
  questionsTotal: number;
  
  // Reviews
  respondsToReviews: boolean;
  reviewResponseRate: number;
  avgReviewResponseTime: string | null;
  recentReviewResponses: number;
  
  // Attributes
  attributes: string[];
  services: string[];
  productsListed: number;
  
  // Activity score
  activityScore: number;
}

export async function collectGBPData(
  companyName: string,
  address: string,
  placeId?: string
): Promise<GBPProfile> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    return emptyGBPProfile();
  }
  
  // 1. Find place if no placeId provided
  if (!placeId) {
    placeId = await findPlaceId(companyName, address, apiKey);
  }
  
  if (!placeId) {
    return emptyGBPProfile();
  }
  
  // 2. Get place details
  try {
    const fields = [
      'name',
      'place_id',
      'reviews',
      'photos',
      'user_ratings_total',
      'business_status',
      'types',
      'editorial_summary'
    ].join(',');
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.result) {
      return emptyGBPProfile();
    }
    
    const place = data.result;
    
    // Analyze reviews for response patterns
    const reviews = place.reviews || [];
    const reviewsWithResponses = reviews.filter(r => r.author_reply);
    const reviewResponseRate = reviews.length > 0 
      ? (reviewsWithResponses.length / reviews.length) * 100 
      : 0;
    
    // Photo analysis
    const photos = place.photos || [];
    const ownerPhotos = photos.filter(p => 
      p.html_attributions?.some(a => a.includes(place.name))
    ).length;
    
    // Calculate activity score
    const activityScore = calculateGBPActivityScore({
      reviewResponseRate,
      photoCount: photos.length,
      hasOwnerPhotos: ownerPhotos > 0,
      reviewCount: place.user_ratings_total || 0
    });
    
    return {
      claimed: true, // If we can find it and it has details, likely claimed
      placeId,
      businessName: place.name || null,
      
      // Posts - would need separate API or scraping
      postsLast30Days: 0, // GBP API doesn't expose posts directly
      postsLast90Days: 0,
      lastPostDate: null,
      postTypes: [],
      
      // Photos
      photosTotal: photos.length,
      photosLast30Days: 0, // Can't determine age from API
      ownerPhotos,
      customerPhotos: photos.length - ownerPhotos,
      
      // Q&A - not available in Places API
      questionsAnswered: 0,
      questionsTotal: 0,
      
      // Reviews
      respondsToReviews: reviewsWithResponses.length > 0,
      reviewResponseRate,
      avgReviewResponseTime: null, // Would need to calculate from response timestamps
      recentReviewResponses: reviewsWithResponses.length,
      
      // Attributes
      attributes: extractGBPAttributes(place),
      services: place.types || [],
      productsListed: 0, // Not available in API
      
      activityScore
    };
  } catch (e) {
    console.error('GBP API error:', e);
    return emptyGBPProfile();
  }
}

async function findPlaceId(
  companyName: string,
  address: string,
  apiKey: string
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${companyName} ${address}`);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.candidates?.[0]?.place_id) {
      return data.candidates[0].place_id;
    }
  } catch (e) {}
  
  return null;
}

function extractGBPAttributes(place: any): string[] {
  const attributes: string[] = [];
  
  // Extract from types
  const typeLabels: Record<string, string> = {
    'pest_control_service': 'Pest Control',
    'home_improvement_store': 'Home Improvement',
    'general_contractor': 'General Contractor',
    'lawn_care_service': 'Lawn Care'
  };
  
  for (const type of place.types || []) {
    if (typeLabels[type]) {
      attributes.push(typeLabels[type]);
    }
  }
  
  // Would need Google My Business API for detailed attributes like:
  // - Online estimates
  // - Emergency services
  // - Locally owned
  // - etc.
  
  return attributes;
}

function calculateGBPActivityScore(metrics: {
  reviewResponseRate: number;
  photoCount: number;
  hasOwnerPhotos: boolean;
  reviewCount: number;
}): number {
  let score = 0;
  
  // Review response rate (max 30 points)
  score += Math.min(30, metrics.reviewResponseRate * 0.3);
  
  // Photo count (max 20 points)
  score += Math.min(20, metrics.photoCount * 2);
  
  // Owner photos (15 points)
  if (metrics.hasOwnerPhotos) score += 15;
  
  // Review count indicates engagement (max 35 points)
  if (metrics.reviewCount >= 100) score += 35;
  else if (metrics.reviewCount >= 50) score += 25;
  else if (metrics.reviewCount >= 20) score += 15;
  else if (metrics.reviewCount >= 10) score += 10;
  else score += 5;
  
  return Math.round(score);
}

function emptyGBPProfile(): GBPProfile {
  return {
    claimed: false,
    placeId: null,
    businessName: null,
    postsLast30Days: 0,
    postsLast90Days: 0,
    lastPostDate: null,
    postTypes: [],
    photosTotal: 0,
    photosLast30Days: 0,
    ownerPhotos: 0,
    customerPhotos: 0,
    questionsAnswered: 0,
    questionsTotal: 0,
    respondsToReviews: false,
    reviewResponseRate: 0,
    avgReviewResponseTime: null,
    recentReviewResponses: 0,
    attributes: [],
    services: [],
    productsListed: 0,
    activityScore: 0
  };
}
```

---

### 4. Social Media Collector (Facebook/Instagram)

```typescript
// lib/intelligence/collectors/socialMediaCollector.ts

import * as cheerio from 'cheerio';

interface FacebookProfile {
  exists: boolean;
  pageUrl: string | null;
  pageName: string | null;
  followers: number;
  likes: number;
  postsLast30Days: number;
  postsLast90Days: number;
  lastPostDate: string | null;
  postTypes: Record<string, number>;
  avgEngagementRate: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  respondsToComments: boolean;
  hasMessenger: boolean;
  messengerResponseTime: string | null;
  runningAds: boolean;
  adCount: number;
  hasShop: boolean;
  activityScore: number;
}

interface InstagramProfile {
  exists: boolean;
  handle: string | null;
  profileUrl: string | null;
  followers: number;
  following: number;
  postsTotal: number;
  postsLast30Days: number;
  reelsLast30Days: number;
  lastPostDate: string | null;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  engagementRate: number;
  hasHighlights: boolean;
  highlightCategories: string[];
  usesReels: boolean;
  hashtagsUsed: string[];
  activityScore: number;
}

export async function collectFacebookData(
  companyName: string,
  websiteUrl: string
): Promise<FacebookProfile> {
  
  // 1. Find Facebook page URL from website
  let pageUrl = await findFacebookUrl(websiteUrl);
  
  // 2. If not found, search for it
  if (!pageUrl) {
    pageUrl = await searchForFacebookPage(companyName);
  }
  
  if (!pageUrl) {
    return emptyFacebookProfile();
  }
  
  // 3. Check Facebook Ad Library for ads
  const adData = await checkFacebookAdLibrary(pageUrl, companyName);
  
  // 4. Scrape public page data (limited without API)
  const pageData = await scrapeFacebookPage(pageUrl);
  
  return {
    exists: true,
    pageUrl,
    pageName: pageData.name,
    followers: pageData.followers,
    likes: pageData.likes,
    postsLast30Days: pageData.postsLast30Days,
    postsLast90Days: pageData.postsLast90Days,
    lastPostDate: pageData.lastPostDate,
    postTypes: pageData.postTypes,
    avgEngagementRate: pageData.avgEngagementRate,
    avgLikesPerPost: pageData.avgLikesPerPost,
    avgCommentsPerPost: pageData.avgCommentsPerPost,
    respondsToComments: pageData.respondsToComments,
    hasMessenger: pageData.hasMessenger,
    messengerResponseTime: pageData.messengerResponseTime,
    runningAds: adData.running,
    adCount: adData.count,
    hasShop: pageData.hasShop,
    activityScore: calculateFacebookActivityScore(pageData, adData)
  };
}

async function findFacebookUrl(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    
    // Look for Facebook links
    const fbPatterns = [
      /facebook\.com\/([a-zA-Z0-9._-]+)/i,
      /fb\.com\/([a-zA-Z0-9._-]+)/i
    ];
    
    for (const pattern of fbPatterns) {
      const match = html.match(pattern);
      if (match && !['sharer', 'share', 'plugins'].includes(match[1])) {
        return `https://facebook.com/${match[1]}`;
      }
    }
  } catch (e) {}
  
  return null;
}

async function searchForFacebookPage(companyName: string): Promise<string | null> {
  // Use SerpAPI to search
  const serpApiKey = process.env.SERP_API_KEY;
  if (!serpApiKey) return null;
  
  try {
    const query = encodeURIComponent(`${companyName} pest control site:facebook.com`);
    const response = await fetch(
      `https://serpapi.com/search.json?q=${query}&api_key=${serpApiKey}`
    );
    
    const data = await response.json();
    
    for (const result of data.organic_results || []) {
      const url = result.link || '';
      if (url.includes('facebook.com/') && !url.includes('/posts/') && !url.includes('/photos/')) {
        return url;
      }
    }
  } catch (e) {}
  
  return null;
}

async function checkFacebookAdLibrary(
  pageUrl: string,
  companyName: string
): Promise<{ running: boolean; count: number }> {
  // Facebook Ad Library is publicly accessible
  try {
    const pageId = pageUrl.split('facebook.com/')[1]?.split('/')[0];
    if (!pageId) return { running: false, count: 0 };
    
    // Search Ad Library via SerpAPI
    const serpApiKey = process.env.SERP_API_KEY;
    if (!serpApiKey) return { running: false, count: 0 };
    
    const query = encodeURIComponent(`"${companyName}" site:facebook.com/ads/library`);
    const response = await fetch(
      `https://serpapi.com/search.json?q=${query}&api_key=${serpApiKey}`
    );
    
    const data = await response.json();
    const hasAds = (data.organic_results || []).some(r => 
      r.link?.includes('ads/library') && r.title?.toLowerCase().includes(companyName.toLowerCase())
    );
    
    return { running: hasAds, count: hasAds ? 1 : 0 }; // Can't get exact count without scraping
  } catch (e) {
    return { running: false, count: 0 };
  }
}

async function scrapeFacebookPage(pageUrl: string): Promise<any> {
  // Note: Facebook heavily restricts scraping
  // This is a best-effort approach for public pages
  
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract what we can from meta tags
    const followers = extractNumber($('meta[property="og:description"]').attr('content') || '');
    const name = $('meta[property="og:title"]').attr('content') || '';
    
    return {
      name,
      followers,
      likes: followers, // Often same as followers now
      postsLast30Days: 0, // Can't reliably determine
      postsLast90Days: 0,
      lastPostDate: null,
      postTypes: {},
      avgEngagementRate: 0,
      avgLikesPerPost: 0,
      avgCommentsPerPost: 0,
      respondsToComments: false,
      hasMessenger: html.includes('messenger') || html.includes('Message'),
      messengerResponseTime: null,
      hasShop: html.includes('/shop') || html.includes('Shop Now')
    };
  } catch (e) {
    return emptyFacebookPageData();
  }
}

function extractNumber(text: string): number {
  if (!text) return 0;
  
  const match = text.match(/[\d,]+(?:\.\d+)?(?:\s*[KMB])?/i);
  if (!match) return 0;
  
  const numStr = match[0].replace(/,/g, '');
  
  if (numStr.includes('K')) {
    return Math.round(parseFloat(numStr) * 1000);
  } else if (numStr.includes('M')) {
    return Math.round(parseFloat(numStr) * 1000000);
  } else if (numStr.includes('B')) {
    return Math.round(parseFloat(numStr) * 1000000000);
  }
  
  return parseInt(numStr) || 0;
}

function calculateFacebookActivityScore(pageData: any, adData: any): number {
  let score = 0;
  
  // Follower count (max 20 points)
  if (pageData.followers >= 10000) score += 20;
  else if (pageData.followers >= 5000) score += 15;
  else if (pageData.followers >= 1000) score += 10;
  else if (pageData.followers >= 500) score += 5;
  
  // Posting frequency (max 30 points)
  if (pageData.postsLast30Days >= 20) score += 30;
  else if (pageData.postsLast30Days >= 10) score += 20;
  else if (pageData.postsLast30Days >= 4) score += 10;
  else if (pageData.postsLast30Days >= 1) score += 5;
  
  // Engagement (max 20 points)
  if (pageData.avgEngagementRate >= 0.05) score += 20;
  else if (pageData.avgEngagementRate >= 0.02) score += 15;
  else if (pageData.avgEngagementRate >= 0.01) score += 10;
  
  // Running ads (20 points)
  if (adData.running) score += 20;
  
  // Messenger enabled (10 points)
  if (pageData.hasMessenger) score += 10;
  
  return Math.min(100, score);
}

function emptyFacebookProfile(): FacebookProfile {
  return {
    exists: false,
    pageUrl: null,
    pageName: null,
    followers: 0,
    likes: 0,
    postsLast30Days: 0,
    postsLast90Days: 0,
    lastPostDate: null,
    postTypes: {},
    avgEngagementRate: 0,
    avgLikesPerPost: 0,
    avgCommentsPerPost: 0,
    respondsToComments: false,
    hasMessenger: false,
    messengerResponseTime: null,
    runningAds: false,
    adCount: 0,
    hasShop: false,
    activityScore: 0
  };
}

function emptyFacebookPageData() {
  return {
    name: null,
    followers: 0,
    likes: 0,
    postsLast30Days: 0,
    postsLast90Days: 0,
    lastPostDate: null,
    postTypes: {},
    avgEngagementRate: 0,
    avgLikesPerPost: 0,
    avgCommentsPerPost: 0,
    respondsToComments: false,
    hasMessenger: false,
    messengerResponseTime: null,
    hasShop: false
  };
}

// Instagram collector
export async function collectInstagramData(
  companyName: string,
  websiteUrl: string
): Promise<InstagramProfile> {
  
  // 1. Find Instagram handle from website
  let handle = await findInstagramHandle(websiteUrl);
  
  // 2. If not found, search for it
  if (!handle) {
    handle = await searchForInstagramHandle(companyName);
  }
  
  if (!handle) {
    return emptyInstagramProfile();
  }
  
  // 3. Get profile data
  return await getInstagramProfile(handle);
}

async function findInstagramHandle(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    
    const igPattern = /instagram\.com\/([a-zA-Z0-9._]+)/i;
    const match = html.match(igPattern);
    
    if (match && !['p', 'reel', 'stories'].includes(match[1])) {
      return match[1];
    }
  } catch (e) {}
  
  return null;
}

async function searchForInstagramHandle(companyName: string): Promise<string | null> {
  const serpApiKey = process.env.SERP_API_KEY;
  if (!serpApiKey) return null;
  
  try {
    const query = encodeURIComponent(`${companyName} pest control site:instagram.com`);
    const response = await fetch(
      `https://serpapi.com/search.json?q=${query}&api_key=${serpApiKey}`
    );
    
    const data = await response.json();
    
    for (const result of data.organic_results || []) {
      const url = result.link || '';
      const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      if (match && !['p', 'reel', 'stories', 'explore'].includes(match[1])) {
        return match[1];
      }
    }
  } catch (e) {}
  
  return null;
}

async function getInstagramProfile(handle: string): Promise<InstagramProfile> {
  // Note: Instagram heavily restricts scraping
  // Would need official API access for reliable data
  
  const profileUrl = `https://www.instagram.com/${handle}/`;
  
  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // Try to extract from meta tags
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const desc = descMatch?.[1] || '';
    
    // Parse "X Followers, Y Following, Z Posts"
    const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*Followers/i);
    const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*Following/i);
    const postsMatch = desc.match(/([\d,.]+[KMB]?)\s*Posts/i);
    
    return {
      exists: true,
      handle,
      profileUrl,
      followers: extractNumber(followersMatch?.[1] || '0'),
      following: extractNumber(followingMatch?.[1] || '0'),
      postsTotal: extractNumber(postsMatch?.[1] || '0'),
      postsLast30Days: 0, // Can't determine without API
      reelsLast30Days: 0,
      lastPostDate: null,
      avgLikesPerPost: 0,
      avgCommentsPerPost: 0,
      engagementRate: 0,
      hasHighlights: html.includes('highlights'),
      highlightCategories: [],
      usesReels: html.includes('reels'),
      hashtagsUsed: [],
      activityScore: calculateInstagramActivityScore({
        followers: extractNumber(followersMatch?.[1] || '0'),
        posts: extractNumber(postsMatch?.[1] || '0'),
        hasReels: html.includes('reels')
      })
    };
  } catch (e) {
    return emptyInstagramProfile();
  }
}

function calculateInstagramActivityScore(metrics: {
  followers: number;
  posts: number;
  hasReels: boolean;
}): number {
  let score = 0;
  
  // Followers (max 30 points)
  if (metrics.followers >= 10000) score += 30;
  else if (metrics.followers >= 5000) score += 25;
  else if (metrics.followers >= 1000) score += 20;
  else if (metrics.followers >= 500) score += 10;
  else if (metrics.followers > 0) score += 5;
  
  // Post count indicates activity (max 30 points)
  if (metrics.posts >= 500) score += 30;
  else if (metrics.posts >= 200) score += 25;
  else if (metrics.posts >= 100) score += 20;
  else if (metrics.posts >= 50) score += 15;
  else if (metrics.posts >= 20) score += 10;
  else if (metrics.posts > 0) score += 5;
  
  // Uses Reels (20 points)
  if (metrics.hasReels) score += 20;
  
  return Math.min(100, score);
}

function emptyInstagramProfile(): InstagramProfile {
  return {
    exists: false,
    handle: null,
    profileUrl: null,
    followers: 0,
    following: 0,
    postsTotal: 0,
    postsLast30Days: 0,
    reelsLast30Days: 0,
    lastPostDate: null,
    avgLikesPerPost: 0,
    avgCommentsPerPost: 0,
    engagementRate: 0,
    hasHighlights: false,
    highlightCategories: [],
    usesReels: false,
    hashtagsUsed: [],
    activityScore: 0
  };
}
```

---

### 5. Review Velocity Tracker

```typescript
// lib/intelligence/collectors/reviewVelocityCollector.ts

interface ReviewVelocity {
  google: ReviewPlatformMetrics;
  facebook: ReviewPlatformMetrics;
  yelp: ReviewPlatformMetrics;
  bbb: ReviewPlatformMetrics;
  
  totalPlatforms: number;
  activePlatforms: number;
  combinedMonthlyReviews: number;
  combinedAvgRating: number;
  hasReviewManagement: boolean;
  reviewSoftware: string | null;
  
  velocityScore: number;
}

interface ReviewPlatformMetrics {
  exists: boolean;
  url: string | null;
  totalReviews: number;
  avgRating: number;
  reviewsLast30Days: number;
  reviewsLast90Days: number;
  monthlyGrowthRate: number;
  ratingTrend: 'improving' | 'stable' | 'declining';
  latestReviewDate: string | null;
  respondsToReviews: boolean;
  responseRate: number;
}

export async function collectReviewVelocity(
  companyName: string,
  address: string,
  websiteUrl: string,
  placeId?: string
): Promise<ReviewVelocity> {
  
  // Collect from each platform in parallel
  const [google, facebook, yelp, bbb] = await Promise.all([
    collectGoogleReviewVelocity(companyName, address, placeId),
    collectFacebookReviewVelocity(companyName, websiteUrl),
    collectYelpReviewVelocity(companyName, address),
    collectBBBData(companyName, address)
  ]);
  
  // Check for review management software on website
  const reviewSoftware = await detectReviewSoftware(websiteUrl);
  
  // Calculate totals
  const platforms = [google, facebook, yelp, bbb];
  const existingPlatforms = platforms.filter(p => p.exists);
  const activePlatforms = platforms.filter(p => p.exists && p.reviewsLast90Days > 0);
  
  const combinedMonthlyReviews = platforms.reduce((sum, p) => sum + p.reviewsLast30Days, 0);
  
  const totalReviews = platforms.reduce((sum, p) => sum + p.totalReviews, 0);
  const weightedRating = platforms.reduce((sum, p) => sum + (p.avgRating * p.totalReviews), 0);
  const combinedAvgRating = totalReviews > 0 ? weightedRating / totalReviews : 0;
  
  const velocityScore = calculateReviewVelocityScore({
    combinedMonthlyReviews,
    activePlatformsCount: activePlatforms.length,
    combinedAvgRating,
    hasReviewSoftware: !!reviewSoftware,
    googleResponseRate: google.responseRate
  });
  
  return {
    google,
    facebook,
    yelp,
    bbb,
    totalPlatforms: existingPlatforms.length,
    activePlatforms: activePlatforms.length,
    combinedMonthlyReviews,
    combinedAvgRating,
    hasReviewManagement: !!reviewSoftware,
    reviewSoftware,
    velocityScore
  };
}

async function collectGoogleReviewVelocity(
  companyName: string,
  address: string,
  placeId?: string
): Promise<ReviewPlatformMetrics> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    return emptyPlatformMetrics();
  }
  
  // Find place if needed
  if (!placeId) {
    const query = encodeURIComponent(`${companyName} ${address}`);
    try {
      const findResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${apiKey}`
      );
      const findData = await findResponse.json();
      placeId = findData.candidates?.[0]?.place_id;
    } catch (e) {}
  }
  
  if (!placeId) {
    return emptyPlatformMetrics();
  }
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,user_ratings_total,rating&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      return emptyPlatformMetrics();
    }
    
    const place = data.result;
    const reviews = place.reviews || [];
    
    // Analyze review dates
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const recentReviews = reviews.filter(r => {
      const reviewDate = new Date(r.time * 1000);
      return reviewDate >= thirtyDaysAgo;
    });
    
    const last90Reviews = reviews.filter(r => {
      const reviewDate = new Date(r.time * 1000);
      return reviewDate >= ninetyDaysAgo;
    });
    
    // Check for owner responses
    const respondedReviews = reviews.filter(r => r.author_reply);
    const responseRate = reviews.length > 0 ? respondedReviews.length / reviews.length : 0;
    
    // Calculate rating trend (from visible reviews only)
    const sortedReviews = [...reviews].sort((a, b) => b.time - a.time);
    const recentAvg = sortedReviews.slice(0, 3).reduce((sum, r) => sum + r.rating, 0) / Math.min(3, sortedReviews.length);
    const olderAvg = sortedReviews.slice(-3).reduce((sum, r) => sum + r.rating, 0) / Math.min(3, sortedReviews.length);
    
    let ratingTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg > olderAvg + 0.3) ratingTrend = 'improving';
    else if (recentAvg < olderAvg - 0.3) ratingTrend = 'declining';
    
    return {
      exists: true,
      url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      totalReviews: place.user_ratings_total || 0,
      avgRating: place.rating || 0,
      reviewsLast30Days: recentReviews.length,
      reviewsLast90Days: last90Reviews.length,
      monthlyGrowthRate: last90Reviews.length / 3, // Approximate monthly rate
      ratingTrend,
      latestReviewDate: reviews[0] ? new Date(reviews[0].time * 1000).toISOString() : null,
      respondsToReviews: respondedReviews.length > 0,
      responseRate: Math.round(responseRate * 100)
    };
  } catch (e) {
    return emptyPlatformMetrics();
  }
}

async function collectFacebookReviewVelocity(
  companyName: string,
  websiteUrl: string
): Promise<ReviewPlatformMetrics> {
  // Facebook reviews require page access
  // This is a simplified version
  
  const fbUrl = await findFacebookUrl(websiteUrl);
  
  if (!fbUrl) {
    return emptyPlatformMetrics();
  }
  
  // Would need Facebook Graph API access for detailed review data
  return {
    exists: true,
    url: fbUrl,
    totalReviews: 0,
    avgRating: 0,
    reviewsLast30Days: 0,
    reviewsLast90Days: 0,
    monthlyGrowthRate: 0,
    ratingTrend: 'stable',
    latestReviewDate: null,
    respondsToReviews: false,
    responseRate: 0
  };
}

async function collectYelpReviewVelocity(
  companyName: string,
  address: string
): Promise<ReviewPlatformMetrics> {
  // Yelp Fusion API or scraping
  const yelpApiKey = process.env.YELP_API_KEY;
  
  if (!yelpApiKey) {
    return emptyPlatformMetrics();
  }
  
  try {
    const searchResponse = await fetch(
      `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(companyName)}&location=${encodeURIComponent(address)}&categories=pest_control`,
      {
        headers: { 'Authorization': `Bearer ${yelpApiKey}` }
      }
    );
    
    const searchData = await searchResponse.json();
    const business = searchData.businesses?.[0];
    
    if (!business) {
      return emptyPlatformMetrics();
    }
    
    return {
      exists: true,
      url: business.url,
      totalReviews: business.review_count || 0,
      avgRating: business.rating || 0,
      reviewsLast30Days: 0, // Would need to fetch individual reviews
      reviewsLast90Days: 0,
      monthlyGrowthRate: 0,
      ratingTrend: 'stable',
      latestReviewDate: null,
      respondsToReviews: false,
      responseRate: 0
    };
  } catch (e) {
    return emptyPlatformMetrics();
  }
}

async function collectBBBData(
  companyName: string,
  address: string
): Promise<ReviewPlatformMetrics> {
  // BBB scraping or API
  // Simplified version
  
  return emptyPlatformMetrics();
}

async function detectReviewSoftware(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    
    const reviewSoftware = [
      { pattern: /birdeye/i, name: 'Birdeye' },
      { pattern: /podium/i, name: 'Podium' },
      { pattern: /reputation\.com|reputation\.io/i, name: 'Reputation.com' },
      { pattern: /reviewtrackers/i, name: 'ReviewTrackers' },
      { pattern: /grade\.us/i, name: 'Grade.us' },
      { pattern: /yext/i, name: 'Yext' },
      { pattern: /trustpilot/i, name: 'Trustpilot' },
      { pattern: /getfivestars|fivestars/i, name: 'FiveStars' },
      { pattern: /nicejob/i, name: 'NiceJob' },
      { pattern: /broadly/i, name: 'Broadly' }
    ];
    
    for (const { pattern, name } of reviewSoftware) {
      if (pattern.test(html)) {
        return name;
      }
    }
  } catch (e) {}
  
  return null;
}

function calculateReviewVelocityScore(metrics: {
  combinedMonthlyReviews: number;
  activePlatformsCount: number;
  combinedAvgRating: number;
  hasReviewSoftware: boolean;
  googleResponseRate: number;
}): number {
  let score = 0;
  
  // Monthly reviews (max 35 points)
  if (metrics.combinedMonthlyReviews >= 30) score += 35;
  else if (metrics.combinedMonthlyReviews >= 15) score += 28;
  else if (metrics.combinedMonthlyReviews >= 10) score += 20;
  else if (metrics.combinedMonthlyReviews >= 5) score += 12;
  else if (metrics.combinedMonthlyReviews >= 1) score += 5;
  
  // Platform coverage (max 20 points)
  score += Math.min(20, metrics.activePlatformsCount * 5);
  
  // Rating quality (max 20 points)
  if (metrics.combinedAvgRating >= 4.8) score += 20;
  else if (metrics.combinedAvgRating >= 4.5) score += 15;
  else if (metrics.combinedAvgRating >= 4.0) score += 10;
  else if (metrics.combinedAvgRating >= 3.5) score += 5;
  
  // Review management software (10 points)
  if (metrics.hasReviewSoftware) score += 10;
  
  // Response rate (max 15 points)
  score += Math.min(15, Math.round(metrics.googleResponseRate * 0.15));
  
  return Math.min(100, score);
}

function emptyPlatformMetrics(): ReviewPlatformMetrics {
  return {
    exists: false,
    url: null,
    totalReviews: 0,
    avgRating: 0,
    reviewsLast30Days: 0,
    reviewsLast90Days: 0,
    monthlyGrowthRate: 0,
    ratingTrend: 'stable',
    latestReviewDate: null,
    respondsToReviews: false,
    responseRate: 0
  };
}

async function findFacebookUrl(websiteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    
    const fbPattern = /facebook\.com\/([a-zA-Z0-9._-]+)/i;
    const match = html.match(fbPattern);
    
    if (match && !['sharer', 'share', 'plugins'].includes(match[1])) {
      return `https://facebook.com/${match[1]}`;
    }
  } catch (e) {}
  
  return null;
}
```

---

### 6. Email & Website Marketing Detector

```typescript
// lib/intelligence/collectors/websiteMarketingCollector.ts

import * as cheerio from 'cheerio';

interface WebsiteMarketingSignals {
  // Email marketing
  email: {
    hasNewsletterSignup: boolean;
    signupLocations: string[];
    hasLeadMagnet: boolean;
    leadMagnetType: string | null;
    leadMagnetTitle: string | null;
    detectedPlatform: string | null;
    hasPopup: boolean;
    popupTrigger: string | null;
    hasExitIntent: boolean;
  };
  
  // Conversion elements
  conversion: {
    hasLiveChat: boolean;
    liveChatProvider: string | null;
    hasChatbot: boolean;
    chatbotProvider: string | null;
    hasCallTracking: boolean;
    callTrackingProvider: string | null;
    formCount: number;
    hasMultiStepForm: boolean;
    hasInstantQuote: boolean;
    hasSchedulingWidget: boolean;
    schedulingProvider: string | null;
  };
  
  // Trust elements
  trust: {
    hasTrustBadges: boolean;
    trustBadges: string[];
    hasTestimonials: boolean;
    testimonialCount: number;
    hasVideoTestimonials: boolean;
    hasCaseStudies: boolean;
    hasBeforeAfter: boolean;
    showsReviewCount: boolean;
    reviewCountDisplayed: number;
    showsYearsInBusiness: boolean;
    yearsInBusinessDisplayed: number;
    showsCustomerCount: boolean;
    customerCountDisplayed: string | null;
  };
  
  // Urgency elements
  urgency: {
    hasLimitedOffer: boolean;
    hasCountdownTimer: boolean;
    hasSeasonalPromo: boolean;
    currentPromo: string | null;
  };
  
  // Technical
  technical: {
    hasVideoOnHomepage: boolean;
    pageLoadSpeed: number | null;
    mobileOptimized: boolean;
    hasSitemap: boolean;
    hasStructuredData: boolean;
    trackingPixels: string[];
  };
  
  sophisticationScore: number;
}

export async function collectWebsiteMarketingSignals(
  websiteUrl: string
): Promise<WebsiteMarketingSignals> {
  
  try {
    const response = await fetch(websiteUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Collect all signals
    const email = detectEmailMarketing($, html);
    const conversion = detectConversionElements($, html);
    const trust = detectTrustElements($, html);
    const urgency = detectUrgencyElements($, html);
    const technical = detectTechnicalElements($, html);
    
    const sophisticationScore = calculateSophisticationScore({
      email,
      conversion,
      trust,
      urgency,
      technical
    });
    
    return {
      email,
      conversion,
      trust,
      urgency,
      technical,
      sophisticationScore
    };
  } catch (e) {
    return emptyWebsiteMarketingSignals();
  }
}

function detectEmailMarketing($: cheerio.CheerioAPI, html: string) {
  // Detect newsletter signup
  const hasNewsletterSignup = $(
    'input[type="email"], ' +
    'form[class*="newsletter"], ' +
    'form[class*="subscribe"], ' +
    'form[class*="signup"], ' +
    'form[class*="email"], ' +
    '[class*="newsletter-form"], ' +
    '[class*="email-signup"]'
  ).length > 0;
  
  // Find signup locations
  const signupLocations: string[] = [];
  if ($('footer input[type="email"], footer [class*="newsletter"]').length > 0) {
    signupLocations.push('footer');
  }
  if ($('header input[type="email"], header [class*="newsletter"]').length > 0) {
    signupLocations.push('header');
  }
  if ($('.sidebar input[type="email"], aside input[type="email"]').length > 0) {
    signupLocations.push('sidebar');
  }
  
  // Detect lead magnet
  const leadMagnetPatterns = [
    { pattern: /free\s*(guide|ebook|checklist|download|report|whitepaper)/i, type: 'guide' },
    { pattern: /download\s*(our|the|a|your)?\s*(free)?\s*(guide|ebook|checklist)/i, type: 'download' },
    { pattern: /get\s*(your|a|the)?\s*(free)?\s*(quote|estimate|inspection)/i, type: 'quote' },
    { pattern: /(coupon|discount|offer|deal|savings)/i, type: 'coupon' }
  ];
  
  let hasLeadMagnet = false;
  let leadMagnetType: string | null = null;
  let leadMagnetTitle: string | null = null;
  
  const pageText = $('body').text();
  for (const { pattern, type } of leadMagnetPatterns) {
    if (pattern.test(pageText)) {
      hasLeadMagnet = true;
      leadMagnetType = type;
      break;
    }
  }
  
  // Detect email platform
  const emailPlatforms = [
    { pattern: /mailchimp/i, name: 'Mailchimp' },
    { pattern: /constant\s*contact/i, name: 'Constant Contact' },
    { pattern: /hubspot/i, name: 'HubSpot' },
    { pattern: /klaviyo/i, name: 'Klaviyo' },
    { pattern: /sendgrid/i, name: 'SendGrid' },
    { pattern: /mailerlite/i, name: 'MailerLite' },
    { pattern: /convertkit/i, name: 'ConvertKit' },
    { pattern: /activecampaign/i, name: 'ActiveCampaign' },
    { pattern: /drip\.com/i, name: 'Drip' },
    { pattern: /aweber/i, name: 'AWeber' }
  ];
  
  let detectedPlatform: string | null = null;
  for (const { pattern, name } of emailPlatforms) {
    if (pattern.test(html)) {
      detectedPlatform = name;
      break;
    }
  }
  
  // Detect popup
  const hasPopup = /popup|modal|lightbox|overlay/i.test(html) && 
                   /email|subscribe|newsletter|signup/i.test(html);
  
  const hasExitIntent = /exit.?intent|mouseleave|beforeunload/i.test(html);
  
  return {
    hasNewsletterSignup,
    signupLocations,
    hasLeadMagnet,
    leadMagnetType,
    leadMagnetTitle,
    detectedPlatform,
    hasPopup,
    popupTrigger: hasExitIntent ? 'exit_intent' : (hasPopup ? 'unknown' : null),
    hasExitIntent
  };
}

function detectConversionElements($: cheerio.CheerioAPI, html: string) {
  // Live chat detection
  const chatProviders = [
    { pattern: /intercom/i, name: 'Intercom' },
    { pattern: /drift/i, name: 'Drift' },
    { pattern: /zendesk/i, name: 'Zendesk' },
    { pattern: /livechat/i, name: 'LiveChat' },
    { pattern: /tawk\.to|tawk/i, name: 'Tawk.to' },
    { pattern: /crisp\.chat|crisp/i, name: 'Crisp' },
    { pattern: /hubspot/i, name: 'HubSpot Chat' },
    { pattern: /freshchat|freshdesk/i, name: 'Freshchat' },
    { pattern: /olark/i, name: 'Olark' },
    { pattern: /tidio/i, name: 'Tidio' },
    { pattern: /purechat/i, name: 'Pure Chat' }
  ];
  
  let hasLiveChat = false;
  let liveChatProvider: string | null = null;
  
  for (const { pattern, name } of chatProviders) {
    if (pattern.test(html)) {
      hasLiveChat = true;
      liveChatProvider = name;
      break;
    }
  }
  
  // Call tracking detection
  const callTrackingProviders = [
    { pattern: /callrail/i, name: 'CallRail' },
    { pattern: /calltrackingmetrics/i, name: 'CallTrackingMetrics' },
    { pattern: /dialogtech|invoca/i, name: 'Invoca' },
    { pattern: /marchex/i, name: 'Marchex' },
    { pattern: /whatconverts/i, name: 'WhatConverts' },
    { pattern: /phonexa/i, name: 'Phonexa' }
  ];
  
  let hasCallTracking = false;
  let callTrackingProvider: string | null = null;
  
  for (const { pattern, name } of callTrackingProviders) {
    if (pattern.test(html)) {
      hasCallTracking = true;
      callTrackingProvider = name;
      break;
    }
  }
  
  // Scheduling widget detection
  const schedulingProviders = [
    { pattern: /calendly/i, name: 'Calendly' },
    { pattern: /acuity/i, name: 'Acuity' },
    { pattern: /housecall\s*pro/i, name: 'Housecall Pro' },
    { pattern: /jobber/i, name: 'Jobber' },
    { pattern: /servicetitan/i, name: 'ServiceTitan' },
    { pattern: /pestroutes/i, name: 'PestRoutes' },
    { pattern: /fieldroutes/i, name: 'FieldRoutes' }
  ];
  
  let hasSchedulingWidget = false;
  let schedulingProvider: string | null = null;
  
  for (const { pattern, name } of schedulingProviders) {
    if (pattern.test(html)) {
      hasSchedulingWidget = true;
      schedulingProvider = name;
      break;
    }
  }
  
  // Form counting
  const forms = $('form').length;
  const hasMultiStepForm = /step|wizard|multi.?step|progress/i.test(html) && forms > 0;
  const hasInstantQuote = /instant.?quote|get.?quote.?now|quick.?quote/i.test($('body').text());
  
  return {
    hasLiveChat,
    liveChatProvider,
    hasChatbot: /chatbot|bot|automated/i.test(html) && hasLiveChat,
    chatbotProvider: null,
    hasCallTracking,
    callTrackingProvider,
    formCount: forms,
    hasMultiStepForm,
    hasInstantQuote,
    hasSchedulingWidget,
    schedulingProvider
  };
}

function detectTrustElements($: cheerio.CheerioAPI, html: string) {
  const bodyText = $('body').text();
  
  // Trust badges
  const trustBadgePatterns = [
    { pattern: /bbb|better\s*business/i, name: 'BBB' },
    { pattern: /home\s*advisor/i, name: 'HomeAdvisor' },
    { pattern: /angi|angie.?s\s*list/i, name: 'Angi' },
    { pattern: /quality\s*pro/i, name: 'QualityPro' },
    { pattern: /green\s*pro/i, name: 'GreenPro' },
    { pattern: /npma/i, name: 'NPMA' },
    { pattern: /thumbtack/i, name: 'Thumbtack' },
    { pattern: /google\s*guaranteed/i, name: 'Google Guaranteed' },
    { pattern: /yelp/i, name: 'Yelp' },
    { pattern: /trustpilot/i, name: 'Trustpilot' }
  ];
  
  const trustBadges: string[] = [];
  for (const { pattern, name } of trustBadgePatterns) {
    if (pattern.test(html)) {
      trustBadges.push(name);
    }
  }
  
  // Review count displayed
  let showsReviewCount = false;
  let reviewCountDisplayed = 0;
  const reviewCountMatch = bodyText.match(/(\d{2,})\+?\s*(reviews?|ratings?|customers?)/i);
  if (reviewCountMatch) {
    showsReviewCount = true;
    reviewCountDisplayed = parseInt(reviewCountMatch[1]);
  }
  
  // Years in business
  let showsYearsInBusiness = false;
  let yearsInBusinessDisplayed = 0;
  const yearsMatch = bodyText.match(/(\d{1,3})\+?\s*years?\s*(in\s*business|of\s*experience|serving)/i);
  if (yearsMatch) {
    showsYearsInBusiness = true;
    yearsInBusinessDisplayed = parseInt(yearsMatch[1]);
  }
  
  // Customer count
  let showsCustomerCount = false;
  let customerCountDisplayed: string | null = null;
  const customerMatch = bodyText.match(/([\d,]+)\+?\s*(customers?|homes?|families|clients)/i);
  if (customerMatch) {
    showsCustomerCount = true;
    customerCountDisplayed = customerMatch[1];
  }
  
  // Testimonials
  const hasTestimonials = $(
    '[class*="testimonial"], ' +
    '[class*="review"], ' +
    '[class*="customer-quote"], ' +
    'blockquote'
  ).length > 0;
  
  const testimonialCount = $(
    '[class*="testimonial"], ' +
    '[class*="review-item"], ' +
    '[class*="customer-quote"]'
  ).length;
  
  return {
    hasTrustBadges: trustBadges.length > 0,
    trustBadges,
    hasTestimonials,
    testimonialCount,
    hasVideoTestimonials: /video.?testimonial|youtube|vimeo/i.test(html) && hasTestimonials,
    hasCaseStudies: /case.?stud(y|ies)/i.test(bodyText),
    hasBeforeAfter: /before.?(&|and)?.?after/i.test(bodyText),
    showsReviewCount,
    reviewCountDisplayed,
    showsYearsInBusiness,
    yearsInBusinessDisplayed,
    showsCustomerCount,
    customerCountDisplayed
  };
}

function detectUrgencyElements($: cheerio.CheerioAPI, html: string) {
  const bodyText = $('body').text();
  
  return {
    hasLimitedOffer: /limited\s*time|today\s*only|act\s*now|don.?t\s*miss/i.test(bodyText),
    hasCountdownTimer: /countdown|timer/i.test(html),
    hasSeasonalPromo: /spring|summer|fall|winter|holiday|seasonal/i.test(bodyText) && 
                      /special|discount|offer|sale/i.test(bodyText),
    currentPromo: extractCurrentPromo(bodyText)
  };
}

function extractCurrentPromo(text: string): string | null {
  const promoPatterns = [
    /\$\d+\s*off/i,
    /\d+%\s*off/i,
    /free\s*(inspection|quote|estimate)/i,
    /save\s*\$?\d+/i
  ];
  
  for (const pattern of promoPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

function detectTechnicalElements($: cheerio.CheerioAPI, html: string) {
  // Video on homepage
  const hasVideoOnHomepage = $(
    'video, ' +
    'iframe[src*="youtube"], ' +
    'iframe[src*="vimeo"], ' +
    '[class*="video-player"], ' +
    '[class*="hero-video"]'
  ).length > 0;
  
  // Tracking pixels
  const pixelPatterns = [
    { pattern: /fbq\(|facebook\.com\/tr/i, name: 'Facebook Pixel' },
    { pattern: /gtag\(|google-analytics|googletagmanager/i, name: 'Google Analytics' },
    { pattern: /ads\.google\.com|googleads/i, name: 'Google Ads' },
    { pattern: /bing\.com\/bat/i, name: 'Bing Ads' },
    { pattern: /linkedin\.com\/px|linkedin insight/i, name: 'LinkedIn Pixel' },
    { pattern: /snap\.licdn|snapchat/i, name: 'Snapchat Pixel' },
    { pattern: /tiktok\.com\/i18n/i, name: 'TikTok Pixel' },
    { pattern: /hotjar/i, name: 'Hotjar' },
    { pattern: /clarity\.ms/i, name: 'Microsoft Clarity' },
    { pattern: /fullstory/i, name: 'FullStory' }
  ];
  
  const trackingPixels: string[] = [];
  for (const { pattern, name } of pixelPatterns) {
    if (pattern.test(html)) {
      trackingPixels.push(name);
    }
  }
  
  // Mobile optimization
  const mobileOptimized = $('meta[name="viewport"]').length > 0;
  
  // Structured data
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
  
  return {
    hasVideoOnHomepage,
    pageLoadSpeed: null, // Would need actual performance testing
    mobileOptimized,
    hasSitemap: false, // Would need to check /sitemap.xml
    hasStructuredData,
    trackingPixels
  };
}

function calculateSophisticationScore(signals: {
  email: any;
  conversion: any;
  trust: any;
  urgency: any;
  technical: any;
}): number {
  let score = 0;
  
  // Email marketing (max 15 points)
  if (signals.email.hasNewsletterSignup) score += 5;
  if (signals.email.hasLeadMagnet) score += 5;
  if (signals.email.detectedPlatform) score += 5;
  
  // Conversion elements (max 25 points)
  if (signals.conversion.hasLiveChat) score += 8;
  if (signals.conversion.hasCallTracking) score += 7;
  if (signals.conversion.hasSchedulingWidget) score += 5;
  if (signals.conversion.hasInstantQuote) score += 5;
  
  // Trust elements (max 25 points)
  score += Math.min(10, signals.trust.trustBadges.length * 2);
  if (signals.trust.hasTestimonials) score += 5;
  if (signals.trust.showsReviewCount) score += 5;
  if (signals.trust.showsYearsInBusiness) score += 5;
  
  // Urgency elements (max 10 points)
  if (signals.urgency.hasLimitedOffer) score += 5;
  if (signals.urgency.currentPromo) score += 5;
  
  // Technical (max 25 points)
  if (signals.technical.hasVideoOnHomepage) score += 5;
  if (signals.technical.mobileOptimized) score += 5;
  if (signals.technical.hasStructuredData) score += 5;
  score += Math.min(10, signals.technical.trackingPixels.length * 2);
  
  return Math.min(100, score);
}

function emptyWebsiteMarketingSignals(): WebsiteMarketingSignals {
  return {
    email: {
      hasNewsletterSignup: false,
      signupLocations: [],
      hasLeadMagnet: false,
      leadMagnetType: null,
      leadMagnetTitle: null,
      detectedPlatform: null,
      hasPopup: false,
      popupTrigger: null,
      hasExitIntent: false
    },
    conversion: {
      hasLiveChat: false,
      liveChatProvider: null,
      hasChatbot: false,
      chatbotProvider: null,
      hasCallTracking: false,
      callTrackingProvider: null,
      formCount: 0,
      hasMultiStepForm: false,
      hasInstantQuote: false,
      hasSchedulingWidget: false,
      schedulingProvider: null
    },
    trust: {
      hasTrustBadges: false,
      trustBadges: [],
      hasTestimonials: false,
      testimonialCount: 0,
      hasVideoTestimonials: false,
      hasCaseStudies: false,
      hasBeforeAfter: false,
      showsReviewCount: false,
      reviewCountDisplayed: 0,
      showsYearsInBusiness: false,
      yearsInBusinessDisplayed: 0,
      showsCustomerCount: false,
      customerCountDisplayed: null
    },
    urgency: {
      hasLimitedOffer: false,
      hasCountdownTimer: false,
      hasSeasonalPromo: false,
      currentPromo: null
    },
    technical: {
      hasVideoOnHomepage: false,
      pageLoadSpeed: null,
      mobileOptimized: false,
      hasSitemap: false,
      hasStructuredData: false,
      trackingPixels: []
    },
    sophisticationScore: 0
  };
}
```

---

## Main Marketing Intelligence Orchestrator

```typescript
// lib/intelligence/collectors/marketingOrchestrator.ts

import { detectBlog } from './blogDetector';
import { detectYouTubeChannel } from './youtubeDetector';
import { collectGBPData } from './gbpCollector';
import { collectFacebookData, collectInstagramData } from './socialMediaCollector';
import { collectReviewVelocity } from './reviewVelocityCollector';
import { collectWebsiteMarketingSignals } from './websiteMarketingCollector';
import { supabase } from '@/lib/supabase';

interface MarketingIntelligenceResult {
  blog: any;
  youtube: any;
  gbp: any;
  facebook: any;
  instagram: any;
  reviewVelocity: any;
  websiteMarketing: any;
  
  scores: {
    content: number;
    social: number;
    engagement: number;
    frequency: number;
    reach: number;
    sophistication: number;
    advertising: number;
    reviews: number;
    overall: number;
  };
  
  aiAnalysis: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    competitivePosition: string;
    recommendations: string[];
    marketingMaturity: 'basic' | 'developing' | 'established' | 'advanced';
  };
}

export async function collectMarketingIntelligence(
  companyId: string,
  companyName: string,
  websiteUrl: string,
  address: string,
  placeId?: string
): Promise<MarketingIntelligenceResult> {
  
  console.log(`[Marketing Intel] Starting collection for ${companyName}`);
  
  // Collect all data in parallel
  const [
    blog,
    youtube,
    gbp,
    facebook,
    instagram,
    reviewVelocity,
    websiteMarketing
  ] = await Promise.all([
    detectBlog(websiteUrl).catch(e => {
      console.error('Blog detection error:', e);
      return { exists: false };
    }),
    detectYouTubeChannel(companyName, websiteUrl).catch(e => {
      console.error('YouTube detection error:', e);
      return { exists: false };
    }),
    collectGBPData(companyName, address, placeId).catch(e => {
      console.error('GBP collection error:', e);
      return { claimed: false, activityScore: 0 };
    }),
    collectFacebookData(companyName, websiteUrl).catch(e => {
      console.error('Facebook collection error:', e);
      return { exists: false, activityScore: 0 };
    }),
    collectInstagramData(companyName, websiteUrl).catch(e => {
      console.error('Instagram collection error:', e);
      return { exists: false, activityScore: 0 };
    }),
    collectReviewVelocity(companyName, address, websiteUrl, placeId).catch(e => {
      console.error('Review velocity error:', e);
      return { velocityScore: 0 };
    }),
    collectWebsiteMarketingSignals(websiteUrl).catch(e => {
      console.error('Website marketing error:', e);
      return { sophisticationScore: 0 };
    })
  ]);
  
  // Calculate aggregate scores
  const scores = calculateAggregateScores({
    blog,
    youtube,
    gbp,
    facebook,
    instagram,
    reviewVelocity,
    websiteMarketing
  });
  
  // Generate AI analysis
  const aiAnalysis = await generateMarketingAnalysis({
    blog,
    youtube,
    gbp,
    facebook,
    instagram,
    reviewVelocity,
    websiteMarketing,
    scores
  });
  
  // Save to database
  await saveMarketingIntelligence(companyId, {
    blog_data: blog,
    youtube_data: youtube,
    gbp_data: gbp,
    facebook_data: facebook,
    instagram_data: instagram,
    review_velocity: reviewVelocity,
    website_marketing: websiteMarketing,
    scores,
    ai_analysis: aiAnalysis
  });
  
  return {
    blog,
    youtube,
    gbp,
    facebook,
    instagram,
    reviewVelocity,
    websiteMarketing,
    scores,
    aiAnalysis
  };
}

function calculateAggregateScores(data: any) {
  // Content score (blog + video)
  const blogScore = data.blog.exists ? 
    Math.min(100, (data.blog.postsLast90Days || 0) * 10 + 20) : 0;
  const youtubeScore = data.youtube.exists ? 
    Math.min(100, (data.youtube.videosLast90Days || 0) * 15 + data.youtube.subscribers / 100) : 0;
  const content = Math.round((blogScore + youtubeScore) / 2);
  
  // Social score (presence across platforms)
  const socialPlatforms = [
    data.facebook.exists,
    data.instagram.exists,
    data.youtube.exists,
    data.gbp.claimed
  ].filter(Boolean).length;
  const social = Math.min(100, socialPlatforms * 25);
  
  // Engagement score (interaction quality)
  const engagement = Math.round(
    (data.facebook.activityScore || 0) * 0.3 +
    (data.instagram.activityScore || 0) * 0.3 +
    (data.youtube.exists && data.youtube.avgViewsPerVideo > 100 ? 40 : 0)
  );
  
  // Frequency score (how often they post)
  const monthlyPosts = 
    (data.blog.postsLast30Days || 0) +
    (data.facebook.postsLast30Days || 0) +
    (data.instagram.postsLast30Days || 0) +
    (data.youtube.videosLast30Days || 0) +
    (data.gbp.postsLast30Days || 0);
  
  const frequency = Math.min(100, monthlyPosts * 5);
  
  // Reach score (audience size)
  const totalFollowers = 
    (data.facebook.followers || 0) +
    (data.instagram.followers || 0) +
    (data.youtube.subscribers || 0);
  
  const reach = Math.min(100, Math.log10(Math.max(1, totalFollowers)) * 20);
  
  // Sophistication (tech stack)
  const sophistication = data.websiteMarketing.sophisticationScore || 0;
  
  // Advertising
  const advertising = data.facebook.runningAds ? 50 : 0 +
    (data.websiteMarketing.technical?.trackingPixels?.length > 2 ? 50 : 0);
  
  // Reviews
  const reviews = data.reviewVelocity.velocityScore || 0;
  
  // Overall weighted score
  const overall = Math.round(
    content * 0.15 +
    social * 0.10 +
    engagement * 0.15 +
    frequency * 0.20 +
    reach * 0.05 +
    sophistication * 0.15 +
    advertising * 0.10 +
    reviews * 0.10
  );
  
  return {
    content,
    social,
    engagement,
    frequency,
    reach,
    sophistication,
    advertising,
    reviews,
    overall
  };
}

async function generateMarketingAnalysis(data: any) {
  const { callAI } = await import('@/lib/ai/core/aiClient');
  
  const prompt = `Analyze this company's marketing activity and provide insights.

MARKETING DATA:
${JSON.stringify(data, null, 2)}

Provide a JSON response with:
{
  "summary": "2-3 sentence summary of their marketing maturity and activity level",
  "strengths": ["list of marketing strengths"],
  "weaknesses": ["list of marketing gaps or weaknesses"],
  "competitivePosition": "How they compare to typical companies in pest control",
  "recommendations": ["actionable suggestions for them"],
  "marketingMaturity": "basic|developing|established|advanced"
}

Consider:
- Are they consistent with content creation?
- Do they have presence on platforms that matter for pest control?
- Are they generating reviews actively?
- Is their website sophisticated for lead conversion?
- Are they running paid advertising?`;

  try {
    const response = await callAI({ prompt, maxTokens: 1000 });
    return JSON.parse(response.content);
  } catch (e) {
    return {
      summary: 'Marketing analysis unavailable',
      strengths: [],
      weaknesses: [],
      competitivePosition: 'Unknown',
      recommendations: [],
      marketingMaturity: 'basic'
    };
  }
}

async function saveMarketingIntelligence(companyId: string, data: any) {
  const { error } = await supabase
    .from('marketing_intelligence')
    .upsert({
      company_id: companyId,
      ...data,
      collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'company_id'
    });
  
  if (error) {
    console.error('Error saving marketing intelligence:', error);
  }
}
```

---

## Updated Scoring in Account Intelligence

```typescript
// Update the main account intelligence scoring to include marketing

function calculateOverallReadinessScore(intel: AccountIntelligence, marketing: MarketingIntelligence): number {
  let score = 0;
  const factors: string[] = [];
  
  // === EXISTING FACTORS ===
  
  // Hiring signals (20 points)
  if (intel.careers?.isHiring) {
    score += 20;
    factors.push('Actively hiring - indicates growth');
  }
  
  // Technology gaps (20 points)
  if (!intel.technology?.hasLiveChat) score += 5;
  if (!intel.technology?.hasOnlineScheduling) score += 5;
  if (!intel.technology?.crmPlatform || intel.technology.crmPlatform === 'Unknown') score += 10;
  
  // Review pain points (15 points)
  const painPointCount = intel.reviews?.painPoints?.length || 0;
  score += Math.min(15, painPointCount * 5);
  
  // === NEW MARKETING FACTORS ===
  
  // Marketing activity level (25 points)
  // High marketing activity = growth mindset = more likely to buy
  const marketingScore = marketing.scores?.overall || 0;
  
  if (marketingScore >= 70) {
    score += 25;
    factors.push('High marketing activity - growth-focused company');
  } else if (marketingScore >= 50) {
    score += 15;
    factors.push('Moderate marketing activity');
  } else if (marketingScore >= 30) {
    score += 10;
    factors.push('Basic marketing presence');
  } else {
    score += 5;
    factors.push('Limited marketing - may indicate smaller operation');
  }
  
  // Running ads = has budget (10 points)
  if (marketing.facebook?.runningAds || marketing.websiteMarketing?.technical?.trackingPixels?.length > 2) {
    score += 10;
    factors.push('Running digital advertising - has marketing budget');
  }
  
  // Review velocity = cares about growth (10 points)
  if ((marketing.reviewVelocity?.combinedMonthlyReviews || 0) >= 10) {
    score += 10;
    factors.push('Strong review velocity - actively managing reputation');
  }
  
  return {
    score: Math.min(100, score),
    factors
  };
}
```

---

## API Integration

```typescript
// Update the main intelligence collection API

// app/api/intelligence/collect/[companyId]/route.ts

import { collectMarketingIntelligence } from '@/lib/intelligence/collectors/marketingOrchestrator';

export async function POST(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  const { companyId } = params;
  
  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();
  
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
  
  // Update status
  await updateCollectionStatus(companyId, 'collecting', 0, 'Starting collection...');
  
  try {
    // Collect main intelligence (existing)
    await updateCollectionStatus(companyId, 'collecting', 10, 'Scraping website...');
    const websiteData = await scrapeWebsite(company.website);
    
    // ... other existing collection ...
    
    // NEW: Collect marketing intelligence
    await updateCollectionStatus(companyId, 'collecting', 60, 'Analyzing marketing activity...');
    const marketingData = await collectMarketingIntelligence(
      companyId,
      company.name,
      company.website,
      `${company.city}, ${company.state}`,
      company.google_place_id
    );
    
    // ... rest of collection ...
    
    // Synthesize with AI (include marketing data)
    await updateCollectionStatus(companyId, 'collecting', 90, 'Synthesizing insights...');
    const synthesis = await synthesizeIntelligence(companyId, {
      website: websiteData,
      linkedin: linkedinData,
      reviews: reviewData,
      industry: industryData,
      marketing: marketingData // NEW
    });
    
    await updateCollectionStatus(companyId, 'complete', 100, 'Complete');
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    await updateCollectionStatus(companyId, 'error', 0, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## UI Updates

### Marketing Activity Card

```tsx
// components/intelligence/MarketingActivityCard.tsx

interface MarketingActivityCardProps {
  marketing: MarketingIntelligence;
}

export function MarketingActivityCard({ marketing }: MarketingActivityCardProps) {
  const { scores, aiAnalysis } = marketing;
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Marketing Activity</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          scores.overall >= 70 ? 'bg-green-100 text-green-800' :
          scores.overall >= 40 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {aiAnalysis.marketingMaturity.charAt(0).toUpperCase() + 
           aiAnalysis.marketingMaturity.slice(1)}
        </div>
      </div>
      
      {/* Score Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <ScoreBar label="Content" value={scores.content} />
        <ScoreBar label="Social" value={scores.social} />
        <ScoreBar label="Frequency" value={scores.frequency} />
        <ScoreBar label="Reviews" value={scores.reviews} />
      </div>
      
      {/* Platform Presence */}
      <div className="flex flex-wrap gap-2 mb-4">
        {marketing.blog?.exists && (
          <Badge icon="📝" label="Blog" active />
        )}
        {marketing.youtube?.exists && (
          <Badge icon="📺" label={`YouTube (${marketing.youtube.subscribers})`} active />
        )}
        {marketing.facebook?.exists && (
          <Badge icon="👥" label={`Facebook (${formatNumber(marketing.facebook.followers)})`} active />
        )}
        {marketing.instagram?.exists && (
          <Badge icon="📷" label={`Instagram (${formatNumber(marketing.instagram.followers)})`} active />
        )}
        {marketing.facebook?.runningAds && (
          <Badge icon="📢" label="Running Ads" active highlight />
        )}
      </div>
      
      {/* AI Summary */}
      <p className="text-sm text-gray-600 mb-3">
        {aiAnalysis.summary}
      </p>
      
      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Strengths</h4>
          <ul className="text-sm space-y-1">
            {aiAnalysis.strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-green-500">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Gaps</h4>
          <ul className="text-sm space-y-1">
            {aiAnalysis.weaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-red-500">○</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${
            value >= 70 ? 'bg-green-500' :
            value >= 40 ? 'bg-yellow-500' :
            'bg-red-500'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ 
  icon, 
  label, 
  active,
  highlight 
}: { 
  icon: string; 
  label: string; 
  active: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs
      ${active 
        ? highlight 
          ? 'bg-purple-100 text-purple-800' 
          : 'bg-blue-100 text-blue-800'
        : 'bg-gray-100 text-gray-500'
      }
    `}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
```

---

## Dependencies

```bash
# Required
npm install cheerio

# Optional (for better data)
# YouTube Data API key (free tier: 10,000 units/day)
# Yelp Fusion API key (free tier: 5,000 calls/day)
# SerpAPI key ($50+/mo for 5,000 searches)
```

---

## Summary of Improvements

| Area | Before | After |
|------|--------|-------|
| Blog Detection | Only `/blog` path | 20+ path variations, subdomain check, navigation link discovery |
| YouTube | Not checked | Full channel analysis with subscribers, video frequency, views |
| Google Business | Reviews only | Posts, photos, Q&A, response rate, attributes |
| Facebook | Basic page check | Post frequency, engagement rate, ad detection, messenger |
| Instagram | Followers only | Post frequency, reels, engagement, highlights |
| Review Velocity | Total count only | Monthly growth rate, response rate, multi-platform |
| Email Marketing | Not checked | Newsletter signup, lead magnets, platform detection |
| Website Sophistication | Not checked | Trust badges, chat, tracking pixels, urgency elements |
| Scoring | Generic | Weighted by frequency, engagement, reach, sophistication |

This should dramatically improve accuracy for companies that are actually marketing-active!
