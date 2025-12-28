/**
 * Intelligence Collector V2
 * Collects data from various sources and saves to the new company_intelligence schema
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { websiteCollector } from './collectors/websiteCollector';
import { facebookCollector } from './collectors/facebookCollector';
import { googleReviewsCollector } from './collectors/googleReviewsCollector';
import { apolloCompanyCollector } from './collectors/apolloCompanyCollector';
import { apolloPeopleCollector } from './collectors/apolloPeopleCollector';
import { blogDetector } from './collectors/blogDetector';
import { youtubeDetector } from './collectors/youtubeDetector';
import { websiteMarketingCollector } from './collectors/websiteMarketingCollector';
import { linkedinCompanyCollector } from './collectors/linkedinCompanyCollector';
import { serperResearchCollector, type SerperResearchData } from './collectors/serperResearchCollector';
import { companyTypeClassifier, type CompanyTypeClassification } from './classifiers/companyTypeClassifier';
import { salesReportGenerator, type SalesReport } from './generators/salesReportGenerator';
import {
  createSourcedField,
  type CompanyIntelligence,
  type CollectionError,
  type KeyPerson,
  type SourcedField,
  type CompanyProfileData,
  type OnlinePresenceData,
  type ReviewsData,
  type ReviewData,
  type MarketingData,
  type TechnologyData,
  type ServicesData,
  type FinancialData,
  type DataConfidence,
} from './dataLayerTypes';
import type {
  WebsiteData,
  FacebookData,
  GoogleReviewsData,
  ApolloCompanyData,
  ApolloPerson,
} from './types';

// ============================================
// TYPES
// ============================================

interface CollectV2Request {
  companyId: string;
  companyName: string;
  domain: string | null;
  intelligenceId: string;
  sources?: string[];
  force?: boolean;
}

interface CollectV2Result {
  success: boolean;
  errors: CollectionError[];
  research?: SerperResearchData | null;
  classification?: CompanyTypeClassification | null;
  salesReport?: SalesReport | null;
}

// ============================================
// MAIN COLLECTION FUNCTION
// ============================================

export async function collectIntelligenceV2(
  request: CollectV2Request
): Promise<CollectV2Result> {
  const { companyId, companyName, domain, intelligenceId, force = false } = request;
  const supabase = createAdminClient();
  const errors: CollectionError[] = [];

  console.log(`[CollectorV2] Starting collection for ${companyName}`);

  // Initialize update object with default structure
  const updates: Partial<CompanyIntelligence> = {
    collection_status: 'collecting',
    last_collected_at: new Date().toISOString(),
  };

  // Track discovered social URLs to use in later collectors
  let discoveredFacebookUrl: string | null = null;
  let discoveredLinkedInUrl: string | null = null;

  // ============================================
  // 1. WEBSITE COLLECTION
  // ============================================
  if (domain) {
    try {
      console.log('[CollectorV2] Collecting website data...');
      const websiteResult = await websiteCollector.collect(companyName, domain);

      if (websiteResult.success && websiteResult.data) {
        const website = websiteResult.data;
        const websiteUrl = `https://${domain}`;

        // Map to company_profile
        updates.company_profile = {
          ...getDefaultProfile(),
          headquarters: createSourcedField(website.address, 'website', websiteUrl),
          locations_count: createSourcedField(
            website.employeeSizeIndicators?.locationsCount || null,
            'website',
            websiteUrl
          ),
        };

        // Map to online_presence
        updates.online_presence = {
          ...getDefaultPresence(),
          website_url: createSourcedField(websiteUrl, 'website', websiteUrl),
          linkedin_url: createSourcedField(website.socialLinks?.linkedin || null, 'website', websiteUrl),
          facebook_url: createSourcedField(website.socialLinks?.facebook || null, 'website', websiteUrl),
          twitter_url: createSourcedField(website.socialLinks?.twitter || null, 'website', websiteUrl),
          instagram_url: createSourcedField(website.socialLinks?.instagram || null, 'website', websiteUrl),
        };

        // Store discovered social URLs for use in later collectors
        discoveredFacebookUrl = website.socialLinks?.facebook || null;
        discoveredLinkedInUrl = website.socialLinks?.linkedin || null;

        // Extract services and geographic areas from website data
        const allItems = [
          ...(website.services || []),
          ...(website.serviceAreas || []),
        ];

        // Filter to actual services (pest control, HVAC, etc.)
        const serviceKeywords = [
          'pest', 'control', 'termite', 'bed bug', 'rodent', 'ant', 'roach', 'mosquito',
          'wildlife', 'bee', 'wasp', 'spider', 'flea', 'tick', 'lawn', 'hvac', 'plumbing',
          'heating', 'cooling', 'air conditioning', 'electrical', 'insulation', 'removal',
          'extermination', 'treatment', 'inspection', 'prevention', 'commercial', 'residential',
        ];

        const services = allItems.filter(item => {
          const lower = item.toLowerCase();
          // Exclude nav/menu items
          if (['home', 'about', 'contact', 'blog', 'news', 'careers', 'login', 'testimonials',
               'resource', 'history', 'team', 'awards', 'faq', 'privacy', 'terms'].some(nav => lower === nav || lower.includes(nav))) {
            return false;
          }
          // Include if contains service keywords
          return serviceKeywords.some(kw => lower.includes(kw));
        }).slice(0, 20);

        // Filter to geographic service areas (cities, states, regions)
        const usStates = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
          'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois',
          'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
          'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana',
          'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york',
          'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
          'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah',
          'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
          'nc', 'sc', 'va', 'ga', 'fl', 'tx', 'ca', 'ny', 'pa', 'oh', 'il', 'az', 'co'];

        const geoKeywords = ['county', 'area', 'metro', 'greater', 'region', 'valley', 'lake'];

        // Navigation/non-geographic items to explicitly exclude
        const excludeItems = [
          'home', 'about', 'contact', 'blog', 'news', 'careers', 'career', 'services',
          'login', 'testimonials', 'testimonial', 'faq', 'privacy', 'terms', 'sitemap',
          'resource', 'resources', 'customer', 'history', 'team', 'pledge', 'awards',
          'award', 'plans', 'plan', 'community', 'offers', 'offer', 'compare', 'special',
          'specials', 'coupon', 'coupons', 'financing', 'payment', 'pay', 'bill',
          'pricing', 'schedule', 'request', 'quote', 'estimate', 'free', 'call',
          'click', 'view', 'learn', 'more', 'general', 'contracting', 'care',
          'installation', 'nursing', 'homes', 'christmas', 'light', 'amphipods',
          'weevil', 'boxelder', 'bugs', 'cockroaches', 'caddis', 'fly', 'centipede',
          'cheese', 'skipper', 'clover', 'mites', 'cotton', 'rats', 'lawn',
        ];

        const geoAreas = (website.serviceAreas || []).filter(item => {
          const lower = item.toLowerCase().trim();

          // Explicitly exclude navigation items
          if (excludeItems.some(ex => lower.includes(ex))) {
            return false;
          }

          // Include if matches state name or geo keyword
          return usStates.some(state => lower.includes(state)) ||
                 geoKeywords.some(kw => lower.includes(kw));
        }).slice(0, 30);

        updates.services = {
          ...getDefaultServices(),
          primary_services: createSourcedField(services.length > 0 ? services : [], 'website', websiteUrl),
          service_areas: createSourcedField(geoAreas.length > 0 ? geoAreas : [], 'website', websiteUrl),
          certifications: createSourcedField(website.certifications || [], 'website', websiteUrl),
          awards: createSourcedField(website.awards || [], 'website', websiteUrl),
        };

        // Map technology signals from website
        updates.technology = {
          ...getDefaultTechnology(),
          has_online_booking: createSourcedField(
            website.schedulingSystem ? true : false,
            'website',
            websiteUrl
          ),
          scheduling_system: createSourcedField(website.schedulingSystem, 'website', websiteUrl),
        };

        // Map financial signals from website (job postings indicate hiring activity)
        // Note: We use preliminary thresholds here; will recalculate after Apollo provides employee count
        const jobCount = website.employeeSizeIndicators?.jobPostingsCount || 0;
        // Preliminary hiring activity based on absolute count (will be refined with employee count)
        const prelimHiringActivity = jobCount > 0 ? 'active' : null;
        updates.financial = {
          ...getDefaultFinancial(),
          job_postings_count: createSourcedField(jobCount, 'website', `${websiteUrl}/careers`),
          hiring_activity: createSourcedField(prelimHiringActivity, 'website', `${websiteUrl}/careers`),
        };

        // Map team members to key_people
        if (website.teamMembers && website.teamMembers.length > 0) {
          updates.key_people = website.teamMembers.map(member => ({
            name: member.name,
            title: member.title,
            email: null,
            phone: null,
            linkedinUrl: member.linkedinUrl || null,
            seniority: null,
            department: null,
            source: 'website',
            sourceUrl: websiteUrl,
            photoUrl: member.imageUrl || null,
            isDecisionMaker: false,
          }));
        }

        // Log collection
        await logCollection(supabase, intelligenceId, 'website', true, websiteResult);
      }
    } catch (error) {
      console.error('[CollectorV2] Website collection error:', error);
      errors.push({
        source: 'website',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      await logCollection(supabase, intelligenceId, 'website', false, null, error);
    }
  }

  // ============================================
  // 2. FACEBOOK COLLECTION
  // ============================================
  try {
    console.log('[CollectorV2] Collecting Facebook data...');
    const fbResult = await facebookCollector.collect(companyName, domain, {
      knownUrl: discoveredFacebookUrl || undefined,
    });

    if (fbResult.success && fbResult.data) {
      const fb = fbResult.data;

      updates.online_presence = {
        ...getDefaultPresence(),
        ...updates.online_presence,
        facebook_url: createSourcedField(fb.pageUrl, 'facebook', fb.pageUrl),
        facebook_followers: createSourcedField(fb.followers, 'facebook', fb.pageUrl),
      };

      updates.reviews = {
        ...getDefaultReviews(),
        ...updates.reviews,
        facebook_rating: createSourcedField(fb.rating, 'facebook', fb.pageUrl),
        facebook_review_count: createSourcedField(fb.reviewCount, 'facebook', fb.pageUrl),
      };

      await logCollection(supabase, intelligenceId, 'facebook', true, fbResult);
    }
  } catch (error) {
    console.error('[CollectorV2] Facebook collection error:', error);
    errors.push({
      source: 'facebook',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'facebook', false, null, error);
  }

  // ============================================
  // 3. GOOGLE REVIEWS COLLECTION
  // ============================================
  try {
    console.log('[CollectorV2] Collecting Google reviews...');
    const googleResult = await googleReviewsCollector.collect(companyName, domain);

    if (googleResult.success && googleResult.data) {
      const google = googleResult.data;

      updates.reviews = {
        ...getDefaultReviews(),
        ...updates.reviews,
        google_rating: createSourcedField(google.rating, 'google_places', `https://maps.google.com/?cid=${google.placeId}`),
        google_review_count: createSourcedField(google.totalReviews, 'google_places', null),
        google_place_id: createSourcedField(google.placeId, 'google_places', null),
        recent_reviews: createSourcedField(
          google.reviews?.slice(0, 5).map(r => ({
            author: r.author,
            rating: r.rating,
            text: r.text,
            date: r.date,
            source: 'google',
          })) || [],
          'google_places',
          null
        ),
      };

      // Update company_profile with address from Google
      if (google.address) {
        updates.company_profile = {
          ...getDefaultProfile(),
          ...updates.company_profile,
          headquarters: createSourcedField(google.address, 'google_places', null),
        };
      }

      await logCollection(supabase, intelligenceId, 'google_reviews', true, googleResult);
    }
  } catch (error) {
    console.error('[CollectorV2] Google reviews collection error:', error);
    errors.push({
      source: 'google_reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'google_reviews', false, null, error);
  }

  // ============================================
  // 4. APOLLO COMPANY COLLECTION
  // ============================================
  try {
    console.log('[CollectorV2] Collecting Apollo company data...');
    const apolloResult = await apolloCompanyCollector.collect(companyName, domain);

    if (apolloResult.success && apolloResult.data) {
      const apollo = apolloResult.data;
      const apolloUrl = apollo.linkedinUrl || null;

      updates.company_profile = {
        ...getDefaultProfile(),
        ...updates.company_profile,
        founded_year: createSourcedField(apollo.foundedYear, 'apollo', apolloUrl),
        employee_count: createSourcedField(apollo.employeeCount, 'apollo', apolloUrl),
        employee_range: createSourcedField(apollo.employeeRange, 'apollo', apolloUrl),
        annual_revenue: createSourcedField(apollo.revenue, 'apollo', apolloUrl),
        revenue_range: createSourcedField(apollo.revenueRange, 'apollo', apolloUrl),
        headquarters: createSourcedField(
          apollo.headquarters
            ? `${apollo.headquarters.city || ''}, ${apollo.headquarters.state || ''}`.trim()
            : null,
          'apollo',
          apolloUrl
        ),
      };

      updates.online_presence = {
        ...getDefaultPresence(),
        ...updates.online_presence,
        linkedin_url: createSourcedField(apollo.linkedinUrl, 'apollo', apolloUrl),
        twitter_url: createSourcedField(apollo.twitterUrl, 'apollo', apolloUrl),
        facebook_url: createSourcedField(apollo.facebookUrl, 'apollo', apolloUrl),
      };

      updates.technology = {
        ...getDefaultTechnology(),
        ...updates.technology,
        detected_technologies: createSourcedField(apollo.technologies || [], 'apollo', apolloUrl),
      };

      // Populate financial section from Apollo with confidence scoring
      // Revenue estimates from Apollo are more reliable for larger companies
      let revenueConfidence: DataConfidence = 'low';
      if (apollo.revenue) {
        const revenueInMillions = apollo.revenue / 1_000_000;
        const employeeCount = apollo.employeeCount || 0;

        // Higher confidence for:
        // - Companies with billions in revenue (likely public data available)
        // - Companies with many employees (revenue estimates more reliable at scale)
        // - Revenue that aligns with employee count (sanity check)
        if (revenueInMillions >= 1000) {
          revenueConfidence = 'high'; // Billion+ companies have more public data
        } else if (revenueInMillions >= 50 && employeeCount >= 100) {
          revenueConfidence = 'medium'; // Mid-size companies with reasonable employee count
        } else if (employeeCount > 0 && revenueInMillions > 0) {
          // Sanity check: revenue per employee should be reasonable ($50K-$500K typical)
          const revenuePerEmployee = (apollo.revenue / employeeCount);
          if (revenuePerEmployee >= 50_000 && revenuePerEmployee <= 500_000) {
            revenueConfidence = 'medium';
          }
        }
        // Otherwise stays 'low' - small company revenue estimates are often unreliable
      }

      updates.financial = {
        ...getDefaultFinancial(),
        ...updates.financial,
        estimated_revenue: createSourcedField(apollo.revenue, 'apollo', apolloUrl, revenueConfidence),
      };

      // Recalculate hiring activity based on employee count (relative to company size)
      if (apollo.employeeCount && updates.financial?.job_postings_count?.value) {
        const jobCount = updates.financial.job_postings_count.value;
        const employeeCount = apollo.employeeCount;
        const jobRatio = jobCount / employeeCount;

        // More accurate hiring activity based on % of workforce being hired
        // >5% = very_high (aggressive growth), >2% = high, >1% = moderate, any jobs = active
        const refinedHiringActivity =
          jobRatio > 0.05 ? 'very_high' :
          jobRatio > 0.02 ? 'high' :
          jobRatio > 0.01 ? 'moderate' :
          jobCount > 0 ? 'active' : null;

        updates.financial.hiring_activity = createSourcedField(
          refinedHiringActivity,
          'calculated',
          null
        );
      }

      await logCollection(supabase, intelligenceId, 'apollo_company', true, apolloResult);
    }
  } catch (error) {
    console.error('[CollectorV2] Apollo company collection error:', error);
    errors.push({
      source: 'apollo_company',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'apollo_company', false, null, error);
  }

  // ============================================
  // 5. APOLLO PEOPLE COLLECTION
  // ============================================
  try {
    console.log('[CollectorV2] Collecting Apollo people data...');
    const peopleResult = await apolloPeopleCollector.collect(companyName, domain, {
      maxPeople: 25,
    });

    if (peopleResult.success && peopleResult.data) {
      const people = peopleResult.data.people || [];

      const keyPeople: KeyPerson[] = people.map(person => ({
        name: person.fullName,
        title: person.title,
        email: person.email,
        phone: person.phone,
        linkedinUrl: person.linkedinUrl,
        seniority: person.seniority,
        department: person.department,
        source: 'apollo',
        sourceUrl: person.linkedinUrl,
        photoUrl: person.photoUrl,
        isDecisionMaker: ['c_level', 'vp', 'director', 'owner'].includes(person.seniority || ''),
      }));

      // Merge with existing key_people
      const existingPeople = updates.key_people || [];
      const existingNames = new Set(existingPeople.map(p => p.name.toLowerCase()));

      updates.key_people = [
        ...existingPeople,
        ...keyPeople.filter(p => !existingNames.has(p.name.toLowerCase())),
      ];

      await logCollection(supabase, intelligenceId, 'apollo_people', true, peopleResult);
    }
  } catch (error) {
    console.error('[CollectorV2] Apollo people collection error:', error);
    errors.push({
      source: 'apollo_people',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'apollo_people', false, null, error);
  }

  // ============================================
  // 6. BLOG DETECTION
  // ============================================
  if (domain) {
    try {
      console.log('[CollectorV2] Detecting blog...');
      const blogResult = await blogDetector.collect(companyName, domain);

      if (blogResult.success && blogResult.data) {
        const blog = blogResult.data;

        updates.marketing = {
          ...getDefaultMarketing(),
          ...updates.marketing,
          has_blog: createSourcedField(blog.exists, 'blog_detection', blog.url),
          blog_url: createSourcedField(blog.url, 'blog_detection', blog.url),
          blog_post_frequency: createSourcedField(
            blog.postsLast30Days > 4 ? 'weekly' :
              blog.postsLast30Days > 0 ? 'monthly' :
                blog.postsLast90Days > 0 ? 'quarterly' : 'none',
            'blog_detection',
            blog.url
          ),
          last_blog_post_date: createSourcedField(blog.lastPostDate, 'blog_detection', blog.url),
          email_marketing: createSourcedField(blog.hasEmailCapture, 'blog_detection', blog.url),
        };

        await logCollection(supabase, intelligenceId, 'blog_detection', true, blogResult);
      }
    } catch (error) {
      console.error('[CollectorV2] Blog detection error:', error);
      errors.push({
        source: 'blog_detection',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      await logCollection(supabase, intelligenceId, 'blog_detection', false, null, error);
    }
  }

  // ============================================
  // 7. YOUTUBE DETECTION
  // ============================================
  if (domain) {
    try {
      console.log('[CollectorV2] Detecting YouTube...');
      const ytResult = await youtubeDetector.collect(companyName, domain);

      if (ytResult.success && ytResult.data && ytResult.data.exists) {
        const yt = ytResult.data;

        updates.online_presence = {
          ...getDefaultPresence(),
          ...updates.online_presence,
          youtube_url: createSourcedField(yt.channelUrl, 'youtube_detection', yt.channelUrl),
          youtube_subscribers: createSourcedField(yt.subscribers, 'youtube_detection', yt.channelUrl),
        };

        await logCollection(supabase, intelligenceId, 'youtube_detection', true, ytResult);
      }
    } catch (error) {
      console.error('[CollectorV2] YouTube detection error:', error);
      errors.push({
        source: 'youtube_detection',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      await logCollection(supabase, intelligenceId, 'youtube_detection', false, null, error);
    }
  }

  // ============================================
  // 8. LINKEDIN COMPANY DATA
  // ============================================
  try {
    console.log('[CollectorV2] Collecting LinkedIn company data...');
    const linkedInResult = await linkedinCompanyCollector.collect(companyName, domain, {
      knownUrl: discoveredLinkedInUrl || undefined,
    });

    if (linkedInResult.success && linkedInResult.data) {
      const li = linkedInResult.data;

      updates.online_presence = {
        ...getDefaultPresence(),
        ...updates.online_presence,
        linkedin_url: createSourcedField(li.pageUrl, 'linkedin_company', li.pageUrl),
        linkedin_followers: createSourcedField(li.followers, 'linkedin_company', li.pageUrl),
      };

      // Update company profile with LinkedIn data if not already set
      if (li.industry || li.headquarters || li.foundedYear) {
        updates.company_profile = {
          ...getDefaultProfile(),
          ...updates.company_profile,
        };

        // Only update fields that weren't already set by Apollo
        if (li.foundedYear && !updates.company_profile.founded_year?.value) {
          updates.company_profile.founded_year = createSourcedField(li.foundedYear, 'linkedin_company', li.pageUrl);
        }
        if (li.headquarters && !updates.company_profile.headquarters?.value) {
          updates.company_profile.headquarters = createSourcedField(li.headquarters, 'linkedin_company', li.pageUrl);
        }
        if (li.companySize && !updates.company_profile.employee_range?.value) {
          updates.company_profile.employee_range = createSourcedField(li.companySize, 'linkedin_company', li.pageUrl);
        }
      }

      await logCollection(supabase, intelligenceId, 'linkedin_company', true, linkedInResult);
    }
  } catch (error) {
    console.error('[CollectorV2] LinkedIn company collection error:', error);
    errors.push({
      source: 'linkedin_company',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'linkedin_company', false, null, error);
  }

  // ============================================
  // 9. WEBSITE MARKETING SIGNALS
  // ============================================
  if (domain) {
    try {
      console.log('[CollectorV2] Collecting website marketing signals...');
      const marketingResult = await websiteMarketingCollector.collect(companyName, domain);

      if (marketingResult.success && marketingResult.data) {
        const mkt = marketingResult.data;
        const websiteUrl = `https://${domain}`;

        // Build detected technologies list from various signals
        const detectedTech: string[] = [];

        // Chat provider
        if (mkt.conversion.liveChatProvider) {
          detectedTech.push(mkt.conversion.liveChatProvider);
        }
        if (mkt.conversion.chatbotProvider && mkt.conversion.chatbotProvider !== mkt.conversion.liveChatProvider) {
          detectedTech.push(mkt.conversion.chatbotProvider);
        }

        // Scheduling provider (important for pest control industry - ServiceTitan, FieldRoutes, etc.)
        if (mkt.conversion.schedulingProvider) {
          detectedTech.push(mkt.conversion.schedulingProvider);
        }

        // Call tracking
        if (mkt.conversion.callTrackingProvider) {
          detectedTech.push(mkt.conversion.callTrackingProvider);
        }

        // Email platform
        if (mkt.email.detectedPlatform) {
          detectedTech.push(mkt.email.detectedPlatform);
        }

        // Tracking pixels
        if (mkt.technical.trackingPixels && mkt.technical.trackingPixels.length > 0) {
          detectedTech.push(...mkt.technical.trackingPixels);
        }

        updates.technology = {
          ...getDefaultTechnology(),
          ...updates.technology,
          has_live_chat: createSourcedField(mkt.conversion.hasLiveChat, 'website_marketing', websiteUrl),
          has_online_booking: createSourcedField(mkt.conversion.hasSchedulingWidget, 'website_marketing', websiteUrl),
          // Try to detect CRM from scheduling provider (many pest control CRMs have scheduling)
          crm_system: mkt.conversion.schedulingProvider
            ? createSourcedField(mkt.conversion.schedulingProvider, 'website_marketing', websiteUrl)
            : (updates.technology?.crm_system || createSourcedField<string>(null, null, null)),
          phone_system: mkt.conversion.callTrackingProvider
            ? createSourcedField(mkt.conversion.callTrackingProvider, 'website_marketing', websiteUrl)
            : (updates.technology?.phone_system || createSourcedField<string>(null, null, null)),
          detected_technologies: createSourcedField(
            [...new Set(detectedTech)],
            'website_marketing',
            websiteUrl
          ),
        };

        // Calculate sophistication level from score
        const sophisticationLevel =
          mkt.sophisticationScore >= 80 ? 'sophisticated' :
          mkt.sophisticationScore >= 50 ? 'active' :
          mkt.sophisticationScore >= 25 ? 'basic' : 'minimal';

        // Determine primary marketing channels
        const channels: string[] = [];
        if (mkt.email.hasNewsletterSignup) channels.push('Email Marketing');
        if (mkt.conversion.hasLiveChat) channels.push('Live Chat');
        if (mkt.technical.trackingPixels.includes('Facebook Pixel')) channels.push('Facebook Ads');
        if (mkt.technical.trackingPixels.includes('Google Ads')) channels.push('Google Ads');
        if (mkt.trust.hasTestimonials) channels.push('Testimonials');
        if (mkt.trust.hasCaseStudies) channels.push('Case Studies');

        updates.marketing = {
          ...getDefaultMarketing(),
          ...updates.marketing,
          marketing_sophistication: createSourcedField(sophisticationLevel, 'website_marketing', websiteUrl),
          email_marketing: createSourcedField(mkt.email.hasNewsletterSignup, 'website_marketing', websiteUrl),
          has_paid_ads: createSourcedField(
            mkt.technical.trackingPixels.some(p => p.includes('Ads') || p.includes('Pixel')),
            'website_marketing',
            websiteUrl
          ),
          primary_channels: createSourcedField(channels, 'website_marketing', websiteUrl),
        };

        await logCollection(supabase, intelligenceId, 'website_marketing', true, marketingResult);
      }
    } catch (error) {
      console.error('[CollectorV2] Website marketing collection error:', error);
      errors.push({
        source: 'website_marketing',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      await logCollection(supabase, intelligenceId, 'website_marketing', false, null, error);
    }
  }

  // ============================================
  // 10. SERPER EXTERNAL RESEARCH
  // ============================================
  let researchData: SerperResearchData | null = null;

  try {
    console.log('[CollectorV2] Running external research via Serper...');
    const serperResult = await serperResearchCollector.collect(companyName, domain);

    if (serperResult.success && serperResult.data) {
      researchData = serperResult.data;

      // Merge awards from external research with existing awards
      const existingAwards = updates.services?.awards?.value || [];
      const researchAwards = researchData.awards.map(a => a.awardName);
      const combinedAwards = [...new Set([...existingAwards, ...researchAwards])];

      updates.services = {
        ...getDefaultServices(),
        ...updates.services,
        awards: createSourcedField(combinedAwards, 'serper_research', null),
      };

      // Update ownership based on research
      if (researchData.isPEBacked) {
        updates.company_profile = {
          ...getDefaultProfile(),
          ...updates.company_profile,
          ownership: createSourcedField(
            researchData.peBackerName
              ? `PE-backed (${researchData.peBackerName})`
              : 'PE-backed',
            'serper_research',
            null
          ),
        };
      } else if (researchData.ownershipType && researchData.ownershipType !== 'unknown') {
        // Set ownership type from research (family, franchise, independent)
        let ownershipLabel: string;
        if (researchData.ownershipType === 'family') {
          // Build label like "3rd generation family-owned (Chase Hazelwood)"
          const gen = researchData.generationOwned;
          const genPart = gen
            ? `${gen}${gen === 1 ? 'st' : gen === 2 ? 'nd' : gen === 3 ? 'rd' : 'th'} generation `
            : '';
          const ownerPart = researchData.ownerName ? ` (${researchData.ownerName})` : '';
          ownershipLabel = `${genPart}family-owned${ownerPart}`;
        } else if (researchData.ownershipType === 'franchise') {
          ownershipLabel = 'Franchise';
        } else {
          ownershipLabel = 'Independent';
        }

        updates.company_profile = {
          ...getDefaultProfile(),
          ...updates.company_profile,
          ownership: createSourcedField(ownershipLabel, 'serper_research', null),
        };
        console.log(`[CollectorV2] Set ownership type: ${ownershipLabel}`);
      }

      // Add owner to key_people if found and not already present
      if (researchData?.ownerName) {
        const existingPeople = updates.key_people || [];
        const ownerName = researchData.ownerName;
        const ownerExists = existingPeople.some(p =>
          p.name.toLowerCase() === ownerName.toLowerCase()
        );

        if (!ownerExists) {
          existingPeople.unshift({
            name: researchData.ownerName,
            title: researchData.ownerProfile?.title || 'Owner/CEO',
            email: null,
            phone: null,
            linkedinUrl: null,
            seniority: 'owner',
            department: 'executive',
            source: 'serper_research',
            sourceUrl: researchData.ownerProfile?.sourceUrl || null,
            photoUrl: null,
            isDecisionMaker: true,
          });
          updates.key_people = existingPeople;
          console.log(`[CollectorV2] Added owner to key_people: ${researchData.ownerName}`);
        }
      }

      // Add PCT Top 100 to awards if detected
      if (researchData.isPctTop100) {
        const existingAwards = updates.services?.awards?.value || [];
        const hasPctAward = existingAwards.some((a: string) => /pct.*top.*100/i.test(a));

        if (!hasPctAward) {
          const pctAwardName = researchData.pctTop100Rank
            ? `PCT Top 100 #${researchData.pctTop100Rank}`
            : 'PCT Top 100';
          existingAwards.push(pctAwardName);
          updates.services = {
            ...getDefaultServices(),
            ...updates.services,
            awards: createSourcedField(existingAwards, 'serper_research', null),
          };
          console.log(`[CollectorV2] Added PCT Top 100 to awards`);
        }
      }

      // Add executives from research to key_people
      if (researchData.executiveProfiles?.length) {
        const existingPeople = updates.key_people || [];
        for (const exec of researchData.executiveProfiles) {
          const exists = existingPeople.some(p =>
            p.name.toLowerCase() === exec.name.toLowerCase()
          );
          if (!exists && exec.title) {
            existingPeople.push({
              name: exec.name,
              title: exec.title,
              email: null,
              phone: null,
              linkedinUrl: null,
              seniority: exec.title.toLowerCase().includes('ceo') || exec.title.toLowerCase().includes('owner') ? 'owner' : 'executive',
              department: 'executive',
              source: 'serper_research',
              sourceUrl: exec.sourceUrl || null,
              photoUrl: null,
              isDecisionMaker: /ceo|owner|president|coo|cfo|cto|vp/i.test(exec.title),
            });
            console.log(`[CollectorV2] Added executive: ${exec.name} (${exec.title})`);
          }
        }
        updates.key_people = existingPeople;
      }

      // Add detected technologies to technology stack
      if (researchData.detectedTechnologies?.length) {
        const existingTech: string[] = updates.technology?.detected_technologies?.value || [];
        for (const tech of researchData.detectedTechnologies) {
          const techName = tech.name;
          if (!existingTech.includes(techName)) {
            existingTech.push(techName);
            console.log(`[CollectorV2] Added technology: ${techName}`);

            // If it's a CRM, also set the crm_system field
            if (/fieldroutes|servicetitan|pestroutes|pestpac|workwave/i.test(techName)) {
              updates.technology = {
                ...getDefaultTechnology(),
                ...updates.technology,
                crm_system: createSourcedField(techName, 'serper_research', tech.sourceUrl),
                detected_technologies: createSourcedField(existingTech, 'serper_research', null),
              };
            }
          }
        }
        if (!updates.technology?.crm_system?.value && existingTech.length > 0) {
          updates.technology = {
            ...getDefaultTechnology(),
            ...updates.technology,
            detected_technologies: createSourcedField(existingTech, 'serper_research', null),
          };
        }
      }

      // Add M&A activity to awards (as a workaround since recent_acquisitions field doesn't exist)
      if (researchData.mnActivity?.length) {
        const acquisitions = researchData.mnActivity
          .filter(m => m.type === 'acquisition')
          .map(m => `Acquired: ${m.parties.join(', ') || 'company'}`);
        if (acquisitions.length > 0) {
          console.log(`[CollectorV2] Found ${acquisitions.length} acquisitions: ${acquisitions.join(', ')}`);
          // Add to notes/description since there's no dedicated field
        }
      }

      // Store key quotes in the research data (logged for now)
      if (researchData.keyQuotes?.length) {
        console.log(`[CollectorV2] Found ${researchData.keyQuotes.length} key quotes`);
        researchData.keyQuotes.forEach(q => console.log(`  Quote: "${q.substring(0, 100)}..."`));
      }

      await logCollection(supabase, intelligenceId, 'serper_research', true, serperResult);
    }
  } catch (error) {
    console.error('[CollectorV2] Serper research error:', error);
    errors.push({
      source: 'serper_research',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    await logCollection(supabase, intelligenceId, 'serper_research', false, null, error);
  }

  // ============================================
  // REVENUE SANITY CHECK
  // ============================================
  // Adjust revenue estimate upward if company indicators suggest higher revenue
  const reportedRevenue = updates.financial?.estimated_revenue?.value || 0;
  const employeeCount = updates.company_profile?.employee_count?.value || 0;
  const locationCount = updates.company_profile?.locations_count?.value || 1;
  const awards = updates.services?.awards?.value || [];

  let minimumRevenue = 0;
  const revenueAdjustmentReasons: string[] = [];

  // PCT Top 100 = minimum $10M
  // Match "PCT Top 100", "Pest Control Technology Top 100", or similar variations
  const hasPctTop100 = awards.some((a: string) =>
    /pct.*top.*100|top.*100.*pct|pest.*control.*tech.*top.*100|top.*100.*pest.*control/i.test(a)
  );
  if (hasPctTop100) {
    minimumRevenue = Math.max(minimumRevenue, 10_000_000);
    revenueAdjustmentReasons.push('PCT Top 100');
  }

  // Inc 5000 / Fast Growing = minimum $5M
  const hasIncOrFastGrowing = awards.some((a: string) => /inc.*5000|fast.*50|fastest.*growing/i.test(a));
  if (hasIncOrFastGrowing) {
    minimumRevenue = Math.max(minimumRevenue, 5_000_000);
    revenueAdjustmentReasons.push('Inc 5000/Fast Growing');
  }

  // 50+ employees = minimum $3M (approx $60K revenue per employee)
  if (employeeCount >= 50) {
    const employeeBasedMin = employeeCount * 60_000;
    if (employeeBasedMin > minimumRevenue) {
      minimumRevenue = employeeBasedMin;
      revenueAdjustmentReasons.push(`${employeeCount} employees`);
    }
  }

  // 20+ locations = minimum $5M
  if (locationCount >= 20) {
    if (5_000_000 > minimumRevenue) {
      minimumRevenue = 5_000_000;
      revenueAdjustmentReasons.push(`${locationCount} locations`);
    }
  }

  // If reported revenue is below calculated minimum, adjust it
  if (reportedRevenue > 0 && reportedRevenue < minimumRevenue) {
    console.log(`[CollectorV2] Revenue sanity check: Adjusting from $${(reportedRevenue / 1_000_000).toFixed(1)}M to $${(minimumRevenue / 1_000_000).toFixed(1)}M based on: ${revenueAdjustmentReasons.join(', ')}`);

    updates.financial = {
      ...getDefaultFinancial(),
      ...updates.financial,
      estimated_revenue: createSourcedField(
        minimumRevenue,
        'adjusted',
        null,
        'medium'  // Medium confidence since it's an adjustment
      ),
    };
  }

  // ============================================
  // FINALIZE AND SAVE
  // ============================================

  // Set final status
  updates.collection_status = errors.length === 0 ? 'complete' : 'partial';
  updates.collection_errors = errors;

  // Calculate completeness score
  updates.completeness_score = calculateCompleteness(updates as CompanyIntelligence);

  // Save to database
  const { error: saveError } = await supabase
    .from('company_intelligence')
    .update(updates)
    .eq('id', intelligenceId);

  if (saveError) {
    console.error('[CollectorV2] Save error:', saveError);
    errors.push({
      source: 'save',
      error: saveError.message,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // CLASSIFICATION AND REPORT GENERATION
  // ============================================
  let classification: CompanyTypeClassification | null = null;
  let salesReport: SalesReport | null = null;

  // Fetch the updated intelligence record for classification
  const { data: finalIntelligence } = await supabase
    .from('company_intelligence')
    .select('*')
    .eq('id', intelligenceId)
    .single();

  if (finalIntelligence) {
    try {
      console.log('[CollectorV2] Classifying company type...');
      classification = companyTypeClassifier.classify(
        finalIntelligence as CompanyIntelligence,
        researchData || undefined
      );
      console.log(`[CollectorV2] Classification: ${classification.type} (${classification.confidence} confidence)`);

      // Generate sales report
      console.log('[CollectorV2] Generating sales report...');
      salesReport = salesReportGenerator.generate({
        companyName,
        intelligence: finalIntelligence as CompanyIntelligence,
        research: researchData,
        classification,
      });
      console.log(`[CollectorV2] Sales report generated. Data quality: ${salesReport.dataQualityScore}%`);
    } catch (classError) {
      console.error('[CollectorV2] Classification/report error:', classError);
      // Non-fatal, continue
    }
  }

  console.log(`[CollectorV2] Collection complete. Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    errors,
    research: researchData,
    classification,
    salesReport,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logCollection(
  supabase: ReturnType<typeof createAdminClient>,
  intelligenceId: string,
  sourceType: string,
  success: boolean,
  result: unknown,
  error?: unknown
) {
  try {
    await supabase.from('intelligence_collection_log').insert({
      intelligence_id: intelligenceId,
      source_type: sourceType,
      success,
      error_message: error instanceof Error ? error.message : null,
      raw_data: result,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[CollectorV2] Log error:', e);
  }
}

function calculateCompleteness(intel: Partial<CompanyIntelligence>): number {
  const profileFields = ['founded_year', 'employee_count', 'headquarters', 'company_type'];
  const presenceFields = ['website_url', 'linkedin_url', 'facebook_url'];
  const reviewFields = ['google_rating', 'google_review_count'];

  let totalFields = 0;
  let filledFields = 0;

  // Check company profile
  for (const field of profileFields) {
    totalFields++;
    const profile = intel.company_profile as unknown as Record<string, { value: unknown }> | undefined;
    const val = profile?.[field]?.value;
    if (val !== null && val !== undefined && val !== '') {
      filledFields++;
    }
  }

  // Check online presence
  for (const field of presenceFields) {
    totalFields++;
    const presence = intel.online_presence as unknown as Record<string, { value: unknown }> | undefined;
    const val = presence?.[field]?.value;
    if (val !== null && val !== undefined && val !== '') {
      filledFields++;
    }
  }

  // Check reviews
  for (const field of reviewFields) {
    totalFields++;
    const reviews = intel.reviews as unknown as Record<string, { value: unknown }> | undefined;
    const val = reviews?.[field]?.value;
    if (val !== null && val !== undefined && val !== '') {
      filledFields++;
    }
  }

  if (totalFields === 0) return 0;
  return Math.round((filledFields / totalFields) * 100);
}

// Default structures - using type assertions to avoid TypeScript inference issues
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

function getDefaultServices(): ServicesData {
  return {
    primary_services: createSourcedField<string[]>([], null, null),
    service_areas: createSourcedField<string[]>([], null, null),
    certifications: createSourcedField<string[]>([], null, null),
    awards: createSourcedField<string[]>([], null, null),
    specializations: createSourcedField<string[]>([], null, null),
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
