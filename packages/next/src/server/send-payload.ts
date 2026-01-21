import type { IncomingMessage, ServerResponse } from 'http'
import type RenderResult from './render-result'
import type { CacheControl } from './lib/cache-control'
import type { LCPHint } from './config-shared'

import { isResSent } from '../shared/lib/utils'
import { generateETag } from './lib/etag'
import fresh from 'next/dist/compiled/fresh'
import { setResponseCacheControlHeaders } from './lib/cache-control'
import { HTML_CONTENT_TYPE_HEADER } from '../lib/constants'

export function sendEtagResponse(
  req: IncomingMessage,
  res: ServerResponse,
  etag: string | undefined
): boolean {
  if (etag) {
    /**
     * The server generating a 304 response MUST generate any of the
     * following header fields that would have been sent in a 200 (OK)
     * response to the same request: Cache-Control, Content-Location, Date,
     * ETag, Expires, and Vary. https://tools.ietf.org/html/rfc7232#section-4.1
     */
    res.setHeader('ETag', etag)
  }

  if (fresh(req.headers, { etag })) {
    res.statusCode = 304
    res.end()
    return true
  }

  return false
}

/**
 * Match a pathname against LCP hints configuration.
 * Returns the matching hint or undefined if no match.
 */
function matchLCPHint(
  pathname: string,
  lcpHints: Record<string, LCPHint>
): LCPHint | undefined {
  // Exact match first
  if (lcpHints[pathname]) {
    return lcpHints[pathname]
  }

  // TODO: Support dynamic route patterns like /blog/[slug]
  // For now, only exact matches are supported
  return undefined
}

/**
 * Generate Link header value(s) from an LCP hint.
 */
function generateLCPLinkHeaders(hint: LCPHint): string[] {
  const links: string[] = []

  if (hint.image) {
    // Preload image with high priority for LCP
    links.push(`<${hint.image}>; rel=preload; as=image; fetchpriority=high`)
  }

  if (hint.font) {
    // Preload font (always needs crossorigin for fonts)
    links.push(`<${hint.font}>; rel=preload; as=font; crossorigin`)
  }

  return links
}

export async function sendRenderResult({
  req,
  res,
  result,
  generateEtags,
  poweredByHeader,
  cacheControl,
  cdnCacheControlHeader,
  pathname,
  lcpHints,
}: {
  req: IncomingMessage
  res: ServerResponse
  result: RenderResult
  generateEtags: boolean
  poweredByHeader: boolean
  cacheControl: CacheControl | undefined
  cdnCacheControlHeader?: string
  pathname?: string
  lcpHints?: Record<string, LCPHint>
}): Promise<void> {
  if (isResSent(res)) {
    return
  }

  // Emit LCP preload hints as Link headers for HTML responses
  if (pathname && lcpHints && result.contentType === HTML_CONTENT_TYPE_HEADER) {
    const hint = matchLCPHint(pathname, lcpHints)
    if (hint) {
      const links = generateLCPLinkHeaders(hint)
      if (links.length > 0) {
        res.setHeader('Link', links.join(', '))
      }
    }
  }

  if (poweredByHeader && result.contentType === HTML_CONTENT_TYPE_HEADER) {
    res.setHeader('X-Powered-By', 'Next.js')
  }

  // If cache control is already set on the response we don't
  // override it to allow users to customize it via next.config
  if (cacheControl && !res.getHeader('Cache-Control')) {
    setResponseCacheControlHeaders(res, cacheControl, cdnCacheControlHeader)
  }

  const payload = result.isDynamic ? null : result.toUnchunkedString()

  if (generateEtags && payload !== null) {
    const etag = generateETag(payload)
    if (sendEtagResponse(req, res, etag)) {
      return
    }
  }

  if (!res.getHeader('Content-Type') && result.contentType) {
    res.setHeader('Content-Type', result.contentType)
  }

  if (payload) {
    res.setHeader('Content-Length', Buffer.byteLength(payload))
  }

  if (req.method === 'HEAD') {
    res.end(null)
    return
  }

  if (payload !== null) {
    res.end(payload)
    return
  }

  // Pipe the render result to the response after we get a writer for it.
  await result.pipeToNodeResponse(res)
}
