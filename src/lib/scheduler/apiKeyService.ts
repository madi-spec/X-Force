/**
 * API Key Management Service
 *
 * Provides functionality for managing API keys including:
 * - Key generation and hashing
 * - Key validation and rate limiting
 * - Usage tracking and analytics
 */

import { createClient } from '@/lib/supabase/server';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ApiKeyPermissions {
  read: boolean;
  create_requests: boolean;
  update_requests: boolean;
  cancel_requests: boolean;
  manage_webhooks: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  key_prefix: string;
  permissions: ApiKeyPermissions;
  allowed_ips?: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  last_used_at?: string;
  last_used_ip?: string;
  total_requests: number;
  is_active: boolean;
  expires_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  secret_key: string; // Only returned once at creation
}

export interface ApiKeyUsage {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  ip_address?: string;
  user_agent?: string;
  status_code?: number;
  response_time_ms?: number;
  created_at: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  api_key_id?: string;
  requests_this_minute: number;
  requests_today: number;
  limit_per_minute: number;
  limit_per_day: number;
}

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  permissions?: Partial<ApiKeyPermissions>;
  allowed_ips?: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  expires_at?: string;
}

// ============================================================================
// Constants
// ============================================================================

const KEY_PREFIX = 'sk_live_';
const KEY_LENGTH = 32; // 32 bytes = 64 hex chars

const DEFAULT_PERMISSIONS: ApiKeyPermissions = {
  read: true,
  create_requests: true,
  update_requests: false,
  cancel_requests: false,
  manage_webhooks: false,
};

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new API key
 */
function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(KEY_LENGTH).toString('hex');
  const key = `${KEY_PREFIX}${randomPart}`;
  const prefix = key.substring(0, 8);
  const hash = hashApiKey(key);

  return { key, prefix, hash };
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// ============================================================================
// API Key CRUD Operations
// ============================================================================

/**
 * List all API keys (without secrets)
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_api_keys')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single API key by ID
 */
export async function getApiKey(id: string): Promise<ApiKey | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_api_keys')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

/**
 * Create a new API key
 * Returns the full key only once - it cannot be retrieved again
 */
export async function createApiKey(
  input: CreateApiKeyInput
): Promise<ApiKeyWithSecret> {
  const supabase = await createClient();
  const { key, prefix, hash } = generateApiKey();

  const permissions = {
    ...DEFAULT_PERMISSIONS,
    ...input.permissions,
  };

  const { data, error } = await supabase
    .from('scheduler_api_keys')
    .insert({
      name: input.name,
      description: input.description,
      key_prefix: prefix,
      key_hash: hash,
      permissions,
      allowed_ips: input.allowed_ips,
      rate_limit_per_minute: input.rate_limit_per_minute || 60,
      rate_limit_per_day: input.rate_limit_per_day || 10000,
      expires_at: input.expires_at,
      is_active: true,
      total_requests: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    secret_key: key,
  };
}

/**
 * Update an API key
 */
export async function updateApiKey(
  id: string,
  updates: Partial<Omit<ApiKey, 'id' | 'key_prefix' | 'created_at'>>
): Promise<ApiKey> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_api_keys')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string, reason?: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason || 'Manually revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_api_keys')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Key Validation & Rate Limiting
// ============================================================================

/**
 * Validate an API key and check rate limits
 */
export async function validateApiKey(
  apiKey: string,
  ipAddress?: string
): Promise<RateLimitCheck> {
  const supabase = await createClient();
  const keyHash = hashApiKey(apiKey);

  const { data, error } = await supabase.rpc('check_api_key_rate_limit', {
    p_key_hash: keyHash,
    p_ip_address: ipAddress,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      allowed: false,
      requests_this_minute: 0,
      requests_today: 0,
      limit_per_minute: 0,
      limit_per_day: 0,
    };
  }

  return data[0];
}

/**
 * Get API key by its hash
 */
export async function getApiKeyByHash(
  keyHash: string
): Promise<ApiKey | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

/**
 * Record API key usage
 */
export async function recordApiKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    statusCode?: number;
    responseTimeMs?: number;
  }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('record_api_key_usage', {
    p_api_key_id: apiKeyId,
    p_endpoint: endpoint,
    p_method: method,
    p_ip_address: options?.ipAddress,
    p_user_agent: options?.userAgent,
    p_status_code: options?.statusCode,
    p_response_time_ms: options?.responseTimeMs,
  });

  if (error) throw error;
}

// ============================================================================
// Usage Analytics
// ============================================================================

/**
 * Get usage history for an API key
 */
export async function getApiKeyUsage(
  apiKeyId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ usage: ApiKeyUsage[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_api_key_usage')
    .select('*', { count: 'exact' })
    .eq('api_key_id', apiKeyId)
    .order('created_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    usage: data || [],
    total: count || 0,
  };
}

/**
 * Get usage statistics for an API key
 */
export async function getApiKeyStats(
  apiKeyId: string,
  days: number = 7
): Promise<{
  totalRequests: number;
  requestsPerDay: { date: string; count: number }[];
  topEndpoints: { endpoint: string; count: number }[];
  avgResponseTime: number;
  errorRate: number;
}> {
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('scheduler_api_key_usage')
    .select('*')
    .eq('api_key_id', apiKeyId)
    .gte('created_at', startDate.toISOString());

  if (error) throw error;

  const usage = data || [];

  // Calculate stats
  const totalRequests = usage.length;

  // Requests per day
  const requestsByDay = new Map<string, number>();
  usage.forEach((u) => {
    const date = u.created_at.split('T')[0];
    requestsByDay.set(date, (requestsByDay.get(date) || 0) + 1);
  });
  const requestsPerDay = Array.from(requestsByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top endpoints
  const endpointCounts = new Map<string, number>();
  usage.forEach((u) => {
    endpointCounts.set(u.endpoint, (endpointCounts.get(u.endpoint) || 0) + 1);
  });
  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Average response time
  const responseTimes = usage
    .filter((u) => u.response_time_ms)
    .map((u) => u.response_time_ms);
  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  // Error rate
  const errors = usage.filter(
    (u) => u.status_code && u.status_code >= 400
  ).length;
  const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;

  return {
    totalRequests,
    requestsPerDay,
    topEndpoints,
    avgResponseTime: Math.round(avgResponseTime),
    errorRate: Math.round(errorRate * 100) / 100,
  };
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check X-API-Key header
  return request.headers.get('X-API-Key');
}

/**
 * Validate request with API key
 * Returns the API key record if valid, null if invalid
 */
export async function validateRequest(
  request: Request
): Promise<{ valid: boolean; key?: ApiKey; error?: string }> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return { valid: false, error: 'No API key provided' };
  }

  const keyHash = hashApiKey(apiKey);
  const keyRecord = await getApiKeyByHash(keyHash);

  if (!keyRecord) {
    return { valid: false, error: 'Invalid API key' };
  }

  if (!keyRecord.is_active) {
    return { valid: false, error: 'API key is inactive' };
  }

  if (keyRecord.revoked_at) {
    return { valid: false, error: 'API key has been revoked' };
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Check IP restrictions
  const ipAddress =
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    request.headers.get('X-Real-IP');

  if (
    keyRecord.allowed_ips &&
    keyRecord.allowed_ips.length > 0 &&
    ipAddress &&
    !keyRecord.allowed_ips.includes(ipAddress)
  ) {
    return { valid: false, error: 'IP address not allowed' };
  }

  // Check rate limits
  const rateLimit = await validateApiKey(apiKey, ipAddress || undefined);

  if (!rateLimit.allowed) {
    return { valid: false, error: 'Rate limit exceeded' };
  }

  return { valid: true, key: keyRecord };
}
