/**
 * Industry Sources Intelligence Collector
 *
 * Collects intelligence from pest control industry sources:
 * - PCT Top 100 rankings and revenue
 * - Inc 5000 rankings and growth
 * - Business Journal Fast 50 lists
 * - NPMA/QualityPro membership
 * - State association leadership
 * - Podcast appearances and quotes
 * - Industry news (M&A, expansions)
 */

// ============================================
// TYPES
// ============================================

export interface IndustryIntelligence {
  pctTop100: {
    isRanked: boolean;
    rank: number | null;
    year: number | null;
    revenue: string | null;
    employeeCount: number | null;
    growthPercent: number | null;
    sourceUrl: string | null;
    historicalRanks: { year: number; rank: number }[];
  };

  inc5000: {
    isRanked: boolean;
    rank: number | null;
    year: number | null;
    revenue: string | null;
    growthPercent: number | null;
    yearsOnList: number;
    sourceUrl: string | null;
  };

  businessJournal: {
    publication: string | null;
    listName: string | null;
    rank: number | null;
    year: number | null;
    sourceUrl: string | null;
  };

  associations: {
    npma: {
      isMember: boolean;
      isQualityPro: boolean;
      leadershipRole: string | null;
      sourceUrl: string | null;
    };
    stateAssociation: {
      name: string | null;
      isMember: boolean;
      leadershipRole: string | null;
      boardPosition: string | null;
      yearsActive: number | null;
      sourceUrl: string | null;
    };
  };

  mediaAppearances: {
    podcasts: PodcastAppearance[];
    articles: ArticleMention[];
  };

  industryNews: {
    acquisitions: AcquisitionNews[];
    expansions: ExpansionNews[];
  };
}

export interface PodcastAppearance {
  showName: string;
  episodeTitle: string;
  date: string | null;
  guestName: string;
  keyQuotes: string[];
  topics: string[];
  sourceUrl: string;
}

export interface ArticleMention {
  publication: string;
  title: string;
  date: string | null;
  type: 'profile' | 'news' | 'interview' | 'mention';
  summary: string;
  quotes: string[];
  sourceUrl: string;
}

export interface AcquisitionNews {
  headline: string;
  acquirer: string;
  acquired: string;
  date: string | null;
  dealValue: string | null;
  sourceUrl: string;
}

export interface ExpansionNews {
  headline: string;
  details: string;
  date: string | null;
  sourceUrl: string;
}

// ============================================
// STATE ASSOCIATION MAPPINGS
// ============================================

export const STATE_PEST_ASSOCIATIONS: Record<string, { name: string; domain: string }> = {
  'NC': { name: 'North Carolina Pest Management Association', domain: 'ncpestmanagement.org' },
  'SC': { name: 'South Carolina Pest Control Association', domain: 'scpca.net' },
  'VA': { name: 'Virginia Pest Management Association', domain: 'vpma.com' },
  'GA': { name: 'Georgia Pest Control Association', domain: 'gpca.org' },
  'FL': { name: 'Florida Pest Management Association', domain: 'flpma.org' },
  'TX': { name: 'Texas Pest Control Association', domain: 'texaspca.org' },
  'CA': { name: 'Pest Control Operators of California', domain: 'pcoc.org' },
  'AZ': { name: 'Arizona Pest Management Association', domain: 'azpma.com' },
  'TN': { name: 'Tennessee Pest Control Association', domain: 'tnpca.org' },
  'AL': { name: 'Alabama Pest Control Association', domain: 'alabamapestcontrol.com' },
  'OH': { name: 'Ohio Pest Management Association', domain: 'ohiopma.org' },
  'PA': { name: 'Pennsylvania Pest Management Association', domain: 'ppma.us' },
  'NY': { name: 'New York Pest Management Association', domain: 'nypma.org' },
  'NJ': { name: 'New Jersey Pest Management Association', domain: 'njpma.com' },
  'IL': { name: 'Illinois Pest Control Association', domain: 'illinoispca.org' },
  'MD': { name: 'Maryland Pest Control Association', domain: 'marylandpest.org' },
  'CO': { name: 'Colorado Pest Management Association', domain: 'coloradopest.org' },
  'WA': { name: 'Washington State Pest Management Association', domain: 'wspma.org' },
  'OR': { name: 'Oregon Pest Control Association', domain: 'orpca.org' },
  'MI': { name: 'Michigan Pest Management Association', domain: 'michiganpest.com' },
};

// State to Business Journal mapping
const STATE_BUSINESS_JOURNALS: Record<string, string> = {
  'NC': 'Triangle Business Journal OR Triad Business Journal OR Charlotte Business Journal',
  'SC': 'Charleston Business Journal OR Greenville Business Journal',
  'VA': 'Richmond BizSense OR Virginia Business',
  'GA': 'Atlanta Business Chronicle',
  'FL': 'South Florida Business Journal OR Tampa Bay Business Journal OR Orlando Business Journal',
  'TX': 'Dallas Business Journal OR Houston Business Journal OR Austin Business Journal',
  'CA': 'San Francisco Business Times OR Los Angeles Business Journal OR Sacramento Business Journal',
  'AZ': 'Phoenix Business Journal',
  'TN': 'Nashville Business Journal OR Memphis Business Journal',
  'CO': 'Denver Business Journal',
  'WA': 'Puget Sound Business Journal',
  'OR': 'Portland Business Journal',
  'OH': 'Columbus Business First OR Cleveland Business Journal',
  'PA': 'Philadelphia Business Journal OR Pittsburgh Business Times',
  'NY': 'Buffalo Business First OR Rochester Business Journal',
  'NJ': 'NJBIZ',
  'MD': 'Baltimore Business Journal',
  'IL': 'Chicago Business Journal OR Crain\'s Chicago Business',
  'MI': 'Crain\'s Detroit Business',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function serperSearch(query: string): Promise<{ organic?: Array<{ title: string; snippet: string; link: string }> }> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return { organic: [] };

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10, gl: 'us', hl: 'en' }),
    });
    return await response.json();
  } catch {
    return { organic: [] };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractDate(text: string): string | null {
  const patterns = [
    /(\w+\s+\d{1,2},?\s+20\d{2})/,
    /(20\d{2}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/20\d{2})/,
    /(20\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractDealValue(text: string): string | null {
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(?:million|M)/i,
    /\$(\d+(?:\.\d+)?)\s*(?:billion|B)/i,
    /(\d+(?:\.\d+)?)\s*(?:million|M)\s*(?:dollars?|\$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `$${match[1]}M`;
  }
  return null;
}

function extractPodcastName(title: string): string {
  const patterns = [
    /^([^|]+)\s*\|/,
    /^([^:]+):\s*/,
    /on\s+(.+?)\s+podcast/i,
    /(.+?)\s+podcast/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].trim();
  }
  return 'Industry Podcast';
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const topicPatterns = [
    /discuss(?:es|ed|ing)?\s+([^.]{10,80})/i,
    /talk(?:s|ed|ing)?\s+about\s+([^.]{10,80})/i,
    /cover(?:s|ed|ing)?\s+([^.]{10,80})/i,
    /focus(?:es|ed|ing)?\s+on\s+([^.]{10,80})/i,
  ];

  for (const pattern of topicPatterns) {
    const match = text.match(pattern);
    if (match) {
      topics.push(match[1].trim());
    }
  }
  return topics.slice(0, 3);
}

// ============================================
// COLLECTION FUNCTIONS
// ============================================

/**
 * Calculate name similarity for validation
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+(inc|llc|corp|corporation|company|co|services?|control|management)\.?$/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  const words1 = new Set(n1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(n2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union;
}

/**
 * Extract state from location text
 */
function extractStateFromText(text: string): string | null {
  const stateMatch = text.match(/,\s*([A-Z]{2})(?:\s|$|,)/);
  if (stateMatch) return stateMatch[1];

  const stateNames: Record<string, string> = {
    florida: 'FL', virginia: 'VA', 'north carolina': 'NC', 'south carolina': 'SC',
    georgia: 'GA', texas: 'TX', california: 'CA', arizona: 'AZ', tennessee: 'TN',
    alabama: 'AL', ohio: 'OH', pennsylvania: 'PA', 'new york': 'NY', 'new jersey': 'NJ',
  };

  const lower = text.toLowerCase();
  for (const [stateName, stateCode] of Object.entries(stateNames)) {
    if (lower.includes(stateName)) return stateCode;
  }

  return null;
}

/**
 * Validate that search result is about the target company (not a similar-named one)
 */
function validateSearchResult(
  resultCompanyName: string | null,
  resultText: string,
  targetCompanyName: string,
  targetState: string | null
): { isValid: boolean; reason: string } {
  // Check for state mismatch (strongest signal of wrong company)
  const resultState = extractStateFromText(resultText);
  if (resultState && targetState && resultState !== targetState) {
    return {
      isValid: false,
      reason: `State mismatch: result mentions ${resultState}, target is in ${targetState}`,
    };
  }

  // Check name similarity
  if (resultCompanyName) {
    const similarity = calculateNameSimilarity(resultCompanyName, targetCompanyName);
    if (similarity < 0.5) {
      return {
        isValid: false,
        reason: `Name mismatch: "${resultCompanyName}" vs "${targetCompanyName}" (${(similarity * 100).toFixed(0)}% similar)`,
      };
    }
  }

  // Check for common confusion patterns
  const resultLower = resultText.toLowerCase();
  const targetLower = targetCompanyName.toLowerCase();

  // "Environmental Pest Service" vs "Environmental Pest Control"
  if (targetLower.includes('control') && resultLower.includes('service') && !resultLower.includes('control')) {
    return { isValid: false, reason: 'Result is about "Service" company, target is "Control"' };
  }
  if (targetLower.includes('service') && resultLower.includes('control') && !resultLower.includes('service')) {
    return { isValid: false, reason: 'Result is about "Control" company, target is "Service"' };
  }

  return { isValid: true, reason: 'Validated' };
}

async function collectPCTData(
  companyName: string,
  state: string | null,
  domain: string | null,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching PCT Top 100...');

  // More specific searches including domain/state
  const searches = [
    // Most specific: include domain if available
    domain ? `site:pctonline.com "${domain}"` : null,
    // Include state for filtering
    state ? `site:pctonline.com "${companyName}" "${state}" "top 100"` : null,
    `site:pctonline.com "${companyName}" "top 100"`,
    `"PCT Top 100" "${companyName}" rank`,
    `site:pctonline.com "${companyName}" revenue employees`,
  ].filter(Boolean) as string[];

  for (const query of searches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // VALIDATE: Check if this result is actually about our target company
      const validation = validateSearchResult(null, snippet, companyName, state);
      if (!validation.isValid) {
        console.log(`    Skipping result: ${validation.reason}`);
        continue;
      }

      // Extract ranking
      const rankPatterns = [
        /#(\d+)\s/,
        /No\.\s*(\d+)/i,
        /rank(?:ed|ing)?\s*#?(\d+)/i,
        /(\d+)\s*(?:on|in)\s*(?:the\s*)?(?:PCT|top\s*100)/i,
      ];

      for (const pattern of rankPatterns) {
        const match = snippet.match(pattern);
        if (match) {
          const rank = parseInt(match[1]);
          if (rank > 0 && rank <= 100) {
            intelligence.pctTop100.isRanked = true;
            intelligence.pctTop100.rank = rank;
            intelligence.pctTop100.sourceUrl = result.link;
            break;
          }
        }
      }

      // Extract year
      const yearMatch = snippet.match(/20\d{2}/);
      if (yearMatch && !intelligence.pctTop100.year) {
        intelligence.pctTop100.year = parseInt(yearMatch[0]);
      }

      // Extract revenue
      const revenueMatch = snippet.match(/\$(\d+(?:\.\d+)?)\s*(?:million|M)/i);
      if (revenueMatch) {
        intelligence.pctTop100.revenue = `$${revenueMatch[1]}M`;
      }

      // Extract employee count
      const empMatch = snippet.match(/(\d+)\s*employees/i);
      if (empMatch) {
        intelligence.pctTop100.employeeCount = parseInt(empMatch[1]);
      }

      // Extract growth percent
      const growthMatch = snippet.match(/(\d+(?:\.\d+)?)\s*%\s*(?:growth|grew|increase)/i);
      if (growthMatch) {
        intelligence.pctTop100.growthPercent = parseFloat(growthMatch[1]);
      }

      if (intelligence.pctTop100.rank) break;
    }

    if (intelligence.pctTop100.rank) break;
    await delay(250);
  }

  // If still not found, do a general search with validation
  if (!intelligence.pctTop100.isRanked) {
    const claimSearch = await serperSearch(`"${companyName}" "PCT Top 100"${state ? ` "${state}"` : ''}`);
    for (const result of claimSearch.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // Validate before accepting
      const validation = validateSearchResult(null, snippet, companyName, state);
      if (!validation.isValid) {
        console.log(`    Skipping unverified PCT claim: ${validation.reason}`);
        continue;
      }

      if (/pct\s*top\s*100/i.test(snippet)) {
        intelligence.pctTop100.isRanked = true;
        intelligence.pctTop100.sourceUrl = result.link;
        break;
      }
    }
  }

  const status = intelligence.pctTop100.isRanked
    ? `#${intelligence.pctTop100.rank || '?'} (${intelligence.pctTop100.year || '?'})${intelligence.pctTop100.revenue ? ` - ${intelligence.pctTop100.revenue}` : ''}`
    : 'Not found';
  console.log(`    PCT Top 100: ${status}`);
}

async function collectInc5000Data(
  companyName: string,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching Inc 5000...');

  const searches = [
    `site:inc.com/inc5000 "${companyName}"`,
    `"Inc 5000" "${companyName}" rank`,
    `"Inc. 5000" "${companyName}" growth`,
  ];

  for (const query of searches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // Verify it's about this company
      if (!snippet.toLowerCase().includes(companyName.toLowerCase().split(' ')[0])) continue;

      // Extract ranking
      const rankMatch = snippet.match(/#(\d{1,4})\s/i) ||
                       snippet.match(/No\.\s*(\d{1,4})/i) ||
                       snippet.match(/rank(?:ed)?\s*#?(\d{1,4})/i);

      if (rankMatch) {
        const rank = parseInt(rankMatch[1]);
        if (rank > 0 && rank <= 5000) {
          intelligence.inc5000.isRanked = true;
          intelligence.inc5000.rank = rank;
          intelligence.inc5000.sourceUrl = result.link;
        }
      }

      // Extract year
      const yearMatch = snippet.match(/20\d{2}/);
      if (yearMatch) {
        intelligence.inc5000.year = parseInt(yearMatch[0]);
      }

      // Extract growth percentage
      const growthMatch = snippet.match(/(\d{1,4})%\s*(?:growth|grew)/i) ||
                         snippet.match(/grew\s*(\d{1,4})%/i) ||
                         snippet.match(/(\d{1,4})\s*percent/i);
      if (growthMatch) {
        intelligence.inc5000.growthPercent = parseInt(growthMatch[1]);
      }

      // Extract revenue
      const revenueMatch = snippet.match(/\$(\d+(?:\.\d+)?)\s*(?:million|M)/i);
      if (revenueMatch) {
        intelligence.inc5000.revenue = `$${revenueMatch[1]}M`;
      }

      if (intelligence.inc5000.rank) break;
    }

    if (intelligence.inc5000.rank) break;
    await delay(250);
  }

  const status = intelligence.inc5000.isRanked
    ? `#${intelligence.inc5000.rank} (${intelligence.inc5000.year || '?'})${intelligence.inc5000.growthPercent ? ` - ${intelligence.inc5000.growthPercent}% growth` : ''}`
    : 'Not found';
  console.log(`    Inc 5000: ${status}`);
}

async function collectBusinessJournalData(
  companyName: string,
  state: string,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching Business Journals...');

  const journalNames = STATE_BUSINESS_JOURNALS[state] || 'Business Journal';

  const searches = [
    `"${companyName}" (${journalNames}) "fast 50" OR "fastest growing"`,
    `site:bizjournals.com "${companyName}"`,
    `"${companyName}" "fastest growing" business journal ${state}`,
  ];

  for (const query of searches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // Check for Fast 50 or similar rankings
      const listMatch = snippet.match(/(Fast\s*50|Fastest\s*Growing|Fast\s*100|Top\s*\d+\s*(?:Companies|Businesses))/i);

      if (listMatch) {
        intelligence.businessJournal.listName = listMatch[1];
        intelligence.businessJournal.sourceUrl = result.link;

        // Extract publication name
        const pubMatch = result.title.match(/([\w\s]+Business Journal|[\w\s]+BizSense|Crain'?s[\w\s]+|NJBIZ)/i);
        if (pubMatch) {
          intelligence.businessJournal.publication = pubMatch[1].trim();
        }

        // Extract rank
        const rankMatch = snippet.match(/#(\d+)/i) || snippet.match(/No\.\s*(\d+)/i);
        if (rankMatch) {
          intelligence.businessJournal.rank = parseInt(rankMatch[1]);
        }

        // Extract year
        const yearMatch = snippet.match(/20\d{2}/);
        if (yearMatch) {
          intelligence.businessJournal.year = parseInt(yearMatch[0]);
        }

        break;
      }
    }

    if (intelligence.businessJournal.listName) break;
    await delay(250);
  }

  const status = intelligence.businessJournal.listName
    ? `${intelligence.businessJournal.publication || 'Business Journal'} ${intelligence.businessJournal.listName}${intelligence.businessJournal.rank ? ` #${intelligence.businessJournal.rank}` : ''}`
    : 'Not found';
  console.log(`    Business Journal: ${status}`);
}

async function collectAssociationData(
  companyName: string,
  state: string,
  ownerName: string | null,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching industry associations...');

  // NPMA / QualityPro searches
  const npmaSearches = [
    `site:npmaonline.org "${companyName}"`,
    `"QualityPro" "${companyName}"`,
    `site:pestworld.org "${companyName}"`,
    ownerName ? `"NPMA" "${ownerName}" board OR director` : null,
  ].filter(Boolean) as string[];

  for (const query of npmaSearches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`.toLowerCase();

      if (snippet.includes('qualitypro')) {
        intelligence.associations.npma.isQualityPro = true;
        intelligence.associations.npma.sourceUrl = result.link;
      }

      if (snippet.includes('member') || result.link.includes('npma') || result.link.includes('pestworld')) {
        intelligence.associations.npma.isMember = true;
        if (!intelligence.associations.npma.sourceUrl) {
          intelligence.associations.npma.sourceUrl = result.link;
        }
      }

      // Check for leadership roles
      if (ownerName) {
        const leadershipTerms = ['board', 'director', 'president', 'chairman', 'committee', 'officer'];
        if (leadershipTerms.some(term => snippet.includes(term)) &&
            snippet.includes(ownerName.toLowerCase())) {

          if (snippet.includes('past president')) {
            intelligence.associations.npma.leadershipRole = 'Past President - NPMA';
          } else if (snippet.includes('president')) {
            intelligence.associations.npma.leadershipRole = 'President - NPMA';
          } else if (snippet.includes('board') || snippet.includes('director')) {
            intelligence.associations.npma.leadershipRole = 'Board Member - NPMA';
          } else {
            intelligence.associations.npma.leadershipRole = 'Leadership Role - NPMA';
          }
        }
      }
    }
    await delay(200);
  }

  // State Association searches
  const stateAssoc = STATE_PEST_ASSOCIATIONS[state];
  if (stateAssoc) {
    intelligence.associations.stateAssociation.name = stateAssoc.name;

    const stateSearches = [
      `site:${stateAssoc.domain} "${companyName}"`,
      `"${stateAssoc.name}" "${companyName}"`,
      ownerName ? `"${stateAssoc.name}" "${ownerName}"` : null,
      ownerName ? `"${stateAssoc.name}" "${ownerName}" board OR president OR director` : null,
    ].filter(Boolean) as string[];

    for (const query of stateSearches) {
      const results = await serperSearch(query);

      for (const result of results.organic || []) {
        const snippet = `${result.title} ${result.snippet}`.toLowerCase();

        // If the company or owner is mentioned, they're likely a member
        if (snippet.includes(companyName.toLowerCase().split(' ')[0]) ||
            (ownerName && snippet.includes(ownerName.toLowerCase().split(' ')[0]))) {
          intelligence.associations.stateAssociation.isMember = true;
          intelligence.associations.stateAssociation.sourceUrl = result.link;

          // Check for board positions
          if (snippet.includes('past president')) {
            intelligence.associations.stateAssociation.boardPosition = 'Past President';
            intelligence.associations.stateAssociation.leadershipRole = `Past President - ${stateAssoc.name}`;
          } else if (snippet.includes('president')) {
            intelligence.associations.stateAssociation.boardPosition = 'President';
            intelligence.associations.stateAssociation.leadershipRole = `President - ${stateAssoc.name}`;
          } else if (snippet.includes('vice president')) {
            intelligence.associations.stateAssociation.boardPosition = 'Vice President';
            intelligence.associations.stateAssociation.leadershipRole = `Vice President - ${stateAssoc.name}`;
          } else if (snippet.includes('board') || snippet.includes('director')) {
            intelligence.associations.stateAssociation.boardPosition = 'Board Member';
            intelligence.associations.stateAssociation.leadershipRole = `Board Member - ${stateAssoc.name}`;
          } else if (snippet.includes('treasurer')) {
            intelligence.associations.stateAssociation.boardPosition = 'Treasurer';
            intelligence.associations.stateAssociation.leadershipRole = `Treasurer - ${stateAssoc.name}`;
          } else if (snippet.includes('secretary')) {
            intelligence.associations.stateAssociation.boardPosition = 'Secretary';
            intelligence.associations.stateAssociation.leadershipRole = `Secretary - ${stateAssoc.name}`;
          }
        }
      }
      await delay(200);
    }
  }

  console.log(`    NPMA: ${intelligence.associations.npma.isMember ? 'Member' : 'Not found'}${intelligence.associations.npma.isQualityPro ? ' (QualityPro)' : ''}${intelligence.associations.npma.leadershipRole ? ` - ${intelligence.associations.npma.leadershipRole}` : ''}`);
  console.log(`    State Assoc: ${intelligence.associations.stateAssociation.isMember ? `${intelligence.associations.stateAssociation.name}${intelligence.associations.stateAssociation.boardPosition ? ` (${intelligence.associations.stateAssociation.boardPosition})` : ''}` : 'Not found'}`);
}

async function collectPodcastAppearances(
  companyName: string,
  ownerName: string | null,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching podcast appearances...');

  const podcastSearches = [
    `"${companyName}" podcast interview pest control`,
    `"${companyName}" "PCT" podcast OR webinar`,
    ownerName ? `"${ownerName}" podcast pest control` : null,
    ownerName ? `"${ownerName}" interview pest control CEO owner` : null,
    `"${companyName}" webinar speaker presentation`,
  ].filter(Boolean) as string[];

  const foundUrls = new Set<string>();

  for (const query of podcastSearches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // Check if it's a podcast/interview
      if (!/podcast|interview|episode|webinar|guest|speaker/i.test(snippet)) continue;

      // Avoid duplicates
      if (foundUrls.has(result.link)) continue;
      foundUrls.add(result.link);

      // Extract quotes
      const quotes: string[] = [];
      const quoteMatches = snippet.match(/"([^"]{20,200})"/g);
      if (quoteMatches) {
        quotes.push(...quoteMatches.map(q => q.replace(/"/g, '').trim()));
      }

      intelligence.mediaAppearances.podcasts.push({
        showName: extractPodcastName(result.title),
        episodeTitle: result.title,
        date: extractDate(snippet),
        guestName: ownerName || 'Company Representative',
        keyQuotes: quotes,
        topics: extractTopics(snippet),
        sourceUrl: result.link,
      });

      // Limit to 5 podcasts
      if (intelligence.mediaAppearances.podcasts.length >= 5) break;
    }

    if (intelligence.mediaAppearances.podcasts.length >= 5) break;
    await delay(200);
  }

  console.log(`    Podcasts/Interviews: ${intelligence.mediaAppearances.podcasts.length} found`);
}

async function collectArticleMentions(
  companyName: string,
  ownerName: string | null,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching article mentions...');

  const articleSearches = [
    `"${companyName}" site:pctonline.com profile OR feature`,
    `"${companyName}" "Pest Management Professional" OR "PMP Magazine"`,
    ownerName ? `"${ownerName}" pest control profile interview` : null,
  ].filter(Boolean) as string[];

  const foundUrls = new Set<string>();

  for (const query of articleSearches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      if (foundUrls.has(result.link)) continue;
      foundUrls.add(result.link);

      const snippet = result.snippet || '';

      // Determine article type
      let type: 'profile' | 'news' | 'interview' | 'mention' = 'mention';
      if (/profile|feature|spotlight/i.test(result.title)) type = 'profile';
      else if (/interview|q&a|talks/i.test(result.title)) type = 'interview';
      else if (/announce|news|report/i.test(result.title)) type = 'news';

      // Extract publication
      let publication = 'Industry Publication';
      if (result.link.includes('pctonline')) publication = 'PCT Magazine';
      else if (/pmp|pest management professional/i.test(result.title)) publication = 'Pest Management Professional';

      // Extract quotes
      const quotes: string[] = [];
      const quoteMatches = snippet.match(/"([^"]{20,200})"/g);
      if (quoteMatches) {
        quotes.push(...quoteMatches.map(q => q.replace(/"/g, '').trim()));
      }

      intelligence.mediaAppearances.articles.push({
        publication,
        title: result.title,
        date: extractDate(snippet),
        type,
        summary: snippet.substring(0, 200),
        quotes,
        sourceUrl: result.link,
      });

      if (intelligence.mediaAppearances.articles.length >= 5) break;
    }

    if (intelligence.mediaAppearances.articles.length >= 5) break;
    await delay(200);
  }

  console.log(`    Articles: ${intelligence.mediaAppearances.articles.length} found`);
}

async function collectIndustryNews(
  companyName: string,
  intelligence: IndustryIntelligence
): Promise<void> {
  console.log('  Searching industry news...');

  // Acquisition searches
  const acquisitionSearches = [
    `"${companyName}" acquires OR acquired pest control`,
    `"${companyName}" acquisition announcement`,
    `"${companyName}" buys OR bought pest control company`,
  ];

  const foundAcquisitions = new Set<string>();

  for (const query of acquisitionSearches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = `${result.title} ${result.snippet}`;

      // Pattern: "CompanyName acquires AcquiredCompany"
      const acqPatterns = [
        new RegExp(`${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:acquires?|acquired|buys?|bought|purchases?)\\s+([A-Z][\\w\\s&'-]+?)(?:\\s+in|\\s+for|\\.|,|$)`, 'i'),
        new RegExp(`(?:acquires?|acquired|buys?|bought)\\s+([A-Z][\\w\\s&'-]+?)\\s+(?:from|in|for)`, 'i'),
      ];

      for (const pattern of acqPatterns) {
        const match = snippet.match(pattern);
        if (match) {
          const acquired = match[1].trim();
          const key = acquired.toLowerCase();

          if (!foundAcquisitions.has(key) && acquired.length > 3 && acquired.length < 50) {
            foundAcquisitions.add(key);
            intelligence.industryNews.acquisitions.push({
              headline: result.title,
              acquirer: companyName,
              acquired,
              date: extractDate(snippet),
              dealValue: extractDealValue(snippet),
              sourceUrl: result.link,
            });
          }
        }
      }
    }

    await delay(200);
  }

  // Expansion searches
  const expansionSearches = [
    `"${companyName}" expansion OR "new location" OR "opens office"`,
    `"${companyName}" expands OR "adds services" OR "new market"`,
  ];

  const foundExpansions = new Set<string>();

  for (const query of expansionSearches) {
    const results = await serperSearch(query);

    for (const result of results.organic || []) {
      const snippet = result.snippet || '';

      if (/expan|new\s+location|open|launch|add|enter/i.test(snippet)) {
        if (!foundExpansions.has(result.link)) {
          foundExpansions.add(result.link);
          intelligence.industryNews.expansions.push({
            headline: result.title,
            details: snippet,
            date: extractDate(snippet),
            sourceUrl: result.link,
          });
        }
      }

      if (intelligence.industryNews.expansions.length >= 5) break;
    }

    if (intelligence.industryNews.expansions.length >= 5) break;
    await delay(200);
  }

  console.log(`    Acquisitions: ${intelligence.industryNews.acquisitions.length} found`);
  console.log(`    Expansions: ${intelligence.industryNews.expansions.length} found`);
}

// ============================================
// MAIN EXPORT
// ============================================

export async function collectIndustryIntelligence(
  companyName: string,
  state: string | null,
  ownerName: string | null,
  domain?: string | null
): Promise<IndustryIntelligence> {
  console.log('\n  INDUSTRY SOURCES COLLECTION');
  console.log(`  Company: ${companyName}`);
  console.log(`  Domain: ${domain || 'Unknown'}`);
  console.log(`  State: ${state || 'Unknown'}`);
  console.log(`  Owner: ${ownerName || 'Unknown'}`);

  const intelligence: IndustryIntelligence = {
    pctTop100: {
      isRanked: false,
      rank: null,
      year: null,
      revenue: null,
      employeeCount: null,
      growthPercent: null,
      sourceUrl: null,
      historicalRanks: [],
    },
    inc5000: {
      isRanked: false,
      rank: null,
      year: null,
      revenue: null,
      growthPercent: null,
      yearsOnList: 0,
      sourceUrl: null,
    },
    businessJournal: {
      publication: null,
      listName: null,
      rank: null,
      year: null,
      sourceUrl: null,
    },
    associations: {
      npma: {
        isMember: false,
        isQualityPro: false,
        leadershipRole: null,
        sourceUrl: null,
      },
      stateAssociation: {
        name: null,
        isMember: false,
        leadershipRole: null,
        boardPosition: null,
        yearsActive: null,
        sourceUrl: null,
      },
    },
    mediaAppearances: {
      podcasts: [],
      articles: [],
    },
    industryNews: {
      acquisitions: [],
      expansions: [],
    },
  };

  // Run collections in sequence to avoid rate limiting
  await collectPCTData(companyName, state, domain || null, intelligence);
  await collectInc5000Data(companyName, intelligence);

  if (state) {
    await collectBusinessJournalData(companyName, state, intelligence);
    await collectAssociationData(companyName, state, ownerName, intelligence);
  }

  await collectPodcastAppearances(companyName, ownerName, intelligence);
  await collectArticleMentions(companyName, ownerName, intelligence);
  await collectIndustryNews(companyName, intelligence);

  return intelligence;
}

export function getEmptyIndustryIntelligence(): IndustryIntelligence {
  return {
    pctTop100: {
      isRanked: false,
      rank: null,
      year: null,
      revenue: null,
      employeeCount: null,
      growthPercent: null,
      sourceUrl: null,
      historicalRanks: [],
    },
    inc5000: {
      isRanked: false,
      rank: null,
      year: null,
      revenue: null,
      growthPercent: null,
      yearsOnList: 0,
      sourceUrl: null,
    },
    businessJournal: {
      publication: null,
      listName: null,
      rank: null,
      year: null,
      sourceUrl: null,
    },
    associations: {
      npma: {
        isMember: false,
        isQualityPro: false,
        leadershipRole: null,
        sourceUrl: null,
      },
      stateAssociation: {
        name: null,
        isMember: false,
        leadershipRole: null,
        boardPosition: null,
        yearsActive: null,
        sourceUrl: null,
      },
    },
    mediaAppearances: {
      podcasts: [],
      articles: [],
    },
    industryNews: {
      acquisitions: [],
      expansions: [],
    },
  };
}
