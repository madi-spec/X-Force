/**
 * Website Marketing Signals Collector
 * Detects marketing sophistication on company websites
 * Includes: email marketing, conversion elements, trust signals, urgency, technical markers
 */

import * as cheerio from 'cheerio';
import { BaseCollector } from './base';
import type { CollectorOptions, CollectorResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface WebsiteMarketingSignals {
  // Email marketing
  email: {
    hasNewsletterSignup: boolean;
    signupLocations: string[];
    hasLeadMagnet: boolean;
    leadMagnetType: string | null;
    leadMagnetTitle: string | null;
    detectedPlatform: string | null;
    hasPopup: boolean;
    popupTrigger: string | null;
    hasExitIntent: boolean;
  };

  // Conversion elements
  conversion: {
    hasLiveChat: boolean;
    liveChatProvider: string | null;
    hasChatbot: boolean;
    chatbotProvider: string | null;
    hasCallTracking: boolean;
    callTrackingProvider: string | null;
    formCount: number;
    hasMultiStepForm: boolean;
    hasInstantQuote: boolean;
    hasSchedulingWidget: boolean;
    schedulingProvider: string | null;
  };

  // Trust elements
  trust: {
    hasTrustBadges: boolean;
    trustBadges: string[];
    hasTestimonials: boolean;
    testimonialCount: number;
    hasVideoTestimonials: boolean;
    hasCaseStudies: boolean;
    hasBeforeAfter: boolean;
    showsReviewCount: boolean;
    reviewCountDisplayed: number;
    showsYearsInBusiness: boolean;
    yearsInBusinessDisplayed: number;
    showsCustomerCount: boolean;
    customerCountDisplayed: string | null;
  };

  // Urgency elements
  urgency: {
    hasLimitedOffer: boolean;
    hasCountdownTimer: boolean;
    hasSeasonalPromo: boolean;
    currentPromo: string | null;
  };

  // Technical
  technical: {
    hasVideoOnHomepage: boolean;
    pageLoadSpeed: number | null;
    mobileOptimized: boolean;
    hasSitemap: boolean;
    hasStructuredData: boolean;
    trackingPixels: string[];
  };

  sophisticationScore: number;
}

// ============================================
// DETECTION PATTERNS
// ============================================

const CHAT_PROVIDERS = [
  { pattern: /intercom/i, name: 'Intercom' },
  { pattern: /drift/i, name: 'Drift' },
  { pattern: /zendesk/i, name: 'Zendesk' },
  { pattern: /livechat/i, name: 'LiveChat' },
  { pattern: /tawk\.to|tawk/i, name: 'Tawk.to' },
  { pattern: /crisp\.chat|crisp/i, name: 'Crisp' },
  { pattern: /hubspot/i, name: 'HubSpot Chat' },
  { pattern: /freshchat|freshdesk/i, name: 'Freshchat' },
  { pattern: /olark/i, name: 'Olark' },
  { pattern: /tidio/i, name: 'Tidio' },
  { pattern: /purechat/i, name: 'Pure Chat' },
];

const CALL_TRACKING_PROVIDERS = [
  // Call tracking
  { pattern: /callrail/i, name: 'CallRail' },
  { pattern: /calltrackingmetrics/i, name: 'CallTrackingMetrics' },
  { pattern: /dialogtech|invoca/i, name: 'Invoca' },
  { pattern: /marchex/i, name: 'Marchex' },
  { pattern: /whatconverts/i, name: 'WhatConverts' },
  { pattern: /phonexa/i, name: 'Phonexa' },
  // Phone systems / VoIP
  { pattern: /ringcentral/i, name: 'RingCentral' },
  { pattern: /vonage/i, name: 'Vonage' },
  { pattern: /dialpad/i, name: 'Dialpad' },
  { pattern: /nextiva/i, name: 'Nextiva' },
  { pattern: /8x8/i, name: '8x8' },
  { pattern: /grasshopper/i, name: 'Grasshopper' },
  { pattern: /aircall/i, name: 'Aircall' },
  { pattern: /zoom\s*phone/i, name: 'Zoom Phone' },
  { pattern: /twilio/i, name: 'Twilio' },
];

const SCHEDULING_PROVIDERS = [
  // General scheduling
  { pattern: /calendly/i, name: 'Calendly' },
  { pattern: /acuity/i, name: 'Acuity' },
  // Field service / Pest control CRMs
  { pattern: /housecall\s*pro/i, name: 'Housecall Pro' },
  { pattern: /jobber/i, name: 'Jobber' },
  { pattern: /servicetitan/i, name: 'ServiceTitan' },
  { pattern: /pestroutes/i, name: 'PestRoutes' },
  { pattern: /fieldroutes/i, name: 'FieldRoutes' },
  { pattern: /pestpac/i, name: 'PestPac' },
  { pattern: /briostack/i, name: 'Briostack' },
  { pattern: /workwave/i, name: 'WorkWave' },
  { pattern: /pocomos/i, name: 'Pocomos' },
  { pattern: /gorilla\s*desk/i, name: 'GorillaDesk' },
  { pattern: /servicesuite/i, name: 'ServiceSuite' },
  { pattern: /real\s*green/i, name: 'Real Green' },
  { pattern: /service\s*autopilot/i, name: 'Service Autopilot' },
  { pattern: /paycor/i, name: 'Paycor' },
  { pattern: /coalmarch/i, name: 'Coalmarch' },
  // HVAC/Plumbing
  { pattern: /service\s*fusion/i, name: 'Service Fusion' },
  { pattern: /successware/i, name: 'SuccessWare' },
  { pattern: /fieldedge/i, name: 'FieldEdge' },
];

const EMAIL_PLATFORMS = [
  { pattern: /mailchimp/i, name: 'Mailchimp' },
  { pattern: /constant\s*contact/i, name: 'Constant Contact' },
  { pattern: /hubspot/i, name: 'HubSpot' },
  { pattern: /klaviyo/i, name: 'Klaviyo' },
  { pattern: /sendgrid/i, name: 'SendGrid' },
  { pattern: /mailerlite/i, name: 'MailerLite' },
  { pattern: /convertkit/i, name: 'ConvertKit' },
  { pattern: /activecampaign/i, name: 'ActiveCampaign' },
  { pattern: /drip\.com/i, name: 'Drip' },
  { pattern: /aweber/i, name: 'AWeber' },
];

const TRUST_BADGE_PATTERNS = [
  { pattern: /bbb|better\s*business/i, name: 'BBB' },
  { pattern: /home\s*advisor/i, name: 'HomeAdvisor' },
  { pattern: /angi|angie.?s\s*list/i, name: 'Angi' },
  { pattern: /quality\s*pro/i, name: 'QualityPro' },
  { pattern: /green\s*pro/i, name: 'GreenPro' },
  { pattern: /npma/i, name: 'NPMA' },
  { pattern: /thumbtack/i, name: 'Thumbtack' },
  { pattern: /google\s*guaranteed/i, name: 'Google Guaranteed' },
  { pattern: /yelp/i, name: 'Yelp' },
  { pattern: /trustpilot/i, name: 'Trustpilot' },
];

const TRACKING_PIXEL_PATTERNS = [
  { pattern: /fbq\(|facebook\.com\/tr/i, name: 'Facebook Pixel' },
  { pattern: /gtag\(|google-analytics|googletagmanager/i, name: 'Google Analytics' },
  { pattern: /ads\.google\.com|googleads/i, name: 'Google Ads' },
  { pattern: /bing\.com\/bat/i, name: 'Bing Ads' },
  { pattern: /linkedin\.com\/px|linkedin insight/i, name: 'LinkedIn Pixel' },
  { pattern: /snap\.licdn|snapchat/i, name: 'Snapchat Pixel' },
  { pattern: /tiktok\.com\/i18n/i, name: 'TikTok Pixel' },
  { pattern: /hotjar/i, name: 'Hotjar' },
  { pattern: /clarity\.ms/i, name: 'Microsoft Clarity' },
  { pattern: /fullstory/i, name: 'FullStory' },
];

// ============================================
// WEBSITE MARKETING COLLECTOR
// ============================================

export class WebsiteMarketingCollector extends BaseCollector<
  WebsiteMarketingSignals,
  CollectorOptions
> {
  readonly sourceType = 'website_marketing' as const;
  readonly displayName = 'Website Marketing Signals';

  /**
   * Main collection method
   */
  async collect(
    _companyName: string,
    domain: string | null,
    options: CollectorOptions = {}
  ): Promise<CollectorResult<WebsiteMarketingSignals>> {
    const startTime = Date.now();

    if (!domain) {
      return this.errorResult('Domain required for website marketing analysis', Date.now() - startTime);
    }

    try {
      const websiteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const data = await this.withRetry(
        async () => this.collectWebsiteMarketingSignals(websiteUrl),
        options.maxRetries || 2
      );

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[WebsiteMarketingCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: WebsiteMarketingSignals): number {
    if (!data) return 0;
    return data.sophisticationScore;
  }

  /**
   * Main collection logic
   */
  private async collectWebsiteMarketingSignals(
    websiteUrl: string
  ): Promise<WebsiteMarketingSignals> {
    console.log('[WebsiteMarketingCollector] Analyzing:', websiteUrl);

    try {
      const response = await fetch(websiteUrl, { signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      const $ = cheerio.load(html);

      // Collect all signals
      const email = this.detectEmailMarketing($, html);
      const conversion = this.detectConversionElements($, html);
      const trust = this.detectTrustElements($, html);
      const urgency = this.detectUrgencyElements($, html);
      const technical = this.detectTechnicalElements($, html);

      const sophisticationScore = this.calculateSophisticationScore({
        email,
        conversion,
        trust,
        urgency,
        technical,
      });

      return {
        email,
        conversion,
        trust,
        urgency,
        technical,
        sophisticationScore,
      };
    } catch (e) {
      console.error('[WebsiteMarketingCollector] Fetch error:', e);
      return this.emptySignals();
    }
  }

  /**
   * Detect email marketing elements
   */
  private detectEmailMarketing(
    $: cheerio.CheerioAPI,
    html: string
  ): WebsiteMarketingSignals['email'] {
    // Detect newsletter signup
    const hasNewsletterSignup =
      $(
        'input[type="email"], ' +
          'form[class*="newsletter"], ' +
          'form[class*="subscribe"], ' +
          'form[class*="signup"], ' +
          'form[class*="email"], ' +
          '[class*="newsletter-form"], ' +
          '[class*="email-signup"]'
      ).length > 0;

    // Find signup locations
    const signupLocations: string[] = [];
    if ($('footer input[type="email"], footer [class*="newsletter"]').length > 0) {
      signupLocations.push('footer');
    }
    if ($('header input[type="email"], header [class*="newsletter"]').length > 0) {
      signupLocations.push('header');
    }
    if ($('.sidebar input[type="email"], aside input[type="email"]').length > 0) {
      signupLocations.push('sidebar');
    }

    // Detect lead magnet
    const leadMagnetPatterns = [
      { pattern: /free\s*(guide|ebook|checklist|download|report|whitepaper)/i, type: 'guide' },
      {
        pattern: /download\s*(our|the|a|your)?\s*(free)?\s*(guide|ebook|checklist)/i,
        type: 'download',
      },
      { pattern: /get\s*(your|a|the)?\s*(free)?\s*(quote|estimate|inspection)/i, type: 'quote' },
      { pattern: /(coupon|discount|offer|deal|savings)/i, type: 'coupon' },
    ];

    let hasLeadMagnet = false;
    let leadMagnetType: string | null = null;
    const pageText = $('body').text();

    for (const { pattern, type } of leadMagnetPatterns) {
      if (pattern.test(pageText)) {
        hasLeadMagnet = true;
        leadMagnetType = type;
        break;
      }
    }

    // Detect email platform
    let detectedPlatform: string | null = null;
    for (const { pattern, name } of EMAIL_PLATFORMS) {
      if (pattern.test(html)) {
        detectedPlatform = name;
        break;
      }
    }

    // Detect popup
    const hasPopup =
      /popup|modal|lightbox|overlay/i.test(html) && /email|subscribe|newsletter|signup/i.test(html);
    const hasExitIntent = /exit.?intent|mouseleave|beforeunload/i.test(html);

    return {
      hasNewsletterSignup,
      signupLocations,
      hasLeadMagnet,
      leadMagnetType,
      leadMagnetTitle: null,
      detectedPlatform,
      hasPopup,
      popupTrigger: hasExitIntent ? 'exit_intent' : hasPopup ? 'unknown' : null,
      hasExitIntent,
    };
  }

  /**
   * Detect conversion elements
   */
  private detectConversionElements(
    $: cheerio.CheerioAPI,
    html: string
  ): WebsiteMarketingSignals['conversion'] {
    // Live chat detection
    let hasLiveChat = false;
    let liveChatProvider: string | null = null;

    for (const { pattern, name } of CHAT_PROVIDERS) {
      if (pattern.test(html)) {
        hasLiveChat = true;
        liveChatProvider = name;
        break;
      }
    }

    // Call tracking detection
    let hasCallTracking = false;
    let callTrackingProvider: string | null = null;

    for (const { pattern, name } of CALL_TRACKING_PROVIDERS) {
      if (pattern.test(html)) {
        hasCallTracking = true;
        callTrackingProvider = name;
        break;
      }
    }

    // Scheduling widget detection
    let hasSchedulingWidget = false;
    let schedulingProvider: string | null = null;

    for (const { pattern, name } of SCHEDULING_PROVIDERS) {
      if (pattern.test(html)) {
        hasSchedulingWidget = true;
        schedulingProvider = name;
        break;
      }
    }

    // Form counting
    const formCount = $('form').length;
    const hasMultiStepForm = /step|wizard|multi.?step|progress/i.test(html) && formCount > 0;
    const hasInstantQuote = /instant.?quote|get.?quote.?now|quick.?quote/i.test($('body').text());

    return {
      hasLiveChat,
      liveChatProvider,
      hasChatbot: /chatbot|bot|automated/i.test(html) && hasLiveChat,
      chatbotProvider: null,
      hasCallTracking,
      callTrackingProvider,
      formCount,
      hasMultiStepForm,
      hasInstantQuote,
      hasSchedulingWidget,
      schedulingProvider,
    };
  }

  /**
   * Detect trust elements
   */
  private detectTrustElements(
    $: cheerio.CheerioAPI,
    html: string
  ): WebsiteMarketingSignals['trust'] {
    const bodyText = $('body').text();

    // Trust badges
    const trustBadges: string[] = [];
    for (const { pattern, name } of TRUST_BADGE_PATTERNS) {
      if (pattern.test(html)) {
        trustBadges.push(name);
      }
    }

    // Review count displayed
    let showsReviewCount = false;
    let reviewCountDisplayed = 0;
    const reviewCountMatch = bodyText.match(/(\d{2,})\+?\s*(reviews?|ratings?|customers?)/i);
    if (reviewCountMatch) {
      showsReviewCount = true;
      reviewCountDisplayed = parseInt(reviewCountMatch[1]);
    }

    // Years in business
    let showsYearsInBusiness = false;
    let yearsInBusinessDisplayed = 0;
    const yearsMatch = bodyText.match(
      /(\d{1,3})\+?\s*years?\s*(in\s*business|of\s*experience|serving)/i
    );
    if (yearsMatch) {
      showsYearsInBusiness = true;
      yearsInBusinessDisplayed = parseInt(yearsMatch[1]);
    }

    // Customer count
    let showsCustomerCount = false;
    let customerCountDisplayed: string | null = null;
    const customerMatch = bodyText.match(/([\d,]+)\+?\s*(customers?|homes?|families|clients)/i);
    if (customerMatch) {
      showsCustomerCount = true;
      customerCountDisplayed = customerMatch[1];
    }

    // Testimonials
    const hasTestimonials =
      $(
        '[class*="testimonial"], ' +
          '[class*="review"], ' +
          '[class*="customer-quote"], ' +
          'blockquote'
      ).length > 0;

    const testimonialCount = $(
      '[class*="testimonial"], ' + '[class*="review-item"], ' + '[class*="customer-quote"]'
    ).length;

    return {
      hasTrustBadges: trustBadges.length > 0,
      trustBadges,
      hasTestimonials,
      testimonialCount,
      hasVideoTestimonials:
        /video.?testimonial|youtube|vimeo/i.test(html) && hasTestimonials,
      hasCaseStudies: /case.?stud(y|ies)/i.test(bodyText),
      hasBeforeAfter: /before.?(&|and)?.?after/i.test(bodyText),
      showsReviewCount,
      reviewCountDisplayed,
      showsYearsInBusiness,
      yearsInBusinessDisplayed,
      showsCustomerCount,
      customerCountDisplayed,
    };
  }

  /**
   * Detect urgency elements
   */
  private detectUrgencyElements(
    $: cheerio.CheerioAPI,
    html: string
  ): WebsiteMarketingSignals['urgency'] {
    const bodyText = $('body').text();

    return {
      hasLimitedOffer: /limited\s*time|today\s*only|act\s*now|don.?t\s*miss/i.test(bodyText),
      hasCountdownTimer: /countdown|timer/i.test(html),
      hasSeasonalPromo:
        /spring|summer|fall|winter|holiday|seasonal/i.test(bodyText) &&
        /special|discount|offer|sale/i.test(bodyText),
      currentPromo: this.extractCurrentPromo(bodyText),
    };
  }

  /**
   * Extract current promo from text
   */
  private extractCurrentPromo(text: string): string | null {
    const promoPatterns = [
      /\$\d+\s*off/i,
      /\d+%\s*off/i,
      /free\s*(inspection|quote|estimate)/i,
      /save\s*\$?\d+/i,
    ];

    for (const pattern of promoPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Detect technical elements
   */
  private detectTechnicalElements(
    $: cheerio.CheerioAPI,
    html: string
  ): WebsiteMarketingSignals['technical'] {
    // Video on homepage
    const hasVideoOnHomepage =
      $(
        'video, ' +
          'iframe[src*="youtube"], ' +
          'iframe[src*="vimeo"], ' +
          '[class*="video-player"], ' +
          '[class*="hero-video"]'
      ).length > 0;

    // Tracking pixels from HTML patterns
    const trackingPixels: string[] = [];
    for (const { pattern, name } of TRACKING_PIXEL_PATTERNS) {
      if (pattern.test(html)) {
        trackingPixels.push(name);
      }
    }

    // Additional technology detection from script sources
    const scriptSources: string[] = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) scriptSources.push(src.toLowerCase());
    });

    // Check script sources for additional technologies
    const scriptTechPatterns = [
      { pattern: /servicetitan/i, name: 'ServiceTitan' },
      { pattern: /pestpac/i, name: 'PestPac' },
      { pattern: /pestroutes|fieldroutes/i, name: 'PestRoutes/FieldRoutes' },
      { pattern: /workwave/i, name: 'WorkWave' },
      { pattern: /briostack/i, name: 'Briostack' },
      { pattern: /callrail/i, name: 'CallRail' },
      { pattern: /ringcentral/i, name: 'RingCentral' },
      { pattern: /intercom/i, name: 'Intercom' },
      { pattern: /drift/i, name: 'Drift' },
      { pattern: /hubspot/i, name: 'HubSpot' },
      { pattern: /salesforce/i, name: 'Salesforce' },
      { pattern: /zendesk/i, name: 'Zendesk' },
      { pattern: /wordpress|wp-content/i, name: 'WordPress' },
      { pattern: /shopify/i, name: 'Shopify' },
      { pattern: /squarespace/i, name: 'Squarespace' },
      { pattern: /wix/i, name: 'Wix' },
      { pattern: /webflow/i, name: 'Webflow' },
      { pattern: /cloudflare/i, name: 'Cloudflare' },
      { pattern: /recaptcha|grecaptcha/i, name: 'reCAPTCHA' },
      { pattern: /stripe/i, name: 'Stripe' },
      { pattern: /paypal/i, name: 'PayPal' },
      { pattern: /square\.com/i, name: 'Square' },
    ];

    for (const src of scriptSources) {
      for (const { pattern, name } of scriptTechPatterns) {
        if (pattern.test(src) && !trackingPixels.includes(name)) {
          trackingPixels.push(name);
        }
      }
    }

    // Also check meta tags for generator info
    const generator = $('meta[name="generator"]').attr('content');
    if (generator) {
      if (/wordpress/i.test(generator) && !trackingPixels.includes('WordPress')) {
        trackingPixels.push('WordPress');
      }
      if (/wix/i.test(generator) && !trackingPixels.includes('Wix')) {
        trackingPixels.push('Wix');
      }
      if (/squarespace/i.test(generator) && !trackingPixels.includes('Squarespace')) {
        trackingPixels.push('Squarespace');
      }
    }

    // Mobile optimization
    const mobileOptimized = $('meta[name="viewport"]').length > 0;

    // Structured data
    const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

    return {
      hasVideoOnHomepage,
      pageLoadSpeed: null, // Would need actual performance testing
      mobileOptimized,
      hasSitemap: false, // Would need to check /sitemap.xml
      hasStructuredData,
      trackingPixels,
    };
  }

  /**
   * Calculate sophistication score
   */
  private calculateSophisticationScore(signals: {
    email: WebsiteMarketingSignals['email'];
    conversion: WebsiteMarketingSignals['conversion'];
    trust: WebsiteMarketingSignals['trust'];
    urgency: WebsiteMarketingSignals['urgency'];
    technical: WebsiteMarketingSignals['technical'];
  }): number {
    let score = 0;

    // Email marketing (max 15 points)
    if (signals.email.hasNewsletterSignup) score += 5;
    if (signals.email.hasLeadMagnet) score += 5;
    if (signals.email.detectedPlatform) score += 5;

    // Conversion elements (max 25 points)
    if (signals.conversion.hasLiveChat) score += 8;
    if (signals.conversion.hasCallTracking) score += 7;
    if (signals.conversion.hasSchedulingWidget) score += 5;
    if (signals.conversion.hasInstantQuote) score += 5;

    // Trust elements (max 25 points)
    score += Math.min(10, signals.trust.trustBadges.length * 2);
    if (signals.trust.hasTestimonials) score += 5;
    if (signals.trust.showsReviewCount) score += 5;
    if (signals.trust.showsYearsInBusiness) score += 5;

    // Urgency elements (max 10 points)
    if (signals.urgency.hasLimitedOffer) score += 5;
    if (signals.urgency.currentPromo) score += 5;

    // Technical (max 25 points)
    if (signals.technical.hasVideoOnHomepage) score += 5;
    if (signals.technical.mobileOptimized) score += 5;
    if (signals.technical.hasStructuredData) score += 5;
    score += Math.min(10, signals.technical.trackingPixels.length * 2);

    return Math.min(100, score);
  }

  /**
   * Empty signals for error cases
   */
  private emptySignals(): WebsiteMarketingSignals {
    return {
      email: {
        hasNewsletterSignup: false,
        signupLocations: [],
        hasLeadMagnet: false,
        leadMagnetType: null,
        leadMagnetTitle: null,
        detectedPlatform: null,
        hasPopup: false,
        popupTrigger: null,
        hasExitIntent: false,
      },
      conversion: {
        hasLiveChat: false,
        liveChatProvider: null,
        hasChatbot: false,
        chatbotProvider: null,
        hasCallTracking: false,
        callTrackingProvider: null,
        formCount: 0,
        hasMultiStepForm: false,
        hasInstantQuote: false,
        hasSchedulingWidget: false,
        schedulingProvider: null,
      },
      trust: {
        hasTrustBadges: false,
        trustBadges: [],
        hasTestimonials: false,
        testimonialCount: 0,
        hasVideoTestimonials: false,
        hasCaseStudies: false,
        hasBeforeAfter: false,
        showsReviewCount: false,
        reviewCountDisplayed: 0,
        showsYearsInBusiness: false,
        yearsInBusinessDisplayed: 0,
        showsCustomerCount: false,
        customerCountDisplayed: null,
      },
      urgency: {
        hasLimitedOffer: false,
        hasCountdownTimer: false,
        hasSeasonalPromo: false,
        currentPromo: null,
      },
      technical: {
        hasVideoOnHomepage: false,
        pageLoadSpeed: null,
        mobileOptimized: false,
        hasSitemap: false,
        hasStructuredData: false,
        trackingPixels: [],
      },
      sophisticationScore: 0,
    };
  }
}

// Export singleton
export const websiteMarketingCollector = new WebsiteMarketingCollector();
