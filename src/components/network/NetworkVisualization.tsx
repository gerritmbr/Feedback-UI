// NetworkVisualization.tsx - Pure D3.js rendering component

"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import * as d3 from "d3"
import { Node, Link } from "@/src/components/feedback-data-context"
import { useD3Network } from "./hooks/useD3Network"
import { useNetworkZoom } from "./hooks/useNetworkZoom"

interface NetworkVisualizationProps {
  nodes: Node[]
  links: Link[]
  layout: "force" | "circular" | "hierarchical" | "grid"
  width: number
  height: number
  onNodeClick?: (node: Node) => void
  onNodeHover?: (node: Node | null) => void
  onZoomControlsReady?: (controls: {
    handleZoomIn: () => void
    handleZoomOut: () => void
    handleResetView: () => void
  }) => void
}

// Node sizing constants
const NODE_SIZE_CONFIG = {
  question: { base: 25, min: 5, max: 50 },
  answer: { base: 15, min: 5, max: 80 },
  reason: { base: 10, min: 5, max: 50 }
} as const

// Helper function for default colors based on node type
function getDefaultColor(nodeType: string): string {
  switch (nodeType) {
    case "question":
      return "#3b82f6" // blue
    case "answer":
      return "#10b981" // green
    case "reason":
      return "#f59e0b" // amber
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

export function NetworkVisualization({
  nodes,
  links,
  layout,
  width: propWidth,
  height: propHeight,
  onNodeClick,
  onNodeHover,
  onZoomControlsReady
}: NetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const [dimensions, setDimensions] = useState({ width: propWidth, height: propHeight })
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const { initializeSVG } = useD3Network(svgRef, containerGroupRef)
  const { setupZoom, handleZoomIn, handleZoomOut, handleResetView } = useNetworkZoom(svgRef, containerGroupRef)

  // Tooltip functions
  const showTooltip = useCallback((event: any, node: Node) => {
    if (!tooltipRef.current) return
    
    const tooltip = tooltipRef.current
    tooltip.style.display = 'block'
    
    // Use D3's mouse position functions
    const [mouseX, mouseY] = d3.pointer(event, document.body)
    
    tooltip.style.left = `${mouseX + 10}px`
    tooltip.style.top = `${mouseY - 10}px`
    
    // Set tooltip content based on node type
    const getTypeDisplay = (type: string) => {
      switch (type) {
        case "question": return "Question"
        case "answer": return "Answer"
        case "reason": return "Reason"
        default: return type
      }
    }
    
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${getTypeDisplay(node.type)}</div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">ID: ${node.id}</div>
      ${node.multiplicity ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Multiplicity: ${node.multiplicity}</div>` : ''}
      ${node.content ? `<div style="font-size: 12px; color: #374151; max-width: 200px; word-wrap: break-word;">${node.content}</div>` : ''}
    `
  }, [])

  const hideTooltip = useCallback(() => {
    if (!tooltipRef.current) return
    tooltipRef.current.style.display = 'none'
  }, [])

  const updateTooltipPosition = useCallback((event: any) => {
    if (!tooltipRef.current || tooltipRef.current.style.display === 'none') return
    
    const [mouseX, mouseY] = d3.pointer(event, document.body)
    
    tooltipRef.current.style.left = `${mouseX + 10}px`
    tooltipRef.current.style.top = `${mouseY - 10}px`
  }, [])

  // Function to create multi-line labels with background
  const createMultiLineLabel = useCallback((labelGroup: d3.Selection<SVGGElement, Node, SVGGElement, unknown>, node: Node) => {
    // Clear existing content
    labelGroup.selectAll("*").remove()
    
    // Fixed font size based on node type (no zoom scaling)
    const baseFontSize = node.type === "question" ? 11 : node.type === "answer" ? 9 : 8
    const fontSize = baseFontSize
    
    // Line settings based on node type
    const maxCharsPerLine = node.type === "question" ? 25 : node.type === "answer" ? 20 : 15
    const lineHeight = fontSize * 1.2
    const maxLines = 3
    
    // Split text into lines
    const text = node.content || node.id
    const lines = splitTextIntoLines(text, maxCharsPerLine).slice(0, maxLines)
    
    // Add ellipsis if text was truncated
    if (lines.length === maxLines && splitTextIntoLines(text, maxCharsPerLine).length > maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1].substring(0, maxCharsPerLine - 3) + "..."
    }
    
    // Calculate label dimensions
    const labelWidth = Math.max(...lines.map(line => line.length * fontSize * 0.6))
    const labelHeight = lines.length * lineHeight
    
    // Smart positioning to avoid overlaps - get node size based on type
    const nodeRadius = node.type === "question" ? NODE_SIZE_CONFIG.question.base : 
                     node.type === "answer" ? NODE_SIZE_CONFIG.answer.base : 
                     NODE_SIZE_CONFIG.reason.base
    const yOffset = nodeRadius + 8
    
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
        .attr("font-weight", node.type === "question" ? "600" : "400")
        .attr("fill", "#374151")
        .text(line)
    })
    
    // Position the entire label group
    labelGroup.attr("transform", `translate(0, 0)`)
  }, [])



  // Update dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width || propWidth, height: rect.height || propHeight })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [propWidth, propHeight])

  // Expose zoom controls to parent component
  useEffect(() => {
    if (onZoomControlsReady && handleZoomIn && handleZoomOut && handleResetView) {
      onZoomControlsReady({
        handleZoomIn,
        handleZoomOut,
        handleResetView
      })
    }
  }, [onZoomControlsReady, handleZoomIn, handleZoomOut, handleResetView])

  // Create per-category scaling for all node types
  const createPerCategoryNodeSizeScale = useCallback((nodes: Node[], nodeType: Node['type']) => {
    const nodesOfType = nodes.filter(n => n.type === nodeType && n.multiplicity && n.multiplicity > 0)
    
    if (nodesOfType.length === 0) {
      return () => NODE_SIZE_CONFIG[nodeType].base
    }
    
    const multiplicities = nodesOfType.map(n => n.multiplicity!)
    const maxMultiplicity = Math.max(...multiplicities)
    const minMultiplicity = Math.min(...multiplicities)
    
    // If all nodes have the same multiplicity, return base size
    if (maxMultiplicity === minMultiplicity) {
      return () => NODE_SIZE_CONFIG[nodeType].base
    }
    
    // Use power scale for more dramatic differences in high-multiplicity nodes
    return d3.scalePow()
      .exponent(2)
      .domain([minMultiplicity, maxMultiplicity])
      .range([NODE_SIZE_CONFIG[nodeType].min, NODE_SIZE_CONFIG[nodeType].max])
      .clamp(true)
  }, [])

  // Get node size with minimum enforcement
  const getNodeSize = (node: Node, sizeScale: (mult: number) => number) => {
    if (!node.multiplicity || node.multiplicity <= 0) {
      return NODE_SIZE_CONFIG[node.type].base
    }
    
    const scaledSize = sizeScale(node.multiplicity)
    
    // Ensure high-multiplicity nodes are always significantly larger
    if (node.multiplicity > 10) {
      return Math.max(scaledSize, NODE_SIZE_CONFIG[node.type].base * 1.5)
    }
    if (node.multiplicity > 5) {
      return Math.max(scaledSize, NODE_SIZE_CONFIG[node.type].base * 1.2)
    }
    
    return scaledSize
  }

  // Apply different layout algorithms
  const applyLayout = useCallback((nodes: Node[], layoutType: typeof layout, width: number, height: number) => {
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
        const questionNodes = nodes.filter((n) => n.type === "question")
        const answerNodes = nodes.filter((n) => n.type === "answer")
        const reasonNodes = nodes.filter((n) => n.type === "reason")

        // Position questions at top
        questionNodes.forEach((node, i) => {
          node.x = (width / (questionNodes.length + 1)) * (i + 1)
          node.y = height * 0.2
          node.fx = node.x
          node.fy = node.y
        })

        // Position answers in middle
        answerNodes.forEach((node, i) => {
          node.x = (width / (answerNodes.length + 1)) * (i + 1)
          node.y = height * 0.5
          node.fx = node.x
          node.fy = node.y
        })

        // Position reasons at bottom
        reasonNodes.forEach((node, i) => {
          node.x = (width / (reasonNodes.length + 1)) * (i + 1)
          node.y = height * 0.8
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

  // Update network visualization
  const updateVisualization = useCallback(() => {
    if (!containerGroupRef.current || nodes.length === 0) {
      console.log("No container group or nodes available")
      return
    }

    console.log("Updating visualization:", layout, "with", nodes.length, "nodes and", links.length, "links")

    const g = containerGroupRef.current

    // Stop any existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    // Apply layout positioning
    applyLayout(nodes, layout, dimensions.width, dimensions.height)

    // Create/Select dedicated groups for links and nodes
    let linkGroup = g.select<SVGGElement>(".links-group")
    if (linkGroup.empty()) {
      linkGroup = g.append("g").attr("class", "links-group")
    }

    let nodeGroup = g.select<SVGGElement>(".nodes-group")
    if (nodeGroup.empty()) {
      nodeGroup = g.append("g").attr("class", "nodes-group")
    } else {
      if (nodeGroup.node()!.previousElementSibling !== linkGroup.node()) {
        linkGroup.lower()
        nodeGroup.raise()
      }
    }

    // LINKS
    const link = linkGroup
      .selectAll<SVGLineElement, Link>("line")
      .data(
        links,
        (d: Link) =>
          `${typeof d.source === "string" ? d.source : d.source.id}-${typeof d.target === "string" ? d.target : d.target.id}-${d.type}`
      )
      .join(
        enter => enter.append("line")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", (d) => {
            if (d.type === "same_transcript_answer") return "4 2"
            if (d.type === "same_transcript_reason") return "2 2"
            return "0"
          })
          .attr("stroke", (d) => {
            if (d.type === "question_to_answer") return "#e5e7eb"
            if (d.type === "same_transcript_answer") return "#a8a29e"
            if (d.type === "same_transcript_reason") return "#ef4444"
            return "#6b7280"
          }),
        update => update
          .attr("stroke-dasharray", (d) => {
            if (d.type === "same_transcript_answer") return "4 2"
            if (d.type === "same_transcript_reason") return "2 2"
            return "0"
          })
          .attr("stroke", (d) => {
            if (d.type === "question_to_answer") return "#e5e7eb"
            if (d.type === "same_transcript_answer") return "#a8a29e"
            if (d.type === "same_transcript_reason") return "#ef4444"
            return "#6b7280"
          }),
        exit => exit.remove()
      )

    // NODES
    const node = nodeGroup
      .selectAll<SVGGElement, Node>(".node-group")
      .data(nodes, (d: Node) => d.id)
      .join(
        enter => {
          const nodeEnterGroup = enter.append("g")
            .attr("class", "node-group")
            .style("cursor", "pointer")
            .call(d3.drag<SVGGElement, Node>()
              .on("start", (event, d) => {
                if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
                d.fx = d.x
                d.fy = d.y
              })
              .on("drag", (event, d) => {
                d.fx = event.x
                d.fy = event.y
              })
              .on("end", (event, d) => {
                if (!event.active) simulationRef.current?.alphaTarget(0)
              })
            )
            .on("click", (event, d) => {
              onNodeClick?.(d)
            })
            .on("mouseenter", (event, d) => {
              showTooltip(event, d)
              onNodeHover?.(d)
            })
            .on("mousemove", (event, d) => {
              updateTooltipPosition(event)
            })
            .on("mouseleave", () => {
              hideTooltip()
              onNodeHover?.(null)
            })

          nodeEnterGroup.append("circle")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)

          // Append group for multi-line labels
          nodeEnterGroup.append("g")
            .attr("class", "node-label-group")
            .style("pointer-events", "none")

          return nodeEnterGroup
        },
        update => update,
        exit => exit.remove()
      )

    // Create per-category scaling for each node type
    const questionSizeScale = createPerCategoryNodeSizeScale(nodes, 'question')
    const answerSizeScale = createPerCategoryNodeSizeScale(nodes, 'answer')
    const reasonSizeScale = createPerCategoryNodeSizeScale(nodes, 'reason')

    // Update circle attributes
    node.select("circle")
      .attr("r", (d) => {
        if (d.type === "question") {
          return d.multiplicity && d.multiplicity > 0 
            ? getNodeSize(d, questionSizeScale)
            : NODE_SIZE_CONFIG.question.base
        }
        if (d.type === "answer") {
          return d.multiplicity && d.multiplicity > 0 
            ? getNodeSize(d, answerSizeScale)
            : NODE_SIZE_CONFIG.answer.base
        }
        if (d.type === "reason") {
          return d.multiplicity && d.multiplicity > 0 
            ? getNodeSize(d, reasonSizeScale)
            : NODE_SIZE_CONFIG.reason.base
        }
        return NODE_SIZE_CONFIG.reason.base
      })
      .attr("fill", (d) => d.color || getDefaultColor(d.type))

    // Update node labels with multi-line support
    node.select(".node-label-group")
      .each(function(d) {
        const labelGroup = d3.select(this)
        createMultiLineLabel(labelGroup, d)
      })

    // Simulation setup
    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(20))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", d3.forceCollide((d) => 50))

    simulationRef.current = simulation

    // Tick function to update positions
    const ticked = () => {
      link
        .attr("x1", (d) => (d.source as Node).x || 0)
        .attr("y1", (d) => (d.source as Node).y || 0)
        .attr("x2", (d) => (d.target as Node).x || 0)
        .attr("y2", (d) => (d.target as Node).y || 0)

      node
        .attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`)
    }

    simulation.on("tick", ticked)

    // Initial positioning
    ticked()

    if (layout !== "force") {
      simulation.alpha(0.3).restart()
      setTimeout(() => {
        simulation.stop()
        nodes.forEach(d => {
          d.fx = d.x
          d.fy = d.y
        })
        ticked()
      }, 500)
    } else {
      simulation.alpha(1).restart()
    }
  }, [nodes, links, layout, dimensions.width, dimensions.height, applyLayout, createPerCategoryNodeSizeScale, onNodeClick, onNodeHover, showTooltip, hideTooltip, updateTooltipPosition, createMultiLineLabel, currentZoomLevel])

  // Initialize SVG when component mounts
  useEffect(() => {
    initializeSVG()
    setupZoom()
    
    // Add zoom event listener to track zoom level changes
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          if (containerGroupRef.current) {
            containerGroupRef.current.attr("transform", event.transform)
            setCurrentZoomLevel(event.transform.k)
          }
        })
      
      svg.call(zoom)
    }
  }, [initializeSVG, setupZoom])

  // Update visualization when data changes (but not zoom level)
  useEffect(() => {
    updateVisualization()
  }, [nodes, links, layout, dimensions.width, dimensions.height])

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
      hideTooltip()
    }
  }, [hideTooltip])

  return (
    <>
      <svg
        ref={svgRef}
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