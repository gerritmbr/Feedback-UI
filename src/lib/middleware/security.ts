// Security middleware for adding protective headers and request validation

import { NextRequest, NextResponse } from 'next/server'

/**
 * Security headers configuration
 */
const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // XSS protection (legacy, but still useful for older browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Don't reveal server information
  'X-Powered-By': '', // This removes the header
  
  // Permissions policy (restrict access to browser APIs)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()'
  ].join(', ')
} as const

/**
 * Content Security Policy for API endpoints
 */
const CSP_POLICY = [
  "default-src 'none'",
  "script-src 'none'", 
  "style-src 'none'",
  "img-src 'none'",
  "connect-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "media-src 'none'",
  "frame-src 'none'",
  "sandbox",
  "base-uri 'none'"
].join('; ')

/**
 * Apply security headers to API responses
 * @param response NextResponse object to modify
 * @param options Security options
 * @returns Modified response with security headers
 */
export function addSecurityHeaders(
  response: NextResponse,
  options: {
    includeCsp?: boolean
    includeHsts?: boolean
    customHeaders?: Record<string, string>
  } = {}
): NextResponse {
  const { includeCsp = true, includeHsts = true, customHeaders = {} } = options

  // Apply standard security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value === '') {
      response.headers.delete(key) // Remove header if value is empty
    } else {
      response.headers.set(key, value)
    }
  })

  // Add Content Security Policy for API endpoints
  if (includeCsp) {
    response.headers.set('Content-Security-Policy', CSP_POLICY)
  }

  // Add HSTS in production
  if (includeHsts && process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Apply custom headers
  Object.entries(customHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * Create a secure API response with proper headers
 * @param data Response data
 * @param options Response options
 * @returns Secure NextResponse
 */
export function createSecureResponse<T>(
  data: T,
  options: {
    status?: number
    headers?: Record<string, string>
    maxAge?: number // Cache max-age in seconds
    includeCors?: boolean
  } = {}
): NextResponse<T> {
  const { 
    status = 200, 
    headers = {}, 
    maxAge = 0, // No cache by default for API responses
    includeCors = false 
  } = options

  // Create base response
  const response = NextResponse.json(data, { status })

  // Add cache control
  if (maxAge > 0) {
    response.headers.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`)
  } else {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  // Add CORS headers if requested
  if (includeCors) {
    const corsHeaders = getCorsHeaders()
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // Apply security headers
  return addSecurityHeaders(response, { customHeaders: headers })
}

/**
 * Get CORS headers based on environment
 * @returns CORS headers object
 */
function getCorsHeaders(): Record<string, string> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    // Allow all origins in development
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  }

  // Production CORS - more restrictive
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`,
    'https://your-domain.com' // Replace with actual domain
  ].filter(Boolean)

  return {
    'Access-Control-Allow-Origin': allowedOrigins[0] || 'https://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600' // 1 hour
  }
}

/**
 * Validate request security and origin
 * @param request NextRequest object
 * @returns Validation result
 */
export function validateRequestOrigin(request: NextRequest): {
  valid: boolean
  reason?: string
} {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Skip validation in development
  if (isDevelopment) {
    return { valid: true }
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // Check for required headers in production
  if (!origin && !referer) {
    return {
      valid: false,
      reason: 'Missing origin or referer header'
    }
  }

  // Validate origin against allowed list
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    host // Current host is always allowed
  ].filter(Boolean)

  const requestOrigin = origin || referer
  const isAllowed = allowedHosts.some(allowedHost => 
    requestOrigin?.includes(allowedHost || '')
  )

  if (!isAllowed) {
    return {
      valid: false,
      reason: 'Request origin not in allowlist'
    }
  }

  return { valid: true }
}

/**
 * Rate limiting headers helper
 * @param remaining Remaining requests
 * @param resetTime Reset timestamp
 * @param limit Total limit
 * @returns Rate limiting headers
 */
export function getRateLimitHeaders(
  remaining: number,
  resetTime: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining).toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    'X-RateLimit-Policy': `${limit} requests per window`
  }
}

/**
 * Security audit helper for requests
 * @param request NextRequest object
 * @returns Security audit result
 */
export function auditRequest(request: NextRequest): {
  securityScore: number // 0-100
  warnings: string[]
  recommendations: string[]
} {
  const warnings: string[] = []
  const recommendations: string[] = []
  let securityScore = 100

  // Check User-Agent
  const userAgent = request.headers.get('user-agent')
  if (!userAgent) {
    warnings.push('Missing User-Agent header')
    securityScore -= 10
  } else if (userAgent.length < 20) {
    warnings.push('Suspiciously short User-Agent')
    securityScore -= 5
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /curl/i,
    /wget/i,
    /bot/i,
    /crawler/i,
    /scraper/i
  ]

  if (userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    warnings.push('Potentially automated User-Agent detected')
    securityScore -= 15
  }

  // Check HTTPS
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  if (protocol !== 'https' && process.env.NODE_ENV === 'production') {
    warnings.push('Request not made over HTTPS')
    recommendations.push('Use HTTPS for all API requests in production')
    securityScore -= 20
  }

  // Check Origin/Referer
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  if (!origin && !referer && process.env.NODE_ENV === 'production') {
    warnings.push('Missing Origin and Referer headers')
    recommendations.push('Ensure requests include proper Origin headers')
    securityScore -= 10
  }

  // Check Content-Type for POST requests
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      warnings.push('POST request without proper Content-Type')
      recommendations.push('Use application/json Content-Type for API requests')
      securityScore -= 5
    }
  }

  return {
    securityScore: Math.max(0, securityScore),
    warnings,
    recommendations
  }
}

/**
 * CORS preflight handler
 * @param request NextRequest object
 * @returns CORS preflight response
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders()
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  })
}