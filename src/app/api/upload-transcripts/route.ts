// Transcript upload endpoint with validation and session management
import { NextRequest } from 'next/server'
import { withErrorHandler } from '@/src/lib/middleware/error-handler'
import { createSecureResponse, validateRequestOrigin, auditRequest } from '@/src/lib/middleware/security'
import { getClientIP } from '@/src/lib/middleware/validation'
import { enforceRateLimit } from '@/src/lib/services/rate-limit-service'
import { getSessionManager, SessionMetadata } from '@/src/lib/services/session-manager'
import { getTranscriptValidator, ValidationResult } from '@/src/lib/utils/transcript-validator'
import { TranscriptCollection } from '@/src/types/transcript'

interface UploadResponse {
  sessionId: string
  metadata: SessionMetadata
  validation: ValidationResult
  success: boolean
}

interface UploadErrorResponse {
  error: string
  message: string
  validation?: Partial<ValidationResult>
}

/**
 * POST /api/upload-transcripts - Upload and validate transcript data
 * 
 * Request body: { transcripts: TranscriptCollection, filename?: string }
 * Response: { sessionId: string, metadata: SessionMetadata, validation: ValidationResult }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const startTime = Date.now()
  const requestId = generateRequestId()

  // Security validation
  const originValidation = validateRequestOrigin(request)
  if (!originValidation.valid) {
    logUploadEvent(requestId, 'origin_validation_failed', originValidation.reason)
  }

  const securityAudit = auditRequest(request)
  if (securityAudit.securityScore < 70) {
    logUploadEvent(requestId, 'low_security_score', `Score: ${securityAudit.securityScore}`)
  }

  // Rate limiting (higher limit for uploads)
  const userIP = getClientIP(request)
  const bypassToken = request.headers.get('x-bypass-token') || undefined
  
  try {
    // Use higher rate limit for uploads (fewer requests but larger payloads)
    enforceRateLimit(userIP, bypassToken, { maxRequests: 5, windowMinutes: 10 })
  } catch (rateLimitError) {
    logUploadEvent(requestId, 'rate_limited', { userIP, securityScore: securityAudit.securityScore })
    throw rateLimitError
  }

  let transcriptData: any
  let filename: string | undefined

  // Parse request body
  try {
    const body = await request.json()
    transcriptData = body.transcripts || body // Support both { transcripts: ... } and direct format
    filename = body.filename || 'uploaded-transcripts.json'

    logUploadEvent(requestId, 'request_parsed', { 
      hasTranscripts: !!transcriptData,
      filename,
      bodySize: JSON.stringify(body).length
    })
  } catch (error) {
    return createSecureResponse<UploadErrorResponse>(
      { 
        error: 'INVALID_INPUT', 
        message: 'Invalid JSON in request body' 
      },
      { status: 400 }
    )
  }

  // Basic validation
  if (!transcriptData) {
    return createSecureResponse<UploadErrorResponse>(
      { 
        error: 'INVALID_INPUT', 
        message: 'No transcript data provided' 
      },
      { status: 400 }
    )
  }

  // Validate transcript data
  const validator = getTranscriptValidator()
  let validation: ValidationResult

  try {
    validation = validator.validateTranscripts(transcriptData)
    
    logUploadEvent(requestId, 'validation_completed', {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      transcriptCount: validation.stats.transcriptCount
    })

    // If validation fails completely, return error
    if (!validation.isValid) {
      return createSecureResponse<UploadErrorResponse>(
        { 
          error: 'INVALID_TRANSCRIPT_DATA', 
          message: 'Transcript data validation failed',
          validation: {
            errors: validation.errors,
            warnings: validation.warnings
          }
        },
        { status: 400 }
      )
    }
  } catch (error) {
    logUploadEvent(requestId, 'validation_failed', { error: String(error) })
    return createSecureResponse<UploadErrorResponse>(
      { 
        error: 'VALIDATION_ERROR', 
        message: 'Failed to validate transcript data' 
      },
      { status: 500 }
    )
  }

  // Sanitize the data for security
  const sanitizedTranscripts = validator.sanitizeTranscripts(transcriptData as TranscriptCollection)

  // Store in session
  const sessionManager = getSessionManager()
  let sessionId: string

  try {
    sessionId = await sessionManager.createSession(sanitizedTranscripts, filename)
    
    logUploadEvent(requestId, 'session_created', {
      sessionId,
      transcriptCount: sanitizedTranscripts.transcripts.length,
      dataSize: JSON.stringify(sanitizedTranscripts).length
    })
  } catch (error) {
    logUploadEvent(requestId, 'session_creation_failed', { error: String(error) })
    return createSecureResponse<UploadErrorResponse>(
      { 
        error: 'STORAGE_ERROR', 
        message: 'Failed to store transcript data' 
      },
      { status: 500 }
    )
  }

  // Get session metadata
  const metadata = await sessionManager.getSessionMetadata(sessionId)
  if (!metadata) {
    logUploadEvent(requestId, 'metadata_retrieval_failed', { sessionId })
    return createSecureResponse<UploadErrorResponse>(
      { 
        error: 'STORAGE_ERROR', 
        message: 'Failed to retrieve session metadata' 
      },
      { status: 500 }
    )
  }

  const processingTime = Date.now() - startTime
  
  logUploadEvent(requestId, 'upload_completed', {
    sessionId,
    processingTime,
    transcriptCount: validation.stats.transcriptCount,
    dataSize: validation.stats.totalSize,
    hasWarnings: validation.warnings.length > 0
  })

  // Return success response
  const response: UploadResponse = {
    sessionId,
    metadata,
    validation,
    success: true
  }

  return createSecureResponse(response, {
    status: 201,
    headers: {
      'X-Session-ID': sessionId,
      'X-Processing-Time': processingTime.toString(),
      'X-Transcript-Count': validation.stats.transcriptCount.toString()
    }
  })
})

/**
 * GET /api/upload-transcripts - Get upload statistics and session info
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  const sessionManager = getSessionManager()

  if (sessionId) {
    // Get specific session info
    const metadata = await sessionManager.getSessionMetadata(sessionId)
    if (!metadata) {
      return createSecureResponse(
        { error: 'SESSION_NOT_FOUND', message: 'Session not found or expired' },
        { status: 404 }
      )
    }
    
    return createSecureResponse({
      sessionId,
      metadata,
      exists: true
    })
  } else {
    // Get general stats
    const stats = await sessionManager.getSessionStats()
    return createSecureResponse({
      totalSessions: stats.totalSessions,
      totalSize: stats.totalSize,
      oldestSession: stats.oldestSession
    })
  }
})

/**
 * DELETE /api/upload-transcripts - Delete session data
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return createSecureResponse(
      { error: 'MISSING_SESSION_ID', message: 'Session ID is required' },
      { status: 400 }
    )
  }

  const sessionManager = getSessionManager()
  
  // Check if session exists first
  const exists = await sessionManager.hasSession(sessionId)
  if (!exists) {
    return createSecureResponse(
      { error: 'SESSION_NOT_FOUND', message: 'Session not found or already expired' },
      { status: 404 }
    )
  }

  // Delete the session
  await sessionManager.deleteSession(sessionId)
  
  return createSecureResponse({
    success: true,
    message: 'Session deleted successfully',
    sessionId
  })
})

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
}

/**
 * Structured upload event logging
 */
function logUploadEvent(
  requestId: string,
  event: string,
  metadata: Record<string, any> = {}
): void {
  const logLevel = process.env.LOG_LEVEL || 'info'
  const isProduction = process.env.NODE_ENV === 'production'
  const isServerless = process.env.VERCEL || process.env.NETLIFY
  
  // Always log errors and important events in production/serverless environments
  const shouldLog = process.env.NODE_ENV === 'development' || 
                   logLevel === 'debug' || 
                   isProduction || 
                   isServerless ||
                   event.includes('error') || 
                   event.includes('failed')
  
  if (shouldLog) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      event,
      metadata: sanitizeLogMetadata(metadata),
      service: 'transcript-upload-api',
      environment: process.env.NODE_ENV,
      isServerless: !!isServerless
    }

    if (event.includes('error') || event.includes('failed')) {
      console.error(`[Upload API ERROR] ${JSON.stringify(logEntry)}`)
    } else {
      console.log(`[Upload API] ${JSON.stringify(logEntry)}`)
    }
  }
}

/**
 * Sanitize metadata for logging
 */
function sanitizeLogMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata }
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['transcripts', 'content', 'sessionData']
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]'
    }
    
    // Truncate long strings
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
      sanitized[key] = sanitized[key].substring(0, 200) + '...'
    }
  })
  
  return sanitized
}