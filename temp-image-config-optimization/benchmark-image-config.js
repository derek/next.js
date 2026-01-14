/* eslint-disable */

/**
 * Benchmark script to measure the performance improvement of config normalization optimization.
 *
 * This simulates the before/after scenario:
 * - Before: Config normalization happens on every getImgProps() call
 * - After: Config is normalized once and reused (memoized)
 */

const { performance } = require('perf_hooks')

// Mock image config (matching Next.js defaults)
const mockConfig = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  qualities: [75, 90],
  loader: 'default',
  path: '/_next/image',
  domains: [],
  disableStaticImages: false,
  minimumCacheTTL: 60,
  formats: ['image/webp'],
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'",
}

// Simulate the OLD behavior - normalize on every call
function normalizeConfigOld(c) {
  const allSizes = [...c.deviceSizes, ...c.imageSizes].sort((a, b) => a - b)
  const deviceSizes = c.deviceSizes.sort((a, b) => a - b)
  const qualities = c.qualities?.sort((a, b) => a - b)
  return { ...c, allSizes, deviceSizes, qualities }
}

// Simulate the NEW behavior - normalize once, reuse
function normalizeConfigNew(c) {
  const allSizes = [...c.deviceSizes, ...c.imageSizes].sort((a, b) => a - b)
  const deviceSizes = c.deviceSizes.sort((a, b) => a - b)
  const qualities = c.qualities?.sort((a, b) => a - b)
  return { ...c, allSizes, deviceSizes, qualities, __normalized: true }
}

function checkIfNormalized(config) {
  return config && '__normalized' in config
}

// Benchmark parameters
const ITERATIONS = 10000 // Simulate 10k image renders
const WARMUP = 1000

console.log('='.repeat(70))
console.log('Next.js Image Config Normalization Performance Benchmark')
console.log('='.repeat(70))
console.log(
  `\nSimulating ${ITERATIONS.toLocaleString()} image component renders`
)
console.log('(equivalent to a page with 10 images re-rendering 1000 times)\n')

// Warmup
for (let i = 0; i < WARMUP; i++) {
  normalizeConfigOld(mockConfig)
}

// Benchmark OLD behavior (normalize every time)
console.log('📊 BEFORE optimization (normalize on every render):')
const startOld = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  normalizeConfigOld(mockConfig)
}
const endOld = performance.now()
const timeOld = endOld - startOld

console.log(`   Total time: ${timeOld.toFixed(2)}ms`)
console.log(`   Avg per render: ${(timeOld / ITERATIONS).toFixed(4)}ms`)
console.log(`   Operations: ${ITERATIONS.toLocaleString()} normalizations\n`)

// Benchmark NEW behavior (normalize once, check flag)
console.log('✨ AFTER optimization (normalize once, reuse):')
const normalizedConfig = normalizeConfigNew(mockConfig)

const startNew = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  // Simulate the new code path - just check the flag
  if (checkIfNormalized(normalizedConfig)) {
    // Use pre-normalized config (no work)
     
    const config = normalizedConfig
  } else {
    // Fallback path (shouldn't hit this)
    normalizeConfigNew(mockConfig)
  }
}
const endNew = performance.now()
const timeNew = endNew - startNew

console.log(`   Total time: ${timeNew.toFixed(2)}ms`)
console.log(`   Avg per render: ${(timeNew / ITERATIONS).toFixed(4)}ms`)
console.log(
  `   Operations: 1 normalization + ${ITERATIONS.toLocaleString()} flag checks\n`
)

// Calculate improvement
const improvement = ((timeOld - timeNew) / timeOld) * 100
const speedup = timeOld / timeNew

console.log('='.repeat(70))
console.log('📈 RESULTS:')
console.log('='.repeat(70))
console.log(`Improvement: ${improvement.toFixed(1)}% faster`)
console.log(`Speedup: ${speedup.toFixed(1)}x`)
console.log(
  `Time saved: ${(timeOld - timeNew).toFixed(2)}ms per ${ITERATIONS.toLocaleString()} renders`
)
console.log(`\nFor a typical SPA with frequent re-renders:`)
console.log(
  `  - 100 re-renders/minute: saves ~${((timeOld - timeNew) / 100).toFixed(2)}ms per minute`
)
console.log(
  `  - 1000 re-renders/minute: saves ~${((timeOld - timeNew) / 10).toFixed(2)}ms per minute`
)
console.log('='.repeat(70))
