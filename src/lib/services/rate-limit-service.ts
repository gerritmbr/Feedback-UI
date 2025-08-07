// Per-user rate limiting service with memory-based storage

import { RateLimitInfo, UserLimit } from '@/src/types/api'
import { RateLimitError } from '@/src/lib/middleware/error-handler'

/**
 * Rate limiting service with per-user tracking
 * Uses sliding window algorithm for accurate rate limiting
 */
export class RateLimitService {
  private userLimits = new Map<string, UserLimit>()
  private globalRequestCount = 0
  private globalWindowStart = Date.now()
  
  private readonly userMaxRequests: number
  private readonly userWindowMs: number
  private readonly globalMaxRequests: number
  private readonly globalWindowMs: number
  private readonly cleanupInterval: number
  
  constructor(
    userMaxRequests = 10,
    userWindowMinutes = 5,
    globalMaxRequests = 100,
    globalWindowMinutes = 1
  ) {
    this.userMaxRequests = userMaxRequests
    this.userWindowMs = userWindowMinutes * 60 * 1000
    this.globalMaxRequests = globalMaxRequests
    this.globalWindowMs = globalWindowMinutes * 60 * 1000
    this.cleanupInterval = 5 * 60 * 1000 // Cleanup every 5 minutes
    
    // Start periodic cleanup
    this.startCleanup()
  }

  /**
   * Check if user is allowed to make a request
   * @param userIP User's IP address
   * @param bypassToken Optional bypass token for admin/testing
   * @returns Rate limit information
   */
  checkLimit(userIP: string, bypassToken?: string): RateLimitInfo {
    // Allow bypass in development mode or with valid token
    if (this.shouldBypassRateLimit(bypassToken)) {
      return {
        allowed: true,
        remainingRequests: this.userMaxRequests,
        resetTime: Date.now() + this.userWindowMs
      }
    }

    // Check global rate limit first
    const globalCheck = this.checkGlobalLimit()
    if (!globalCheck.allowed) {
      return globalCheck
    }

    // Check per-user rate limit
    return this.checkUserLimit(userIP)
  }

  /**
   * Record a successful request for rate limiting
   * @param userIP User's IP address
   */
  recordRequest(userIP: string): void {
    const now = Date.now()
    
    // Record global request
    this.recordGlobalRequest(now)
    
    // Record user request
    this.recordUserRequest(userIP, now)
  }

  /**
   * Get current rate limit status for user (for debugging)
   * @param userIP User's IP address
   * @returns Current rate limit status
   */
  getStatus(userIP: string): {
    user: RateLimitInfo
    global: { requestCount: number; windowStart: number; maxRequests: number }
    totalUsers: number
  } {
    return {
      user: this.checkUserLimit(userIP),
      global: {
        requestCount: this.globalRequestCount,
        windowStart: this.globalWindowStart,
        maxRequests: this.globalMaxRequests
      },
      totalUsers: this.userLimits.size
    }
  }

  /**
   * Reset rate limits for a specific user (admin function)
   * @param userIP User's IP address
   */
  resetUserLimit(userIP: string): void {
    this.userLimits.delete(userIP)
  }

  /**
   * Reset all rate limits (admin function)
   */
  resetAllLimits(): void {
    this.userLimits.clear()
    this.globalRequestCount = 0
    this.globalWindowStart = Date.now()
  }

  /**
   * Check global rate limit
   * @returns Rate limit information for global limits
   */
  private checkGlobalLimit(): RateLimitInfo {
    const now = Date.now()
    const windowAge = now - this.globalWindowStart

    // Reset global window if expired
    if (windowAge >= this.globalWindowMs) {
      this.globalRequestCount = 0
      this.globalWindowStart = now
    }

    const allowed = this.globalRequestCount < this.globalMaxRequests
    const resetTime = this.globalWindowStart + this.globalWindowMs

    if (!allowed) {
      const retryAfter = Math.ceil((resetTime - now) / 1000)
      return {
        allowed: false,
        retryAfter,
        remainingRequests: 0,
        resetTime
      }
    }

    return {
      allowed: true,
      remainingRequests: this.globalMaxRequests - this.globalRequestCount,
      resetTime
    }
  }

  /**
   * Check per-user rate limit using sliding window
   * @param userIP User's IP address
   * @returns Rate limit information for user
   */
  private checkUserLimit(userIP: string): RateLimitInfo {
    const now = Date.now()
    let userLimit = this.userLimits.get(userIP)

    // Initialize user limit if not exists
    if (!userLimit) {
      userLimit = {
        requestCount: 0,
        windowStart: now,
        lastRequest: now
      }
      this.userLimits.set(userIP, userLimit)
    }

    const windowAge = now - userLimit.windowStart

    // Reset user window if expired
    if (windowAge >= this.userWindowMs) {
      userLimit.requestCount = 0
      userLimit.windowStart = now
    }

    const allowed = userLimit.requestCount < this.userMaxRequests
    const resetTime = userLimit.windowStart + this.userWindowMs

    if (!allowed) {
      const retryAfter = Math.ceil((resetTime - now) / 1000)
      return {
        allowed: false,
        retryAfter,
        remainingRequests: 0,
        resetTime
      }
    }

    return {
      allowed: true,
      remainingRequests: this.userMaxRequests - userLimit.requestCount,
      resetTime
    }
  }

  /**
   * Record a global request
   * @param timestamp Request timestamp
   */
  private recordGlobalRequest(timestamp: number): void {
    // Reset window if expired
    if (timestamp - this.globalWindowStart >= this.globalWindowMs) {
      this.globalRequestCount = 0
      this.globalWindowStart = timestamp
    }
    
    this.globalRequestCount++
  }

  /**
   * Record a user request
   * @param userIP User's IP address
   * @param timestamp Request timestamp
   */
  private recordUserRequest(userIP: string, timestamp: number): void {
    let userLimit = this.userLimits.get(userIP)
    
    if (!userLimit) {
      userLimit = {
        requestCount: 0,
        windowStart: timestamp,
        lastRequest: timestamp
      }
      this.userLimits.set(userIP, userLimit)
    }

    // Reset window if expired
    if (timestamp - userLimit.windowStart >= this.userWindowMs) {
      userLimit.requestCount = 0
      userLimit.windowStart = timestamp
    }

    userLimit.requestCount++
    userLimit.lastRequest = timestamp
  }

  /**
   * Check if request should bypass rate limiting
   * @param bypassToken Optional bypass token
   * @returns Whether to bypass rate limiting
   */
  private shouldBypassRateLimit(bypassToken?: string): boolean {
    // Always allow bypass in development (unless explicitly disabled)
    if (process.env.NODE_ENV === 'development' && 
        process.env.RATE_LIMIT_ENABLED !== 'true') {
      return true
    }

    // Check for valid bypass token (for testing/admin)
    if (bypassToken && process.env.RATE_LIMIT_BYPASS_TOKEN) {
      return bypassToken === process.env.RATE_LIMIT_BYPASS_TOKEN
    }

    return false
  }

  /**
   * Start periodic cleanup of expired user limits
   */
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      const staleThreshold = now - (this.userWindowMs * 2) // Clean up after 2x window time

      for (const [userIP, userLimit] of this.userLimits.entries()) {
        if (userLimit.lastRequest < staleThreshold) {
          this.userLimits.delete(userIP)
        }
      }

      // Log cleanup in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Rate limit cleanup: ${this.userLimits.size} active users`)
      }
    }, this.cleanupInterval)
  }

  /**
   * Get service statistics (for monitoring)
   */
  getStats(): {
    activeUsers: number
    globalRequests: number
    memoryUsage: number
    uptime: number
  } {
    const memoryUsage = this.userLimits.size * 64 + 1024 // Rough estimate in bytes
    
    return {
      activeUsers: this.userLimits.size,
      globalRequests: this.globalRequestCount,
      memoryUsage,
      uptime: Date.now() - this.globalWindowStart
    }
  }
}

/**
 * Singleton instance of rate limiting service
 * Initialized with environment variables
 */
let rateLimitInstance: RateLimitService | null = null

/**
 * Get or create rate limiting service instance
 * @returns Rate limiting service instance
 */
export function getRateLimitService(): RateLimitService {
  if (!rateLimitInstance) {
    const userMax = parseInt(process.env.RATE_LIMIT_MAX_PER_USER || '10')
    const userWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '5')
    const globalMax = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '100')
    const globalWindow = 1 // Always 1 minute for global limits
    
    rateLimitInstance = new RateLimitService(
      userMax,
      userWindow, 
      globalMax,
      globalWindow
    )
  }
  
  return rateLimitInstance
}

/**
 * Middleware wrapper for rate limiting
 * @param userIP User's IP address
 * @param bypassToken Optional bypass token
 * @throws RateLimitError if rate limit exceeded
 */
export function enforceRateLimit(userIP: string, bypassToken?: string): void {
  const rateLimiter = getRateLimitService()
  const limitInfo = rateLimiter.checkLimit(userIP, bypassToken)
  
  if (!limitInfo.allowed) {
    const message = limitInfo.retryAfter 
      ? `Rate limit exceeded. Try again in ${limitInfo.retryAfter} seconds.`
      : 'Rate limit exceeded. Please try again later.'
    
    throw new RateLimitError(message, limitInfo.retryAfter || 60)
  }
  
  // Record the request
  rateLimiter.recordRequest(userIP)
}