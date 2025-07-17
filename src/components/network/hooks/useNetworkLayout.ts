// useNetworkLayout.ts - Layout algorithms (force, circular, hierarchical, grid)

import { useCallback } from "react"
import { Node } from "@/src/components/feedback-data-context"

type LayoutType = "force" | "circular" | "hierarchical" | "grid"

export function useNetworkLayout() {
  const applyLayout = useCallback((
    nodes: Node[], 
    layoutType: LayoutType, 
    width: number, 
    height: number
  ) => {
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

  return { applyLayout }
}