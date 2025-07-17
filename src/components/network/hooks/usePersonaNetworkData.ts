// usePersonaNetworkData.ts - Persona-specific data processing hook

import { useCallback } from "react"
import { PersonaNode, PersonaLink, PersonaNetworkData } from "@/src/components/persona-data-context"

// Helper function for default colors based on persona node type
function getDefaultPersonaColor(nodeType: string): string {
  switch (nodeType) {
    case "persona":
      return "#8b5cf6" // purple
    case "attribute":
      return "#06b6d4" // cyan
    default:
      return "#6b7280" // gray
  }
}

export function usePersonaNetworkData() {
  const processPersonaNetworkData = useCallback((nodesData: any[], edgesData: any[]) => {
    console.log("Processing persona network data...")
    console.log("Raw persona nodes data sample:", nodesData.slice(0, 3))
    console.log("Raw persona edges data sample:", edgesData.slice(0, 3))
    
    // Check the actual column names in the CSV
    console.log("Persona nodes CSV columns:", Object.keys(nodesData[0] || {}))
    console.log("Persona edges CSV columns:", Object.keys(edgesData[0] || {}))
    
    // Process persona nodes data
    const nodes: PersonaNode[] = nodesData.map((d, index) => {
      const node = {
        id: d.Id || d.id || `persona_node_${index}`,
        label: d.Label || d.label || '',
        content: d.content || '',
        type: (d.node_type || d.type || "attribute") as "persona" | "attribute",
        color: d.color || getDefaultPersonaColor(d.node_type || d.type),
        multiplicity: d.node_multiplicity ? Number.parseInt(d.node_multiplicity) : undefined,
      }
      
      if (!node.id) {
        console.warn(`Persona node at index ${index} missing ID:`, d)
      }
      
      return node
    })

    // Process persona edges data
    const edges: PersonaLink[] = edgesData.map((d, index) => {
      const edge = {
        source: d.Source || d.source,
        target: d.Target || d.target,
        weight: d.Weight || d.weight ? Number.parseFloat(d.Weight || d.weight) : 1,
        type: (d.edge_type || d.type || "persona-attribute") as "persona-attribute" | "same-persona",
      }
      
      if (!edge.source || !edge.target) {
        console.warn(`Persona edge at index ${index} missing source/target:`, d)
      }
      
      return edge
    })

    console.log(`Processed ${nodes.length} persona nodes and ${edges.length} persona edges`)
    
    // Filter out any invalid nodes/edges
    const validNodes = nodes.filter(n => n.id)
    const validEdges = edges.filter(e => e.source && e.target)
    
    if (validNodes.length !== nodes.length) {
      console.warn(`Filtered out ${nodes.length - validNodes.length} invalid persona nodes`)
    }
    if (validEdges.length !== edges.length) {
      console.warn(`Filtered out ${edges.length - validEdges.length} invalid persona edges`)
    }

    const processedData: PersonaNetworkData = {
      nodes: validNodes,
      links: validEdges,
    }

    console.log("Persona network data processed successfully")
    return processedData
  }, [])

  const getFilteredPersonaData = useCallback((
    networkData: PersonaNetworkData | null,
    showSamePersonaLinks: boolean
  ) => {
    if (!networkData) {
      return { nodes: [], links: [] }
    }

    const filteredLinks = showSamePersonaLinks 
      ? networkData.links 
      : networkData.links.filter(link => link.type !== "same-persona")

    return {
      nodes: networkData.nodes,
      links: filteredLinks
    }
  }, [])

  return {
    processPersonaNetworkData,
    getFilteredPersonaData
  }
}