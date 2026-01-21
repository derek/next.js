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
