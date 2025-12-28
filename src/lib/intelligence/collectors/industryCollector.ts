/**
 * Industry Mentions Collector
 * Uses SerpAPI to find news, podcasts, awards, and other mentions
 */

import { BaseCollector } from './base';
import type {
  IndustryMentionsData,
  IndustryMentionItem,
  IndustryCollectorOptions,
  MentionType,
  MentionSentiment,
  CollectorResult,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MAX_RESULTS = 20;

// Search query templates
const SEARCH_QUERIES = [
  '{company} news',
  '{company} press release',
  '{company} award',
  '{company} pest control',
  '{company} podcast interview',
  '"{company}" announcement',
];

// Pest control industry specific queries
const PEST_CONTROL_QUERIES = [
  '{company} PCT Magazine',
  '{company} Pest Control Technology',
  '{company} NPMA award',
  '{company} PestWorld',
  '{company} QualityPro certified',
  '{company} Coalmarch podcast',
  '{company} "pest control" interview',
  '{company} Pest Management Professional',
  '{company} lawn care expansion',
  '{company} "termite" OR "rodent" OR "mosquito"',
];

// Priority industry sources
const INDUSTRY_SOURCES = [
  'pctonline.com',
  'pestcontroltech.com',
  'npmapestworld.org',
  'pestmanagementprofessional.com',
  'mypmp.net',
  'coalmarchproductions.com',
];

// Keywords for mention type classification
const TYPE_KEYWORDS: Record<MentionType, string[]> = {
  news: ['news', 'article', 'report', 'breaking', 'latest'],
  podcast: ['podcast', 'episode', 'interview', 'show', 'audio'],
  award: ['award', 'winner', 'recognition', 'honored', 'top 100', 'best'],
  press_release: ['press release', 'announces', 'pr newswire', 'business wire'],
  blog: ['blog', 'post', 'commentary', 'opinion'],
  event: ['event', 'conference', 'summit', 'expo', 'webinar'],
  other: [],
};

// Keywords for sentiment classification
const SENTIMENT_KEYWORDS: Record<MentionSentiment, string[]> = {
  positive: [
    'award', 'winner', 'growth', 'success', 'best', 'top', 'leading',
    'innovative', 'excellent', 'praised', 'honored', 'achievement',
  ],
  negative: [
    'lawsuit', 'scandal', 'complaint', 'problem', 'issue', 'fired',
    'layoff', 'bankruptcy', 'fraud', 'investigation', 'recalled',
  ],
  neutral: [],
};

// ============================================
// INDUSTRY COLLECTOR
// ============================================

export class IndustryCollector extends BaseCollector<IndustryMentionsData, IndustryCollectorOptions> {
  readonly sourceType = 'industry_mentions' as const;
  readonly displayName = 'Industry Mentions';

  private apiKey: string | null = null;
  private baseUrl = 'https://serpapi.com/search';

  constructor() {
    super();
    this.apiKey = process.env.SERP_API_KEY || null;
  }

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: IndustryCollectorOptions = {}
  ): Promise<CollectorResult<IndustryMentionsData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'SerpAPI key not configured',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        return await this.searchMentions(companyName, options);
      }, options.maxRetries || 2);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[IndustryCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: IndustryMentionsData): number {
    if (!data) return 0;

    let score = 0;

    // Base score for having results
    if (data.mentions.length > 0) score += 20;

    // Score based on number of mentions
    score += Math.min(30, data.mentions.length * 3);

    // Bonus for positive mentions
    score += Math.min(20, data.positiveCount * 4);

    // Bonus for variety of mention types
    const uniqueTypes = new Set(data.mentions.map((m) => m.mentionType));
    score += Math.min(20, uniqueTypes.size * 5);

    // Bonus for recent mentions
    const recentMentions = data.mentions.filter((m) => {
      if (!m.publishedAt) return false;
      const monthsAgo = (Date.now() - new Date(m.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo < 6;
    });
    score += Math.min(10, recentMentions.length * 2);

    return Math.min(100, score);
  }

  /**
   * Search for industry mentions
   */
  private async searchMentions(
    companyName: string,
    options: IndustryCollectorOptions
  ): Promise<IndustryMentionsData> {
    const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
    const customQueries = options.searchQueries || [];

    // Build search queries - include pest control specific queries
    const queries = [
      ...SEARCH_QUERIES.map((q) => q.replace('{company}', companyName)),
      ...PEST_CONTROL_QUERIES.map((q) => q.replace('{company}', companyName)),
      ...customQueries,
    ];

    const allMentions: IndustryMentionItem[] = [];
    const usedQueries: string[] = [];

    // Run searches (limit to avoid rate limits) - increased to 6 for better coverage
    const queriesToRun = queries.slice(0, 6);

    for (const query of queriesToRun) {
      try {
        const results = await this.runSearch(query, options.dateRange);
        usedQueries.push(query);

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const mention = this.transformResult(result, query, i + 1, companyName);
          if (mention) {
            allMentions.push(mention);
          }
        }

        // Small delay between requests
        await this.sleep(500);
      } catch (error) {
        console.debug(`[IndustryCollector] Search failed for "${query}":`, error);
      }
    }

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueMentions = allMentions.filter((m) => {
      if (seenUrls.has(m.url)) return false;
      seenUrls.add(m.url);
      return true;
    });

    // Sort by relevance
    uniqueMentions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    const finalMentions = uniqueMentions.slice(0, maxResults);

    // Calculate sentiment counts
    const positiveCount = finalMentions.filter((m) => m.sentiment === 'positive').length;
    const negativeCount = finalMentions.filter((m) => m.sentiment === 'negative').length;
    const neutralCount = finalMentions.filter((m) => m.sentiment === 'neutral').length;

    return {
      companyName,
      searchQueries: usedQueries,
      mentions: finalMentions,
      totalMentions: finalMentions.length,
      positiveCount,
      neutralCount,
      negativeCount,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Run a single search
   */
  private async runSearch(
    query: string,
    dateRange?: 'day' | 'week' | 'month' | 'year'
  ): Promise<SerpResult[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey!,
      engine: 'google',
      q: query,
      num: '10',
      gl: 'us',
      hl: 'en',
    });

    // Add time filter if specified
    if (dateRange) {
      const tbs: Record<string, string> = {
        day: 'qdr:d',
        week: 'qdr:w',
        month: 'qdr:m',
        year: 'qdr:y',
      };
      params.set('tbs', tbs[dateRange] || '');
    }

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json();

    return data.organic_results || [];
  }

  /**
   * Transform search result to mention
   */
  private transformResult(
    result: SerpResult,
    query: string,
    position: number,
    companyName: string
  ): IndustryMentionItem | null {
    if (!result.title || !result.link) return null;

    // Skip if it's the company's own website
    const domain = this.normalizeDomain(result.link);
    if (domain.includes(companyName.toLowerCase().replace(/\s+/g, ''))) {
      return null;
    }

    const snippet = result.snippet || '';
    const title = result.title;
    const combined = `${title} ${snippet}`.toLowerCase();

    // Classify mention type
    const mentionType = this.classifyType(combined);

    // Classify sentiment
    const sentiment = this.classifySentiment(combined);

    // Calculate relevance score (based on position and keyword matches)
    const relevanceScore = this.calculateRelevance(position, combined, companyName);

    // Extract source name
    const sourceName = this.extractSourceName(result.link);

    // Try to parse date
    const publishedAt = this.parseDate(result.date);

    return {
      title,
      url: result.link,
      source: sourceName,
      publishedAt,
      snippet,
      mentionType,
      sentiment,
      relevanceScore,
      serpPosition: position,
      searchQuery: query,
    };
  }

  /**
   * Classify mention type based on content
   */
  private classifyType(text: string): MentionType {
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      if (type === 'other') continue;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return type as MentionType;
        }
      }
    }
    return 'other';
  }

  /**
   * Classify sentiment based on content
   */
  private classifySentiment(text: string): MentionSentiment {
    let positiveScore = 0;
    let negativeScore = 0;

    for (const keyword of SENTIMENT_KEYWORDS.positive) {
      if (text.includes(keyword)) positiveScore++;
    }

    for (const keyword of SENTIMENT_KEYWORDS.negative) {
      if (text.includes(keyword)) negativeScore++;
    }

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(position: number, text: string, companyName: string): number {
    let score = 100 - (position * 5); // Position penalty

    // Company name mention bonus
    const companyLower = companyName.toLowerCase();
    if (text.includes(companyLower)) {
      score += 20;
    }

    // Type bonus (awards and press releases are more relevant)
    if (text.includes('award') || text.includes('press release')) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Extract source name from URL
   */
  private extractSourceName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname
        .replace(/^www\./, '')
        .split('.')[0]
        .replace(/-/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch {
      return 'Unknown';
    }
  }
}

// ============================================
// SERP API TYPES
// ============================================

interface SerpResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

// Export singleton
export const industryCollector = new IndustryCollector();
