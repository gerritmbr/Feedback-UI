// NetworkLayoutDropdown.tsx - Layout selection dropdown

"use client"

import { Button } from "@/src/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/src/components/ui/dropdown-menu"
import { Settings } from "lucide-react"

type LayoutType = "force" | "circular" | "hierarchical" | "grid"

interface NetworkLayoutDropdownProps {
  currentLayout: LayoutType
  onLayoutChange: (layout: LayoutType) => void
  children?: React.ReactNode
}

const layoutOptions = [
  { value: "force" as const, label: "Force Directed" },
  { value: "circular" as const, label: "Circular" },
  { value: "hierarchical" as const, label: "Hierarchical" },
  { value: "grid" as const, label: "Grid" }
]

export function NetworkLayoutDropdown({ 
  currentLayout, 
  onLayoutChange, 
  children 
}: NetworkLayoutDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Layout Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {layoutOptions.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => onLayoutChange(value)}
            className={currentLayout === value ? "bg-accent" : ""}
          >
            {label}
          </DropdownMenuItem>
        ))}
        
        {children && (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}