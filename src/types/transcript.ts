// Type definitions for interview transcript data

/**
 * Individual transcript entry from interview data
 */
export interface TranscriptEntry {
  id: string
  content: string        // Full interview transcript
  language: string       // "English" or "German"
  course?: string        // Course of study (optional)
  semester?: string      // Semester number (optional)
  gender?: string        // Gender of interviewee (optional)
}

/**
 * Complete transcript data collection
 */
export interface TranscriptCollection {
  transcripts: TranscriptEntry[]
  metadata?: {
    lastUpdated?: string
    totalEntries?: number
    version?: string
  }
}

/**
 * Statistics for transcript data
 */
export interface TranscriptStats {
  totalEntries: number
  byLanguage: Record<string, number>
  byCourse: Record<string, number>
  bySemester: Record<string, number>
  byGender: Record<string, number>
  averageContentLength: number
  totalContentLength: number
}

/**
 * Validation result for transcript data
 */
export interface TranscriptValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: TranscriptStats
}

/**
 * Valid languages for transcripts
 */
export type TranscriptLanguage = 'English' | 'German'

/**
 * Valid genders for transcripts  
 */
export type TranscriptGender = 'male' | 'female' | 'other' | 'prefer-not-to-say'