// useD3Network.ts - Core D3.js simulation logic

import { useCallback, RefObject } from "react"
import * as d3 from "d3"

export function useD3Network(
  svgRef: RefObject<SVGSVGElement>,
  containerGroupRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
) {
  const initializeSVG = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear existing content but preserve structure
    svg.selectAll("*").remove()

    // Create main group for all network elements
    const g = svg.append("g")
    containerGroupRef.current = g

    // Set initial cursor
    svg.style("cursor", "grab")

    // Handle cursor changes during interaction
    svg.on("mousedown", function (event) {
      d3.select(this).style("cursor", "grabbing")
    })

    svg.on("mouseup", function () {
      d3.select(this).style("cursor", "grab")
    })

    svg.on("mouseleave", function () {
      d3.select(this).style("cursor", "grab")
    })
  }, [svgRef, containerGroupRef])

  return { initializeSVG }
}