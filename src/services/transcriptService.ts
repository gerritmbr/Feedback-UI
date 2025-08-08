// TranscriptService - Server-side transcript data management
// This service handles filtering and retrieval of transcript data based on transcript IDs

import { TranscriptCollection, TranscriptEntry } from '@/src/types/transcript'
import { loadReferenceData } from '@/src/lib/utils/reference-data'

export class TranscriptService {
  private transcripts: Map<string, TranscriptEntry> = new Map()
  private initialized = false

  constructor() {
    // Initialize on first use (lazy loading)
  }

  private async initialize() {
    if (this.initialized) return

    try {
      const result = await loadReferenceData()
      this.loadTranscripts(result.data)
      this.initialized = true
      console.log('TranscriptService initialized with', this.transcripts.size, 'transcripts from', result.source)
    } catch (error) {
      console.error('Failed to initialize TranscriptService:', error)
      throw error
    }
  }

  /**
   * Initialize with specific transcript data (for persona filtering)
   */
  async initializeWithData(transcriptData: TranscriptCollection) {
    this.loadTranscripts(transcriptData)
    this.initialized = true
    console.log('TranscriptService initialized with provided data:', this.transcripts.size, 'transcripts')
  }

  private loadTranscripts(transcriptData: TranscriptCollection) {
    console.log('Loading transcript data into TranscriptService...')
    console.log(`Processing ${transcriptData.transcripts.length} transcripts`)

    transcriptData.transcripts.forEach((transcript, index) => {
      this.transcripts.set(transcript.id, transcript)
      console.log(`  Loaded transcript ${transcript.id}: ${transcript.language}, ${transcript.content.length} chars`)
    })

    console.log(`Loaded ${this.transcripts.size} transcripts successfully`)
  }

  /**
   * Get transcripts by specific IDs (for persona filtering)
   */
  async getTranscriptsByIds(transcriptIds: string[]): Promise<TranscriptEntry[]> {
    await this.initialize()

    if (!transcriptIds || transcriptIds.length === 0) {
      return []
    }

    const results: TranscriptEntry[] = []
    const notFound: string[] = []

    transcriptIds.forEach(id => {
      const transcript = this.transcripts.get(id)
      if (transcript) {
        results.push(transcript)
      } else {
        notFound.push(id)
      }
    })

    if (notFound.length > 0) {
      console.warn('TranscriptService: Transcript IDs not found:', notFound)
    }

    console.log(`TranscriptService: Retrieved ${results.length}/${transcriptIds.length} transcripts`, {
      requested: transcriptIds,
      found: results.map(t => t.id),
      notFound
    })

    return results
  }

  /**
   * Get all available transcripts (for no persona filtering)
   */
  async getAllTranscripts(): Promise<TranscriptEntry[]> {
    await this.initialize()
    return Array.from(this.transcripts.values())
  }

  /**
   * Get available transcript IDs (for debugging/validation)
   */
  async getAvailableTranscriptIds(): Promise<string[]> {
    await this.initialize()
    return Array.from(this.transcripts.keys())
  }

  /**
   * Get transcript statistics (for debugging/monitoring)
   */
  async getTranscriptStats(): Promise<{
    totalCount: number
    averageLength: number
    languageBreakdown: Record<string, number>
  }> {
    await this.initialize()

    const transcripts = Array.from(this.transcripts.values())
    const totalCount = transcripts.length
    const totalLength = transcripts.reduce((sum, t) => sum + t.content.length, 0)
    const averageLength = totalCount > 0 ? Math.round(totalLength / totalCount) : 0

    const languageBreakdown: Record<string, number> = {}
    transcripts.forEach(t => {
      languageBreakdown[t.language] = (languageBreakdown[t.language] || 0) + 1
    })

    return {
      totalCount,
      averageLength,
      languageBreakdown
    }
  }

  /**
   * Validate that transcript IDs exist
   */
  async validateTranscriptIds(transcriptIds: string[]): Promise<{
    valid: string[]
    invalid: string[]
  }> {
    await this.initialize()

    const valid: string[] = []
    const invalid: string[] = []

    transcriptIds.forEach(id => {
      if (this.transcripts.has(id)) {
        valid.push(id)
      } else {
        invalid.push(id)
      }
    })

    return { valid, invalid }
  }
}

// Singleton instance
let transcriptServiceInstance: TranscriptService | null = null

export function getTranscriptService(): TranscriptService {
  if (!transcriptServiceInstance) {
    transcriptServiceInstance = new TranscriptService()
  }
  return transcriptServiceInstance
}