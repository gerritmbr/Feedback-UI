"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/src/components/ui/button"
import { RefreshCw } from "lucide-react"
import { NetworkVisualization } from "./network/NetworkVisualization"
import { NetworkControls } from "./network/NetworkControls"
import { NetworkLayoutDropdown } from "./network/NetworkLayoutDropdown"
import { NetworkSettingsPanel } from "./network/NetworkSettingsPanel"
import { useNetworkZoom } from "./network/hooks/useNetworkZoom"
import { useNetworkFilter } from "./network/hooks/useNetworkFilter"
import { useFeedbackData, Node, Link, NetworkData } from "@/src/components/feedback-data-context"

type LayoutType = "force" | "circular" | "hierarchical" | "grid"

interface FeedbackNetworkSectionProps {
  selectedQuestions?: string[]
  className?: string
}

export function FeedbackNetworkSection({ selectedQuestions = [], className = "" }: FeedbackNetworkSectionProps) {
  const [layout, setLayout] = useState<LayoutType>("force")
  const [networkData, setNetworkData] = useState<NetworkData | null>(null)
  const [showTranscriptLinks, setShowTranscriptLinks] = useState(false)

  // Use data from context
  const { 
    nodesData, 
    edgesData, 
    isLoading, 
    error, 
    dataSource, 
    refreshData 
  } = useFeedbackData()

  const { getFilteredNetworkData } = useNetworkFilter()

  // Process the raw CSV data into network format
  const processNetworkData = useCallback(() => {
    if (isLoading || error || !nodesData.length || !edgesData.length) {
      console.log("Skipping network data processing: isLoading or error or empty data.", { 
        isLoading, 
        error, 
        nodesCount: nodesData.length, 
        edgesCount: edgesData.length 
      })
      setNetworkData(null)
      return
    }

    console.log("Processing network data...")
    console.log("Raw nodes data sample:", nodesData.slice(0, 3))
    console.log("Raw edges data sample:", edgesData.slice(0, 3))
    console.log("Data source:", dataSource)
    
    // Check the actual column names in the CSV
    console.log("Nodes CSV columns:", Object.keys(nodesData[0]))
    console.log("Edges CSV columns:", Object.keys(edgesData[0]))
    
    // Process nodes data
    const nodes: Node[] = nodesData.map((d, index) => {
      const node = {
        id: d.Id || d.id || `node_${index}`,
        label: d.Label,
        content: d.content,
        type: (d.node_type || d.type || "unknown") as "question" | "answer" | "reason",
        color: d.color || getDefaultColor(d.node_type || d.type),
        transcript_id: d.transcript_id || undefined,
        multiplicity: d.node_multiplicity ? Number.parseInt(d.node_multiplicity) : undefined,
        question_ids: d.question_ids || undefined,
      }
      
      if (!node.id) {
        console.warn(`Node at index ${index} missing ID:`, d)
      }
      
      return node
    })

    // Process edges data
    const edges: Link[] = edgesData.map((d, index) => {
      const edge = {
        source: d.source || d.Source,
        target: d.target || d.Target,
        weight: d.weight ? Number.parseFloat(d.weight) : 1,
        type: d.type || d.edge_type || "default",
      }
      
      if (!edge.source || !edge.target) {
        console.warn(`Edge at index ${index} missing source/target:`, d)
      }
      
      return edge
    })

    console.log(`Processed ${nodes.length} nodes and ${edges.length} edges`)
    
    // Filter out any invalid nodes/edges
    const validNodes = nodes.filter(n => n.id)
    const validEdges = edges.filter(e => e.source && e.target)
    
    if (validNodes.length !== nodes.length) {
      console.warn(`Filtered out ${nodes.length - validNodes.length} invalid nodes`)
    }
    if (validEdges.length !== edges.length) {
      console.warn(`Filtered out ${edges.length - validEdges.length} invalid edges`)
    }

    const processedData: NetworkData = {
      nodes: validNodes,
      links: validEdges,
    }

    setNetworkData(processedData)
    console.log("Network data processed successfully")
  }, [nodesData, edgesData, dataSource, isLoading, error])

  // Helper function for default colors based on node type
  const getDefaultColor = (nodeType: string): string => {
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

  // Process data when raw data changes
  useEffect(() => {
    processNetworkData()
  }, [processNetworkData])

  // Get filtered network data
  const { nodes: filteredNodes, links: filteredLinks } = getFilteredNetworkData(
    networkData,
    selectedQuestions,
    showTranscriptLinks
  )

  // Handle refresh
  const handleRefreshData = useCallback(() => {
    refreshData()
  }, [refreshData])

  // Zoom controls refs
  const [zoomControls, setZoomControls] = useState<{
    handleZoomIn: () => void
    handleZoomOut: () => void
    handleResetView: () => void
  } | null>(null)

  
  // Memoize the callback that sets zoom controls
  const handleZoomControlsReady = useCallback((controls: {
    handleZoomIn: () => void
    handleZoomOut: () => void
    handleResetView: () => void
  }) => {
    // Only update if the controls actually change, though setZoomControls
    // is safe to call even if the value is the same.
    setZoomControls(controls)
  }, [setZoomControls]) // setZoomControls is guaranteed to be stable by React, so this is effectively an empty dependency.




  const handleNodeClick = useCallback((node: Node) => {
    console.log("Node clicked:", node)
    // Add your node click logic here
  }, [])

  const handleNodeHover = useCallback((node: Node | null) => {
    console.log("Node hovered:", node)
    // Add your node hover logic here
  }, [])

  return (
    <div className={`w-full h-full bg-gray-50 rounded-lg p-4 relative overflow-hidden ${className}`}>
      {/* Top Controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <NetworkLayoutDropdown
          currentLayout={layout}
          onLayoutChange={setLayout}
        >
          <NetworkSettingsPanel
            showTranscriptLinks={showTranscriptLinks}
            onToggleTranscriptLinks={() => setShowTranscriptLinks(prev => !prev)}
          />
        </NetworkLayoutDropdown>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-20">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading network data...</span>
            {dataSource === 'local' && (
              <div className="text-sm text-green-600 mb-2">
                Using uploaded CSV data
              </div>
            )}
            {dataSource === 'server' && (
              <div className="text-sm text-blue-600 mb-2">
                Using server CSV data
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-20">
          <div className="text-center text-red-600 max-w-md">
            <p className="text-sm font-medium mb-2">Error Loading Data</p>
            <p className="text-xs mb-4">{error}</p>
            <Button size="sm" onClick={handleRefreshData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !error && networkData && (
        <>
          <NetworkControls
            onZoomIn={zoomControls?.handleZoomIn || (() => {})}
            onZoomOut={zoomControls?.handleZoomOut || (() => {})}
            onResetView={zoomControls?.handleResetView || (() => {})}
            onRefresh={handleRefreshData}
            isLoading={isLoading}
          />

          {/* Layout Info */}
          <div className="absolute top-2 left-[60px] z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
            {layout.charAt(0).toUpperCase() + layout.slice(1)} Layout | Nodes:{" "}
            {filteredNodes.length} | Links: {filteredLinks.length}
          </div>

          {/* Instructions */}
          <div className="absolute bottom-2 left-2 z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
            Drag to pan • Scroll to zoom • Drag nodes to move
          </div>

          <NetworkVisualization
            nodes={filteredNodes}
            links={filteredLinks}
            layout={layout}
            width={600}
            height={400}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onZoomControlsReady={setZoomControls}
          />
        </>
      )}
    </div>
  )
}