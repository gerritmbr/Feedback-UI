"use client"

import React, { useRef, useState } from 'react'
import * as d3 from 'd3'
import { Button } from '@/src/components/ui/button'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
import { Upload, FileText, AlertCircle, CheckCircle, Database, Trash2 } from 'lucide-react'
import { useFeedbackData } from "@/src/components/feedback-data-context"

interface CSVUploadTabProps {
  className?: string
  onUploadSuccess?: () => void
}

export function CSVUploadTab({ className, onUploadSuccess }: CSVUploadTabProps) {
  const [nodesFile, setNodesFile] = useState<File | null>(null)
  const [edgesFile, setEdgesFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { hasLocalData, refreshData } = useFeedbackData()
  
  const nodesInputRef = useRef<HTMLInputElement>(null)
  const edgesInputRef = useRef<HTMLInputElement>(null)

  const handleNodesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setNodesFile(file)
      setError(null)
    } else if (file) {
      setError('Please select a valid CSV file for nodes data')
      e.target.value = ''
    }
  }

  const handleEdgesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setEdgesFile(file)
      setError(null)
    } else if (file) {
      setError('Please select a valid CSV file for edges data')
      e.target.value = ''
    }
  }

  const handleUpload = async () => {
    if (!nodesFile || !edgesFile) {
      setError('Please select both nodes and edges CSV files')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Read and parse CSV files
      const nodesText = await readFileAsText(nodesFile)
      const edgesText = await readFileAsText(edgesFile)

      // Parse to check columns
      const parsedNodes = d3.csvParse(nodesText)
      const parsedEdges = d3.csvParse(edgesText)
      
      console.log("Uploaded nodes CSV columns:", Object.keys(parsedNodes[0] || {}))
      console.log("Uploaded edges CSV columns:", Object.keys(parsedEdges[0] || {}))

      // Store in localStorage
      localStorage.setItem('feedback_csv_nodes_data', nodesText)
      localStorage.setItem('feedback_csv_edges_data', edgesText)
      localStorage.setItem('feedback_csv_upload_timestamp', Date.now().toString())

      // Notify parent component
      refreshData()
      
      // Optional: close modal after successful upload
      onUploadSuccess?.()
      
    } catch (err) {
      setError('Error processing files: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(new Error('Error reading file'))
      reader.readAsText(file)
    })
  }

  const handleClear = () => {
    localStorage.removeItem('feedback_csv_nodes_data')
    localStorage.removeItem('feedback_csv_edges_data')
    localStorage.removeItem('feedback_csv_upload_timestamp')
    setNodesFile(null)
    setEdgesFile(null)
    if (nodesInputRef.current) nodesInputRef.current.value = ''
    if (edgesInputRef.current) edgesInputRef.current.value = ''
    refreshData() // Refresh the data state
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Network Data Files
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload CSV files for network nodes and edges visualization
          </p>
        </div>

        {/* Current Status */}
        {hasLocalData ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Using uploaded CSV data files.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Using default network data files from <code>public/data/</code> directory.
            </AlertDescription>
          </Alert>
        )}

        {/* File Inputs */}
        <div className="space-y-4">
          {/* Nodes File Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Nodes CSV File
            </label>
            <input
              ref={nodesInputRef}
              type="file"
              accept=".csv"
              onChange={handleNodesFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 
                file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground 
                hover:file:bg-primary/90 cursor-pointer"
            />
            {nodesFile && (
              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {nodesFile.name} selected
              </p>
            )}
          </div>

          {/* Edges File Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Edges CSV File
            </label>
            <input
              ref={edgesInputRef}
              type="file"
              accept=".csv"
              onChange={handleEdgesFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 
                file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground 
                hover:file:bg-primary/90 cursor-pointer"
            />
            {edgesFile && (
              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {edgesFile.name} selected
              </p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleUpload}
            disabled={isUploading || !nodesFile || !edgesFile}
            className="flex-1"
          >
            {isUploading ? 'Uploading...' : 'Upload & Save'}
          </Button>
          <Button
            onClick={handleClear}
            variant="destructive"
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Data
          </Button>
        </div>

        {/* Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Expected CSV Files:</h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-mono bg-muted px-1 rounded">nodes.csv</span>
              <span>Network nodes with Id, Label, and other attributes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono bg-muted px-1 rounded">edges.csv</span>
              <span>Network connections with Source, Target, and weight</span>
            </div>
            {/*<div className="flex items-start gap-2">
              <span className="font-mono bg-muted px-1 rounded">persona_nodes.csv</span>
              <span>Persona definitions with transcript_id mappings</span>
            </div>*/}
          </div>
        </div>
      </div>
    </div>
  )
}