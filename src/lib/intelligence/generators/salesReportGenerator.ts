/**
 * Sales Report Generator
 * Generates markdown reports for sales reps to use before calls
 */

import type { CompanyIntelligence, IntelligenceAnalysis, KeyPerson } from '../dataLayerTypes';
import type { SerperResearchData, AwardResult, NewsResult } from '../collectors/serperResearchCollector';
import type { CompanyTypeClassification, CompanyType } from '../classifiers/companyTypeClassifier';
import { companyTypeClassifier } from '../classifiers/companyTypeClassifier';

// ============================================
// TYPES
// ============================================

export interface SalesReportInput {
  companyName: string;
  intelligence: CompanyIntelligence;
  analysis?: IntelligenceAnalysis | null;
  research?: SerperResearchData | null;
  classification?: CompanyTypeClassification | null;
}

export interface SalesReport {
  markdown: string;
  sections: ReportSection[];
  generatedAt: string;
  dataQualityScore: number;
}

interface ReportSection {
  title: string;
  content: string;
  order: number;
}

// ============================================
// REPORT TEMPLATES
// ============================================

const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  pe_backed_platform: 'PE-Backed Platform',
  family_owned_enterprise: 'Family-Owned Enterprise',
  franchise_system: 'Franchise System',
  growth_stage_regional: 'Growth-Stage Regional',
  local_operator: 'Local Operator',
  unknown: 'Unknown',
};

// ============================================
// GENERATOR CLASS
// ============================================

export class SalesReportGenerator {
  /**
   * Generate a complete sales report
   */
  generate(input: SalesReportInput): SalesReport {
    const { companyName, intelligence, analysis, research } = input;

    // Classify company if not already provided
    const classification = input.classification ||
      companyTypeClassifier.classify(intelligence, research || undefined);

    const sections: ReportSection[] = [];

    // Build each section
    sections.push(this.buildCompanySummary(companyName, intelligence, classification, research));
    sections.push(this.buildWhyTheyBuy(intelligence, analysis, classification));
    sections.push(this.buildReputation(intelligence));
    sections.push(this.buildIndustryRecognition(intelligence, research));
    sections.push(this.buildKeyPeople(intelligence));
    sections.push(this.buildRecommendedApproach(classification, analysis));
    sections.push(this.buildTalkingPoints(analysis, classification, research));
    sections.push(this.buildPotentialObjections(analysis, classification));
    sections.push(this.buildCallPreparation(companyName, intelligence, classification));

    // Sort by order
    sections.sort((a, b) => a.order - b.order);

    // Combine into markdown
    const markdown = this.assembleMarkdown(companyName, sections, classification);

    // Calculate data quality
    const dataQualityScore = this.calculateDataQuality(intelligence, research);

    return {
      markdown,
      sections,
      generatedAt: new Date().toISOString(),
      dataQualityScore,
    };
  }

  /**
   * Build Company Summary section
   */
  private buildCompanySummary(
    companyName: string,
    intel: CompanyIntelligence,
    classification: CompanyTypeClassification,
    research: SerperResearchData | null | undefined
  ): ReportSection {
    const profile = intel.company_profile;
    const financial = intel.financial;
    const services = intel.services;

    const lines: string[] = [];

    // Company type badge
    const typeLabel = COMPANY_TYPE_LABELS[classification.type];
    const confidenceEmoji = classification.confidence === 'high' ? '' :
                            classification.confidence === 'medium' ? '' : '';
    lines.push(`**Company Type:** ${typeLabel} ${confidenceEmoji}`);
    lines.push('');

    // Quick stats table
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');

    if (profile?.founded_year?.value) {
      const yearsInBusiness = new Date().getFullYear() - profile.founded_year.value;
      lines.push(`| Founded | ${profile.founded_year.value} (${yearsInBusiness} years) |`);
    }

    if (profile?.employee_count?.value) {
      lines.push(`| Employees | ${profile.employee_count.value.toLocaleString()} |`);
    } else if (profile?.employee_range?.value) {
      lines.push(`| Employees | ${profile.employee_range.value} |`);
    }

    if (financial?.estimated_revenue?.value) {
      const revenue = financial.estimated_revenue.value;
      const confidence = financial.estimated_revenue.confidence || 'unknown';
      const formatted = this.formatRevenue(revenue);
      lines.push(`| Est. Revenue | ${formatted} (${confidence} confidence) |`);
    }

    if (profile?.locations_count?.value && profile.locations_count.value > 1) {
      lines.push(`| Locations | ${profile.locations_count.value} |`);
    }

    if (profile?.headquarters?.value) {
      lines.push(`| Headquarters | ${profile.headquarters.value} |`);
    }

    lines.push('');

    // Service areas
    const serviceAreas = services?.service_areas?.value || [];
    if (serviceAreas.length > 0) {
      const displayAreas = serviceAreas.slice(0, 5).join(', ');
      const moreCount = serviceAreas.length > 5 ? ` (+${serviceAreas.length - 5} more)` : '';
      lines.push(`**Service Areas:** ${displayAreas}${moreCount}`);
      lines.push('');
    }

    // Ownership details
    if (classification.ownershipDetails) {
      lines.push(`**Ownership:** ${classification.ownershipDetails}`);
      lines.push('');
    }

    // PE backer if applicable
    if (classification.peBackerName) {
      lines.push(`**PE Backer:** ${classification.peBackerName}`);
      lines.push('');
    }

    return {
      title: 'Company Summary',
      content: lines.join('\n'),
      order: 1,
    };
  }

  /**
   * Build Why They Buy section
   */
  private buildWhyTheyBuy(
    intel: CompanyIntelligence,
    analysis: IntelligenceAnalysis | null | undefined,
    classification: CompanyTypeClassification
  ): ReportSection {
    const lines: string[] = [];

    // Based on company type, explain why they might buy
    const typeDef = companyTypeClassifier.getTypeDefinition(classification.type);

    lines.push(`Based on their profile as a **${COMPANY_TYPE_LABELS[classification.type]}**, here's why they might consider X-RAI:`);
    lines.push('');

    // Value proposition for their type
    lines.push(`> ${typeDef.salesFocus.valueProposition}`);
    lines.push('');

    // Pain points from analysis if available
    if (analysis?.pain_points && analysis.pain_points.length > 0) {
      lines.push('**Likely Pain Points:**');
      for (const pain of analysis.pain_points.slice(0, 3)) {
        const severity = pain.severity === 'high' ? '!!!' :
                         pain.severity === 'medium' ? '!!' : '!';
        lines.push(`- ${severity} ${pain.pain}`);
        if (pain.evidence) {
          lines.push(`  - *Evidence:* ${pain.evidence}`);
        }
      }
      lines.push('');
    }

    // Buying signals
    if (analysis?.buying_signals && analysis.buying_signals.length > 0) {
      lines.push('**Buying Signals Detected:**');
      for (const signal of analysis.buying_signals.slice(0, 3)) {
        const strength = signal.strength === 'strong' ? '' :
                         signal.strength === 'moderate' ? '' : '';
        lines.push(`- ${strength} ${signal.signal}`);
        lines.push(`  - *Interpretation:* ${signal.interpretation}`);
      }
      lines.push('');
    }

    // Technology gaps
    const tech = intel.technology;
    const gaps: string[] = [];

    if (!tech?.crm_system?.value || tech.crm_system.value.toLowerCase() === 'unknown') {
      gaps.push('No CRM detected - opportunity for integrated solution');
    }
    if (!tech?.has_live_chat?.value) {
      gaps.push('No live chat - missing customer engagement channel');
    }
    if (!tech?.has_online_booking?.value) {
      gaps.push('No online booking - friction in customer experience');
    }

    if (gaps.length > 0) {
      lines.push('**Technology Gaps:**');
      for (const gap of gaps) {
        lines.push(`- ${gap}`);
      }
      lines.push('');
    }

    return {
      title: 'Why They Buy',
      content: lines.join('\n'),
      order: 2,
    };
  }

  /**
   * Build Reputation section (Google reviews, ratings)
   */
  private buildReputation(intel: CompanyIntelligence): ReportSection {
    const lines: string[] = [];

    const reviews = intel.reviews || {};

    // Google Rating and Reviews
    const googleRating = reviews.google_rating?.value;
    const googleReviewCount = reviews.google_review_count?.value;

    if (googleRating || googleReviewCount) {
      lines.push('**Google Business Profile:**');

      if (googleRating) {
        const stars = '⭐'.repeat(Math.round(googleRating));
        lines.push(`- Rating: ${googleRating}/5 ${stars}`);
      }

      if (googleReviewCount) {
        lines.push(`- Review Count: ${googleReviewCount.toLocaleString()} reviews`);
      }

      // Calculate review velocity if we have recent reviews
      const recentReviews = reviews.recent_reviews?.value || [];
      if (recentReviews.length > 0) {
        const positiveReviews = recentReviews.filter((r: { rating?: number }) => (r.rating || 0) >= 4).length;
        const positiveRate = Math.round((positiveReviews / recentReviews.length) * 100);
        lines.push(`- Recent Review Sentiment: ${positiveRate}% positive (last ${recentReviews.length} reviews)`);
      }

      lines.push('');
    }

    // Facebook Rating
    const fbRating = reviews.facebook_rating?.value;
    const fbReviewCount = reviews.facebook_review_count?.value;

    if (fbRating || fbReviewCount) {
      lines.push('**Facebook:**');
      if (fbRating) {
        lines.push(`- Rating: ${fbRating}/5`);
      }
      if (fbReviewCount) {
        lines.push(`- Reviews: ${fbReviewCount}`);
      }
      lines.push('');
    }

    // LinkedIn Followers
    const linkedinFollowers = intel.online_presence?.linkedin_followers?.value;
    if (linkedinFollowers) {
      lines.push('**LinkedIn:**');
      lines.push(`- Followers: ${linkedinFollowers.toLocaleString()}`);
      lines.push('');
    }

    // Facebook Followers
    const fbFollowers = intel.online_presence?.facebook_followers?.value;
    if (fbFollowers) {
      lines.push('**Facebook:**');
      lines.push(`- Followers: ${fbFollowers.toLocaleString()}`);
      lines.push('');
    }

    // If no data, show a message
    if (lines.length === 0) {
      lines.push('*No public reputation data available.*');
    }

    return {
      title: 'Online Reputation',
      content: lines.join('\n'),
      order: 2.5,
    };
  }

  /**
   * Build Industry Recognition section
   */
  private buildIndustryRecognition(
    intel: CompanyIntelligence,
    research: SerperResearchData | null | undefined
  ): ReportSection {
    const lines: string[] = [];

    // Certifications from intelligence
    const certs = intel.services?.certifications?.value || [];
    if (certs.length > 0) {
      lines.push('**Certifications:**');
      for (const cert of certs) {
        lines.push(`- ${cert}`);
      }
      lines.push('');
    }

    // Awards from intelligence
    const intelAwards = intel.services?.awards?.value || [];

    // Awards from research
    const researchAwards = research?.awards || [];

    // Combine and deduplicate
    const allAwards = this.combineAwards(intelAwards, researchAwards);

    if (allAwards.length > 0) {
      lines.push('**Awards & Recognition:**');
      for (const award of allAwards.slice(0, 8)) {
        if (typeof award === 'string') {
          lines.push(`- ${award}`);
        } else {
          const yearStr = award.year ? ` (${award.year})` : '';
          lines.push(`- ${award.awardName}${yearStr}`);
          if (award.source) {
            lines.push(`  - *Source:* [${award.source}](${award.sourceUrl})`);
          }
        }
      }
      lines.push('');
    }

    // Industry recognition score
    if (research?.industryRecognitionScore) {
      const score = research.industryRecognitionScore;
      const rating = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
      lines.push(`**Industry Recognition Score:** ${score}/100 (${rating})`);
      lines.push('');
    }

    // If no recognition found
    if (certs.length === 0 && allAwards.length === 0) {
      lines.push('*No certifications or awards found in our research. This could be a discovery topic.*');
      lines.push('');
    }

    return {
      title: 'Industry Recognition',
      content: lines.join('\n'),
      order: 3,
    };
  }

  /**
   * Build Key People section
   */
  private buildKeyPeople(intel: CompanyIntelligence): ReportSection {
    const lines: string[] = [];

    const people = intel.key_people || [];
    const decisionMakers = people.filter(p => p.isDecisionMaker);
    const others = people.filter(p => !p.isDecisionMaker);

    if (decisionMakers.length > 0) {
      lines.push('**Decision Makers:**');
      lines.push('');

      for (const person of decisionMakers.slice(0, 5)) {
        lines.push(this.formatPersonEntry(person));
      }
      lines.push('');
    }

    if (others.length > 0 && decisionMakers.length < 3) {
      lines.push('**Other Contacts:**');
      lines.push('');

      for (const person of others.slice(0, 3)) {
        lines.push(this.formatPersonEntry(person));
      }
      lines.push('');
    }

    if (people.length === 0) {
      lines.push('*No key contacts identified yet. Consider researching on LinkedIn.*');
      lines.push('');
    }

    return {
      title: 'Key People to Know',
      content: lines.join('\n'),
      order: 4,
    };
  }

  /**
   * Build Recommended Approach section
   */
  private buildRecommendedApproach(
    classification: CompanyTypeClassification,
    analysis: IntelligenceAnalysis | null | undefined
  ): ReportSection {
    const lines: string[] = [];

    const salesApproach = classification.salesApproach;

    // Primary focus
    lines.push(`**Primary Focus:** ${salesApproach.primaryFocus}`);
    lines.push('');

    // Recommended entry point
    lines.push(`**Entry Point:** ${salesApproach.recommendedEntryPoint}`);
    lines.push('');

    // Key decision makers to target
    lines.push('**Target Roles:**');
    for (const role of salesApproach.keyDecisionMakers) {
      lines.push(`- ${role}`);
    }
    lines.push('');

    // Timing considerations
    lines.push(`**Timing:** ${salesApproach.timingConsiderations}`);
    lines.push('');

    // Analysis recommended approach if available
    if (analysis?.recommended_approach) {
      lines.push('**AI-Generated Recommendation:**');
      lines.push('');
      lines.push(`> ${analysis.recommended_approach}`);
      lines.push('');
    }

    return {
      title: 'Recommended Approach',
      content: lines.join('\n'),
      order: 5,
    };
  }

  /**
   * Build Talking Points section
   */
  private buildTalkingPoints(
    analysis: IntelligenceAnalysis | null | undefined,
    classification: CompanyTypeClassification,
    research: SerperResearchData | null | undefined
  ): ReportSection {
    const lines: string[] = [];

    // Company-type specific value prop
    lines.push('**Lead with:**');
    lines.push(`> "${classification.salesApproach.valueProposition}"`);
    lines.push('');

    // Talking points from analysis
    if (analysis?.talking_points && analysis.talking_points.length > 0) {
      lines.push('**Personalized Talking Points:**');
      lines.push('');

      for (const point of analysis.talking_points.slice(0, 5)) {
        lines.push(`**${point.topic}**`);
        lines.push(`- Angle: ${point.angle}`);
        lines.push(`- Use when: ${point.useCase}`);
        lines.push('');
      }
    }

    // Key quotes to reference
    if (research?.keyQuotes && research.keyQuotes.length > 0) {
      lines.push('**Key Quotes to Reference:**');
      for (const quote of research.keyQuotes.slice(0, 3)) {
        lines.push(`> "${quote}"`);
      }
      lines.push('');
    }

    // Connection points
    if (analysis?.connection_points && analysis.connection_points.length > 0) {
      lines.push('**Connection Points for Rapport:**');
      for (const conn of analysis.connection_points.slice(0, 3)) {
        lines.push(`- **${conn.type.replace(/_/g, ' ')}:** ${conn.point}`);
        lines.push(`  - *Context:* ${conn.context}`);
      }
      lines.push('');
    }

    return {
      title: 'Talking Points',
      content: lines.join('\n'),
      order: 6,
    };
  }

  /**
   * Build Potential Objections section
   */
  private buildPotentialObjections(
    analysis: IntelligenceAnalysis | null | undefined,
    classification: CompanyTypeClassification
  ): ReportSection {
    const lines: string[] = [];

    // Objection categories for this company type
    lines.push('**Likely Objection Categories:**');
    for (const category of classification.salesApproach.objectionCategories) {
      lines.push(`- ${category}`);
    }
    lines.push('');

    // Specific objection handlers from analysis
    if (analysis?.objection_handlers && analysis.objection_handlers.length > 0) {
      lines.push('**Prepared Responses:**');
      lines.push('');

      for (const obj of analysis.objection_handlers.slice(0, 5)) {
        lines.push(`**Objection:** "${obj.objection}"`);
        lines.push('');
        lines.push(`**Response:** ${obj.response}`);
        if (obj.evidence) {
          lines.push(`- *Evidence:* ${obj.evidence}`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    // Competitive intel
    if (analysis?.competitor_mentions && analysis.competitor_mentions.length > 0) {
      lines.push('**Competitive Intel:**');
      for (const comp of analysis.competitor_mentions.slice(0, 3)) {
        const sentiment = comp.sentiment === 'positive' ? '+' :
                          comp.sentiment === 'negative' ? '-' : '~';
        lines.push(`- ${sentiment} **${comp.competitor}**: ${comp.context}`);
      }
      lines.push('');
    }

    return {
      title: 'Potential Objections',
      content: lines.join('\n'),
      order: 7,
    };
  }

  /**
   * Build Call Preparation section
   */
  private buildCallPreparation(
    companyName: string,
    intel: CompanyIntelligence,
    classification: CompanyTypeClassification
  ): ReportSection {
    const lines: string[] = [];

    lines.push('**Before the Call:**');
    lines.push('');
    lines.push(`- [ ] Review ${companyName}'s website for recent updates`);
    lines.push(`- [ ] Check LinkedIn for recent company news`);

    // Add owner/decision maker check if identified
    const owner = intel.key_people?.find(p =>
      p.title?.toLowerCase().includes('owner') ||
      p.title?.toLowerCase().includes('ceo')
    );
    if (owner?.linkedinUrl) {
      lines.push(`- [ ] Review [${owner.name}'s LinkedIn](${owner.linkedinUrl}) for recent activity`);
    }

    lines.push(`- [ ] Confirm their main pain points are still relevant`);
    lines.push(`- [ ] Prepare ${COMPANY_TYPE_LABELS[classification.type]} value proposition`);
    lines.push('');

    lines.push('**Opening Script:**');
    lines.push('');
    lines.push(`> "Hi [Name], I'm calling from X-RAI. We work with ${COMPANY_TYPE_LABELS[classification.type].toLowerCase()}s like ${companyName} to ${classification.salesApproach.primaryFocus.toLowerCase()}. I noticed [specific observation] and wanted to see if that resonates with what you're experiencing..."`);
    lines.push('');

    lines.push('**Key Questions to Ask:**');
    lines.push('');

    // Questions based on company type
    const questions = this.getDiscoveryQuestions(classification.type);
    for (const q of questions) {
      lines.push(`- ${q}`);
    }
    lines.push('');

    return {
      title: 'Call Preparation',
      content: lines.join('\n'),
      order: 8,
    };
  }

  /**
   * Assemble all sections into final markdown
   */
  private assembleMarkdown(
    companyName: string,
    sections: ReportSection[],
    classification: CompanyTypeClassification
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Sales Intelligence Report: ${companyName}`);
    lines.push('');
    lines.push(`*Generated: ${new Date().toLocaleString()}*`);
    lines.push('');

    // Quick classification badge with tags
    const tier = classification.estimatedTier.toUpperCase().replace('_', ' ');
    const type = COMPANY_TYPE_LABELS[classification.type];

    // Build classification line with tags
    let classificationLine = `**Classification:** ${type}`;

    // Add important tags
    const displayTags = (classification.tags || [])
      .filter(tag => ['PCT_TOP_100', 'FAST_GROWING', 'PE_BACKED', 'ACTIVE_ACQUIRER', 'FAMILY_BUSINESS'].includes(tag))
      .map(tag => {
        // Convert tag to display format
        const tagLabels: Record<string, string> = {
          'PCT_TOP_100': '🏆 PCT Top 100',
          'FAST_GROWING': '📈 Fast Growing',
          'PE_BACKED': '💼 PE Backed',
          'ACTIVE_ACQUIRER': '🏢 Active Acquirer',
          'FAMILY_BUSINESS': '👨‍👩‍👧‍👦 Family Business',
        };
        return tagLabels[tag] || tag.replace(/_/g, ' ');
      });

    if (displayTags.length > 0) {
      classificationLine += ` | ${displayTags.join(' | ')}`;
    }

    classificationLine += ` | **Tier:** ${tier}`;
    lines.push(classificationLine);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Add each section
    for (const section of sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a person entry
   */
  private formatPersonEntry(person: KeyPerson): string {
    const lines: string[] = [];

    let header = `**${person.name}**`;
    if (person.title) {
      header += ` - ${person.title}`;
    }
    lines.push(header);

    const contact: string[] = [];
    if (person.email) {
      contact.push(`Email: ${person.email}`);
    }
    if (person.phone) {
      contact.push(`Phone: ${person.phone}`);
    }
    if (person.linkedinUrl) {
      contact.push(`[LinkedIn](${person.linkedinUrl})`);
    }

    if (contact.length > 0) {
      lines.push(`  - ${contact.join(' | ')}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format revenue for display
   */
  private formatRevenue(revenue: number): string {
    if (revenue >= 1_000_000_000) {
      return `$${(revenue / 1_000_000_000).toFixed(1)}B`;
    }
    if (revenue >= 1_000_000) {
      return `$${(revenue / 1_000_000).toFixed(1)}M`;
    }
    if (revenue >= 1_000) {
      return `$${(revenue / 1_000).toFixed(0)}K`;
    }
    return `$${revenue.toLocaleString()}`;
  }

  /**
   * Combine awards from multiple sources
   */
  private combineAwards(
    intelAwards: string[],
    researchAwards: AwardResult[]
  ): (string | AwardResult)[] {
    const combined: (string | AwardResult)[] = [];
    const seenNames = new Set<string>();

    // Add research awards first (more detailed)
    for (const award of researchAwards) {
      const key = award.awardName.toLowerCase().substring(0, 30);
      if (!seenNames.has(key)) {
        seenNames.add(key);
        combined.push(award);
      }
    }

    // Add intel awards if not duplicates
    for (const award of intelAwards) {
      const key = award.toLowerCase().substring(0, 30);
      if (!seenNames.has(key)) {
        seenNames.add(key);
        combined.push(award);
      }
    }

    return combined;
  }

  /**
   * Get discovery questions based on company type
   */
  private getDiscoveryQuestions(type: CompanyType): string[] {
    const questions: Record<CompanyType, string[]> = {
      pe_backed_platform: [
        'How many acquisitions have you made in the past year?',
        'What\'s your biggest challenge when integrating new companies?',
        'How do you currently standardize operations across locations?',
        'What metrics does your PE partner focus on most?',
      ],
      family_owned_enterprise: [
        'How long has the family been running the business?',
        'What\'s your vision for the next 5-10 years?',
        'Is the next generation involved in the business?',
        'What would you never want to change about how you operate?',
      ],
      franchise_system: [
        'How do you maintain consistency across franchisees?',
        'What tools do franchisees wish they had?',
        'How do you handle technology decisions - corporate or franchisee level?',
        'What\'s your biggest operational challenge across the system?',
      ],
      growth_stage_regional: [
        'What markets are you expanding into?',
        'What\'s breaking as you scale?',
        'How are you handling increased call volume?',
        'What would help you grow faster without adding overhead?',
      ],
      local_operator: [
        'What keeps you up at night about the business?',
        'How do you compete with larger companies?',
        'What takes up most of your time each day?',
        'What would you do with an extra 10 hours per week?',
      ],
      unknown: [
        'Tell me about your business and how you got started.',
        'What\'s your biggest challenge right now?',
        'What are your goals for the next year?',
        'How do you currently handle [relevant process]?',
      ],
    };

    return questions[type] || questions.unknown;
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(
    intel: CompanyIntelligence,
    research: SerperResearchData | null | undefined
  ): number {
    let score = 0;
    let maxScore = 0;

    // Company profile completeness
    const profile = intel.company_profile;
    if (profile?.founded_year?.value) { score += 5; }
    if (profile?.employee_count?.value || profile?.employee_range?.value) { score += 10; }
    if (profile?.headquarters?.value) { score += 5; }
    maxScore += 20;

    // Financial data
    if (intel.financial?.estimated_revenue?.value) { score += 10; }
    if (intel.financial?.hiring_activity?.value) { score += 5; }
    maxScore += 15;

    // Key people
    const peopleCount = intel.key_people?.length || 0;
    score += Math.min(20, peopleCount * 4);
    maxScore += 20;

    // Online presence
    const presence = intel.online_presence;
    if (presence?.linkedin_url?.value) { score += 5; }
    if (presence?.facebook_url?.value) { score += 5; }
    if (presence?.website_url?.value) { score += 5; }
    maxScore += 15;

    // Research data
    if (research) {
      if (research.awards.length > 0) { score += 10; }
      if (research.recentNews.length > 0) { score += 10; }
      if (research.executiveProfiles.length > 0) { score += 5; }
      if (research.isPEBacked !== undefined) { score += 5; }
    }
    maxScore += 30;

    return Math.round((score / maxScore) * 100);
  }
}

// Export singleton
export const salesReportGenerator = new SalesReportGenerator();
