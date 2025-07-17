// useNetworkZoom.ts - Zoom and pan behavior

import { useCallback, useRef, RefObject } from "react"
import * as d3 from "d3"

export function useNetworkZoom(
  svgRef: RefObject<SVGSVGElement>,
  containerGroupRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
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
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity)
    }
  }, [svgRef])

  return {
    setupZoom,
    handleZoomIn,
    handleZoomOut,
    handleResetView
  }
}