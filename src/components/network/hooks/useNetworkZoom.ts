// useNetworkZoom.ts - Zoom and pan behavior

import { useCallback, useRef, RefObject } from "react"
import * as d3 from "d3"

type NetworkBounds = {
  x: number
  y: number  
  width: number
  height: number
}

export function useNetworkZoom(
  svgRef: RefObject<SVGSVGElement>,
  containerGroupRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>,
  calculateNetworkBounds?: () => NetworkBounds | null
) {
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const setupZoom = useCallback(() => {
    if (!svgRef.current || !containerGroupRef.current) return

    const svg = d3.select(svgRef.current)
    const g = containerGroupRef.current

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        return true
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    zoomRef.current = zoom
    svg.call(zoom)
  }, [svgRef, containerGroupRef])

  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.5)
    }
  }, [svgRef])

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1 / 1.5)
    }
  }, [svgRef])

  const handleResetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return

    const svg = d3.select(svgRef.current)
    const svgElement = svgRef.current
    
    // Get actual SVG viewport dimensions
    const rect = svgElement.getBoundingClientRect()
    const viewportWidth = rect.width || svgElement.clientWidth || 600
    const viewportHeight = rect.height || svgElement.clientHeight || 400
    
    // Try to get network bounds from callback
    const networkBounds = calculateNetworkBounds?.()
    
    let transform: d3.ZoomTransform
    
    if (networkBounds && networkBounds.width > 0 && networkBounds.height > 0) {
      // Calculate transform to fit and center the network
      const networkCenterX = networkBounds.x + networkBounds.width / 2
      const networkCenterY = networkBounds.y + networkBounds.height / 2
      
      // Calculate scale to fit network in viewport with some padding
      const padding = 50
      const scaleX = (viewportWidth - 2 * padding) / networkBounds.width
      const scaleY = (viewportHeight - 2 * padding) / networkBounds.height
      const scale = Math.min(scaleX, scaleY, 2) // Cap at 2x zoom
      
      // Calculate translation to center the network
      const translateX = viewportWidth / 2 - networkCenterX * scale
      const translateY = viewportHeight / 2 - networkCenterY * scale
      
      transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    } else {
      // Fallback: center at viewport center with reasonable scale
      transform = d3.zoomIdentity
        .translate(viewportWidth / 2, viewportHeight / 2)
        .scale(0.8)
        .translate(-viewportWidth / 2, -viewportHeight / 2)
    }
    
    svg
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, transform)
  }, [svgRef, calculateNetworkBounds])

  return {
    setupZoom,
    handleZoomIn,
    handleZoomOut,
    handleResetView
  }
}