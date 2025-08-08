// Transcript data validation using JSON schema
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { TranscriptCollection } from '@/src/types/transcript'
import * as fs from 'fs'
import * as path from 'path'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    transcriptCount: number
    totalSize: number
    languages: string[]
    averageLength: number
  }
}

class TranscriptValidator {
  private ajv: Ajv
  private schema: any
  
  constructor() {
    this.ajv = new Ajv({ allErrors: true })
    addFormats(this.ajv)
    this.loadSchema()
  }

  private loadSchema(): void {
    try {
      const schemaPath = path.join(process.cwd(), 'public', 'data', 'reference-transcripts.schema.json')
      const schemaContent = fs.readFileSync(schemaPath, 'utf8')
      this.schema = JSON.parse(schemaContent)
    } catch (error) {
      console.error('Failed to load transcript schema:', error)
      // Fallback inline schema
      this.schema = {
        type: 'object',
        required: ['transcripts'],
        properties: {
          transcripts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'content', 'language'],
              properties: {
                id: { type: 'string', minLength: 1 },
                content: { type: 'string', minLength: 50, maxLength: 50000 },
                language: { type: 'string', enum: ['English', 'German'] }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Validate transcript data against schema and business rules
   */
  validateTranscripts(data: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Basic type check
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Data must be a valid JSON object'],
        warnings: [],
        stats: { transcriptCount: 0, totalSize: 0, languages: [], averageLength: 0 }
      }
    }

    // JSON Schema validation
    const validate = this.ajv.compile(this.schema)
    const isSchemaValid = validate(data)
    
    if (!isSchemaValid && validate.errors) {
      validate.errors.forEach(error => {
        const path = error.instancePath || 'root'
        errors.push(`${path}: ${error.message}`)
      })
    }

    // If schema validation fails, return early
    if (!isSchemaValid) {
      return {
        isValid: false,
        errors,
        warnings,
        stats: { transcriptCount: 0, totalSize: 0, languages: [], averageLength: 0 }
      }
    }

    // Business rules validation
    const transcripts = data.transcripts || []
    const ids = new Set<string>()
    const languages = new Set<string>()
    let totalContentLength = 0

    transcripts.forEach((transcript: any, index: number) => {
      // Check for duplicate IDs
      if (ids.has(transcript.id)) {
        errors.push(`Transcript ${index}: Duplicate ID '${transcript.id}'`)
      } else {
        ids.add(transcript.id)
      }

      // Track languages
      if (transcript.language) {
        languages.add(transcript.language)
      }

      // Track content length
      if (transcript.content) {
        totalContentLength += transcript.content.length
      }

      // Content quality checks
      if (transcript.content && transcript.content.length < 200) {
        warnings.push(`Transcript ${transcript.id}: Content seems short (${transcript.content.length} chars)`)
      }

      if (transcript.content && transcript.content.length > 20000) {
        warnings.push(`Transcript ${transcript.id}: Content is very long (${transcript.content.length} chars) - may impact performance`)
      }

      // Check for suspicious content
      if (transcript.content && this.containsSuspiciousContent(transcript.content)) {
        warnings.push(`Transcript ${transcript.id}: Content may contain sensitive information`)
      }
    })

    // Collection-level warnings
    if (transcripts.length < 2) {
      warnings.push('Consider adding more transcript entries for better analysis (minimum 2 recommended)')
    }

    if (transcripts.length > 20) {
      warnings.push('Large number of transcripts may impact performance - consider splitting into smaller datasets')
    }

    if (languages.size < 1) {
      warnings.push('No language information found in transcripts')
    }

    const averageLength = transcripts.length > 0 ? Math.round(totalContentLength / transcripts.length) : 0
    const totalSize = JSON.stringify(data).length

    // Size warnings
    if (totalSize > 5 * 1024 * 1024) { // 5MB
      warnings.push('Dataset is large (>5MB) - may cause performance issues')
    }

    const stats = {
      transcriptCount: transcripts.length,
      totalSize,
      languages: Array.from(languages),
      averageLength
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats
    }
  }

  /**
   * Validate file content before parsing
   */
  validateFile(content: string): { isValid: boolean; error?: string } {
    // Check file size
    if (content.length > 10 * 1024 * 1024) { // 10MB limit
      return { isValid: false, error: 'File too large (maximum 10MB)' }
    }

    if (content.length < 10) {
      return { isValid: false, error: 'File appears to be empty or too small' }
    }

    // Check if it's valid JSON
    try {
      JSON.parse(content)
      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: 'File is not valid JSON format' }
    }
  }

  /**
   * Sanitize transcript data for security
   */
  sanitizeTranscripts(data: TranscriptCollection): TranscriptCollection {
    return {
      ...data,
      transcripts: data.transcripts.map(transcript => ({
        ...transcript,
        content: this.sanitizeText(transcript.content),
        course: transcript.course ? this.sanitizeText(transcript.course) : transcript.course,
        semester: transcript.semester ? this.sanitizeText(transcript.semester) : transcript.semester,
        gender: transcript.gender
      }))
    }
  }

  private sanitizeText(text: string): string {
    return text
      // Remove null bytes and control characters (except newlines and tabs)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize excessive whitespace
      .replace(/\s{4,}/g, '   ')
      // Remove any potential script injections
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:[^;]*;base64,/gi, '')
      .trim()
  }

  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card patterns
      /<script/i, // Script tags
      /password\s*[:=]/i, // Password fields
    ]

    return suspiciousPatterns.some(pattern => pattern.test(content))
  }
}

// Singleton instance
let validatorInstance: TranscriptValidator | null = null

export function getTranscriptValidator(): TranscriptValidator {
  if (!validatorInstance) {
    validatorInstance = new TranscriptValidator()
  }
  return validatorInstance
}

export { TranscriptValidator }
export type { ValidationResult }