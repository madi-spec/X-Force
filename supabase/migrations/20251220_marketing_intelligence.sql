-- ============================================
-- Enhanced Marketing Intelligence
-- Comprehensive marketing activity detection
-- ============================================

-- Add marketing score to main intelligence table
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS marketing_score INTEGER;

COMMENT ON COLUMN account_intelligence.marketing_score IS 'Overall marketing activity score 0-100';

-- ============================================
-- MARKETING INTELLIGENCE TABLE
-- Detailed marketing data for each company
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Collection metadata
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  collection_version INTEGER DEFAULT 1,

  -- Blog/Content Marketing
  blog_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {exists, url, platform, postCount, postsLast30Days, postsLast90Days,
  --          lastPostDate, lastPostTitle, categories, hasRssFeed, hasEmailCapture, topTopics}

  -- YouTube Channel
  youtube_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {exists, channelId, channelUrl, channelName, subscribers, totalViews, videoCount,
  --          videosLast30Days, videosLast90Days, lastUploadDate, lastUploadTitle, avgViewsPerVideo,
  --          topVideos, hasShorts}

  -- Google Business Profile
  gbp_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {claimed, placeId, postsLast30Days, postsLast90Days, lastPostDate, postTypes,
  --          photosTotal, ownerPhotos, customerPhotos, questionsAnswered, respondsToReviews,
  --          reviewResponseRate, attributes, services, activityScore}

  -- Facebook
  facebook_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {exists, pageUrl, pageName, followers, likes, postsLast30Days, postsLast90Days,
  --          lastPostDate, postTypes, avgEngagementRate, respondsToComments, hasMessenger,
  --          runningAds, adCount, hasShop, activityScore}

  -- Instagram
  instagram_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {exists, handle, profileUrl, followers, following, postsTotal, postsLast30Days,
  --          reelsLast30Days, lastPostDate, avgLikesPerPost, engagementRate, hasHighlights,
  --          usesReels, activityScore}

  -- LinkedIn Company Page
  linkedin_data JSONB DEFAULT '{}'::jsonb,
  -- Schema: {exists, pageUrl, followers, employeeCount, postsLast30Days, lastPostDate}

  -- Review Velocity across platforms
  review_velocity JSONB DEFAULT '{}'::jsonb,
  -- Schema: {google: {...}, facebook: {...}, yelp: {...}, bbb: {...},
  --          totalPlatforms, activePlatforms, combinedMonthlyReviews, combinedAvgRating,
  --          hasReviewManagement, reviewSoftware, velocityScore}

  -- Website Marketing Signals
  website_marketing JSONB DEFAULT '{}'::jsonb,
  -- Schema: {email: {...}, conversion: {...}, trust: {...}, urgency: {...},
  --          technical: {...}, sophisticationScore}

  -- Calculated Scores (0-100 each)
  scores JSONB DEFAULT '{}'::jsonb,
  -- Schema: {content, social, engagement, frequency, reach, sophistication,
  --          advertising, reviews, overall}

  -- AI Analysis
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  -- Schema: {summary, strengths, weaknesses, competitivePosition, recommendations, marketingMaturity}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_marketing_intel_company
  ON marketing_intelligence(company_id);

CREATE INDEX IF NOT EXISTS idx_marketing_intel_score
  ON marketing_intelligence((scores->>'overall'));

CREATE INDEX IF NOT EXISTS idx_marketing_intel_collected
  ON marketing_intelligence(collected_at DESC);

-- Comments for documentation
COMMENT ON TABLE marketing_intelligence IS 'Comprehensive marketing activity data for companies';
COMMENT ON COLUMN marketing_intelligence.blog_data IS 'Blog/content marketing detection and analysis';
COMMENT ON COLUMN marketing_intelligence.youtube_data IS 'YouTube channel presence and activity';
COMMENT ON COLUMN marketing_intelligence.gbp_data IS 'Google Business Profile activity (posts, photos, Q&A)';
COMMENT ON COLUMN marketing_intelligence.facebook_data IS 'Facebook page activity and ad presence';
COMMENT ON COLUMN marketing_intelligence.instagram_data IS 'Instagram profile activity';
COMMENT ON COLUMN marketing_intelligence.review_velocity IS 'Review growth rate across all platforms';
COMMENT ON COLUMN marketing_intelligence.website_marketing IS 'Website marketing sophistication signals';
COMMENT ON COLUMN marketing_intelligence.scores IS 'Calculated marketing scores by category';
COMMENT ON COLUMN marketing_intelligence.ai_analysis IS 'AI-generated marketing analysis and recommendations';

-- Enable RLS
ALTER TABLE marketing_intelligence ENABLE ROW LEVEL SECURITY;

-- RLS policy - allow all for authenticated users (same as other intelligence tables)
CREATE POLICY "Allow all for authenticated users" ON marketing_intelligence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
