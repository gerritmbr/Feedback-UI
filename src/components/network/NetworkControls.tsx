// NetworkControls.tsx - Zoom, pan, reset controls

"use client"

import { Button } from "@/src/components/ui/button"
import { ZoomIn, ZoomOut, Move, RefreshCw } from "lucide-react"

interface NetworkControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onRefresh: () => void
  isLoading?: boolean
}

export function NetworkControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  onRefresh,
  isLoading = false
}: NetworkControlsProps) {
  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-white rounded-lg shadow-sm border p-1">
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={onZoomIn} 
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={onZoomOut} 
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 w-8 p-0" 
        onClick={onResetView} 
        title="Reset View"
      >
        <Move className="h-4 w-4" />
      </Button>
      
      <div className="w-full h-px bg-gray-200 my-1" />
      
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={onRefresh}
        disabled={isLoading}
        title="Refresh Data"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  )
}