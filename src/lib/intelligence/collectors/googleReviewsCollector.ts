/**
 * Google Reviews Collector
 * Uses Google Places API to fetch business reviews and ratings
 * Enhanced with pain point analysis from review text
 */

import { BaseCollector } from './base';
import type {
  GoogleReviewsData,
  EnhancedGoogleReviewsData,
  GoogleReview,
  CollectorOptions,
  CollectorResult,
  PainPointCategory,
} from '../types';

// ============================================
// PAIN POINT KEYWORDS
// ============================================

const PAIN_POINT_KEYWORDS = {
  waitTimes: [
    'wait', 'waiting', 'late', 'delayed', 'took forever', 'slow',
    'hours late', 'didn\'t show', 'no show', 'missed appointment',
    'had to wait', 'long wait', 'rescheduled', 'never showed up',
  ],
  communication: [
    'never called', 'didn\'t call', 'no response', 'hard to reach',
    'didn\'t answer', 'no communication', 'ghosted', 'ignored',
    'didn\'t return', 'unreachable', 'no follow up', 'poor communication',
    'couldn\'t get ahold', 'didn\'t inform', 'no update',
  ],
  pricing: [
    'expensive', 'overpriced', 'price', 'cost', 'charged',
    'hidden fees', 'overcharged', 'not worth', 'rip off', 'ripoff',
    'too much', 'quoted', 'invoice', 'bill', 'fee',
  ],
  quality: [
    'didn\'t work', 'came back', 'still have', 'problem persists',
    'ineffective', 'poor quality', 'didn\'t solve', 'returned',
    'bugs came back', 'pests returned', 'not effective', 'waste of money',
    'didn\'t help', 'same problem', 'issue remains',
  ],
  scheduling: [
    'schedule', 'appointment', 'booking', 'time slot',
    'availability', 'reschedule', 'couldn\'t book', 'scheduling issues',
    'no availability', 'hard to schedule', 'cancellation',
  ],
  staffIssues: [
    'rude', 'unprofessional', 'careless', 'messy', 'sloppy',
    'disrespectful', 'attitude', 'unfriendly', 'inexperienced',
    'untrained', 'damage', 'damaged', 'broke', 'broke something',
  ],
};

// Positive aspect keywords
const POSITIVE_KEYWORDS = [
  'friendly', 'professional', 'on time', 'punctual', 'thorough',
  'knowledgeable', 'helpful', 'responsive', 'courteous', 'clean',
  'efficient', 'fast', 'quick', 'excellent', 'great service',
  'recommend', 'satisfied', 'reasonable price', 'fair price',
];

// Competitor patterns
const COMPETITOR_PATTERNS = [
  /switch(?:ed|ing)?\s+(?:from|to)\s+(\w+(?:\s+\w+)?)/i,
  /(?:tried|used|hired)\s+(\w+(?:\s+\w+)?)\s+(?:before|first)/i,
  /(?:better|worse)\s+than\s+(\w+(?:\s+\w+)?)/i,
];

// ============================================
// GOOGLE REVIEWS COLLECTOR
// ============================================

export class GoogleReviewsCollector extends BaseCollector<EnhancedGoogleReviewsData, CollectorOptions> {
  readonly sourceType = 'google_reviews' as const;
  readonly displayName = 'Google Reviews';

  private apiKey: string | null = null;

  constructor() {
    super();
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || null;
  }

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<EnhancedGoogleReviewsData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'Google Places API key not configured',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        // Step 1: Find the place
        const placeId = await this.findPlace(companyName, domain);
        if (!placeId) {
          throw new Error('Business not found on Google');
        }

        // Step 2: Get place details with reviews
        const baseData = await this.getPlaceDetails(placeId, companyName);

        // Step 3: Enhance with pain point analysis
        return this.enhanceWithAnalysis(baseData);
      }, options.maxRetries || 2);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[GoogleReviewsCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: EnhancedGoogleReviewsData): number {
    if (!data) return 0;

    let score = 0;

    if (data.placeId) score += 5;
    if (data.businessName) score += 5;
    if (data.rating) score += 15;
    if (data.totalReviews && data.totalReviews > 0) score += 10;
    if (data.address) score += 5;
    if (data.phone) score += 5;
    if (data.website) score += 5;
    if (data.reviews.length > 0) score += 15;
    if (data.openingHours) score += 5;
    if (data.types.length > 0) score += 5;
    // Enhanced metrics
    if (data.painPointAnalysis) score += 10;
    if (data.mostPraisedAspects.length > 0) score += 10;
    if (data.ratingTrend) score += 5;
    if (data.ownerResponseRate > 0) score += 5;

    return Math.min(100, score);
  }

  /**
   * Find place using Legacy Places API
   */
  private async findPlace(
    companyName: string,
    domain: string | null
  ): Promise<string | null> {
    // Try company name first (more likely to match Google listing)
    const query = companyName;

    console.log('[Google Places] Searching for:', query);

    // Use Legacy Places API (Find Place)
    const params = new URLSearchParams({
      input: query,
      inputtype: 'textquery',
      fields: 'place_id,name,formatted_address',
      key: this.apiKey!,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`
    );

    const data = await response.json();
    console.log('[Google Places] API response:', response.status, 'status:', data.status, 'candidates:', data.candidates?.length || 0);

    if (data.status !== 'OK' || !data.candidates?.length) {
      // If no results with company name, try with domain
      if (domain) {
        console.log('[Google Places] Retrying with domain...');
        const domainQuery = `${companyName} ${this.normalizeDomain(domain)}`;
        const retryParams = new URLSearchParams({
          input: domainQuery,
          inputtype: 'textquery',
          fields: 'place_id,name,formatted_address',
          key: this.apiKey!,
        });
        const retryResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${retryParams}`
        );
        const retryData = await retryResponse.json();
        console.log('[Google Places] Retry response:', retryResponse.status, 'status:', retryData.status, 'candidates:', retryData.candidates?.length || 0);
        if (retryData.status === 'OK' && retryData.candidates?.length) {
          return retryData.candidates[0].place_id;
        }
      }
      console.log('[Google Places] Full response:', JSON.stringify(data));
      return null;
    }

    return data.candidates[0].place_id;
  }

  /**
   * Get place details including reviews (Legacy API)
   */
  private async getPlaceDetails(
    placeId: string,
    companyName: string
  ): Promise<GoogleReviewsData> {
    // Use Legacy Places API for place details
    const fields = [
      'place_id',
      'name',
      'rating',
      'user_ratings_total',
      'formatted_address',
      'formatted_phone_number',
      'website',
      'types',
      'opening_hours',
      'reviews',
      'photos',
    ].join(',');

    const params = new URLSearchParams({
      place_id: placeId,
      fields: fields,
      key: this.apiKey!,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );

    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      console.error('[Google Places] Details error:', data);
      throw new Error(`Failed to get place details: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const place = data.result;
    console.log('[Google Places] Got details for:', place.name);

    // Transform reviews from legacy API format
    const reviews: GoogleReview[] = (place.reviews || []).map((review: {
      author_name?: string;
      rating?: number;
      text?: string;
      time?: number;
      relative_time_description?: string;
    }) => ({
      author: review.author_name || 'Anonymous',
      rating: review.rating || 0,
      text: review.text || '',
      date: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
      relativeTime: review.relative_time_description || '',
    }));

    return {
      placeId: place.place_id || placeId,
      businessName: place.name || companyName,
      rating: place.rating || null,
      totalReviews: place.user_ratings_total || null,
      address: place.formatted_address || null,
      phone: place.formatted_phone_number || null,
      website: place.website || null,
      types: place.types || [],
      openingHours: place.opening_hours?.weekday_text || null,
      reviews,
      photoCount: place.photos?.length || null,
      collectedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // ENHANCED ANALYSIS METHODS
  // ============================================

  /**
   * Enhance base data with pain point analysis
   */
  private enhanceWithAnalysis(baseData: GoogleReviewsData): EnhancedGoogleReviewsData {
    const reviews = baseData.reviews;

    // Analyze pain points from negative reviews (1-3 stars)
    const negativeReviews = reviews.filter((r) => r.rating <= 3);
    const painPointAnalysis = this.analyzePainPoints(negativeReviews);

    // Analyze positive aspects from positive reviews (4-5 stars)
    const positiveReviews = reviews.filter((r) => r.rating >= 4);
    const { praisedAspects, criticizedAspects } = this.analyzeAspects(reviews);

    // Calculate rating trend
    const { ratingTrend, recentRating, historicalRating } = this.calculateRatingTrend(reviews);

    // Calculate owner response rate
    const ownerResponseRate = this.calculateOwnerResponseRate(reviews);

    // Extract competitor mentions
    const competitorMentions = this.extractCompetitorMentions(reviews);

    return {
      ...baseData,
      painPointAnalysis,
      ratingTrend,
      recentRating,
      historicalRating,
      ownerResponseRate,
      avgResponseTime: null, // Not available from API
      competitorMentions,
      mostPraisedAspects: praisedAspects,
      mostCriticizedAspects: criticizedAspects,
    };
  }

  /**
   * Analyze reviews for pain points
   */
  private analyzePainPoints(negativeReviews: GoogleReview[]): EnhancedGoogleReviewsData['painPointAnalysis'] {
    const createEmptyCategory = (): PainPointCategory => ({ count: 0, quotes: [] });

    const analysis = {
      waitTimes: createEmptyCategory(),
      communication: createEmptyCategory(),
      pricing: createEmptyCategory(),
      quality: createEmptyCategory(),
      scheduling: createEmptyCategory(),
      staffIssues: createEmptyCategory(),
    };

    for (const review of negativeReviews) {
      const text = review.text.toLowerCase();

      // Check each pain point category
      for (const [category, keywords] of Object.entries(PAIN_POINT_KEYWORDS)) {
        const categoryKey = category as keyof typeof analysis;
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            analysis[categoryKey].count++;
            // Extract a quote snippet around the keyword
            const quote = this.extractQuote(review.text, keyword);
            if (quote && analysis[categoryKey].quotes.length < 3) {
              analysis[categoryKey].quotes.push(quote);
            }
            break; // Only count once per category per review
          }
        }
      }
    }

    return analysis;
  }

  /**
   * Extract a quote snippet around a keyword
   */
  private extractQuote(text: string, keyword: string): string | null {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(keyword.toLowerCase());
    if (index === -1) return null;

    // Get surrounding context (up to 100 chars before and after)
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + keyword.length + 80);

    let quote = text.slice(start, end).trim();

    // Add ellipsis if truncated
    if (start > 0) quote = '...' + quote;
    if (end < text.length) quote = quote + '...';

    return quote;
  }

  /**
   * Analyze positive and negative aspects
   */
  private analyzeAspects(reviews: GoogleReview[]): {
    praisedAspects: string[];
    criticizedAspects: string[];
  } {
    const positiveAspectCounts: Record<string, number> = {};
    const negativeAspectCounts: Record<string, number> = {};

    for (const review of reviews) {
      const text = review.text.toLowerCase();
      const isPositive = review.rating >= 4;

      // Check positive keywords
      for (const keyword of POSITIVE_KEYWORDS) {
        if (text.includes(keyword)) {
          if (isPositive) {
            positiveAspectCounts[keyword] = (positiveAspectCounts[keyword] || 0) + 1;
          }
        }
      }

      // Check negative keywords (from pain points)
      if (!isPositive) {
        for (const [category, keywords] of Object.entries(PAIN_POINT_KEYWORDS)) {
          for (const keyword of keywords) {
            if (text.includes(keyword)) {
              negativeAspectCounts[category] = (negativeAspectCounts[category] || 0) + 1;
              break;
            }
          }
        }
      }
    }

    // Sort and get top aspects
    const praisedAspects = Object.entries(positiveAspectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => this.capitalizeKeyword(keyword));

    const criticizedAspects = Object.entries(negativeAspectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => this.formatCategoryName(category));

    return { praisedAspects, criticizedAspects };
  }

  /**
   * Calculate rating trend over time
   */
  private calculateRatingTrend(reviews: GoogleReview[]): {
    ratingTrend: EnhancedGoogleReviewsData['ratingTrend'];
    recentRating: number | null;
    historicalRating: number | null;
  } {
    if (reviews.length < 3) {
      return { ratingTrend: 'stable', recentRating: null, historicalRating: null };
    }

    const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

    const recentReviews = reviews.filter((r) => new Date(r.date).getTime() > sixMonthsAgo);
    const olderReviews = reviews.filter((r) => new Date(r.date).getTime() <= sixMonthsAgo);

    if (recentReviews.length === 0 || olderReviews.length === 0) {
      return { ratingTrend: 'stable', recentRating: null, historicalRating: null };
    }

    const recentRating = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
    const historicalRating = olderReviews.reduce((sum, r) => sum + r.rating, 0) / olderReviews.length;

    let ratingTrend: EnhancedGoogleReviewsData['ratingTrend'] = 'stable';
    const diff = recentRating - historicalRating;

    if (diff > 0.3) {
      ratingTrend = 'improving';
    } else if (diff < -0.3) {
      ratingTrend = 'declining';
    }

    return {
      ratingTrend,
      recentRating: Math.round(recentRating * 10) / 10,
      historicalRating: Math.round(historicalRating * 10) / 10,
    };
  }

  /**
   * Calculate owner response rate
   * Note: Google API doesn't directly provide owner responses,
   * but we can estimate from review structure
   */
  private calculateOwnerResponseRate(_reviews: GoogleReview[]): number {
    // The Google Places API doesn't return owner responses in the basic fields
    // This would require additional API calls or scraping
    // Return 0 to indicate unknown
    return 0;
  }

  /**
   * Extract competitor mentions from reviews
   */
  private extractCompetitorMentions(reviews: GoogleReview[]): string[] {
    const competitors = new Set<string>();

    for (const review of reviews) {
      const text = review.text;

      for (const pattern of COMPETITOR_PATTERNS) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          // Filter out common false positives
          if (name.length > 2 && !['the', 'them', 'they', 'this', 'that'].includes(name.toLowerCase())) {
            competitors.add(name);
          }
        }
      }
    }

    return Array.from(competitors).slice(0, 10);
  }

  /**
   * Helper: Capitalize keyword for display
   */
  private capitalizeKeyword(keyword: string): string {
    return keyword.split(' ').map((word) =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Helper: Format category name for display
   */
  private formatCategoryName(category: string): string {
    const names: Record<string, string> = {
      waitTimes: 'Wait Times',
      communication: 'Communication',
      pricing: 'Pricing',
      quality: 'Service Quality',
      scheduling: 'Scheduling',
      staffIssues: 'Staff Issues',
    };
    return names[category] || category;
  }
}

// Export singleton
export const googleReviewsCollector = new GoogleReviewsCollector();
