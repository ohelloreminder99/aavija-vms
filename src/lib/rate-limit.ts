/**
 * AAVIJA VMS — Rate Limiting Utility (Upstash Redis)
 * 
 * To use this, you must install:
 * npm install @upstash/redis @upstash/ratelimit
 * 
 * And set the following in your .env.local:
 * UPSTASH_REDIS_REST_URL=your_url_here
 * UPSTASH_REDIS_REST_TOKEN=your_token_here
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Only initialize if keys are present
const isConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = isConfigured 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Helper to create simple limiters
function createLimiter(requests: number, window: string, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as any),
    prefix: `rl:${prefix}`,
  });
}

/**
 * Login Rate Limiter: 5 attempts per minute
 */
export const loginRateLimit = createLimiter(5, '60 s', 'login');

/**
 * Health Check Rate Limiter: 30 requests per minute
 */
export const healthRateLimit = createLimiter(30, '60 s', 'health');

/**
 * Contact Form Rate Limiter: 2 submissions per 5 minutes
 */
export const contactRateLimit = createLimiter(2, '300 s', 'contact');

/**
 * Generic rate limit check that falls back to true if not configured
 */
export async function checkRateLimit(limiter: Ratelimit | null, identifier: string): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  if (!limiter) {
    return { success: true };
  }
  
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.error('[RateLimit] Exception:', err);
    return { success: true }; // Fail open
  }
}
