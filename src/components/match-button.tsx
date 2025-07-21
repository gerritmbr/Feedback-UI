"use client"

import { Button } from "@/src/components/ui/button"

interface MatchButtonProps {
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function MatchButton({ onClick, isLoading = false, disabled = false }: MatchButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="h-8 px-3 text-sm"
    >
      {isLoading ? "Finding..." : "Find Matches"}
    </Button>
  )
}