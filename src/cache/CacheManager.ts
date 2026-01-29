/**
 * LRU Cache Manager for parsed documentation
 * Caches parsed class documentation to avoid re-parsing HTML files
 */

import { ClassDocumentation } from '../indexer/types.js';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private accessOrder: string[]; // Track access order for LRU

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end of access order (most recently used)
      this.updateAccessOrder(key);
      return entry.value;
    }
    return undefined;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    this.updateAccessOrder(key);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache hit statistics (for monitoring)
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove key if it exists
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Evict the least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
  }
}

// Export a singleton instance for class documentation
export const classDocCache = new CacheManager<ClassDocumentation>(50);
