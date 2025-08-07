// Advanced prompt engineering system for hypothesis analysis

import { TranscriptEntry } from '@/src/types/transcript'

/**
 * Prompt template configuration
 */
interface PromptConfig {
  maxContextEntries: number    // Maximum reference entries to include
  maxResponseWords: number     // Maximum words in response
  includeMetadata: boolean     // Whether to include entry metadata
  language: 'auto' | 'english' | 'german'  // Response language preference
  analysisDepth: 'brief' | 'detailed'      // Analysis detail level
}

/**
 * Analysis context for prompt generation
 */
interface AnalysisContext {
  hypothesis: string
  referenceData: TranscriptEntry[]
  config?: Partial<PromptConfig>
  requestId?: string
}

/**
 * Prompt templates for different analysis scenarios
 */
const PROMPT_TEMPLATES = {
  /**
   * Standard hypothesis analysis template for transcript data
   */
  standard: {
    systemPrompt: `You are a university education analyst. Your task is to analyze student hypotheses against real interview transcript data from student surveys about their educational experiences.

Instructions:
1. Compare the user's hypothesis with the provided interview transcript data
2. Look for direct connections, patterns, or contradictions in student statements
3. Cite specific interview IDs when connections are found
4. Keep responses under {{maxWords}} words
5. If no meaningful connection exists, respond exactly: "No reasonable connection to your input found in the data."

Response format:
- Start with connection assessment (Connection found/No connection found)
- Include 1-2 specific citations with Interview IDs if connections exist
- Provide brief analysis (2-3 sentences max)
- Use markdown for formatting citations

Note: The transcripts contain conversational interview data between AI interviewer (AI) and students (User). Focus on the User responses and their educational preferences/experiences.`,

    userPrompt: `Hypothesis: "{{hypothesis}}"

Interview Transcript Data:
{{referenceContext}}

Analyze the hypothesis against these interview transcripts and provide your assessment:`
  },

  /**
   * Detailed analysis template for complex hypotheses
   */
  detailed: {
    systemPrompt: `You are an expert university course feedback analyst. Your task is to provide detailed analysis of student hypotheses against course feedback data.

Instructions:
1. Thoroughly analyze the hypothesis against ALL provided feedback entries
2. Identify direct connections, patterns, trends, and contradictions
3. Cite specific feedback entries with IDs and brief quotes
4. Consider multiple perspectives and nuances in the data
5. Provide confidence levels for your conclusions
6. Keep responses under {{maxWords}} words
7. If no meaningful connection exists, respond exactly: "No reasonable connection to your input found in the data."

Response format:
- Connection Assessment: [Found/Not Found] with confidence level
- Evidence Analysis: Key findings with specific citations
- Pattern Recognition: Trends or themes identified
- Conclusion: Brief summary with implications`,

    userPrompt: `Hypothesis for detailed analysis: "{{hypothesis}}"

Comprehensive Reference Data ({{entryCount}} entries):
{{referenceContext}}

Provide a thorough analysis of this hypothesis against the reference data:`
  },

  /**
   * Comparative analysis template
   */
  comparative: {
    systemPrompt: `You are a comparative analysis expert for university course feedback. Your task is to analyze hypotheses by comparing different aspects of the feedback data.

Instructions:
1. Compare the hypothesis across different courses, languages, or categories
2. Identify similarities and differences in the feedback patterns
3. Highlight contrasts between different student perspectives
4. Use specific citations with entry IDs to support comparisons
5. Keep responses under {{maxWords}} words
6. If no meaningful connection exists, respond exactly: "No reasonable connection to your input found in the data."

Response format:
- Comparative Assessment: Overall comparison result
- Key Similarities: Common patterns found
- Notable Differences: Contrasting perspectives
- Supporting Evidence: Specific citations with IDs`,

    userPrompt: `Hypothesis for comparative analysis: "{{hypothesis}}"

Multi-dimensional Reference Data:
{{referenceContext}}

Perform a comparative analysis of this hypothesis across the provided feedback data:`
  }
}

/**
 * Advanced prompt builder with dynamic context selection
 */
export class PromptBuilder {
  private readonly defaultConfig: PromptConfig = {
    maxContextEntries: 4,  // Transcripts are longer, use fewer entries
    maxResponseWords: 200,
    includeMetadata: true,
    language: 'auto',
    analysisDepth: 'brief'
  }

  /**
   * Build optimized prompt for hypothesis analysis
   */
  buildAnalysisPrompt(context: AnalysisContext): string {
    const config = { ...this.defaultConfig, ...context.config }
    
    // Select appropriate template
    const templateKey = this.selectTemplate(context.hypothesis, config.analysisDepth)
    const template = PROMPT_TEMPLATES[templateKey]
    
    // Select and format reference data
    const selectedEntries = this.selectRelevantEntries(
      context.referenceData, 
      context.hypothesis,
      config.maxContextEntries
    )
    
    const referenceContext = this.formatReferenceData(selectedEntries, config)
    
    // Build complete prompt
    const systemPrompt = this.interpolateTemplate(template.systemPrompt, {
      maxWords: config.maxResponseWords.toString(),
      analysisType: config.analysisDepth
    })
    
    const userPrompt = this.interpolateTemplate(template.userPrompt, {
      hypothesis: context.hypothesis,
      referenceContext,
      entryCount: selectedEntries.length.toString()
    })
    
    return `${systemPrompt}\n\n${userPrompt}`
  }

  /**
   * Select most appropriate template based on hypothesis and requirements
   */
  private selectTemplate(
    hypothesis: string, 
    analysisDepth: PromptConfig['analysisDepth']
  ): keyof typeof PROMPT_TEMPLATES {
    // Use detailed template for longer, complex hypotheses
    if (analysisDepth === 'detailed' || hypothesis.length > 200) {
      return 'detailed'
    }

    // Use comparative template if hypothesis mentions comparisons
    const comparativeKeywords = [
      'compare', 'versus', 'vs', 'difference', 'similar', 'unlike',
      'better', 'worse', 'more', 'less', 'between', 'across'
    ]
    
    if (comparativeKeywords.some(keyword => 
      hypothesis.toLowerCase().includes(keyword)
    )) {
      return 'comparative'
    }

    // Default to standard template
    return 'standard'
  }

  /**
   * Select most relevant reference entries for the hypothesis
   */
  private selectRelevantEntries(
    entries: FeedbackEntry[],
    hypothesis: string,
    maxEntries: number
  ): FeedbackEntry[] {
    if (entries.length <= maxEntries) {
      return entries
    }

    // Score entries based on relevance to hypothesis
    const scoredEntries = entries.map(entry => ({
      entry,
      score: this.calculateRelevanceScore(entry, hypothesis)
    }))

    // Sort by relevance score and take top entries
    return scoredEntries
      .sort((a, b) => b.score - a.score)
      .slice(0, maxEntries)
      .map(item => item.entry)
  }

  /**
   * Calculate relevance score between transcript entry and hypothesis
   */
  private calculateRelevanceScore(entry: TranscriptEntry, hypothesis: string): number {
    let score = 0
    
    const hypothesisWords = this.extractKeywords(hypothesis)
    const contentWords = this.extractKeywords(entry.content)
    
    // Keyword overlap score
    const commonWords = hypothesisWords.filter(word => 
      contentWords.includes(word)
    )
    score += commonWords.length * 2
    
    // Educational theme relevance (if hypothesis mentions education-related terms)
    const educationalKeywords = {
      teaching: ['teaching', 'professor', 'instructor', 'explanation', 'lecture'],
      learning: ['learning', 'study', 'understand', 'knowledge', 'skill'],
      assessment: ['assessment', 'exam', 'test', 'grading', 'evaluation', 'grade'],
      format: ['format', 'structure', 'organization', 'layout', 'presentation'],
      participation: ['participation', 'discussion', 'group', 'interaction', 'active'],
      language: ['language', 'english', 'german', 'communication'],
      workload: ['workload', 'homework', 'assignments', 'time', 'credit points'],
      preference: ['prefer', 'like', 'enjoy', 'favorite', 'best', 'worst']
    }
    
    // Check for educational theme matches
    let themeMatches = 0
    Object.values(educationalKeywords).forEach(themeWords => {
      const matches = hypothesisWords.filter(word =>
        themeWords.some(themeWord => themeWord.includes(word) || word.includes(themeWord))
      )
      themeMatches += matches.length
    })
    score += themeMatches * 2
    
    // Length bonus (longer content might be more informative)
    score += Math.min(entry.content.length / 100, 2)
    
    // Language preference (slight bonus for English in mixed datasets)
    if (entry.language === 'English') {
      score += 0.5
    }
    
    return score
  }

  /**
   * Extract keywords from text for relevance scoring
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3) // Filter out short words
      .filter(word => !this.isStopWord(word))
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
      'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'very', 'well',
      'were', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'when', 'come', 'here',
      'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than',
      'them', 'well', 'were'
    ]
    
    return stopWords.includes(word)
  }

  /**
   * Format reference data for prompt inclusion
   */
  private formatReferenceData(
    entries: TranscriptEntry[],
    config: PromptConfig
  ): string {
    return entries.map((entry, index) => {
      let formatted = `--- Interview ${index + 1} ---\nID: ${entry.id}\n`
      
      if (config.includeMetadata) {
        formatted += `Language: ${entry.language}\n`
        if (entry.course) formatted += `Course: ${entry.course}\n`
        if (entry.semester) formatted += `Semester: ${entry.semester}\n`
        if (entry.gender) formatted += `Gender: ${entry.gender}\n`
      }
      
      // Truncate very long transcripts to keep prompt manageable
      const content = entry.content.length > 3000 
        ? entry.content.substring(0, 3000) + '...[truncated]'
        : entry.content
      
      formatted += `Content: "${content}"`
      
      return formatted
    }).join('\n\n')
  }

  /**
   * Interpolate template with variables
   */
  private interpolateTemplate(
    template: string, 
    variables: Record<string, string>
  ): string {
    let result = template
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      result = result.replace(new RegExp(placeholder, 'g'), value)
    })
    
    return result
  }

  /**
   * Create specialized prompt for testing/validation
   */
  buildTestPrompt(hypothesis: string, entries: FeedbackEntry[]): string {
    const context: AnalysisContext = {
      hypothesis,
      referenceData: entries,
      config: {
        maxContextEntries: Math.min(entries.length, 5),
        maxResponseWords: 100,
        includeMetadata: false,
        analysisDepth: 'brief'
      }
    }
    
    return this.buildAnalysisPrompt(context)
  }

  /**
   * Validate prompt length for API limits
   */
  validatePromptLength(prompt: string): {
    valid: boolean
    estimatedTokens: number
    warnings: string[]
  } {
    const estimatedTokens = Math.ceil(prompt.length / 4) // Rough estimate
    const warnings: string[] = []
    
    if (estimatedTokens > 8000) { // Conservative limit for Claude
      warnings.push('Prompt may exceed token limits')
    }
    
    if (prompt.length > 100000) { // 100KB character limit
      warnings.push('Prompt is very long and may cause performance issues')
    }
    
    return {
      valid: estimatedTokens <= 8000,
      estimatedTokens,
      warnings
    }
  }
}

/**
 * Singleton prompt builder instance
 */
let promptBuilderInstance: PromptBuilder | null = null

/**
 * Get or create prompt builder instance
 */
export function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder()
  }
  return promptBuilderInstance
}

/**
 * Quick utility function to build standard analysis prompt
 */
export function buildStandardPrompt(
  hypothesis: string,
  referenceData: FeedbackEntry[]
): string {
  const builder = getPromptBuilder()
  return builder.buildAnalysisPrompt({
    hypothesis,
    referenceData
  })
}