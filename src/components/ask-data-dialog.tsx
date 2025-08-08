"use client"

import { useState, useCallback, useMemo, memo } from "react"
import { Button } from "@/src/components/ui/button"
import { Textarea } from "@/src/components/ui/textarea"
import { Label } from "@/src/components/ui/label"
import { Progress } from "@/src/components/ui/progress"
import { Alert, AlertDescription } from "@/src/components/ui/alert"
import { Badge } from "@/src/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Clock, ChevronDown } from "lucide-react"
import { usePersonaData } from "@/src/components/persona-data-context"
import { usePersonaNetworkData } from "@/src/components/network/hooks/usePersonaNetworkData"
import { useTranscriptActions, useTranscriptState } from '@/src/components/transcript-data-context'

// Types for API responses
interface HypothesisTestResponse {
  result: string
  connectionFound: boolean
  processingTime: number
  cached: boolean
  transcriptsAnalyzed?: number  // NEW: transparency for user
  personasUsed?: string[]       // NEW: filtering context (array of persona IDs)
  dataSource?: 'uploaded' | 'local' | 'example'  // NEW: data source transparency
}

interface APIErrorResponse {
  error: 'RATE_LIMITED' | 'INVALID_INPUT' | 'CLAUDE_API_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE'
  message: string
  retryAfter?: number
}

interface AskDataDialogProps {
  isOpen: boolean
  onClose: () => void
}

type DialogState = 'input' | 'processing' | 'results' | 'error'

interface ProcessingProgress {
  step: string
  progress: number
  estimatedTime?: number
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// PersonaDisplaySection Component
const PersonaDisplaySection = memo(function PersonaDisplaySection() {
  const [expanded, setExpanded] = useState(false)
  const { selectedNodeIds, nodesData, edgesData, isLoading: personaDataLoading } = usePersonaData()
  const { processPersonaNetworkData } = usePersonaNetworkData()

  const selectedPersonaInfo = useMemo(() => {
    console.log('🎭 PersonaDisplaySection: Processing persona data for dialog', {
      personaDataLoading,
      selectedNodeIds: Array.from(selectedNodeIds),
      nodesCount: nodesData.length,
      edgesCount: edgesData.length
    })

    if (personaDataLoading || !nodesData.length || !edgesData.length || selectedNodeIds.size === 0) {
      return []
    }

    try {
      // Process persona network data
      const personaNetworkData = processPersonaNetworkData(nodesData, edgesData)
      
      if (!personaNetworkData?.nodes) return []

      const personas = personaNetworkData.nodes
        .filter(node => selectedNodeIds.has(node.id) && node.type === 'persona')
        .map(node => ({
          id: node.id,
          label: node.label,
          truncatedLabel: truncateText(node.label, 40)
        }))

      console.log('🎭 PersonaDisplaySection: Processed personas for dialog:', personas.length)
      return personas
    } catch (error) {
      console.error('Error processing persona data for dialog:', error)
      return []
    }
  }, [selectedNodeIds, nodesData, edgesData, personaDataLoading, processPersonaNetworkData])

  const count = selectedPersonaInfo.length

  // Hide entirely when no selection
  if (count === 0) return null

  // Show individual names (1-3 personas)
  if (count <= 3) {
    return (
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Filtered by {count} persona{count > 1 ? 's' : ''}
        </h3>
        <ul className="space-y-1">
          {selectedPersonaInfo.map(persona => (
            <li key={persona.id} className="text-sm text-gray-600 flex items-center">
              <Badge variant="secondary" className="mr-2 text-xs">P</Badge>
              {persona.truncatedLabel}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Show compact count + expandable detail (4+ personas)
  return (
    <div className="mb-4 pb-3 border-b border-gray-200">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">
          Filtered by {count} personas
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      
      {expanded && (
        <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {selectedPersonaInfo.map(persona => (
            <li key={persona.id} className="text-xs text-gray-500 pl-2">
              • {persona.truncatedLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export function AskDataDialog({ isOpen, onClose }: AskDataDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>('input')
  const [hypothesis, setHypothesis] = useState('')
  const [results, setResults] = useState<HypothesisTestResponse | null>(null)
  const [error, setError] = useState<APIErrorResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({ step: 'Initializing...', progress: 0 })
  
  // Access persona context for filtering
  const { selectedNodeIds, nodesData, edgesData } = usePersonaData()
  const { processPersonaNetworkData } = usePersonaNetworkData()
  
  // Process persona network data
  const personaNetworkData = useMemo(() => {
    if (!nodesData.length || !edgesData.length) return null
    
    try {
      return processPersonaNetworkData(nodesData, edgesData)
    } catch (error) {
      console.error('Error processing persona network data in dialog:', error)
      return null
    }
  }, [nodesData, edgesData, processPersonaNetworkData])

  const simulateProgress = useCallback(() => {
    const steps = [
      { step: 'Validating hypothesis...', progress: 10 },
      { step: 'Loading reference data...', progress: 25 },
      { step: 'Analyzing with Claude AI...', progress: 60 },
      { step: 'Processing results...', progress: 85 },
      { step: 'Finalizing...', progress: 95 }
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProcessingProgress(steps[currentStep])
        currentStep++
      } else {
        clearInterval(interval)
        setProcessingProgress({ step: 'Complete', progress: 100 })
      }
    }, 800)

    return () => clearInterval(interval)
  }, [])

  const transcriptState = useTranscriptState()
  const { getDataForAPI } = useTranscriptActions()

  const handleSubmit = async () => {
    if (!hypothesis.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    setDialogState('processing')
    setError(null)
    setResults(null)
    
    // Extract selected persona IDs for server-side filtering
    const selectedPersonaIds = Array.from(selectedNodeIds).filter(nodeId => 
      personaNetworkData?.nodes.find(n => n.id === nodeId && n.type === 'persona')
    )
    
    // Get transcript session ID for API
    const transcriptSessionId = getDataForAPI()
    
    console.log('🎭 AskDataDialog: Sending hypothesis with persona filtering', {
      hypothesis: hypothesis.trim(),
      selectedPersonaIds,
      totalPersonasAvailable: personaNetworkData?.nodes.filter(n => n.type === 'persona').length || 0,
      transcriptDataSource: transcriptState.metadata.source,
      hasTranscriptSession: !!transcriptSessionId
    })
    
    // Start progress simulation
    const cleanup = simulateProgress()
    
    try {
      const response = await fetch('/api/hypothesis-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          hypothesis: hypothesis.trim(),
          selectedPersonaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : undefined,
          transcriptSessionId: transcriptSessionId
        })
      })

      const data = await response.json()
      
      cleanup() // Stop progress simulation
      
      if (!response.ok) {
        const errorData = data as APIErrorResponse
        setError(errorData)
        setDialogState('error')
        return
      }

      const resultData = data as HypothesisTestResponse
      setResults(resultData)
      setDialogState('results')
      
    } catch (err) {
      cleanup() // Stop progress simulation
      
      // Handle network or parsing errors
      setError({
        error: 'INTERNAL_ERROR',
        message: 'Failed to connect to the analysis service. Please check your connection and try again.'
      })
      setDialogState('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setDialogState('input')
    setHypothesis('')
    setResults(null)
    setError(null)
    setIsSubmitting(false)
    onClose()
  }

  const handleRetry = () => {
    setError(null)
    setDialogState('input')
  }

  const formatMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
      .replace(/\n\n/g, '</p><p class="mt-3">')
      .replace(/\n/g, '<br>')
  }

  const getConnectionIcon = (connectionFound: boolean) => {
    return connectionFound ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-amber-500" />
    )
  }

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'RATE_LIMITED':
        return <Clock className="h-4 w-4 text-amber-500" />
      case 'TIMEOUT':
        return <Clock className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getErrorMessage = (error: APIErrorResponse) => {
    switch (error.error) {
      case 'RATE_LIMITED':
        return {
          title: 'Rate Limit Exceeded',
          description: error.retryAfter 
            ? `Please wait ${error.retryAfter} seconds before trying again.`
            : 'Too many requests. Please wait a moment before trying again.',
          canRetry: true
        }
      case 'INVALID_INPUT':
        return {
          title: 'Invalid Hypothesis',
          description: error.message,
          canRetry: true
        }
      case 'CLAUDE_API_ERROR':
        return {
          title: 'Analysis Service Unavailable',
          description: 'The AI analysis service is temporarily unavailable. Please try again later.',
          canRetry: true
        }
      case 'TIMEOUT':
        return {
          title: 'Request Timeout',
          description: 'The analysis took too long to complete. Try a shorter hypothesis.',
          canRetry: true
        }
      case 'SERVICE_UNAVAILABLE':
        return {
          title: 'Service Unavailable',
          description: 'The service is currently under maintenance. Please try again later.',
          canRetry: false
        }
      default:
        return {
          title: 'Analysis Failed',
          description: error.message || 'An unexpected error occurred. Please try again.',
          canRetry: true
        }
    }
  }

  const renderInputState = () => {
    return (
      <div className="space-y-4">
        {/* Selected Personas Section */}
        <PersonaDisplaySection />
        
        <div>
          <Label htmlFor="hypothesis">What's your Hypothesis?</Label>
          <Textarea
            id="hypothesis"
            placeholder="Enter your hypothesis about the data... (e.g., 'Students prefer interactive teaching methods over traditional lectures')"
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            className="mt-2"
            rows={4}
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-muted-foreground">
              {hypothesis.length}/1000 characters
            </p>
            {hypothesis.trim().length < 10 && hypothesis.length > 0 && (
              <p className="text-xs text-amber-600">
                Minimum 10 characters required
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!hypothesis.trim() || hypothesis.trim().length < 10 || isSubmitting}
          >
            Ask the Data
          </Button>
        </div>
      </div>
    )
  }
 
  const renderProcessingState = () => {
    const selectedPersonaCount = personaNetworkData?.nodes.filter(n => 
      selectedNodeIds.has(n.id) && n.type === 'persona'
    ).length || 0
    
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
        
        <div className="text-center space-y-2">
          <p className="font-medium text-foreground">{processingProgress.step}</p>
          {selectedPersonaCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Analyzing with {selectedPersonaCount} selected persona context{selectedPersonaCount > 1 ? 's' : ''}...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Analyzing with full dataset context...
            </p>
          )}
        </div>
      
      <div className="w-full max-w-sm space-y-2">
        <Progress value={processingProgress.progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {processingProgress.progress}% complete
        </p>
      </div>
      
      <p className="text-xs text-muted-foreground text-center max-w-md">
        This usually takes 10-30 seconds depending on the complexity of your hypothesis.
      </p>
    </div>
    )
  }

  const renderResultsState = () => {
    if (!results) return null
    
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
          {getConnectionIcon(results.connectionFound)}
          <div className="flex-1">
            <h4 className="text-sm font-medium mb-1">
              {results.connectionFound ? 'Connection Found' : 'No Connection Found'}
            </h4>
            <p className="text-xs text-muted-foreground">
              Analysis completed in {results.processingTime}ms
              {results.cached && ' (from cache)'}
            </p>
          </div>
        </div>
        
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <div 
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: `<p>${formatMarkdown(results.result)}</p>`
              }}
            />
          </div>
        </div>
        
        {/* NEW: Filtering context */}
        {(results.transcriptsAnalyzed !== undefined || results.personasUsed !== undefined || results.dataSource) && (
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            <div>
              Analysis based on {results.transcriptsAnalyzed || 'all'} transcript(s)
              {(results.personasUsed && results.personasUsed.length > 0) && ` from ${results.personasUsed.length} selected persona(s)`}
            </div>
            {results.dataSource && (
              <div className="flex items-center gap-1">
                <span>Data source:</span>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {results.dataSource === 'uploaded' && '📤 Uploaded'}
                  {results.dataSource === 'local' && '💻 Local File'}
                  {results.dataSource === 'example' && '📋 Example Data'}
                </Badge>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => setDialogState('input')}>
            Ask Another Question
          </Button>
          <Button onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  const renderErrorState = () => {
    if (!error) return null
    
    const errorInfo = getErrorMessage(error)
    
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            {getErrorIcon(error.error)}
            <div className="flex-1">
              <h4 className="font-medium">{errorInfo.title}</h4>
              <AlertDescription className="mt-1">
                {errorInfo.description}
              </AlertDescription>
            </div>
          </div>
        </Alert>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {errorInfo.canRetry && (
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    )
  }

  const getDialogTitle = () => {
    switch (dialogState) {
      case 'input':
        return "Ask the Data"
      case 'processing':
        return "Processing Hypothesis"
      case 'results':
        return results?.connectionFound ? "Connection Found" : "Analysis Complete"
      case 'error':
        return error ? getErrorMessage(error).title : "Error"
      default:
        return "Ask the Data"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`sm:max-w-lg ${dialogState === 'results' ? 'sm:max-w-2xl' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogState === 'results' && results && getConnectionIcon(results.connectionFound)}
            {dialogState === 'error' && error && getErrorIcon(error.error)}
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {dialogState === 'input' && renderInputState()}
          {dialogState === 'processing' && renderProcessingState()}
          {dialogState === 'results' && renderResultsState()}
          {dialogState === 'error' && renderErrorState()}
        </div>
      </DialogContent>
    </Dialog>
  )
}

