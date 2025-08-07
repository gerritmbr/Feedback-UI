// Time-based caching service with LRU eviction and proper memory management

import crypto from 'crypto'
import { CacheEntry, CacheMetrics } from '@/src/types/api'

/**
 * Cache service configuration
 */
interface CacheConfig {
  ttl: number          // Time-to-live in milliseconds
  maxEntries: number   // Maximum number of entries
  cleanupInterval: number // Cleanup interval in milliseconds
}

/**
 * Internal cache entry with additional metadata
 */
interface InternalCacheEntry extends CacheEntry {
  key: string
  lastAccessed: number
  accessCount: number
}

/**
 * Time-based cache service with LRU eviction
 * Designed for serverless environments with automatic cleanup
 */
export class CacheService {
  private cache = new Map<string, InternalCacheEntry>()
  private metrics: CacheMetrics = { hits: 0, misses: 0, size: 0, hitRate: 0 }
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: CacheConfig

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ttl: 5 * 60 * 1000,      // 5 minutes default
      maxEntries: 1000,         // 1000 entries max
      cleanupInterval: 2 * 60 * 1000, // 2 minutes cleanup
      ...config
    }

    // Start periodic cleanup
    this.startCleanup()
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get(key: string): string | null {
    const cacheKey = this.normalizeKey(key)
    const entry = this.cache.get(cacheKey)
    
    if (!entry) {
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey)
      this.metrics.misses++
      this.updateHitRate()
      return null
    }

    // Update access metadata (for LRU)
    entry.lastAccessed = Date.now()
    entry.accessCount++
    
    this.metrics.hits++
    this.updateHitRate()
    
    return entry.value
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param customTtl Optional custom TTL in milliseconds
   */
  set(key: string, value: string, customTtl?: number): void {
    const cacheKey = this.normalizeKey(key)
    const ttl = customTtl || this.config.ttl
    const now = Date.now()

    const entry: InternalCacheEntry = {
      key: cacheKey,
      value,
      timestamp: now,
      ttl,
      lastAccessed: now,
      accessCount: 1
    }

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLeastRecentlyUsed()
    }

    this.cache.set(cacheKey, entry)
    this.metrics.size = this.cache.size
  }

  /**
   * Check if key exists in cache (without updating access time)
   * @param key Cache key
   * @returns Whether key exists and is not expired
   */
  has(key: string): boolean {
    const cacheKey = this.normalizeKey(key)
    const entry = this.cache.get(cacheKey)
    
    if (!entry) {
      return false
    }

    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey)
      this.metrics.size = this.cache.size
      return false
    }

    return true
  }

  /**
   * Delete entry from cache
   * @param key Cache key
   * @returns Whether entry was deleted
   */
  delete(key: string): boolean {
    const cacheKey = this.normalizeKey(key)
    const deleted = this.cache.delete(cacheKey)
    
    if (deleted) {
      this.metrics.size = this.cache.size
    }
    
    return deleted
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear()
    this.metrics = { hits: 0, misses: 0, size: 0, hitRate: 0 }
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Get detailed cache information for debugging
   */
  getInfo(): {
    size: number
    maxSize: number
    ttl: number
    oldestEntry: number | null
    newestEntry: number | null
    memoryUsage: number
  } {
    let oldestTimestamp: number | null = null
    let newestTimestamp: number | null = null
    let memoryUsage = 0

    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp
      }
      
      // Rough memory calculation (key + value + overhead)
      memoryUsage += entry.key.length * 2 + entry.value.length * 2 + 200 // 200 bytes overhead
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      ttl: this.config.ttl,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
      memoryUsage
    }
  }

  /**
   * Normalize cache key (hash long keys to prevent memory issues)
   * @param key Original key
   * @returns Normalized key
   */
  private normalizeKey(key: string): string {
    // Hash keys longer than 250 characters to save memory
    if (key.length > 250) {
      return crypto.createHash('sha256').update(key).digest('hex')
    }
    
    // Remove any characters that might cause issues
    return key.replace(/[\s\n\r\t]/g, '_').toLowerCase()
  }

  /**
   * Check if cache entry is expired
   * @param entry Cache entry
   * @returns Whether entry is expired
   */
  private isExpired(entry: InternalCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return

    // Find the entry with the oldest lastAccessed time
    let lruEntry: InternalCacheEntry | null = null
    let lruKey: string | null = null

    for (const [key, entry] of this.cache.entries()) {
      if (!lruEntry || entry.lastAccessed < lruEntry.lastAccessed) {
        lruEntry = entry
        lruKey = key
      }
    }

    // Evict multiple entries if we're close to the limit (25% of max)
    const entriesToEvict = Math.max(1, Math.floor(this.config.maxEntries * 0.25))
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, entriesToEvict)

    sortedEntries.forEach(([key]) => {
      this.cache.delete(key)
    })

    this.metrics.size = this.cache.size

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache Service] Evicted ${entriesToEvict} LRU entries`)
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    this.metrics.size = this.cache.size

    if (process.env.NODE_ENV === 'development' && cleanedCount > 0) {
      console.log(`[Cache Service] Cleaned up ${cleanedCount} expired entries`)
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, this.config.cleanupInterval)

    // Cleanup on process exit (for graceful shutdown)
    process.on('beforeExit', () => {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
      }
    })
  }

  /**
   * Stop cleanup timer (for testing or manual control)
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Get cache keys for debugging (first 100 keys)
   */
  getKeys(limit: number = 100): string[] {
    return Array.from(this.cache.keys()).slice(0, limit)
  }

  /**
   * Warm up cache with predefined key-value pairs
   * Useful for preloading common responses
   */
  warmUp(entries: Array<{ key: string; value: string; ttl?: number }>): void {
    entries.forEach(({ key, value, ttl }) => {
      this.set(key, value, ttl)
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache Service] Warmed up cache with ${entries.length} entries`)
    }
  }
}

/**
 * Create cache key from hypothesis text
 * Uses SHA-256 hash for consistency and privacy
 * @param hypothesis User hypothesis text
 * @returns Cache key
 */
export function createCacheKey(hypothesis: string): string {
  // Normalize hypothesis text
  const normalized = hypothesis
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove special characters for better matching

  // Create hash for privacy and consistency
  return crypto.createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 32) // Use first 32 characters for shorter keys
}

/**
 * Cache decorator for functions
 * @param cacheService Cache service instance
 * @param ttl Optional custom TTL
 */
export function cached<T extends (...args: any[]) => Promise<string>>(
  cacheService: CacheService,
  ttl?: number
) {
  return function (target: any, propertyName: string, descriptor: TypedPropertyDescriptor<T>) {
    const method = descriptor.value!

    descriptor.value = async function (...args: any[]) {
      const cacheKey = createCacheKey(JSON.stringify(args))
      
      // Try to get from cache first
      const cachedResult = cacheService.get(cacheKey)
      if (cachedResult !== null) {
        return cachedResult
      }

      // Execute original method
      const result = await method.apply(this, args)
      
      // Cache the result
      cacheService.set(cacheKey, result, ttl)
      
      return result
    } as T

    return descriptor
  }
}

/**
 * Singleton instance of cache service
 */
let cacheServiceInstance: CacheService | null = null

/**
 * Get or create cache service instance
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    const ttl = parseInt(process.env.CACHE_TTL_MINUTES || '5') * 60 * 1000
    const maxEntries = parseInt(process.env.CACHE_MAX_ENTRIES || '1000')
    
    cacheServiceInstance = new CacheService({
      ttl,
      maxEntries,
      cleanupInterval: 2 * 60 * 1000 // 2 minutes
    })
  }
  
  return cacheServiceInstance
}