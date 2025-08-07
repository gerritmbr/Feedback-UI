// Claude API service with retry logic, circuit breaker, and robust error handling

import Anthropic from '@anthropic-ai/sdk'
import { ClaudeAPIError, TimeoutError, CircuitBreaker } from '@/src/lib/middleware/error-handler'

/**
 * Claude API service configuration
 */
interface ClaudeServiceConfig {
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

/**
 * Analysis request interface
 */
interface AnalysisRequest {
  hypothesis: string
  referenceContext: string
  requestId?: string
}

/**
 * Analysis response interface
 */
interface AnalysisResponse {
  result: string
  connectionFound: boolean
  processingTime: number
  tokensUsed: number
  model: string
}

/**
 * Claude API service with enterprise-grade reliability
 */
export class ClaudeService {
  private client: Anthropic
  private config: ClaudeServiceConfig
  private circuitBreaker: CircuitBreaker
  private requestCount = 0
  private totalTokensUsed = 0

  constructor(config?: Partial<ClaudeServiceConfig>) {
    // Default configuration
    this.config = {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1, // Low temperature for consistent analysis
      timeout: 30000, // 30 seconds
      maxRetries: 3,
      baseDelay: 1000, // 1 second base delay
      maxDelay: 10000, // 10 second max delay
      ...config
    }

    if (!this.config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    // Initialize Claude client
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    })

    // Initialize circuit breaker (5 failures, 60s recovery)
    this.circuitBreaker = new CircuitBreaker(5, 60000)
  }

  /**
   * Analyze hypothesis against reference data
   * @param request Analysis request
   * @returns Analysis response
   */
  async analyzeHypothesis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now()
    const requestId = request.requestId || this.generateRequestId()

    this.logRequest(requestId, 'Starting hypothesis analysis')

    try {
      // Use circuit breaker to protect against cascading failures
      const result = await this.circuitBreaker.execute(async () => {
        return await this.performAnalysisWithRetry(request, requestId)
      })

      const processingTime = Date.now() - startTime
      this.requestCount++

      this.logRequest(requestId, `Analysis completed in ${processingTime}ms`)

      return {
        ...result,
        processingTime
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      this.logError(requestId, error, processingTime)
      
      // Transform errors to our standard types
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new TimeoutError('Analysis request timed out')
        }
        
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          throw new ClaudeAPIError('Rate limit exceeded. Please try again later.', 429)
        }

        if (error.message.includes('overloaded') || error.message.includes('503')) {
          throw new ClaudeAPIError('Claude API is temporarily overloaded', 503)
        }

        if (error.message.includes('invalid') || error.message.includes('400')) {
          throw new ClaudeAPIError('Invalid request to Claude API', 400)
        }
      }

      // Default to generic Claude API error
      throw new ClaudeAPIError('Failed to analyze hypothesis with Claude API')
    }
  }

  /**
   * Perform analysis with exponential backoff retry
   */
  private async performAnalysisWithRetry(
    request: AnalysisRequest, 
    requestId: string
  ): Promise<Omit<AnalysisResponse, 'processingTime'>> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logRequest(requestId, `Analysis attempt ${attempt}/${this.config.maxRetries}`)
        
        const result = await this.callClaudeAPI(request.hypothesis, request.referenceContext)
        
        // Parse response to determine if connection was found
        const connectionFound = this.analyzeConnectionFound(result)
        
        return {
          result,
          connectionFound,
          tokensUsed: this.estimateTokensUsed(request.hypothesis, request.referenceContext, result),
          model: this.config.model
        }

      } catch (error) {
        lastError = error as Error
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error
        }

        // Calculate delay with exponential backoff and jitter
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateRetryDelay(attempt)
          this.logRequest(requestId, `Attempt ${attempt} failed, retrying in ${delay}ms`)
          await this.sleep(delay)
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('All retry attempts exhausted')
  }

  /**
   * Make the actual Claude API call
   */
  private async callClaudeAPI(hypothesis: string, referenceContext: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [{
          role: 'user',
          content: this.buildPrompt(hypothesis, referenceContext)
        }]
      })

      // Extract text content from response
      const textContent = message.content
        .filter(content => content.type === 'text')
        .map(content => content.text)
        .join('\n')

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('Empty response from Claude API')
      }

      // Update token usage tracking
      this.totalTokensUsed += message.usage.input_tokens + message.usage.output_tokens

      return textContent.trim()

    } catch (error) {
      // Handle Anthropic SDK specific errors
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error: ${error.message} (${error.status})`)
      }
      
      if (error instanceof Anthropic.APIConnectionError) {
        throw new Error('Failed to connect to Claude API')
      }

      if (error instanceof Anthropic.RateLimitError) {
        throw new Error('Claude API rate limit exceeded')
      }

      throw error
    }
  }

  /**
   * Build the prompt for Claude API
   */
  private buildPrompt(hypothesis: string, referenceContext: string): string {
    return `You are a university education analyst. Your task is to analyze student hypotheses against real interview transcript data from student surveys about their educational experiences.

Instructions:
1. Compare the user's hypothesis with the provided interview transcript data
2. Look for direct connections, patterns, or contradictions in student statements
3. Cite specific interview IDs when connections are found
4. Keep responses under 200 words
5. If no meaningful connection exists, respond exactly: "No reasonable connection to your input found in the data."

Response format:
- Start with connection assessment (Connection found/No connection found)
- Include 1-2 specific citations with Interview IDs if connections exist
- Provide brief analysis (2-3 sentences max)
- Use markdown for formatting citations

Note: The transcripts contain conversational interview data between AI interviewer (AI) and students (User). Focus on the User responses and their educational preferences/experiences.

Hypothesis: "${hypothesis}"

Interview Transcript Data:
${referenceContext}

Analyze the hypothesis against these interview transcripts and provide your assessment:`
  }

  /**
   * Determine if connection was found based on response
   */
  private analyzeConnectionFound(response: string): boolean {
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
      'feedback indicates'
    ]

    return connectionIndicators.some(indicator => lowerResponse.includes(indicator))
  }

  /**
   * Estimate tokens used (rough approximation)
   */
  private estimateTokensUsed(hypothesis: string, context: string, response: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    const totalChars = hypothesis.length + context.length + response.length
    return Math.ceil(totalChars / 4)
  }

  /**
   * Check if error should not be retried
   */
  private shouldNotRetry(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      // Don't retry on client errors (4xx)
      if (message.includes('400') || 
          message.includes('401') || 
          message.includes('403') || 
          message.includes('invalid')) {
        return true
      }

      // Don't retry on permanent failures
      if (message.includes('permission denied') ||
          message.includes('unauthorized') ||
          message.includes('forbidden')) {
        return true
      }
    }

    return false
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 0.3 * exponentialDelay // 30% jitter
    const delayWithJitter = exponentialDelay + jitter
    
    return Math.min(delayWithJitter, this.config.maxDelay)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log request information
   */
  private logRequest(requestId: string, message: string): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`[Claude Service] ${requestId}: ${message}`)
    }
  }

  /**
   * Log error information
   */
  private logError(requestId: string, error: unknown, processingTime: number): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error(`[Claude Service] ${requestId}: Error after ${processingTime}ms - ${errorMessage}`)
    
    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Example: send to logging service
      // logToService({ requestId, error: errorMessage, processingTime })
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    requestCount: number
    totalTokensUsed: number
    circuitBreakerOpen: boolean
    averageTokensPerRequest: number
  } {
    return {
      requestCount: this.requestCount,
      totalTokensUsed: this.totalTokensUsed,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      averageTokensPerRequest: this.requestCount > 0 ? 
        Math.round(this.totalTokensUsed / this.requestCount) : 0
    }
  }

  /**
   * Health check for the Claude service
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    try {
      // Don't make actual API call to avoid costs
      // Just verify configuration and circuit breaker state
      if (!this.config.apiKey) {
        return { healthy: false, details: 'API key not configured' }
      }

      if (this.circuitBreaker.isOpen) {
        return { healthy: false, details: 'Circuit breaker is open' }
      }

      return { healthy: true }
    } catch (error) {
      return { 
        healthy: false, 
        details: error instanceof Error ? error.message : 'Health check failed' 
      }
    }
  }
}

/**
 * Singleton instance of Claude service
 */
let claudeServiceInstance: ClaudeService | null = null

/**
 * Get or create Claude service instance
 */
export function getClaudeService(): ClaudeService {
  if (!claudeServiceInstance) {
    claudeServiceInstance = new ClaudeService()
  }
  return claudeServiceInstance
}