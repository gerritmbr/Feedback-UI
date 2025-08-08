// PersonaService - Server-side persona-to-transcript resolution and validation
// This service handles the mapping between persona IDs and transcript IDs

import * as d3 from 'd3'
import * as fs from 'fs'
import * as path from 'path'

interface PersonaCSVRow {
  Id: string
  Label: string
  content: string
  node_type: string
  node_multiplicity: string
  transcript_id?: string
}

export class PersonaService {
  private personaTranscriptMap: Map<string, string[]> = new Map()
  private initialized = false

  constructor() {
    // Initialize on first use (lazy loading)
  }

  private async initialize() {
    if (this.initialized) return

    try {
      await this.loadPersonaTranscriptMappings()
      this.initialized = true
      console.log('PersonaService initialized with', this.personaTranscriptMap.size, 'persona mappings')
    } catch (error) {
      console.error('Failed to initialize PersonaService:', error)
      throw error
    }
  }

  private async loadPersonaTranscriptMappings() {
    // Load persona_nodes.csv from public/data directory
    const csvPath = path.join(process.cwd(), 'public', 'data', 'persona_nodes.csv')
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Persona CSV file not found at: ${csvPath}`)
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const personas = d3.csvParse(csvContent) as PersonaCSVRow[]

    console.log('Loading persona-transcript mappings from CSV...')
    console.log(`Found ${personas.length} persona entries`)

    personas.forEach((persona, index) => {
      // Only process persona nodes (not attribute nodes)
      if (persona.node_type === 'persona' && persona.transcript_id) {
        const transcriptIds = persona.transcript_id
          .split('|')
          .map(id => id.trim())
          .filter(id => id.length > 0)

        if (transcriptIds.length > 0) {
          this.personaTranscriptMap.set(persona.Id, transcriptIds)
          console.log(`  Persona ${persona.Id} (${persona.Label}): ${transcriptIds.join(', ')}`)
        }
      } else if (persona.node_type === 'persona' && !persona.transcript_id) {
        console.warn(`  Persona ${persona.Id} has no transcript_id - skipping`)
      }
    })

    const personaCount = Array.from(this.personaTranscriptMap.keys()).length
    const totalTranscriptIds = Array.from(this.personaTranscriptMap.values())
      .flat()
      .filter((id, index, arr) => arr.indexOf(id) === index).length

    console.log(`Loaded ${personaCount} personas with ${totalTranscriptIds} unique transcript IDs`)
  }

  /**
   * Resolve transcript IDs from persona IDs
   * Applies business rule: maximum 4 transcripts per analysis
   */
  async resolveTranscriptIds(personaIds: string[]): Promise<string[]> {
    await this.initialize()

    if (!personaIds || personaIds.length === 0) {
      return []
    }

    const allTranscriptIds = new Set<string>()

    personaIds.forEach(personaId => {
      const transcriptIds = this.personaTranscriptMap.get(personaId) || []
      transcriptIds.forEach(id => allTranscriptIds.add(id))
    })

    const result = Array.from(allTranscriptIds).slice(0, 4) // Business rule: max 4
    
    console.log(`PersonaService: Resolved ${personaIds.length} personas to ${result.length} transcript IDs:`, {
      personaIds,
      transcriptIds: result
    })

    return result
  }

  /**
   * Validate that persona IDs exist and have transcript mappings
   */
  async validatePersonaIds(personaIds: string[]): Promise<string[]> {
    await this.initialize()

    const validPersonaIds = personaIds.filter(id => this.personaTranscriptMap.has(id))

    if (validPersonaIds.length !== personaIds.length) {
      const invalidIds = personaIds.filter(id => !this.personaTranscriptMap.has(id))
      console.warn('PersonaService: Invalid persona IDs found:', invalidIds)
    }

    return validPersonaIds
  }

  /**
   * Get all available persona IDs (for debugging/testing)
   */
  async getAvailablePersonaIds(): Promise<string[]> {
    await this.initialize()
    return Array.from(this.personaTranscriptMap.keys())
  }

  /**
   * Get persona-transcript mapping for debugging
   */
  async getPersonaTranscriptMapping(): Promise<Map<string, string[]>> {
    await this.initialize()
    return new Map(this.personaTranscriptMap)
  }
}

// Singleton instance
let personaServiceInstance: PersonaService | null = null

export function getPersonaService(): PersonaService {
  if (!personaServiceInstance) {
    personaServiceInstance = new PersonaService()
  }
  return personaServiceInstance
}