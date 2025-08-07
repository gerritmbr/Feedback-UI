// Comprehensive error handling middleware for API routes

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { APIErrorResponse, APIErrorType } from '@/src/types/api'
import { ValidationError } from './validation'

/**
 * Custom application errors with specific types
 */
export class AppError extends Error {
  constructor(
    public errorType: APIErrorType,
    message: string,
    public statusCode: number = 500,
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends AppError {
  constructor(message: string, retryAfter: number) {
    super('RATE_LIMITED', message, 429, retryAfter)
    this.name = 'RateLimitError'
  }
}

/**
 * Claude API error
 */
export class ClaudeAPIError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super('CLAUDE_API_ERROR', message, statusCode)
    this.name = 'ClaudeAPIError'
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Request timeout') {
    super('TIMEOUT', message, 408)
    this.name = 'TimeoutError'
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super('SERVICE_UNAVAILABLE', message, 503)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * Error logging interface
 */
interface ErrorLogContext {
  errorId: string
  timestamp: string
  path: string
  method: string
  userIP: string
  userAgent?: string
  requestId?: string
}

/**
 * Main error handler function
 * Converts any error into a standardized API response
 */
export function handleAPIError(
  error: unknown,
  context?: Partial<ErrorLogContext>
): NextResponse<APIErrorResponse> {
  
  const errorId = generateErrorId()
  const timestamp = new Date().toISOString()
  
  // Build error context
  const logContext: ErrorLogContext = {
    errorId,
    timestamp,
    path: context?.path || 'unknown',
    method: context?.method || 'unknown', 
    userIP: context?.userIP || 'unknown',
    userAgent: context?.userAgent,
    requestId: context?.requestId
  }

  let response: APIErrorResponse
  let statusCode: number

  // Handle different error types
  if (error instanceof ValidationError) {
    response = handleValidationError(error, logContext)
    statusCode = 400
  } 
  else if (error instanceof RateLimitError) {
    response = handleRateLimitError(error, logContext)
    statusCode = error.statusCode
  }
  else if (error instanceof ClaudeAPIError) {
    response = handleClaudeAPIError(error, logContext)
    statusCode = error.statusCode
  }
  else if (error instanceof TimeoutError) {
    response = handleTimeoutError(error, logContext)
    statusCode = error.statusCode
  }
  else if (error instanceof ServiceUnavailableError) {
    response = handleServiceUnavailableError(error, logContext)
    statusCode = error.statusCode
  }
  else if (error instanceof AppError) {
    response = handleAppError(error, logContext)
    statusCode = error.statusCode
  }
  else if (error instanceof z.ZodError) {
    response = handleZodError(error, logContext)
    statusCode = 400
  }
  else {
    response = handleGenericError(error, logContext)
    statusCode = 500
  }

  // Log error (without sensitive data)
  logError(error, logContext, response)

  // Add security headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'X-Error-ID': errorId
  }

  // Add retry-after header for rate limiting
  if (response.retryAfter) {
    headers['Retry-After'] = response.retryAfter.toString()
  }

  return NextResponse.json(response, { 
    status: statusCode,
    headers
  })
}

/**
 * Handle validation errors
 */
function handleValidationError(
  error: ValidationError, 
  context: ErrorLogContext
): APIErrorResponse {
  return {
    error: error.errorType,
    message: sanitizeErrorMessage(error.message)
  }
}

/**
 * Handle rate limit errors
 */
function handleRateLimitError(
  error: RateLimitError,
  context: ErrorLogContext
): APIErrorResponse {
  return {
    error: error.errorType,
    message: sanitizeErrorMessage(error.message),
    retryAfter: error.retryAfter
  }
}

/**
 * Handle Claude API errors
 */
function handleClaudeAPIError(
  error: ClaudeAPIError,
  context: ErrorLogContext
): APIErrorResponse {
  // Don't expose internal API details to users
  return {
    error: error.errorType,
    message: 'Analysis service is temporarily unavailable. Please try again later.'
  }
}

/**
 * Handle timeout errors  
 */
function handleTimeoutError(
  error: TimeoutError,
  context: ErrorLogContext
): APIErrorResponse {
  return {
    error: error.errorType,
    message: 'Request took too long to process. Please try again with a shorter hypothesis.'
  }
}

/**
 * Handle service unavailable errors
 */
function handleServiceUnavailableError(
  error: ServiceUnavailableError,
  context: ErrorLogContext
): APIErrorResponse {
  return {
    error: error.errorType,
    message: error.message
  }
}

/**
 * Handle general app errors
 */
function handleAppError(
  error: AppError,
  context: ErrorLogContext
): APIErrorResponse {
  return {
    error: error.errorType,
    message: sanitizeErrorMessage(error.message),
    retryAfter: error.retryAfter
  }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(
  error: z.ZodError,
  context: ErrorLogContext
): APIErrorResponse {
  const firstError = error.errors[0]
  const message = firstError ? 
    `Validation failed: ${firstError.message}` : 
    'Invalid request data'

  return {
    error: 'INVALID_INPUT',
    message: sanitizeErrorMessage(message)
  }
}

/**
 * Handle unknown/generic errors
 */
function handleGenericError(
  error: unknown,
  context: ErrorLogContext
): APIErrorResponse {
  // Never expose internal error details
  return {
    error: 'INTERNAL_ERROR',
    message: 'An internal error occurred. Please try again later.'
  }
}

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeErrorMessage(message: string): string {
  // Remove potentially sensitive information
  return message
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // IP addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Email addresses
    .replace(/(?:password|secret|key|token)[\s:=]+"?[^"\s]+"?/gi, '[REDACTED]') // Credentials
    .replace(/\/[^\s]*\/[^\s]*/g, '[PATH]') // File paths
    .substring(0, 200) // Limit length
}

/**
 * Log error with structured format
 */
function logError(
  error: unknown,
  context: ErrorLogContext,
  response: APIErrorResponse
): void {
  const logLevel = process.env.LOG_LEVEL || 'info'
  
  // Only log errors in development or if explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_METRICS === 'true') {
    const logEntry = {
      level: 'error',
      timestamp: context.timestamp,
      errorId: context.errorId,
      errorType: response.error,
      message: response.message,
      path: context.path,
      method: context.method,
      userIP: context.userIP,
      userAgent: context.userAgent,
      requestId: context.requestId,
      // Include stack trace only in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: error instanceof Error ? error.stack : undefined,
        originalError: error instanceof Error ? error.message : String(error)
      })
    }

    // Log to console (in production, this would go to your logging service)
    if (logLevel === 'debug' || ['error', 'INTERNAL_ERROR', 'CLAUDE_API_ERROR'].includes(response.error)) {
      console.error('API Error:', JSON.stringify(logEntry, null, 2))
    } else {
      console.warn('API Warning:', JSON.stringify(logEntry, null, 2))
    }
  }
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Async error handler wrapper for API routes
 * Usage: export const POST = withErrorHandler(async (request) => { ... })
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse<APIErrorResponse>> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Extract context from request if available
      const request = args[0]
      let context: Partial<ErrorLogContext> = {}
      
      if (request && typeof request === 'object' && 'url' in request && 'method' in request) {
        const req = request as { url: string; method: string; headers: { get: (key: string) => string | null } }
        context = {
          path: new URL(req.url).pathname,
          method: req.method,
          userAgent: req.headers.get('user-agent') || undefined
        }
      }

      return handleAPIError(error, context)
    }
  }
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failures = 0
  private nextAttempt = Date.now()
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000 // 60 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new ServiceUnavailableError('Circuit breaker is open - service temporarily unavailable')
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.recoveryTimeout
    }
  }

  get isOpen(): boolean {
    return this.state === 'OPEN'
  }
}