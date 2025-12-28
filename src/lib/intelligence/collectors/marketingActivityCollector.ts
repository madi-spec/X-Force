/**
 * Marketing Activity Collector
 * Analyzes social media activity, blog posts, and content marketing
 * Uses existing Facebook data and website data to assess marketing maturity
 */

import { BaseCollector } from './base';
import type {
  MarketingActivityData,
  CollectorOptions,
  CollectorResult,
  FacebookData,
  EnhancedWebsiteData,
} from '../types';

// ============================================
// MARKETING ACTIVITY COLLECTOR
// ============================================

export class MarketingActivityCollector extends BaseCollector<MarketingActivityData, CollectorOptions> {
  readonly sourceType = 'marketing_activity' as const;
  readonly displayName = 'Marketing Activity';

  /**
   * Main collection method
   * This collector synthesizes data from other collectors (Facebook, Website)
   * rather than making its own API calls
   */
  async collect(
    companyName: string,
    _domain: string | null,
    _options: CollectorOptions = {}
  ): Promise<CollectorResult<MarketingActivityData>> {
    const startTime = Date.now();

    // This collector doesn't make external calls - it synthesizes data
    // Return a skeleton that will be populated from other collector data
    const data: MarketingActivityData = {
      companyName,
      facebook: {
        postsLast30Days: 0,
        avgEngagementRate: 0,
        topPostTypes: [],
        lastPostDate: null,
      },
      linkedin: {
        followerCount: null,
        postsLast30Days: 0,
        employeePostingActivity: 'low',
        companyUpdatesRecent: false,
      },
      blog: {
        postsLast90Days: 0,
        avgPostLength: 0,
        topics: [],
        hasEmailCapture: false,
      },
      marketingMaturity: 'minimal',
      primaryChannels: [],
      contentStrategy: 'No marketing activity detected',
      collectedAt: new Date().toISOString(),
    };

    return this.successResult(data, Date.now() - startTime);
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: MarketingActivityData): number {
    if (!data) return 0;

    let score = 0;

    // Facebook activity
    if (data.facebook.postsLast30Days > 0) score += 15;
    if (data.facebook.avgEngagementRate > 0.01) score += 10;

    // LinkedIn activity
    if (data.linkedin.followerCount && data.linkedin.followerCount > 100) score += 10;
    if (data.linkedin.postsLast30Days > 0) score += 10;

    // Blog activity
    if (data.blog.postsLast90Days > 0) score += 15;
    if (data.blog.topics.length > 0) score += 10;

    // Marketing maturity
    if (data.marketingMaturity === 'sophisticated') score += 20;
    else if (data.marketingMaturity === 'active') score += 15;
    else if (data.marketingMaturity === 'basic') score += 10;

    // Primary channels
    score += Math.min(10, data.primaryChannels.length * 3);

    return Math.min(100, score);
  }

  /**
   * Enhance marketing data from Facebook collector results
   */
  enrichFromFacebook(data: MarketingActivityData, facebookData: FacebookData): void {
    if (!facebookData) return;

    // Count posts in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentPosts = facebookData.recentPosts.filter((post) => {
      if (!post.date) return false;
      return new Date(post.date).getTime() > thirtyDaysAgo;
    });

    data.facebook.postsLast30Days = recentPosts.length;

    // Calculate engagement rate
    if (facebookData.followers && facebookData.followers > 0 && recentPosts.length > 0) {
      const totalEngagement = recentPosts.reduce((sum, post) => {
        return sum + (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
      }, 0);
      data.facebook.avgEngagementRate = totalEngagement / recentPosts.length / facebookData.followers;
    }

    // Identify top post types
    const postTypeCounts: Record<string, number> = {};
    facebookData.recentPosts.forEach((post) => {
      postTypeCounts[post.type] = (postTypeCounts[post.type] || 0) + 1;
    });
    data.facebook.topPostTypes = Object.entries(postTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type as 'image' | 'video' | 'link' | 'text');

    // Last post date
    if (facebookData.recentPosts.length > 0) {
      const sortedPosts = [...facebookData.recentPosts]
        .filter((p) => p.date)
        .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
      data.facebook.lastPostDate = sortedPosts[0]?.date || null;
    }

    // Add Facebook to primary channels if active
    if (recentPosts.length >= 4) {
      if (!data.primaryChannels.includes('Facebook')) {
        data.primaryChannels.push('Facebook');
      }
    }
  }

  /**
   * Enhance marketing data from website collector results
   */
  enrichFromWebsite(data: MarketingActivityData, websiteData: EnhancedWebsiteData): void {
    if (!websiteData) return;

    // Blog posts in last 90 days
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const recentBlogPosts = websiteData.blogPosts.filter((post) => {
      if (!post.date) return false;
      return new Date(post.date).getTime() > ninetyDaysAgo;
    });

    data.blog.postsLast90Days = recentBlogPosts.length;

    // Average post length (from excerpts)
    if (recentBlogPosts.length > 0) {
      const totalLength = recentBlogPosts.reduce((sum, post) => {
        return sum + (post.excerpt?.length || 0);
      }, 0);
      data.blog.avgPostLength = Math.round(totalLength / recentBlogPosts.length);
    }

    // Topics from enhanced website data
    data.blog.topics = websiteData.contentTopics || [];

    // Check for email capture (common patterns)
    const hasEmailCapture = websiteData.crawledUrls.some((url) =>
      url.includes('newsletter') || url.includes('subscribe')
    );
    data.blog.hasEmailCapture = hasEmailCapture;

    // Add Blog to primary channels if active
    if (recentBlogPosts.length >= 3) {
      if (!data.primaryChannels.includes('Blog')) {
        data.primaryChannels.push('Blog');
      }
    }

    // Check for LinkedIn presence
    if (websiteData.socialLinks.linkedin) {
      if (!data.primaryChannels.includes('LinkedIn')) {
        data.primaryChannels.push('LinkedIn');
      }
    }
  }

  /**
   * Calculate overall marketing maturity and strategy assessment
   */
  assessMarketingMaturity(data: MarketingActivityData): void {
    let maturityScore = 0;

    // Facebook activity (0-25 points)
    if (data.facebook.postsLast30Days >= 12) maturityScore += 25; // 3+ per week
    else if (data.facebook.postsLast30Days >= 4) maturityScore += 15; // 1+ per week
    else if (data.facebook.postsLast30Days >= 1) maturityScore += 5;

    // LinkedIn activity (0-25 points)
    if (data.linkedin.postsLast30Days >= 8) maturityScore += 25;
    else if (data.linkedin.postsLast30Days >= 4) maturityScore += 15;
    else if (data.linkedin.postsLast30Days >= 1) maturityScore += 5;

    // Blog activity (0-25 points)
    if (data.blog.postsLast90Days >= 12) maturityScore += 25; // Weekly
    else if (data.blog.postsLast90Days >= 6) maturityScore += 15; // Bi-weekly
    else if (data.blog.postsLast90Days >= 3) maturityScore += 10; // Monthly
    else if (data.blog.postsLast90Days >= 1) maturityScore += 5;

    // Channel diversity (0-25 points)
    maturityScore += Math.min(25, data.primaryChannels.length * 8);

    // Determine maturity level
    if (maturityScore >= 70) {
      data.marketingMaturity = 'sophisticated';
    } else if (maturityScore >= 40) {
      data.marketingMaturity = 'active';
    } else if (maturityScore >= 15) {
      data.marketingMaturity = 'basic';
    } else {
      data.marketingMaturity = 'minimal';
    }

    // Generate content strategy assessment
    data.contentStrategy = this.generateStrategyAssessment(data);
  }

  /**
   * Generate human-readable strategy assessment
   */
  private generateStrategyAssessment(data: MarketingActivityData): string {
    const parts: string[] = [];

    if (data.marketingMaturity === 'sophisticated') {
      parts.push('This company has a sophisticated marketing presence with consistent activity across multiple channels.');
    } else if (data.marketingMaturity === 'active') {
      parts.push('This company maintains an active marketing presence with regular content publishing.');
    } else if (data.marketingMaturity === 'basic') {
      parts.push('This company has basic marketing activity with room for growth.');
    } else {
      parts.push('This company has minimal marketing presence and may be receptive to marketing automation solutions.');
    }

    // Channel-specific insights
    if (data.facebook.postsLast30Days >= 8) {
      parts.push('Strong Facebook engagement suggests they value social proof and community building.');
    } else if (data.facebook.postsLast30Days === 0) {
      parts.push('No recent Facebook activity - may have abandoned the channel or lack social media resources.');
    }

    if (data.blog.postsLast90Days >= 6) {
      parts.push('Active blog presence indicates they understand content marketing value.');
    }

    if (data.primaryChannels.length >= 3) {
      parts.push('Multi-channel approach shows marketing sophistication.');
    } else if (data.primaryChannels.length === 0) {
      parts.push('No active marketing channels detected.');
    }

    return parts.join(' ');
  }
}

// Export singleton
export const marketingActivityCollector = new MarketingActivityCollector();
