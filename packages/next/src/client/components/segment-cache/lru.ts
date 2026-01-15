import { deleteMapEntry } from './cache-map'
import type { UnknownMapEntry } from './cache-map'

// We use an LRU for memory management. We must update this whenever we add or
// remove a new cache entry, or when an entry changes size.

let head: UnknownMapEntry | null = null
let didScheduleCleanup: boolean = false
let lruSize: number = 0

/**
 * Calculate adaptive cache size based on device memory.
 *
 * Strategy:
 * - Uses 5% of available device memory (balance between performance and safety)
 * - Minimum: 25 MB (prevents thrashing on low-memory devices like 2 GB phones)
 * - Maximum: 200 MB (prevents excessive memory use on high-end desktops)
 * - Fallback: 50 MB (for browsers without navigator.deviceMemory support)
 *
 * Examples:
 * - 2 GB device  → 5% = 102 MB → clamped to 100 MB (close to min)
 * - 4 GB device  → 5% = 204 MB → clamped to 200 MB (at max)
 * - 8 GB device  → 5% = 409 MB → clamped to 200 MB (at max)
 * - 16 GB device → 5% = 819 MB → clamped to 200 MB (at max)
 *
 * Browser support:
 * - Chrome/Edge: ✓ (since Chrome 63)
 * - Firefox/Safari: ✗ (falls back to 50 MB)
 * - Node.js/SSR: ✗ (falls back to 50 MB)
 *
 * @returns Cache size in bytes
 */
function getAdaptiveCacheSize(): number {
  // Check if navigator.deviceMemory is available (not in all browsers/environments)
  if (
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    typeof navigator.deviceMemory === 'number' &&
    navigator.deviceMemory > 0
  ) {
    const deviceMemoryGB = navigator.deviceMemory
    const deviceMemoryBytes = deviceMemoryGB * 1024 * 1024 * 1024

    // Use 5% of device memory for cache
    // Rationale: Balance between cache effectiveness and avoiding memory pressure.
    // Lower percentage (3%) would reduce cache hits, higher (7%) increases OOM risk.
    const calculatedSize = Math.floor(deviceMemoryBytes * 0.05)

    // Clamp between 25 MB and 200 MB
    // Min: Ensures reasonable cache even on low-memory devices (e.g., budget phones)
    // Max: Prevents excessive allocation on high-memory devices (e.g., gaming PCs)
    const minSize = 25 * 1024 * 1024 // 25 MB
    const maxSize = 200 * 1024 * 1024 // 200 MB

    return Math.max(minSize, Math.min(maxSize, calculatedSize))
  }

  // Default fallback for environments without deviceMemory API
  // This maintains backward compatibility and works in Firefox, Safari, Node.js
  return 50 * 1024 * 1024 // 50 MB
}

// TODO: Make this customizable via the Next.js config.
// Potential config shape:
//   experimental: {
//     segmentCache: {
//       maxSize: number | 'adaptive' // bytes, or 'adaptive' for device-based sizing
//       minSize: number               // minimum when using adaptive (default: 25 MB)
//       maxSize: number               // maximum when using adaptive (default: 200 MB)
//       percentage: number            // percentage of device memory (default: 0.05 = 5%)
//     }
//   }
const maxLruSize = getAdaptiveCacheSize()

// Export for debugging/testing
if (process.env.NODE_ENV === 'development') {
  // Make cache size visible in dev tools for debugging
  ;(globalThis as any).__NEXT_SEGMENT_CACHE_SIZE = maxLruSize
}

export function lruPut(node: UnknownMapEntry) {
  if (head === node) {
    // Already at the head
    return
  }
  const prev = node.prev
  const next = node.next
  if (next === null || prev === null) {
    // This is an insertion
    lruSize += node.size
    // Whenever we add an entry, we need to check if we've exceeded the
    // max size. We don't evict entries immediately; they're evicted later in
    // an asynchronous task.
    ensureCleanupIsScheduled()
  } else {
    // This is a move. Remove from its current position.
    prev.next = next
    next.prev = prev
  }

  // Move to the front of the list
  if (head === null) {
    // This is the first entry
    node.prev = node
    node.next = node
  } else {
    // Add to the front of the list
    const tail = head.prev
    node.prev = tail
    // In practice, this is never null, but that isn't encoded in the type
    if (tail !== null) {
      tail.next = node
    }
    node.next = head
    head.prev = node
  }
  head = node
}

export function updateLruSize(node: UnknownMapEntry, newNodeSize: number) {
  // This is a separate function from `put` so that we can resize the entry
  // regardless of whether it's currently being tracked by the LRU.
  const prevNodeSize = node.size
  node.size = newNodeSize
  if (node.next === null) {
    // This entry is not currently being tracked by the LRU.
    return
  }
  // Update the total LRU size
  lruSize = lruSize - prevNodeSize + newNodeSize
  ensureCleanupIsScheduled()
}

export function deleteFromLru(deleted: UnknownMapEntry) {
  const next = deleted.next
  const prev = deleted.prev
  if (next !== null && prev !== null) {
    lruSize -= deleted.size

    deleted.next = null
    deleted.prev = null

    // Remove from the list
    if (head === deleted) {
      // Update the head
      if (next === head) {
        // This was the last entry
        head = null
      } else {
        head = next
      }
    } else {
      prev.next = next
      next.prev = prev
    }
  } else {
    // Already deleted
  }
}

function ensureCleanupIsScheduled() {
  if (didScheduleCleanup || lruSize <= maxLruSize) {
    return
  }
  didScheduleCleanup = true
  requestCleanupCallback(cleanup)
}

function cleanup() {
  didScheduleCleanup = false

  // Evict entries until we're at 90% capacity. We can assume this won't
  // infinite loop because even if `maxLruSize` were 0, eventually
  // `deleteFromLru` sets `head` to `null` when we run out entries.
  const ninetyPercentMax = maxLruSize * 0.9
  while (lruSize > ninetyPercentMax && head !== null) {
    const tail = head.prev
    // In practice, this is never null, but that isn't encoded in the type
    if (tail !== null) {
      // Delete the entry from the map. In turn, this will remove it from
      // the LRU.
      deleteMapEntry(tail)
    }
  }
}

const requestCleanupCallback =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 0)
