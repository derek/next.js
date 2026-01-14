/**
 * Test app for profiling the image config optimization
 *
 * How to use this:
 * 1. Create a new Next.js app: `npx create-next-app@latest test-image-perf`
 * 2. Replace app/page.tsx with this file
 * 3. Open React DevTools Profiler
 * 4. Click "Start Profiling"
 * 5. Click the "Re-render 100 times" button
 * 6. Stop profiling and examine the Image component render times
 *
 * Compare results before/after the optimization by:
 * - Testing with next@canary (before optimization)
 * - Testing with your local build (after optimization)
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function ImagePerfTest() {
  const [counter, setCounter] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const triggerRerenders = () => {
    setIsRunning(true)
    let count = 0
    const interval = setInterval(() => {
      setCounter((c) => c + 1)
      count++
      if (count >= 100) {
        clearInterval(interval)
        setIsRunning(false)
      }
    }, 10) // Re-render every 10ms
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Image Config Optimization Performance Test</h1>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={triggerRerenders}
          disabled={isRunning}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            backgroundColor: isRunning ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
          }}
        >
          {isRunning ? 'Running...' : 'Re-render 100 times'}
        </button>
        <div style={{ marginTop: '1rem', fontSize: '1.5rem' }}>
          Render count: {counter}
        </div>
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '0.5rem',
        }}
      >
        <h3>Instructions:</h3>
        <ol>
          <li>Open React DevTools (⌥⌘J on Mac, Ctrl+Shift+J on Windows)</li>
          <li>Switch to the "Profiler" tab</li>
          <li>Click the blue circle (⚫) to start recording</li>
          <li>Click the "Re-render 100 times" button above</li>
          <li>Wait for it to complete, then stop recording</li>
          <li>Look at the Image component render times in the flamegraph</li>
        </ol>
      </div>

      <h2>Test Images (20 images to amplify the effect)</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem',
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            style={{ position: 'relative', width: '100%', aspectRatio: '1' }}
          >
            <Image
              src={`https://picsum.photos/seed/${i}/400/400`}
              alt={`Test image ${i}`}
              fill
              sizes="20vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '0.5rem',
        }}
      >
        <h3>What to look for:</h3>
        <p>
          <strong>Before optimization:</strong> Each Image render shows time
          spent in config normalization (array operations)
        </p>
        <p>
          <strong>After optimization:</strong> Image renders should be faster,
          with config reused from useMemo
        </p>
        <p>
          <strong>Expected improvement:</strong> 3-5% reduction in Image
          component render time, more visible with many images
        </p>
      </div>
    </div>
  )
}
