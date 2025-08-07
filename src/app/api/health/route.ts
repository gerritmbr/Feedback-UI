// Health check endpoint for monitoring and service status

import { NextRequest, NextResponse } from 'next/server'
import { HealthCheckResponse } from '@/src/types/api'
import { getRateLimitService } from '@/src/lib/services/rate-limit-service'
import { withErrorHandler } from '@/src/lib/middleware/error-handler'
import { loadReferenceData } from '@/src/lib/utils/reference-data'

// Store service start time
const serviceStartTime = Date.now()

/**
 * GET /api/health - Health check endpoint
 * Returns current system status and diagnostics
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const startTime = Date.now()
  
  // Basic system checks
  const checks = await Promise.allSettled([
    checkClaudeAPI(),
    checkReferenceData(),
    checkRateLimitService(),
    checkMemoryUsage(),
    checkEnvironmentVariables()
  ])

  // Determine overall health status
  const allPassed = checks.every(check => check.status === 'fulfilled' && check.value.healthy)
  const anyDegraded = checks.some(check => 
    check.status === 'fulfilled' && check.value.status === 'degraded'
  )

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  if (allPassed) {
    overallStatus = 'healthy'
  } else if (anyDegraded || checks.filter(c => c.status === 'rejected').length <= 1) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'unhealthy'
  }

  // Get detailed check results
  const checkResults: Record<string, any> = {}
  const checkNames = ['claude_api', 'reference_data', 'rate_limiting', 'memory', 'environment']
  
  checks.forEach((check, index) => {
    if (check.status === 'fulfilled') {
      checkResults[checkNames[index]] = check.value.status
    } else {
      checkResults[checkNames[index]] = 'failed'
    }
  })

  // Get rate limiter stats
  const rateLimiter = getRateLimitService()
  const rateLimitStats = rateLimiter.getStats()

  const uptime = Math.floor((Date.now() - serviceStartTime) / 1000)
  const processingTime = Date.now() - startTime

  const response: HealthCheckResponse = {
    status: overallStatus,
    claude_api: checkResults.claude_api,
    cache_size: rateLimitStats.activeUsers, // Using active users as proxy for cache size
    uptime,
    timestamp: new Date().toISOString()
  }

  // Add detailed diagnostics for internal use (query param ?detailed=true)
  const url = new URL(request.url)
  if (url.searchParams.get('detailed') === 'true') {
    const detailedResponse = {
      ...response,
      checks: checkResults,
      diagnostics: {
        processing_time: processingTime,
        memory_usage: process.memoryUsage(),
        rate_limit_stats: rateLimitStats,
        node_version: process.version,
        environment: process.env.NODE_ENV,
        timestamp_unix: Date.now()
      }
    }
    
    return NextResponse.json(detailedResponse, {
      status: overallStatus === 'unhealthy' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'detailed'
      }
    })
  }

  return NextResponse.json(response, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
})

/**
 * Check Claude API connectivity
 */
async function checkClaudeAPI(): Promise<{ healthy: boolean; status: string; details?: string }> {
  try {
    // Don't make actual API call in health check to avoid costs
    // Just verify API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      return {
        healthy: false,
        status: 'down',
        details: 'API key not configured'
      }
    }

    if (apiKey.length < 20 || !apiKey.startsWith('sk-ant-')) {
      return {
        healthy: false,
        status: 'down', 
        details: 'API key appears invalid'
      }
    }

    return {
      healthy: true,
      status: 'up'
    }
  } catch (error) {
    return {
      healthy: false,
      status: 'unknown',
      details: 'Health check failed'
    }
  }
}

/**
 * Check reference data availability
 */
async function checkReferenceData(): Promise<{ healthy: boolean; status: string; details?: string }> {
  try {
    const data = await loadReferenceData()
    
    if (!data || !data.feedback || data.feedback.length === 0) {
      return {
        healthy: false,
        status: 'down',
        details: 'No reference data available'
      }
    }

    if (data.feedback.length < 5) {
      return {
        healthy: true,
        status: 'degraded',
        details: `Only ${data.feedback.length} reference entries available`
      }
    }

    return {
      healthy: true,
      status: 'up'
    }
  } catch (error) {
    return {
      healthy: false,
      status: 'down',
      details: error instanceof Error ? error.message : 'Failed to load reference data'
    }
  }
}

/**
 * Check rate limiting service
 */
async function checkRateLimitService(): Promise<{ healthy: boolean; status: string; details?: string }> {
  try {
    const rateLimiter = getRateLimitService()
    const stats = rateLimiter.getStats()
    
    // Check if service is responding
    const testResult = rateLimiter.checkLimit('health-check-test')
    if (!testResult.allowed && testResult.retryAfter) {
      return {
        healthy: true,
        status: 'degraded',
        details: 'Rate limiting is restrictive'
      }
    }

    // Check memory usage
    if (stats.memoryUsage > 10 * 1024 * 1024) { // 10MB
      return {
        healthy: true,
        status: 'degraded',
        details: 'High memory usage in rate limiter'
      }
    }

    return {
      healthy: true,
      status: 'up'
    }
  } catch (error) {
    return {
      healthy: false,
      status: 'down',
      details: 'Rate limiting service failed'
    }
  }
}

/**
 * Check memory usage
 */
async function checkMemoryUsage(): Promise<{ healthy: boolean; status: string; details?: string }> {
  try {
    const memUsage = process.memoryUsage()
    const heapUsed = memUsage.heapUsed / 1024 / 1024 // MB
    const heapTotal = memUsage.heapTotal / 1024 / 1024 // MB
    const usagePercent = (heapUsed / heapTotal) * 100

    if (heapUsed > 512) { // 512MB
      return {
        healthy: false,
        status: 'down',
        details: `High memory usage: ${heapUsed.toFixed(1)}MB`
      }
    }

    if (usagePercent > 80) {
      return {
        healthy: true,
        status: 'degraded',
        details: `Memory usage at ${usagePercent.toFixed(1)}%`
      }
    }

    return {
      healthy: true,
      status: 'up'
    }
  } catch (error) {
    return {
      healthy: false,
      status: 'unknown',
      details: 'Memory check failed'
    }
  }
}

/**
 * Check required environment variables
 */
async function checkEnvironmentVariables(): Promise<{ healthy: boolean; status: string; details?: string }> {
  const required = ['ANTHROPIC_API_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    return {
      healthy: false,
      status: 'down',
      details: `Missing environment variables: ${missing.join(', ')}`
    }
  }

  // Check for recommended variables
  const recommended = ['NODE_ENV', 'RATE_LIMIT_MAX_PER_USER']
  const missingRecommended = recommended.filter(key => !process.env[key])
  
  if (missingRecommended.length > 0) {
    return {
      healthy: true,
      status: 'degraded',
      details: `Missing recommended variables: ${missingRecommended.join(', ')}`
    }
  }

  return {
    healthy: true,
    status: 'up'
  }
}

// Disable caching for health endpoint
export const revalidate = 0