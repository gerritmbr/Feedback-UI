"use client"

import { Button } from "@/src/components/ui/button"

interface AskDataButtonProps {
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
}

export function AskDataButton({ onClick, isLoading = false, disabled = false }: AskDataButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="h-8 px-3 text-sm"
    >
      {isLoading ? "Processing..." : "Ask the Data"}
    </Button>
  );
};