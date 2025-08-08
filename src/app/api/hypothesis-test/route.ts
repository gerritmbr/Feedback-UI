// Main API route handler for hypothesis testing with full middleware stack

import { NextRequest } from 'next/server'
import { HypothesisTestResponse } from '@/src/types/api'
import { withErrorHandler } from '@/src/lib/middleware/error-handler'
import { validateHypothesisRequest, getClientIP } from '@/src/lib/middleware/validation'
import { createSecureResponse, validateRequestOrigin, auditRequest } from '@/src/lib/middleware/security'
import { enforceRateLimit } from '@/src/lib/services/rate-limit-service'
import { getClaudeService } from '@/src/lib/services/claude-service'
import { getCacheService, createCacheKey } from '@/src/lib/services/cache-service'
import { loadReferenceData, formatTranscriptsForPrompt } from '@/src/lib/utils/reference-data'
import { getPromptBuilder } from '@/src/lib/utils/prompt-builder'
import { getPersonaService } from '@/src/services/personaService'
import { getTranscriptService } from '@/src/services/transcriptService'

/**
 * POST /api/hypothesis-test - Main hypothesis analysis endpoint
 * 
 * Flow:
 * 1. Security validation & rate limiting
 * 2. Input validation & sanitization  
 * 3. Cache check
 * 4. Load reference data
 * 5. Claude API analysis
 * 6. Cache result & return response
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const startTime = Date.now()
  const requestId = generateRequestId()

  // Step 1: Security validation
  const originValidation = validateRequestOrigin(request)
  if (!originValidation.valid) {
    logSecurityEvent(requestId, 'origin_validation_failed', originValidation.reason)
  }

  // Audit request for security analysis
  const securityAudit = auditRequest(request)
  if (securityAudit.securityScore < 70) {
    logSecurityEvent(requestId, 'low_security_score', `Score: ${securityAudit.securityScore}`)
  }

  // Step 2: Rate limiting
  const userIP = getClientIP(request)
  const bypassToken = request.headers.get('x-bypass-token') || undefined
  
  try {
    enforceRateLimit(userIP, bypassToken)
  } catch (rateLimitError) {
    logRequest(requestId, 'rate_limited', { userIP, securityScore: securityAudit.securityScore })
    throw rateLimitError
  }

  // Step 3: Input validation
  const validatedRequest = await validateHypothesisRequest(request)
  const { hypothesis, selectedPersonaIds } = validatedRequest

  logRequest(requestId, 'request_validated', { 
    hypothesisLength: hypothesis.length,
    userIP,
    securityScore: securityAudit.securityScore,
    personaFiltering: selectedPersonaIds && selectedPersonaIds.length > 0
  })

  // Step 4: Cache check (include persona filtering in cache key)
  const cacheService = getCacheService()
  const cacheKey = createCacheKey(
    hypothesis + (selectedPersonaIds ? `|personas:${selectedPersonaIds.sort().join(',')}` : '')
  )
  const cachedResult = cacheService.get(cacheKey)
  
  if (cachedResult) {
    logRequest(requestId, 'cache_hit', { cacheKey })
    
    const response: HypothesisTestResponse = {
      result: cachedResult,
      connectionFound: analyzeConnectionFound(cachedResult),
      processingTime: Date.now() - startTime,
      cached: true,
      transcriptsAnalyzed: 0, // Cached result, exact count not tracked
      personasUsed: selectedPersonaIds
    }
    
    return createSecureResponse(response, {
      headers: {
        'X-Cache': 'HIT',
        'X-Request-ID': requestId
      }
    })
  }

  logRequest(requestId, 'cache_miss', { cacheKey })

  // Step 5: Load and filter reference data based on persona selection
  let transcriptsToAnalyze
  let personasUsed: string[] = []
  
  try {
    if (selectedPersonaIds && selectedPersonaIds.length > 0) {
      // Persona filtering enabled
      const personaService = getPersonaService()
      const transcriptService = getTranscriptService()
      
      // Resolve persona IDs to transcript IDs (with 4-transcript business rule)
      const resolvedTranscriptIds = await personaService.resolveTranscriptIds(selectedPersonaIds)
      
      // Get filtered transcripts
      transcriptsToAnalyze = await transcriptService.getTranscriptsByIds(resolvedTranscriptIds)
      personasUsed = selectedPersonaIds
      
      logRequest(requestId, 'persona_filtering_applied', {
        selectedPersonas: selectedPersonaIds.length,
        resolvedTranscriptIds: resolvedTranscriptIds.length,
        transcriptsFound: transcriptsToAnalyze.length
      })
    } else {
      // No persona filtering - load all reference data but limit to 4 transcripts
      const referenceData = await loadReferenceData()
      transcriptsToAnalyze = referenceData.transcripts.slice(0, 4) // Apply same 4-transcript limit
      
      logRequest(requestId, 'no_persona_filtering', {
        totalTranscripts: referenceData.transcripts.length,
        limitedTo: transcriptsToAnalyze.length
      })
    }
  } catch (error) {
    logRequest(requestId, 'reference_data_failed', { error: String(error) })
    throw error
  }

  logRequest(requestId, 'reference_data_loaded', { 
    entryCount: transcriptsToAnalyze.length,
    personaFiltered: selectedPersonaIds && selectedPersonaIds.length > 0
  })

  // Step 6: Build prompt
  const promptBuilder = getPromptBuilder()
  const analysisContext = {
    hypothesis,
    referenceData: transcriptsToAnalyze,
    requestId,
    config: {
      maxContextEntries: 4, // Transcripts are longer, use fewer entries
      maxResponseWords: 200,
      includeMetadata: true
    }
  }

  const prompt = promptBuilder.buildAnalysisPrompt(analysisContext)
  const promptValidation = promptBuilder.validatePromptLength(prompt)
  
  if (!promptValidation.valid) {
    logRequest(requestId, 'prompt_validation_failed', promptValidation)
  }

  // Step 7: Claude API analysis
  const claudeService = getClaudeService()
  
  const claudeRequest = {
    hypothesis,
    referenceContext: formatTranscriptsForPrompt(transcriptsToAnalyze, 10000), // Increased from default 3000 to 10000 chars
    requestId
  }

  let analysisResult
  try {
    analysisResult = await claudeService.analyzeHypothesis(claudeRequest)
  } catch (error) {
    logRequest(requestId, 'claude_analysis_failed', { error: String(error) })
    throw error
  }

  logRequest(requestId, 'claude_analysis_completed', {
    tokensUsed: analysisResult.tokensUsed,
    connectionFound: analysisResult.connectionFound,
    claudeProcessingTime: analysisResult.processingTime
  })

  // Step 8: Cache result
  cacheService.set(cacheKey, analysisResult.result, 5 * 60 * 1000) // 5 minutes

  // Step 9: Build response
  const totalProcessingTime = Date.now() - startTime
  
  const response: HypothesisTestResponse = {
    result: analysisResult.result,
    connectionFound: analysisResult.connectionFound,
    processingTime: totalProcessingTime,
    cached: false,
    transcriptsAnalyzed: transcriptsToAnalyze.length,
    personasUsed: personasUsed.length > 0 ? personasUsed : undefined
  }

  logRequest(requestId, 'request_completed', {
    totalProcessingTime,
    claudeProcessingTime: analysisResult.processingTime,
    tokensUsed: analysisResult.tokensUsed,
    responseLength: response.result.length
  })

  return createSecureResponse(response, {
    headers: {
      'X-Cache': 'MISS',
      'X-Request-ID': requestId,
      'X-Tokens-Used': analysisResult.tokensUsed.toString(),
      'X-Processing-Time': totalProcessingTime.toString()
    }
  })
})

/**
 * OPTIONS /api/hypothesis-test - CORS preflight handler
 */
export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  return createSecureResponse(null, {
    status: 200,
    includeCors: true,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '3600'
    }
  })
})

/**
 * Analyze if connection was found based on response text
 */
function analyzeConnectionFound(response: string): boolean {
  const lowerResponse = response.toLowerCase()
  
  // Check for explicit "no connection" phrases
  const noConnectionPhrases = [
    'no reasonable connection',
    'no connection found',
    'no meaningful connection',
    'no direct connection',
    'cannot find any connection'
  ]

  if (noConnectionPhrases.some(phrase => lowerResponse.includes(phrase))) {
    return false
  }

  // Check for positive connection indicators
  const connectionIndicators = [
    'connection found',
    'connections found',
    'related to',
    'supports',
    'contradicts',
    'aligns with',
    'evidence suggests',
    'feedback indicates',
    'id:' // Presence of citation IDs usually indicates connections
  ]

  return connectionIndicators.some(indicator => lowerResponse.includes(indicator))
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `hyp_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
}

/**
 * Structured request logging (without sensitive data)
 */
function logRequest(
  requestId: string, 
  event: string, 
  metadata: Record<string, any> = {}
): void {
  const logLevel = process.env.LOG_LEVEL || 'info'
  
  if (process.env.NODE_ENV === 'development' || logLevel === 'debug') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      event,
      metadata: sanitizeLogMetadata(metadata),
      service: 'hypothesis-test-api'
    }

    console.log(`[API Request] ${JSON.stringify(logEntry)}`)
  }
}

/**
 * Security event logging
 */
function logSecurityEvent(
  requestId: string,
  event: string,
  details?: string
): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    requestId,
    event,
    details,
    severity: 'warning',
    service: 'hypothesis-test-api'
  }

  // Always log security events
  console.warn(`[Security Event] ${JSON.stringify(securityLog)}`)
  
  // In production, you might want to send this to a security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: sendToSecurityService(securityLog)
  }
}

/**
 * Sanitize metadata for logging (remove sensitive information)
 */
function sanitizeLogMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata }
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['apiKey', 'token', 'password', 'secret']
  
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

// Disable caching for this API endpoint
export const revalidate = 0
export const dynamic = 'force-dynamic'