import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogOut, RefreshCw, Download, Search, Trash2, ShieldAlert } from 'lucide-react'
import { supabase, isSupabaseConfigured, missingSupabaseConfig } from '../../lib/supabaseClient'
import './AdminPage.css'

/**
 * Unlisted admin console at /admin.
 *
 * There is no link to this page anywhere in the site. That is obscurity, not
 * security — the actual protection is Supabase Auth plus the RLS policies in
 * supabase/admin.sql, which only grant SELECT/DELETE to emails present in
 * public.admins. Reaching this URL without those credentials shows a login and
 * nothing else; even a forged session cannot read the table.
 */
export default function AdminPage() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  // Keep crawlers out even though nothing links here.
  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    const prevTitle = document.title
    document.title = 'LEAD — Admin'
    return () => {
      document.head.removeChild(tag)
      document.title = prevTitle
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <div className="admin-card admin-card--narrow">
          <ShieldAlert className="admin-warn-icon" />
          <h1 className="admin-title">Not configured</h1>
          <p className="admin-sub">Missing: {missingSupabaseConfig().join(', ')}</p>
        </div>
      </Shell>
    )
  }

  if (checking) {
    return <Shell><div className="admin-card admin-card--narrow"><p className="admin-sub">Checking session…</p></div></Shell>
  }

  return session ? <Dashboard session={session} /> : <Login />
}

function Shell({ children }) {
  return (
    <div className="admin-page">
      <div className="admin-grid-bg" aria-hidden="true" />
      <main className="admin-main">{children}</main>
    </div>
  )
}

/* ========================================================================== */

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    // Deliberately vague: do not reveal whether the email exists.
    if (error) setError('Invalid credentials.')
  }

  return (
    <Shell>
      <form className="admin-card admin-card--narrow" onSubmit={submit}>
        <p className="admin-eyebrow">RESTRICTED</p>
        <h1 className="admin-title">Admin Access</h1>
        <p className="admin-sub">Registration console for LEAD 2026.</p>

        <label className="admin-label" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          className="admin-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="admin-label" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          className="admin-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="admin-error" role="alert">{error}</p>}

        <button className="admin-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Shell>
  )
}

/* ========================================================================== */

function Dashboard({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [live, setLive] = useState(false)
  const [flash, setFlash] = useState(null) // id of a just-arrived row
  const flashTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      setError(
        /permission|policy|row-level/i.test(error.message)
          ? 'Signed in, but this account is not an admin. Add your email to public.admins (see supabase/admin.sql).'
          : error.message
      )
      return
    }
    setError('')
    setRows(data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // Live updates. Realtime respects RLS, so only admins receive payloads.
  useEffect(() => {
    const channel = supabase
      .channel('registrations-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations' },
        (payload) => {
          setRows((prev) =>
            prev.some((r) => r.id === payload.new.id) ? prev : [payload.new, ...prev]
          )
          setFlash(payload.new.id)
          clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setFlash(null), 2500)
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'registrations' },
        (payload) => setRows((prev) => prev.filter((r) => r.id !== payload.old.id))
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => {
      clearTimeout(flashTimer.current)
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.admission_number, r.branch]
        .some((v) => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, query])

  const byBranch = useMemo(() => {
    const m = new Map()
    for (const r of rows) m.set(r.branch, (m.get(r.branch) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return rows.filter((r) => new Date(r.created_at) >= start).length
  }, [rows])

  const exportCsv = () => {
    const cols = ['created_at', 'full_name', 'phone', 'email', 'admission_number', 'branch']
    const esc = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [cols.join(','), ...filtered.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lead-registrations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const remove = async (row) => {
    if (!confirm(`Delete the registration for ${row.full_name} (${row.admission_number})?`)) return
    const { error } = await supabase.from('registrations').delete().eq('id', row.id)
    if (error) { alert(`Could not delete: ${error.message}`); return }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  const fmt = (ts) => {
    const d = new Date(ts)
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="admin-page admin-page--wide">
      <div className="admin-grid-bg" aria-hidden="true" />
      <main className="admin-main admin-main--wide">

        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">
              <span className={`admin-dot ${live ? 'is-live' : ''}`} />
              {live ? 'LIVE' : 'CONNECTING…'}
            </p>
            <h1 className="admin-title">Registrations</h1>
            <p className="admin-sub">{session.user.email}</p>
          </div>
          <div className="admin-actions">
            <button className="admin-btn admin-btn--ghost" onClick={load} title="Refresh">
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="admin-btn admin-btn--ghost" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={15} /> CSV
            </button>
            <button className="admin-btn admin-btn--ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        <section className="admin-stats">
          <Stat label="Total" value={rows.length} />
          <Stat label="Today" value={today} />
          <Stat label="Branches" value={byBranch.length} />
          <Stat label="Showing" value={filtered.length} />
        </section>

        {error && <p className="admin-error admin-error--block" role="alert">{error}</p>}

        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={15} />
            <input
              className="admin-search-input"
              placeholder="Search name, email, phone, admission no, branch…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Name</th>
                <th>Admission No.</th>
                <th>Branch</th>
                <th>Phone</th>
                <th>Email</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="admin-empty">Loading…</td></tr>
              )}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    {rows.length ? 'No matches for that search.' : 'No registrations yet.'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className={flash === r.id ? 'is-new' : ''}>
                  <td className="admin-mono admin-dim">{fmt(r.created_at)}</td>
                  <td>{r.full_name}</td>
                  <td className="admin-mono">{r.admission_number}</td>
                  <td>{r.branch}</td>
                  <td className="admin-mono">
                    <a href={`tel:${r.phone}`}>{r.phone}</a>
                  </td>
                  <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td>
                    <button
                      className="admin-icon-btn"
                      onClick={() => remove(r)}
                      aria-label={`Delete ${r.full_name}`}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {byBranch.length > 0 && (
          <section className="admin-breakdown">
            <h2 className="admin-h2">By branch</h2>
            <ul className="admin-bars">
              {byBranch.map(([branch, n]) => (
                <li key={branch}>
                  <span className="admin-bar-label">{branch}</span>
                  <span className="admin-bar-track">
                    <span
                      className="admin-bar-fill"
                      style={{ width: `${(n / rows.length) * 100}%` }}
                    />
                  </span>
                  <span className="admin-bar-value">{n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat-value">{value}</span>
      <span className="admin-stat-label">{label}</span>
    </div>
  )
}
