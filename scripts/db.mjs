#!/usr/bin/env node
/**
 * Runs supabase/schema.sql against the project's Postgres database, then
 * verifies the result. Same SQL psql would run — this just avoids installing a
 * full PostgreSQL server to get a client.
 *
 * The connection URI is read from SUPABASE_DB_URL, which is loaded from
 * supabase/.env.db (gitignored). It contains your database password, so it is
 * never printed, and only the host is ever echoed.
 *
 *   node scripts/db.mjs migrate   apply schema.sql
 *   node scripts/db.mjs verify    show table columns + RLS policies
 *   node scripts/db.mjs list      print registrations (needs a direct DB URI)
 *   node scripts/db.mjs export    write registrations.csv
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import dotenv from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

dotenv.config({ path: resolve(root, 'supabase/.env.db'), quiet: true })

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error(`
Missing SUPABASE_DB_URL.

Create the file  supabase/.env.db  containing one line:

  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

Get it from Supabase: Project Settings -> Database -> Connection string -> URI.
That file is gitignored and must never be committed.
`)
  process.exit(1)
}

// Echo only the host, never the credentials.
let label = 'unknown host'
try {
  const u = new URL(url)
  label = `${u.hostname}:${u.port || 5432}${u.pathname}`
} catch {
  console.error('SUPABASE_DB_URL is not a valid URI.')
  process.exit(1)
}

const cmd = process.argv[2] || 'migrate'

const client = new pg.Client({
  connectionString: url,
  // Supabase terminates TLS with its own CA; verification is not available
  // through the pooler, so encrypt without asserting the chain.
  ssl: { rejectUnauthorized: false },
})

function table(rows) {
  if (!rows.length) return '  (none)'
  const cols = Object.keys(rows[0])
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)))
  const line = (cells) => '  ' + cells.map((c, i) => String(c ?? '').padEnd(w[i])).join('  ')
  return [line(cols), '  ' + w.map((n) => '-'.repeat(n)).join('  '), ...rows.map((r) => line(cols.map((c) => r[c])))].join('\n')
}

try {
  console.log(`Connecting to ${label} ...`)
  await client.connect()
  console.log('Connected.\n')

  if (cmd === 'migrate') {
    const sql = readFileSync(resolve(root, 'supabase/schema.sql'), 'utf8')
    await client.query(sql)
    console.log('Applied supabase/schema.sql\n')
  }

  if (cmd === 'migrate' || cmd === 'verify') {
    const cols = await client.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'registrations'
      order by ordinal_position`)
    console.log('registrations columns:')
    console.log(table(cols.rows))

    const pol = await client.query(`
      select policyname, cmd, roles::text
      from pg_policies
      where schemaname = 'public' and tablename = 'registrations'`)
    console.log('\nRLS policies:')
    console.log(table(pol.rows))

    const rls = await client.query(`
      select relrowsecurity as rls_enabled
      from pg_class where oid = 'public.registrations'::regclass`)
    console.log(`\nRLS enabled: ${rls.rows[0]?.rls_enabled}`)

    const n = await client.query('select count(*)::int as rows from public.registrations')
    console.log(`Rows: ${n.rows[0].rows}`)
  }

  if (cmd === 'list') {
    const r = await client.query(`
      select created_at, full_name, phone, email, admission_number, branch
      from public.registrations order by created_at desc`)
    console.log(table(r.rows))
  }

  if (cmd === 'export') {
    const r = await client.query('select * from public.registrations order by created_at')
    const cols = r.fields.map((f) => f.name)
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [cols.join(','), ...r.rows.map((row) => cols.map((c) => esc(row[c])).join(','))].join('\n')
    writeFileSync(resolve(root, 'registrations.csv'), csv)
    console.log(`Wrote registrations.csv (${r.rows.length} rows)`)
  }

  console.log('\nDone.')
} catch (err) {
  console.error(`\nFailed: ${err.message}`)
  if (err.code) console.error(`Postgres code: ${err.code}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
