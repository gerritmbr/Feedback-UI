"use client"

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { Button } from "@/src/components/ui/button"
import { RefreshCw } from "lucide-react"
import { PersonaNetworkVisualization } from "./network/PersonaNetworkVisualization"
import { NetworkControls } from "./network/NetworkControls"
import { NetworkLayoutDropdown } from "./network/NetworkLayoutDropdown"
import { usePersonaNetworkData } from "./network/hooks/usePersonaNetworkData"
import { usePersonaData, PersonaNode, PersonaLink, PersonaNetworkData } from "@/src/components/persona-data-context"

type LayoutType = "force" | "circular" | "hierarchical" | "grid"

interface PersonaNetworkSectionProps {
  className?: string
}

export function PersonaNetworkSection({ className = "" }: PersonaNetworkSectionProps) {
  const [layout, setLayout] = useState<LayoutType>("force")
  const [networkData, setNetworkData] = useState<PersonaNetworkData | null>(null)
  const [showSamePersonaLinks, setShowSamePersonaLinks] = useState(false)

  // Use persona data from context
  const { 
    nodesData, 
    edgesData, 
    isLoading, 
    error, 
    dataSource, 
    refreshData 
  } = usePersonaData()

  // Use persona network data processing hook
  const { processPersonaNetworkData, getFilteredPersonaData } = usePersonaNetworkData()

  // Process the raw CSV data into persona network format
  const processNetworkData = useCallback(() => {
    if (isLoading || error || !nodesData.length || !edgesData.length) {
      console.log("Skipping persona network data processing", { 
        isLoading, 
        error, 
        nodesCount: nodesData.length, 
        edgesCount: edgesData.length 
      })
      setNetworkData(null)
      return
    }

    console.log("Processing persona network data...")
    const processedData = processPersonaNetworkData(nodesData, edgesData)
    setNetworkData(processedData)
  }, [nodesData, edgesData, dataSource, isLoading, error, processPersonaNetworkData])

  // Zoom controls refs and view state preservation
  const [zoomControls, setZoomControls] = useState<{
    handleZoomIn: () => void
    handleZoomOut: () => void
    handleResetView: () => void
    getCurrentTransform?: () => any
  } | null>(null)
  const [preservedTransform, setPreservedTransform] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Process data when raw data changes
  useEffect(() => {
    processNetworkData()
  }, [processNetworkData])

  // Clear preserved transform on component mount to ensure initial zoom works
  useEffect(() => {
    setPreservedTransform(null)
  }, [])

  // Handle refresh - just force re-render of visualization without data reload
  const handleRefreshData = useCallback(() => {
    // Preserve current view transform before refresh
    if (zoomControls?.getCurrentTransform) {
      const currentTransform = zoomControls.getCurrentTransform()
      setPreservedTransform(currentTransform)
    }
    
    // Force re-render of the visualization component only
    setRefreshKey(prev => prev + 1)
  }, [zoomControls])

  const handleNodeClick = useCallback((node: PersonaNode) => {
    console.log("Persona node clicked:", node)
    // Add your persona node click logic here
  }, [])

  const handleNodeHover = useCallback((node: PersonaNode | null) => {
    console.log("Persona node hovered:", node)
    // Add your persona node hover logic here
  }, [])

  return (
    <div className={`w-full h-full bg-gradient-to-br from-purple-50 to-cyan-50 rounded-lg p-4 relative overflow-hidden ${className}`}>
      {/* Top Controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <Button
          variant={showSamePersonaLinks ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSamePersonaLinks(!showSamePersonaLinks)}
          className="h-8 px-2 text-xs hidden"
        >
          {showSamePersonaLinks ? "Hide" : "Show"} Same-Persona Links
        </Button>
        <NetworkLayoutDropdown
          currentLayout={layout}
          onLayoutChange={setLayout}
        />
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50/80 to-cyan-50/80 z-20">
          <div className="flex items-center gap-2 text-gray-700">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading persona network data...</span>
            {dataSource === 'local' && (
              <div className="text-sm text-purple-600 mb-2">
                Using uploaded CSV data
              </div>
            )}
            {dataSource === 'server' && (
              <div className="text-sm text-cyan-600 mb-2">
                Using server CSV data
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50/80 to-cyan-50/80 z-20">
          <div className="text-center text-red-600 max-w-md">
            <p className="text-sm font-medium mb-2">Error Loading Persona Data</p>
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
            {layout.charAt(0).toUpperCase() + layout.slice(1)} Layout | Personas:{" "}
            {networkData.nodes.filter(n => n.type === "persona").length} | Attributes:{" "}
            {networkData.nodes.filter(n => n.type === "attribute").length} | Links: {getFilteredPersonaData(networkData, showSamePersonaLinks).links.length}
          </div>

          {/* Instructions */}
          <div className="absolute bottom-2 left-2 z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
            Drag to pan • Scroll to zoom • Drag nodes to move • Click nodes to explore
          </div>

          <PersonaNetworkVisualization
            key={refreshKey}
            nodes={getFilteredPersonaData(networkData, showSamePersonaLinks).nodes}
            links={getFilteredPersonaData(networkData, showSamePersonaLinks).links}
            layout={layout}
            width={600}
            height={400}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onZoomControlsReady={setZoomControls}
            preservedTransform={preservedTransform}
            onTransformApplied={() => setPreservedTransform(null)}
          />
        </>
      )}
    </div>
  )
}