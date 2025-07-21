// PersonaNetworkVisualization.tsx - Persona-specific D3.js rendering component

"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import * as d3 from "d3"
import { PersonaNode, PersonaLink } from "@/src/components/persona-data-context"
import { useD3Network } from "./hooks/useD3Network"
import { useNetworkZoom } from "./hooks/useNetworkZoom"
import { usePersonaNetworkBounds } from "./hooks/usePersonaNetworkBounds"

interface PersonaNetworkVisualizationProps {
  nodes: PersonaNode[]
  links: PersonaLink[]
  layout: "force" | "circular" | "hierarchical" | "grid"
  width: number
  height: number
  onNodeClick?: (node: PersonaNode) => void
  onNodeHover?: (node: PersonaNode | null) => void
  onZoomControlsReady?: (controls: {
    handleZoomIn: () => void
    handleZoomOut: () => void
    handleResetView: () => void
    getCurrentTransform?: () => any
  }) => void
}

// Node sizing constants for persona network
const PERSONA_NODE_SIZE_CONFIG = {
  persona: { base: 80, min: 80, max: 100 },
  attribute: { base: 20, min: 20, max: 30 }
} as const

// Helper function for persona node colors
function getPersonaNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "persona":
      return "#8b5cf6" // purple
    case "attribute":
      return "#06b6d4" // cyan
    default:
      return "#6b7280" // gray
  }
}

// Helper function to split text into multiple lines
function splitTextIntoLines(text: string, maxCharsPerLine: number): string[] {
  if (!text) return []
  
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        // Word is too long, split it
        lines.push(word.substring(0, maxCharsPerLine))
        currentLine = word.substring(maxCharsPerLine)
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }
  
  return lines
}

export function PersonaNetworkVisualization({
  nodes,
  links,
  layout,
  width,
  height,
  onNodeClick,
  onNodeHover,
  onZoomControlsReady
}: PersonaNetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [simulation, setSimulation] = useState<d3.Simulation<PersonaNode, PersonaLink> | null>(null)
  const containerGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const tooltipRef = useRef<HTMLDivElement>(null)
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isApplyingZoomRef = useRef(false)
  
  // Initialize persona network bounds calculation hook
  const { calculateNetworkBounds, createNodeSizeScale, getNodeSize } = usePersonaNetworkBounds(nodes, containerGroupRef)

  // Initialize zoom controls with bounds calculator
  const { setupZoom, handleZoomIn, handleZoomOut, handleResetView } = useNetworkZoom(svgRef, containerGroupRef, calculateNetworkBounds)

  // Tooltip functions
  const showTooltip = useCallback((event: any, node: PersonaNode) => {
    if (!tooltipRef.current || !svgRef.current) return
    
    const tooltip = tooltipRef.current
    tooltip.style.display = 'block'
    
    // Get the SVG element's bounding rect for proper positioning
    const svgRect = svgRef.current.getBoundingClientRect()
    const mouseEvent = event.sourceEvent || event
    
    // Calculate position relative to the page
    const x = svgRect.left + (mouseEvent.offsetX || 0)
    const y = svgRect.top + (mouseEvent.offsetY || 0)
    
    tooltip.style.left = `${x + 10}px`
    tooltip.style.top = `${y - 10}px`
    
    // Set tooltip content
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${node.label || node.id}</div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Type: ${node.type}</div>
      ${node.multiplicity ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Multiplicity: ${node.multiplicity}</div>` : ''}
      ${node.content ? `<div style="font-size: 12px; color: #374151; max-width: 200px; word-wrap: break-word;">${node.content}</div>` : ''}
    `
  }, [])

  const hideTooltip = useCallback(() => {
    if (!tooltipRef.current) return
    tooltipRef.current.style.display = 'none'
  }, [])

  const updateTooltipPosition = useCallback((event: any) => {
    if (!tooltipRef.current || tooltipRef.current.style.display === 'none' || !svgRef.current) return
    
    // Get the SVG element's bounding rect for proper positioning
    const svgRect = svgRef.current.getBoundingClientRect()
    const mouseEvent = event.sourceEvent || event
    
    // Calculate position relative to the page
    const x = svgRect.left + (mouseEvent.offsetX || 0)
    const y = svgRect.top + (mouseEvent.offsetY || 0)
    
    tooltipRef.current.style.left = `${x + 10}px`
    tooltipRef.current.style.top = `${y - 10}px`
  }, [])

  // Function to create multi-line labels with background
  const createMultiLineLabel = useCallback((labelGroup: d3.Selection<SVGGElement, PersonaNode, SVGGElement, unknown>, node: PersonaNode) => {
    // Clear existing content
    labelGroup.selectAll("*").remove()
    
    // Dynamic font size based on zoom level and node type
    const baseFontSize = node.type === "persona" ? 12 : 10
    const fontSize = Math.max(8, Math.min(16, baseFontSize * currentZoomLevel))
    
    // Line settings
    const maxCharsPerLine = node.type === "persona" ? 20 : 15
    const lineHeight = fontSize * 1.2
    const maxLines = 3
    
    // Split text into lines
    const text = node.label || node.id
    const lines = splitTextIntoLines(text, maxCharsPerLine).slice(0, maxLines)
    
    // Add ellipsis if text was truncated
    if (lines.length === maxLines && splitTextIntoLines(text, maxCharsPerLine).length > maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1].substring(0, maxCharsPerLine - 3) + "..."
    }
    
    // Calculate label dimensions
    const labelWidth = Math.max(...lines.map(line => line.length * fontSize * 0.6))
    const labelHeight = lines.length * lineHeight
    
    // Smart positioning to avoid overlaps
    const nodeRadius = node.type === "persona" ? PERSONA_NODE_SIZE_CONFIG.persona.base : PERSONA_NODE_SIZE_CONFIG.attribute.base
    const yOffset = nodeRadius + 10
    
    // Add background rectangle
    labelGroup.append("rect")
      .attr("x", -labelWidth / 2 - 4)
      .attr("y", yOffset - 4)
      .attr("width", labelWidth + 8)
      .attr("height", labelHeight + 8)
      .attr("fill", "rgba(255, 255, 255, 0.9)")
      .attr("stroke", "rgba(0, 0, 0, 0.2)")
      .attr("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4)
    
    // Add text lines
    lines.forEach((line, index) => {
      labelGroup.append("text")
        .attr("x", 0)
        .attr("y", yOffset + (index * lineHeight) + fontSize)
        .attr("text-anchor", "middle")
        .attr("font-size", `${fontSize}px`)
        .attr("font-family", "system-ui, sans-serif")
        .attr("font-weight", node.type === "persona" ? "600" : "400")
        .attr("fill", "#374151")
        .text(line)
    })
    
    // Position the entire label group
    labelGroup.attr("transform", `translate(0, 0)`)
  }, [currentZoomLevel])

  // Function to get current transform
  const getCurrentTransform = useCallback(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const transform = d3.zoomTransform(svg.node() as SVGSVGElement)
      return transform
    }
    return null
  }, [])

  // Expose zoom controls to parent
  useEffect(() => {
    if (onZoomControlsReady) {
      onZoomControlsReady({
        handleZoomIn,
        handleZoomOut,
        handleResetView,
        getCurrentTransform
      })
    }
  }, [onZoomControlsReady, handleZoomIn, handleZoomOut, handleResetView, getCurrentTransform])

  // Apply zoom after simulation settles with debouncing
  const applyZoomAfterSimulation = useCallback(() => {
    if (!svgRef.current || isApplyingZoomRef.current || !isFirstLoad) return
    
    // Clear any pending zoom application
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current)
    }
    
    // For initial load only, debounce the reset view call
    zoomTimeoutRef.current = setTimeout(() => {
      if (!isApplyingZoomRef.current) {
        isApplyingZoomRef.current = true
        // Wait for simulation to settle before applying reset
        const checkAndReset = () => {
          const bounds = calculateNetworkBounds()
          if (bounds && bounds.width > 0 && bounds.height > 0) {
            handleResetView()
            setIsFirstLoad(false)
            isApplyingZoomRef.current = false
          } else {
            // If bounds not ready, try again
            setTimeout(checkAndReset, 100)
          }
        }
        checkAndReset()
      }
    }, 200) // Longer delay to ensure simulation stability
  }, [isFirstLoad, handleResetView, calculateNetworkBounds])

  // Initialize SVG and zoom behavior
  const initializeSVG = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Create main group for all network elements
    const g = svg.append("g")
    containerGroupRef.current = g

    // Set cursor styles
    svg.style("cursor", "grab")
    svg.on("mousedown", function() {
      d3.select(this).style("cursor", "grabbing")
    })
    svg.on("mouseup", function() {
      d3.select(this).style("cursor", "grab")
    })
    svg.on("mouseleave", function() {
      d3.select(this).style("cursor", "grab")
    })

    // Setup zoom after container group is created
    setupZoom()
    
    // Track zoom level changes for dynamic font sizing
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        if (containerGroupRef.current) {
          containerGroupRef.current.attr("transform", event.transform)
          setCurrentZoomLevel(event.transform.k)
        }
      })
    
    svg.call(zoom)
  }, [setupZoom])

  // Apply different layout algorithms
  const applyLayout = useCallback((nodes: PersonaNode[], layoutType: string, width: number, height: number) => {
    const centerX = width / 2
    const centerY = height / 2

    switch (layoutType) {
      case "circular":
        const radius = Math.min(width, height) * 0.3
        nodes.forEach((node, i) => {
          const angle = (2 * Math.PI * i) / nodes.length
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "hierarchical":
        // Group nodes by type
        const personaNodes = nodes.filter((n) => n.type === "persona")
        const attributeNodes = nodes.filter((n) => n.type === "attribute")

        // Position personas at top
        personaNodes.forEach((node, i) => {
          node.x = (width / (personaNodes.length + 1)) * (i + 1)
          node.y = height * 0.3
          node.fx = node.x
          node.fy = node.y
        })

        // Position attributes at bottom
        attributeNodes.forEach((node, i) => {
          node.x = (width / (attributeNodes.length + 1)) * (i + 1)
          node.y = height * 0.7
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "grid":
        const cols = Math.ceil(Math.sqrt(nodes.length))
        const rows = Math.ceil(nodes.length / cols)
        const cellWidth = width / cols
        const cellHeight = height / rows

        nodes.forEach((node, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          node.x = cellWidth * (col + 0.5)
          node.y = cellHeight * (row + 0.5)
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "force":
      default:
        // Remove fixed positions for force layout
        nodes.forEach((node) => {
          node.fx = null
          node.fy = null
        })
        break
    }
  }, [])

  // Helper functions are now provided by usePersonaNetworkBounds hook

  // Function to update only node styling (without restarting simulation)
  const updateNodeStyling = useCallback(() => {
    if (!containerGroupRef.current) return

    const nodeGroup = containerGroupRef.current.select<SVGGElement>(".nodes-group")
    if (nodeGroup.empty()) return

    // Update circle styling
    nodeGroup
      .selectAll<SVGGElement, PersonaNode>(".persona-node-group")
      .select("circle")
      .attr("stroke", (d) => selectedNodeIds.has(d.id) ? "#ef4444" : "#fff")
      .attr("stroke-width", (d) => selectedNodeIds.has(d.id) ? 3 : 2)
  }, [selectedNodeIds])

  // Update network visualization
  const updateVisualization = useCallback(() => {
    if (!containerGroupRef.current || nodes.length === 0) {
      return
    }

    const g = containerGroupRef.current

    // Stop any existing simulation
    if (simulation) {
      simulation.stop()
    }

    // Apply layout positioning
    applyLayout(nodes, layout, width, height)

    // Create simulation first so it's available for drag handlers
    const newSimulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(width / 2, height / 2))

    setSimulation(newSimulation)

    // Create dedicated groups for links and nodes
    let linkGroup = g.select<SVGGElement>(".links-group")
    if (linkGroup.empty()) {
      linkGroup = g.append("g").attr("class", "links-group")
    }

    let nodeGroup = g.select<SVGGElement>(".nodes-group")
    if (nodeGroup.empty()) {
      nodeGroup = g.append("g").attr("class", "nodes-group")
    } else {
      // Ensure proper z-order
      linkGroup.lower()
      nodeGroup.raise()
    }

    // --- LINKS ---
    const link = linkGroup
      .selectAll<SVGLineElement, PersonaLink>("line")
      .data(links, (d: PersonaLink) => 
        `${typeof d.source === "string" ? d.source : d.source.id}-${typeof d.target === "string" ? d.target : d.target.id}-${d.type}`
      )
      .join(
        enter => enter.append("line")
          .attr("stroke-width", 2)
          .attr("stroke", (d) => {
            if (d.type === "persona-attribute") return "#94a3b8" // slate-400
            if (d.type === "same-persona") return "#cbd5e1" // slate-300
            return "#6b7280" // gray-500
          })
          .attr("stroke-dasharray", (d) => {
            if (d.type === "same-persona") return "4 2"
            return "0"
          }),
        update => update
          .attr("stroke", (d) => {
            if (d.type === "persona-attribute") return "#94a3b8"
            if (d.type === "same-persona") return "#cbd5e1"
            return "#6b7280"
          })
          .attr("stroke-dasharray", (d) => {
            if (d.type === "same-persona") return "4 2"
            return "0"
          }),
        exit => exit.remove()
      )

    // --- NODES ---
    const node = nodeGroup
      .selectAll<SVGGElement, PersonaNode>(".persona-node-group")
      .data(nodes, (d: PersonaNode) => d.id)
      .join(
        enter => {
          const nodeEnterGroup = enter.append("g")
            .attr("class", "persona-node-group")
            .style("cursor", "pointer")
            .call(d3.drag<SVGGElement, PersonaNode>()
              .on("start", (event, d) => {
                if (!event.active && newSimulation) newSimulation.alphaTarget(0.3).restart()
                d.fx = d.x
                d.fy = d.y
                // Store initial position to detect if this was a click or drag
                event.sourceEvent.dragStartX = event.x
                event.sourceEvent.dragStartY = event.y
              })
              .on("drag", (event, d) => {
                d.fx = event.x
                d.fy = event.y
              })
              .on("end", (event, d) => {
                if (!event.active && newSimulation) newSimulation.alphaTarget(0)
                
                // Check if this was a click (minimal movement)
                const dragStartX = event.sourceEvent.dragStartX || event.x
                const dragStartY = event.sourceEvent.dragStartY || event.y
                const dragDistance = Math.sqrt(
                  Math.pow(event.x - dragStartX, 2) + Math.pow(event.y - dragStartY, 2)
                )
                

                // If movement was minimal (less than 5 pixels), treat as click
                if (dragDistance < 5) {
                  // only add SelectedNodes for personas
                  if(d.type == 'persona') {
                    setSelectedNodeIds(prev => {
                      const newSet = new Set(prev)
                      if (newSet.has(d.id)) {
                        newSet.delete(d.id)
                      } else {
                        newSet.add(d.id)
                      }
                      return newSet
                    })
                  }
                  if (onNodeClick) onNodeClick(d)
                }
              })
            )
            .on("mouseenter", (event, d) => {
              showTooltip(event, d)
              if (onNodeHover) onNodeHover(d)
            })
            .on("mousemove", (event, d) => {
              updateTooltipPosition(event)
            })
            .on("mouseleave", () => {
              hideTooltip()
              if (onNodeHover) onNodeHover(null)
            })

          // Append circle (background/border)
          nodeEnterGroup.append("circle")

          // Append image overlay for persona nodes only
          nodeEnterGroup.append("image")
            .attr("class", "persona-node-image")
            .attr("href", "/persona.png")
            .style("pointer-events", "none")
            .style("display", (d) => d.type === "persona" ? "block" : "none")

          // Append text group for multi-line labels
          nodeEnterGroup.append("g")
            .attr("class", "persona-node-label-group")
            .style("pointer-events", "none")

          return nodeEnterGroup
        },
        update => update,
        exit => exit.remove()
      )

    // Create size scales
    const personaSizeScale = createNodeSizeScale(nodes, 'persona')
    const attributeSizeScale = createNodeSizeScale(nodes, 'attribute')

    // Update node circles
    node.select("circle")
      .attr("r", (d) => {
        if (d.type === "persona") {
          return d.multiplicity && d.multiplicity > 0 
            ? getNodeSize(d, personaSizeScale)
            : PERSONA_NODE_SIZE_CONFIG.persona.base
        }
        return d.multiplicity && d.multiplicity > 0 
          ? getNodeSize(d, attributeSizeScale)
          : PERSONA_NODE_SIZE_CONFIG.attribute.base
      })
      .attr("fill", (d) => d.color || getPersonaNodeColor(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)

    // Update node images (only for persona nodes)
    node.select(".persona-node-image")
      .attr("x", (d) => {
        if (d.type !== "persona") return 0
        const radius = d.multiplicity && d.multiplicity > 0 
          ? getNodeSize(d, personaSizeScale)
          : PERSONA_NODE_SIZE_CONFIG.persona.base
        return -radius * 0.6 // Center the image, slightly smaller than circle
      })
      .attr("y", (d) => {
        if (d.type !== "persona") return 0
        const radius = d.multiplicity && d.multiplicity > 0 
          ? getNodeSize(d, personaSizeScale)
          : PERSONA_NODE_SIZE_CONFIG.persona.base
        return -radius * 0.6 // Center the image, slightly smaller than circle
      })
      .attr("width", (d) => {
        if (d.type !== "persona") return 0
        const radius = d.multiplicity && d.multiplicity > 0 
          ? getNodeSize(d, personaSizeScale)
          : PERSONA_NODE_SIZE_CONFIG.persona.base
        return radius * 1.2 // 60% of circle diameter
      })
      .attr("height", (d) => {
        if (d.type !== "persona") return 0
        const radius = d.multiplicity && d.multiplicity > 0 
          ? getNodeSize(d, personaSizeScale)
          : PERSONA_NODE_SIZE_CONFIG.persona.base
        return radius * 1.2 // 60% of circle diameter
      })

    // Update node labels with multi-line support
    node.select(".persona-node-label-group")
      .each(function(d) {
        const labelGroup = d3.select(this)
        createMultiLineLabel(labelGroup, d)
      })

    // Simulation was already created above

    // Tick function
    const ticked = () => {
      link
        .attr("x1", (d) => (d.source as PersonaNode).x || 0)
        .attr("y1", (d) => (d.source as PersonaNode).y || 0)
        .attr("x2", (d) => (d.target as PersonaNode).x || 0)
        .attr("y2", (d) => (d.target as PersonaNode).y || 0)

      node
        .attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`)
    }

    newSimulation.on("tick", ticked)

    // Initial positioning
    ticked()

    if (layout !== "force") {
      newSimulation.alpha(0.3).restart()
      setTimeout(() => {
        newSimulation.stop()
        nodes.forEach(d => {
          d.fx = d.x
          d.fy = d.y
        })
        ticked()
        // Apply zoom after simulation settles
        applyZoomAfterSimulation()
      }, 100)
    } else {
      newSimulation.alpha(1).restart()
      // For force layout, apply zoom after some time to let it settle
      setTimeout(() => {
        applyZoomAfterSimulation()
      }, 1000)
    }

  }, [nodes, links, layout, width, height, applyLayout, onNodeClick, onNodeHover, applyZoomAfterSimulation])

  // Initialize SVG
  useEffect(() => {
    initializeSVG()
  }, [])

  // Update visualization when data changes
  useEffect(() => {
    updateVisualization()
    // Apply styling after visualization is complete (without creating dependency loop)
    setTimeout(() => {
      updateNodeStyling()
    }, 100)
  }, [updateVisualization])

  // Update only node styling when selection changes (without restarting simulation)
  useEffect(() => {
    updateNodeStyling()
  }, [updateNodeStyling])

  // Cleanup
  useEffect(() => {
    return () => {
      if (simulation) {
        simulation.stop()
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current)
      }
      hideTooltip()
    }
  }, [simulation, hideTooltip])

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ maxHeight: "100%", maxWidth: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          display: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '14px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 1000,
          pointerEvents: 'none',
          maxWidth: '250px'
        }}
      />
    </>
  )
}