/**
 * Marketing Intelligence Orchestrator
 * Coordinates all marketing-focused collectors and calculates aggregate scores
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { blogDetector, type BlogDetectionResult } from './blogDetector';
import { youtubeDetector, type YouTubeProfile } from './youtubeDetector';
import { websiteMarketingCollector, type WebsiteMarketingSignals } from './websiteMarketingCollector';
import { facebookCollector } from './facebookCollector';
import { googleReviewsCollector } from './googleReviewsCollector';
import type {
  FacebookData,
  GoogleReviewsData,
  CollectorOptions,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface MarketingIntelligenceResult {
  companyId: string;
  collectedAt: string;

  // Individual collector results
  blog: BlogDetectionResult | null;
  youtube: YouTubeProfile | null;
  gbp: GBPActivityData | null;
  facebook: FacebookActivityData | null;
  instagram: InstagramActivityData | null;
  reviewVelocity: ReviewVelocityData | null;
  websiteMarketing: WebsiteMarketingSignals | null;

  // Calculated scores
  scores: MarketingScores;

  // AI analysis (to be generated)
  aiAnalysis: MarketingAIAnalysis | null;
}

export interface GBPActivityData {
  claimed: boolean;
  placeId: string | null;
  postsLast30Days: number;
  postsLast90Days: number;
  lastPostDate: string | null;
  postTypes: string[];
  photosTotal: number;
  ownerPhotos: number;
  customerPhotos: number;
  questionsAnswered: number;
  respondsToReviews: boolean;
  reviewResponseRate: number;
  attributes: string[];
  services: string[];
  activityScore: number;
}

export interface FacebookActivityData {
  exists: boolean;
  pageUrl: string | null;
  pageName: string | null;
  followers: number;
  likes: number;
  postsLast30Days: number;
  postsLast90Days: number;
  lastPostDate: string | null;
  postTypes: string[];
  avgEngagementRate: number;
  respondsToComments: boolean;
  hasMessenger: boolean;
  runningAds: boolean;
  adCount: number;
  hasShop: boolean;
  activityScore: number;
}

export interface InstagramActivityData {
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
  engagementRate: number;
  hasHighlights: boolean;
  usesReels: boolean;
  activityScore: number;
}

export interface ReviewVelocityData {
  google: PlatformReviewVelocity;
  facebook: PlatformReviewVelocity;
  yelp: PlatformReviewVelocity;
  bbb: PlatformReviewVelocity;
  totalPlatforms: number;
  activePlatforms: number;
  combinedMonthlyReviews: number;
  combinedAvgRating: number;
  hasReviewManagement: boolean;
  reviewSoftware: string | null;
  velocityScore: number;
}

export interface PlatformReviewVelocity {
  exists: boolean;
  totalReviews: number;
  avgRating: number;
  reviewsLast30Days: number;
  reviewsLast90Days: number;
  reviewsLast365Days: number;
  velocityTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  responseRate: number;
}

export interface MarketingScores {
  content: number;        // Blog + YouTube content production
  social: number;         // Facebook + Instagram activity
  engagement: number;     // Interaction rates, responses
  frequency: number;      // Posting/activity frequency
  reach: number;          // Followers, subscribers, audience size
  sophistication: number; // Website marketing signals
  advertising: number;    // Detected ad activity
  reviews: number;        // Review velocity and management
  overall: number;        // Weighted average
}

export interface MarketingAIAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  competitivePosition: 'leader' | 'strong' | 'average' | 'lagging' | 'minimal';
  recommendations: string[];
  marketingMaturity: 'sophisticated' | 'active' | 'basic' | 'minimal';
}

// ============================================
// MARKETING ORCHESTRATOR
// ============================================

export class MarketingOrchestrator {
  /**
   * Collect all marketing intelligence for a company
   */
  async collect(
    companyId: string,
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<MarketingIntelligenceResult> {
    console.log(`[MarketingOrchestrator] Starting collection for ${companyName}`);
    const startTime = Date.now();

    const result: MarketingIntelligenceResult = {
      companyId,
      collectedAt: new Date().toISOString(),
      blog: null,
      youtube: null,
      gbp: null,
      facebook: null,
      instagram: null,
      reviewVelocity: null,
      websiteMarketing: null,
      scores: this.emptyScores(),
      aiAnalysis: null,
    };

    // Run collectors in parallel where possible
    const [blogResult, youtubeResult, websiteMarketingResult, facebookResult, googleReviewsResult] =
      await Promise.allSettled([
        blogDetector.collect(companyName, domain, options),
        youtubeDetector.collect(companyName, domain, options),
        websiteMarketingCollector.collect(companyName, domain, options),
        facebookCollector.collect(companyName, domain, options),
        googleReviewsCollector.collect(companyName, domain, options),
      ]);

    // Process blog result
    if (blogResult.status === 'fulfilled' && blogResult.value.success && blogResult.value.data) {
      result.blog = blogResult.value.data;
      console.log(`[MarketingOrchestrator] Blog: ${result.blog.exists ? 'Found' : 'Not found'}`);
    }

    // Process YouTube result
    if (youtubeResult.status === 'fulfilled' && youtubeResult.value.success && youtubeResult.value.data) {
      result.youtube = youtubeResult.value.data;
      console.log(`[MarketingOrchestrator] YouTube: ${result.youtube.exists ? 'Found' : 'Not found'}`);
    }

    // Process website marketing result
    if (websiteMarketingResult.status === 'fulfilled' && websiteMarketingResult.value.success && websiteMarketingResult.value.data) {
      result.websiteMarketing = websiteMarketingResult.value.data;
      console.log(`[MarketingOrchestrator] Website Marketing: Score ${result.websiteMarketing.sophisticationScore}`);
    }

    // Process Facebook result and convert to activity data
    if (facebookResult.status === 'fulfilled' && facebookResult.value.success && facebookResult.value.data) {
      result.facebook = this.convertFacebookData(facebookResult.value.data);
      console.log(`[MarketingOrchestrator] Facebook: ${result.facebook.exists ? 'Found' : 'Not found'}`);
    }

    // Process Google Reviews and extract GBP data
    if (googleReviewsResult.status === 'fulfilled' && googleReviewsResult.value.success && googleReviewsResult.value.data) {
      result.gbp = this.extractGBPActivity(googleReviewsResult.value.data);
      result.reviewVelocity = this.calculateReviewVelocity(googleReviewsResult.value.data, result.facebook);
      console.log(`[MarketingOrchestrator] GBP: ${result.gbp.claimed ? 'Claimed' : 'Unknown'}`);
    }

    // Calculate aggregate scores
    result.scores = this.calculateScores(result);

    // Save to database
    await this.save(companyId, result);

    console.log(`[MarketingOrchestrator] Collection complete in ${Date.now() - startTime}ms`);
    return result;
  }

  /**
   * Convert Facebook collector data to activity format
   */
  private convertFacebookData(data: FacebookData): FacebookActivityData {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const postsLast30Days = data.recentPosts.filter(
      (p) => p.date && new Date(p.date).getTime() > thirtyDaysAgo
    ).length;

    const postsLast90Days = data.recentPosts.filter(
      (p) => p.date && new Date(p.date).getTime() > ninetyDaysAgo
    ).length;

    const sortedPosts = [...data.recentPosts]
      .filter((p) => p.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    // Calculate engagement rate
    let avgEngagement = 0;
    if (data.followers && data.followers > 0 && data.recentPosts.length > 0) {
      const totalEngagement = data.recentPosts.reduce(
        (sum, p) => sum + (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
        0
      );
      avgEngagement = totalEngagement / data.recentPosts.length / data.followers;
    }

    // Identify post types
    const postTypes = [...new Set(data.recentPosts.map((p) => p.type))];

    return {
      exists: true,
      pageUrl: data.pageUrl,
      pageName: data.pageName,
      followers: data.followers || 0,
      likes: data.likes || 0,
      postsLast30Days,
      postsLast90Days,
      lastPostDate: sortedPosts[0]?.date || null,
      postTypes,
      avgEngagementRate: avgEngagement,
      respondsToComments: false, // Would need deeper analysis
      hasMessenger: false, // Would need to check
      runningAds: false, // Would need Meta Ad Library
      adCount: 0,
      hasShop: false,
      activityScore: this.calculateFacebookActivityScore(postsLast30Days, data.followers || 0, avgEngagement),
    };
  }

  /**
   * Extract GBP activity data from Google Reviews result
   */
  private extractGBPActivity(data: GoogleReviewsData): GBPActivityData {
    // Response rate - not currently collected, default to 0
    // Would need to add ownerResponse field to GoogleReview type and collector
    const responseRate = 0;

    return {
      claimed: data.placeId !== null, // If we have a place ID, assume claimed
      placeId: data.placeId,
      postsLast30Days: 0, // GBP posts would need separate collection
      postsLast90Days: 0,
      lastPostDate: null,
      postTypes: [],
      photosTotal: data.photoCount || 0,
      ownerPhotos: 0, // Would need to distinguish
      customerPhotos: 0,
      questionsAnswered: 0, // Would need Q&A API
      respondsToReviews: false,
      reviewResponseRate: responseRate,
      attributes: data.types || [],
      services: [],
      activityScore: this.calculateGBPActivityScore(data.photoCount || 0, responseRate),
    };
  }

  /**
   * Calculate review velocity from collected data
   */
  private calculateReviewVelocity(
    googleData: GoogleReviewsData,
    facebookData: FacebookActivityData | null
  ): ReviewVelocityData {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    // Google reviews velocity
    const googleReviewsLast30 = googleData.reviews.filter(
      (r) => r.date && new Date(r.date).getTime() > thirtyDaysAgo
    ).length;
    const googleReviewsLast90 = googleData.reviews.filter(
      (r) => r.date && new Date(r.date).getTime() > ninetyDaysAgo
    ).length;
    const googleReviewsLast365 = googleData.reviews.filter(
      (r) => r.date && new Date(r.date).getTime() > yearAgo
    ).length;

    const googleVelocity: PlatformReviewVelocity = {
      exists: googleData.placeId !== null,
      totalReviews: googleData.totalReviews || 0,
      avgRating: googleData.rating || 0,
      reviewsLast30Days: googleReviewsLast30,
      reviewsLast90Days: googleReviewsLast90,
      reviewsLast365Days: googleReviewsLast365,
      velocityTrend: this.determineVelocityTrend(googleReviewsLast30, googleReviewsLast90),
      responseRate: 0, // Owner response data not currently collected
    };

    // Facebook velocity (from review data if available)
    const facebookVelocity: PlatformReviewVelocity = {
      exists: facebookData?.exists || false,
      totalReviews: 0, // Would need Facebook reviews API
      avgRating: 0,
      reviewsLast30Days: 0,
      reviewsLast90Days: 0,
      reviewsLast365Days: 0,
      velocityTrend: 'unknown',
      responseRate: 0,
    };

    // Empty placeholders for other platforms
    const emptyVelocity: PlatformReviewVelocity = {
      exists: false,
      totalReviews: 0,
      avgRating: 0,
      reviewsLast30Days: 0,
      reviewsLast90Days: 0,
      reviewsLast365Days: 0,
      velocityTrend: 'unknown',
      responseRate: 0,
    };

    const activePlatforms = [googleVelocity, facebookVelocity].filter((p) => p.exists).length;
    const combinedMonthlyReviews = googleReviewsLast30 + facebookVelocity.reviewsLast30Days;

    return {
      google: googleVelocity,
      facebook: facebookVelocity,
      yelp: emptyVelocity,
      bbb: emptyVelocity,
      totalPlatforms: 4, // Google, Facebook, Yelp, BBB
      activePlatforms,
      combinedMonthlyReviews,
      combinedAvgRating: googleData.rating || 0, // Primary rating source
      hasReviewManagement: googleVelocity.responseRate > 0.7,
      reviewSoftware: null, // Would need to detect
      velocityScore: this.calculateVelocityScore(combinedMonthlyReviews, googleVelocity.responseRate),
    };
  }

  /**
   * Determine velocity trend
   */
  private determineVelocityTrend(
    last30: number,
    last90: number
  ): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
    if (last90 === 0) return 'unknown';

    const averageMonthlyRate = last90 / 3;
    const recentRate = last30;

    if (recentRate > averageMonthlyRate * 1.2) return 'increasing';
    if (recentRate < averageMonthlyRate * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate all marketing scores
   */
  private calculateScores(result: MarketingIntelligenceResult): MarketingScores {
    // Content score (blog + YouTube)
    let contentScore = 0;
    if (result.blog?.exists) {
      contentScore += 30;
      contentScore += Math.min(20, result.blog.postCount * 2);
      contentScore += result.blog.postsLast30Days > 0 ? 15 : 0;
    }
    if (result.youtube?.exists) {
      contentScore += 20;
      contentScore += Math.min(15, (result.youtube.videoCount / 10) * 15);
    }
    contentScore = Math.min(100, contentScore);

    // Social score (Facebook + Instagram)
    let socialScore = 0;
    if (result.facebook?.exists) {
      socialScore += 30;
      socialScore += Math.min(20, result.facebook.postsLast30Days * 3);
      socialScore += result.facebook.followers > 1000 ? 20 : Math.min(20, result.facebook.followers / 50);
    }
    if (result.instagram?.exists) {
      socialScore += 30;
    }
    socialScore = Math.min(100, socialScore);

    // Engagement score
    let engagementScore = 0;
    if (result.facebook) {
      engagementScore += result.facebook.avgEngagementRate > 0.03 ? 30 : result.facebook.avgEngagementRate * 1000;
    }
    if (result.gbp?.respondsToReviews) {
      engagementScore += 30;
      engagementScore += Math.min(40, result.gbp.reviewResponseRate * 40);
    }
    engagementScore = Math.min(100, engagementScore);

    // Frequency score
    let frequencyScore = 0;
    if (result.blog) {
      if (result.blog.postsLast30Days >= 4) frequencyScore += 25;
      else if (result.blog.postsLast30Days >= 2) frequencyScore += 15;
      else if (result.blog.postsLast90Days >= 3) frequencyScore += 10;
    }
    if (result.facebook) {
      if (result.facebook.postsLast30Days >= 12) frequencyScore += 25;
      else if (result.facebook.postsLast30Days >= 4) frequencyScore += 15;
      else if (result.facebook.postsLast30Days >= 1) frequencyScore += 5;
    }
    if (result.youtube) {
      if (result.youtube.videosLast30Days >= 4) frequencyScore += 25;
      else if (result.youtube.videosLast30Days >= 1) frequencyScore += 15;
      else if (result.youtube.videosLast90Days >= 3) frequencyScore += 10;
    }
    if (result.reviewVelocity) {
      if (result.reviewVelocity.combinedMonthlyReviews >= 10) frequencyScore += 25;
      else if (result.reviewVelocity.combinedMonthlyReviews >= 5) frequencyScore += 15;
      else if (result.reviewVelocity.combinedMonthlyReviews >= 1) frequencyScore += 5;
    }
    frequencyScore = Math.min(100, frequencyScore);

    // Reach score
    let reachScore = 0;
    if (result.facebook) {
      if (result.facebook.followers >= 10000) reachScore += 40;
      else if (result.facebook.followers >= 5000) reachScore += 30;
      else if (result.facebook.followers >= 1000) reachScore += 20;
      else if (result.facebook.followers >= 500) reachScore += 10;
    }
    if (result.youtube) {
      if (result.youtube.subscribers >= 10000) reachScore += 40;
      else if (result.youtube.subscribers >= 5000) reachScore += 30;
      else if (result.youtube.subscribers >= 1000) reachScore += 20;
      else if (result.youtube.subscribers >= 100) reachScore += 10;
    }
    if (result.blog?.hasEmailCapture) reachScore += 20;
    reachScore = Math.min(100, reachScore);

    // Sophistication score (from website marketing)
    const sophisticationScore = result.websiteMarketing?.sophisticationScore || 0;

    // Advertising score
    let advertisingScore = 0;
    if (result.facebook?.runningAds) advertisingScore += 50 + Math.min(50, result.facebook.adCount * 10);
    const trackingPixels = result.websiteMarketing?.technical?.trackingPixels;
    if (trackingPixels && trackingPixels.length > 0) advertisingScore += 30;
    advertisingScore = Math.min(100, advertisingScore);

    // Reviews score
    let reviewsScore = 0;
    if (result.reviewVelocity) {
      reviewsScore = result.reviewVelocity.velocityScore;
    }

    // Overall weighted average
    const weights = {
      content: 0.15,
      social: 0.15,
      engagement: 0.10,
      frequency: 0.15,
      reach: 0.10,
      sophistication: 0.15,
      advertising: 0.05,
      reviews: 0.15,
    };

    const overall = Math.round(
      contentScore * weights.content +
      socialScore * weights.social +
      engagementScore * weights.engagement +
      frequencyScore * weights.frequency +
      reachScore * weights.reach +
      sophisticationScore * weights.sophistication +
      advertisingScore * weights.advertising +
      reviewsScore * weights.reviews
    );

    return {
      content: contentScore,
      social: socialScore,
      engagement: engagementScore,
      frequency: frequencyScore,
      reach: reachScore,
      sophistication: sophisticationScore,
      advertising: advertisingScore,
      reviews: reviewsScore,
      overall,
    };
  }

  /**
   * Calculate Facebook activity score
   */
  private calculateFacebookActivityScore(postsLast30: number, followers: number, engagementRate: number): number {
    let score = 0;

    // Posting frequency (max 40)
    if (postsLast30 >= 20) score += 40;
    else if (postsLast30 >= 12) score += 30;
    else if (postsLast30 >= 4) score += 20;
    else if (postsLast30 >= 1) score += 10;

    // Follower count (max 30)
    if (followers >= 10000) score += 30;
    else if (followers >= 5000) score += 25;
    else if (followers >= 1000) score += 20;
    else if (followers >= 500) score += 15;
    else if (followers >= 100) score += 10;

    // Engagement rate (max 30)
    if (engagementRate >= 0.05) score += 30;
    else if (engagementRate >= 0.03) score += 25;
    else if (engagementRate >= 0.01) score += 15;
    else if (engagementRate > 0) score += 5;

    return Math.min(100, score);
  }

  /**
   * Calculate GBP activity score
   */
  private calculateGBPActivityScore(photoCount: number, responseRate: number): number {
    let score = 0;

    // Photo count (max 40)
    if (photoCount >= 50) score += 40;
    else if (photoCount >= 20) score += 30;
    else if (photoCount >= 10) score += 20;
    else if (photoCount >= 5) score += 10;

    // Response rate (max 60)
    score += Math.round(responseRate * 60);

    return Math.min(100, score);
  }

  /**
   * Calculate review velocity score
   */
  private calculateVelocityScore(monthlyReviews: number, responseRate: number): number {
    let score = 0;

    // Monthly reviews (max 50)
    if (monthlyReviews >= 20) score += 50;
    else if (monthlyReviews >= 10) score += 40;
    else if (monthlyReviews >= 5) score += 30;
    else if (monthlyReviews >= 2) score += 20;
    else if (monthlyReviews >= 1) score += 10;

    // Response rate (max 50)
    score += Math.round(responseRate * 50);

    return Math.min(100, score);
  }

  /**
   * Empty scores object
   */
  private emptyScores(): MarketingScores {
    return {
      content: 0,
      social: 0,
      engagement: 0,
      frequency: 0,
      reach: 0,
      sophistication: 0,
      advertising: 0,
      reviews: 0,
      overall: 0,
    };
  }

  /**
   * Save marketing intelligence to database
   */
  async save(companyId: string, result: MarketingIntelligenceResult): Promise<void> {
    const supabase = createAdminClient();

    const data = {
      company_id: companyId,
      collected_at: result.collectedAt,
      blog_data: result.blog || {},
      youtube_data: result.youtube || {},
      gbp_data: result.gbp || {},
      facebook_data: result.facebook || {},
      instagram_data: result.instagram || {},
      review_velocity: result.reviewVelocity || {},
      website_marketing: result.websiteMarketing || {},
      scores: result.scores,
      ai_analysis: result.aiAnalysis || {},
      updated_at: new Date().toISOString(),
    };

    // Upsert (insert or update)
    const { error } = await supabase
      .from('marketing_intelligence')
      .upsert(data, { onConflict: 'company_id' });

    if (error) {
      console.error('[MarketingOrchestrator] Save failed:', error);
      throw error;
    }

    // Also update marketing_score on account_intelligence
    await supabase
      .from('account_intelligence')
      .update({ marketing_score: result.scores.overall })
      .eq('company_id', companyId);
  }

  /**
   * Get marketing intelligence for a company
   */
  async get(companyId: string): Promise<MarketingIntelligenceResult | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('marketing_intelligence')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error || !data) return null;

    return {
      companyId: data.company_id,
      collectedAt: data.collected_at,
      blog: data.blog_data as BlogDetectionResult | null,
      youtube: data.youtube_data as YouTubeProfile | null,
      gbp: data.gbp_data as GBPActivityData | null,
      facebook: data.facebook_data as FacebookActivityData | null,
      instagram: data.instagram_data as InstagramActivityData | null,
      reviewVelocity: data.review_velocity as ReviewVelocityData | null,
      websiteMarketing: data.website_marketing as WebsiteMarketingSignals | null,
      scores: data.scores as MarketingScores,
      aiAnalysis: data.ai_analysis as MarketingAIAnalysis | null,
    };
  }
}

// Export singleton
export const marketingOrchestrator = new MarketingOrchestrator();
