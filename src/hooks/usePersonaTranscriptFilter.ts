// usePersonaTranscriptFilter.ts - Extract transcript IDs from selected personas

import { useMemo } from 'react'
import { PersonaNetworkData } from '@/src/components/persona-data-context'

/**
 * Hook to extract transcript IDs from selected persona nodes
 * Bridges the persona selection system with transcript-based filtering
 */
export function usePersonaTranscriptFilter(
  selectedNodeIds: Set<string>,
  personaNetworkData: PersonaNetworkData | null
) {
  const transcriptIds = useMemo(() => {
    console.log('🔍 usePersonaTranscriptFilter: Processing transcript extraction...')
    console.log('  Selected node IDs:', Array.from(selectedNodeIds))
    console.log('  Has persona network data:', !!personaNetworkData)
    
    // If no personas are selected or no network data, return empty array
    if (selectedNodeIds.size === 0 || !personaNetworkData) {
      console.log('  → Returning empty: No selection or no network data')
      return []
    }

    // Get selected persona nodes (not attributes)
    const selectedPersonaNodes = personaNetworkData.nodes.filter(node => 
      selectedNodeIds.has(node.id) && node.type === 'persona'
    )
    
    console.log('  Selected persona nodes:', selectedPersonaNodes.length)
    selectedPersonaNodes.forEach(node => {
      console.log(`    Persona "${node.label}" (ID: ${node.id}):`, {
        transcript_id: node.transcript_id,
        type: typeof node.transcript_id
      })
    })
    
    if (selectedPersonaNodes.length === 0) {
      console.log('  → Returning empty: No valid persona nodes selected')
      return []
    }

    // Extract transcript IDs from all selected personas
    const allTranscriptIds = new Set<string>()
    
    selectedPersonaNodes.forEach(node => {
      // Check if node has transcript_id property (from CSV data)
      if (node.transcript_id && typeof node.transcript_id === 'string') {
        // Parse pipe-separated transcript IDs (format: "1|4")
        const transcriptIdsArray = node.transcript_id
          .split('|')
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0)
        
        console.log(`    Extracted from "${node.label}":`, transcriptIdsArray)
        transcriptIdsArray.forEach(id => allTranscriptIds.add(id))
      } else {
        console.log(`    No transcript_id found for "${node.label}"`)
      }
    })
    
    const finalTranscriptIds = Array.from(allTranscriptIds).sort()
    console.log('  → Final transcript IDs extracted:', finalTranscriptIds)
    console.log('---')
    return finalTranscriptIds
  }, [selectedNodeIds, personaNetworkData])

  const isEmpty = transcriptIds.length === 0
  const selectedPersonaCount = personaNetworkData 
    ? personaNetworkData.nodes.filter(node => 
        selectedNodeIds.has(node.id) && node.type === 'persona'
      ).length
    : 0

  return {
    transcriptIds,
    isEmpty,
    selectedPersonaCount,
    hasTranscriptMapping: transcriptIds.length > 0 && selectedPersonaCount > 0
  }
}