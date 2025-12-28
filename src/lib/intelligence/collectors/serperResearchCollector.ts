/**
 * Serper Research Collector
 * Uses Serper API to search for company awards, M&A activity, key news, and executive profiles
 * This collector is specifically designed to gather data for sales reports
 */

import { BaseCollector } from './base';
import type { CollectorResult, CollectorOptions } from '../types';

// ============================================
// TYPES
// ============================================

export interface AwardResult {
  title: string;
  awardName: string;
  year: number | null;
  source: string;
  sourceUrl: string;
  snippet: string;
}

export interface MnAResult {
  title: string;
  type: 'acquisition' | 'merger' | 'investment' | 'partnership';
  date: string | null;
  parties: string[];
  source: string;
  sourceUrl: string;
  snippet: string;
}

export interface NewsResult {
  title: string;
  source: string;
  sourceUrl: string;
  date: string | null;
  snippet: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyQuote: string | null;
}

export interface ExecutiveProfile {
  name: string;
  title: string | null;
  source: string;
  sourceUrl: string;
  snippet: string;
  keyQuote: string | null;
}

export interface TechnologyResult {
  name: string;           // e.g., "FieldRoutes"
  confidence: 'high' | 'medium' | 'low';
  source: string;         // e.g., "case study", "testimonial", "mention"
  sourceUrl: string;
  snippet: string;
}

export interface SerperResearchData {
  companyName: string;
  domain: string | null;

  // Awards and Recognition
  awards: AwardResult[];
  totalAwardsFound: number;
  isPctTop100: boolean;
  pctTop100Rank: number | null;

  // M&A Activity
  mnActivity: MnAResult[];
  hasMnAHistory: boolean;
  isPEBacked: boolean;
  peBackerName: string | null;

  // Ownership Type
  ownershipType: 'family' | 'pe_backed' | 'franchise' | 'independent' | 'unknown';
  ownerName: string | null;
  ownershipEvidence: string[];
  generationOwned: number | null; // e.g., 3 for "3rd generation"
  previousOwners: string[]; // List of previous owner names

  // News and Quotes
  recentNews: NewsResult[];
  keyQuotes: string[];

  // Executive Profiles
  executiveProfiles: ExecutiveProfile[];
  ownerProfile: ExecutiveProfile | null;

  // Technology Stack (detected via case studies/testimonials)
  detectedTechnologies: TechnologyResult[];

  // Summary Metrics
  industryRecognitionScore: number; // 0-100 based on awards
  mediaPresenceScore: number; // 0-100 based on news coverage

  collectedAt: string;
}

// ============================================
// CONSTANTS
// ============================================

// Award search queries
const AWARD_QUERIES = [
  '"{company}" "PCT Top 100" site:pctonline.com',
  '"{company}" "PCT Top 100"',
  '"{company}" "Inc 5000" OR "Inc. 5000"',
  '"{company}" award winner pest control',
  '"{company}" "best of" award',
  '"{company}" "excellence award"',
  '"{company}" NPMA award QualityPro',
  '"{company}" "business of the year"',
];

// Ownership type queries (family, independent, etc.)
const OWNERSHIP_QUERIES = [
  '"{company}" "family-owned" OR "family owned" OR "family business"',
  '"{company}" owner founder CEO president',
  '"{company}" "locally owned" OR "locally owned and operated"',
  '"{company}" "third generation" OR "3rd generation" OR "second generation"',
];

// M&A search queries
const MNA_QUERIES = [
  '"{company}" acquired by',
  '"{company}" acquisition',
  '"{company}" merger',
  '"{company}" private equity',
  '"{company}" PE investment',
  '"{company}" recapitalization',
  '"{company}" partnership announcement',
];

// Executive profile queries
const EXECUTIVE_QUERIES = [
  '"{company}" owner interview',
  '"{company}" CEO interview',
  '"{company}" founder story',
  '"{company}" president profile',
];

// Technology/CRM detection queries
const TECHNOLOGY_QUERIES = [
  '"{company}" FieldRoutes case study testimonial',
  '"{company}" ServiceTitan case study testimonial',
  '"{company}" PestRoutes OR PestPac case study',
  '"{company}" WorkWave OR Briostack case study',
  '"{company}" Salesforce OR HubSpot case study',
];

// Key quotes/interview queries
const QUOTE_QUERIES = [
  '"{company}" {owner} quote OR interview',
  '"{company}" CEO OR owner interview testimonial',
];

// Map of technology names to their canonical form
const TECHNOLOGY_NAMES: Record<string, string> = {
  fieldroutes: 'FieldRoutes',
  'field routes': 'FieldRoutes',
  servicetitan: 'ServiceTitan',
  'service titan': 'ServiceTitan',
  pestroutes: 'PestRoutes',
  'pest routes': 'PestRoutes',
  pestpac: 'PestPac',
  'pest pac': 'PestPac',
  workwave: 'WorkWave',
  'work wave': 'WorkWave',
  briostack: 'Briostack',
  pocomos: 'Pocomos',
  gorillaDesk: 'GorillaDesk',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  jobber: 'Jobber',
  housecall: 'Housecall Pro',
  'housecall pro': 'Housecall Pro',
};

// Known PE firms in pest control industry
const PEST_CONTROL_PE_FIRMS = [
  'Anticimex',
  'Rentokil',
  'Rollins',
  'Terminix',
  'Portfolio Companies',
  'private equity',
  'PE-backed',
  'PE backed',
  'acquired by',
  'partnership with',
];

// Award recognition patterns
const AWARD_PATTERNS = [
  /best of/i,
  /award(ed)?/i,
  /winner/i,
  /top \d+/i,
  /excellence/i,
  /recognition/i,
  /honoree/i,
  /finalist/i,
  /certified/i,
  /accredited/i,
];

// ============================================
// SERPER RESEARCH COLLECTOR
// ============================================

export class SerperResearchCollector extends BaseCollector<SerperResearchData, CollectorOptions> {
  readonly sourceType = 'serper_research' as const;
  readonly displayName = 'External Research';

  private apiKey: string | null = null;
  private baseUrl = 'https://google.serper.dev/search';

  constructor() {
    super();
    // Support both SERPER_API_KEY and SERP_API_KEY
    this.apiKey = process.env.SERPER_API_KEY || process.env.SERP_API_KEY || null;
  }

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<SerperResearchData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'Serper API key not configured (set SERPER_API_KEY or SERP_API_KEY)',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.performResearch(companyName, domain, options);
      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[SerperResearchCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: SerperResearchData): number {
    if (!data) return 0;

    let score = 0;

    // Awards contribute significantly (up to 40 points)
    score += Math.min(40, data.awards.length * 8);

    // M&A/PE information (up to 20 points)
    if (data.hasMnAHistory) score += 10;
    if (data.isPEBacked) score += 10;

    // News coverage (up to 20 points)
    score += Math.min(20, data.recentNews.length * 4);

    // Executive profiles (up to 20 points)
    score += Math.min(20, data.executiveProfiles.length * 5);
    if (data.ownerProfile) score += 5;

    return Math.min(100, score);
  }

  /**
   * Perform all research queries
   */
  private async performResearch(
    companyName: string,
    domain: string | null,
    options: CollectorOptions
  ): Promise<SerperResearchData> {
    // Run all research in parallel
    const [awards, mna, news, executives, technologies, ownershipInfo] = await Promise.all([
      this.searchAwards(companyName, domain),
      this.searchMnA(companyName, domain),
      this.searchNews(companyName, domain),
      this.searchExecutives(companyName, domain),
      this.searchTechnologies(companyName, domain),
      this.searchOwnership(companyName, domain),
    ]);

    // Determine if PE-backed based on M&A results
    const peInfo = this.detectPEBackedStatus(mna);

    // Determine ownership type (PE-backed takes priority)
    let ownershipType: SerperResearchData['ownershipType'] = ownershipInfo.type;
    if (peInfo.isPEBacked) {
      ownershipType = 'pe_backed';
    }

    // Detect PCT Top 100 from awards
    const pctInfo = this.detectPctTop100(awards);

    // Extract key quotes from news
    const keyQuotes = this.extractKeyQuotes(news, executives);

    // Calculate scores
    const industryRecognitionScore = this.calculateIndustryRecognitionScore(awards);
    const mediaPresenceScore = this.calculateMediaPresenceScore(news);

    // Find owner profile if exists
    let ownerProfile = executives.find(e =>
      e.title?.toLowerCase().includes('owner') ||
      e.title?.toLowerCase().includes('founder') ||
      e.title?.toLowerCase().includes('ceo')
    ) || null;

    // Use owner name from ownership search if not found in executives
    const ownerName = ownerProfile?.name || ownershipInfo.ownerName;

    return {
      companyName,
      domain,
      awards,
      totalAwardsFound: awards.length,
      isPctTop100: pctInfo.isPctTop100,
      pctTop100Rank: pctInfo.rank,
      mnActivity: mna,
      hasMnAHistory: mna.length > 0,
      isPEBacked: peInfo.isPEBacked,
      peBackerName: peInfo.backerName,
      ownershipType,
      ownerName,
      ownershipEvidence: ownershipInfo.evidence,
      generationOwned: ownershipInfo.generationOwned,
      previousOwners: ownershipInfo.previousOwners,
      recentNews: news,
      keyQuotes,
      executiveProfiles: executives,
      ownerProfile,
      detectedTechnologies: technologies,
      industryRecognitionScore,
      mediaPresenceScore,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Detect PCT Top 100 status from awards
   */
  private detectPctTop100(awards: AwardResult[]): { isPctTop100: boolean; rank: number | null } {
    for (const award of awards) {
      const combined = `${award.title} ${award.awardName} ${award.snippet}`.toLowerCase();
      if (/pct.*top.*100|top.*100.*pct|pest.*control.*tech.*top.*100/i.test(combined)) {
        // Try to extract rank
        const rankMatch = combined.match(/(?:#|no\.?|rank|ranked|number)\s*(\d+)/i);
        const rank = rankMatch ? parseInt(rankMatch[1]) : null;
        console.log(`[SerperResearch] Found PCT Top 100${rank ? ` #${rank}` : ''}`);
        return { isPctTop100: true, rank };
      }
    }
    return { isPctTop100: false, rank: null };
  }

  /**
   * Search for ownership type information
   */
  private async searchOwnership(
    companyName: string,
    domain: string | null
  ): Promise<{
    type: SerperResearchData['ownershipType'];
    ownerName: string | null;
    evidence: string[];
    generationOwned: number | null;
    previousOwners: string[];
  }> {
    const evidence: string[] = [];
    let detectedType: SerperResearchData['ownershipType'] = 'unknown';
    let ownerName: string | null = null;
    let generationOwned: number | null = null;
    const previousOwners: string[] = [];

    for (const queryTemplate of OWNERSHIP_QUERIES.slice(0, 3)) {
      try {
        const query = queryTemplate.replace('{company}', companyName);
        const results = await this.runSearch(query);

        for (const result of results) {
          const combined = `${result.title || ''} ${result.snippet || ''}`;
          const lower = combined.toLowerCase();

          // Skip if doesn't mention company
          if (!lower.includes(companyName.toLowerCase().split(' ')[0])) continue;

          // Check for family ownership
          if (/family[\s-]owned|family business|locally owned|third generation|3rd generation|second generation|2nd generation|father.*(son|daughter)|family[\s-]run/i.test(combined)) {
            detectedType = 'family';
            evidence.push(combined.substring(0, 200));
            console.log(`[SerperResearch] Detected family ownership for ${companyName}`);
          }

          // Extract generation info
          if (!generationOwned) {
            const genMatch = combined.match(/(\d+)(?:st|nd|rd|th)[\s-]*generation|(\bfirst|second|third|fourth|fifth\b)[\s-]*generation/i);
            if (genMatch) {
              if (genMatch[1]) {
                generationOwned = parseInt(genMatch[1]);
              } else if (genMatch[2]) {
                const genMap: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
                generationOwned = genMap[genMatch[2].toLowerCase()] || null;
              }
              if (generationOwned) {
                console.log(`[SerperResearch] Found ${generationOwned}${generationOwned === 1 ? 'st' : generationOwned === 2 ? 'nd' : generationOwned === 3 ? 'rd' : 'th'} generation ownership`);
              }
            }
          }

          // Extract previous owners
          const prevOwnerMatch = combined.match(/(?:previous|former|past)\s+owner[s]?[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi);
          if (prevOwnerMatch) {
            prevOwnerMatch.forEach(m => {
              const nameMatch = m.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
              if (nameMatch && !previousOwners.includes(nameMatch[1])) {
                previousOwners.push(nameMatch[1]);
              }
            });
          }

          // Check for franchise
          if (/franchise|franchisee|franchisor/i.test(combined)) {
            detectedType = 'franchise';
            evidence.push(combined.substring(0, 200));
          }

          // Extract owner name
          if (!ownerName) {
            const namePatterns = [
              /(?:owner|founder|ceo|president)[,\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
              /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:,?\s+(?:owner|founder|ceo|president))/gi,
              /(?:led by|founded by|owned by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
            ];

            for (const pattern of namePatterns) {
              const match = combined.match(pattern);
              if (match) {
                // Extract just the name part
                const fullMatch = match[0];
                const nameMatch = fullMatch.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
                if (nameMatch && nameMatch[1].length > 5) {
                  ownerName = nameMatch[1];
                  console.log(`[SerperResearch] Found owner name: ${ownerName}`);
                  break;
                }
              }
            }
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.debug(`[SerperResearch] Ownership search failed for ${companyName}:`, error);
      }
    }

    return { type: detectedType, ownerName, evidence, generationOwned, previousOwners };
  }

  /**
   * Search for awards and recognition
   */
  private async searchAwards(
    companyName: string,
    domain: string | null
  ): Promise<AwardResult[]> {
    const awards: AwardResult[] = [];

    // Run a subset of queries to avoid rate limits
    const queriesToRun = AWARD_QUERIES.slice(0, 4);

    for (const queryTemplate of queriesToRun) {
      try {
        const query = queryTemplate.replace('{company}', companyName);
        const results = await this.runSearch(query);

        for (const result of results) {
          const award = this.parseAwardResult(result, companyName);
          if (award) {
            awards.push(award);
          }
        }

        await this.sleep(300); // Rate limit protection
      } catch (error) {
        console.debug(`[SerperResearch] Award search failed for ${companyName}:`, error);
      }
    }

    // Deduplicate by title
    return this.deduplicateByTitle(awards);
  }

  /**
   * Search for M&A activity
   */
  private async searchMnA(
    companyName: string,
    domain: string | null
  ): Promise<MnAResult[]> {
    const results: MnAResult[] = [];

    // Run a subset of queries
    const queriesToRun = MNA_QUERIES.slice(0, 3);

    for (const queryTemplate of queriesToRun) {
      try {
        const query = queryTemplate.replace('{company}', companyName);
        const searchResults = await this.runSearch(query);

        for (const result of searchResults) {
          const mna = this.parseMnAResult(result, companyName);
          if (mna) {
            results.push(mna);
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.debug(`[SerperResearch] M&A search failed for ${companyName}:`, error);
      }
    }

    return this.deduplicateByTitle(results);
  }

  /**
   * Search for recent news
   */
  private async searchNews(
    companyName: string,
    domain: string | null
  ): Promise<NewsResult[]> {
    const news: NewsResult[] = [];

    try {
      // Search for recent news
      const query = `"${companyName}" news OR interview OR announcement`;
      const results = await this.runSearch(query, { tbs: 'qdr:y' }); // Last year

      for (const result of results) {
        const newsItem = this.parseNewsResult(result, companyName);
        if (newsItem) {
          news.push(newsItem);
        }
      }
    } catch (error) {
      console.debug(`[SerperResearch] News search failed for ${companyName}:`, error);
    }

    return news.slice(0, 10); // Limit to 10 most recent
  }

  /**
   * Search for executive profiles
   */
  private async searchExecutives(
    companyName: string,
    domain: string | null
  ): Promise<ExecutiveProfile[]> {
    const profiles: ExecutiveProfile[] = [];

    for (const queryTemplate of EXECUTIVE_QUERIES.slice(0, 2)) {
      try {
        const query = queryTemplate.replace('{company}', companyName);
        const results = await this.runSearch(query);

        for (const result of results) {
          const profile = this.parseExecutiveResult(result, companyName);
          if (profile) {
            profiles.push(profile);
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.debug(`[SerperResearch] Executive search failed for ${companyName}:`, error);
      }
    }

    return profiles.slice(0, 5);
  }

  /**
   * Search for technology case studies and testimonials
   */
  private async searchTechnologies(
    companyName: string,
    domain: string | null
  ): Promise<TechnologyResult[]> {
    const technologies: TechnologyResult[] = [];
    const foundTechNames = new Set<string>();

    // Run a subset of technology queries
    for (const queryTemplate of TECHNOLOGY_QUERIES.slice(0, 5)) {
      try {
        const query = queryTemplate.replace('{company}', companyName);
        const results = await this.runSearch(query);

        for (const result of results) {
          const tech = this.parseTechnologyResult(result, companyName);
          if (tech && !foundTechNames.has(tech.name)) {
            technologies.push(tech);
            foundTechNames.add(tech.name);
          }
        }

        await this.sleep(300);
      } catch (error) {
        console.debug(`[SerperResearch] Technology search failed for ${companyName}:`, error);
      }
    }

    return technologies;
  }

  /**
   * Parse a search result for technology mentions
   */
  private parseTechnologyResult(
    result: SerperSearchResult,
    companyName: string
  ): TechnologyResult | null {
    const title = result.title || '';
    const snippet = result.snippet || '';
    const link = result.link || '';
    const combinedText = `${title} ${snippet}`.toLowerCase();

    // Check if the result mentions the company
    const companyLower = companyName.toLowerCase();
    const hasCompanyMention = combinedText.includes(companyLower) ||
                              link.toLowerCase().includes(companyLower.replace(/\s+/g, '-'));

    if (!hasCompanyMention) return null;

    // Look for technology names in the text
    for (const [keyword, techName] of Object.entries(TECHNOLOGY_NAMES)) {
      if (combinedText.includes(keyword)) {
        // Determine confidence based on source type
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let source = 'mention';

        if (combinedText.includes('case study') || link.includes('case-study')) {
          confidence = 'high';
          source = 'case study';
        } else if (combinedText.includes('testimonial') || combinedText.includes('customer story')) {
          confidence = 'high';
          source = 'testimonial';
        } else if (combinedText.includes('uses') || combinedText.includes('powered by') ||
                   combinedText.includes('implemented') || combinedText.includes('switched to')) {
          confidence = 'medium';
          source = 'implementation mention';
        }

        console.log(`[SerperResearch] Found technology ${techName} for ${companyName} (${confidence} confidence)`);

        return {
          name: techName,
          confidence,
          source,
          sourceUrl: link,
          snippet: snippet.substring(0, 200),
        };
      }
    }

    return null;
  }

  /**
   * Run a single Serper search
   */
  private async runSearch(
    query: string,
    options: { tbs?: string; num?: number } = {}
  ): Promise<SerperSearchResult[]> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: options.num || 10,
        gl: 'us',
        hl: 'en',
        ...(options.tbs && { tbs: options.tbs }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();
    return data.organic || [];
  }

  /**
   * Parse a search result as an award
   */
  private parseAwardResult(result: SerperSearchResult, companyName: string): AwardResult | null {
    if (!result.title || !result.link) return null;

    const combined = `${result.title} ${result.snippet || ''}`.toLowerCase();

    // Must match award patterns
    const matchesAwardPattern = AWARD_PATTERNS.some(pattern => pattern.test(combined));
    if (!matchesAwardPattern) return null;

    // Must mention company
    if (!combined.includes(companyName.toLowerCase())) return null;

    // Extract year from title or snippet
    const yearMatch = combined.match(/20\d{2}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    // Extract award name
    const awardName = this.extractAwardName(result.title, result.snippet || '');

    return {
      title: result.title,
      awardName,
      year,
      source: this.extractSourceName(result.link),
      sourceUrl: result.link,
      snippet: result.snippet || '',
    };
  }

  /**
   * Parse a search result as M&A activity
   */
  private parseMnAResult(result: SerperSearchResult, companyName: string): MnAResult | null {
    if (!result.title || !result.link) return null;

    const combined = `${result.title} ${result.snippet || ''}`.toLowerCase();

    // Must relate to M&A activity
    const mnaKeywords = ['acquired', 'acquisition', 'merger', 'private equity', 'pe ', 'investment', 'partnership'];
    const isMnA = mnaKeywords.some(kw => combined.includes(kw));
    if (!isMnA) return null;

    // Must mention company
    if (!combined.includes(companyName.toLowerCase())) return null;

    // Determine type
    let type: MnAResult['type'] = 'partnership';
    if (combined.includes('acquired') || combined.includes('acquisition')) {
      type = 'acquisition';
    } else if (combined.includes('merger')) {
      type = 'merger';
    } else if (combined.includes('investment') || combined.includes('private equity') || combined.includes('pe ')) {
      type = 'investment';
    }

    // Extract parties mentioned
    const parties = this.extractMnAParties(result.title, result.snippet || '');

    return {
      title: result.title,
      type,
      date: result.date || null,
      parties,
      source: this.extractSourceName(result.link),
      sourceUrl: result.link,
      snippet: result.snippet || '',
    };
  }

  /**
   * Parse a search result as news
   */
  private parseNewsResult(result: SerperSearchResult, companyName: string): NewsResult | null {
    if (!result.title || !result.link) return null;

    const combined = `${result.title} ${result.snippet || ''}`.toLowerCase();

    // Must mention company
    if (!combined.includes(companyName.toLowerCase())) return null;

    // Skip company's own website
    if (result.link.includes(companyName.toLowerCase().replace(/\s+/g, ''))) return null;

    // Determine sentiment
    const sentiment = this.analyzeSentiment(combined);

    // Extract key quote if present
    const keyQuote = this.extractQuote(result.snippet || '');

    return {
      title: result.title,
      source: this.extractSourceName(result.link),
      sourceUrl: result.link,
      date: result.date || null,
      snippet: result.snippet || '',
      sentiment,
      keyQuote,
    };
  }

  /**
   * Parse a search result as executive profile
   */
  private parseExecutiveResult(result: SerperSearchResult, companyName: string): ExecutiveProfile | null {
    if (!result.title || !result.link) return null;

    const combined = `${result.title} ${result.snippet || ''}`.toLowerCase();

    // Must be about a person (interview, profile, story)
    const profileKeywords = ['interview', 'profile', 'story', 'founder', 'owner', 'ceo', 'president'];
    const isProfile = profileKeywords.some(kw => combined.includes(kw));
    if (!isProfile) return null;

    // Extract name and title
    const { name, title } = this.extractNameAndTitle(result.title, result.snippet || '');
    if (!name) return null;

    // Extract key quote
    const keyQuote = this.extractQuote(result.snippet || '');

    return {
      name,
      title,
      source: this.extractSourceName(result.link),
      sourceUrl: result.link,
      snippet: result.snippet || '',
      keyQuote,
    };
  }

  /**
   * Detect if company is PE-backed based on M&A results
   */
  private detectPEBackedStatus(mna: MnAResult[]): { isPEBacked: boolean; backerName: string | null } {
    for (const item of mna) {
      const combined = `${item.title} ${item.snippet}`.toLowerCase();

      // Check for PE indicators
      if (combined.includes('private equity') ||
          combined.includes('pe ') ||
          combined.includes('pe-backed') ||
          combined.includes('pe backed') ||
          item.type === 'investment') {

        // Try to extract backer name
        for (const party of item.parties) {
          if (party.toLowerCase().includes('capital') ||
              party.toLowerCase().includes('partners') ||
              party.toLowerCase().includes('equity')) {
            return { isPEBacked: true, backerName: party };
          }
        }

        return { isPEBacked: true, backerName: null };
      }
    }

    return { isPEBacked: false, backerName: null };
  }

  /**
   * Extract key quotes from all results
   */
  private extractKeyQuotes(news: NewsResult[], executives: ExecutiveProfile[]): string[] {
    const quotes: string[] = [];

    // Get quotes from news
    for (const item of news) {
      if (item.keyQuote) {
        quotes.push(item.keyQuote);
      }
    }

    // Get quotes from executive profiles
    for (const profile of executives) {
      if (profile.keyQuote) {
        quotes.push(profile.keyQuote);
      }
    }

    return quotes.slice(0, 5); // Limit to 5 best quotes
  }

  /**
   * Calculate industry recognition score based on awards
   */
  private calculateIndustryRecognitionScore(awards: AwardResult[]): number {
    if (awards.length === 0) return 0;

    let score = 0;

    // Base score for having awards
    score += Math.min(50, awards.length * 10);

    // Bonus for recent awards (last 3 years)
    const currentYear = new Date().getFullYear();
    const recentAwards = awards.filter(a => a.year && a.year >= currentYear - 3);
    score += Math.min(30, recentAwards.length * 10);

    // Bonus for industry-specific awards (PCT, NPMA, etc.)
    const industryAwards = awards.filter(a =>
      a.source.toLowerCase().includes('pct') ||
      a.awardName.toLowerCase().includes('npma') ||
      a.awardName.toLowerCase().includes('qualitypro')
    );
    score += Math.min(20, industryAwards.length * 10);

    return Math.min(100, score);
  }

  /**
   * Calculate media presence score
   */
  private calculateMediaPresenceScore(news: NewsResult[]): number {
    if (news.length === 0) return 0;

    let score = 0;

    // Base score for having news coverage
    score += Math.min(50, news.length * 5);

    // Bonus for positive news
    const positiveNews = news.filter(n => n.sentiment === 'positive');
    score += Math.min(30, positiveNews.length * 10);

    // Bonus for having key quotes
    const withQuotes = news.filter(n => n.keyQuote);
    score += Math.min(20, withQuotes.length * 5);

    return Math.min(100, score);
  }

  /**
   * Extract award name from text
   */
  private extractAwardName(title: string, snippet: string): string {
    const combined = `${title} ${snippet}`;

    // Look for common award patterns
    const patterns = [
      /"([^"]+award[^"]*?)"/i,
      /"([^"]+winner[^"]*?)"/i,
      /([A-Z][^.]*?(?:Award|Recognition|Excellence))/,
      /(Best of [^,\n]+)/i,
      /(Top \d+ [^,\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Industry Award';
  }

  /**
   * Extract parties from M&A text
   */
  private extractMnAParties(title: string, snippet: string): string[] {
    const combined = `${title} ${snippet}`;
    const parties: string[] = [];

    // Look for company names (capitalized words followed by common business suffixes)
    const companyPattern = /([A-Z][a-z]+ )+(?:Capital|Partners|Equity|Holdings|Group|Inc|LLC|Corp)/g;
    const matches = combined.match(companyPattern);

    if (matches) {
      parties.push(...matches.map(m => m.trim()));
    }

    return [...new Set(parties)];
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['award', 'growth', 'success', 'best', 'leading', 'innovative', 'excellent', 'expansion', 'honored'];
    const negativeWords = ['lawsuit', 'complaint', 'problem', 'issue', 'layoff', 'bankruptcy', 'fraud', 'investigation'];

    const lower = text.toLowerCase();

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lower.includes(word)) positiveCount++;
    }

    for (const word of negativeWords) {
      if (lower.includes(word)) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Extract a quote from text
   */
  private extractQuote(text: string): string | null {
    // Look for quoted text
    const quoteMatch = text.match(/"([^"]{20,200})"/);
    if (quoteMatch) {
      return quoteMatch[1];
    }

    // Look for text after "said" or "says"
    const saidMatch = text.match(/(?:said|says)[,:]?\s*["']?([^"'\n.]{20,150})/i);
    if (saidMatch) {
      return saidMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract name and title from executive profile text
   */
  private extractNameAndTitle(title: string, snippet: string): { name: string | null; title: string | null } {
    const combined = `${title} ${snippet}`;

    // Look for "Name, Title" or "Name - Title" patterns
    const patterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+),?\s*(Owner|Founder|CEO|President|COO|CFO|VP|Director)/i,
      /([A-Z][a-z]+ [A-Z][a-z]+)\s*[-–]\s*(Owner|Founder|CEO|President|COO|CFO|VP|Director)/i,
      /(Owner|Founder|CEO|President)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i,
    ];

    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) {
        // Handle both "Name, Title" and "Title Name" patterns
        if (match[1].match(/^(Owner|Founder|CEO|President|COO|CFO|VP|Director)/i)) {
          return { name: match[2], title: match[1] };
        }
        return { name: match[1], title: match[2] };
      }
    }

    return { name: null, title: null };
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
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Deduplicate results by title
   */
  private deduplicateByTitle<T extends { title: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ============================================
// SERPER API TYPES
// ============================================

interface SerperSearchResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  position?: number;
}

// Export singleton
export const serperResearchCollector = new SerperResearchCollector();
