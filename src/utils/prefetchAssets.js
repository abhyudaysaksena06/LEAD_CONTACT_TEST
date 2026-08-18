/**
 * Warms the site's media in the background, starting the moment the preloader
 * bar appears.
 *
 * Strategy — staged tiers, warmed in order, so the page the user actually sees
 * first is never starved by media belonging to a route they haven't opened:
 *
 *   Tier 1  HOME (critical)   nav logo, hero art, webfont      ← gates the reveal
 *   Tier 2  HOME (below fold) footer mascot + wordmark
 *   Tier 3  NEAR ROUTES       team portraits, sponsor logos
 *   Tier 4  HEAVY MEDIA       /event-images (6), /gallery-photos (50)
 *
 * Only Tier 1 is awaited by the preloader. Tiers 2-4 continue downloading after
 * the site is revealed, during idle time, so /gallery and /events are already
 * cached by the time the user navigates there — which is what removes the
 * buffering hitch on those pages.
 *
 * Everything here is fire-and-forget: failures are swallowed and nothing is
 * allowed to delay or block the preloader.
 */

// All bundled images (nav logo, team portraits, sponsor logos, ...).
// Vite resolves these to their final hashed URLs at build time.
const bundledAssets = import.meta.glob(
  '../assets/**/*.{png,jpg,jpeg,webp,svg}',
  { eager: true, query: '?url', import: 'default' }
)

// Bundled URLs are hashed, so select them by their source path, not filename.
function bundled(match) {
  return Object.entries(bundledAssets)
    .filter(([path]) => match.test(path))
    .map(([, url]) => url)
}

// Public-folder media, referenced by literal path at runtime.
const EVENT_IMAGES = [
  'stealth-sell', 'code-red', 'phantom', 'charcha', 'webinar', 'matrix',
].map((n) => `/event-images/${n}.jpg`)

// Mirrors GALLERY_PHOTOS in sections/GalleryPage/tunnel/engine.ts
const GALLERY_PHOTOS = Array.from(
  { length: 50 },
  (_, i) => `/gallery-photos/gal-${String(i + 1).padStart(2, '0')}.jpg`,
)

const FONT_URL = '/fonts/Anton-Regular.ttf'

// Tier 1 — on screen the instant the preloader lifts.
const TIER_HOME_CRITICAL = [
  ...bundled(/assets\/(LEAD|LEAD_white|hero)\.(png|svg)$/i),
  '/LEAD_white.png',
  '/icons.svg',
  '/favicon.svg',
]

// Tier 2 — Home, but below the fold (footer art).
const TIER_HOME_DEFERRED = [
  ...bundled(/assets\/mascot-nbg\.webp$/i),
  '/mascot.png',
]

// Tier 3 — the routes a visitor reaches next.
const TIER_ROUTES = [
  ...bundled(/assets\/(team|sponsors)\//i),
]

// Tier 4 — the big WebGL texture sets.
const TIER_HEAVY = [...EVENT_IMAGES, ...GALLERY_PHOTOS]

function preloadImage(url, priority = 'low') {
  return new Promise((resolve) => {
    const img = new Image()
    // don't compete with the preloader video for bandwidth
    if ('fetchPriority' in img) img.fetchPriority = priority
    img.onload = () => {
      // decode() gets it fully ready to paint, not just downloaded
      if (img.decode) img.decode().then(resolve, resolve)
      else resolve()
    }
    img.onerror = resolve // never reject: a missing asset must not block anything
    img.src = url
  })
}

function preloadFont() {
  // Register the Anton face early so text doesn't reflow after the reveal.
  if (typeof FontFace === 'undefined') return Promise.resolve()
  try {
    const face = new FontFace('Anton', `url(${FONT_URL}) format('truetype')`)
    return face
      .load()
      .then((loaded) => { document.fonts.add(loaded) })
      .catch(() => {})
  } catch {
    return Promise.resolve()
  }
}

/**
 * Download `urls` at most `limit` at a time. Unbounded parallel fetches on a
 * phone connection queue up behind each other and stall the preloader video,
 * so the heavy tiers are deliberately throttled.
 */
function warmTier(urls, { priority = 'low', limit = 6 } = {}) {
  if (!urls.length) return Promise.resolve()
  let cursor = 0
  const next = () => {
    if (cursor >= urls.length) return Promise.resolve()
    const url = urls[cursor++]
    return preloadImage(url, priority).then(next)
  }
  return Promise.all(
    Array.from({ length: Math.min(limit, urls.length) }, next)
  ).then(() => {})
}

// Run a tier when the browser is otherwise idle, so background warming never
// competes with rendering or user interaction.
function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: 3000 })
  } else {
    setTimeout(fn, 200)
  }
}

let warmupPromise = null
let backgroundStarted = false

/**
 * Kick off the warm-up. Safe to call more than once — every caller gets the
 * same underlying promise, which settles once the *Home-critical* tier is
 * ready (so StrictMode's double-mount neither double-fetches nor lets a second
 * caller believe the work is already done).
 *
 * The remaining tiers keep downloading in the background after this resolves;
 * the preloader deliberately does not wait on them.
 *
 * @returns {Promise<void>} resolves when Home is ready to paint
 */
export function prefetchSiteAssets() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (warmupPromise) return warmupPromise
  return (warmupPromise = startWarmup())
}

function startWarmup() {
  // Tier 1 at high priority — this is what the reveal actually waits on.
  const critical = Promise.allSettled([
    preloadFont(),
    warmTier(TIER_HOME_CRITICAL, { priority: 'high', limit: 4 }),
  ])
    .then(() => document.fonts?.ready?.catch?.(() => {}) ?? undefined)
    .then(() => {})

  // Everything else trickles in behind it, tier by tier, during idle time.
  critical.then(() => {
    if (backgroundStarted) return
    backgroundStarted = true
    whenIdle(() => {
      warmTier(TIER_HOME_DEFERRED, { limit: 4 })
        .then(() => warmTier(TIER_ROUTES, { limit: 6 }))
        .then(() => warmTier(TIER_HEAVY, { limit: 4 }))
        .catch(() => {})
    })
  })

  return critical
}
