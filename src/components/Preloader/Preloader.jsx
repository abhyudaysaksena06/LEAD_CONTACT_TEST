import { useEffect, useRef, useState } from 'react'
import { prefetchSiteAssets } from '../../utils/prefetchAssets'
import './Preloader.css'

/**
 * Full-screen intro preloader, in three timed phases (no buffer-waiting):
 *
 *   1. "buffering" (fixed 1.5s) — the bar sits in the middle of the screen and
 *      fills to a quarter. No video is shown. This is a fixed pre-roll, NOT a
 *      wait on the network: the clip downloads in the background meanwhile.
 *   2. "lowering" (~0.75s) — the bar glides from the centre down to the bottom.
 *   3. "playing" — the video fades in and plays, whatever the connection. The
 *      bar stays synced to the clip's own playback (currentTime) up to 100%, so
 *      if the network makes the video hitch, the bar hitches with it. The clip
 *      is never skipped or cut short because of bandwidth.
 *
 * Progress is one continuous 0->100% run: the pre-roll owns the first 25%,
 * playback the rest. It never resets and never runs backwards.
 *
 * Sources: phones (and anything narrower than 8/9) get a pre-cropped 960x1080
 * file that already *is* the centre 50% of the frame, so it needs no CSS zoom
 * and ships fewer bytes. Everything else gets the full 16:9 clip.
 *
 * Mobile autoplay: phones only allow un-gestured autoplay when the video is
 * muted and inline, and React's `muted` prop doesn't reliably land as the DOM
 * attribute — so those are set imperatively on the node. Any touch also starts
 * playback, as a last resort for iOS Low Power Mode.
 */

// Chosen once at import time; matches the 8/9 breakpoint used in the CSS.
const PRECROPPED = typeof window !== 'undefined'
  && window.matchMedia('(max-aspect-ratio: 8/9)').matches
const VIDEO_SRC = PRECROPPED ? '/preloader-mobile.mp4' : '/preloader.mp4'

const BUFFER_MS = 1500 // fixed centred-bar pre-roll before the video appears
const LOWER_MS = 750 // bar travel time; must match the CSS transition duration
const BUFFER_SHARE = 0.25 // fraction of the bar owned by the pre-roll
const PLAYBACK_CEIL = 0.98 // playback tops out here; the last sliver is site readiness
const NO_VIDEO_MS = 1800 // genuine file/codec error -> run the bar out (NOT a net skip)
const SITE_WAIT_MS = 6000 // max extra wait for the site after the clip has played

export default function Preloader({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('buffering') // 'buffering' | 'lowering' | 'playing'
  const [leaving, setLeaving] = useState(false)

  const videoRef = useRef(null)
  const rootRef = useRef(null)

  const startRef = useRef(0)
  const progressRef = useRef(0) // mirror of `progress`, readable inside the rAF loop
  const lowerAtRef = useRef(0) // when the bar started lowering
  const pageLoadedRef = useRef(false) // window 'load' has fired
  const warmedRef = useRef(false) // background asset warm-up has settled
  const endedAtRef = useRef(0) // when the clip finished (starts the site-wait clock)
  const failedRef = useRef(false) // video errored / can't be used
  const endedRef = useRef(false)
  const finishedRef = useRef(false)
  const phaseRef = useRef('buffering') // mirror of `phase` readable inside rAF

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    setProgress(100)
    setTimeout(() => setLeaving(true), 400)
  }

  // Force the attributes mobile browsers check *before* evaluating autoplay.
  const setVideoRef = (el) => {
    videoRef.current = el
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    el.setAttribute('muted', '')
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
  }

  // Start warming the site's media the moment the bar appears, rather than
  // waiting for the clip to start playing. Tier 1 (Home) resolves this promise
  // and releases the reveal; the heavier route/gallery tiers keep downloading
  // in the background so those pages don't buffer when the user gets there.
  useEffect(() => {
    prefetchSiteAssets().then(() => { warmedRef.current = true })
  }, [])

  // True-preloader gate, part 1: the page itself must have finished loading.
  // (Part 2 — the asset warm-up — is kicked off at mount, above.)
  useEffect(() => {
    if (document.readyState === 'complete') {
      pageLoadedRef.current = true
      return
    }
    const onLoad = () => { pageLoadedRef.current = true }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // Media error tracking + the touch-to-start safety net.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true

    const onError = () => { failedRef.current = true }
    v.addEventListener('error', onError)

    // Strict mobile modes (e.g. iOS Low Power) block muted autoplay outright.
    const onInteract = () => { v.play?.().catch(() => {}) }
    window.addEventListener('touchstart', onInteract, { passive: true })
    window.addEventListener('pointerdown', onInteract)

    return () => {
      v.removeEventListener('error', onError)
      window.removeEventListener('touchstart', onInteract)
      window.removeEventListener('pointerdown', onInteract)
    }
  }, [])

  // Single rAF loop drives all three phases.
  useEffect(() => {
    let raf
    startRef.current = performance.now()

    const enterPlaying = (v) => {
      phaseRef.current = 'playing'
      setPhase('playing')
      // Warm-up already started at mount; this is a no-op safety net because
      // prefetchSiteAssets() is idempotent.
      prefetchSiteAssets().then(() => { warmedRef.current = true })
      if (v) {
        // The clip has been autoplaying muted (hidden) since mount — that's what
        // actually satisfies mobile autoplay policy, where a late scripted play()
        // gets blocked. Restart it from the top now that it's visible.
        try { v.currentTime = 0 } catch { /* seeking briefly unavailable */ }
        v.play?.().catch(() => {
          // Genuinely blocked (e.g. iOS Low Power) — the touch handler starts it.
        })
      }
    }

    const tick = (now) => {
      const elapsed = now - startRef.current
      const v = videoRef.current
      let next = progressRef.current

      if (failedRef.current) {
        // Genuine media error (missing/corrupt file) — not a slow network.
        // Run the bar out and reveal the site so a broken deploy can't brick it.
        next = Math.min(100, (elapsed / NO_VIDEO_MS) * 100)
      } else if (phaseRef.current === 'buffering') {
        // Fixed pre-roll: fill to BUFFER_SHARE over BUFFER_MS, then start moving
        // the bar down. We do NOT wait on the network here.
        next = Math.min(1, elapsed / BUFFER_MS) * BUFFER_SHARE * 100
        if (elapsed >= BUFFER_MS) {
          phaseRef.current = 'lowering'
          lowerAtRef.current = now
          setPhase('lowering')
        }
      } else if (phaseRef.current === 'lowering') {
        // Hold the bar full-for-the-pre-roll while it travels to the bottom,
        // then start the video.
        next = BUFFER_SHARE * 100
        if (now - lowerAtRef.current >= LOWER_MS) {
          enterPlaying(v)
        }
      } else if (endedRef.current) {
        // Clip finished but the site may not be ready yet: creep through the
        // reserved final sliver so the bar visibly keeps working.
        const waited = endedAtRef.current ? now - endedAtRef.current : 0
        const creep = Math.min(1, waited / SITE_WAIT_MS)
        next = (PLAYBACK_CEIL + creep * (0.995 - PLAYBACK_CEIL)) * 100
      } else if (v?.duration > 0) {
        // Bar synced to real playback. If the clip hitches on a slow link the
        // bar hitches with it; it is never cut short.
        const played = v.currentTime / v.duration
        next = (BUFFER_SHARE + played * (PLAYBACK_CEIL - BUFFER_SHARE)) * 100
      }

      // monotonic: never let the bar slip backwards
      if (next > progressRef.current) {
        progressRef.current = next
        setProgress(next)
      }

      const siteReady = pageLoadedRef.current && warmedRef.current
      const waitedLongEnough = endedRef.current
        && endedAtRef.current > 0
        && now - endedAtRef.current > SITE_WAIT_MS

      if (
        (endedRef.current && siteReady) ||
        waitedLongEnough ||
        (failedRef.current && next >= 100)
      ) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // The clip ending doesn't finish the preloader by itself — the rAF loop
  // completes once the site is genuinely ready (or the wait cap passes).
  const handleEnded = () => {
    endedRef.current = true
    endedAtRef.current = performance.now()
  }

  const handleTransitionEnd = (e) => {
    if (leaving && e.target === rootRef.current && e.propertyName === 'opacity') {
      onComplete?.()
    }
  }

  const pct = Math.round(progress)
  const labelLeft = Math.min(Math.max(progress, 4), 96)

  return (
    <div
      ref={rootRef}
      className={[
        'preloader',
        `preloader--${phase}`,
        leaving ? 'preloader--leaving' : '',
      ].join(' ')}
      onTransitionEnd={handleTransitionEnd}
      role="status"
      aria-live="polite"
      aria-label={phase === 'playing' ? `Playing intro, ${pct}%` : `Loading ${pct}%`}
    >
      <div className="preloader__stage">
        <video
          ref={setVideoRef}
          className={`preloader__video ${PRECROPPED ? 'is-precropped' : ''}`}
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded}
        />
      </div>

      <div className="preloader__bar-wrap">
        <div className="preloader__bar" aria-hidden="true">
          <div className="preloader__fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="preloader__pct" style={{ left: `${labelLeft}%` }}>
          {pct}%
        </div>
      </div>
    </div>
  )
}
