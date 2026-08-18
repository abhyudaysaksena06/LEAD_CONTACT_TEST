import { createClient } from '@supabase/supabase-js'

/**
 * Supabase browser client.
 *
 * Both values are safe to ship in the bundle: the anon key is a *publishable*
 * key and is meant to be visible client-side. What actually protects the data
 * is Row Level Security on the table — see supabase/schema.sql, which grants
 * anon INSERT only, with no SELECT. Never put the service_role key here.
 */
const rawUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
const key = typeof anonKey === 'string' ? anonKey.trim() : ''

// Placeholder values left over from .env.example are treated as "not set", so
// a half-filled .env reports as unconfigured rather than failing cryptically.
const isPlaceholder = (v) => !v || /^YOUR_/i.test(v) || v.includes('<')

function isValidUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** Which env vars are missing or malformed, so the UI can say so precisely. */
export function missingSupabaseConfig() {
  const missing = []
  if (isPlaceholder(url)) missing.push('VITE_SUPABASE_URL')
  else if (!isValidUrl(url)) missing.push('VITE_SUPABASE_URL (not a valid URL)')
  if (isPlaceholder(key)) missing.push('VITE_SUPABASE_ANON_KEY')
  return missing
}

export const isSupabaseConfigured = missingSupabaseConfig().length === 0

// createClient throws on an invalid URL, which would take down the whole page
// at import time. Build it defensively: callers check isSupabaseConfigured.
let client = null
if (isSupabaseConfigured) {
  try {
    // persistSession keeps the /admin login alive across refreshes. The
    // registration form is anonymous and unaffected by this.
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  } catch (err) {
    console.error('Supabase client could not be created:', err)
    client = null
  }
}

export const supabase = client
