// Utility functions for loading and working with reference interview transcript data

import { TranscriptCollection, TranscriptEntry, TranscriptStats, TranscriptValidationResult, TranscriptLanguage, TranscriptGender } from '@/src/types/transcript'
import fs from 'fs'
import path from 'path'

/**
 * Load reference transcript data from JSON file
 * This function validates the data structure and provides type safety
 */
export async function loadReferenceData(): Promise<TranscriptCollection> {
  try {
    // Use fs.readFileSync for server-side API routes
    const filePath = path.join(process.cwd(), 'public', 'data', 'reference-transcripts.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent) as TranscriptCollection
    
    // Validate the data structure
    const validation = validateTranscriptData(data)
    if (!validation.isValid) {
      console.error('Reference transcript data validation failed:', validation.errors)
      throw new Error('Invalid reference transcript data structure')
    }
    
    if (validation.warnings.length > 0) {
      console.warn('Reference transcript data warnings:', validation.warnings)
    }
    
    return data
  } catch (error) {
    console.error('Error loading reference transcript data:', error)
    throw new Error('Failed to load reference transcript data')
  }
}

/**
 * Validate transcript data structure and content
 */
export function validateTranscriptData(data: any): TranscriptValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check top-level structure
  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object')
    return { isValid: false, errors, warnings, stats: getEmptyStats() }
  }
  
  if (!Array.isArray(data.transcripts)) {
    errors.push('transcripts must be an array')
  }
  
  if (data.metadata && typeof data.metadata !== 'object') {
    warnings.push('metadata should be an object if provided')
  }
  
  // Validate transcript entries
  const validEntries: TranscriptEntry[] = []
  if (Array.isArray(data.transcripts)) {
    data.transcripts.forEach((entry: any, index: number) => {
      const entryErrors = validateTranscriptEntry(entry, index)
      errors.push(...entryErrors)
      
      if (entryErrors.length === 0) {
        validEntries.push(entry)
      }
    })
  }
  
  // Check for duplicate IDs
  const ids = validEntries.map(entry => entry.id)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate entry IDs found: ${duplicateIds.join(', ')}`)
  }
  
  // Generate warnings for data quality
  if (validEntries.length < 3) {
    warnings.push('Consider adding more transcript entries for better analysis (minimum 3 recommended)')
  }
  
  const languages = new Set(validEntries.map(entry => entry.language))
  if (languages.size < 2) {
    warnings.push('Consider adding transcripts in multiple languages for broader coverage')
  }
  
  // Check for very short transcripts
  const shortTranscripts = validEntries.filter(entry => entry.content.length < 500)
  if (shortTranscripts.length > 0) {
    warnings.push(`${shortTranscripts.length} transcript(s) seem unusually short (< 500 characters)`)
  }
  
  const stats = calculateTranscriptStats(validEntries)
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats
  }
}

/**
 * Validate individual transcript entry
 */
function validateTranscriptEntry(entry: any, index: number): string[] {
  const errors: string[] = []
  const prefix = `Entry ${index}:`
  
  if (!entry || typeof entry !== 'object') {
    errors.push(`${prefix} must be an object`)
    return errors
  }
  
  // Required fields
  const requiredFields = ['id', 'content', 'language']
  requiredFields.forEach(field => {
    if (!entry[field] || typeof entry[field] !== 'string') {
      errors.push(`${prefix} ${field} must be a non-empty string`)
    }
  })
  
  // Validate language
  if (entry.language && !['English', 'German'].includes(entry.language)) {
    errors.push(`${prefix} language must be 'English' or 'German'`)
  }
  
  // Validate content length
  if (entry.content && entry.content.length < 50) {
    errors.push(`${prefix} content is too short (minimum 50 characters for meaningful transcript)`)
  }
  
  if (entry.content && entry.content.length > 50000) {
    errors.push(`${prefix} content is too long (maximum 50,000 characters)`)
  }
  
  // Validate optional fields if present
  if (entry.semester && typeof entry.semester !== 'string') {
    errors.push(`${prefix} semester must be a string if provided`)
  }
  
  if (entry.course && typeof entry.course !== 'string') {
    errors.push(`${prefix} course must be a string if provided`)
  }
  
  if (entry.gender && !['male', 'female', 'other', 'prefer-not-to-say'].includes(entry.gender)) {
    warnings.push(`${prefix} gender should be one of: male, female, other, prefer-not-to-say`)
  }
  
  return errors
}

/**
 * Calculate statistics for transcript data
 */
export function calculateTranscriptStats(entries: TranscriptEntry[]): TranscriptStats {
  const byLanguage: Record<string, number> = {}
  const byCourse: Record<string, number> = {}
  const bySemester: Record<string, number> = {}
  const byGender: Record<string, number> = {}
  let totalContentLength = 0
  
  entries.forEach(entry => {
    // Count by language
    byLanguage[entry.language] = (byLanguage[entry.language] || 0) + 1
    
    // Count by course (if provided)
    if (entry.course) {
      byCourse[entry.course] = (byCourse[entry.course] || 0) + 1
    }
    
    // Count by semester (if provided)
    if (entry.semester) {
      bySemester[entry.semester] = (bySemester[entry.semester] || 0) + 1
    }
    
    // Count by gender (if provided)
    if (entry.gender) {
      byGender[entry.gender] = (byGender[entry.gender] || 0) + 1
    }
    
    // Sum content length
    totalContentLength += entry.content.length
  })
  
  return {
    totalEntries: entries.length,
    byLanguage,
    byCourse,
    bySemester, 
    byGender,
    averageContentLength: entries.length > 0 ? Math.round(totalContentLength / entries.length) : 0,
    totalContentLength
  }
}

/**
 * Get empty stats object
 */
function getEmptyStats(): TranscriptStats {
  return {
    totalEntries: 0,
    byLanguage: {},
    byCourse: {},
    bySemester: {},
    byGender: {},
    averageContentLength: 0,
    totalContentLength: 0
  }
}

/**
 * Format transcript entries for Claude API context
 * Truncates very long transcripts to keep prompts manageable
 */
export function formatTranscriptsForPrompt(entries: TranscriptEntry[], maxLength: number = 3000): string {
  return entries.map((entry, index) => {
    // Truncate very long transcripts to keep prompt manageable
    const content = entry.content.length > maxLength 
      ? entry.content.substring(0, maxLength) + '...[truncated]'
      : entry.content
    
    const metadata = [
      `ID: ${entry.id}`,
      `Language: ${entry.language}`,
      entry.course && `Course: ${entry.course}`,
      entry.semester && `Semester: ${entry.semester}`,
      entry.gender && `Gender: ${entry.gender}`
    ].filter(Boolean).join(' | ')
    
    return `--- Interview ${index + 1} ---\n${metadata}\nContent: "${content}"\n`
  }).join('\n')
}

/**
 * Extract key themes from transcript for better analysis
 * This helps Claude focus on relevant parts of long transcripts
 */
export function extractTranscriptKeywords(entry: TranscriptEntry): string[] {
  const content = entry.content.toLowerCase()
  
  // Define educational keywords that are likely relevant for hypothesis testing
  const educationalKeywords = [
    'lecture', 'course', 'teaching', 'learning', 'study', 'professor', 'student',
    'exam', 'assignment', 'group work', 'presentation', 'seminar', 'practical',
    'theory', 'feedback', 'evaluation', 'grade', 'credit points', 'semester',
    'master', 'bachelor', 'university', 'research', 'project', 'case study',
    'discussion', 'participation', 'language', 'english', 'german', 'format',
    'online', 'offline', 'interactive', 'traditional', 'innovative', 'effective'
  ]
  
  return educationalKeywords.filter(keyword => content.includes(keyword))
}

/**
 * Get transcript summary for prompt context optimization
 */
export function getTranscriptSummary(entry: TranscriptEntry): string {
  const keywords = extractTranscriptKeywords(entry)
  const wordCount = entry.content.split(/\s+/).length
  
  return `Interview ${entry.id} (${entry.language}, ~${wordCount} words): Discusses ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? '...' : ''}`
}