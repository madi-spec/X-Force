/**
 * Employee Media Presence Collector
 * Uses SerpAPI to find news, podcasts, and speaking engagements for key employees
 */

import { BaseCollector } from './base';
import type {
  EmployeeMediaData,
  EmployeeMediaProfile,
  MediaMention,
  CollectorOptions,
  CollectorResult,
  EnhancedApolloPerson,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

// Search query templates for finding media mentions
const SEARCH_TEMPLATES = [
  '"{name}" "{company}" podcast',
  '"{name}" "{company}" interview',
  '"{name}" "{company}" speaker',
  '"{name}" pest control industry',
  '"{name}" "{company}" news',
  '"{name}" PCT Magazine',
  '"{name}" PestWorld conference',
];

// Keywords to classify mention types
const MENTION_TYPE_KEYWORDS = {
  podcast: ['podcast', 'episode', 'listen', 'audio', 'spotify', 'apple podcasts'],
  news: ['news', 'article', 'reported', 'announced', 'press release'],
  event: ['conference', 'summit', 'expo', 'webinar', 'speaker', 'keynote', 'panelist'],
  article: ['blog', 'wrote', 'authored', 'published', 'contributed'],
  interview: ['interview', 'sat down with', 'spoke with', 'Q&A'],
};

// ============================================
// EMPLOYEE MEDIA COLLECTOR
// ============================================

export class EmployeeMediaCollector extends BaseCollector<EmployeeMediaData, CollectorOptions> {
  readonly sourceType = 'employee_media' as const;
  readonly displayName = 'Employee Media Presence';

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
    _domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<EmployeeMediaData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'SerpAPI key not configured',
        Date.now() - startTime
      );
    }

    try {
      // This collector needs employee data to search for
      // Return empty data that will be populated by collectForEmployees
      const data: EmployeeMediaData = {
        companyName,
        employeeProfiles: [],
        totalMediaMentions: 0,
        employeesWithPresence: 0,
        thoughtLeaders: [],
        collectedAt: new Date().toISOString(),
      };

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[EmployeeMediaCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: EmployeeMediaData): number {
    if (!data) return 0;

    let score = 0;

    // Base score for having results
    if (data.employeeProfiles.length > 0) score += 20;

    // Score based on total mentions
    score += Math.min(30, data.totalMediaMentions * 5);

    // Bonus for thought leaders
    score += Math.min(30, data.thoughtLeaders.length * 10);

    // Bonus for employees with presence
    score += Math.min(20, data.employeesWithPresence * 5);

    return Math.min(100, score);
  }

  /**
   * Collect media presence for specific employees
   */
  async collectForEmployees(
    companyName: string,
    employees: EnhancedApolloPerson[],
    maxEmployees: number = 10
  ): Promise<EmployeeMediaData> {
    const data: EmployeeMediaData = {
      companyName,
      employeeProfiles: [],
      totalMediaMentions: 0,
      employeesWithPresence: 0,
      thoughtLeaders: [],
      collectedAt: new Date().toISOString(),
    };

    if (!this.apiKey) {
      return data;
    }

    // Focus on senior employees most likely to have media presence
    const targetEmployees = employees
      .filter((e) =>
        ['c_level', 'owner', 'partner', 'vp', 'director'].includes(e.seniority || '')
      )
      .slice(0, maxEmployees);

    for (const employee of targetEmployees) {
      try {
        const profile = await this.searchEmployeeMedia(employee.fullName, companyName);
        data.employeeProfiles.push(profile);

        data.totalMediaMentions +=
          profile.podcastAppearances.length +
          profile.newsArticles.length +
          profile.speakingEvents.length +
          profile.publishedContent.length;

        if (profile.visibilityScore > 0) {
          data.employeesWithPresence++;
        }

        // Small delay between searches
        await this.sleep(500);
      } catch (error) {
        console.debug(`[EmployeeMediaCollector] Search failed for ${employee.fullName}:`, error);
      }
    }

    // Identify thought leaders (top 3 by visibility score)
    data.thoughtLeaders = data.employeeProfiles
      .filter((p) => p.visibilityScore > 20)
      .sort((a, b) => b.visibilityScore - a.visibilityScore)
      .slice(0, 3)
      .map((p) => p.name);

    return data;
  }

  /**
   * Search for media mentions of a specific employee
   */
  private async searchEmployeeMedia(
    employeeName: string,
    companyName: string
  ): Promise<EmployeeMediaProfile> {
    const profile: EmployeeMediaProfile = {
      name: employeeName,
      title: null,
      podcastAppearances: [],
      newsArticles: [],
      speakingEvents: [],
      publishedContent: [],
      linkedinPosts: 0,
      linkedinArticles: 0,
      visibilityScore: 0,
    };

    // Run searches with different query templates
    const queriesToRun = SEARCH_TEMPLATES.slice(0, 3); // Limit to 3 queries per person

    for (const template of queriesToRun) {
      const query = template
        .replace('{name}', employeeName)
        .replace('{company}', companyName);

      try {
        const results = await this.runSearch(query);

        for (const result of results) {
          const mention = this.transformToMention(result, employeeName);
          if (mention) {
            this.categorizeMention(mention, profile);
          }
        }
      } catch (error) {
        console.debug(`[EmployeeMediaCollector] Search failed for query "${query}":`, error);
      }
    }

    // Deduplicate mentions by URL
    profile.podcastAppearances = this.deduplicateMentions(profile.podcastAppearances);
    profile.newsArticles = this.deduplicateMentions(profile.newsArticles);
    profile.speakingEvents = this.deduplicateMentions(profile.speakingEvents);
    profile.publishedContent = this.deduplicateMentions(profile.publishedContent);

    // Calculate visibility score
    profile.visibilityScore = this.calculateVisibilityScore(profile);

    return profile;
  }

  /**
   * Run a single search
   */
  private async runSearch(query: string): Promise<SerpResult[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey!,
      engine: 'google',
      q: query,
      num: '10',
      gl: 'us',
      hl: 'en',
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json();
    return data.organic_results || [];
  }

  /**
   * Transform search result to media mention
   */
  private transformToMention(result: SerpResult, employeeName: string): MediaMention | null {
    if (!result.title || !result.link) return null;

    // Check if the result actually mentions the employee
    const combined = `${result.title} ${result.snippet || ''}`.toLowerCase();
    const nameParts = employeeName.toLowerCase().split(' ');
    const mentionsEmployee = nameParts.some((part) => combined.includes(part));

    if (!mentionsEmployee) return null;

    // Determine mention type
    const mentionType = this.classifyMentionType(combined);

    // Extract source name
    const sourceName = this.extractSourceName(result.link);

    return {
      title: result.title,
      source: sourceName,
      url: result.link,
      date: this.parseDate(result.date),
      type: mentionType,
    };
  }

  /**
   * Classify the type of media mention
   */
  private classifyMentionType(text: string): MediaMention['type'] {
    for (const [type, keywords] of Object.entries(MENTION_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return type as MediaMention['type'];
        }
      }
    }
    return 'news'; // Default to news
  }

  /**
   * Categorize mention into appropriate profile array
   */
  private categorizeMention(mention: MediaMention, profile: EmployeeMediaProfile): void {
    switch (mention.type) {
      case 'podcast':
        profile.podcastAppearances.push(mention);
        break;
      case 'event':
        profile.speakingEvents.push(mention);
        break;
      case 'article':
        profile.publishedContent.push(mention);
        break;
      case 'interview':
        profile.newsArticles.push(mention); // Interviews go to news
        break;
      case 'news':
      default:
        profile.newsArticles.push(mention);
        break;
    }
  }

  /**
   * Remove duplicate mentions by URL
   */
  private deduplicateMentions(mentions: MediaMention[]): MediaMention[] {
    const seen = new Set<string>();
    return mentions.filter((m) => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    });
  }

  /**
   * Calculate visibility score for an employee
   */
  private calculateVisibilityScore(profile: EmployeeMediaProfile): number {
    let score = 0;

    // Podcast appearances are high value
    score += profile.podcastAppearances.length * 15;

    // Speaking events are high value
    score += profile.speakingEvents.length * 15;

    // Published content shows thought leadership
    score += profile.publishedContent.length * 10;

    // News mentions are moderate value
    score += profile.newsArticles.length * 5;

    return Math.min(100, score);
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
export const employeeMediaCollector = new EmployeeMediaCollector();
