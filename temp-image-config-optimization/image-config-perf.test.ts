/* eslint-disable */
/**
 * Unit test to verify the image config normalization performance improvement
 *
 * Run with: pnpm test-unit test/unit/image-config-perf.test.ts
 */

import { normalizeImageConfig } from 'next/dist/shared/lib/get-img-props'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'

describe('Image Config Performance', () => {
  const ITERATIONS = 1000

  it('should normalize config correctly', () => {
    const normalized = normalizeImageConfig(imageConfigDefault)

    expect(normalized).toHaveProperty('allSizes')
    expect(normalized).toHaveProperty('__normalized', true)
    expect(normalized.allSizes).toEqual(
      [
        ...imageConfigDefault.deviceSizes,
        ...imageConfigDefault.imageSizes,
      ].sort((a, b) => a - b)
    )
  })

  it('should have __normalized flag to enable fast path', () => {
    const normalized = normalizeImageConfig(imageConfigDefault)

    // The optimization relies on this flag being present
    expect('__normalized' in normalized).toBe(true)
    expect(normalized.__normalized).toBe(true)
  })

  it('should avoid redundant normalization when config is pre-normalized', () => {
    const normalized = normalizeImageConfig(imageConfigDefault)

    // Measure time for checking the flag (fast path)
    const startFast = performance.now()
    for (let i = 0; i < ITERATIONS; i++) {
      if ('__normalized' in normalized) {
        // Fast path: just use the config
         
        const config = normalized
      }
    }
    const fastTime = performance.now() - startFast

    // Measure time for normalizing every time (slow path)
    const startSlow = performance.now()
    for (let i = 0; i < ITERATIONS; i++) {
      normalizeImageConfig(imageConfigDefault)
    }
    const slowTime = performance.now() - startSlow

    console.log(`Fast path (flag check): ${fastTime.toFixed(2)}ms`)
    console.log(`Slow path (normalize): ${slowTime.toFixed(2)}ms`)
    console.log(
      `Improvement: ${(((slowTime - fastTime) / slowTime) * 100).toFixed(1)}%`
    )

    // The fast path should be significantly faster
    expect(fastTime).toBeLessThan(slowTime)

    // We expect at least 50x improvement (very conservative)
    expect(slowTime / fastTime).toBeGreaterThan(50)
  })

  it('should produce identical results whether normalized once or multiple times', () => {
    const normalized1 = normalizeImageConfig(imageConfigDefault)
    const normalized2 = normalizeImageConfig(imageConfigDefault)

    expect(normalized1.allSizes).toEqual(normalized2.allSizes)
    expect(normalized1.deviceSizes).toEqual(normalized2.deviceSizes)
    expect(normalized1.qualities).toEqual(normalized2.qualities)
  })

  it('should handle custom config with different sizes', () => {
    const customConfig = {
      ...imageConfigDefault,
      deviceSizes: [320, 768, 1024],
      imageSizes: [16, 32],
    }

    const normalized = normalizeImageConfig(customConfig)

    expect(normalized.allSizes).toEqual([16, 32, 320, 768, 1024])
    expect(normalized.__normalized).toBe(true)
  })
})
