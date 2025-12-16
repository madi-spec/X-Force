/**
 * Google Reviews Collector
 * Uses Google Places API to fetch business reviews and ratings
 */

import { BaseCollector } from './base';
import type {
  GoogleReviewsData,
  GoogleReview,
  CollectorOptions,
  CollectorResult,
} from '../types';

// ============================================
// GOOGLE REVIEWS COLLECTOR
// ============================================

export class GoogleReviewsCollector extends BaseCollector<GoogleReviewsData, CollectorOptions> {
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
  ): Promise<CollectorResult<GoogleReviewsData>> {
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
        return await this.getPlaceDetails(placeId, companyName);
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
  calculateQualityScore(data: GoogleReviewsData): number {
    if (!data) return 0;

    let score = 0;

    if (data.placeId) score += 10;
    if (data.businessName) score += 10;
    if (data.rating) score += 20;
    if (data.totalReviews && data.totalReviews > 0) score += 15;
    if (data.address) score += 5;
    if (data.phone) score += 5;
    if (data.website) score += 5;
    if (data.reviews.length > 0) score += 20;
    if (data.openingHours) score += 5;
    if (data.types.length > 0) score += 5;

    return Math.min(100, score);
  }

  /**
   * Find place using Places API
   */
  private async findPlace(
    companyName: string,
    domain: string | null
  ): Promise<string | null> {
    const query = domain
      ? `${companyName} ${this.normalizeDomain(domain)}`
      : companyName;

    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id,name,formatted_address');
    url.searchParams.set('key', this.apiKey!);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.candidates?.length) {
      // Try with just company name
      if (domain) {
        return await this.findPlace(companyName, null);
      }
      return null;
    }

    return data.candidates[0].place_id;
  }

  /**
   * Get place details including reviews
   */
  private async getPlaceDetails(
    placeId: string,
    companyName: string
  ): Promise<GoogleReviewsData> {
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

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', fields);
    url.searchParams.set('key', this.apiKey!);
    url.searchParams.set('reviews_sort', 'newest');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      throw new Error(`Failed to get place details: ${data.status}`);
    }

    const place = data.result;

    // Transform reviews
    const reviews: GoogleReview[] = (place.reviews || []).map((review: {
      author_name: string;
      rating: number;
      text: string;
      time: number;
      relative_time_description: string;
    }) => ({
      author: review.author_name,
      rating: review.rating,
      text: review.text,
      date: new Date(review.time * 1000).toISOString(),
      relativeTime: review.relative_time_description,
    }));

    return {
      placeId: place.place_id,
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
}

// Export singleton
export const googleReviewsCollector = new GoogleReviewsCollector();
