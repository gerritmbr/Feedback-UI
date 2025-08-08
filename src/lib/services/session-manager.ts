// Session management for uploaded transcript data
// Uses memory-based storage for serverless environments (Vercel)
// Falls back to file-based storage for local development

import * as fs from 'fs'
import * as path from 'path'
import { TranscriptCollection } from '@/src/types/transcript'
import { randomBytes } from 'crypto'

export interface SessionMetadata {
  id: string
  uploadedAt: number
  expiresAt: number
  filename: string
  fileSize: number
  transcriptCount: number
}

export interface SessionData {
  metadata: SessionMetadata
  transcripts: TranscriptCollection
}

class SessionManager {
  private readonly sessionDir: string
  private readonly sessionTTL: number = 4 * 60 * 60 * 1000 // 4 hours
  private readonly isServerless: boolean
  
  // Memory storage for serverless environments
  private memoryStore = new Map<string, SessionData>()
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor() {
    // Detect serverless environment (Vercel, Netlify, etc.)
    this.isServerless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)
    
    if (this.isServerless) {
      console.log('SessionManager: Using memory storage for serverless environment')
      this.initializeMemoryStorage()
    } else {
      console.log('SessionManager: Using file storage for local development')
      // Use temp directory for session storage
      this.sessionDir = path.join(process.cwd(), 'temp', 'transcript-sessions')
      this.ensureSessionDirectory()
      // Clean up expired sessions on startup
      this.cleanupExpiredSessions()
    }
  }

  private initializeMemoryStorage(): void {
    // Set up periodic cleanup for memory storage
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMemorySessions()
    }, 15 * 60 * 1000) // Cleanup every 15 minutes
  }

  private ensureSessionDirectory(): void {
    try {
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true })
        console.log(`Created session directory: ${this.sessionDir}`)
      }
    } catch (error) {
      console.error('Failed to create session directory:', error)
      console.error('This may indicate a filesystem permission issue in serverless environment')
      throw new Error(`Cannot create session directory: ${error}`)
    }
  }

  /**
   * Store transcript data and return session ID
   */
  async createSession(transcripts: TranscriptCollection, filename?: string): Promise<string> {
    const sessionId = this.generateSessionId()
    const now = Date.now()
    
    const metadata: SessionMetadata = {
      id: sessionId,
      uploadedAt: now,
      expiresAt: now + this.sessionTTL,
      filename: filename || 'uploaded-transcripts.json',
      fileSize: JSON.stringify(transcripts).length,
      transcriptCount: transcripts.transcripts.length
    }

    const sessionData: SessionData = {
      metadata,
      transcripts
    }

    if (this.isServerless) {
      return this.createMemorySession(sessionId, sessionData)
    } else {
      return this.createFileSession(sessionId, sessionData)
    }
  }

  private async createMemorySession(sessionId: string, sessionData: SessionData): Promise<string> {
    try {
      this.memoryStore.set(sessionId, sessionData)
      console.log(`Memory session created: ${sessionId}, transcripts: ${sessionData.metadata.transcriptCount}, size: ${sessionData.metadata.fileSize} bytes`)
      return sessionId
    } catch (error) {
      console.error('Failed to create memory session:', error)
      throw new Error('Failed to store transcript data in memory')
    }
  }

  private async createFileSession(sessionId: string, sessionData: SessionData): Promise<string> {
    const sessionPath = this.getSessionPath(sessionId)
    
    try {
      await fs.promises.writeFile(
        sessionPath,
        JSON.stringify(sessionData, null, 2),
        'utf8'
      )
      
      console.log(`File session created: ${sessionId}, transcripts: ${sessionData.metadata.transcriptCount}, size: ${sessionData.metadata.fileSize} bytes`)
      return sessionId
    } catch (error) {
      console.error('Failed to create file session:', error)
      throw new Error('Failed to store transcript data to file')
    }
  }

  /**
   * Retrieve transcript data by session ID
   */
  async getSession(sessionId: string): Promise<TranscriptCollection | null> {
    if (!sessionId || !this.isValidSessionId(sessionId)) {
      return null
    }

    if (this.isServerless) {
      return this.getMemorySession(sessionId)
    } else {
      return this.getFileSession(sessionId)
    }
  }

  private async getMemorySession(sessionId: string): Promise<TranscriptCollection | null> {
    try {
      const sessionData = this.memoryStore.get(sessionId)
      
      if (!sessionData) {
        return null
      }

      // Check if session is expired
      if (Date.now() > sessionData.metadata.expiresAt) {
        this.memoryStore.delete(sessionId)
        return null
      }

      return sessionData.transcripts
    } catch (error) {
      console.error(`Failed to read memory session ${sessionId}:`, error)
      return null
    }
  }

  private async getFileSession(sessionId: string): Promise<TranscriptCollection | null> {
    const sessionPath = this.getSessionPath(sessionId)
    
    try {
      if (!fs.existsSync(sessionPath)) {
        return null
      }

      const sessionContent = await fs.promises.readFile(sessionPath, 'utf8')
      const sessionData: SessionData = JSON.parse(sessionContent)
      
      // Check if session is expired
      if (Date.now() > sessionData.metadata.expiresAt) {
        await this.deleteSession(sessionId)
        return null
      }

      return sessionData.transcripts
    } catch (error) {
      console.error(`Failed to read file session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Get session metadata without loading full transcript data
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    if (!sessionId || !this.isValidSessionId(sessionId)) {
      return null
    }

    if (this.isServerless) {
      return this.getMemorySessionMetadata(sessionId)
    } else {
      return this.getFileSessionMetadata(sessionId)
    }
  }

  private async getMemorySessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const sessionData = this.memoryStore.get(sessionId)
      
      if (!sessionData) {
        return null
      }

      // Check if session is expired
      if (Date.now() > sessionData.metadata.expiresAt) {
        this.memoryStore.delete(sessionId)
        return null
      }

      return sessionData.metadata
    } catch (error) {
      console.error(`Failed to read memory session metadata ${sessionId}:`, error)
      return null
    }
  }

  private async getFileSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const sessionPath = this.getSessionPath(sessionId)
    
    try {
      if (!fs.existsSync(sessionPath)) {
        return null
      }

      const sessionContent = await fs.promises.readFile(sessionPath, 'utf8')
      const sessionData: SessionData = JSON.parse(sessionContent)
      
      // Check if session is expired
      if (Date.now() > sessionData.metadata.expiresAt) {
        await this.deleteSession(sessionId)
        return null
      }

      return sessionData.metadata
    } catch (error) {
      console.error(`Failed to read file session metadata ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Check if session exists and is valid
   */
  async hasSession(sessionId: string): Promise<boolean> {
    const metadata = await this.getSessionMetadata(sessionId)
    return metadata !== null
  }

  /**
   * Delete session data
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isValidSessionId(sessionId)) {
      return
    }

    if (this.isServerless) {
      this.deleteMemorySession(sessionId)
    } else {
      this.deleteFileSession(sessionId)
    }
  }

  private deleteMemorySession(sessionId: string): void {
    try {
      if (this.memoryStore.has(sessionId)) {
        this.memoryStore.delete(sessionId)
        console.log(`Memory session deleted: ${sessionId}`)
      }
    } catch (error) {
      console.error(`Failed to delete memory session ${sessionId}:`, error)
    }
  }

  private async deleteFileSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    
    try {
      if (fs.existsSync(sessionPath)) {
        await fs.promises.unlink(sessionPath)
        console.log(`File session deleted: ${sessionId}`)
      }
    } catch (error) {
      console.error(`Failed to delete file session ${sessionId}:`, error)
    }
  }

  /**
   * Clean up all expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (this.isServerless) {
      return this.cleanupExpiredMemorySessions()
    } else {
      return this.cleanupExpiredFileSessions()
    }
  }

  private cleanupExpiredMemorySessions(): number {
    let cleanedCount = 0
    const now = Date.now()

    try {
      for (const [sessionId, sessionData] of this.memoryStore.entries()) {
        if (now > sessionData.metadata.expiresAt) {
          this.memoryStore.delete(sessionId)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired memory sessions`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Failed to cleanup expired memory sessions:', error)
      return 0
    }
  }

  private async cleanupExpiredFileSessions(): Promise<number> {
    try {
      if (!fs.existsSync(this.sessionDir)) {
        return 0
      }

      const files = await fs.promises.readdir(this.sessionDir)
      const sessionFiles = files.filter(file => file.endsWith('.json'))
      
      let cleanedCount = 0
      const now = Date.now()

      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(this.sessionDir, file)
          const sessionContent = await fs.promises.readFile(sessionPath, 'utf8')
          const sessionData: SessionData = JSON.parse(sessionContent)
          
          if (now > sessionData.metadata.expiresAt) {
            await fs.promises.unlink(sessionPath)
            cleanedCount++
          }
        } catch (error) {
          // If we can't read/parse the file, delete it
          try {
            await fs.promises.unlink(path.join(this.sessionDir, file))
            cleanedCount++
          } catch (deleteError) {
            console.error(`Failed to delete corrupted session file ${file}:`, deleteError)
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired file sessions`)
      }

      return cleanedCount
    } catch (error) {
      console.error('Failed to cleanup expired file sessions:', error)
      return 0
    }
  }

  /**
   * Get statistics about active sessions
   */
  async getSessionStats(): Promise<{
    totalSessions: number
    totalSize: number
    oldestSession: number | null
  }> {
    if (this.isServerless) {
      return this.getMemorySessionStats()
    } else {
      return this.getFileSessionStats()
    }
  }

  private getMemorySessionStats(): {
    totalSessions: number
    totalSize: number
    oldestSession: number | null
  } {
    try {
      let totalSize = 0
      let oldestSession: number | null = null
      let validSessions = 0
      const now = Date.now()

      for (const [sessionId, sessionData] of this.memoryStore.entries()) {
        // Only count non-expired sessions
        if (now <= sessionData.metadata.expiresAt) {
          validSessions++
          totalSize += sessionData.metadata.fileSize
          
          if (oldestSession === null || sessionData.metadata.uploadedAt < oldestSession) {
            oldestSession = sessionData.metadata.uploadedAt
          }
        }
      }

      return {
        totalSessions: validSessions,
        totalSize,
        oldestSession
      }
    } catch (error) {
      console.error('Failed to get memory session stats:', error)
      return { totalSessions: 0, totalSize: 0, oldestSession: null }
    }
  }

  private async getFileSessionStats(): Promise<{
    totalSessions: number
    totalSize: number
    oldestSession: number | null
  }> {
    try {
      if (!fs.existsSync(this.sessionDir)) {
        return { totalSessions: 0, totalSize: 0, oldestSession: null }
      }

      const files = await fs.promises.readdir(this.sessionDir)
      const sessionFiles = files.filter(file => file.endsWith('.json'))
      
      let totalSize = 0
      let oldestSession: number | null = null
      let validSessions = 0
      const now = Date.now()

      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(this.sessionDir, file)
          const stats = await fs.promises.stat(sessionPath)
          const sessionContent = await fs.promises.readFile(sessionPath, 'utf8')
          const sessionData: SessionData = JSON.parse(sessionContent)
          
          // Only count non-expired sessions
          if (now <= sessionData.metadata.expiresAt) {
            validSessions++
            totalSize += stats.size
            
            if (oldestSession === null || sessionData.metadata.uploadedAt < oldestSession) {
              oldestSession = sessionData.metadata.uploadedAt
            }
          }
        } catch (error) {
          // Skip corrupted files
        }
      }

      return {
        totalSessions: validSessions,
        totalSize,
        oldestSession
      }
    } catch (error) {
      console.error('Failed to get file session stats:', error)
      return { totalSessions: 0, totalSize: 0, oldestSession: null }
    }
  }

  private generateSessionId(): string {
    return 'ts_' + randomBytes(16).toString('hex')
  }

  private isValidSessionId(sessionId: string): boolean {
    return /^ts_[a-f0-9]{32}$/.test(sessionId)
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDir, `${sessionId}.json`)
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager()
  }
  return sessionManagerInstance
}

export { SessionManager }