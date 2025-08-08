"use client"

import React, { useRef, useState } from 'react'
import { useTranscriptData, useTranscriptActions, TranscriptDataSource } from './transcript-data-context'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { Alert, AlertDescription } from '@/src/components/ui/alert'
import { Upload, FileText, Trash2, RefreshCw, AlertCircle, CheckCircle, Database } from 'lucide-react'

interface TranscriptUploadSectionProps {
  className?: string
}

export function TranscriptUploadSection({ className }: TranscriptUploadSectionProps) {
  const { state } = useTranscriptData()
  const { uploadTranscripts, clearUploadedData, refreshData } = useTranscriptActions()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    const success = await uploadTranscripts(file)
    if (success && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const file = event.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const getSourceIcon = (source: TranscriptDataSource) => {
    switch (source) {
      case 'uploaded':
        return <Upload className="h-4 w-4" />
      case 'local':
        return <Database className="h-4 w-4" />
      case 'example':
        return <FileText className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getSourceLabel = (source: TranscriptDataSource) => {
    switch (source) {
      case 'uploaded':
        return 'Uploaded Data'
      case 'local':
        return 'Local File'
      case 'example':
        return 'Example Data'
      case 'none':
        return 'No Data'
      default:
        return 'Unknown'
    }
  }

  const getSourceDescription = (source: TranscriptDataSource) => {
    switch (source) {
      case 'uploaded':
        return 'Using your uploaded transcript data'
      case 'local':
        return 'Using local development transcript file'
      case 'example':
        return 'Using built-in example data for demonstration'
      case 'none':
        return 'No transcript data available'
      default:
        return 'Unknown data source'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getSourceIcon(state.metadata.source)}
          Transcript Data
        </CardTitle>
        <CardDescription>
          Manage interview transcript data for hypothesis testing
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Data Source Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={state.metadata.source === 'uploaded' ? 'default' : 'secondary'}>
                {getSourceLabel(state.metadata.source)}
              </Badge>
              {state.metadata.source === 'uploaded' && (
                <Badge variant="outline" className="text-xs">
                  Session Active
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {getSourceDescription(state.metadata.source)}
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={state.isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${state.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Data Statistics */}
        {state.metadata.transcriptCount > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Transcripts:</span>
              <span className="ml-2 font-medium">{state.metadata.transcriptCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Languages:</span>
              <span className="ml-2 font-medium">
                {state.metadata.languages.length > 0 
                  ? state.metadata.languages.join(', ') 
                  : 'Unknown'
                }
              </span>
            </div>
            {state.metadata.totalSize > 0 && (
              <div>
                <span className="text-muted-foreground">Size:</span>
                <span className="ml-2 font-medium">{formatFileSize(state.metadata.totalSize)}</span>
              </div>
            )}
            {state.metadata.uploadedAt && (
              <div>
                <span className="text-muted-foreground">Uploaded:</span>
                <span className="ml-2 font-medium">{formatDate(state.metadata.uploadedAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Progress */}
        {state.uploadProgress !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{state.uploadProgress}%</span>
            </div>
            <Progress value={state.uploadProgress} />
          </div>
        )}

        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          } ${state.uploadProgress !== null ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Drop transcript file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                JSON format, max 10MB. See documentation for format requirements.
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={state.uploadProgress !== null}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={state.uploadProgress !== null}
            >
              <FileText className="h-4 w-4 mr-2" />
              Select File
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {state.metadata.source === 'uploaded' && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearUploadedData}
              disabled={state.isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Uploaded Data
            </Button>
          )}
          
          {state.metadata.source === 'example' && (
            <Alert className="flex-1">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Using example data. Upload your own transcript file for real analysis.
              </AlertDescription>
            </Alert>
          )}

          {state.metadata.source === 'local' && (
            <Alert className="flex-1">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Using local transcript file. This is likely development data.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}