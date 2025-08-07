// Input validation middleware using Zod for request sanitization and security

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { APIErrorResponse, HypothesisTestRequest } from '@/src/types/api'

// Zod schemas for validation
export const HypothesisTestSchema = z.object({
  hypothesis: z
    .string()
    .min(10, 'Hypothesis must be at least 10 characters long')
    .max(1000, 'Hypothesis must not exceed 1000 characters')
    .trim()
    .refine(
      (val) => val.length > 0,
      'Hypothesis cannot be empty after trimming whitespace'
    )
    .refine(
      (val) => !/<[^>]*>/g.test(val), 
      'HTML tags are not allowed in hypothesis'
    )
    .refine(
      (val) => !/javascript:/i.test(val),
      'JavaScript code is not allowed in hypothesis'
    )
    .refine(
      (val) => !/(script|iframe|object|embed|link|meta)/i.test(val),
      'Potentially dangerous content detected'
    )
})

// Content-Type validation
export const ContentTypeSchema = z.literal('application/json')

// Rate limiting bypass schema (for admin/internal use)
export const BypassSchema = z.object({
  bypass_token: z.string().optional()
})

/**
 * Validate and sanitize hypothesis test request
 * @param request NextRequest object
 * @returns Validated and sanitized request data
 * @throws ValidationError if validation fails
 */
export async function validateHypothesisRequest(
  request: NextRequest
): Promise<HypothesisTestRequest> {
  try {
    // Check Content-Type header
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new ValidationError(
        'INVALID_INPUT',
        'Content-Type must be application/json'
      )
    }

    // Parse and validate request body
    const body = await request.json().catch(() => {
      throw new ValidationError(
        'INVALID_INPUT', 
        'Invalid JSON in request body'
      )
    })

    // Validate request structure
    const validatedData = HypothesisTestSchema.parse(body)

    // Additional sanitization
    const sanitizedHypothesis = sanitizeText(validatedData.hypothesis)

    return {
      hypothesis: sanitizedHypothesis
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      throw new ValidationError(
        'INVALID_INPUT',
        `Validation failed: ${firstError.message}`
      )
    }
    
    if (error instanceof ValidationError) {
      throw error
    }
    
    throw new ValidationError(
      'INVALID_INPUT',
      'Failed to parse request data'
    )
  }
}

/**
 * Sanitize text input to remove/escape potentially dangerous content
 * @param text Input text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text
    // Remove null bytes and control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim()
    // Remove any remaining HTML-like patterns
    .replace(/<[^>]*>/g, '')
    // Remove potential script injection attempts
    .replace(/javascript:/gi, '')
    // Remove data URIs
    .replace(/data:[^;]*;base64,/gi, '')
    // Limit consecutive special characters
    .replace(/[^\w\s.,!?;:()\-'"]/g, '')
}

/**
 * Validate request origin and security headers
 * @param request NextRequest object
 * @returns Whether request passes security checks
 */
export function validateRequestSecurity(request: NextRequest): {
  valid: boolean
  reason?: string
} {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const userAgent = request.headers.get('user-agent')

  // Check for missing User-Agent (potential bot/automated request)
  if (!userAgent || userAgent.length < 10) {
    return {
      valid: false,
      reason: 'Invalid or missing User-Agent header'
    }
  }

  // Check for suspicious patterns in User-Agent
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /postman/i
  ]

  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return {
      valid: false,
      reason: 'Automated requests are not allowed'
    }
  }

  // In development, allow requests without origin/referer
  if (process.env.NODE_ENV === 'development') {
    return { valid: true }
  }

  // In production, validate origin
  if (origin || referer) {
    const allowedDomains = [
      'localhost',
      '127.0.0.1',
      process.env.VERCEL_URL,
      process.env.NEXT_PUBLIC_VERCEL_URL
    ].filter(Boolean)

    const requestDomain = origin || referer
    const isAllowed = allowedDomains.some(domain => 
      requestDomain?.includes(domain || '')
    )

    if (!isAllowed) {
      return {
        valid: false,
        reason: 'Request origin not allowed'
      }
    }
  }

  return { valid: true }
}

/**
 * Extract client IP address from request
 * Handles various proxy headers and fallbacks
 * @param request NextRequest object  
 * @returns Client IP address or fallback
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers in order of reliability
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded'
  ]

  for (const header of headers) {
    const value = request.headers.get(header)
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim()
      if (isValidIP(ip)) {
        return ip
      }
    }
  }

  // Fallback to request IP or default
  return request.ip || '127.0.0.1'
}

/**
 * Basic IP address validation
 * @param ip IP address string
 * @returns Whether IP is valid format
 */
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    public errorType: APIErrorResponse['error'],
    message: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Schema validation helper for environment variables
 */
export const EnvironmentSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'Claude API key is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RATE_LIMIT_MAX_PER_USER: z.coerce.number().min(1).default(10),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().min(1).default(5),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().min(1).default(100),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
})

/**
 * Validate environment variables on startup
 * @returns Validated environment configuration
 */
export function validateEnvironment() {
  try {
    return EnvironmentSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      throw new Error(`Environment validation failed:\n${issues.join('\n')}`)
    }
    throw error
  }
}