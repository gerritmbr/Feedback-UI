// NetworkSettingsPanel.tsx - Settings UI wrapper

"use client"

import { DropdownMenuLabel, DropdownMenuItem } from "@/src/components/ui/dropdown-menu"
import { Check, X } from "lucide-react"

interface NetworkSettingsPanelProps {
  showTranscriptLinks: boolean
  onToggleTranscriptLinks: () => void
}

export function NetworkSettingsPanel({ 
  showTranscriptLinks, 
  onToggleTranscriptLinks 
}: NetworkSettingsPanelProps) {
  return (
    <>
      <DropdownMenuLabel>Link Options</DropdownMenuLabel>
      <DropdownMenuItem 
        onClick={onToggleTranscriptLinks} 
        className="flex justify-between items-center"
      >
        <span>Show Transcript Links</span>
        {showTranscriptLinks ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        )}
      </DropdownMenuItem>
    </>
  )
}