-- AI Summary Prompts
-- Adds prompts for deal, company, and contact summaries to the ai_prompts table

-- 1. Deal Summary Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'deal_summary',
  'Deal Summary',
  'Generates AI-powered summaries for deals, including status analysis, stakeholder insights, risks, opportunities, and recommended actions.',
  E'Generate a comprehensive summary for this sales deal.

{{dealInfo}}

{{companyInfo}}

{{contactsInfo}}

{{activitiesInfo}}

{{tasksInfo}}

{{metricsInfo}}

---

Analyze this deal and provide a comprehensive JSON summary. Be specific and actionable. Reference actual data from the context. Don''t be generic.

Focus on:
- Current deal health and trajectory
- Key stakeholder relationships and sentiment
- Engagement patterns and communication frequency
- Risk factors that could derail the deal
- Opportunities to accelerate or expand the deal
- Concrete next steps with clear reasoning

Important guidelines:
- The headline should capture the deal''s current momentum and key challenge/opportunity
- The overview should tell the story of this deal - where it started, where it is, what''s needed to close
- Key points should be specific observations, not generic statements
- Risks should be based on actual signals (lack of engagement, missing stakeholders, stalled stage, etc.)
- Recommended actions should be specific and actionable with clear reasoning',
  E'{
  "headline": "One compelling sentence summarizing the deal''s current state and momentum",
  "overview": "2-3 paragraphs providing context on the deal, its history, current status, and what''s needed to close it",

  "currentStatus": {
    "stage": "Current stage name",
    "daysInStage": 0,
    "healthScore": 0-100,
    "trend": "improving|stable|declining"
  },

  "keyPoints": [
    {"point": "Important observation about the deal", "importance": "high|medium|low"}
  ],

  "stakeholderStatus": {
    "totalContacts": 0,
    "hasDecisionMaker": true|false,
    "hasChampion": true|false,
    "keyPlayers": [
      {"name": "Contact name", "role": "Their role", "sentiment": "positive|neutral|negative|unknown"}
    ]
  },

  "engagement": {
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "recentActivityCount": 0,
    "communicationPattern": "Description of how communication has been going"
  },

  "risks": ["List of risks or concerns about this deal"],

  "opportunities": ["List of opportunities or positive indicators"],

  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "reasoning": "Why this action is recommended"
    }
  ],

  "confidence": 0.0-1.0
}',
  E'Generate a comprehensive summary for this sales deal.

{{dealInfo}}

{{companyInfo}}

{{contactsInfo}}

{{activitiesInfo}}

{{tasksInfo}}

{{metricsInfo}}

---

Analyze this deal and provide a comprehensive JSON summary. Be specific and actionable. Reference actual data from the context. Don''t be generic.

Focus on:
- Current deal health and trajectory
- Key stakeholder relationships and sentiment
- Engagement patterns and communication frequency
- Risk factors that could derail the deal
- Opportunities to accelerate or expand the deal
- Concrete next steps with clear reasoning

Important guidelines:
- The headline should capture the deal''s current momentum and key challenge/opportunity
- The overview should tell the story of this deal - where it started, where it is, what''s needed to close
- Key points should be specific observations, not generic statements
- Risks should be based on actual signals (lack of engagement, missing stakeholders, stalled stage, etc.)
- Recommended actions should be specific and actionable with clear reasoning',
  E'{
  "headline": "One compelling sentence summarizing the deal''s current state and momentum",
  "overview": "2-3 paragraphs providing context on the deal, its history, current status, and what''s needed to close it",

  "currentStatus": {
    "stage": "Current stage name",
    "daysInStage": 0,
    "healthScore": 0-100,
    "trend": "improving|stable|declining"
  },

  "keyPoints": [
    {"point": "Important observation about the deal", "importance": "high|medium|low"}
  ],

  "stakeholderStatus": {
    "totalContacts": 0,
    "hasDecisionMaker": true|false,
    "hasChampion": true|false,
    "keyPlayers": [
      {"name": "Contact name", "role": "Their role", "sentiment": "positive|neutral|negative|unknown"}
    ]
  },

  "engagement": {
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "recentActivityCount": 0,
    "communicationPattern": "Description of how communication has been going"
  },

  "risks": ["List of risks or concerns about this deal"],

  "opportunities": ["List of opportunities or positive indicators"],

  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "reasoning": "Why this action is recommended"
    }
  ],

  "confidence": 0.0-1.0
}'
);

-- 2. Company Summary Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'company_summary',
  'Company Summary',
  'Generates AI-powered summaries for companies, including relationship status, product usage, engagement analysis, expansion opportunities, and churn risks.',
  E'Generate a comprehensive summary for this company.

{{companyInfo}}

{{productsInfo}}

{{contactsInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{activitiesInfo}}

---

Analyze this company and provide a comprehensive JSON summary. Be specific. Reference actual data. Focus on actionable insights.

Focus on:
- Overall relationship health and trajectory
- Product adoption and expansion opportunities
- Key contact relationships and engagement
- Revenue trends and growth potential
- Churn risk factors
- Strategic recommendations for account growth

Important guidelines:
- The headline should capture the essence of this customer/prospect relationship
- The overview should tell the story of this company - how they became a customer, their journey, current state
- Opportunities should be specific upsell/cross-sell possibilities based on their profile
- Risks should flag any concerning patterns (declining engagement, support issues, etc.)
- Recommended actions should be prioritized and specific',
  E'{
  "headline": "One compelling sentence summarizing the company relationship",
  "overview": "2-3 paragraphs about the company, relationship history, and current state",

  "profile": {
    "status": "cold_lead|prospect|customer|churned",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor",
    "industry": "pest|lawn|both",
    "size": "X agents",
    "crmPlatform": "Platform name or null",
    "isVoiceCustomer": true|false
  },

  "relationship": {
    "tenure": "X months/years or null",
    "currentProducts": ["List of active products"],
    "totalRevenue": annual revenue number or null,
    "healthStatus": "healthy|at_risk|churned|prospect"
  },

  "keyContacts": [
    {
      "name": "Contact name",
      "title": "Title or null",
      "role": "Role or null",
      "isPrimary": true|false
    }
  ],

  "dealsSummary": {
    "activeDeals": 0,
    "totalPipelineValue": 0,
    "closedWonValue": 0,
    "dealStages": {"stage_name": count}
  },

  "engagement": {
    "totalActivities": 0,
    "lastActivityDate": "ISO date or null",
    "activityTrend": "increasing|stable|decreasing",
    "primaryChannels": ["email", "meeting", "call"]
  },

  "opportunities": ["List expansion or upsell opportunities"],

  "risks": ["List any concerns or churn risks"],

  "recommendedActions": [
    {
      "action": "Specific next step",
      "priority": "high|medium|low",
      "reasoning": "Why this action"
    }
  ],

  "confidence": 0.0-1.0
}',
  E'Generate a comprehensive summary for this company.

{{companyInfo}}

{{productsInfo}}

{{contactsInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{activitiesInfo}}

---

Analyze this company and provide a comprehensive JSON summary. Be specific. Reference actual data. Focus on actionable insights.

Focus on:
- Overall relationship health and trajectory
- Product adoption and expansion opportunities
- Key contact relationships and engagement
- Revenue trends and growth potential
- Churn risk factors
- Strategic recommendations for account growth

Important guidelines:
- The headline should capture the essence of this customer/prospect relationship
- The overview should tell the story of this company - how they became a customer, their journey, current state
- Opportunities should be specific upsell/cross-sell possibilities based on their profile
- Risks should flag any concerning patterns (declining engagement, support issues, etc.)
- Recommended actions should be prioritized and specific',
  E'{
  "headline": "One compelling sentence summarizing the company relationship",
  "overview": "2-3 paragraphs about the company, relationship history, and current state",

  "profile": {
    "status": "cold_lead|prospect|customer|churned",
    "segment": "smb|mid_market|enterprise|pe_platform|franchisor",
    "industry": "pest|lawn|both",
    "size": "X agents",
    "crmPlatform": "Platform name or null",
    "isVoiceCustomer": true|false
  },

  "relationship": {
    "tenure": "X months/years or null",
    "currentProducts": ["List of active products"],
    "totalRevenue": annual revenue number or null,
    "healthStatus": "healthy|at_risk|churned|prospect"
  },

  "keyContacts": [
    {
      "name": "Contact name",
      "title": "Title or null",
      "role": "Role or null",
      "isPrimary": true|false
    }
  ],

  "dealsSummary": {
    "activeDeals": 0,
    "totalPipelineValue": 0,
    "closedWonValue": 0,
    "dealStages": {"stage_name": count}
  },

  "engagement": {
    "totalActivities": 0,
    "lastActivityDate": "ISO date or null",
    "activityTrend": "increasing|stable|decreasing",
    "primaryChannels": ["email", "meeting", "call"]
  },

  "opportunities": ["List expansion or upsell opportunities"],

  "risks": ["List any concerns or churn risks"],

  "recommendedActions": [
    {
      "action": "Specific next step",
      "priority": "high|medium|low",
      "reasoning": "Why this action"
    }
  ],

  "confidence": 0.0-1.0
}'
);

-- 3. Contact Summary Prompt
INSERT INTO ai_prompts (key, name, description, prompt_template, schema_template, default_prompt_template, default_schema_template) VALUES (
  'contact_summary',
  'Contact Summary',
  'Generates AI-powered summaries for contacts, including influence analysis, communication preferences, engagement patterns, and relationship building tips.',
  E'Generate a comprehensive summary for this contact person.

{{contactInfo}}

{{companyInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{communicationsInfo}}

---

Analyze this contact and provide a comprehensive JSON summary. Be specific. Infer from the communication patterns and content. Focus on actionable insights for sales.

Focus on:
- Role and influence in buying decisions
- Communication style and preferences
- Engagement level and responsiveness
- Key interests and pain points mentioned
- Relationship strength and sentiment
- Tips for building rapport

Important guidelines:
- The headline should capture this person''s role and relationship status
- The overview should describe who this person is, their importance, and engagement history
- Influence assessment should be based on actual signals (title, involvement in meetings, decision-making mentions)
- Pain points and interests should come from actual conversation content
- Relationship tips should be specific and actionable',
  E'{
  "headline": "One sentence capturing this person''s role and relationship status",
  "overview": "2-3 paragraphs about this contact, their role, engagement history, and relationship",

  "profile": {
    "name": "Full name",
    "title": "Job title or null",
    "role": "CRM role or null",
    "company": "Company name",
    "email": "Email or null",
    "phone": "Phone or null"
  },

  "influence": {
    "decisionMakingRole": "decision_maker|influencer|champion|end_user|blocker|unknown",
    "buyingInfluence": "high|medium|low",
    "sentiment": "positive|neutral|negative|unknown",
    "engagementLevel": "highly_engaged|engaged|passive|disengaged"
  },

  "communication": {
    "preferredChannel": "email|phone|meeting|unknown",
    "responsePattern": "Description of how they typically respond",
    "bestTimeToReach": "Inferred best time or null"
  },

  "engagement": {
    "totalInteractions": 0,
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "interactionTypes": {"type": count}
  },

  "keyInsights": [
    {"insight": "Important observation about this contact", "source": "Where this was learned"}
  ],

  "painPoints": ["Pain points this person has mentioned or shown"],

  "interests": ["Topics or areas they''ve shown interest in"],

  "relationshipTips": ["Tips for building relationship with this contact"],

  "confidence": 0.0-1.0
}',
  E'Generate a comprehensive summary for this contact person.

{{contactInfo}}

{{companyInfo}}

{{dealsInfo}}

{{engagementInfo}}

{{communicationsInfo}}

---

Analyze this contact and provide a comprehensive JSON summary. Be specific. Infer from the communication patterns and content. Focus on actionable insights for sales.

Focus on:
- Role and influence in buying decisions
- Communication style and preferences
- Engagement level and responsiveness
- Key interests and pain points mentioned
- Relationship strength and sentiment
- Tips for building rapport

Important guidelines:
- The headline should capture this person''s role and relationship status
- The overview should describe who this person is, their importance, and engagement history
- Influence assessment should be based on actual signals (title, involvement in meetings, decision-making mentions)
- Pain points and interests should come from actual conversation content
- Relationship tips should be specific and actionable',
  E'{
  "headline": "One sentence capturing this person''s role and relationship status",
  "overview": "2-3 paragraphs about this contact, their role, engagement history, and relationship",

  "profile": {
    "name": "Full name",
    "title": "Job title or null",
    "role": "CRM role or null",
    "company": "Company name",
    "email": "Email or null",
    "phone": "Phone or null"
  },

  "influence": {
    "decisionMakingRole": "decision_maker|influencer|champion|end_user|blocker|unknown",
    "buyingInfluence": "high|medium|low",
    "sentiment": "positive|neutral|negative|unknown",
    "engagementLevel": "highly_engaged|engaged|passive|disengaged"
  },

  "communication": {
    "preferredChannel": "email|phone|meeting|unknown",
    "responsePattern": "Description of how they typically respond",
    "bestTimeToReach": "Inferred best time or null"
  },

  "engagement": {
    "totalInteractions": 0,
    "lastContactDate": "ISO date or null",
    "daysSinceContact": 0,
    "interactionTypes": {"type": count}
  },

  "keyInsights": [
    {"insight": "Important observation about this contact", "source": "Where this was learned"}
  ],

  "painPoints": ["Pain points this person has mentioned or shown"],

  "interests": ["Topics or areas they''ve shown interest in"],

  "relationshipTips": ["Tips for building relationship with this contact"],

  "confidence": 0.0-1.0
}'
);
