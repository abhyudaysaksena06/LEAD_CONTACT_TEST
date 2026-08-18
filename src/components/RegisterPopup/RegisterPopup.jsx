import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X, ArrowRight, Sparkles } from 'lucide-react'
import './RegisterPopup.css'

const VISIBLE_MS = 10000   // how long it stays on screen
const DELAY_MS = 1200      // small beat after the page settles before it slides in
const SEEN_KEY = 'lead_register_popup_seen'

/**
 * Bottom-right nudge pointing first years at /register.
 *
 * Shows once per browser session, slides in after a short delay, and removes
 * itself after VISIBLE_MS. Suppressed on the pages where it would be noise:
 * /register (already there) and /admin (not a visitor surface).
 */
export default function RegisterPopup() {
  const { pathname } = useLocation()
  const suppressed = pathname === '/register' || pathname === '/admin'

  // null = not shown yet, 'in' = sliding in / visible, 'out' = leaving
  const [phase, setPhase] = useState(null)

  useEffect(() => {
    if (suppressed) return
    if (sessionStorage.getItem(SEEN_KEY)) return

    const enter = setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, '1')
      setPhase('in')
    }, DELAY_MS)

    return () => clearTimeout(enter)
  }, [suppressed])

  // Once visible, start the dismissal clock — unless the visitor is currently
  // interacting with it. Letting the card vanish from under a reaching cursor
  // would make the button unusable.
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (phase !== 'in' || held) return
    const leave = setTimeout(() => setPhase('out'), VISIBLE_MS)
    return () => clearTimeout(leave)
  }, [phase, held])

  // Dismiss as soon as the footer comes into view. The popup is fixed to the
  // bottom-left and the footer's mascot occupies that same corner, so leaving
  // it up there would cover the artwork — and by then the visitor has the
  // footer's own registration link anyway.
  useEffect(() => {
    if (phase !== 'in') return

    // A footer inside a display:none branch (Home kept alive behind another
    // route) reports a zero-height rect, so it can never match.
    const footerInView = () => {
      for (const f of document.querySelectorAll('.lead-footer')) {
        const r = f.getBoundingClientRect()
        if (r.height > 0 && r.top < window.innerHeight && r.bottom > 0) return true
      }
      return false
    }

    // Covers the case where the visitor is already down at the footer by the
    // time the popup is due to appear.
    if (footerInView()) { setPhase('out'); return }

    let io
    let timer

    // The footer belongs to a route component and may mount after the popup,
    // so retry briefly rather than giving up on the first miss.
    let attempts = 0
    const attach = () => {
      const footers = [...document.querySelectorAll('.lead-footer')]
        .filter((f) => f.getBoundingClientRect().height > 0)

      if (!footers.length) {
        if (attempts++ < 20) timer = setTimeout(attach, 250)
        return
      }

      io = new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) setPhase('out') },
        { threshold: 0 },
      )
      footers.forEach((f) => io.observe(f))
    }
    attach()

    return () => {
      clearTimeout(timer)
      io?.disconnect()
    }
  }, [phase])

  // Unmount after the exit transition has run.
  useEffect(() => {
    if (phase !== 'out') return
    const done = setTimeout(() => setPhase('gone'), 450)
    return () => clearTimeout(done)
  }, [phase])

  if (suppressed || phase === null || phase === 'gone') return null

  return (
    <div
      className={`reg-popup ${phase === 'in' ? 'reg-popup--in' : 'reg-popup--out'} ${held ? 'reg-popup--held' : ''}`}
      role="dialog"
      aria-labelledby="reg-popup-title"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false)
      }}
      onTouchStart={() => setHeld(true)}
    >
      {/* Countdown rail — shows the visitor it will leave on its own. */}
      <span className="reg-popup__timer" aria-hidden="true" />

      <button
        className="reg-popup__close"
        onClick={() => setPhase('out')}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      <p className="reg-popup__eyebrow">
        <Sparkles size={12} aria-hidden="true" />
        NOW OPEN
      </p>

      <h2 className="reg-popup__title" id="reg-popup-title">
        Registration for <span className="reg-popup__accent">First Years</span>
      </h2>

      <p className="reg-popup__body">
        Join LEAD 2026 — Learn, Emerge, Aspire, Discover. Takes under a minute.
      </p>

      <NavLink to="/register" className="reg-popup__cta" onClick={() => setPhase('out')}>
        <span>Register Now</span>
        <ArrowRight size={16} aria-hidden="true" />
      </NavLink>

      <button className="reg-popup__later" onClick={() => setPhase('out')}>
        Maybe later
      </button>
    </div>
  )
}
