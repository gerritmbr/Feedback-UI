"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { TranscriptCollection } from '@/src/types/transcript'

export type TranscriptDataSource = 'uploaded' | 'local' | 'example' | 'none'

export interface TranscriptMetadata {
  source: TranscriptDataSource
  sessionId: string | null
  uploadedAt: number | null
  transcriptCount: number
  totalSize: number
  languages: string[]
  filename?: string
}

export interface TranscriptState {
  data: TranscriptCollection | null
  metadata: TranscriptMetadata
  isLoading: boolean
  error: string | null
  uploadProgress: number | null
}

export interface TranscriptActions {
  uploadTranscripts: (file: File) => Promise<boolean>
  clearUploadedData: () => Promise<void>
  refreshData: () => Promise<void>
  getDataForAPI: () => string | undefined // Returns sessionId for API calls
}

interface TranscriptContextType {
  state: TranscriptState
  actions: TranscriptActions
}

const TranscriptContext = createContext<TranscriptContextType | undefined>(undefined)

export function TranscriptProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TranscriptState>({
    data: null,
    metadata: {
      source: 'none',
      sessionId: null,
      uploadedAt: null,
      transcriptCount: 0,
      totalSize: 0,
      languages: []
    },
    isLoading: true,
    error: null,
    uploadProgress: null
  })

  // Initialize data on mount
  useEffect(() => {
    initializeTranscriptData()
  }, [])

  const initializeTranscriptData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // 1. Check for existing session first
      const savedSessionId = localStorage.getItem('transcript-session-id')
      if (savedSessionId) {
        const sessionValid = await checkSession(savedSessionId)
        if (sessionValid) {
          await loadFromSession(savedSessionId)
          return
        } else {
          localStorage.removeItem('transcript-session-id')
        }
      }

      // 2. Load fallback data (local or example)
      await loadFallbackData()
    } catch (error) {
      console.error('Failed to initialize transcript data:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load transcript data'
      }))
    }
  }

  const checkSession = async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/upload-transcripts?sessionId=${sessionId}`)
      return response.ok
    } catch (error) {
      return false
    }
  }

  const loadFromSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/upload-transcripts?sessionId=${sessionId}`)
      if (!response.ok) throw new Error('Session not found')
      
      const result = await response.json()
      
      setState(prev => ({
        ...prev,
        metadata: {
          source: 'uploaded',
          sessionId: sessionId,
          uploadedAt: result.metadata.uploadedAt,
          transcriptCount: result.metadata.transcriptCount,
          totalSize: result.metadata.fileSize,
          languages: [], // Would need to fetch full data to get this
          filename: result.metadata.filename
        },
        isLoading: false,
        error: null
      }))
    } catch (error) {
      throw new Error('Failed to load session data')
    }
  }

  const loadFallbackData = async () => {
    try {
      // Try to determine what fallback data is available by checking the health endpoint
      // This is a simple way to detect if we have local data vs example data
      const response = await fetch('/api/health')
      if (response.ok) {
        // For now, we'll assume example data is available
        // In a real implementation, the health endpoint could tell us what data sources are available
        setState(prev => ({
          ...prev,
          metadata: {
            source: 'example',
            sessionId: null,
            uploadedAt: null,
            transcriptCount: 4, // Known from example data
            totalSize: 0,
            languages: ['English', 'German']
          },
          isLoading: false,
          error: null
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        metadata: {
          source: 'none',
          sessionId: null,
          uploadedAt: null,
          transcriptCount: 0,
          totalSize: 0,
          languages: []
        },
        isLoading: false,
        error: 'No transcript data available'
      }))
    }
  }

  const uploadTranscripts = async (file: File): Promise<boolean> => {
    setState(prev => ({ ...prev, uploadProgress: 0, error: null }))

    try {
      // Validate file
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File too large (maximum 10MB)')
      }

      if (!file.name.endsWith('.json')) {
        throw new Error('File must be a JSON file')
      }

      // Read and parse file
      const content = await file.text()
      setState(prev => ({ ...prev, uploadProgress: 25 }))

      let transcriptData: any
      try {
        transcriptData = JSON.parse(content)
      } catch (error) {
        throw new Error('File is not valid JSON')
      }

      setState(prev => ({ ...prev, uploadProgress: 50 }))

      // Upload to server
      const response = await fetch('/api/upload-transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcripts: transcriptData,
          filename: file.name
        })
      })

      setState(prev => ({ ...prev, uploadProgress: 75 }))

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Upload failed')
      }

      const result = await response.json()
      setState(prev => ({ ...prev, uploadProgress: 100 }))

      // Save session ID
      localStorage.setItem('transcript-session-id', result.sessionId)

      // Update state
      setState(prev => ({
        ...prev,
        metadata: {
          source: 'uploaded',
          sessionId: result.sessionId,
          uploadedAt: result.metadata.uploadedAt,
          transcriptCount: result.validation.stats.transcriptCount,
          totalSize: result.validation.stats.totalSize,
          languages: result.validation.stats.languages,
          filename: result.metadata.filename
        },
        uploadProgress: null,
        error: null
      }))

      // Show warnings if any
      if (result.validation.warnings.length > 0) {
        console.warn('Transcript upload warnings:', result.validation.warnings)
      }

      return true
    } catch (error) {
      setState(prev => ({
        ...prev,
        uploadProgress: null,
        error: error instanceof Error ? error.message : 'Upload failed'
      }))
      return false
    }
  }

  const clearUploadedData = async (): Promise<void> => {
    const sessionId = state.metadata.sessionId
    
    if (sessionId) {
      try {
        // Delete session on server
        await fetch(`/api/upload-transcripts?sessionId=${sessionId}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.warn('Failed to delete server session:', error)
      }
      
      // Remove from localStorage
      localStorage.removeItem('transcript-session-id')
    }

    // Load fallback data
    await loadFallbackData()
  }

  const refreshData = async (): Promise<void> => {
    await initializeTranscriptData()
  }

  const getDataForAPI = (): string | undefined => {
    return state.metadata.source === 'uploaded' ? state.metadata.sessionId || undefined : undefined
  }

  const actions: TranscriptActions = {
    uploadTranscripts,
    clearUploadedData,
    refreshData,
    getDataForAPI
  }

  return (
    <TranscriptContext.Provider value={{ state, actions }}>
      {children}
    </TranscriptContext.Provider>
  )
}

export function useTranscriptData() {
  const context = useContext(TranscriptContext)
  if (!context) {
    throw new Error('useTranscriptData must be used within a TranscriptProvider')
  }
  return context
}

export function useTranscriptActions() {
  const context = useContext(TranscriptContext)
  if (!context) {
    throw new Error('useTranscriptActions must be used within a TranscriptProvider')
  }
  return context.actions
}

export function useTranscriptState() {
  const context = useContext(TranscriptContext)
  if (!context) {
    throw new Error('useTranscriptState must be used within a TranscriptProvider')
  }
  return context.state
}