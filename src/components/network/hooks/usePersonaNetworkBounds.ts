// usePersonaNetworkBounds.ts - Custom hook for persona network bounds calculation

import { useCallback } from "react"
import * as d3 from "d3"
import { PersonaNode } from "@/src/components/persona-data-context"

// Node sizing constants for persona network
const PERSONA_NODE_SIZE_CONFIG = {
  persona: { base: 80, min: 80, max: 100 },
  attribute: { base: 20, min: 20, max: 30 }
} as const

type NetworkBounds = {
  x: number
  y: number
  width: number
  height: number
}

export function usePersonaNetworkBounds(
  nodes: PersonaNode[],
  containerGroupRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
) {
  // Create node size scale
  const createNodeSizeScale = useCallback((nodes: PersonaNode[], nodeType: PersonaNode['type']) => {
    const nodesOfType = nodes.filter(n => n.type === nodeType && n.multiplicity && n.multiplicity > 0)
    
    if (nodesOfType.length === 0) {
      return () => PERSONA_NODE_SIZE_CONFIG[nodeType].base
    }
    
    const multiplicities = nodesOfType.map(n => n.multiplicity!)
    const maxMultiplicity = Math.max(...multiplicities)
    const minMultiplicity = Math.min(...multiplicities)
    
    // If all nodes have the same multiplicity, return base size
    if (maxMultiplicity === minMultiplicity) {
      return () => PERSONA_NODE_SIZE_CONFIG[nodeType].base
    }
    
    // Use linear scale for personas (simpler than feedback network)
    return d3.scaleLinear()
      .domain([minMultiplicity, maxMultiplicity])
      .range([PERSONA_NODE_SIZE_CONFIG[nodeType].min, PERSONA_NODE_SIZE_CONFIG[nodeType].max])
      .clamp(true)
  }, [])

  // Get node size
  const getNodeSize = useCallback((node: PersonaNode, sizeScale: (mult: number) => number) => {
    if (!node.multiplicity || node.multiplicity <= 0) {
      return PERSONA_NODE_SIZE_CONFIG[node.type].base
    }
    return sizeScale(node.multiplicity)
  }, [])

  // Function to calculate actual network bounds from current node positions
  const calculateNetworkBounds = useCallback((): NetworkBounds | null => {
    if (!containerGroupRef.current || nodes.length === 0) return null
    
    const nodeGroup = containerGroupRef.current.select<SVGGElement>(".nodes-group")
    if (nodeGroup.empty()) return null
    
    // Only calculate bounds if nodes have settled (have actual positions)
    const settledNodes = nodes.filter(node => node.x !== undefined && node.y !== undefined && !isNaN(node.x) && !isNaN(node.y))
    if (settledNodes.length === 0) return null
    
    // Create size scales to get accurate node sizes
    const personaSizeScale = createNodeSizeScale(nodes, 'persona')
    const attributeSizeScale = createNodeSizeScale(nodes, 'attribute')
    
    // Calculate bounds with actual node-specific radius padding
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    
    settledNodes.forEach(node => {
      const nodeRadius = node.type === 'persona' 
        ? (node.multiplicity && node.multiplicity > 0 
           ? getNodeSize(node, personaSizeScale) 
           : PERSONA_NODE_SIZE_CONFIG.persona.base)
        : (node.multiplicity && node.multiplicity > 0 
           ? getNodeSize(node, attributeSizeScale) 
           : PERSONA_NODE_SIZE_CONFIG.attribute.base)
      
      // Add some extra padding for labels (persona nodes have larger labels)
      const labelPadding = node.type === 'persona' ? 40 : 25
      const totalPadding = nodeRadius + labelPadding
      
      minX = Math.min(minX, node.x - totalPadding)
      maxX = Math.max(maxX, node.x + totalPadding)
      minY = Math.min(minY, node.y - totalPadding)
      maxY = Math.max(maxY, node.y + totalPadding)
    })
    
    // Ensure we have valid bounds
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return null
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }, [nodes, createNodeSizeScale, getNodeSize, containerGroupRef])

  return {
    calculateNetworkBounds,
    createNodeSizeScale,
    getNodeSize
  }
}