import { getLinkAndScriptTags } from './get-css-inlined-link-tags'
import { getPreloadableFonts } from './get-preloadable-fonts'
import type { AppRenderContext } from './app-render'
import { getAssetQueryString } from './get-asset-query-string'
import { encodeURIPath } from '../../shared/lib/encode-uri-path'
import type { PreloadCallbacks } from './types'
import { renderCssResource } from './render-css-resource'
import type { LCPHint } from '../config-shared'

/**
 * Match a pathname against LCP hints configuration.
 * Returns the matching hint or undefined if no match.
 */
function matchLCPHint(
  pathname: string,
  lcpHints: Record<string, LCPHint> | undefined
): LCPHint | undefined {
  if (!lcpHints) return undefined

  // Exact match first
  if (lcpHints[pathname]) {
    return lcpHints[pathname]
  }

  // TODO: Support dynamic route patterns like /blog/[slug]
  // For now, only exact matches are supported
  return undefined
}

export function getLayerAssets({
  ctx,
  layoutOrPagePath,
  injectedCSS: injectedCSSWithCurrentLayout,
  injectedJS: injectedJSWithCurrentLayout,
  injectedFontPreloadTags: injectedFontPreloadTagsWithCurrentLayout,
  injectedLCPHint: injectedLCPHintRef,
  preloadCallbacks,
}: {
  layoutOrPagePath: string | undefined
  injectedCSS: Set<string>
  injectedJS: Set<string>
  injectedFontPreloadTags: Set<string>
  injectedLCPHint: { current: boolean }
  ctx: AppRenderContext
  preloadCallbacks: PreloadCallbacks
}): React.ReactNode {
  const {
    componentMod: { createElement },
  } = ctx
  const { styles: styleTags, scripts: scriptTags } = layoutOrPagePath
    ? getLinkAndScriptTags(
        layoutOrPagePath,
        injectedCSSWithCurrentLayout,
        injectedJSWithCurrentLayout,
        true
      )
    : { styles: [], scripts: [] }

  const preloadedFontFiles = layoutOrPagePath
    ? getPreloadableFonts(
        ctx.renderOpts.nextFontManifest,
        layoutOrPagePath,
        injectedFontPreloadTagsWithCurrentLayout
      )
    : null

  if (preloadedFontFiles) {
    if (preloadedFontFiles.length) {
      for (let i = 0; i < preloadedFontFiles.length; i++) {
        const fontFilename = preloadedFontFiles[i]
        const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(fontFilename)![1]
        const type = `font/${ext}`
        const href = `${ctx.assetPrefix}/_next/${encodeURIPath(fontFilename)}`

        preloadCallbacks.push(() => {
          ctx.componentMod.preloadFont(
            href,
            type,
            ctx.renderOpts.crossOrigin,
            ctx.nonce
          )
        })
      }
    } else {
      try {
        let url = new URL(ctx.assetPrefix)
        preloadCallbacks.push(() => {
          ctx.componentMod.preconnect(url.origin, 'anonymous', ctx.nonce)
        })
      } catch (error) {
        // assetPrefix must not be a fully qualified domain name. We assume
        // we should preconnect to same origin instead
        preloadCallbacks.push(() => {
          ctx.componentMod.preconnect('/', 'anonymous', ctx.nonce)
        })
      }
    }
  }

  // Inject LCP hints from next.config.js (only once per request)
  if (!injectedLCPHintRef.current) {
    const lcpHint = matchLCPHint(ctx.url.pathname, ctx.renderOpts.lcpHints)
    if (lcpHint) {
      injectedLCPHintRef.current = true

      // Preload LCP image with high priority
      if (lcpHint.image) {
        preloadCallbacks.push(() => {
          ctx.componentMod.preloadImage(lcpHint.image!, ctx.nonce, 'high')
        })
      }

      // Preload LCP font (if text-based LCP)
      // Fonts always require crossOrigin for CORS, default to 'anonymous'
      if (lcpHint.font) {
        const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(lcpHint.font)
        if (ext) {
          const type = `font/${ext[1]}`
          preloadCallbacks.push(() => {
            ctx.componentMod.preloadFont(
              lcpHint.font!,
              type,
              ctx.renderOpts.crossOrigin ?? 'anonymous',
              ctx.nonce
            )
          })
        }
      }
    }
  }

  const styles = renderCssResource(styleTags, ctx, preloadCallbacks)

  const scripts = scriptTags
    ? scriptTags.map((href, index) => {
        const fullSrc = `${ctx.assetPrefix}/_next/${encodeURIPath(
          href
        )}${getAssetQueryString(ctx, true)}`

        return createElement('script', {
          src: fullSrc,
          async: true,
          key: `script-${index}`,
          nonce: ctx.nonce,
        })
      })
    : []

  return styles.length || scripts.length ? [...styles, ...scripts] : null
}
