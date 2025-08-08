// API Types for Hypothesis Testing System

export type APIErrorType = 
  | 'RATE_LIMITED'           // User exceeded rate limit
  | 'INVALID_INPUT'          // Validation failed
  | 'CLAUDE_API_ERROR'       // External API failure
  | 'TIMEOUT'                // Request timeout
  | 'INTERNAL_ERROR'         // Server error
  | 'SERVICE_UNAVAILABLE'    // Maintenance mode

// Request interfaces
export interface HypothesisTestRequest {
  hypothesis: string         // 10-1000 characters, sanitized
  selectedPersonaIds?: string[]  // Optional array of persona IDs for transcript filtering
  transcriptSessionId?: string   // Optional session ID for uploaded transcript data
}

// Response interfaces
export interface HypothesisTestResponse {
  result: string            // Plain text or markdown analysis
  connectionFound: boolean  // Whether meaningful connections were found
  processingTime: number    // Processing time in milliseconds (for monitoring)
  cached: boolean          // Whether result came from cache
  transcriptsAnalyzed: number   // Number of transcripts analyzed
  personasUsed?: string[]   // Persona IDs used for filtering (if any)
  dataSource?: 'uploaded' | 'local' | 'example'  // Source of transcript data
}

export interface APIErrorResponse {
  error: APIErrorType
  message: string
  retryAfter?: number      // For rate limiting (seconds until retry allowed)
}

// Health check interfaces
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  claude_api: 'up' | 'down' | 'unknown'
  cache_size: number
  uptime: number           // Uptime in seconds
  timestamp: string        // ISO timestamp
}

// Rate limiting interfaces
export interface RateLimitInfo {
  allowed: boolean
  retryAfter?: number      // Seconds until next request allowed
  remainingRequests: number
  resetTime: number        // Unix timestamp when limit resets
}

export interface UserLimit {
  requestCount: number
  windowStart: number      // Unix timestamp of current window start
  lastRequest: number      // Unix timestamp of last request
}

// Cache interfaces
export interface CacheEntry {
  value: string
  timestamp: number        // Unix timestamp when cached
  ttl: number             // Time-to-live in milliseconds
}

export interface CacheMetrics {
  hits: number
  misses: number
  size: number
  hitRate: number         // Percentage
}

// Service configuration
export interface ServiceConfig {
  claudeModel: string
  rateLimitEnabled: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  cacheTTL: number        // Cache TTL in milliseconds
  maxCacheSize: number    // Maximum cache entries
  requestTimeout: number  // Request timeout in milliseconds
  retryAttempts: number   // Number of retry attempts for Claude API
}