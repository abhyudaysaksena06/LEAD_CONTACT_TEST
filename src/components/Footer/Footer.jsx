import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import './Footer.css'
import mascotBanner from '../../assets/mascot-nbg.webp'
import leadLogo from '../../assets/LEAD.png'
import FooterTuner from '../FooterTuner/FooterTuner'

// Dev-only: /?tune enables the drag-and-resize overlay for the footer art.
// import.meta.env.DEV is statically false in a production build, so the whole
// branch — and the import — is dropped by the bundler.
const TUNING = import.meta.env.DEV
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('tune')

// Footer inspired by the Immersive Learning site: a scrolling accent ribbon,
// tidy link columns, a giant brand mark with a stroke → fill hover effect, and
// a terminal-style baseline. Retooled for LEAD — the ribbon spells the acronym.

const RIBBON = ['Learn', 'Emerge', 'Aspire', 'Discover'] // L·E·A·D

const MENU = [
  { to: '/', label: 'Home' },
  { to: '/events', label: 'Highlights' },
  { to: '/team', label: 'Leadership' },
  { to: '/sponsors', label: 'Network' },
  { to: '/gallery', label: 'Archive' },
]

const CONNECT = [
  { label: 'Instagram', href: 'https://www.instagram.com/lead_tiet' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/lead-tiet/' },
  { label: 'GitHub', href: 'https://github.com/LEAD-Society-Thapar' },
  { label: 'Email', href: 'mailto:lead_sc@thapar.edu' },
]

export default function Footer() {
  // Duplicate the ribbon words so the marquee loops seamlessly.
  // We use 20 copies (80 words total) to ensure it spans ultra-wide monitors twice over.
  const ribbon = Array(20).fill(RIBBON).flat()

  // Reveal on scroll: mascot pops up from the bottom, LEAD logo lights up.
  const footerRef = useRef(null)
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('is-inview', entry.isIntersecting),
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <footer className="lead-footer" ref={footerRef}>
      {TUNING && <FooterTuner />}
      {/* Scrolling accent ribbon — L · E · A · D */}
      <div className="lead-footer__ribbon">
        <div className="lead-footer__marquee">
          {ribbon.map((word, i) => (
            <span key={i} className="lead-footer__marquee-item">
              {word}
              <span className="lead-footer__marquee-star">✳</span>
            </span>
          ))}
        </div>
      </div>

      <div className="lead-footer__inner">
        {/* Decorative pair. On phones/tablets this is a real flow row that sits
            between the links and the copyright; on desktop the two images are
            absolutely positioned against .lead-footer__inner instead. */}
        <div className="lead-footer__art">
          {/* Mascot — clicking it opens registration */}
          <NavLink
            to="/register"
            className="lead-footer__mascot-link"
            aria-label="Register for LEAD 2026"
          >
            <img
              src={mascotBanner}
              alt="LEAD mascot — register for LEAD 2026"
              className="lead-footer__mascot"
            />
          </NavLink>
          {/* Big LEAD wordmark */}
          <img src={leadLogo} alt="LEAD" className="lead-footer__biglogo" />
        </div>

        <div className="lead-footer__body">
          <div className="lead-footer__grid">
          <div className="lead-footer__col">
            <p className="lead-footer__label">[Menu]</p>
            <ul className="lead-footer__links">
              {MENU.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className="lead-footer__link">
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="lead-footer__col">
            <p className="lead-footer__label">[Connect]</p>
            <ul className="lead-footer__links">
              {CONNECT.map((item) => (
                <li key={item.label}>
                  <a
                    className="lead-footer__link"
                    href={item.href}
                    target={item.href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lead-footer__col">
            <p className="lead-footer__label">[Society]</p>
            <p className="lead-footer__note">
              LEAD — Thapar Institute of<br />
              Engineering &amp; Technology, Patiala.
            </p>
          </div>

          <div className="lead-footer__col">
            <p className="lead-footer__label">[Ethos]</p>
            <p className="lead-footer__note">
              Learn. Emerge. Aspire. Discover.<br />
              A community that builds leaders.
            </p>
          </div>
          </div>
        </div>

        <p className="lead-footer__copy">
          <span className="lead-footer__copy-mark">©</span> LEAD 2026 — All rights reserved
          <span className="lead-footer__cursor">▊</span>
        </p>
      </div>
    </footer>
  )
}
