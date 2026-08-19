import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import './GlassSelect.css'

/**
 * Custom dropdown styled to match the site.
 *
 * A native <select> renders its option list with the operating system's own
 * chrome — light grey on Windows — which looks foreign against the dark glass
 * UI and cannot be themed. This reimplements the control so the list is ours,
 * while keeping the keyboard and screen-reader behaviour a native select
 * provides: arrows to move, Enter/Space to choose, Escape to close, Home/End,
 * type-ahead, and roving aria-activedescendant.
 *
 * onChange is called with a { target: { name, value } } shape so it can be
 * dropped into the same handlers a native select used.
 */
export default function GlassSelect({
  label,
  name,
  value,
  options,
  placeholder = 'Select an option',
  error,
  onChange,
  onBlur,
  lettered = false,
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const triggerRef = useRef(null)
  const typeahead = useRef({ str: '', at: 0 })
  const uid = useId()

  const listId = `${uid}-list`
  const optionId = (i) => `${uid}-opt-${i}`
  const selectedIndex = options.indexOf(value)
  const display = (opt, i) => (lettered ? `${String.fromCharCode(65 + i)}) ${opt}` : opt)

  const close = useCallback((refocus = true) => {
    setOpen(false)
    setActive(-1)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const choose = useCallback((i) => {
    const next = options[i]
    if (next === undefined) return
    onChange?.({ target: { name, value: next } })
    close()
  }, [options, onChange, name, close])

  // Close on outside pointer or on focus leaving the control entirely.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false)
        setActive(-1)
        onBlur?.({ target: { name, value } })
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onBlur, name, value])

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  const openList = (startAt) => {
    setOpen(true)
    setActive(startAt ?? (selectedIndex >= 0 ? selectedIndex : 0))
  }

  const onKeyDown = (e) => {
    const { key } = e

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault()
        openList(key === 'ArrowUp' ? options.length - 1 : undefined)
      }
      return
    }

    switch (key) {
      case 'Escape':
        e.preventDefault(); close(); break
      case 'ArrowDown':
        e.preventDefault(); setActive((i) => (i + 1) % options.length); break
      case 'ArrowUp':
        e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); break
      case 'Home':
        e.preventDefault(); setActive(0); break
      case 'End':
        e.preventDefault(); setActive(options.length - 1); break
      case 'Enter':
      case ' ':
        e.preventDefault(); choose(active); break
      case 'Tab':
        close(false); break
      default: {
        // Type-ahead: letters jump to the first matching option.
        if (key.length !== 1) return
        const now = Date.now()
        const t = typeahead.current
        t.str = now - t.at > 700 ? key : t.str + key
        t.at = now
        const q = t.str.toLowerCase()
        const found = options.findIndex((o) => o.toLowerCase().startsWith(q))
        if (found >= 0) setActive(found)
      }
    }
  }

  return (
    <div className="register-field" ref={rootRef}>
      <div className={`gsel ${open ? 'is-open' : ''} ${error ? 'has-error' : ''}`}>
        <span className="gsel__label" id={`${uid}-label`}>{label}</span>

        <button
          type="button"
          ref={triggerRef}
          className="gsel__trigger"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={`${uid}-label`}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-invalid={Boolean(error)}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            // Only a real exit counts — moving into the list must not blur.
            if (!rootRef.current?.contains(e.relatedTarget)) onBlur?.({ target: { name, value } })
          }}
        >
          <span className={`gsel__value ${value ? '' : 'is-placeholder'}`}>
            {value ? display(value, selectedIndex) : placeholder}
          </span>
          <ChevronDown className="gsel__chevron" size={17} aria-hidden="true" />
        </button>

        {open && (
          <ul className="gsel__list" id={listId} role="listbox" ref={listRef}
              aria-labelledby={`${uid}-label`}>
            {options.map((opt, i) => (
              <li
                key={opt}
                id={optionId(i)}
                role="option"
                aria-selected={opt === value}
                className={`gsel__option ${i === active ? 'is-active' : ''} ${opt === value ? 'is-selected' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{display(opt, i)}</span>
                {opt === value && <Check size={15} className="gsel__tick" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="register-error">{error}</p>}
    </div>
  )
}
