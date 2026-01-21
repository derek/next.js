# LCP Hints Feature Test App

This test application demonstrates the `lcpHints` configuration option for Next.js, which enables developers to specify LCP (Largest Contentful Paint) resources per route for early preloading.

## What is `lcpHints`?

LCP is a Core Web Vital that measures how long it takes for the largest content element to appear on screen. The browser can't start loading an LCP image or font until it discovers it in the HTML/CSS, which often happens late in the page load.

`lcpHints` lets developers tell Next.js which image or font is the LCP element for each route, so Next.js can inject `<link rel="preload">` tags with `fetchPriority="high"` directly into the initial HTML. This gives the browser a head start on fetching critical resources before it would normally discover them.

## Why config-based rather than automatic?

- The LCP element varies by route (hero image on `/`, product image on `/product/[id]`, etc.)
- Static analysis can't reliably determine what's "above the fold" or visually prominent
- RUM (Real User Monitoring) data from production can identify the actual LCP elements, which developers can then feed back into config

## Configuration

```js
// next.config.js
module.exports = {
  lcpHints: {
    '/': { image: '/hero.jpg' },
    '/about': { font: '/fonts/inter.woff2' },
    '/product/[id]': { image: '/product-hero.jpg' },
  },
}
```

### `LCPHint` Interface

```typescript
interface LCPHint {
  /** URL of the LCP image to preload with fetchPriority="high" */
  image?: string
  /** URL of the LCP font to preload (for text-based LCP elements) */
  font?: string
}
```

## How It Works

1. Developer identifies LCP elements per route (via Lighthouse, RUM data, etc.)
2. Configures `lcpHints` in `next.config.js`
3. During SSR, Next.js injects preload hints via React's `ReactDOM.preload()` API
4. Browser receives preload hints in the initial HTML and starts fetching immediately

### Output

For an image hint, the HTML will include React's preload directive:
```
:HL["/hero.jpg","image",{"fetchPriority":"high"}]
```

For a font hint:
```
:HL["/fonts/inter.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
```

## Test Routes

- `/` - Tests image preload (`/hero.jpg`)
- `/about` - Tests font preload (`/fonts/inter.woff2`)

## Running the Test App

```bash
cd test-lcp-hints
npm install
npm run dev
```

Then visit http://localhost:3000 and view the page source to see the preload hints.

## Files Modified in This Branch

### Core Implementation

- `packages/next/src/server/config-shared.ts` - Added `LCPHint` interface and `lcpHints` config option
- `packages/next/src/server/config-schema.ts` - Added Zod validation for `lcpHints`
- `packages/next/src/server/app-render/types.ts` - Added `lcpHints` to `RenderOptsPartial`
- `packages/next/src/server/base-server.ts` - Added `lcpHints` to `renderOpts` initialization
- `packages/next/src/server/app-render/rsc/preloads.ts` - Added `preloadImage()` function
- `packages/next/src/server/app-render/entry-base.ts` - Exported `preloadImage`
- `packages/next/src/server/app-render/get-layer-assets.tsx` - LCP hint injection logic
- `packages/next/src/server/app-render/create-component-tree.tsx` - Added `injectedLCPHint` ref
- `packages/next/src/server/app-render/walk-tree-with-flight-router-state.tsx` - Passes `injectedLCPHint` ref
- `packages/next/src/server/app-render/app-render.tsx` - Initializes `injectedLCPHint` ref

### Turbopack Support

- `packages/next/src/build/templates/app-page.ts` - Added `lcpHints` to Turbopack's `renderOpts`

## Future Enhancements

- Support for dynamic route patterns (e.g., `/blog/[slug]`)
- HTTP Link header support for CDN/edge preloading
- Integration with RUM data collection for automatic LCP detection

### Speed Insights Integration (Idea)

Vercel Speed Insights already collects LCP attribution data from real users in production, including which specific element (image URL, text node, etc.) caused the LCP for each route. This data could be used to automatically generate or suggest `lcpHints` configuration.

**Potential approaches:**

1. **Dashboard suggestions** - Speed Insights dashboard could show a "Suggested lcpHints" section with copy-paste config based on aggregated LCP data:
   ```
   Based on your production traffic, we recommend:

   lcpHints: {
     '/': { image: '/hero.jpg' },           // LCP 85% of visits
     '/products': { image: '/banner.webp' }, // LCP 72% of visits
   }
   ```

2. **Build-time API** - `next build` could optionally fetch LCP insights from a Speed Insights API and auto-generate hints:
   ```js
   // next.config.js
   module.exports = {
     experimental: {
       autoLcpHints: true, // Fetch from Speed Insights during build
     }
   }
   ```

3. **Edge-injected preloads** - For Vercel deployments, the edge could automatically inject `Link: <...>; rel=preload` headers based on Speed Insights data, without any config needed. This would be completely transparent to developers.

4. **Dev mode feedback** - In development, the existing LCP detection (via PerformanceObserver) could report detected LCP elements back to the dev server via `/__nextjs_lcp_report`, which would log suggested config to the terminal:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ LCP Detected on /                                  │
   │ Image: /hero.jpg                                   │
   │                                                    │
   │ Add to next.config.js:                             │
   │   lcpHints: { '/': { image: '/hero.jpg' } }        │
   └─────────────────────────────────────────────────────┘
   ```

The key insight is that Speed Insights already has the data needed to make this automatic - it just needs to be connected back to the application layer.
