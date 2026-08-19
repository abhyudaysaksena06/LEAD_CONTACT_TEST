import { useCallback, useEffect, useRef, useState } from 'react'
import './FooterTuner.css'

/**
 * Development-only visual tuner for the footer's mascot and wordmark.
 *
 * Drag either image to reposition it, use the sliders to resize, then hit
 * "Copy CSS" and paste the result into Footer.css — or just leave the values
 * in localStorage and they can be read back from the page.
 *
 * Nothing here ships: Footer.jsx only mounts it when import.meta.env.DEV is
 * true and the URL carries ?tune.
 */

const STORE = 'lead_footer_tune'

const DEFAULTS = {
  mascotX: 0, mascotY: 0, mascotW: 0,   // 0 width = "use the CSS default"
  logoX: 0,   logoY: 0,   logoW: 0,
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
  catch { return { ...DEFAULTS } }
}

export default function FooterTuner() {
  const [v, setV] = useState(load)
  const [active, setActive] = useState(null)   // 'mascot' | 'logo' | null
  const [copied, setCopied] = useState(false)
  const drag = useRef(null)

  const set = (patch) => setV((prev) => ({ ...prev, ...patch }))

  // Push values into the footer as CSS variables + persist them.
  useEffect(() => {
    const footer = document.querySelector('.lead-footer')
    if (!footer) return
    const px = (n) => `${n}px`
    footer.style.setProperty('--tune-mascot-x', px(v.mascotX))
    footer.style.setProperty('--tune-mascot-y', px(v.mascotY))
    footer.style.setProperty('--tune-logo-x', px(v.logoX))
    footer.style.setProperty('--tune-logo-y', px(v.logoY))
    if (v.mascotW > 0) footer.style.setProperty('--tune-mascot-w', px(v.mascotW))
    else footer.style.removeProperty('--tune-mascot-w')
    if (v.logoW > 0) footer.style.setProperty('--tune-logo-w', px(v.logoW))
    else footer.style.removeProperty('--tune-logo-w')

    localStorage.setItem(STORE, JSON.stringify(v))
  }, [v])

  // Seed the sliders from the currently rendered widths. The images may not
  // have laid out on the first tick, so retry until a real measurement lands
  // rather than baking in a zero.
  useEffect(() => {
    if (v.mascotW && v.logoW) return
    let tries = 0
    let timer
    const measure = () => {
      const m = document.querySelector('.lead-footer__mascot')
      const l = document.querySelector('.lead-footer__biglogo')
      const mw = m ? Math.round(m.getBoundingClientRect().width) : 0
      const lw = l ? Math.round(l.getBoundingClientRect().width) : 0
      if (mw > 0 && lw > 0) {
        set({ mascotW: v.mascotW || mw, logoW: v.logoW || lw })
        return
      }
      if (tries++ < 40) timer = setTimeout(measure, 100)
    }
    measure()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dragging directly on the artwork.
  const onPointerDown = useCallback((e) => {
    const el = e.target.closest('.lead-footer__mascot, .lead-footer__biglogo')
    if (!el) return
    const which = el.classList.contains('lead-footer__mascot') ? 'mascot' : 'logo'
    e.preventDefault()
    e.stopPropagation()
    setActive(which)
    drag.current = {
      which,
      startX: e.clientX,
      startY: e.clientY,
      baseX: which === 'mascot' ? v.mascotX : v.logoX,
      baseY: which === 'mascot' ? v.mascotY : v.logoY,
    }
  }, [v.mascotX, v.mascotY, v.logoX, v.logoY])

  useEffect(() => {
    const move = (e) => {
      const d = drag.current
      if (!d) return
      const dx = Math.round(d.baseX + (e.clientX - d.startX))
      const dy = Math.round(d.baseY + (e.clientY - d.startY))
      set(d.which === 'mascot' ? { mascotX: dx, mascotY: dy } : { logoX: dx, logoY: dy })
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  // Arm the artwork for dragging: it is normally a link / pointer-events:none.
  useEffect(() => {
    const footer = document.querySelector('.lead-footer')
    if (!footer) return
    footer.classList.add('lead-footer--tuning')
    footer.addEventListener('pointerdown', onPointerDown, true)
    // The mascot is wrapped in a NavLink — suppress navigation while tuning.
    const block = (e) => {
      if (e.target.closest('.lead-footer__mascot-link')) { e.preventDefault(); e.stopPropagation() }
    }
    footer.addEventListener('click', block, true)
    return () => {
      footer.classList.remove('lead-footer--tuning')
      footer.removeEventListener('pointerdown', onPointerDown, true)
      footer.removeEventListener('click', block, true)
    }
  }, [onPointerDown])

  const nudge = (key, amount) => set({ [key]: v[key] + amount })

  const css = [
    '  .lead-footer__mascot {',
    `    width: ${v.mascotW}px;`,
    `    translate: ${v.mascotX}px ${v.mascotY}px;`,
    '  }',
    '',
    '  .lead-footer__biglogo {',
    `    width: ${v.logoW}px;`,
    `    translate: ${v.logoX}px ${v.logoY}px;`,
    '  }',
  ].join('\n')

  const copy = async () => {
    try { await navigator.clipboard.writeText(css); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    catch { /* clipboard blocked — the values are on screen anyway */ }
  }

  const reset = () => { localStorage.removeItem(STORE); setV({ ...DEFAULTS }) }

  const Row = ({ label, k, step = 1 }) => (
    <div className="ft-row">
      <span className="ft-key">{label}</span>
      <button onClick={() => nudge(k, -step)}>−</button>
      <input
        type="number"
        value={v[k]}
        onChange={(e) => set({ [k]: Number(e.target.value) || 0 })}
      />
      <button onClick={() => nudge(k, step)}>+</button>
    </div>
  )

  return (
    <div className="ft-panel">
      <div className="ft-head">
        <strong>Footer tuner</strong>
        <span className="ft-hint">drag the artwork</span>
      </div>

      <div className={`ft-group ${active === 'mascot' ? 'is-active' : ''}`}>
        <p className="ft-title">Mascot</p>
        <Row label="x" k="mascotX" />
        <Row label="y" k="mascotY" />
        <label className="ft-slider">
          <span>w {v.mascotW}px</span>
          <input type="range" min="80" max="700" value={v.mascotW}
            onChange={(e) => set({ mascotW: Number(e.target.value) })} />
        </label>
      </div>

      <div className={`ft-group ${active === 'logo' ? 'is-active' : ''}`}>
        <p className="ft-title">LEAD wordmark</p>
        <Row label="x" k="logoX" />
        <Row label="y" k="logoY" />
        <label className="ft-slider">
          <span>w {v.logoW}px</span>
          <input type="range" min="120" max="900" value={v.logoW}
            onChange={(e) => set({ logoW: Number(e.target.value) })} />
        </label>
      </div>

      <pre className="ft-out">{css}</pre>

      <div className="ft-actions">
        <button className="ft-primary" onClick={copy}>{copied ? 'Copied' : 'Copy CSS'}</button>
        <button onClick={reset}>Reset</button>
      </div>

      <p className="ft-note">
        Viewport {typeof window !== 'undefined' ? window.innerWidth : 0}px — values are
        px at this width.
      </p>
    </div>
  )
}
