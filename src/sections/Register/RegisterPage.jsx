import { useRef, useState } from 'react'
import { CheckCircle, ArrowRight } from 'lucide-react'
import Background from '../Contact/components/Background/Background'
import useMouseParallax from '../Contact/hooks/useMouseParallax'
import Footer from '../../components/Footer/Footer'
import GlassSelect from '../../components/GlassSelect/GlassSelect'
import { supabase, isSupabaseConfigured, missingSupabaseConfig } from '../../lib/supabaseClient'
import '../Contact/components/CenterPanel/ContactForm.css'
import './RegisterPage.css'

// TIET branches. "Other" lets anyone not listed still register.
const BRANCHES = [
  'Computer Engineering (COE)',
  'Computer Science & Business Systems (CSBS)',
  'Electronics & Computer Engineering (ENC)',
  'Electrical & Computer Engineering (ELC)',
  'Electronics & Communication Engineering (ECE)',
  'Mechanical Engineering (MEC)',
  'Mechatronics (MEA)',
  'Civil Engineering (CIE)',
  'Chemical Engineering (CHE)',
  'Biotechnology (BTC)',
  'Electrical Engineering (EEC)',
  'Industrial Engineering (INE)',
  'Other',
]

// Icebreaker. Stored as the plain answer; the A)-D) letters are display only.
const VIBE_OPTIONS = [
  'Absolutely not',
  'Weirdly valid',
  'I need to try this',
  'Who hurt you?',
]

const EMPTY = {
  full_name: '',
  phone: '',
  email: '',
  admission_number: '',
  branch: '',
  vibe_check: '',
}

/** Field-level rules. Returns an error string, or '' when the value is valid. */
function validateField(name, raw) {
  const value = (raw ?? '').trim()
  switch (name) {
    case 'full_name':
      if (!value) return 'Please enter your name.'
      if (value.length < 2) return 'That name looks too short.'
      return ''
    case 'phone':
      if (!value) return 'Please enter your phone number.'
      if (!/^[0-9]{10}$/.test(value)) return 'Enter a 10-digit phone number.'
      return ''
    case 'email':
      if (!value) return 'Please enter your email.'
      if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(value)) return 'That email does not look right.'
      return ''
    case 'admission_number':
      if (!value) return 'Please enter your admission number.'
      if (value.length < 3) return 'That admission number looks too short.'
      return ''
    case 'branch':
      if (!value) return 'Please select your branch.'
      return ''
    case 'vibe_check':
      if (!value) return 'Pick one — no wrong answers.'
      return ''
    default:
      return ''
  }
}

function GlassField({ label, name, value, error, onChange, onBlur, ...rest }) {
  const ref = useRef(null)
  const { rotate, reflect, isHovered } = useMouseParallax(ref, { maxRotation: 3 })
  const style = {
    '--input-rot-x': `${rotate.x}deg`,
    '--input-rot-y': `${rotate.y}deg`,
    '--input-reflect-x': `${reflect.x}%`,
    '--input-reflect-y': `${reflect.y}%`,
  }

  return (
    <div className="register-field">
      <div
        ref={ref}
        className={`glass-input-wrapper ${isHovered ? 'hovered' : ''} ${error ? 'has-error' : ''}`}
        style={style}
        onClick={(e) => e.currentTarget.querySelector('input, select')?.focus()}
      >
        <div className="input-reflection" />
        <label className="input-label" htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className="glass-input-field"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          {...rest}
        />
        <div className="input-glow-border" />
      </div>
      {error && <p className="register-error" id={`${name}-error`}>{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState('')

  const btnRef = useRef(null)
  const { rotate: btnRot, reflect: btnReflect } = useMouseParallax(btnRef, { maxRotation: 4 })
  const btnStyle = {
    '--btn-rot-x': `${btnRot.x}deg`,
    '--btn-rot-y': `${btnRot.y}deg`,
    '--btn-reflect-x': `${btnReflect.x}%`,
    '--btn-reflect-y': `${btnReflect.y}%`,
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    // Phone is digits-only, capped at 10 — stops most typos at the source.
    const next = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value
    setForm((prev) => ({ ...prev, [name]: next }))
    // Clear an existing error as soon as the field becomes valid again.
    if (errors[name] && !validateField(name, next)) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const nextErrors = {}
    for (const key of Object.keys(EMPTY)) {
      const msg = validateField(key, form[key])
      if (msg) nextErrors[key] = msg
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      document.querySelector('.register-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    if (!isSupabaseConfigured) {
      setFormError(
        `Registration is not configured yet. Missing: ${missingSupabaseConfig().join(', ')}.`
      )
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('registrations').insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      admission_number: form.admission_number.trim().toUpperCase(),
      branch: form.branch,
      vibe_check: form.vibe_check,
    })
    setSubmitting(false)

    if (error) {
      console.error('Supabase insert failed:', error)
      if (error.code === '23505') {
        setErrors((prev) => ({
          ...prev,
          admission_number: 'This admission number is already registered.',
        }))
        return
      }
      if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
        setFormError('Registration is blocked by database permissions. The insert policy is missing — run supabase/schema.sql.')
        return
      }
      setFormError(error.message || 'Could not submit your registration. Please try again.')
      return
    }

    setSuccess(true)
    setForm(EMPTY)
  }

  return (
    <>
      <div className="contact-page register-page">
        <Background />

        <main className="register-main">
          <header className="register-header">
            <div className="glow-pill-container">
              <div className="glow-pill">
                <span className="glow-pill-dot" />
                <span className="glow-pill-text">JOIN LEAD</span>
              </div>
            </div>
            <h1 className="register-heading">
              Register for <span className="gradient-highlight">LEAD 2026</span>
            </h1>
            <p className="register-sub">
              Learn · Emerge · Aspire · Discover — tell us who you are and we'll take it from there.
            </p>
          </header>

          <div className="register-card">
            {success ? (
              <div className="success-glass-card">
                <CheckCircle className="success-icon" />
                <h2 className="success-title">You're registered</h2>
                <p className="success-desc">
                  Thanks for signing up. We've saved your details and the LEAD team
                  will reach out with the next steps.
                </p>
                <button className="success-btn" onClick={() => setSuccess(false)}>
                  Register someone else
                </button>
              </div>
            ) : (
              <form className="register-form" onSubmit={handleSubmit} noValidate>
                <GlassField
                  label="Student Name"
                  name="full_name"
                  value={form.full_name}
                  error={errors.full_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Aisha Kapoor"
                  autoComplete="name"
                />

                <div className="register-row">
                  <GlassField
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    error={errors.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="9876543210"
                    autoComplete="tel"
                  />
                  <GlassField
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    error={errors.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="you@thapar.edu"
                    autoComplete="email"
                  />
                </div>

                <div className="register-row">
                  <GlassField
                    label="Admission Number"
                    name="admission_number"
                    value={form.admission_number}
                    error={errors.admission_number}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="102203456"
                  />
                  <GlassSelect
                    label="Branch"
                    name="branch"
                    value={form.branch}
                    error={errors.branch}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    options={BRANCHES}
                    placeholder="Select your branch"
                  />
                </div>

                <GlassSelect
                  label="Coke + Maggi — hear me out…"
                  name="vibe_check"
                  value={form.vibe_check}
                  error={errors.vibe_check}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  options={VIBE_OPTIONS}
                  placeholder="Pick one"
                  lettered
                />

                {formError && <p className="register-form-error" role="alert">{formError}</p>}

                <button
                  ref={btnRef}
                  type="submit"
                  className={`submit-btn ${submitting ? 'submitting' : ''}`}
                  style={btnStyle}
                  disabled={submitting}
                >
                  <div className="btn-reflection" />
                  <div className="btn-shine" />
                  <span className="btn-content">
                    {submitting ? 'Registering...' : (
                      <>
                        Complete Registration
                        <ArrowRight className="btn-arrow" />
                      </>
                    )}
                  </span>
                </button>

                <p className="register-privacy">
                  We use these details only to contact you about LEAD activities.
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </>
  )
}
