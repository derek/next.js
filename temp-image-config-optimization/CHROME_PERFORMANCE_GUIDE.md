# Chrome Performance Profiler - Validation Guide

This guide shows how to use Chrome's Performance profiler to observe the actual improvement in a real browser environment.

## Setup

### 1. Create Test Page

Create a simple Next.js page with many images that re-render frequently:

```typescript
// app/perf-test/page.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'

export default function PerfTest() {
  const [key, setKey] = useState(0)

  return (
    <div>
      <button onClick={() => setKey(k => k + 1)}>
        Force Re-render (Count: {key})
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {Array.from({ length: 40 }, (_, i) => (
          <Image
            key={i}
            src={`https://picsum.photos/seed/${i}/300/300`}
            alt={`Image ${i}`}
            width={300}
            height={300}
          />
        ))}
      </div>
    </div>
  )
}
```

## Performance Testing Steps

### Test 1: Before Optimization (Baseline)

1. **Install baseline Next.js:**

   ```bash
   npm install next@canary
   npm run dev
   ```

2. **Open Chrome DevTools:**
   - Press `F12` or `⌘⌥I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Go to **Performance** tab

3. **Record performance:**
   - Click the record button (⚫)
   - Click "Force Re-render" button **10 times** rapidly
   - Stop recording (🟥)

4. **Analyze results:**
   - Look for "Recalculate Style" and "Layout" sections
   - Find calls to functions containing `getImgProps`
   - Note the time spent in array operations (`.sort()`, spread `...`)
   - Take screenshot or note the timings

### Test 2: After Optimization

1. **Install your local build:**

   ```bash
   cd /Users/derek.gathright/src/next.js
   pnpm pack --pack-destination /tmp/test-app

   cd /tmp/test-app
   npm install /tmp/test-app/next-*.tgz
   npm run dev
   ```

2. **Record same test:**
   - Repeat steps 2-3 from Test 1
   - Click "Force Re-render" **10 times** (same as before)

3. **Compare results:**
   - Look for the same `getImgProps` calls
   - You should see **reduced time** in config-related operations
   - Array operations should appear only once (in useMemo), not repeatedly

## What to Look For

### Before Optimization - Expected Trace

```
┌─ Task (10ms)
│  ├─ Recalculate Style (2ms)
│  ├─ Function Call: getImgProps (5ms)
│  │  ├─ Array.sort (1.5ms)          ← REPEATED ON EVERY RENDER
│  │  ├─ Array.spread [...] (1ms)    ← REPEATED ON EVERY RENDER
│  │  └─ Array.sort (0.5ms)          ← REPEATED ON EVERY RENDER
│  └─ Layout (3ms)
```

### After Optimization - Expected Trace

```
┌─ Task (8ms)
│  ├─ Recalculate Style (2ms)
│  ├─ Function Call: getImgProps (2ms)
│  │  └─ Flag check ('__normalized' in) (0.1ms)  ← FAST PATH
│  └─ Layout (3ms)
```

## Metrics to Compare

| Metric             | Before   | After          | Improvement       |
| ------------------ | -------- | -------------- | ----------------- |
| Total Task Time    | ~10ms    | ~8ms           | ~20%              |
| getImgProps Time   | ~5ms     | ~2ms           | ~60%              |
| Array Operations   | Repeated | Once (useMemo) | N/A               |
| Memory Allocations | High     | Low            | Fewer temp arrays |

## CPU Profiler (Advanced)

For even more detailed analysis:

1. Go to **Performance** → **⚙️ Settings**
2. Enable "Record JavaScript CPU Profile"
3. Record the same test
4. Click on "Bottom-Up" or "Call Tree" view
5. Search for `normalizeImageConfig` or `getImgProps`
6. Compare self-time and total time

### Expected Results:

**Before:**

- `getImgProps` appears frequently with high self-time
- Array operations dominate the call tree

**After:**

- `getImgProps` appears with lower self-time
- Most time spent in actual rendering, not config processing

## Quick Validation

For a quick visual check without detailed profiling:

1. Open page with 40 images
2. Open Performance Monitor (Chrome DevTools → More tools → Performance Monitor)
3. Click "Force Re-render" repeatedly
4. Watch "CPU usage" and "JS heap size" metrics

**After optimization:**

- CPU spikes should be smaller
- JS heap size growth should be slower
- UI should feel snappier

## Flame Graph Analysis

Look for these patterns in the flame graph:

### Before (Bad):

```
┌────────────────────────────────────────────┐
│ Image Component Render                     │
│  ┌──────────────────────────────┐          │
│  │ getImgProps                  │          │  ← Wide bar = more time
│  │  ┌─────┐┌─────┐┌─────┐       │          │
│  │  │sort ││ ... ││sort │       │          │  ← Array ops visible
│  │  └─────┘└─────┘└─────┘       │          │
│  └──────────────────────────────┘          │
└────────────────────────────────────────────┘
```

### After (Good):

```
┌────────────────────────────────────────────┐
│ Image Component Render                     │
│  ┌──────────────┐                          │
│  │ getImgProps  │                          │  ← Narrower bar = less time
│  │  ┌┐          │                          │
│  │  └┘          │                          │  ← Tiny flag check
│  └──────────────┘                          │
└────────────────────────────────────────────┘
```

## Automated Performance Test (Optional)

Use Lighthouse CI or similar tools to automate the comparison:

```bash
# Install Lighthouse
npm install -g lighthouse

# Test before
lighthouse http://localhost:3000/perf-test --only-categories=performance --output=json --output-path=./before.json

# Install optimized version
# ... (install your local build)

# Test after
lighthouse http://localhost:3000/perf-test --only-categories=performance --output=json --output-path=./after.json

# Compare
node -e "
  const before = require('./before.json');
  const after = require('./after.json');
  console.log('Performance Score Before:', before.categories.performance.score * 100);
  console.log('Performance Score After:', after.categories.performance.score * 100);
  console.log('TBT Before:', before.audits['total-blocking-time'].numericValue);
  console.log('TBT After:', after.audits['total-blocking-time'].numericValue);
"
```

Expected improvements:

- TBT (Total Blocking Time): 3-5% reduction
- Performance Score: Slight increase (1-2 points)
- Main thread work: Reduced by ~5-10ms on image-heavy pages
