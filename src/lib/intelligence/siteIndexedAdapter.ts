/**
 * Adapter for Site-Indexed Collector
 * Converts the CompanyIntelligence output to the database format
 */

import type {
  CompanyIntelligence as ResearchIntelligence,
} from './researchCoordinator';
import {
  createSourcedField,
  type CompanyIntelligence as DBIntelligence,
  type CompanyProfileData,
  type OnlinePresenceData,
  type ReviewsData,
  type ReviewData,
  type MarketingData,
  type TechnologyData,
  type FinancialData,
  type ServicesData,
  type KeyPerson,
  type IndustryMention,
  type CollectionError,
} from './dataLayerTypes';

// Helper to get default profile
function getDefaultProfile(): CompanyProfileData {
  return {
    founded_year: createSourcedField<number>(null, null, null),
    employee_count: createSourcedField<number>(null, null, null),
    employee_range: createSourcedField<string>(null, null, null),
    annual_revenue: createSourcedField<number>(null, null, null),
    revenue_range: createSourcedField<string>(null, null, null),
    headquarters: createSourcedField<string>(null, null, null),
    locations_count: createSourcedField<number>(null, null, null),
    company_type: createSourcedField<string>(null, null, null),
    ownership: createSourcedField<string>(null, null, null),
  };
}

function getDefaultPresence(): OnlinePresenceData {
  return {
    website_url: createSourcedField<string>(null, null, null),
    linkedin_url: createSourcedField<string>(null, null, null),
    linkedin_followers: createSourcedField<number>(null, null, null),
    facebook_url: createSourcedField<string>(null, null, null),
    facebook_followers: createSourcedField<number>(null, null, null),
    twitter_url: createSourcedField<string>(null, null, null),
    instagram_url: createSourcedField<string>(null, null, null),
    youtube_url: createSourcedField<string>(null, null, null),
    youtube_subscribers: createSourcedField<number>(null, null, null),
  };
}

function getDefaultReviews(): ReviewsData {
  return {
    google_rating: createSourcedField<number>(null, null, null),
    google_review_count: createSourcedField<number>(null, null, null),
    google_place_id: createSourcedField<string>(null, null, null),
    facebook_rating: createSourcedField<number>(null, null, null),
    facebook_review_count: createSourcedField<number>(null, null, null),
    bbb_rating: createSourcedField<string>(null, null, null),
    yelp_rating: createSourcedField<number>(null, null, null),
    review_velocity_30d: createSourcedField<number>(null, null, null),
    recent_reviews: createSourcedField<ReviewData[]>([], null, null),
  };
}

function getDefaultMarketing(): MarketingData {
  return {
    has_blog: createSourcedField<boolean>(null, null, null),
    blog_url: createSourcedField<string>(null, null, null),
    blog_post_frequency: createSourcedField<string>(null, null, null),
    last_blog_post_date: createSourcedField<string>(null, null, null),
    email_marketing: createSourcedField<boolean>(null, null, null),
    social_posting_frequency: createSourcedField<string>(null, null, null),
    has_paid_ads: createSourcedField<boolean>(null, null, null),
    marketing_sophistication: createSourcedField<string>(null, null, null),
    primary_channels: createSourcedField<string[]>([], null, null),
  };
}

function getDefaultTechnology(): TechnologyData {
  return {
    crm_system: createSourcedField<string>(null, null, null),
    routing_software: createSourcedField<string>(null, null, null),
    phone_system: createSourcedField<string>(null, null, null),
    payment_processor: createSourcedField<string>(null, null, null),
    website_platform: createSourcedField<string>(null, null, null),
    scheduling_system: createSourcedField<string>(null, null, null),
    detected_technologies: createSourcedField<string[]>([], null, null),
    has_online_booking: createSourcedField<boolean>(null, null, null),
    has_live_chat: createSourcedField<boolean>(null, null, null),
  };
}

function getDefaultFinancial(): FinancialData {
  return {
    estimated_revenue: createSourcedField<number>(null, null, null),
    growth_signals: createSourcedField<string[]>([], null, null),
    funding_status: createSourcedField<string>(null, null, null),
    recent_acquisitions: createSourcedField<string[]>([], null, null),
    hiring_activity: createSourcedField<string>(null, null, null),
    job_postings_count: createSourcedField<number>(null, null, null),
  };
}

function getDefaultServices(): ServicesData {
  return {
    primary_services: createSourcedField<string[]>([], null, null),
    service_areas: createSourcedField<string[]>([], null, null),
    certifications: createSourcedField<string[]>([], null, null),
    awards: createSourcedField<string[]>([], null, null),
    specializations: createSourcedField<string[]>([], null, null),
  };
}

/**
 * Convert site-indexed collector output to database format
 */
export function convertToDBFormat(
  research: ResearchIntelligence,
  intelligenceId: string,
  companyId: string,
  domain: string
): Partial<DBIntelligence> {
  const websiteUrl = `https://${domain}`;

  // Build company profile
  const profile = getDefaultProfile();

  if (research.yearFounded?.value) {
    profile.founded_year = createSourcedField(
      research.yearFounded.value,
      research.yearFounded.source || 'website',
      research.yearFounded.sourceUrl || websiteUrl,
      research.yearFounded.confidence
    );
  }

  if (research.employeeCount?.value) {
    profile.employee_count = createSourcedField(
      research.employeeCount.value,
      research.employeeCount.source || 'website',
      research.employeeCount.sourceUrl || websiteUrl,
      research.employeeCount.confidence
    );
  }

  if (research.locationCount?.value) {
    profile.locations_count = createSourcedField(
      research.locationCount.value,
      research.locationCount.source || 'website',
      research.locationCount.sourceUrl || websiteUrl,
      research.locationCount.confidence
    );
  }

  if (research.headquartersCity?.value || research.headquartersState?.value) {
    const hq = [research.headquartersCity?.value, research.headquartersState?.value]
      .filter(Boolean)
      .join(', ');
    profile.headquarters = createSourcedField(
      hq,
      research.headquartersCity?.source || 'website',
      research.headquartersCity?.sourceUrl || websiteUrl,
      research.headquartersCity?.confidence
    );
  }

  // Build ownership label with generation if family-owned
  if (research.ownershipType?.value) {
    let ownershipLabel: string = research.ownershipType.value;

    if (research.ownershipType.value === 'family') {
      const evidence = research.ownershipEvidence?.value || [];
      const genMatch = evidence.join(' ').match(/(\d+)(?:st|nd|rd|th)?\s*generation/i);
      if (genMatch) {
        const gen = parseInt(genMatch[1]);
        const suffix = gen === 1 ? 'st' : gen === 2 ? 'nd' : gen === 3 ? 'rd' : 'th';
        ownershipLabel = `${gen}${suffix} generation family-owned`;
      } else {
        ownershipLabel = 'family-owned';
      }
      if (research.ownerName?.value) {
        ownershipLabel += ` (${research.ownerName.value})`;
      }
    }

    profile.ownership = createSourcedField(
      ownershipLabel,
      research.ownershipType.source || 'website',
      research.ownershipType.sourceUrl || websiteUrl,
      research.ownershipType.confidence
    );
  }

  // Build online presence
  const presence = getDefaultPresence();
  presence.website_url = createSourcedField(websiteUrl, 'website', websiteUrl, 'high');

  if (research.linkedinUrl?.value) {
    presence.linkedin_url = createSourcedField(
      research.linkedinUrl.value,
      research.linkedinUrl.source || 'website',
      research.linkedinUrl.sourceUrl,
      research.linkedinUrl.confidence
    );
  }

  if (research.linkedinFollowers?.value) {
    presence.linkedin_followers = createSourcedField(
      research.linkedinFollowers.value,
      research.linkedinFollowers.source || 'serper',
      research.linkedinFollowers.sourceUrl,
      research.linkedinFollowers.confidence
    );
  }

  if (research.facebookUrl?.value) {
    presence.facebook_url = createSourcedField(
      research.facebookUrl.value,
      research.facebookUrl.source || 'website',
      research.facebookUrl.sourceUrl,
      research.facebookUrl.confidence
    );
  }

  // Build reviews
  const reviews = getDefaultReviews();

  if (research.googleRating?.value) {
    reviews.google_rating = createSourcedField(
      research.googleRating.value,
      research.googleRating.source || 'google_places',
      research.googleRating.sourceUrl,
      research.googleRating.confidence
    );
  }

  if (research.googleReviewCount?.value) {
    reviews.google_review_count = createSourcedField(
      research.googleReviewCount.value,
      research.googleReviewCount.source || 'google_places',
      research.googleReviewCount.sourceUrl,
      research.googleReviewCount.confidence
    );
  }

  // Build technology
  const technology = getDefaultTechnology();

  if (research.technologies?.value?.length) {
    const techNames = research.technologies.value.map(t => t.name);
    technology.detected_technologies = createSourcedField(
      techNames,
      'website',
      websiteUrl,
      'medium'
    );

    // Extract CRM if found
    const crmTech = research.technologies.value.find(
      t => t.category === 'crm' || /fieldroutes|servicetitan|pestroutes|pestpac/i.test(t.name)
    );
    if (crmTech) {
      technology.crm_system = createSourcedField(
        crmTech.name,
        crmTech.source || 'website',
        crmTech.sourceUrl,
        crmTech.confidence
      );
    }
  }

  // Build services
  const services = getDefaultServices();

  if (research.services?.value?.length) {
    services.primary_services = createSourcedField(
      research.services.value,
      research.services.source || 'website',
      research.services.sourceUrl || websiteUrl,
      research.services.confidence
    );
  }

  if (research.serviceAreas?.value?.length) {
    services.service_areas = createSourcedField(
      research.serviceAreas.value,
      research.serviceAreas.source || 'website',
      research.serviceAreas.sourceUrl || websiteUrl,
      research.serviceAreas.confidence
    );
  }

  if (research.certifications?.value?.length) {
    services.certifications = createSourcedField(
      research.certifications.value,
      research.certifications.source || 'website',
      research.certifications.sourceUrl || websiteUrl,
      research.certifications.confidence
    );
  }

  if (research.awards?.value?.length) {
    const awardNames = research.awards.value.map(
      a => a.year ? `${a.name} (${a.year})` : a.name
    );
    services.awards = createSourcedField(
      awardNames,
      'website',
      websiteUrl,
      'high'
    );
  }

  // Build financial
  const financial = getDefaultFinancial();

  if (research.isHiring?.value) {
    const jobCount = research.openJobCount?.value || 0;
    const employeeCount = research.employeeCount?.value || 50;
    const jobRatio = jobCount / employeeCount;

    let hiringActivity = 'active';
    if (jobRatio > 0.05) hiringActivity = 'very_high';
    else if (jobRatio > 0.02) hiringActivity = 'high';
    else if (jobRatio > 0.01) hiringActivity = 'moderate';

    financial.hiring_activity = createSourcedField(
      hiringActivity,
      'website',
      websiteUrl,
      'medium'
    );
  }

  if (research.openJobCount?.value) {
    financial.job_postings_count = createSourcedField(
      research.openJobCount.value,
      research.openJobCount.source || 'website',
      research.openJobCount.sourceUrl,
      research.openJobCount.confidence
    );
  }

  // Build key people from leadership
  const keyPeople: KeyPerson[] = [];

  if (research.leadership?.owner?.value) {
    const owner = research.leadership.owner.value;
    keyPeople.push({
      name: owner.name,
      title: owner.title || 'Owner',
      email: owner.email,
      phone: owner.phone,
      linkedinUrl: owner.linkedinUrl,
      seniority: 'owner',
      department: 'executive',
      source: research.leadership.owner.source || 'website',
      sourceUrl: research.leadership.owner.sourceUrl,
      photoUrl: null,
      isDecisionMaker: true,
    });
  }

  if (research.leadership?.keyExecutives?.value?.length) {
    for (const exec of research.leadership.keyExecutives.value) {
      // Avoid duplicates
      if (!keyPeople.some(p => p.name.toLowerCase() === exec.name.toLowerCase())) {
        keyPeople.push({
          name: exec.name,
          title: exec.title || null,
          email: exec.email,
          phone: exec.phone,
          linkedinUrl: exec.linkedinUrl,
          seniority: exec.isDecisionMaker ? 'executive' : 'management',
          department: exec.department,
          source: research.leadership.keyExecutives.source || 'website',
          sourceUrl: research.leadership.keyExecutives.sourceUrl,
          photoUrl: null,
          isDecisionMaker: exec.isDecisionMaker || false,
        });
      }
    }
  }

  // Build industry mentions from awards
  const mentions: IndustryMention[] = [];

  if (research.isPctTop100?.value) {
    mentions.push({
      title: 'PCT Top 100 Company',
      source: 'PCT Magazine',
      sourceUrl: research.isPctTop100.sourceUrl || 'https://pctonline.com',
      date: new Date().toISOString(),
      type: 'award',
      sentiment: 'positive',
      snippet: 'Ranked in PCT Top 100 pest control companies',
    });
  }

  // Compile full update
  const update: Partial<DBIntelligence> = {
    company_profile: profile,
    online_presence: presence,
    reviews,
    marketing: getDefaultMarketing(),
    technology,
    financial,
    services,
    key_people: keyPeople,
    industry_mentions: mentions,
    collection_status: 'complete',
    last_collected_at: new Date().toISOString(),
    collection_errors: [],
    completeness_score: research.dataQualityScore || 0,
    data_quality_score: research.dataQualityScore || 0,
  };

  return update;
}
