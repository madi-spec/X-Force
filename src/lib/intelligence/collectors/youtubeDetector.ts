/**
 * YouTube Channel Detector
 * Finds and analyzes company YouTube presence
 * Uses YouTube Data API when available, falls back to SerpAPI/scraping
 */

import * as cheerio from 'cheerio';
import { BaseCollector } from './base';
import type { CollectorOptions, CollectorResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface YouTubeProfile {
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
  activityScore: number;
}

// ============================================
// YOUTUBE DETECTOR COLLECTOR
// ============================================

export class YouTubeDetector extends BaseCollector<YouTubeProfile, CollectorOptions> {
  readonly sourceType = 'youtube_detection' as const;
  readonly displayName = 'YouTube Detection';

  private youtubeApiKey: string | null = null;
  private serpApiKey: string | null = null;

  constructor() {
    super();
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY || null;
    this.serpApiKey = process.env.SERP_API_KEY || null;
  }

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<YouTubeProfile>> {
    const startTime = Date.now();

    try {
      const websiteUrl = domain
        ? domain.startsWith('http')
          ? domain
          : `https://${domain}`
        : null;

      const data = await this.withRetry(
        async () => this.detectYouTubeChannel(companyName, websiteUrl),
        options.maxRetries || 2
      );

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[YouTubeDetector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: YouTubeProfile): number {
    if (!data || !data.exists) return 0;
    return data.activityScore;
  }

  /**
   * Main detection logic
   */
  private async detectYouTubeChannel(
    companyName: string,
    websiteUrl: string | null
  ): Promise<YouTubeProfile> {
    console.log('[YouTubeDetector] Searching for channel:', companyName);

    // 1. Check website for YouTube link
    let channelUrl = websiteUrl ? await this.findYouTubeLinkOnWebsite(websiteUrl) : null;

    // 2. If not found, search YouTube
    if (!channelUrl) {
      channelUrl = await this.searchForChannel(companyName);
    }

    if (!channelUrl) {
      console.log('[YouTubeDetector] No channel found');
      return this.emptyProfile();
    }

    console.log('[YouTubeDetector] Found channel:', channelUrl);

    // 3. Get channel details
    return await this.getChannelDetails(channelUrl, companyName);
  }

  /**
   * Find YouTube link on company website
   */
  private async findYouTubeLinkOnWebsite(websiteUrl: string): Promise<string | null> {
    try {
      const response = await fetch(websiteUrl, { signal: AbortSignal.timeout(10000) });
      const html = await response.text();

      // Look for YouTube links
      const patterns = [
        /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i,
        /youtube\.com\/c\/([a-zA-Z0-9_-]+)/i,
        /youtube\.com\/user\/([a-zA-Z0-9_-]+)/i,
        /youtube\.com\/@([a-zA-Z0-9_-]+)/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          return `https://youtube.com/${match[0].split('youtube.com/')[1]}`;
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Search for YouTube channel via SerpAPI
   */
  private async searchForChannel(companyName: string): Promise<string | null> {
    if (!this.serpApiKey) return null;

    try {
      const searchQuery = encodeURIComponent(`${companyName} pest control site:youtube.com`);
      const response = await fetch(
        `https://serpapi.com/search.json?q=${searchQuery}&api_key=${this.serpApiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );

      const data = await response.json();

      // Look for channel results
      for (const result of data.organic_results || []) {
        const url = result.link || '';
        if (
          url.includes('youtube.com/channel/') ||
          url.includes('youtube.com/c/') ||
          url.includes('youtube.com/@')
        ) {
          return url;
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  /**
   * Get channel details
   */
  private async getChannelDetails(
    channelUrl: string,
    companyName: string
  ): Promise<YouTubeProfile> {
    // Extract channel identifier
    const channelId = await this.resolveChannelId(channelUrl);

    if (channelId && this.youtubeApiKey) {
      return await this.getChannelDetailsFromAPI(channelId, channelUrl, companyName);
    }

    // Fallback: Scrape public page
    return await this.scrapeChannelPage(channelUrl, companyName);
  }

  /**
   * Get channel details from YouTube Data API
   */
  private async getChannelDetailsFromAPI(
    channelId: string,
    channelUrl: string,
    companyName: string
  ): Promise<YouTubeProfile> {
    try {
      // Get channel statistics
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${this.youtubeApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const channelData = await channelResponse.json();

      if (!channelData.items?.[0]) {
        return await this.scrapeChannelPage(channelUrl, companyName);
      }

      const channel = channelData.items[0];
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

      // Get recent videos
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${this.youtubeApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const videosData = await videosResponse.json();

      const videos = videosData.items || [];

      // Calculate recency
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const videosLast30Days = videos.filter(
        (v: { snippet?: { publishedAt?: string } }) =>
          new Date(v.snippet?.publishedAt || 0) >= thirtyDaysAgo
      ).length;

      const videosLast90Days = videos.filter(
        (v: { snippet?: { publishedAt?: string } }) =>
          new Date(v.snippet?.publishedAt || 0) >= ninetyDaysAgo
      ).length;

      // Get video statistics for top videos
      const videoIds = videos
        .slice(0, 10)
        .map((v: { contentDetails?: { videoId?: string } }) => v.contentDetails?.videoId)
        .join(',');
      const videoStatsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${this.youtubeApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const videoStatsData = await videoStatsResponse.json();

      const topVideos = (videoStatsData.items || [])
        .map((v: { statistics?: { viewCount?: string } }, i: number) => ({
          title: videos[i]?.snippet?.title || '',
          views: parseInt(v.statistics?.viewCount || '0'),
          date: videos[i]?.snippet?.publishedAt || '',
        }))
        .sort((a: { views: number }, b: { views: number }) => b.views - a.views)
        .slice(0, 5);

      const totalVideoViews = topVideos.reduce(
        (sum: number, v: { views: number }) => sum + v.views,
        0
      );

      // Check for Shorts
      const hasShorts = videos.some(
        (v: { snippet?: { title?: string; description?: string } }) =>
          v.snippet?.title?.includes('#shorts') ||
          v.snippet?.description?.includes('#shorts')
      );

      const subscribers = parseInt(channel.statistics?.subscriberCount || '0');
      const videoCount = parseInt(channel.statistics?.videoCount || '0');

      return {
        exists: true,
        channelId,
        channelUrl,
        channelName: channel.snippet?.title || companyName,
        subscribers,
        totalViews: parseInt(channel.statistics?.viewCount || '0'),
        videoCount,
        videosLast30Days,
        videosLast90Days,
        lastUploadDate: videos[0]?.snippet?.publishedAt || null,
        lastUploadTitle: videos[0]?.snippet?.title || null,
        avgViewsPerVideo:
          topVideos.length > 0 ? Math.round(totalVideoViews / topVideos.length) : 0,
        topVideos,
        playlists: [], // Would need additional API call
        hasShorts,
        activityScore: this.calculateActivityScore({
          subscribers,
          videoCount,
          videosLast30Days,
          videosLast90Days,
          hasShorts,
        }),
      };
    } catch (e) {
      console.error('[YouTubeDetector] API error:', e);
      return await this.scrapeChannelPage(channelUrl, companyName);
    }
  }

  /**
   * Resolve channel URL to channel ID
   */
  private async resolveChannelId(channelUrl: string): Promise<string | null> {
    // Extract from URL patterns
    const channelMatch = channelUrl.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];

    // For @handle or /c/ URLs, need to resolve via API or scraping
    const handleMatch = channelUrl.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
    const customMatch = channelUrl.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
    const userMatch = channelUrl.match(/youtube\.com\/user\/([a-zA-Z0-9_-]+)/);

    const handle = handleMatch?.[1] || customMatch?.[1] || userMatch?.[1];

    if (handle && this.youtubeApiKey) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${this.youtubeApiKey}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const data = await response.json();
        return data.items?.[0]?.snippet?.channelId || null;
      } catch {
        // Ignore errors
      }
    }

    return null;
  }

  /**
   * Fallback: Scrape public channel page
   */
  private async scrapeChannelPage(
    channelUrl: string,
    companyName: string
  ): Promise<YouTubeProfile> {
    try {
      const response = await fetch(channelUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });
      const html = await response.text();

      // Extract data from meta tags and structured data
      const subscriberMatch = html.match(/"subscriberCountText":"([^"]+)"/);
      const videoCountMatch = html.match(/"videoCountText":"([^"]+)"/);
      const channelNameMatch = html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/);

      const subscribers = this.parseSubscriberCount(subscriberMatch?.[1] || '0');
      const videoCount = this.parseVideoCount(videoCountMatch?.[1] || '0');

      return {
        exists: true,
        channelId: null,
        channelUrl,
        channelName: channelNameMatch?.[1] || companyName,
        subscribers,
        totalViews: 0,
        videoCount,
        videosLast30Days: 0, // Can't determine without API
        videosLast90Days: 0,
        lastUploadDate: null,
        lastUploadTitle: null,
        avgViewsPerVideo: 0,
        topVideos: [],
        playlists: [],
        hasShorts: html.includes('shorts'),
        activityScore: this.calculateActivityScore({
          subscribers,
          videoCount,
          videosLast30Days: 0,
          videosLast90Days: 0,
          hasShorts: html.includes('shorts'),
        }),
      };
    } catch {
      return this.emptyProfile();
    }
  }

  /**
   * Parse subscriber count text
   */
  private parseSubscriberCount(text: string): number {
    if (!text) return 0;
    const cleanText = text.replace(/subscribers?/i, '').trim();

    if (cleanText.includes('K')) {
      return Math.round(parseFloat(cleanText) * 1000);
    } else if (cleanText.includes('M')) {
      return Math.round(parseFloat(cleanText) * 1000000);
    }

    return parseInt(cleanText.replace(/\D/g, '')) || 0;
  }

  /**
   * Parse video count text
   */
  private parseVideoCount(text: string): number {
    if (!text) return 0;
    return parseInt(text.replace(/\D/g, '')) || 0;
  }

  /**
   * Calculate activity score
   */
  private calculateActivityScore(metrics: {
    subscribers: number;
    videoCount: number;
    videosLast30Days: number;
    videosLast90Days: number;
    hasShorts: boolean;
  }): number {
    let score = 0;

    // Subscribers (max 30 points)
    if (metrics.subscribers >= 10000) score += 30;
    else if (metrics.subscribers >= 5000) score += 25;
    else if (metrics.subscribers >= 1000) score += 20;
    else if (metrics.subscribers >= 500) score += 15;
    else if (metrics.subscribers >= 100) score += 10;
    else if (metrics.subscribers > 0) score += 5;

    // Video count (max 20 points)
    if (metrics.videoCount >= 100) score += 20;
    else if (metrics.videoCount >= 50) score += 15;
    else if (metrics.videoCount >= 20) score += 10;
    else if (metrics.videoCount >= 10) score += 5;

    // Recent activity (max 30 points)
    if (metrics.videosLast30Days >= 4) score += 30;
    else if (metrics.videosLast30Days >= 2) score += 20;
    else if (metrics.videosLast30Days >= 1) score += 10;
    else if (metrics.videosLast90Days >= 3) score += 15;
    else if (metrics.videosLast90Days >= 1) score += 5;

    // Uses Shorts (20 points)
    if (metrics.hasShorts) score += 20;

    return Math.min(100, score);
  }

  /**
   * Empty profile for when no channel is found
   */
  private emptyProfile(): YouTubeProfile {
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
      hasShorts: false,
      activityScore: 0,
    };
  }
}

// Export singleton
export const youtubeDetector = new YouTubeDetector();
